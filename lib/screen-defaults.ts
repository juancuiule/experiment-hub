import { childrenOf, on, Visitor, walk } from './component-walker';
import { ScreenComponent } from './components';
import { ResponseComponent } from './components/response';
import { evaluateCondition, resolveCondition } from './conditions';
import { deepMerge, mergeContext } from './flow';
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

export function buildDefaultValues(
  components: ScreenComponent[],
  context: Context,
): Record<string, unknown> {
  // Accumulator closed over by the visitor entries. A fresh one per call —
  // that's why the visitor is built inside this function.
  const defaults: Record<string, unknown> = {};

  const visitor: Visitor = [
    // Groups: transparently descend into their children with the same context.
    on({ componentFamily: 'layout', template: 'group' }, (c, ctx, walk) => {
      walk(c.props.components, ctx);
    }),

    // Conditional: evaluate `if` against the current context and recurse
    // only into the chosen branch. At build time the result may flip later
    // when user input lands, but defaults are best-effort for the branch
    // currently taken.
    on(
      { componentFamily: 'control', template: 'conditional' },
      (c, ctx, walk) => {
        const condition = resolveCondition(c.props.if, ctx);
        const branch = evaluateCondition(condition, ctx)
          ? c.props.component
          : c.props.else;
        if (branch) walk([branch], ctx);
      },
    ),

    // For-each: resolve iter values, then for each iteration build a context
    // with the loop variable bound and (for response children only) rewrite
    // the inner component's dataKey with the resolved string.
    on({ componentFamily: 'control', template: 'for-each' }, (c, ctx, walk) => {
      // Get iterValues from the component props if it's static, or resolve them
      // from the context if it's dynamic.
      // If the dynamic value is null or not an array (may happen if not
      // resolvable at this point), default to an empty array.
      const iterValues =
        c.props.type === 'static'
          ? c.props.values
          : ((getValue(c.props.dataKey, ctx) as string[] | null) ?? []);
      const inner = c.props.component;

      iterValues.forEach((value, index) => {
        const iterCtx = mergeContext(ctx, {
          screenData: {
            foreachData: { [c.props.id]: { index, value } },
          },
        });

        // The original rewrites the inner component if it's a response so
        // that `dataKey` gets resolved against the iteration context.
        // Non-response children pass through unchanged.
        const rewritten: ScreenComponent =
          inner.componentFamily === 'response'
            ? deepMerge(inner, {
                props: {
                  dataKey: resolveValuesInString(inner.props.dataKey, iterCtx),
                },
              })
            : inner;

        walk([rewritten], iterCtx);
      });
    }),

    // Response leaves: contribute one entry to the accumulator. The walker
    // doesn't recurse further (responses have no children).
    on({ componentFamily: 'response' }, (c) => {
      defaults[c.props.dataKey] = defaultPerTemplate(c);
    }),

    // Catch-all: descend into anything else we don't care about. With
    // first-match semantics this only fires for components no earlier entry
    // matched — content, buttons, etc. — none of which have children, so it's
    // effectively a no-op today. Kept for safety as the union grows.
    on({}, (c, ctx, walk) => {
      walk(childrenOf(c), ctx);
    }),
  ];

  walk(components, context, visitor);

  return defaults;
}
