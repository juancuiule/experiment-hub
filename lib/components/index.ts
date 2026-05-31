import { ContentComponent } from "./content";
import { ControlComponent } from "./control";
import { LayoutComponent } from "./layout";
import { ResponseComponent } from "./response";

/**
 * The four component families. `content` displays information, `response`
 * collects participant data, `layout` structures the screen, and `control` adds
 * conditional rendering / iteration within a single screen.
 */
type ComponentFamily = "layout" | "content" | "response" | "control";

/**
 * Shared shape of every component. `componentFamily` + `template` together pick
 * the concrete component (and the renderer's dispatch path); `id` is optional.
 * Each family defines a `Base*Component` that adds a `props` field.
 */
export interface BaseComponent<T extends ComponentFamily, U extends string> {
  id?: string;
  componentFamily: T;
  template: U;
}

/**
 * Any component that can appear in a screen's ordered component list — the union
 * across all four families. Components render in sequence to the participant.
 */
export type ScreenComponent =
  | ControlComponent
  | ContentComponent
  | ResponseComponent
  | LayoutComponent;
