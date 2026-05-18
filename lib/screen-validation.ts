import { z } from 'zod';
import { ScreenComponent } from './components';
import { hasRandomizedOptions, ResponseComponent } from './components/response';
import { Condition, evaluateCondition, resolveCondition } from './conditions';
import { buildFieldSchema } from './field-schema';
import { mergeContext } from './flow';
import { getValue, resolveValuesInString } from './resolve';
import { FrameworkScreen } from './screen';
import { Context } from './types';

export function buildSchema(screen: FrameworkScreen, context: Context) {
  const descriptors = collectDescriptors(screen.components, context, null);
  return buildSchemaFromDescriptors(descriptors, context);
}

// ─── Descriptor-based pipeline ───────────────────────────────────────────────

type ForEachMeta = {
  id: string;
  dataKey: `$$${string}` | `$${string}`;
};

type FieldDescriptor =
  | {
      key: string;
      synthetic: false;
      dynamic: false;
      source: ResponseComponent;
      condition: Condition | null;
    }
  | {
      key: string;
      synthetic: false;
      dynamic: true;
      source: ResponseComponent;
      condition: Condition | null;
      foreach: ForEachMeta;
    }
  | {
      key: string;
      synthetic: true;
      dynamic: false;
      condition: Condition | null;
    }
  | {
      key: string;
      synthetic: true;
      dynamic: true;
      condition: Condition | null;
      foreach: ForEachMeta;
    };

function and(a: Condition | null, b: Condition): Condition {
  return a === null ? b : { type: 'and', conditions: [a, b] };
}

export function collectDescriptors(
  components: ScreenComponent[],
  context: Context,
  enclosingCondition: Condition | null,
): FieldDescriptor[] {
  return components.flatMap((component) =>
    collectDescriptor(component, context, enclosingCondition),
  );
}

function collectDescriptor(
  component: ScreenComponent,
  context: Context,
  enclosingCondition: Condition | null,
): FieldDescriptor[] {
  switch (component.componentFamily) {
    case 'response': {
      const key = resolveValuesInString(component.props.dataKey, context);
      const base: FieldDescriptor = {
        key,
        synthetic: false,
        dynamic: false,
        source: component,
        condition: enclosingCondition,
      };
      const descriptors: FieldDescriptor[] = [base];
      if (hasRandomizedOptions(component)) {
        descriptors.push({
          key: `${key}:order`,
          synthetic: true,
          dynamic: false,
          condition: enclosingCondition,
        });
      }
      return descriptors;
    }

    case 'layout': {
      if (component.template === 'group') {
        return collectDescriptors(
          component.props.components,
          context,
          enclosingCondition,
        );
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
          context,
          and(enclosingCondition, component.props.if),
        );
        const elseDescriptors = component.props.else
          ? collectDescriptors(
              [component.props.else],
              context,
              and(enclosingCondition, {
                type: 'not',
                condition: component.props.if,
              }),
            )
          : [];
        return [...ifDescriptors, ...elseDescriptors];
      }

      if (component.template === 'for-each') {
        if (component.props.type === 'static') {
          const inner = collectDescriptors(
            [component.props.component],
            context,
            enclosingCondition,
          );
          return component.props.values.flatMap((value, index) => {
            const subContext = mergeContext(context, {
              screenData: {
                foreachData: { [component.props.id]: { index, value } },
              },
            });
            return inner.map((descriptor) => {
              const resolvedKey = resolveValuesInString(
                descriptor.key,
                subContext,
              );
              const resolvedCondition =
                descriptor.condition !== null
                  ? resolveCondition(descriptor.condition, subContext)
                  : null;
              return {
                ...descriptor,
                key: resolvedKey,
                condition: resolvedCondition,
              } as FieldDescriptor;
            });
          });
        }

        // dynamic
        const inner = collectDescriptors(
          [component.props.component],
          context,
          enclosingCondition,
        );
        const meta: ForEachMeta = {
          id: component.props.id,
          dataKey: component.props.dataKey,
        };
        return inner.map(
          (descriptor) =>
            ({
              ...descriptor,
              dynamic: true,
              foreach: meta,
            }) as FieldDescriptor,
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
      shape[descriptor.key] = z.array(z.string());
    } else if (descriptor.condition === null) {
      shape[descriptor.key] = buildFieldSchema(descriptor.source);
    } else {
      shape[descriptor.key] = z.any().optional();
    }
  }

  const baseSchema = z.object(shape).passthrough();

  const staticConditional = descriptors.filter(
    (
      d,
    ): d is Extract<FieldDescriptor, { dynamic: false; synthetic: false }> & {
      condition: Condition;
    } => !d.dynamic && !d.synthetic && d.condition !== null,
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
          ctx.addIssue({
            ...issue,
            path: [descriptor.key, ...(issue.path ?? [])],
          });
        }
      }
    }

    for (const descriptor of dynamicDescriptors) {
      const values = getValue(descriptor.foreach.dataKey, fullContext);
      if (!Array.isArray(values)) continue;

      for (let index = 0; index < values.length; index++) {
        const value = values[index];

        const loopCtx = mergeContext(fullContext, {
          screenData: {
            foreachData: {
              [descriptor.foreach.id]: { index, value },
            },
          },
        });

        const concreteKey = resolveValuesInString(descriptor.key, loopCtx);

        if (descriptor.synthetic) {
          const result = z.array(z.string()).safeParse(
            (data as Record<string, unknown>)[concreteKey],
          );
          if (!result.success) {
            for (const issue of result.error.issues) {
              ctx.addIssue({
                ...issue,
                path: [concreteKey, ...(issue.path ?? [])],
              });
            }
          }
          continue;
        }

        const resolvedCondition =
          descriptor.condition !== null
            ? resolveCondition(descriptor.condition, loopCtx)
            : null;

        if (
          resolvedCondition !== null &&
          !evaluateCondition(resolvedCondition, loopCtx)
        ) {
          continue;
        }

        const result = buildFieldSchema(descriptor.source).safeParse(
          (data as Record<string, unknown>)[concreteKey],
        );
        if (!result.success) {
          for (const issue of result.error.issues) {
            ctx.addIssue({
              ...issue,
              path: [concreteKey, ...(issue.path ?? [])],
            });
          }
        }
      }
    }
  }) as typeof baseSchema;
}

/// New iteration

export function inspectFields(
  components: ScreenComponent[],
  context: Context,
): string[] {
  // The idea of this function is to detect every dataKey
  // that we may get from this screen. We need to consider complex
  // nesting cases involving conditionls/groups/for-eachs.
  return components.flatMap((component) =>
    inspectComponent(component, context),
  );
}

function inspectComponent(
  component: ScreenComponent,
  context: Context,
): string[] {
  switch (component.componentFamily) {
    case 'response': {
      if (hasRandomizedOptions(component)) {
        return [
          resolveValuesInString(component.props.dataKey, context),
          `${resolveValuesInString(component.props.dataKey, context)}:order`,
        ];
      }
      return [resolveValuesInString(component.props.dataKey, context)];
    }
    case 'layout': {
      if (component.template === 'group') {
        return inspectFields(component.props.components, context);
      }
      return [];
    }
    case 'control': {
      switch (component.template) {
        case 'conditional': {
          const innerKeys = inspectComponent(
            component.props.component,
            context,
          );
          const elseKeys = component.props.else
            ? inspectComponent(component.props.else, context)
            : [];
          return [...innerKeys, ...elseKeys].map(
            (key) => `<conditional id=${component.id}>${key}</conditional>`,
          );
        }
        case 'for-each': {
          const id = component.props.id;
          const templateKeys = inspectComponent(
            component.props.component,
            context,
          );
          if (component.props.type === 'static') {
            // If it's a static for-each, we can resolve the dataKeys by unrolling it
            const values = component.props.values;
            return values.flatMap((value, index) => {
              const subContext = mergeContext(context, {
                screenData: {
                  foreachData: { [id]: { index, value } },
                },
              });
              return templateKeys.map((key) => resolveValuesInString(key, subContext));
            });
          } else {
            // If it's a dynamic one we can only save the template of the dataKey and handle it at runtime
            return templateKeys.map((key) => `<dynamic-for-each:${key}>`);
          }
        }
      }
      return [];
    }
    case 'content': {
      // Content components don't have dataKeys
      return [];
    }
  }
}
