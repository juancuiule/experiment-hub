import { flatMap, Handlers, on } from '../component-walker';
import { hasRandomizedOptions, Option } from '../components/response';
import {
  getValue,
  resolveOptionsSource,
  resolveValuesInString,
} from '../resolve';
import { Context, ExperimentFlow } from '../types';
import { shuffle, shuffleAnchored } from '../utils';
import { mergeContext } from './context';

// A single screen walk emits two kinds of shuffle results: randomized response
// options (keyed by resolved dataKey) and randomized for-each presentation
// orders (keyed by for-each id). They share one traversal so nested cases
// (e.g. a randomized for-each containing randomized options) are handled in one
// pass.
type ShuffleEntry =
  | { kind: 'option'; key: string; options: Option[] }
  | { kind: 'foreach'; id: string; values: string[] };

type ShuffleState = {
  inLoop: boolean;
  previousOptions: Record<string, Option[]>;
  previousForeach: Record<string, string[]>;
  sharedOptions: Record<string, Option[]>;
  context: Context;
};

const handlers: Handlers<ShuffleEntry, ShuffleState> = [
  on(
    { componentFamily: 'response' },
    (c, { inLoop, previousOptions, context, sharedOptions }): ShuffleEntry[] => {
      if (!hasRandomizedOptions(c)) return [];
      const key = resolveValuesInString(c.props.dataKey, context);
      const options =
        inLoop && !c.props.reshuffleInLoop && previousOptions[key]
          ? previousOptions[key]
          : shuffleAnchored(
              resolveOptionsSource(c.props.options, context, sharedOptions),
            );
      return [{ kind: 'option', key, options }];
    },
  ),

  on(
    { componentFamily: 'control', template: 'for-each' },
    (c, state, recur): ShuffleEntry[] => {
      const values =
        c.props.type === 'static'
          ? c.props.values
          : ((getValue(c.props.dataKey, state.context) as string[] | null) ??
            []);

      // Emit the randomized presentation order for this for-each. The same
      // inLoop / reshuffleInLoop stability guard used for options keeps the
      // order constant across loop iterations by default.
      const selfEntries: ShuffleEntry[] = c.props.randomized
        ? [
            {
              kind: 'foreach',
              id: c.props.id,
              values:
                state.inLoop &&
                !c.props.reshuffleInLoop &&
                state.previousForeach[c.props.id]
                  ? state.previousForeach[c.props.id]
                  : shuffle(values),
            },
          ]
        : [];

      // Iteration order here does not affect which nested option shuffles are
      // produced (they are keyed by resolved dataKey), so we walk the source
      // order to keep this independent of the presentation shuffle above.
      const innerEntries = values.flatMap((value, index) =>
        recur([c.props.component], {
          ...state,
          context: mergeContext(state.context, {
            screenData: {
              foreachData: { [c.props.id]: { index, value } },
            },
          }),
        }),
      );

      return [...selfEntries, ...innerEntries];
    },
  ),

  on(
    { componentFamily: 'control', template: 'conditional' },
    (c, state, recur): ShuffleEntry[] => {
      const thenEntries = recur([c.props.component], state);
      const elseEntries = c.props.else ? recur([c.props.else], state) : [];
      return [...thenEntries, ...elseEntries];
    },
  ),

  on(
    { componentFamily: 'layout', template: 'group' },
    (c, state, recur): ShuffleEntry[] => recur(c.props.components, state),
  ),
];

export function computeScreenShuffles(
  experiment: ExperimentFlow,
  context: Context,
  slug: string,
): {
  shuffledOptions: Record<string, Option[]>;
  shuffledForeachOrders: Record<string, string[]>;
} {
  const empty = { shuffledOptions: {}, shuffledForeachOrders: {} };
  const screen = experiment.screens?.find((s) => s.slug === slug);
  if (!screen) return empty;

  const inLoop = Object.keys(context.loopData ?? {}).length > 0;
  const previousOptions = context.screenData?.shuffledOptions ?? {};
  const previousForeach = context.screenData?.shuffledForeachOrders ?? {};
  const sharedOptions = experiment.options ?? {};

  const entries = flatMap(
    screen.components,
    { inLoop, previousOptions, previousForeach, sharedOptions, context },
    handlers,
  );

  const shuffledOptions: Record<string, Option[]> = {};
  const shuffledForeachOrders: Record<string, string[]> = {};
  for (const entry of entries) {
    if (entry.kind === 'option') shuffledOptions[entry.key] = entry.options;
    else shuffledForeachOrders[entry.id] = entry.values;
  }

  return { shuffledOptions, shuffledForeachOrders };
}
