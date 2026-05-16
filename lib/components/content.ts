import { BaseComponent } from ".";

export interface BaseContentComponent<
  U extends string,
  Props,
> extends BaseComponent<"content", U> {
  props: Props;
}

export interface RichTextComponent extends BaseContentComponent<
  "rich-text",
  { content: string }
> {}

export interface ImageComponent extends BaseContentComponent<
  "image",
  {
    url: string;
    alt: string;
    className?: string;
  }
> {}

export interface VideoComponent extends BaseContentComponent<
  "video",
  {
    url: string;
    autoplay?: boolean;
    muted?: boolean;
    loop?: boolean;
    controls?: boolean;
  }
> {}

export interface AudioComponent extends BaseContentComponent<
  "audio",
  {
    url: string;
    autoplay?: boolean;
    loop?: boolean;
    controls?: boolean;
  }
> {}

export type ContentComponent =
  | RichTextComponent
  | ImageComponent
  | VideoComponent
  | AudioComponent;
