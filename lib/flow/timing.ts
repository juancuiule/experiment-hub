import { ContextData, FlowStep, State } from '../types';
import { mergeContext } from './context';
import { traverse } from './traverse';

// Builds a timing key from a FlowStep for tracking screen response times.
// Returns null for non-screen states, otherwise returns the slug or dataPath/slug.
// Walks in-path / in-loop state wrappers to derive the full nesting key so that
// the returned key matches context.data's nested structure (e.g. "path-a/q1").
export function buildTimingKey(step: FlowStep): string | null {
  const segments: string[] = [...(step.dataPath ?? [])];

  function walkState(state: State): State {
    if (state.type === 'in-path') {
      segments.push(state.node.id);
      return walkState(state.innerState);
    }
    if (state.type === 'in-loop') {
      segments.push(state.node.id, state.values[state.index]);
      return walkState(state.innerState);
    }
    return state;
  }

  const leaf = walkState(step.state);
  if (leaf.type !== 'in-node') return null;
  if (leaf.node.type !== 'screen') return null;
  segments.push(leaf.node.props.slug);
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
