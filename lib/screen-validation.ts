import { z } from 'zod';
import { ScreenComponent } from './components';
import { hasRandomizedOptions, ResponseComponent } from './components/response';
import { ComponentVisitor, ForEachMeta, walkComponents } from './components/walk';
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

type DynamicForEachMeta = {
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
      foreach: [DynamicForEachMeta, ...DynamicForEachMeta[]];
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
      foreach: [DynamicForEachMeta, ...DynamicForEachMeta[]];
    };

function and(a: Condition | null, b: Condition): Condition {
  return a === null ? b : { type: 'and', conditions: [a, b] };
}

export function collectDescriptors(
  components: ScreenComponent[],
  context: Context,
  enclosingCondition: Condition | null,
): FieldDescriptor[] {
  return walkComponents(components, context, buildDescriptorVisitor(enclosingCondition));
}

function buildDescriptorVisitor(
  enclosingCondition: Condition | null,
): ComponentVisitor<FieldDescriptor> {
  const visitor: ComponentVisitor<FieldDescriptor> = {
    response: (c, ctx) => {
      const key = resolveValuesInString(c.props.dataKey, ctx);
      const base: FieldDescriptor = {
        key,
        synthetic: false,
        dynamic: false,
        source: c,
        condition: enclosingCondition,
      };
      const descriptors: FieldDescriptor[] = [base];
      if (hasRandomizedOptions(c)) {
        descriptors.push({
          key: `${key}:order`,
          synthetic: true,
          dynamic: false,
          condition: enclosingCondition,
        });
      }
      return descriptors;
    },
    group: (children, ctx) => walkComponents(children, ctx, visitor),
    conditional: (thenC, elseC, condition, ctx) => {
      const ifDescriptors = walkComponents(
        [thenC],
        ctx,
        buildDescriptorVisitor(and(enclosingCondition, condition)),
      );
      const elseDescriptors = elseC
        ? walkComponents(
            [elseC],
            ctx,
            buildDescriptorVisitor(
              and(enclosingCondition, { type: 'not', condition }),
            ),
          )
        : [];
      return [...ifDescriptors, ...elseDescriptors];
    },
    forEach: (template, meta, ctx) => {
      if (meta.type === 'static') {
        const inner = walkComponents([template], ctx, visitor);
        return meta.values.flatMap((value, index) => {
          const subContext = mergeContext(ctx, {
            screenData: {
              foreachData: { [meta.id]: { index, value } },
            },
          });
          return inner.map(
            (descriptor) =>
              ({
                ...descriptor,
                key: resolveValuesInString(descriptor.key, subContext),
                condition:
                  descriptor.condition !== null
                    ? resolveCondition(descriptor.condition, subContext)
                    : null,
              }) as FieldDescriptor,
          );
        });
      }
      // dynamic — meta.type === 'dynamic' after the static branch above
      const inner = walkComponents([template], ctx, visitor);
      const dynMeta: DynamicForEachMeta = {
        id: meta.id,
        dataKey: meta.dataKey,
      };
      return inner.map(
        (descriptor) =>
          ({
            ...descriptor,
            dynamic: true,
            foreach: descriptor.dynamic
              ? [dynMeta, ...descriptor.foreach]
              : [dynMeta],
          }) as FieldDescriptor,
      );
    },
  };
  return visitor;
}

export function buildSchemaFromDescriptors(
  descriptors: FieldDescriptor[],
  context: Context,
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

  return baseSchema.superRefine((data: Record<string, unknown>, ctx) => {
    const fullContext = mergeContext(context, {
      screenData: data,
    });

    for (const descriptor of staticConditional) {
      if (!evaluateCondition(descriptor.condition, fullContext)) continue;
      const result = buildFieldSchema(descriptor.source).safeParse(
        data[descriptor.key],
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

    function iterateForeachChain(
      chain: [ForEachMeta, ...ForEachMeta[]],
      loopCtx: Context,
      callback: (resolvedCtx: Context) => void,
    ): void {
      const [head, ...rest] = chain;
      const values = getValue(head.dataKey, loopCtx);
      if (!Array.isArray(values)) return;
      for (let index = 0; index < values.length; index++) {
        const value = values[index];
        const nextCtx = mergeContext(loopCtx, {
          screenData: { foreachData: { [head.id]: { index, value } } },
        });
        if (rest.length === 0) {
          callback(nextCtx);
        } else {
          iterateForeachChain(
            rest as [ForEachMeta, ...ForEachMeta[]],
            nextCtx,
            callback,
          );
        }
      }
    }

    for (const descriptor of dynamicDescriptors) {
      iterateForeachChain(descriptor.foreach, fullContext, (loopCtx) => {
        const concreteKey = resolveValuesInString(descriptor.key, loopCtx);

        const resolvedCondition =
          descriptor.condition !== null
            ? resolveCondition(descriptor.condition, loopCtx)
            : null;

        if (
          resolvedCondition !== null &&
          !evaluateCondition(resolvedCondition, loopCtx)
        ) {
          return;
        }

        if (descriptor.synthetic) {
          const result = z
            .array(z.string())
            .optional()
            .safeParse(data[concreteKey]);
          if (!result.success) {
            for (const issue of result.error.issues) {
              ctx.addIssue({
                ...issue,
                path: [concreteKey, ...(issue.path ?? [])],
              });
            }
          }
          return;
        }

        const result = buildFieldSchema(descriptor.source).safeParse(
          data[concreteKey],
        );
        if (!result.success) {
          for (const issue of result.error.issues) {
            ctx.addIssue({
              ...issue,
              path: [concreteKey, ...(issue.path ?? [])],
            });
          }
        }
      });
    }
  }) as typeof baseSchema;
}

export function inspectFields(
  components: ScreenComponent[],
  context: Context,
): string[] {
  // The idea of this function is to detect every dataKey
  // that we may get from this screen. We need to consider complex
  // nesting cases involving conditionals/groups/for-each loops.
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
              return templateKeys.map((key) =>
                resolveValuesInString(key, subContext),
              );
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
