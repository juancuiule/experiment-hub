'use client';
import type { Condition } from '@experiment-hub/engine/conditions';
import type { ScreenComponent } from '@experiment-hub/engine/components';
import type { Option } from '@experiment-hub/engine/components/response';
import ConditionEditor from './ConditionEditor';
import RefInput from './RefInput';
import { skeletonComponent } from './screen-mutations';

const inputCls =
  'border-border-default bg-background text-content-primary min-w-0 w-full rounded border px-1.5 py-0.5 font-mono text-xxs';
const selectCls =
  'border-border-default bg-background text-content-primary rounded border px-1 py-0.5 text-xxs';

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

type Props = Record<string, unknown>;
type Patch = (patch: Props) => void;

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex items-start gap-1.5 text-xxs">
      <span className="text-content-secondary w-16 shrink-0 pt-0.5">
        {label}
      </span>
      <span className="flex min-w-0 flex-1 items-center gap-1">
        {children}
      </span>
    </label>
  );
}

type Ctx = {
  resolve?: (s: string) => string;
  /** flattened dictionary messages — enables [[key]] autocomplete + hints */
  dict?: Record<string, string>;
};

function Text({
  k,
  p,
  set,
  area,
  ctx,
}: {
  k: string;
  p: Props;
  set: Patch;
  area?: boolean;
  ctx?: Ctx;
}) {
  const v = (p[k] as string) ?? '';
  const resolved = ctx?.resolve?.(v);
  const showHint = resolved !== undefined && resolved !== v;
  const shared = {
    key: v,
    defaultValue: v,
    list: ctx?.dict ? 'dict-keys' : undefined,
    onBlur: (
      e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>,
    ) => set({ [k]: e.target.value }),
  };
  return (
    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
      {area ? (
        <textarea {...shared} rows={3} className={`${inputCls} font-sans`} />
      ) : (
        <input {...shared} className={inputCls} />
      )}
      {showHint && (
        <span
          className="text-content-secondary truncate opacity-60"
          title={resolved}
        >
          → {resolved}
        </span>
      )}
    </span>
  );
}

function Num({ k, p, set }: { k: string; p: Props; set: Patch }) {
  const v = p[k];
  return (
    <input
      key={String(v)}
      type="number"
      defaultValue={typeof v === 'number' ? v : ''}
      className={`${inputCls} w-16`}
      onBlur={(e) =>
        set({ [k]: e.target.value === '' ? undefined : Number(e.target.value) })
      }
    />
  );
}

function Bool({ k, p, set }: { k: string; p: Props; set: Patch }) {
  return (
    <input
      type="checkbox"
      checked={!!p[k]}
      onChange={(e) => set({ [k]: e.target.checked })}
      className="accent-accent"
    />
  );
}

/** Options editor: inline list / %-$$-$-@ ref / {source,labelKey} dict. */
function OptionsEditor({
  p,
  set,
  refs,
  ctx,
}: {
  p: Props;
  set: Patch;
  refs: string[];
  ctx?: Ctx;
}) {
  const options = p.options as unknown;
  const mode = Array.isArray(options)
    ? 'inline'
    : typeof options === 'string'
      ? 'ref'
      : 'dict';
  const switchMode = (m: string) => {
    if (m === mode) return;
    set({
      options:
        m === 'inline'
          ? [{ label: 'A', value: 'a' }]
          : m === 'ref'
            ? '$$'
            : { source: '$$', labelKey: '' },
    });
  };
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1">
        <span className="text-content-secondary w-16 shrink-0">options</span>
        <select
          className={selectCls}
          value={mode}
          onChange={(e) => switchMode(e.target.value)}
        >
          <option value="inline">inline list</option>
          <option value="ref">ref (%/$$/@/$)</option>
          <option value="dict">dictionary source</option>
        </select>
      </div>
      {mode === 'inline' && (
        <div className="flex flex-col gap-0.5 pl-1">
          {(options as Option[]).map((o, i) => (
            <div key={i} className="flex items-center gap-1">
              <input
                key={`l${o.label}`}
                defaultValue={o.label}
                placeholder="label"
                list={ctx?.dict ? 'dict-keys' : undefined}
                title={ctx?.resolve?.(o.label)}
                className={`${inputCls} w-20`}
                onBlur={(e) =>
                  set({
                    options: (options as Option[]).map((x, j) =>
                      j === i ? { ...x, label: e.target.value } : x,
                    ),
                  })
                }
              />
              <input
                key={`v${o.value}`}
                defaultValue={o.value}
                placeholder="value"
                className={`${inputCls} w-20`}
                onBlur={(e) =>
                  set({
                    options: (options as Option[]).map((x, j) =>
                      j === i ? { ...x, value: e.target.value } : x,
                    ),
                  })
                }
              />
              <select
                className={selectCls}
                value={o.anchor ?? ''}
                onChange={(e) =>
                  set({
                    options: (options as Option[]).map((x, j) =>
                      j === i
                        ? {
                            ...x,
                            anchor: (e.target.value || undefined) as
                              | 'first'
                              | 'last'
                              | undefined,
                          }
                        : x,
                    ),
                  })
                }
              >
                <option value="">—</option>
                <option value="first">first</option>
                <option value="last">last</option>
              </select>
              <button
                type="button"
                className="text-content-secondary hover:text-error cursor-pointer"
                aria-label="Remove option"
                onClick={() =>
                  set({
                    options: (options as Option[]).filter((_, j) => j !== i),
                  })
                }
              >
                ×
              </button>
            </div>
          ))}
          <button
            type="button"
            className="border-border-default text-content-secondary hover:text-content-primary w-fit cursor-pointer rounded-md border border-dashed px-1.5 py-px text-xxs"
            onClick={() =>
              set({
                options: [
                  ...(options as Option[]),
                  { label: 'New', value: 'new' },
                ],
              })
            }
          >
            + option
          </button>
        </div>
      )}
      {mode === 'ref' && (
        <div className="flex items-center gap-1 pl-1">
          <RefInput
            value={options as string}
            refs={refs}
            placeholder="$$data.opts or %shared"
            onCommit={(v) => set({ options: v })}
          />
        </div>
      )}
      {mode === 'dict' && (
        <div className="flex items-center gap-1 pl-1">
          <RefInput
            value={(options as { source: string }).source}
            refs={refs}
            placeholder="$$data.values"
            onCommit={(v) =>
              set({ options: { ...(options as object), source: v } })
            }
          />
          <span className="text-content-secondary">labelKey</span>
          <input
            key={(options as { labelKey?: string }).labelKey}
            defaultValue={(options as { labelKey?: string }).labelKey ?? ''}
            list="dict-groups"
            className={`${inputCls} w-24`}
            onBlur={(e) =>
              set({
                options: {
                  ...(options as object),
                  labelKey: e.target.value,
                },
              })
            }
          />
        </div>
      )}
    </div>
  );
}

/** The per-template prop fields. */
function TemplateFields({
  c,
  set,
  refs,
  setProp,
  ctx,
}: {
  c: ScreenComponent;
  set: Patch;
  refs: string[];
  setProp: (key: string, value: unknown) => void;
  ctx?: Ctx;
}) {
  const p = c.props as Props;
  const t = c.template;
  switch (t) {
    case 'rich-text':
      return (
        <Row label="content">
          <Text k="content" p={p} set={set} area ctx={ctx} />
        </Row>
      );
    case 'image':
      return (
        <>
          <Row label="url"><Text k="url" p={p} set={set} ctx={ctx} /></Row>
          <Row label="alt"><Text k="alt" p={p} set={set} ctx={ctx} /></Row>
          <Row label="className"><Text k="className" p={p} set={set} ctx={ctx} /></Row>
        </>
      );
    case 'video':
    case 'audio':
      return (
        <>
          <Row label="url"><Text k="url" p={p} set={set} ctx={ctx} /></Row>
          <Row label="autoplay"><Bool k="autoplay" p={p} set={set} /></Row>
          {t === 'video' && (
            <Row label="muted"><Bool k="muted" p={p} set={set} /></Row>
          )}
          <Row label="loop"><Bool k="loop" p={p} set={set} /></Row>
          <Row label="controls"><Bool k="controls" p={p} set={set} /></Row>
        </>
      );
    case 'accordion':
      return (
        <>
          <Row label="title"><Text k="title" p={p} set={set} ctx={ctx} /></Row>
          <Row label="body"><Text k="body" p={p} set={set} area ctx={ctx} /></Row>
        </>
      );
    case 'button':
      return (
        <>
          <Row label="text"><Text k="text" p={p} set={set} ctx={ctx} /></Row>
          <Row label="disabled"><Bool k="disabled" p={p} set={set} /></Row>
          <Row label="alignBottom"><Bool k="alignBottom" p={p} set={set} /></Row>
          <PayloadEditor p={p} set={set} />
        </>
      );
    case 'group':
      return (
        <Row label="name"><Text k="name" p={p} set={set} ctx={ctx} /></Row>
      );
    case 'conditional':
      return (
        <div className="flex flex-col gap-1">
          <span className="text-content-secondary">if</span>
          <ConditionEditor
            condition={(p.if as Condition) ?? { type: 'simple', dataKey: '$$', operator: 'eq', value: '' }}
            refs={refs}
            onChange={(c2) => set({ if: c2 })}
          />
          <span className="text-content-secondary">
            then/else — edit via the outline rows below this component
          </span>
        </div>
      );
    case 'for-each': {
      const type = p.type as 'static' | 'dynamic';
      return (
        <div className="flex flex-col gap-1">
          <Row label="id"><Text k="id" p={p} set={set} ctx={ctx} /></Row>
          <div className="flex items-center gap-1.5">
            <span className="text-content-secondary w-16 shrink-0">items</span>
            <select
              className={selectCls}
              value={type}
              onChange={(e) =>
                set(
                  e.target.value === 'static'
                    ? { type: 'static', values: [], dataKey: undefined }
                    : { type: 'dynamic', dataKey: '$$', values: undefined },
                )
              }
            >
              <option value="static">static list</option>
              <option value="dynamic">dynamic ref</option>
            </select>
          </div>
          {type === 'static' ? (
            <Row label="values">
              <textarea
                key={JSON.stringify(p.values)}
                defaultValue={JSON.stringify(p.values ?? [], null, 1)}
                rows={3}
                className={inputCls}
                onBlur={(e) => {
                  try {
                    setProp('values', JSON.parse(e.target.value));
                  } catch {
                    /* keep invalid JSON out of props */
                  }
                }}
              />
            </Row>
          ) : (
            <Row label="dataKey">
              <RefInput
                value={(p.dataKey as string) ?? ''}
                refs={refs}
                placeholder="$$data.items or @loop.rest"
                onCommit={(v) => setProp('dataKey', v)}
              />
            </Row>
          )}
          <Row label="randomized"><Bool k="randomized" p={p} set={set} /></Row>
          <Row label="reshuffle"><Bool k="reshuffleInLoop" p={p} set={set} /></Row>
          <span className="text-content-secondary">
            template — edit the component row below this for-each in the outline
          </span>
        </div>
      );
    }
    default: {
      // response family
      const isChoices = ['radio', 'dropdown', 'checkboxes', 'likert-scale'].includes(t);
      const isSlider = t === 'slider' || t === 'range-slider';
      return (
        <div className="flex flex-col gap-1">
          <Row label="label"><Text k="label" p={p} set={set} ctx={ctx} /></Row>
          {isChoices && <OptionsEditor p={p} set={set} refs={refs} ctx={ctx} />}
          {isSlider && (
            <>
              <Row label="min"><Num k="min" p={p} set={set} /></Row>
              <Row label="max"><Num k="max" p={p} set={set} /></Row>
              <Row label="step"><Num k="step" p={p} set={set} /></Row>
            </>
          )}
          {(t === 'checkboxes') && (
            <>
              <Row label="min sel"><Num k="min" p={p} set={set} /></Row>
              <Row label="max sel"><Num k="max" p={p} set={set} /></Row>
            </>
          )}
          {t === 'radio' && (
            <Row label="direction">
              <select
                className={selectCls}
                value={(p.direction as string) ?? 'vertical'}
                onChange={(e) => set({ direction: e.target.value })}
              >
                <option value="vertical">vertical</option>
                <option value="horizontal">horizontal</option>
              </select>
            </Row>
          )}
          {(t === 'text-input' || t === 'text-area') && (
            <Row label="placeholder"><Text k="placeholder" p={p} set={set} ctx={ctx} /></Row>
          )}
          {t === 'single-checkbox' && (
            <Row label="text"><Text k="text" p={p} set={set} ctx={ctx} /></Row>
          )}
          {isChoices && (
            <>
              <Row label="randomize"><Bool k="randomize" p={p} set={set} /></Row>
              <Row label="reshuffle"><Bool k="reshuffleInLoop" p={p} set={set} /></Row>
            </>
          )}
          <Row label="required"><Bool k="required" p={p} set={set} /></Row>
          <Row label="error msg"><Text k="errorMessage" p={p} set={set} ctx={ctx} /></Row>
        </div>
      );
    }
  }
}

function PayloadEditor({ p, set }: { p: Props; set: Patch }) {
  const payload = p.payload as { dataKey?: string; value?: unknown } | undefined;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5">
        <span className="text-content-secondary w-16 shrink-0">payload</span>
        <input
          type="checkbox"
          checked={!!payload}
          onChange={(e) =>
            set({
              payload: e.target.checked
                ? { dataKey: 'clicked', value: true }
                : undefined,
            })
          }
          className="accent-accent"
        />
      </div>
      {payload && (
        <div className="flex items-center gap-1 pl-1">
          <input
            key={payload.dataKey}
            defaultValue={payload.dataKey}
            placeholder="dataKey"
            className={`${inputCls} w-24`}
            onBlur={(e) =>
              set({ payload: { ...payload, dataKey: e.target.value } })
            }
          />
          <input
            key={JSON.stringify(payload.value)}
            defaultValue={JSON.stringify(payload.value ?? '')}
            placeholder="value (JSON)"
            className={`${inputCls} w-24`}
            onBlur={(e) => {
              try {
                set({
                  payload: { ...payload, value: JSON.parse(e.target.value) },
                });
              } catch {
                set({ payload: { ...payload, value: e.target.value } });
              }
            }}
          />
        </div>
      )}
    </div>
  );
}

export default function ComponentInspector({
  component,
  refs,
  dataKey,
  dataKeyDupe,
  onPatch,
  onRenameDataKey,
  onTemplateChange,
  ctx,
}: {
  component: ScreenComponent;
  refs: string[];
  dataKey?: string;
  dataKeyDupe?: boolean;
  onPatch: (props: Props) => void;
  onRenameDataKey?: (next: string) => void;
  onTemplateChange: (template: string) => void;
  ctx?: Ctx;
}) {
  const p = component.props as Props;
  const set: Patch = (patch) => {
    // strip undefined keys so toggles actually remove the prop
    const clean = Object.fromEntries(
      Object.entries(patch).filter(([, v]) => v !== undefined),
    );
    const next = { ...p };
    for (const [k, v] of Object.entries(patch))
      if (v === undefined) delete next[k];
    Object.assign(next, clean);
    onPatch(next);
  };

  return (
    <div className="flex flex-col gap-2 text-xxs">
      <div className="flex items-center gap-1.5">
        <select
          className={selectCls}
          value={component.template}
          onChange={(e) => onTemplateChange(e.target.value)}
        >
          {TEMPLATES.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
        <span className="text-content-secondary">{component.componentFamily}</span>
      </div>
      {dataKey !== undefined && (
        <Row label="dataKey">
          <input
            key={dataKey}
            defaultValue={dataKey}
            className={`${inputCls} ${dataKeyDupe ? 'border-red-500' : ''}`}
            onBlur={(e) => {
              const v = e.target.value.trim();
              if (v && v !== dataKey) onRenameDataKey?.(v);
            }}
          />
          {dataKeyDupe && (
            <span className="text-red-500" title="duplicate dataKey">⚠</span>
          )}
        </Row>
      )}
      <TemplateFields
        c={component}
        set={set}
        refs={refs}
        setProp={(k, v) => set({ [k]: v })}
        ctx={ctx}
      />
      {ctx?.dict && (
        <>
          {/* [[key]] autocomplete — option labels show the resolved text */}
          <datalist id="dict-keys">
            {Object.entries(ctx.dict).map(([k, v]) => (
              <option key={k} value={`[[${k}]]`} label={v} />
            ))}
          </datalist>
          {/* dict groups for options' labelKey (first segment of keys) */}
          <datalist id="dict-groups">
            {[
              ...new Set(
                Object.keys(ctx.dict).map((k) => k.split('.')[0]),
              ),
            ].map((g) => (
              <option key={g} value={g} />
            ))}
          </datalist>
        </>
      )}
      <details className="text-content-secondary">
        <summary className="cursor-pointer">props (JSON)</summary>
        <textarea
          key={JSON.stringify(p)}
          defaultValue={JSON.stringify(p, null, 2)}
          rows={8}
          spellCheck={false}
          className={`${inputCls} mt-1`}
          onBlur={(e) => {
            try {
              onPatch(JSON.parse(e.target.value));
            } catch {
              /* invalid JSON — keep editing */
            }
          }}
        />
      </details>
    </div>
  );
}

export { skeletonComponent };
