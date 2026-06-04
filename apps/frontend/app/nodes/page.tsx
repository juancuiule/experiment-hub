import { EXPERIMENTS } from '@/src/data/experiments';
import { FrameworkEdge } from '@experiment-hub/engine/edges';
import { collectFields } from '@experiment-hub/engine/fields';
import { FrameworkNode } from '@experiment-hub/engine/nodes';
import { FrameworkScreen } from '@experiment-hub/engine/screen';
import { twMerge } from 'tailwind-merge';

function edgeId(edge: FrameworkEdge) {
  return `${edge.from}->${edge.to}`;
}

const EDGE_COLOR: Record<FrameworkEdge['type'], string> = {
  sequential: 'bg-amber-400 text-amber-400',
  'branch-condition': 'bg-blue-400 text-blue-400',
  'branch-default': 'bg-blue-400 text-blue-400',
  'fork-edge': 'bg-green-400 text-green-400',
  'loop-template': 'bg-purple-400 text-purple-400',
  'path-contains': 'bg-pink-400 text-pink-400',
};

function NodeCard({
  node,
  edges,
  screen,
}: {
  node: FrameworkNode;
  edges: FrameworkEdge[];
  screen?: FrameworkScreen;
}) {
  const fields = screen
    ? collectFields(screen.components, {}).map((_) =>
        _.kind === 'static' ? _.key : _.keyTemplate,
      )
    : [];

  return (
    <div className="border-border-default w-fit max-w-60 min-w-32 rounded border font-mono">
      <div className="border-border-default w-full border-b p-2 text-center text-sm">
        {node.type}
      </div>
      <div className="relative flex min-h-48 flex-col p-2">
        <div className="absolute top-1/2 -right-1 flex -translate-y-1/2 flex-col gap-4">
          {edges.map((edge) => {
            return (
              <div
                key={edgeId(edge)}
                className={twMerge(
                  'relative size-2 rounded-full',
                  EDGE_COLOR[edge.type],
                )}
              >
                <span className="absolute left-3 w-fit -translate-y-1/3 text-xs text-nowrap">
                  {edge.type}
                </span>
              </div>
            );
          })}
          {fields.map((fieldKey) => {
            return (
              <div
                key={fieldKey}
                className={twMerge(
                  'bg-content-primary relative size-2 rounded-full',
                )}
              >
                <span className="absolute left-3 w-fit -translate-y-1/3 text-xs text-nowrap">
                  {fieldKey}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function NodesPage() {
  const { nodes, edges, screens = [] } = EXPERIMENTS['experiment'];

  return (
    <div className="flex flex-col gap-4">
      {nodes.map((node) => (
        <NodeCard
          key={node.id}
          node={node}
          edges={edges.filter((e) => e.from.includes(node.id))}
          screen={
            node.type === 'screen'
              ? screens.find((s) => s.slug === node.props.slug)
              : undefined
          }
        />
      ))}
    </div>
  );
}
