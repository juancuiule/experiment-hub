import { flatMap, Handlers, on } from '../component-walker';
import { hasRandomizedOptions, Option } from '../components/response';
import {
  getValue,
  resolveOptionsSource,
  resolveValuesInString,
} from '../resolve';
import { Context, ExperimentFlow } from '../types';
import { shuffleAnchored } from '../utils';
import { mergeContext } from './context';

type ShuffleState = {
  inLoop: boolean;
  previous: Record<string, Option[]>;
  sharedOptions: Record<string, Option[]>;
  context: Context;
};

const handlers: Handlers<[string, Option[]], ShuffleState> = [
  on(
    { componentFamily: 'response' },
    (c, { inLoop, previous, context, sharedOptions }) => {
      if (!hasRandomizedOptions(c)) return [];
      const key = resolveValuesInString(c.props.dataKey, context);
      const options =
        inLoop && !c.props.reshuffleInLoop && previous[key]
          ? previous[key]
          : shuffleAnchored(
              resolveOptionsSource(c.props.options, context, sharedOptions),
            );
      return [[key, options]];
    },
  ),

  on(
    { componentFamily: 'control', template: 'for-each' },
    (c, state, recur) => {
      const values =
        c.props.type === 'static'
          ? c.props.values
          : ((getValue(c.props.dataKey, state.context) as string[] | null) ??
            []);
      return values.flatMap((value, index) =>
        recur([c.props.component], {
          ...state,
          context: mergeContext(state.context, {
            screenData: {
              foreachData: { [c.props.id]: { index, value } },
            },
          }),
        }),
      );
    },
  ),

  on(
    { componentFamily: 'control', template: 'conditional' },
    (c, state, recur) => {
      const thenEntries = recur([c.props.component], state);
      const elseEntries = c.props.else ? recur([c.props.else], state) : [];
      return [...thenEntries, ...elseEntries];
    },
  ),

  on({ componentFamily: 'layout', template: 'group' }, (c, state, recur) =>
    recur(c.props.components, state),
  ),
];

export function computeShuffledOptions(
  experiment: ExperimentFlow,
  context: Context,
  slug: string,
): Record<string, Option[]> {
  const screen = experiment.screens?.find((s) => s.slug === slug);
  if (!screen) return {};

  const inLoop = Object.keys(context.loopData ?? {}).length > 0;
  const previous = context.screenData?.shuffledOptions ?? {};
  const sharedOptions = experiment.options ?? {};

  return Object.fromEntries(
    flatMap(
      screen.components,
      { inLoop, previous, sharedOptions, context },
      handlers,
    ),
  );
}
