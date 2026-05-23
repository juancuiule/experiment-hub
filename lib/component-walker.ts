import { ScreenComponent } from './components';

export type ComponentPattern = Partial<
  Pick<ScreenComponent, 'componentFamily' | 'template'>
>;

export type MatchedComponent<P extends ComponentPattern> = Extract<
  ScreenComponent,
  P
>;

export function matches(
  component: ScreenComponent,
  pattern: ComponentPattern,
): boolean {
  const keys = Object.keys(pattern) as Array<keyof ComponentPattern>;
  return keys.every((key) => pattern[key] === component[key]);
}

/**
 * Tree-shaped flatMap over screen components.
 *
 * The shape:
 *   flatMap : (components, state) → handlers → results
 *
 * Each handler matches a component shape and produces results, optionally
 * recursing on a subtree with new state. Application context (your `Context`
 * type, request data, anything stable across the traversal) is captured by
 * handler closures, not passed through the API.
 *
 * Naming: this is the list monad's bind, lifted over a tree. Calling it
 * `flatMap` matches what JS programmers expect — each input maps to an
 * array of outputs, and the arrays are concatenated. The "tree-shaped"
 * part means a handler can recurse to flatMap a subtree before emitting.
 *
 * The `State` parameter is per-traversal context — things that change as
 * you descend (enclosing condition, path, depth). For traversals that
 * don't need this, use `flatMap<R, void>` or just pass `undefined`.
 */
export type Recur<R, State> = (
  components: ScreenComponent[],
  state: State,
) => R[];

export interface Handler<P extends ComponentPattern, R, State> {
  pattern: P;
  apply: (
    component: MatchedComponent<P>,
    state: State,
    recur: Recur<R, State>,
  ) => R[];
}

export function on<const P extends ComponentPattern, R, State>(
  pattern: P,
  apply: (
    component: MatchedComponent<P>,
    state: State,
    recur: Recur<R, State>,
  ) => R[],
): Handler<P, R, State> {
  return { pattern, apply };
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Handlers<R, State> = ReadonlyArray<Handler<any, R, State>>;

export function flatMap<R, State>(
  components: ScreenComponent[],
  state: State,
  handlers: Handlers<R, State>,
): R[] {
  const recur: Recur<R, State> = (next, nextState) =>
    flatMap(next, nextState, handlers);

  return components.reduce<R[]>((results, component) => {
    // Find the first handler that matches this component. If none match, skip it.
    const handler = handlers.find((h) => matches(component, h.pattern));
    if (!handler) return results;

    // Apply the handler, which may recurse with `recur`. Concatenate the results.
    const handlerResults = handler.apply(component as never, state, recur);
    return results.concat(handlerResults);
  }, []);
}
