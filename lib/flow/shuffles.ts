import { ScreenComponent } from '../components';
import { hasRandomizedOptions, Option } from '../components/response';
import { getValue, resolveOptionsSource, resolveValuesInString } from '../resolve';
import { Context, ExperimentFlow } from '../types';
import { shuffleAnchored } from '../utils';
import { mergeContext } from './context';

function processComponent(
  component: ScreenComponent,
  ctx: Context,
  inLoop: boolean,
  previous: Record<string, Array<Option>>,
): [string, Array<Option>][] {
  switch (component.componentFamily) {
    case 'response': {
      if (!hasRandomizedOptions(component)) return [];
      const key = resolveValuesInString(component.props.dataKey, ctx);
      const options =
        inLoop && !component.props.reshuffleInLoop && previous[key]
          ? previous[key]
          : shuffleAnchored(resolveOptionsSource(component.props.options, ctx));
      return [[key, options]];
    }
    case 'control': {
      if (component.template === 'for-each') {
        const values =
          component.props.type === 'static'
            ? component.props.values
            : ((getValue(component.props.dataKey, ctx) as string[] | null) ??
              []);
        return values.flatMap((value, index) =>
          Object.entries<Array<Option>>(
            processComponents(
              [component.props.component],
              mergeContext(ctx, {
                screenData: {
                  foreachData: { [component.props.id]: { index, value } },
                },
              }),
              inLoop,
              previous,
            ),
          ),
        );
      }
      if (component.template === 'conditional') {
        const thenEntries = Object.entries<Array<Option>>(
          processComponents([component.props.component], ctx, inLoop, previous),
        );
        const elseEntries = component.props.else
          ? Object.entries<Array<Option>>(
              processComponents(
                [component.props.else],
                ctx,
                inLoop,
                previous,
              ),
            )
          : [];
        return [...thenEntries, ...elseEntries];
      }
      return [];
    }
    case 'layout': {
      if (component.template === 'group') {
        return Object.entries<Array<Option>>(
          processComponents(
            component.props.components,
            ctx,
            inLoop,
            previous,
          ),
        );
      }
      return [];
    }
    default:
      return [];
  }
}

function processComponents(
  components: ScreenComponent[],
  ctx: Context,
  inLoop: boolean,
  previous: Record<string, Array<Option>>,
): Record<string, Array<Option>> {
  return Object.fromEntries(
    components.flatMap((c) => processComponent(c, ctx, inLoop, previous)),
  );
}

export function computeShuffledOptions(
  experiment: ExperimentFlow,
  context: Context,
  slug: string,
): Record<string, Array<Option>> {
  const screen = experiment.screens?.find((s) => s.slug === slug);
  if (!screen) return {};

  const inLoop = Object.keys(context.loopData ?? {}).length > 0;
  const previous = context.screenData?.shuffledOptions ?? {};

  return processComponents(screen.components, context, inLoop, previous);
}
