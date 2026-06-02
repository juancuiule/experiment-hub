import { BaseComponent } from '.';

/**
 * Base for the `content` family — components that display information to the
 * participant. Content components collect no data and produce no output.
 */
export interface BaseContentComponent<
  U extends string,
  Props,
> extends BaseComponent<'content', U> {
  props: Props;
}

/** Renders a block of HTML/markdown `content` (supports answer piping). */
export type RichTextComponent = BaseContentComponent<
  'rich-text',
  { content: string }
>;

/**
 * Renders an image. `url` and `alt` support answer piping; interpolated `url`s
 * are restricted to `http(s)` or relative paths for security.
 */
export type ImageComponent = BaseContentComponent<
  'image',
  {
    url: string;
    alt: string;
    className?: string;
  }
>;

/**
 * Renders a video from `url`. `autoplay`/`muted`/`loop`/`controls` toggle the
 * corresponding playback behaviors.
 */
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

/**
 * Renders an audio clip from `url`. `autoplay`/`loop`/`controls` toggle the
 * corresponding playback behaviors.
 */
export type AudioComponent = BaseContentComponent<
  'audio',
  {
    url: string;
    autoplay?: boolean;
    loop?: boolean;
    controls?: boolean;
  }
>;

/** Union of every `content`-family component. */
export type ContentComponent =
  | RichTextComponent
  | ImageComponent
  | VideoComponent
  | AudioComponent;
