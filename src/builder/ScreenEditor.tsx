'use client';

import { ScreenComponent } from '@/lib/components';
import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { twMerge } from 'tailwind-merge';
import {
  COMPONENT_TEMPLATES,
  ComponentTemplateMeta,
  FAMILY_ACCENT,
  makeComponent,
  QUICK_FIELDS,
} from './component-meta';
import { TextField } from './Field';

function move<T>(arr: T[], from: number, to: number): T[] {
  if (to < 0 || to >= arr.length) return arr;
  const next = [...arr];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

function ComponentRow({
  component,
  index,
  count,
  onChange,
  onMove,
  onRemove,
}: {
  component: ScreenComponent;
  index: number;
  count: number;
  onChange: (c: ScreenComponent) => void;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
}) {
  const props = (component.props ?? {}) as Record<string, unknown>;
  const editable = QUICK_FIELDS.filter((k) => typeof props[k] === 'string');

  return (
    <li className="rounded-md border border-border-default bg-background">
      <div className="flex items-center gap-2 px-2 py-1.5">
        <span
          className={twMerge(
            'rounded px-1.5 py-0.5 text-xxs font-medium',
            FAMILY_ACCENT[component.componentFamily],
          )}
        >
          {component.componentFamily}
        </span>
        <span className="flex-1 truncate font-mono text-xs text-content-primary">
          {component.template}
        </span>
        <button
          type="button"
          onClick={() => onMove(-1)}
          disabled={index === 0}
          className="text-content-secondary disabled:opacity-30"
          aria-label="Move up"
        >
          <ChevronUp className="size-4" />
        </button>
        <button
          type="button"
          onClick={() => onMove(1)}
          disabled={index === count - 1}
          className="text-content-secondary disabled:opacity-30"
          aria-label="Move down"
        >
          <ChevronDown className="size-4" />
        </button>
        <button
          type="button"
          onClick={onRemove}
          className="text-error/80 hover:text-error"
          aria-label="Remove component"
        >
          <Trash2 className="size-4" />
        </button>
      </div>
      {editable.length > 0 ? (
        <div className="flex flex-col gap-2 border-t border-border-default px-2 py-2">
          {editable.map((key) => (
            <TextField
              key={key}
              label={key}
              value={String(props[key] ?? '')}
              mono={key === 'dataKey'}
              onChange={(v) =>
                onChange({
                  ...component,
                  props: { ...props, [key]: v },
                } as ScreenComponent)
              }
            />
          ))}
        </div>
      ) : null}
    </li>
  );
}

export function ScreenEditor({
  slug,
  components,
  onChange,
}: {
  slug: string;
  components: ScreenComponent[];
  onChange: (next: ScreenComponent[]) => void;
}) {
  const [adding, setAdding] = useState(false);

  const add = (meta: ComponentTemplateMeta) => {
    onChange([...components, makeComponent(meta)]);
    setAdding(false);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-content-secondary">
          Screen “{slug}”
        </h3>
        <span className="text-xxs text-content-secondary">
          {components.length} component(s)
        </span>
      </div>

      <ul className="flex flex-col gap-1.5">
        {components.map((component, i) => (
          <ComponentRow
            key={i}
            component={component}
            index={i}
            count={components.length}
            onChange={(c) =>
              onChange(components.map((x, j) => (j === i ? c : x)))
            }
            onMove={(dir) => onChange(move(components, i, i + dir))}
            onRemove={() => onChange(components.filter((_, j) => j !== i))}
          />
        ))}
        {components.length === 0 ? (
          <li className="rounded-md border border-dashed border-border-default px-2 py-3 text-center text-xs text-content-secondary">
            No components yet.
          </li>
        ) : null}
      </ul>

      {adding ? (
        <div className="rounded-md border border-border-default bg-background p-2">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-xxs font-semibold uppercase text-content-secondary">
              Pick a template
            </span>
            <button
              type="button"
              className="text-xxs text-content-active"
              onClick={() => setAdding(false)}
            >
              cancel
            </button>
          </div>
          <div className="grid grid-cols-2 gap-1">
            {COMPONENT_TEMPLATES.map((meta) => (
              <button
                key={meta.family + meta.template}
                type="button"
                onClick={() => add(meta)}
                className="rounded border border-border-default px-1.5 py-1 text-left text-xxs text-content-primary hover:border-content-active"
              >
                {meta.label}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="flex items-center justify-center gap-1.5 rounded-md border border-dashed border-border-default py-1.5 text-xs text-content-secondary hover:border-content-active hover:text-content-active"
        >
          <Plus className="size-3.5" /> Add component
        </button>
      )}
    </div>
  );
}
