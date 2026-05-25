import { BaseComponent } from '.';

export interface BaseContentComponent<
  U extends string,
  Props,
> extends BaseComponent<'content', U> {
  props: Props;
}

export type RichTextComponent = BaseContentComponent<
  'rich-text',
  { content: string }
>;

export type ImageComponent = BaseContentComponent<
  'image',
  {
    url: string;
    alt: string;
    className?: string;
  }
>;

export type VideoComponent = BaseContentComponent<
  'video',
  {
    url: string;
    autoplay?: boolean;
    muted?: boolean;
    loop?: boolean;
    controls?: boolean;
  }
>;

export type AudioComponent = BaseContentComponent<
  'audio',
  {
    url: string;
    autoplay?: boolean;
    loop?: boolean;
    controls?: boolean;
  }
>;

export type ContentComponent =
  | RichTextComponent
  | ImageComponent
  | VideoComponent
  | AudioComponent;
