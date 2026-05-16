import { z } from "zod";
import { FrameworkScreen } from "./screen";
import { hasRandomizedOptions, ResponseComponent } from "./components/response";
import { ScreenComponent } from "./components";
import { evaluateCondition } from "./conditions";
import { ConditionalComponent } from "./components/control";

function buildFieldSchema(component: ResponseComponent): z.ZodTypeAny {
  const { required = true, errorMessage } = component.props;
  const msg = errorMessage ?? "This field is required";

  switch (component.template) {
    case "text-input":
    case "text-area": {
      const { minLength, maxLength, pattern } = component.props;
      let base = z.string();
      if (required) base = base.min(1, msg);
      if (minLength)
        base = base.min(
          minLength.value,
          minLength.errorMessage ??
            `Must be at least ${minLength.value} characters`,
        );
      if (maxLength)
        base = base.max(
          maxLength.value,
          maxLength.errorMessage ??
            `Must be at most ${maxLength.value} characters`,
        );
      if (pattern)
        base = base.regex(
          new RegExp(pattern.value),
          pattern.errorMessage ?? "Invalid format",
        );
      return required ? base : base.optional();
    }

    case "date-input":
    case "time-input": {
      const base = z.string();
      return required ? base.min(1, msg) : base.optional();
    }

    case "dropdown":
    case "radio": {
      const base = z.string();
      return required ? base.min(1, msg) : base.optional();
    }

    case "checkboxes": {
      const { min, max } = component.props;
      let base = z.array(z.string());
      if (required || (min !== undefined && min > 0)) {
        base = base.min(
          min ?? 1,
          errorMessage ??
            (min !== undefined && min > 1
              ? `Select at least ${min} options`
              : "Please select at least one option"),
        );
      }
      if (max !== undefined) {
        base = base.max(max, errorMessage ?? `Select at most ${max} options`);
      }
      return base;
    }

    case "likert-scale": {
      const base = z.string();
      return required ? base.min(1, msg) : base.optional();
    }

    case "numeric-input": {
      const { min, max } = component.props;
      let base = z.coerce.number();
      if (min !== undefined)
        base = base.min(min, errorMessage ?? `Must be at least ${min}`);
      if (max !== undefined)
        base = base.max(max, errorMessage ?? `Must be at most ${max}`);
      return required ? base : base.optional();
    }

    case "slider": {
      const { min = 0, max = 100, minValue, maxValue } = component.props;

      const buildCoerceBase = () => {
        let base = z.coerce.number().min(min).max(max);
        if (minValue)
          base = base.min(
            minValue.value,
            minValue.errorMessage ?? `Must be at least ${minValue.value}`,
          );
        if (maxValue)
          base = base.max(
            maxValue.value,
            maxValue.errorMessage ?? `Must be at most ${maxValue.value}`,
          );
        return base;
      };

      if (required) {
        // required on a slider means: user must have interacted (value must not be null)
        // First gate on null/undefined, then delegate to the coerce chain for range checks.
        return z.preprocess(
          (v) => v,
          z
            .any()
            .refine(
              (v) => v !== undefined && v !== null && Number.isFinite(Number(v)),
              { message: msg },
            )
        ).pipe(buildCoerceBase() as z.ZodTypeAny) as z.ZodTypeAny;
      }

      // not required: null is accepted (user didn't interact),
      // but if a value is present it must be valid
      return z.union([z.null(), buildCoerceBase()]);
    }

    case "single-checkbox": {
      const { shouldBe } = component.props;
      if (shouldBe !== undefined) {
        return z.boolean().refine((v) => v === shouldBe, {
          message: errorMessage ?? `Must be ${shouldBe}`,
        });
      }
      return required
        ? z.boolean().refine((v) => v === true, { message: msg })
        : z.boolean();
    }
  }
}

function collectFields(
  components: ScreenComponent[],
  acc: Record<string, z.ZodTypeAny> = {},
): Record<string, z.ZodTypeAny> {
  for (const component of components) {
    if (component.componentFamily === "response") {
      acc[component.props.dataKey] = buildFieldSchema(component);
      if (hasRandomizedOptions(component)) {
        acc[`${component.props.dataKey}__order`] = z.array(z.string()).optional();
      }
    } else if (component.componentFamily === "layout" && component.template === "group") {
      collectFields(component.props.components, acc);
    } else if (component.componentFamily === "control" && component.template === "conditional") {
      // Nested response fields are optional in base schema;
      // superRefine enforces required rules when condition is true at submit time.
      const inner = component.props.component;
      if (inner.componentFamily === "response") {
        acc[inner.props.dataKey] = buildFieldSchema(inner).optional();
      } else {
        collectFields([inner], acc);
      }
      // Also handle else branch if present
      if (component.props.else) {
        const elseBranch = component.props.else;
        if (elseBranch.componentFamily === "response") {
          if (!(elseBranch.props.dataKey in acc)) {
            acc[elseBranch.props.dataKey] = buildFieldSchema(elseBranch).optional();
          }
        } else {
          collectFields([elseBranch], acc);
        }
      }
    } else if (component.componentFamily === "control" && component.template === "for-each") {
      if (component.props.type === "static") {
        const template = component.props.component;
        if (template.componentFamily === "response") {
          for (let i = 0; i < component.props.values.length; i++) {
            const resolvedKey = template.props.dataKey.replace("@index", String(i));
            acc[resolvedKey] = buildFieldSchema(template);
          }
        }
        // dynamic for-each: skip — dataKey is not statically resolvable
      }
    }
  }
  return acc;
}

function collectConditionals(components: ScreenComponent[]): ConditionalComponent[] {
  // Known limitation: a for-each wrapping a conditional is not recursed here (deferred).
  // Known limitation: the else branch of a conditional is not enforced in superRefine (deferred).
  const result: ConditionalComponent[] = [];
  for (const component of components) {
    if (component.componentFamily === "control" && component.template === "conditional") {
      result.push(component);
      // Recurse into nested conditionals
      collectConditionals([component.props.component]).forEach((c) => result.push(c));
      if (component.props.else) {
        collectConditionals([component.props.else]).forEach((c) => result.push(c));
      }
    } else if (component.componentFamily === "layout" && component.template === "group") {
      collectConditionals(component.props.components).forEach((c) => result.push(c));
    }
  }
  return result;
}

export function buildSchema(screen: FrameworkScreen) {
  const shape = collectFields(screen.components);
  const baseSchema = z.object(shape);

  const conditionals = collectConditionals(screen.components);
  if (conditionals.length === 0) {
    return baseSchema;
  }

  return baseSchema.superRefine((data, ctx) => {
    for (const conditional of conditionals) {
      const condition = conditional.props.if;
      const conditionMet = evaluateCondition(condition, {
        screenData: data as Record<string, any>,
        data: {},
        loopData: {},
      });

      if (!conditionMet) continue;

      const inner = conditional.props.component;
      if (inner.componentFamily === "response") {
        const { required = true, errorMessage } = inner.props;
        if (!required) continue;

        const value = data[inner.props.dataKey];
        const isEmpty =
          value === undefined ||
          value === null ||
          value === "" ||
          (Array.isArray(value) && value.length === 0);

        if (isEmpty) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: errorMessage ?? "This field is required",
            path: [inner.props.dataKey],
          });
        }
      }
    }
  }) as typeof baseSchema;
}
