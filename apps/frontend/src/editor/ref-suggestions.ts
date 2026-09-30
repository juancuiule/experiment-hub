import type { FrameworkNode } from '@experiment-hub/engine/nodes';
import { collectFields } from '@experiment-hub/engine/fields';
import type { ExperimentFlow } from '@experiment-hub/engine/types';

/**
 * Candidate `$$`/`@` refs for condition dataKey inputs, collected from what
 * upstream nodes can produce: screen field keys (path/loop children get their
 * `$$path.slug.field` / `$$loop.iter.slug.field` spellings), compute
 * outputKeys, data keys, and `@loopId` for loops.
 */
export function refSuggestions(flow: ExperimentFlow): string[] {
  const out = new Set<string>();
  const screensBySlug = new Map((flow.screens ?? []).map((s) => [s.slug, s]));
  const parentOf = new Map<string, FrameworkNode>();
  const nodesById = new Map(flow.nodes.map((n) => [n.id, n]));

  for (const e of flow.edges) {
    if (e.type === 'path-contains' || e.type === 'loop-template') {
      const parent = nodesById.get(e.from);
      if (parent) parentOf.set(e.to, parent);
    }
  }

  for (const node of flow.nodes) {
    if (node.type === 'screen') {
      const screen = screensBySlug.get(node.props.slug);
      const keys = screen
        ? collectFields(screen.components, {}).map((f) =>
            f.kind === 'static' ? f.key : f.keyTemplate,
          )
        : [];
      const parent = parentOf.get(node.id);
      for (const key of keys) {
        if (parent?.type === 'path')
          out.add(`$$${parent.id}.${node.props.slug}.${key}`);
        else if (parent?.type === 'loop') {
          const iter =
            parent.props.type === 'dynamic'
              ? (parent.props.itemKey ?? '0')
              : '0';
          out.add(`$$${parent.id}.${iter}.${node.props.slug}.${key}`);
        } else out.add(`$$${node.props.slug}.${key}`);
      }
    }
    if (node.type === 'compute')
      for (const c of node.props.computations) out.add(`$$${node.id}.${c.outputKey}`);
    if (node.type === 'data')
      for (const k of Object.keys(node.props.data)) out.add(`$$${node.id}.${k}`);
    if (node.type === 'loop') out.add(`@${node.id}`);
  }
  return [...out].sort();
}
