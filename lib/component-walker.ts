import { ScreenComponent } from './components';
import { Context } from './types';

/**
 * A pattern is a partial shape matched structurally against a component.
 * Only the discriminator-ish top-level fields are matchable here
 * (componentFamily, template, id). That's enough to narrow the union,
 * and avoids the pain of pattern-matching arbitrary nested `props`.
 *
 * To match on `props`, do it inside `visit` — by that point the
 * component is already narrowed, so `component.props` is fully typed.
 */
export type ComponentPattern = Partial<
  Pick<ScreenComponent, 'componentFamily' | 'template' | 'id'>
>;

/**
 * Given a pattern P, narrow ScreenComponent to just the variants that
 * structurally satisfy P. This is the bit that makes the visit callback
 * typed correctly.
 *
 * Example:
 *   MatchedComponent<{ componentFamily: "control"; template: "for-each" }>
 *     === ForEachComponent
 *
 *   MatchedComponent<{ componentFamily: "response" }>
 *     === ResponseComponent  (the full union of response variants)
 */
export type MatchedComponent<P extends ComponentPattern> = Extract<
  ScreenComponent,
  P
>;

/**
 * The recursion function passed to every `visit` callback. Call it with
 * children (or any subtree) and the context those children should see.
 *
 * Examples inside a `visit` handler:
 *   walk(childrenOf(component), context);          // standard descent
 *   walk([component.props.component], newCtx);     // for-each, custom ctx
 *   // skip recursion entirely by simply not calling walk
 */
export type Walk = (components: ScreenComponent[], context: Context) => void;

export interface VisitorEntry<P extends ComponentPattern> {
  pattern: P;
  visit: (component: MatchedComponent<P>, context: Context, walk: Walk) => void;
}

/**
 * Helper to author a visitor entry with full inference of P.
 *
 * Without this, you'd write:
 *   { pattern: { componentFamily: "control", template: "for-each" } as const,
 *     visit: (c: ForEachComponent, ctx) => { ... } }
 *
 * With it:
 *   on({ componentFamily: "control", template: "for-each" },
 *      (c, ctx, walk) => { ... })   // c is inferred as ForEachComponent
 */
export function on<const P extends ComponentPattern>(
  pattern: P,
  visit: (component: MatchedComponent<P>, context: Context, walk: Walk) => void,
): VisitorEntry<P> {
  return { pattern, visit };
}

export type Visitor = ReadonlyArray<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  VisitorEntry<any>
>;

/* -------------------------------------------------------------------------- */
/*  Runtime matching                                                          */
/* -------------------------------------------------------------------------- */

function matches(
  component: ScreenComponent,
  pattern: ComponentPattern,
): boolean {
  const keys = Object.keys(pattern) as Array<keyof ComponentPattern>;
  return keys.every((key) => component[key] === pattern[key]);
}

/**
 * Yield the direct children of a component, in document order. Useful
 * inside a `visit` handler when you want the default recursion behaviour:
 *   walk(childrenOf(component), context)
 *
 * Knowing the union exhaustively means this is hand-rolled, and the
 * compiler will complain if a new variant with children is added.
 */
export function childrenOf(component: ScreenComponent): ScreenComponent[] {
  switch (component.componentFamily) {
    case 'layout':
      switch (component.template) {
        case 'group':
          return component.props.components;
        case 'button':
          return [];
      }
      return [];

    case 'control':
      switch (component.template) {
        case 'conditional': {
          const out: ScreenComponent[] = [component.props.component];
          if (component.props.else) out.push(component.props.else);
          return out;
        }
        case 'for-each':
          return [component.props.component];
      }
      return [];

    case 'content':
    case 'response':
      return [];
  }
}

export function walk(
  components: ScreenComponent[],
  context: Context,
  visitor: Visitor,
): void {
  // The Walk function handed to visitors. Closing over `visitor` here means
  // handlers don't have to pass it around — they only choose what to walk
  // and what context to walk it with.
  const recurse: Walk = (next, nextContext) => {
    walk(next, nextContext, visitor);
  };

  for (const component of components) {
    const entry = visitor.find((e) => matches(component, e.pattern));
    if (!entry) continue;

    // Sound by construction: `matches` guaranteed the component satisfies
    // the entry's pattern, so it's an inhabitant of MatchedComponent<P>.
    // P has been erased at the Visitor array boundary, hence `as never`.
    entry.visit(component as never, context, recurse);
  }
}
