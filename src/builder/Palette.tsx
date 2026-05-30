'use client';

import { NodeType } from '@/lib/nodes';
import { twMerge } from 'tailwind-merge';
import { NODE_META, PALETTE_ORDER } from './node-meta';

export function Palette({
  onAdd,
  hasSelection,
}: {
  onAdd: (type: NodeType) => void;
  hasSelection: boolean;
}) {
  return (
    <aside className="flex w-52 shrink-0 flex-col gap-3 border-r border-border-default bg-background-surface p-3">
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-content-secondary">
          Add node
        </h2>
        <p className="text-xxs mt-1 text-content-secondary/70">
          {hasSelection
            ? 'Connects from the selected node.'
            : 'Select a node first to auto-connect.'}
        </p>
      </div>
      <div className="flex flex-col gap-1.5">
        {PALETTE_ORDER.map((type) => {
          const meta = NODE_META[type];
          const Icon = meta.icon;
          return (
            <button
              key={type}
              type="button"
              onClick={() => onAdd(type)}
              title={meta.description}
              className={twMerge(
                'group flex items-center gap-2.5 rounded-md border border-border-default bg-background px-2.5 py-2 text-left transition',
                'hover:border-content-active hover:shadow-sm',
              )}
            >
              <span
                className={twMerge(
                  'flex size-7 items-center justify-center rounded-md',
                  meta.accent,
                )}
              >
                <Icon className="size-4" />
              </span>
              <span className="flex flex-col">
                <span className="text-sm font-medium text-content-primary">
                  {meta.label}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
