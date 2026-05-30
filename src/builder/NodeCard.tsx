'use client';

import { twMerge } from 'tailwind-merge';
import { NODE_H, NODE_W, PositionedNode } from './layout';
import { NODE_META, nodeSubtitle, nodeTitle } from './node-meta';

export function NodeCard({
  positioned,
  selected,
  onSelect,
}: {
  positioned: PositionedNode;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const { node, x, y } = positioned;
  const meta = NODE_META[node.type];
  const Icon = meta.icon;
  const subtitle = nodeSubtitle(node);

  return (
    <button
      type="button"
      onClick={() => onSelect(node.id)}
      style={{ left: x, top: y, width: NODE_W, height: NODE_H }}
      className={twMerge(
        'absolute flex items-stretch overflow-hidden rounded-lg border bg-background-surface text-left shadow-sm transition',
        'hover:shadow-md focus:outline-none',
        selected
          ? 'border-content-active ring-2 ring-ring'
          : 'border-border-default',
      )}
    >
      <span className={twMerge('flex w-9 items-center justify-center', meta.accent)}>
        <Icon className="size-4" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col justify-center px-2.5 py-1">
        <span className="truncate text-sm font-semibold text-content-primary">
          {nodeTitle(node)}
        </span>
        <span className="text-xxs text-content-secondary/80 uppercase tracking-wide">
          {meta.label}
        </span>
        {subtitle ? (
          <span className="truncate text-xxs text-content-secondary">
            {subtitle}
          </span>
        ) : null}
      </span>
    </button>
  );
}
