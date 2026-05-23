import { ScreenComponent } from './components';
import { ResponseComponent } from './components/response';
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

function defaultFromComponent(
  component: ScreenComponent,
  context: Context,
): Record<string, unknown> {
  switch (component.componentFamily) {
    case 'layout': {
      if (component.template === 'group') {
        return buildDefaultValues(component.props.components, context);
      }
      return {};
    }
    case 'control': {
      switch (component.template) {
        case 'conditional': {
          // We can't determine which branch of the condition will be
          // taken at build time, so we evaluate the condition with the
          // current context and return defaults for the branch that is
          // taken. This means that if the condition depends on user
          // input or other dynamic data, the defaults may not be accurate
          // until that data is available in the context.
          const condition = resolveCondition(component.props.if, context);
          const branch = evaluateCondition(condition, context)
            ? component.props.component
            : component.props.else;
          return branch ? defaultFromComponent(branch, context) : {};
        }
        case 'for-each': {
          // If iter values are static, we can compute defaults at build time.
          // If they are dynamic we try to get the current value from context,
          // but if it's not there we return an empty array since we don't
          // know how many iterations there will be and which values they will have.
          const iterValues =
            component.props.type === 'static'
              ? component.props.values
              : ((getValue(component.props.dataKey, context) as
                  | string[]
                  | null) ?? []);
          const inner = component.props.component;

          // Remap the inner component for each iter value,
          // resolving any data keys that depend on the iter value.
          // TODO: check if this happens multiple times and check if we should
          // TODO: resolve other values too, like labels that might depend on iter values.
          const components = iterValues.map((value, i) => {
            const newContext = mergeContext(context, {
              screenData: {
                foreachData: { [component.props.id]: { index: i, value } },
              },
            });

            if (inner.componentFamily === 'response') {
              return deepMerge(inner, {
                props: {
                  dataKey: resolveValuesInString(
                    inner.props.dataKey,
                    newContext,
                  ),
                },
              });
            } else {
              return inner;
            }
          });

          return buildDefaultValues(components, context);
        }
        default:
          return {};
      }
    }
    case 'response': {
      return { [component.props.dataKey]: defaultPerTemplate(component) };
    }
    default:
      return {};
  }
}

export function buildDefaultValues(
  components: ScreenComponent[],
  context: Context,
): Record<string, unknown> {
  return components.reduce<Record<string, unknown>>(
    (defaults, component) => ({
      ...defaults,
      ...defaultFromComponent(component, context),
    }),
    {},
  );
}
