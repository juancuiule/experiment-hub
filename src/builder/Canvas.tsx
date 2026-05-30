'use client';

import { FrameworkEdge } from '@/lib/edges';
import { useMemo } from 'react';
import {
  computeLayout,
  NODE_H,
  NODE_W,
  PositionedNode,
} from './layout';
import { NodeCard } from './NodeCard';
import { FrameworkNode } from '@/lib/nodes';

interface EdgeStyle {
  stroke: string;
  dashed?: boolean;
}

const EDGE_STYLES: Record<FrameworkEdge['type'], EdgeStyle> = {
  sequential: { stroke: '#9ca3af' },
  'branch-condition': { stroke: '#f59e0b' },
  'branch-default': { stroke: '#f59e0b', dashed: true },
  'fork-edge': { stroke: '#8b5cf6' },
  'loop-template': { stroke: '#06b6d4', dashed: true },
  'path-contains': { stroke: '#6366f1', dashed: true },
};

function anchor(p: PositionedNode) {
  return {
    cx: p.x + NODE_W / 2,
    top: p.y,
    bottom: p.y + NODE_H,
  };
}

export function Canvas({
  nodes,
  edges,
  selectedId,
  onSelect,
}: {
  nodes: FrameworkNode[];
  edges: FrameworkEdge[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const layout = useMemo(() => computeLayout(nodes, edges), [nodes, edges]);
  const byId = useMemo(
    () => new Map(layout.nodes.map((n) => [n.node.id, n] as const)),
    [layout.nodes],
  );

  return (
    <div
      className="relative h-full w-full overflow-auto bg-background"
      onClick={() => onSelect(null)}
      style={{
        backgroundImage:
          'radial-gradient(circle, var(--border-default) 1px, transparent 1px)',
        backgroundSize: '20px 20px',
      }}
    >
      <div
        className="relative"
        style={{
          width: Math.max(layout.width, 320),
          height: Math.max(layout.height, 240),
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <svg
          className="pointer-events-none absolute inset-0"
          width={layout.width}
          height={layout.height}
        >
          <defs>
            {Object.entries(EDGE_STYLES).map(([type, style]) => (
              <marker
                key={type}
                id={`arrow-${type}`}
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" fill={style.stroke} />
              </marker>
            ))}
          </defs>
          {layout.edges.map((pe, i) => {
            const from = byId.get(pe.fromId);
            const to = byId.get(pe.toId);
            if (!from || !to) return null;
            const a = anchor(from);
            const b = anchor(to);
            const downward = b.top >= a.bottom;
            const x1 = a.cx;
            const y1 = downward ? a.bottom : a.top;
            const x2 = b.cx;
            const y2 = downward ? b.top : b.bottom;
            const my = (y1 + y2) / 2;
            const style = EDGE_STYLES[pe.edge.type];
            const midX = (x1 + x2) / 2;
            return (
              <g key={i}>
                <path
                  d={`M ${x1} ${y1} C ${x1} ${my}, ${x2} ${my}, ${x2} ${y2}`}
                  fill="none"
                  stroke={style.stroke}
                  strokeWidth={1.5}
                  strokeDasharray={style.dashed ? '5 4' : undefined}
                  markerEnd={`url(#arrow-${pe.edge.type})`}
                />
                {pe.subId ? (
                  <text
                    x={midX}
                    y={my - 3}
                    textAnchor="middle"
                    className="fill-content-secondary"
                    fontSize={9}
                  >
                    {pe.subId}
                  </text>
                ) : null}
              </g>
            );
          })}
        </svg>
        {layout.nodes.map((p) => (
          <NodeCard
            key={p.node.id}
            positioned={p}
            selected={p.node.id === selectedId}
            onSelect={onSelect}
          />
        ))}
      </div>
    </div>
  );
}
