import { z } from 'zod';
import { FrameworkScreen } from './screen';
import { hasRandomizedOptions } from './components/response';
import { ScreenComponent } from './components';
import { evaluateCondition } from './conditions';
import { ConditionalComponent } from './components/control';
import { buildFieldSchema } from './field-schema';

function collectFields(
  components: ScreenComponent[],
  acc: Record<string, z.ZodTypeAny> = {},
): Record<string, z.ZodTypeAny> {
  for (const component of components) {
    if (component.componentFamily === 'response') {
      acc[component.props.dataKey] = buildFieldSchema(component);
      if (hasRandomizedOptions(component)) {
        acc[`${component.props.dataKey}__order`] = z
          .array(z.string())
          .optional();
      }
    } else if (
      component.componentFamily === 'layout' &&
      component.template === 'group'
    ) {
      collectFields(component.props.components, acc);
    } else if (
      component.componentFamily === 'control' &&
      component.template === 'conditional'
    ) {
      // Nested response fields are optional in base schema;
      // superRefine enforces required rules when condition is true at submit time.
      const inner = component.props.component;
      if (inner.componentFamily === 'response') {
        acc[inner.props.dataKey] = buildFieldSchema(inner).optional();
      } else {
        collectFields([inner], acc);
      }
      // Also handle else branch if present
      if (component.props.else) {
        const elseBranch = component.props.else;
        if (elseBranch.componentFamily === 'response') {
          if (!(elseBranch.props.dataKey in acc)) {
            acc[elseBranch.props.dataKey] =
              buildFieldSchema(elseBranch).optional();
          }
        } else {
          collectFields([elseBranch], acc);
        }
      }
    } else if (
      component.componentFamily === 'control' &&
      component.template === 'for-each'
    ) {
      if (component.props.type === 'static') {
        const template = component.props.component;
        if (template.componentFamily === 'response') {
          for (let i = 0; i < component.props.values.length; i++) {
            const resolvedKey = template.props.dataKey.replace(
              '@index',
              String(i),
            );
            acc[resolvedKey] = buildFieldSchema(template);
          }
        }
        // dynamic for-each: skip — dataKey is not statically resolvable
      }
    }
  }
  return acc;
}

function collectConditionals(
  components: ScreenComponent[],
): ConditionalComponent[] {
  // Known limitation: a for-each wrapping a conditional is not recursed here (deferred).
  // Known limitation: the else branch of a conditional is not enforced in superRefine (deferred).
  const result: ConditionalComponent[] = [];
  for (const component of components) {
    if (
      component.componentFamily === 'control' &&
      component.template === 'conditional'
    ) {
      result.push(component);
      // Recurse into nested conditionals
      collectConditionals([component.props.component]).forEach((c) =>
        result.push(c),
      );
      if (component.props.else) {
        collectConditionals([component.props.else]).forEach((c) =>
          result.push(c),
        );
      }
    } else if (
      component.componentFamily === 'layout' &&
      component.template === 'group'
    ) {
      collectConditionals(component.props.components).forEach((c) =>
        result.push(c),
      );
    }
  }
  return result;
}

export function buildSchema(screen: FrameworkScreen) {
  const shape = collectFields(screen.components);
  // passthrough() preserves keys not in shape (e.g. dynamic for-each fields whose dataKey
  // is a runtime template). Remove once buildSchema handles dynamic for-each statically.
  const baseSchema = z.object(shape).passthrough();

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
      if (inner.componentFamily === 'response') {
        const { required = true, errorMessage } = inner.props;
        if (!required) continue;

        const value = data[inner.props.dataKey];
        const isEmpty =
          value === undefined ||
          value === null ||
          value === '' ||
          (Array.isArray(value) && value.length === 0);

        if (isEmpty) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: errorMessage ?? 'This field is required',
            path: [inner.props.dataKey],
          });
        }
      }
    }
  }) as typeof baseSchema;
}

/// New iteration

export function inspectFields(components: ScreenComponent[]): string[] {
  // The idea of this function is to detect every dataKey
  // that we may get from this screen. We need to consider complex
  // nesting cases involving conditionls/groups/for-eachs.
  return components.flatMap(inspectComponent);
}

function inspectComponent(component: ScreenComponent): string[] {
  switch (component.componentFamily) {
    case 'response': {
      return [component.props.dataKey];
    }
    case 'layout': {
      if (component.template === 'group') {
        return inspectFields(component.props.components);
      }
      return [];
    }
    case 'control': {
      switch (component.template) {
        case 'conditional': {
          const innerKeys = inspectComponent(component.props.component);
          const elseKeys = component.props.else
            ? inspectComponent(component.props.else)
            : [];
          return [...innerKeys, ...elseKeys].map(
            (key) => `<conditional id=${component.id}>${key}</conditional>`,
          );
        }
        case 'for-each': {
          const id = component.props.id;
          const templateKeys = inspectComponent(component.props.component);
          if (component.props.type === 'static') {
            // If it's a static for-each, we can resolve the dataKeys by unrolling it
            const values = component.props.values;
            return values.flatMap((value, index) => {
              return templateKeys.map((key) => {
                return key
                  .replace(`{{#${id}.index}}`, String(index))
                  .replace(`{{#${id}.value}}`, String(value));
              });
            });
          } else {
            // If it's a dynamic one we can only save the template of the dataKey and handle it at runtime
            return templateKeys.map((key) => `<dynamic-for-each:${key}>`);
          }
        }
      }
    }
    case 'content': {
      // Content components don't have dataKeys
      return [];
    }
  }
}
