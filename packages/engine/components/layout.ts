import { BaseComponent, ScreenComponent } from '.';

/**
 * Base for the `layout` family — components that control a screen's structure
 * and navigation rather than displaying or collecting content.
 */
export interface BaseLayoutComponent<
  U extends string,
  Props,
> extends BaseComponent<'layout', U> {
  props: Props;
}

/**
 * Advances the screen when clicked. `text` is the label, `disabled` blocks
 * advancing, `alignBottom` pins it to the bottom. An optional `payload` writes
 * `{ value }` under `dataKey` into the submitted data when the button is used.
 */
export type ButtonComponent = BaseLayoutComponent<
  'button',
  {
    text?: string;
    disabled?: boolean;
    alignBottom?: boolean;
    payload?: { dataKey: string; value: unknown };
  }
>;

/**
 * Wraps a set of nested `components` under a named container, for visual or
 * logical grouping. `name` identifies the group.
 */
export type GroupComponent = BaseLayoutComponent<
  'group',
  {
    name: string;
    components: ScreenComponent[];
  }
>;

/** Union of every `layout`-family component. */
export type LayoutComponent = ButtonComponent | GroupComponent;
