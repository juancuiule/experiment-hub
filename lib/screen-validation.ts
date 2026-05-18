import { z } from 'zod';
import { FrameworkScreen } from './screen';
import { hasRandomizedOptions, ResponseComponent } from './components/response';
import { ScreenComponent } from './components';
import { evaluateCondition, Condition, resolveCondition } from './conditions';
import { buildFieldSchema } from './field-schema';
import { Context } from './types';
import { resolveValuesInString, getValue } from './resolve';


export function buildSchema(
  screen: FrameworkScreen,
  context?: Pick<Context, 'data'>,
) {
  const descriptors = collectDescriptors(screen.components, null);
  return buildSchemaFromDescriptors(descriptors, context ?? { data: {} });
}

// ─── Descriptor-based pipeline ───────────────────────────────────────────────

type ForEachMeta = {
  id: string;
  dataKey: `$$${string}` | `$${string}`;
};

type FieldDescriptor =
  | { key: string; synthetic: false; dynamic: false; source: ResponseComponent; condition: Condition | null }
  | { key: string; synthetic: false; dynamic: true; source: ResponseComponent; condition: Condition | null; foreach: ForEachMeta }
  | { key: string; synthetic: true; dynamic: false; condition: Condition | null }
  | { key: string; synthetic: true; dynamic: true; condition: Condition | null; foreach: ForEachMeta };

function and(a: Condition | null, b: Condition): Condition {
  return a === null ? b : { type: 'and', conditions: [a, b] };
}

export function collectDescriptors(
  components: ScreenComponent[],
  enclosingCondition: Condition | null,
): FieldDescriptor[] {
  return components.flatMap((c) => collectDescriptor(c, enclosingCondition));
}

function collectDescriptor(
  component: ScreenComponent,
  enclosingCondition: Condition | null,
): FieldDescriptor[] {
  switch (component.componentFamily) {
    case 'response': {
      const base: FieldDescriptor = {
        key: component.props.dataKey,
        synthetic: false,
        dynamic: false,
        source: component,
        condition: enclosingCondition,
      };
      const descriptors: FieldDescriptor[] = [base];
      if (hasRandomizedOptions(component)) {
        descriptors.push({
          key: `${component.props.dataKey}__order`,
          synthetic: true,
          dynamic: false,
          condition: enclosingCondition,
        });
      }
      return descriptors;
    }

    case 'layout': {
      if (component.template === 'group') {
        return collectDescriptors(component.props.components, enclosingCondition);
      }
      return [];
    }

    case 'content': {
      return [];
    }

    case 'control': {
      if (component.template === 'conditional') {
        const ifDescriptors = collectDescriptors(
          [component.props.component],
          and(enclosingCondition, component.props.if),
        );
        const elseDescriptors = component.props.else
          ? collectDescriptors(
              [component.props.else],
              and(enclosingCondition, { type: 'not', condition: component.props.if }),
            )
          : [];
        return [...ifDescriptors, ...elseDescriptors];
      }

      if (component.template === 'for-each') {
        if (component.props.type === 'static') {
          return component.props.values.flatMap((value, index) => {
            const inner = collectDescriptors([component.props.component], enclosingCondition);
            const subCtx: Context = {
              screenData: { foreachData: { [component.props.id]: { index, value } } },
              data: {},
              loopData: {},
            };
            return inner.map((descriptor) => {
              const resolvedKey = resolveValuesInString(descriptor.key, subCtx);
              const resolvedCondition =
                descriptor.condition !== null
                  ? resolveCondition(descriptor.condition, subCtx)
                  : null;
              return { ...descriptor, key: resolvedKey, condition: resolvedCondition, dynamic: false } as FieldDescriptor;
            });
          });
        }

        // dynamic
        const inner = collectDescriptors([component.props.component], enclosingCondition);
        const meta: ForEachMeta = {
          id: component.props.id,
          dataKey: component.props.dataKey,
        };
        return inner.map(
          (descriptor) => ({ ...descriptor, dynamic: true, foreach: meta }) as FieldDescriptor,
        );
      }

      return [];
    }
  }
}

export function buildSchemaFromDescriptors(
  descriptors: FieldDescriptor[],
  context: Pick<Context, 'data'>,
) {
  const shape: Record<string, z.ZodTypeAny> = {};

  for (const descriptor of descriptors) {
    if (descriptor.dynamic) continue;

    if (descriptor.synthetic) {
      shape[descriptor.key] = z.array(z.string()).optional();
    } else if (descriptor.condition === null) {
      shape[descriptor.key] = buildFieldSchema(descriptor.source);
    } else {
      shape[descriptor.key] = z.any().optional();
    }
  }

  const baseSchema = z.object(shape).passthrough();

  const staticConditional = descriptors.filter(
    (d): d is Extract<FieldDescriptor, { dynamic: false; synthetic: false }> & { condition: Condition } =>
      !d.dynamic && !d.synthetic && d.condition !== null,
  );
  const dynamicDescriptors = descriptors.filter(
    (d): d is Extract<FieldDescriptor, { dynamic: true }> => d.dynamic,
  );

  if (staticConditional.length === 0 && dynamicDescriptors.length === 0) {
    return baseSchema;
  }

  return baseSchema.superRefine((data, ctx) => {
    const fullContext: Context = {
      screenData: data as Record<string, unknown>,
      data: context.data ?? {},
      loopData: {},
    };

    for (const descriptor of staticConditional) {
      if (!evaluateCondition(descriptor.condition, fullContext)) continue;
      const result = buildFieldSchema(descriptor.source).safeParse(
        (data as Record<string, unknown>)[descriptor.key],
      );
      if (!result.success) {
        for (const issue of result.error.issues) {
          ctx.addIssue({ ...issue, path: [descriptor.key, ...(issue.path ?? [])] });
        }
      }
    }

    for (const descriptor of dynamicDescriptors) {
      if (descriptor.synthetic) continue;

      const values = getValue(descriptor.foreach.dataKey, fullContext);
      if (!Array.isArray(values)) continue;

      for (let index = 0; index < values.length; index++) {
        const value = values[index];

        const existingForeachData =
          ((fullContext.screenData as Record<string, unknown>)?.['foreachData'] as Record<string, unknown>) ?? {};

        const loopCtx: Context = {
          ...fullContext,
          screenData: {
            ...(fullContext.screenData as Record<string, unknown>),
            foreachData: {
              ...existingForeachData,
              [descriptor.foreach.id]: { index, value },
            } as Record<string, { index: number; value: any }>,
          },
        };

        const concreteKey = resolveValuesInString(descriptor.key, loopCtx);
        const resolvedCondition =
          descriptor.condition !== null
            ? resolveCondition(descriptor.condition, loopCtx)
            : null;

        if (resolvedCondition !== null && !evaluateCondition(resolvedCondition, loopCtx)) {
          continue;
        }

        const result = buildFieldSchema(descriptor.source).safeParse(
          (data as Record<string, unknown>)[concreteKey],
        );
        if (!result.success) {
          for (const issue of result.error.issues) {
            ctx.addIssue({ ...issue, path: [concreteKey, ...(issue.path ?? [])] });
          }
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
