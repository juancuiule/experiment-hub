'use client';
import {
  CheckSquare,
  ChevronDown,
  Image as ImageIcon,
  List,
  ListOrdered,
  ListTree,
  MousePointerClick,
  Music,
  Pilcrow,
  Repeat,
  SlidersHorizontal,
  TextCursorInput,
  Type,
  Video,
} from 'lucide-react';
import type { ScreenComponent } from '@experiment-hub/engine/components';
import {
  countDataKeys,
  getAt,
  listComponents,
  type CompPath,
} from './screen-mutations';

const pathKey = (p: CompPath) => JSON.stringify(p);

const FAMILY_ICON = {
  content: Type,
  layout: List,
  control: ListTree,
  response: TextCursorInput,
} as const;

const TEMPLATE_ICON: Record<string, typeof Type> = {
  'rich-text': Pilcrow,
  image: ImageIcon,
  video: Video,
  audio: Music,
  accordion: ChevronDown,
  button: MousePointerClick,
  group: List,
  conditional: ListTree,
  'for-each': Repeat,
  slider: SlidersHorizontal,
  'single-checkbox': CheckSquare,
  'text-input': TextCursorInput,
  'text-area': TextCursorInput,
  'likert-scale': ListOrdered,
  radio: List,
  dropdown: ChevronDown,
  checkboxes: CheckSquare,
};

/** Best-effort human label for an outline row. */
function labelOf(c: ScreenComponent): string {
  const p = c.props as Record<string, unknown>;
  const v =
    p.label ?? p.text ?? p.title ?? p.name ?? p.content ?? p.dataKey ?? p.url;
  if (typeof v === 'string' && v) return v;
  return c.template;
}

/** Which arrays can host new children: [] = root, or a group's own array. */
function childArrPath(rowPath: CompPath, c: ScreenComponent): CompPath | null {
  if (c.template === 'group') return [...rowPath, 'components'];
  return null;
}

export default function ComponentOutline({
  components,
  selectedKey,
  onSelect,
  onRemove,
  onMove,
  addMenu,
}: {
  components: ScreenComponent[];
  selectedKey: string | null;
  onSelect: (path: CompPath) => void;
  onRemove: (path: CompPath) => void;
  onMove: (arrPath: CompPath, from: number, to: number) => void;
  addMenu: (arrPath: CompPath) => React.ReactNode;
}) {
  const rows = listComponents(components);
  const dupes = new Set(
    [...countDataKeys(components)]
      .filter(([, n]) => n > 1)
      .map(([k]) => k),
  );

  return (
    <div className="flex flex-col gap-px text-xxs">
      {rows.map(({ path, component, inArray, depth }) => {
        const Icon =
          TEMPLATE_ICON[component.template] ?? FAMILY_ICON[component.componentFamily];
        const key = pathKey(path);
        const sel = key === selectedKey;
        const p = component.props as Record<string, unknown>;
        const dataKey = typeof p.dataKey === 'string' ? p.dataKey : undefined;
        const arrPath = inArray ? path.slice(0, -1) : null;
        const idx = inArray ? (path[path.length - 1] as number) : null;
        // sibling count for disabling ↑↓
        const siblingCount = (() => {
          if (!arrPath) return 0;
          if (arrPath.length === 0) return components.length;
          const host = getAt(components, arrPath.slice(0, -1));
          return (
            (host?.props as { components?: unknown[] } | undefined)?.components
              ?.length ?? 0
          );
        })();
        const childArr = childArrPath(path, component);
        return (
          <div
            key={key}
            className={`group flex items-center gap-1 rounded px-1 py-0.5 ${
              sel
                ? 'bg-accent-subtle text-content-primary'
                : 'hover:bg-surface-subtle text-content-secondary'
            }`}
            style={{ paddingLeft: `${4 + depth * 12}px` }}
          >
            <button
              type="button"
              className="flex min-w-0 flex-1 cursor-pointer items-center gap-1.5 text-left"
              onClick={() => onSelect(path)}
            >
              <Icon className="h-3 w-3 shrink-0 opacity-70" />
              <span className="min-w-0 flex-1 truncate">{labelOf(component)}</span>
              <span className="opacity-50">{component.template}</span>
              {dataKey && (
                <span
                  className={`font-mono ${dupes.has(dataKey) ? 'text-red-500' : 'opacity-60'}`}
                  title={dupes.has(dataKey) ? 'duplicate dataKey' : 'dataKey'}
                >
                  {dataKey}
                  {dupes.has(dataKey) ? ' ⚠' : ''}
                </span>
              )}
            </button>
            {inArray && arrPath && (
              <span className="hidden shrink-0 items-center gap-px group-hover:flex">
                <button
                  type="button"
                  aria-label="Move up"
                  disabled={idx === 0}
                  onClick={() => onMove(arrPath, idx!, idx! - 1)}
                  className="cursor-pointer disabled:opacity-30"
                >
                  ↑
                </button>
                <button
                  type="button"
                  aria-label="Move down"
                  disabled={idx === siblingCount - 1}
                  onClick={() => onMove(arrPath, idx!, idx! + 1)}
                  className="cursor-pointer disabled:opacity-30"
                >
                  ↓
                </button>
              </span>
            )}
            {childArr && (
              <span className="hidden shrink-0 group-hover:inline">
                {addMenu(childArr)}
              </span>
            )}
            {(inArray || path[path.length - 1] === 'else') && (
              <button
                type="button"
                aria-label="Remove"
                className="text-content-secondary hover:text-red-500 hidden shrink-0 cursor-pointer group-hover:inline"
                onClick={() => onRemove(path)}
              >
                ×
              </button>
            )}
          </div>
        );
      })}
      <div className="mt-1 px-1">{addMenu([])}</div>
    </div>
  );
}
