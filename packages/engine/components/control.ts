import { BaseComponent, ScreenComponent } from '.';
import { Condition } from '../conditions';
import { RefPrefix } from '../tokens';

/**
 * Base for the `control` family — components that add conditional rendering and
 * iteration *within a single screen render*, as opposed to the flow-level
 * `branch`/`loop` nodes.
 */
export interface BaseControlComponent<
  U extends string,
  Props,
> extends BaseComponent<'control', U> {
  props: Props;
}

/**
 * Renders the `then` component only when `if` holds, otherwise the optional
 * `else` one. Uses the full composable `Condition` type (same as `branch`
 * nodes). Because `Screen.tsx` uses `shouldUnregister`, a hidden branch's
 * response values are dropped from the submitted form data.
 */
export type ConditionalComponent = BaseControlComponent<
  'conditional',
  {
    if: Condition;
    then: ScreenComponent;
    else?: ScreenComponent;
  }
>;

/**
 * Renders `component` once per item in a list, all on the same screen (the
 * render-level analogue of a `loop` node). `id` names the iteration so the
 * template can reference the current item via `{{#id.value}}` / `{{#id.index}}`
 * (note the `#` prefix). Items come from inline `values` (static) or a
 * `$$`/`$`/`@`/`#` `dataKey` (dynamic).
 *
 * `randomized` shuffles items once at screen entry, recording the order in form
 * data as `<id>:order`; it is invalid on a `dynamic` for-each using the `$`
 * prefix (live form state isn't resolvable at screen entry). `reshuffleInLoop`
 * controls whether that order is reshuffled per loop iteration (default `false`).
 */
export type ForEachComponent = BaseControlComponent<
  'for-each',
  (
    | { type: 'static'; values: any[] }
    | { type: 'dynamic'; dataKey: `${RefPrefix}${string}` }
  ) & {
    id: string;
    component: ScreenComponent;
    randomized?: boolean;
    reshuffleInLoop?: boolean;
  }
>;

/** Union of every `control`-family component. */
export type ControlComponent = ConditionalComponent | ForEachComponent;
