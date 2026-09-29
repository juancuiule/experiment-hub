'use client';
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { Layers, Repeat } from 'lucide-react';
import {
  CONTAINER_COLORS,
  HANDLE_IN,
  HANDLE_NEXT,
  type ContainerNodeData,
} from './adapter';

const handleClass =
  '!size-2.5 !rounded-full !border-2 !border-content-secondary !bg-background-surface';

/**
 * Frame node for `path`/`loop` — children render inside via parentId.
 * Membership is spatial, so containment edges never render.
 */
export default function ContainerNode({
  data,
}: NodeProps<Node<ContainerNodeData>>) {
  const accent = CONTAINER_COLORS[data.kind];
  const node = data.node;
  const Icon = data.kind === 'loop' ? Repeat : Layers;

  const chips: string[] = [];
  if (node.type === 'loop') {
    chips.push(
      node.props.type === 'static'
        ? `${node.props.values.length} items`
        : node.props.dataKey,
    );
    if (node.props.itemKey) chips.push(`key: ${node.props.itemKey}`);
  }
  if (node.props.randomized) chips.push('randomized');
  if (node.props.stepper) chips.push(`stepper: ${node.props.stepper.style}`);

  return (
    <div
      className="h-full w-full rounded-2xl border-2 border-dashed"
      style={{
        borderColor: `${accent}55`,
        backgroundColor: `${accent}0a`,
      }}
    >
      <Handle
        id={HANDLE_IN}
        type="target"
        position={Position.Left}
        className={handleClass}
      />

      <div className="flex items-center gap-2 px-3 pt-3">
        <span
          className="bg-background-surface flex size-6 items-center justify-center rounded-md"
          style={{ color: accent }}
        >
          <Icon size={13} strokeWidth={2} />
        </span>
        <span className="text-content-primary text-xs font-semibold">
          {'name' in node.props ? node.props.name : node.id}
        </span>
        <span
          className="rounded-full px-1.5 py-px text-xxs font-medium"
          style={{ backgroundColor: `${accent}22`, color: accent }}
        >
          {data.kind}
        </span>
        {chips.map((c) => (
          <span
            key={c}
            className="text-content-secondary bg-background-surface rounded-full px-1.5 py-px font-mono text-xxs"
          >
            {c}
          </span>
        ))}
      </div>

      <Handle
        id={HANDLE_NEXT}
        type="source"
        position={Position.Right}
        className={handleClass}
      />
    </div>
  );
}
