'use client';
import type { ScreenComponent } from '@experiment-hub/engine/components';
import type { ExperimentFlow } from '@experiment-hub/engine/types';
import { useMemo, useState } from 'react';
import ComponentInspector from './ComponentInspector';
import ComponentOutline from './ComponentOutline';
import LiveScreenPreview from './LiveScreenPreview';
import { refSuggestions } from './ref-suggestions';
import {
  countDataKeys,
  getAt,
  insertAt,
  listComponents,
  moveInArray,
  removeAt,
  renameDataKey,
  skeletonComponent,
  updateAt,
  uniqueDataKey,
  type CompPath,
} from './screen-mutations';

const pathKey = (p: CompPath | null) => (p ? JSON.stringify(p) : null);

const TEMPLATES = [
  'rich-text',
  'image',
  'video',
  'audio',
  'accordion',
  'button',
  'group',
  'conditional',
  'for-each',
  'slider',
  'range-slider',
  'numeric-input',
  'single-checkbox',
  'text-input',
  'text-area',
  'date-input',
  'time-input',
  'dropdown',
  'radio',
  'checkboxes',
  'likert-scale',
];

export default function ScreenEditor({
  experiment,
  screenSlug,
  slug,
}: {
  experiment: ExperimentFlow;
  screenSlug: string;
  slug: string;
}) {
  const [draft, setDraft] = useState(experiment);
  const [selectedPath, setSelectedPath] = useState<CompPath | null>(null);
  const [history, setHistory] = useState<{
    past: ExperimentFlow[];
    future: ExperimentFlow[];
  }>({ past: [], future: [] });
  const [publish, setPublish] = useState<
    | { status: 'idle' }
    | { status: 'busy' }
    | { status: 'ok'; msg: string }
    | { status: 'error'; msg: string }
  >({ status: 'idle' });

  const screen = draft.screens?.find((s) => s.slug === screenSlug);
  const components = screen?.components ?? [];
  const refs = useMemo(() => refSuggestions(draft), [draft]);
  const rows = useMemo(() => listComponents(components), [components]);
  const selected = selectedPath ? getAt(components, selectedPath) : undefined;

  const mutate = (next: (f: ExperimentFlow) => ExperimentFlow) => {
    setHistory((h) => ({ past: [...h.past, draft], future: [] }));
    setDraft(next(draft));
  };
  const mutateComponents = (fn: (comps: ScreenComponent[]) => ScreenComponent[]) =>
    mutate((f) => ({
      ...f,
      screens: (f.screens ?? []).map((s) =>
        s.slug === screenSlug ? { ...s, components: fn(s.components) } : s,
      ),
    }));

  const undo = () =>
    setHistory((h) => {
      const prev = h.past.at(-1);
      if (!prev) return h;
      setDraft(prev);
      return { past: h.past.slice(0, -1), future: [draft, ...h.future] };
    });
  const redo = () =>
    setHistory((h) => {
      const nxt = h.future[0];
      if (!nxt) return h;
      setDraft(nxt);
      return { past: [...h.past, draft], future: h.future.slice(1) };
    });

  const addMenu = (arrPath: CompPath) => (
    <select
      className="border-border-default bg-background text-content-secondary cursor-pointer rounded border border-dashed px-1 text-xxs"
      value=""
      onChange={(e) => {
        const t = e.target.value;
        e.target.value = '';
        if (!t) return;
        const isResponse = [
          'slider', 'range-slider', 'numeric-input', 'single-checkbox',
          'text-input', 'text-area', 'date-input', 'time-input',
          'dropdown', 'radio', 'checkboxes', 'likert-scale',
        ].includes(t);
        const dataKey = isResponse
          ? uniqueDataKey(components, t)
          : undefined;
        const comp = skeletonComponent(t, dataKey);
        mutateComponents((comps) =>
          insertAt(comps, arrPath, Number.MAX_SAFE_INTEGER, comp),
        );
        // select the new component at the end of that array
        const hostArr =
          arrPath.length === 0
            ? components
            : ((getAt(components, arrPath.slice(0, -1))?.props as {
                components?: ScreenComponent[];
              })?.components ?? []);
        setSelectedPath([...arrPath, hostArr.length]);
      }}
    >
      <option value="" disabled>
        + add
      </option>
      {TEMPLATES.map((t) => (
        <option key={t} value={t}>
          {t}
        </option>
      ))}
    </select>
  );

  const dirty = draft !== experiment;
  const publishNow = async () => {
    setPublish({ status: 'busy' });
    try {
      const res = await fetch(`/publish/${slug}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(draft),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setPublish({
          status: 'ok',
          msg: `published ${String(data.version ?? '').slice(0, 12)}` +
            (data.warnings?.length ? ` · ${data.warnings.length} warnings` : ''),
        });
      } else {
        setPublish({
          status: 'error',
          msg: data.error ?? JSON.stringify(data).slice(0, 120),
        });
      }
    } catch {
      setPublish({ status: 'error', msg: 'publish request failed' });
    }
  };

  return (
    <div className="border-border-default bg-background flex h-[75vh] w-full overflow-hidden rounded-xl border">
      {/* outline */}
      <div className="border-border-default w-64 shrink-0 overflow-auto border-r p-2">
        <div className="text-content-secondary mb-1 flex items-center justify-between px-1 text-xxs">
          <span>components</span>
          <span>{rows.length}</span>
        </div>
        <ComponentOutline
          components={components}
          selectedKey={pathKey(selectedPath)}
          onSelect={setSelectedPath}
          onRemove={(path) => {
            mutateComponents((c) => removeAt(c, path));
            if (selectedPath && pathKey(selectedPath) === pathKey(path))
              setSelectedPath(null);
          }}
          onMove={(arrPath, from, to) =>
            mutateComponents((c) => moveInArray(c, arrPath, from, to))
          }
          addMenu={addMenu}
        />
      </div>
      {/* live preview */}
      <div className="bg-surface-subtle min-w-0 flex-1 overflow-auto p-4">
        <div className="mx-auto max-w-lg">
          {screen ? (
            <LiveScreenPreview flow={draft} screen={screen} />
          ) : (
            <span className="text-content-secondary text-xs">
              screen not found
            </span>
          )}
        </div>
      </div>
      {/* inspector */}
      <div className="border-border-default flex w-72 shrink-0 flex-col gap-2 overflow-auto border-l p-2">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={undo}
            disabled={!history.past.length}
            className="border-border-default text-content-secondary hover:text-content-primary cursor-pointer rounded border px-1.5 text-xxs disabled:opacity-30"
          >
            ← undo
          </button>
          <button
            type="button"
            onClick={redo}
            disabled={!history.future.length}
            className="border-border-default text-content-secondary hover:text-content-primary cursor-pointer rounded border px-1.5 text-xxs disabled:opacity-30"
          >
            redo →
          </button>
          <button
            type="button"
            onClick={publishNow}
            disabled={publish.status === 'busy'}
            className="bg-accent text-accent-foreground ml-auto cursor-pointer rounded px-2 py-0.5 text-xxs font-medium disabled:opacity-50"
          >
            {publish.status === 'busy' ? '…' : `Publish${dirty ? ' ●' : ''}`}
          </button>
        </div>
        {publish.status !== 'idle' && publish.status !== 'busy' && (
          <span
            className={`text-xxs ${publish.status === 'ok' ? 'text-green-600' : 'text-red-500'}`}
          >
            {publish.msg}
          </span>
        )}
        {selected ? (
          <ComponentInspector
            component={selected}
            refs={refs}
            dataKey={
              typeof (selected.props as Record<string, unknown>).dataKey ===
              'string'
                ? ((selected.props as Record<string, unknown>)
                    .dataKey as string)
                : undefined
            }
            dataKeyDupe={(() => {
              const k = (selected.props as Record<string, unknown>).dataKey;
              return (
                typeof k === 'string' &&
                (countDataKeys(components).get(k) ?? 0) > 1
              );
            })()}
            onPatch={(props) =>
              mutateComponents((c) =>
                updateAt(
                  c,
                  selectedPath!,
                  (comp) => ({ ...comp, props }) as ScreenComponent,
                ),
              )
            }
            onRenameDataKey={(next) =>
              mutate((f) =>
                renameDataKey(
                  f,
                  screenSlug,
                  (selected.props as Record<string, unknown>).dataKey as string,
                  next,
                ),
              )
            }
            onTemplateChange={(t) =>
              mutateComponents((c) =>
                updateAt(c, selectedPath!, () =>
                  skeletonComponent(
                    t,
                    (selected.props as Record<string, unknown>)
                      .dataKey as string | undefined,
                  ),
                ),
              )
            }
          />
        ) : (
          <span className="text-content-secondary px-1 text-xxs">
            select a component to edit its props
          </span>
        )}
      </div>
    </div>
  );
}
