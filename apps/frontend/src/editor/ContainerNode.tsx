'use client';
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import type { LoopNode, PathNode } from '@experiment-hub/engine/nodes';
import { Layers, Repeat } from 'lucide-react';
import { HANDLE_IN, HANDLE_NEXT, type ContainerNodeData } from './adapter';
import { Row, handleClass } from './FlowNode';
import { useViewOptions } from './view-options';

export const CONTAINER_ACCENTS = {
  path: '#14b8a6',
  loop: '#ec4899',
} as const;

function ContainerCard({ node, kind }: { node: PathNode | LoopNode; kind: 'path' | 'loop' }) {
  const view = useViewOptions();
  const accent = CONTAINER_ACCENTS[kind];
  const Icon = kind === 'loop' ? Repeat : Layers;

  return (
    <div className="bg-background-surface border-border-default relative w-60 shrink-0 rounded-xl border shadow-sm shadow-black/5">
      {/* Edges attach to the card, not the frame — matches flow semantics
          (the container node is what enters/exits the step sequence). */}
      <Handle
        id={HANDLE_IN}
        type="target"
        position={Position.Left}
        className={handleClass}
      />
      <Handle
        id={HANDLE_NEXT}
        type="source"
        position={Position.Right}
        className={handleClass}
      />

      <div className="border-border-default flex items-center gap-2 border-b px-3 py-2">
        <span
          className="flex size-5 shrink-0 items-center justify-center rounded-md"
          style={{ backgroundColor: `${accent}1a`, color: accent }}
        >
          <Icon size={12} strokeWidth={2} />
        </span>
        <span className="text-content-primary min-w-0 wrap-anywhere text-xs font-semibold">
          {'name' in node.props ? node.props.name : node.id}
        </span>
        <span className="text-content-secondary ml-auto shrink-0 text-xxs">
          {kind}
        </span>
      </div>

      <div className="py-1">
        {node.type === 'loop' && (
          <Row label="items">
            {node.props.type === 'static'
              ? `${node.props.values.length} static`
              : node.props.dataKey}
          </Row>
        )}
        {view.details && (
          <>
            {node.type === 'loop' && node.props.itemKey && (
              <Row label="item key">{node.props.itemKey}</Row>
            )}
            {node.props.randomized && <Row label="order">randomized</Row>}
            {node.props.stepper && (
              <Row label="stepper">{node.props.stepper.style}</Row>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/**
 * A `path`/`loop` renders as a regular card on top with a tinted frame below
 * holding its member nodes (parentId children). Membership is spatial —
 * containment edges never render.
 */
export default function ContainerNode({
  data,
}: NodeProps<Node<ContainerNodeData>>) {
  const accent = CONTAINER_ACCENTS[data.kind];

  return (
    <div className="relative flex h-full w-full flex-col">
      <ContainerCard node={data.node} kind={data.kind} />
      <div
        className="relative mt-2 min-h-0 flex-1 rounded-2xl border-2 border-dashed"
        style={{ borderColor: `${accent}55`, backgroundColor: `${accent}0a` }}
      >
        <span
          className="bg-background-surface absolute -top-2.5 left-3 rounded-full border px-1.5 font-mono text-xxs"
          style={{ borderColor: `${accent}66`, color: accent }}
        >
          {data.kind === 'loop' ? 'each' : 'steps'}
        </span>
      </div>
    </div>
  );
}
