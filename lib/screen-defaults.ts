import { ScreenComponent } from './components';
import { ResponseComponent } from './components/response';
import { walkComponents } from './components/walk';
import { evaluateCondition, resolveCondition } from './conditions';
import { deepMerge, mergeContext } from './flow';
import { getValue, resolveValuesInString } from './resolve';
import { Context } from './types';

export function defaultPerTemplate(
  component: ResponseComponent,
): string | boolean | string[] | number | null {
  switch (component.template) {
    case 'radio':
    case 'dropdown':
      return '';
    case 'checkboxes':
      return [];
    case 'single-checkbox':
      return component.props.defaultValue ?? false;
    case 'slider':
      return null;
    case 'numeric-input':
      return component.props.defaultValue ?? null;
    default:
      return '';
  }
}

export function buildDefaultValues(
  components: ScreenComponent[],
  context: Context,
): Record<string, unknown> {
  type Entry = [string, unknown];
  const visitor: Parameters<typeof walkComponents<Entry>>[2] = {
    response: (c) => [[c.props.dataKey, defaultPerTemplate(c)]],
    group: (children, ctx) => walkComponents(children, ctx, visitor),
    // We can't determine which branch of the condition will be taken at build
    // time, so we evaluate the condition with the current context and return
    // defaults for the branch that is taken.
    conditional: (thenC, elseC, condition, ctx) => {
      const resolvedCondition = resolveCondition(condition, ctx);
      const branch = evaluateCondition(resolvedCondition, ctx) ? thenC : elseC;
      return branch ? walkComponents([branch], ctx, visitor) : [];
    },
    // If iter values are static, we can compute defaults at build time.
    // If they are dynamic we try to get the current value from context,
    // but if it's not there we return an empty array since we don't know
    // how many iterations there will be and which values they will have.
    forEach: (template, meta, ctx) => {
      const iterValues =
        meta.type === 'static'
          ? meta.values
          : ((getValue(meta.dataKey, ctx) as string[] | null) ?? []);

      // Remap the inner component for each iter value, resolving any data
      // keys that depend on the iter value.
      const remapped = iterValues.map((value, index) => {
        const newContext = mergeContext(ctx, {
          screenData: { foreachData: { [meta.id]: { index, value } } },
        });
        if (template.componentFamily === 'response') {
          return deepMerge(template, {
            props: {
              dataKey: resolveValuesInString(template.props.dataKey, newContext),
            },
          });
        }
        return template;
      });

      return walkComponents(remapped, ctx, visitor);
    },
  };

  return Object.fromEntries(walkComponents(components, context, visitor));
}
