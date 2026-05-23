import { ScreenComponent } from './components';
import { hasRandomizedOptions, ResponseComponent } from './components/response';
import { Condition, resolveCondition } from './conditions';
import { flatMap, Handlers, on } from './component-walker';
import { mergeContext } from './flow';
import { resolveValuesInString } from './resolve';
import { Context } from './types';

export type ForEachMeta = {
  id: string;
  dataKey: `$$${string}` | `$${string}`;
};

/**
 * A field whose key and gate are fully resolved at collection time.
 * Consumers use `key` directly and call `evaluateCondition(gate, …)` —
 * no resolution step needed.
 */
export type StaticField = {
  kind: 'static';
  key: string;
  gate: Condition | null;
  /** The component this field collects, OR the marker "order" if this is
   *  the :order companion of a randomized response. */
  source: ResponseComponent | { kind: 'order'; ref: ResponseComponent };
};

/**
 * A field that templates over a chain of runtime for-each loops.
 * Consumers walk `loops` to materialize iterations, then call
 * `resolveValuesInString(keyTemplate, …)` and (if gate is set)
 * `resolveCondition(gate, …)` per iteration.
 */
export type DynamicField = {
  kind: 'dynamic';
  keyTemplate: string;
  gate: Condition | null;
  loops: [ForEachMeta, ...ForEachMeta[]];
  source: ResponseComponent | { kind: 'order'; ref: ResponseComponent };
};

export type Field = StaticField | DynamicField;

// Helpers that operate on `source` — most consumers don't care about
// the response/order distinction except to pick a schema.
export function isOrderMarker(
  source: Field['source'],
): source is { kind: 'order'; ref: ResponseComponent } {
  return 'kind' in source && source.kind === 'order';
}

// ─── Collection ──────────────────────────────────────────────────────────────
type State = { enclosingGate: Condition | null };

function and(a: Condition | null, b: Condition): Condition {
  return a === null ? b : { type: 'and', conditions: [a, b] };
}

/**
 * Walk a screen and produce the flat list of fields it can yield. A single
 * tree traversal that downstream consumers (defaults, schema, key inspection)
 * iterate flat.
 */
export function collectFields(
  components: ScreenComponent[],
  context: Context,
  initialGate: Condition | null = null,
): Field[] {
  const handlers: Handlers<Field, State> = [
    on({ componentFamily: 'response' }, (c, { enclosingGate }) => {
      const key = resolveValuesInString(c.props.dataKey, context);
      const fields: Field[] = [
        { kind: 'static', key, gate: enclosingGate, source: c },
      ];
      if (hasRandomizedOptions(c)) {
        fields.push({
          kind: 'static',
          key: `${key}:order`,
          gate: enclosingGate,
          source: { kind: 'order', ref: c },
        });
      }
      return fields;
    }),

    on({ componentFamily: 'layout', template: 'group' }, (c, state, recur) =>
      recur(c.props.components, state),
    ),

    on(
      { componentFamily: 'control', template: 'conditional' },
      (c, state, recur) => {
        const thenFields = recur([c.props.component], {
          enclosingGate: and(state.enclosingGate, c.props.if),
        });
        const elseFields = c.props.else
          ? recur([c.props.else], {
              enclosingGate: and(state.enclosingGate, {
                type: 'not',
                condition: c.props.if,
              }),
            })
          : [];
        return [...thenFields, ...elseFields];
      },
    ),

    on(
      { componentFamily: 'control', template: 'for-each' },
      (c, state, recur) => {
        const inner = recur([c.props.component], state);

        if (c.props.type === 'static') {
          // Static for-each: unroll. Each iteration produces a copy of `inner`
          // with the iteration's `foreachData` baked into the resolved key
          // and gate. Output is StaticFields all the way down (no dynamic
          // promotion needed — keys and gates are decidable now).
          return c.props.values.flatMap((value, index) => {
            const subContext = mergeContext(context, {
              screenData: { foreachData: { [c.props.id]: { index, value } } },
            });
            return inner.map((field): Field => {
              // Static-only transform: if any inner field were already
              // dynamic (from a nested dynamic for-each), this path wouldn't
              // be reached for that field. But we *can* hit it for static
              // fields inside this static loop — resolve key and gate
              // against subContext.
              if (field.kind === 'static') {
                return {
                  ...field,
                  key: resolveValuesInString(field.key, subContext),
                  gate:
                    field.gate !== null
                      ? resolveCondition(field.gate, subContext)
                      : null,
                };
              }
              // Inner was dynamic: a nested static-around-dynamic case.
              // We still resolve what we can (the static iteration vars are
              // available now), but the dynamic chain stays.
              return {
                ...field,
                keyTemplate: resolveValuesInString(
                  field.keyTemplate,
                  subContext,
                ),
                gate:
                  field.gate !== null
                    ? resolveCondition(field.gate, subContext)
                    : field.gate,
              };
            });
          });
        }

        // Dynamic for-each: promote each inner field to dynamic, attaching
        // this loop to the chain. Static inner fields become dynamic; already-
        // dynamic inner fields get this loop prepended to their chain.
        const meta: ForEachMeta = { id: c.props.id, dataKey: c.props.dataKey };
        return inner.map((field): Field => {
          if (field.kind === 'static') {
            return {
              kind: 'dynamic',
              keyTemplate: field.key,
              gate: field.gate,
              loops: [meta],
              source: field.source,
            };
          }
          return { ...field, loops: [meta, ...field.loops] };
        });
      },
    ),

    on({ componentFamily: 'content' }, (): Field[] => []),
  ];

  return flatMap(components, { enclosingGate: initialGate }, handlers);
}
