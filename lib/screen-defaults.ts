import { ScreenComponent } from './components';
import { ResponseComponent } from './components/response';
import { evaluateCondition, resolveCondition } from './conditions';
import { flatMap, Handlers, on } from './flatMap';
import { mergeContext } from './flow';
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

/**
 * Each handler emits zero or more [key, value] pairs.
 * `buildDefaultValues` collects them into a record at the end.
 * State carries the current Context — needed because for-each rewrites it
 * per iteration.
 */
type Entry = [string, unknown];
type State = { context: Context };

export function buildDefaultValues(
  components: ScreenComponent[],
  context: Context,
): Record<string, unknown> {
  const handlers: Handlers<Entry, State> = [
    on({ componentFamily: 'response' }, (c, state) => [
      [
        resolveValuesInString(c.props.dataKey, state.context),
        defaultPerTemplate(c),
      ] as Entry,
    ]),

    on({ componentFamily: 'layout', template: 'group' }, (c, state, recur) =>
      recur(c.props.components, state),
    ),

    on(
      { componentFamily: 'control', template: 'conditional' },
      (c, state, recur) => {
        const condition = resolveCondition(c.props.if, state.context);
        const branch = evaluateCondition(condition, state.context)
          ? c.props.component
          : c.props.else;
        return branch ? recur([branch], state) : [];
      },
    ),

    on(
      { componentFamily: 'control', template: 'for-each' },
      (c, state, recur) => {
        const iterValues =
          c.props.type === 'static'
            ? c.props.values
            : ((getValue(c.props.dataKey, state.context) as string[] | null) ??
              []);
        const inner = c.props.component;

        return iterValues.flatMap((value, index) => {
          const iterCtx = mergeContext(state.context, {
            screenData: { foreachData: { [c.props.id]: { index, value } } },
          });
          return recur([inner], { context: iterCtx });
        });
      },
    ),

    on({ componentFamily: 'content' }, (): Entry[] => []),
  ];

  const entries = flatMap(components, { context }, handlers);
  return Object.fromEntries(entries);
}
