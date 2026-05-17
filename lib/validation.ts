import { z } from 'zod';
import { FrameworkScreen } from './screen';
import { hasRandomizedOptions, ResponseComponent } from './components/response';
import { ScreenComponent } from './components';
import { evaluateCondition } from './conditions';
import { getValue } from './resolve';
import { buildFieldSchema } from './field-schema';

type FieldEntry = { component: ResponseComponent; dataKey: string };

// Collects only always-present fields. Conditional branches are skipped here —
// Phase 2 (superRefine / validateComponentTree) evaluates conditions at runtime.
function collectFieldEntries(component: ScreenComponent): FieldEntry[] {
  if (component.componentFamily === 'response') {
    return [{ component, dataKey: component.props.dataKey }];
  }
  if (component.componentFamily === 'layout' && component.template === 'group') {
    return component.props.components.flatMap((c) => collectFieldEntries(c));
  }
  if (component.componentFamily === 'control') {
    if (component.template === 'conditional') {
      // Conditional fields are validated at runtime by Phase 2 (superRefine).
      return [];
    }
    if (component.template === 'for-each' && component.props.type === 'static') {
      return component.props.values.flatMap((value, index) =>
        collectFieldEntries(component.props.component).map((entry) => ({
          ...entry,
          dataKey: entry.dataKey
            .replaceAll(`{{#${component.props.id}.index}}`, String(index))
            .replaceAll(`{{#${component.props.id}.value}}`, value),
        })),
      );
    }
    // dynamic for-each: skip — dataKey is not statically resolvable
  }
  return [];
}

function collectFields(components: ScreenComponent[]): Record<string, z.ZodTypeAny> {
  const acc: Record<string, z.ZodTypeAny> = {};
  for (const { component, dataKey } of components.flatMap((c) =>
    collectFieldEntries(c),
  )) {
    if (dataKey in acc) continue; // guards against accidental dataKey collisions
    acc[dataKey] = buildFieldSchema(component);
    if (hasRandomizedOptions(component)) {
      acc[`${dataKey}__order`] = z.array(z.string()).optional();
    }
  }
  return acc;
}

// forEachCtx accumulates {id → {value, index}} as we descend into for-each loops,
// so that {{#id.value}} and {{#id.index}} placeholders can be resolved at any depth.
type ForEachCtx = Record<string, { value: string; index: number }>;

function resolveTemplateKey(key: string, ctx: ForEachCtx): string {
  return Object.entries(ctx).reduce(
    (k, [id, { value, index }]) =>
      k.replaceAll(`{{#${id}.value}}`, value).replaceAll(`{{#${id}.index}}`, String(index)),
    key,
  );
}

// dynamic=false: field belongs to the static Phase 1 schema, skip.
// dynamic=true: inside a conditional branch or dynamic for-each — Phase 2 owns validation.
function validateComponentTree(
  component: ScreenComponent,
  screenData: Record<string, any>,
  forEachCtx: ForEachCtx,
  dynamic: boolean,
  issues: Array<{ path: string; message: string }>,
): void {
  if (component.componentFamily === 'response') {
    if (!dynamic) return;
    const { required = true, errorMessage } = component.props;
    const resolvedKey = resolveTemplateKey(component.props.dataKey, forEachCtx);
    const value = screenData[resolvedKey];

    // Absent values bypass Zod's type checks entirely, so handle them first with
    // the component's own errorMessage before falling through to the full schema.
    if (value === undefined || value === null) {
      if (required) {
        issues.push({ path: resolvedKey, message: errorMessage ?? 'This field is required' });
      }
      return;
    }

    // Value is present — run the same rules as Phase 1 to catch constraint violations
    // (minLength, maxLength, pattern, min/max, shouldBe, etc.).
    const result = buildFieldSchema(component).safeParse(value);
    if (!result.success) {
      for (const issue of result.error.issues) {
        issues.push({ path: resolvedKey, message: issue.message });
      }
    }
    return;
  }

  if (component.componentFamily === 'layout' && component.template === 'group') {
    for (const child of component.props.components) {
      validateComponentTree(child, screenData, forEachCtx, dynamic, issues);
    }
    return;
  }

  if (component.componentFamily === 'control') {
    if (component.template === 'conditional') {
      // Build a context with foreachData so evaluateCondition can resolve {{#id.value}}
      // patterns in the condition's dataKey (e.g. '$likes-{{#for-each-fruit.value}}').
      const context = {
        screenData: { ...screenData, foreachData: forEachCtx },
        data: {},
        loopData: {},
      };
      const conditionMet = evaluateCondition(component.props.if, context);
      const branch = conditionMet ? component.props.component : component.props.else;
      if (branch) {
        validateComponentTree(branch, screenData, forEachCtx, true, issues);
      }
      return;
    }

    if (component.template === 'for-each') {
      if (component.props.type === 'static') {
        component.props.values.forEach((value, index) => {
          const newCtx = { ...forEachCtx, [component.props.id]: { value, index } };
          validateComponentTree(component.props.component, screenData, newCtx, dynamic, issues);
        });
      } else {
        const context = {
          screenData: { ...screenData, foreachData: forEachCtx },
          data: {},
          loopData: {},
        };
        const values = getValue(component.props.dataKey, context);
        if (!Array.isArray(values)) return;
        values.forEach((v, index) => {
          const newCtx = { ...forEachCtx, [component.props.id]: { value: String(v), index } };
          validateComponentTree(component.props.component, screenData, newCtx, true, issues);
        });
      }
    }
  }
}

type Field = { dataKey: string; always: boolean; dynamic?: boolean };
export function getComponentFields(component: ScreenComponent): Field[] {
  switch (component.componentFamily) {
    case 'content': {
      // Content components don't have fields relevant to validation
      return [];
    }
    case 'layout': {
      if (component.template === 'group') {
        // For groups, we aggregate fields from child components.
        return component.props.components.flatMap((c) => getComponentFields(c));
      }
      return [];
    }
    case 'response': {
      // For response components, we return the dataKey as a field.
      // Validation will determine if it's required or optional.
      // If they are nested in conditionals, they will be marked as
      // not always present by the conditional case below.
      return [
        { dataKey: component.props.dataKey, always: true },
        hasRandomizedOptions(component)
          ? { dataKey: `${component.props.dataKey}__order`, always: true }
          : null,
      ].filter((f): f is Field => f !== null);
    }
    case 'control': {
      switch (component.template) {
        case 'conditional': {
          const ifFields = getComponentFields(component.props.component).flat();
          const elseFields = component.props.else
            ? getComponentFields(component.props.else).flat()
            : [];
          // This fields come from components that are only sometimes
          // rendered, so we mark them as not always present.
          return [...ifFields, ...elseFields].map((f) => ({
            ...f,
            always: false,
          }));
        }
        case 'for-each': {
          const templateFields = getComponentFields(component.props.component);
          if (component.props.type === 'static') {
            // Static for-each: we have index and value to resolve templates,
            // so we can return fully resolved dataKeys for each iteration
            return component.props.values.flatMap((value, index) =>
              templateFields.map((f) => ({
                ...f,
                dataKey: f.dataKey
                  .replaceAll(`{{#${component.props.id}.index}}`, String(index))
                  .replaceAll(`{{#${component.props.id}.value}}`, value),
              })),
            );
          } else {
            // Dynamic for-each: return dataKey as is with dynamic flag,
            // since we can't resolve it statically
            return templateFields.map((f) => ({
              ...f,
              dynamic: true,
            }));
          }
        }
      }
    }
  }
}

export function buildSchema(screen: FrameworkScreen) {
  const shape = collectFields(screen.components);
  // passthrough() preserves dynamically-keyed fields from dynamic for-each (e.g. "eats-apple")
  // that are not in the static shape but must survive schema parsing to be submitted.
  const baseSchema = z.object(shape).passthrough();

  return baseSchema.superRefine((data, ctx) => {
    const screenData = data as Record<string, any>;
    const issues: Array<{ path: string; message: string }> = [];

    for (const component of screen.components) {
      validateComponentTree(component, screenData, {}, false, issues);
    }

    for (const { path, message } of issues) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message, path: [path] });
    }
  }) as typeof baseSchema;
}

function describeResponseType(
  component: ResponseComponent,
  optional: boolean,
): string {
  const base = (() => {
    switch (component.template) {
      case 'text-input':
      case 'text-area':
      case 'date-input':
      case 'time-input':
      case 'dropdown':
      case 'radio':
      case 'likert-scale':
        return 'string';
      case 'checkboxes':
        return 'string[]';
      case 'numeric-input':
        return 'number';
      case 'slider':
        return 'null | number';
      case 'single-checkbox':
        return 'boolean';
    }
  })();
  return optional ? `${base}?` : base;
}

function collectFieldDescriptions(
  components: ScreenComponent[],
  acc: Record<string, string> = {},
  withinConditional = false,
): Record<string, string> {
  for (const component of components) {
    if (component.componentFamily === 'response') {
      const optional = withinConditional || !(component.props.required ?? true);
      acc[component.props.dataKey] = describeResponseType(component, optional);
      if (hasRandomizedOptions(component)) {
        acc[`${component.props.dataKey}__order`] = 'string[]?';
      }
    } else if (
      component.componentFamily === 'layout' &&
      component.template === 'group'
    ) {
      collectFieldDescriptions(
        component.props.components,
        acc,
        withinConditional,
      );
    } else if (
      component.componentFamily === 'control' &&
      component.template === 'conditional'
    ) {
      collectFieldDescriptions([component.props.component], acc, true);
      if (component.props.else) {
        collectFieldDescriptions([component.props.else], acc, true);
      }
    } else if (
      component.componentFamily === 'control' &&
      component.template === 'for-each' &&
      component.props.type === 'static'
    ) {
      const template = component.props.component;
      if (template.componentFamily === 'response') {
        for (let i = 0; i < component.props.values.length; i++) {
          const key = template.props.dataKey
            .replace(`{{#${component.props.id}.index}}`, String(i))
            .replace(
              `{{#${component.props.id}.value}}`,
              component.props.values[i],
            );
          acc[key] = describeResponseType(template, false);
        }
      }
    }
  }
  return acc;
}

export function getSchemaShape(
  screen: FrameworkScreen,
): Record<string, string> {
  return collectFieldDescriptions(screen.components);
}
