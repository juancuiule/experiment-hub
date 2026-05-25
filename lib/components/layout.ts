import { BaseComponent, ScreenComponent } from '.';

export interface BaseLayoutComponent<
  U extends string,
  Props,
> extends BaseComponent<'layout', U> {
  props: Props;
}

export type ButtonComponent = BaseLayoutComponent<
  'button',
  {
    text?: string;
    disabled?: boolean;
    alignBottom?: boolean;
  }
>;

export type GroupComponent = BaseLayoutComponent<
  'group',
  {
    name: string;
    components: ScreenComponent[];
  }
>;

export type LayoutComponent = ButtonComponent | GroupComponent;
