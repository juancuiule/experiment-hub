import { ScreenComponent } from './components';
import { ResponseComponent } from './components/response';
import { mergeContext } from './flow';
import { resolveValuesInString } from './resolve';
import { FrameworkScreen } from './screen';
import { Context } from './types';

export function defaultPerTemplate(
  component: ResponseComponent,
): string | boolean | string[] | number | null {
  switch (component.template) {
    case 'button-group':
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

function collectDefaults(
  components: ScreenComponent[],
  context: Context,
  values: Record<string, unknown> = {},
): Record<string, unknown> {
  for (const c of components) {
    if (c.componentFamily !== 'response') {
      if (c.componentFamily === 'layout' && c.template === 'group') {
        collectDefaults(c.props.components, context, values);
      } else if (
        c.componentFamily === 'control' &&
        c.template === 'conditional'
      ) {
        collectDefaults([c.props.component], context, values);
        if (c.props.else) collectDefaults([c.props.else], context, values);
      } else if (
        c.componentFamily === 'control' &&
        c.template === 'for-each' &&
        c.props.type === 'static'
      ) {
        const inner = c.props.component;
        for (let i = 0; i < c.props.values.length; i++) {
          const subContext = mergeContext(context, {
            screenData: {
              foreachData: {
                [c.props.id]: { index: i, value: c.props.values[i] },
              },
            },
          });
          let resolved: ScreenComponent;
          if (inner.componentFamily === 'response') {
            resolved = {
              ...inner,
              props: {
                ...inner.props,
                dataKey: resolveValuesInString(inner.props.dataKey, subContext),
              },
            } as typeof inner;
          } else {
            resolved = inner;
          }
          collectDefaults([resolved], subContext, values);
        }
      }
      continue;
    }
    values[c.props.dataKey] = defaultPerTemplate(c);
  }
  return values;
}

export function buildDefaultValues(
  screen: FrameworkScreen,
  context: Context,
): Record<string, unknown> {
  return collectDefaults(screen.components, context);
}
