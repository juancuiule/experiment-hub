import { ContextData, FlowStep } from '../types';
import { mergeContext } from './context';
import { traverse, walkStatePath } from './traverse';

export function buildTimingKey(step: FlowStep): string | null {
  const { segments: stateSegments, leaf } = walkStatePath(step.state);
  if (leaf.type !== 'in-node') return null;
  if (leaf.node.type !== 'screen') return null;
  const segments = [...(step.dataPath ?? []), ...stateSegments, leaf.node.props.slug];
  return segments.join('/');
}

export async function traverseWithTiming(
  step: FlowStep,
  data?: ContextData,
): Promise<FlowStep> {
  const key = buildTimingKey(step);
  const submittedAt = new Date().toISOString();
  const contextWithSubmit = key
    ? mergeContext(step.context, {
        timings: {
          [key]: {
            ...(step.context.timings?.[key] ?? {}),
            submittedAt,
          },
        },
      })
    : step.context;
  return traverse({ ...step, context: contextWithSubmit }, data);
}

export function recordEnteredAt(step: FlowStep): FlowStep {
  const key = buildTimingKey(step);
  if (!key) return step;
  const enteredAt = new Date().toISOString();
  return {
    ...step,
    context: mergeContext(step.context, {
      timings: {
        [key]: {
          ...(step.context.timings?.[key] ?? {}),
          enteredAt,
        },
      },
    }),
  };
}
