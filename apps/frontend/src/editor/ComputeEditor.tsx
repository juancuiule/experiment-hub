'use client';
import type {
  Computation,
  Formula,
  LoopAggregateFormula,
} from '@experiment-hub/engine/nodes';
import ConditionEditor from './ConditionEditor';
import RefInput from './RefInput';

const inputClass =
  'border-border-default bg-background text-content-primary min-w-0 rounded border px-1.5 py-0.5 font-mono text-xxs';
const selectClass =
  'border-border-default bg-background text-content-primary rounded border px-1 py-0.5 text-xxs';
const removeBtn =
  'text-content-secondary hover:text-error cursor-pointer text-xs';

const parseScalar = (s: string): string | number | boolean =>
  s === 'true'
    ? true
    : s === 'false'
      ? false
      : s !== '' && !Number.isNaN(Number(s))
        ? Number(s)
        : s;

/** Lookup bands only allow string|number. */
const parseLookupScalar = (s: string): string | number => {
  const v = parseScalar(s);
  return typeof v === 'boolean' ? String(v) : v;
};

/** Bare-skeleton formulas per variant (callers fill ids/keys after). */
const skeleton = (t: Formula['type']): Formula => {
  switch (t) {
    case 'sum':
    case 'mean':
    case 'min':
    case 'max':
    case 'count':
      return { type: t, inputs: [] } as Formula;
    case 'conditional':
      return {
        type: 'conditional',
        condition: {
          type: 'simple',
          dataKey: '$$x' as `$$${string}`,
          operator: 'eq',
          value: '',
        },
        then: 0,
        else: 0,
      };
    case 'lookup':
      return { type: 'lookup', input: '$$', table: [], default: 0 };
    case 'sample':
      return { type: 'sample', input: '$$', n: 3 };
    case 'split':
      return { type: 'split', input: '$$', mode: 'into', n: 3 };
    case 'loop-aggregate':
      return { type: 'loop-aggregate', loopId: '', op: 'count' };
    case 'collect-loop':
      return { type: 'collect-loop', loopId: '' };
  }
};

const FORMULA_TYPES: Formula['type'][] = [
  'sum',
  'mean',
  'min',
  'max',
  'count',
  'conditional',
  'lookup',
  'sample',
  'split',
  'loop-aggregate',
  'collect-loop',
];

function FormulaEditor({
  formula,
  refs,
  loopIds,
  screenSlugs,
  onChange,
}: {
  formula: Formula;
  refs: string[];
  loopIds: string[];
  screenSlugs: string[];
  onChange: (f: Formula) => void;
}) {
  const set = (patch: Partial<Formula>) =>
    onChange({ ...formula, ...patch } as Formula);

  const refList = (values: string[], key: 'inputs') => (
    <div className="flex flex-col gap-1">
      {values.map((v, i) => (
        <div key={i} className="flex items-center gap-1">
          <RefInput
            value={v}
            refs={refs}
            className="w-40"
            onCommit={(nv) =>
              set({
                [key]: values.map((x, j) => (j === i ? nv : x)),
              } as Partial<Formula>)
            }
          />
          <button
            type="button"
            className={removeBtn}
            aria-label="Remove input"
            onClick={() =>
              set({
                [key]: values.filter((_, j) => j !== i),
              } as Partial<Formula>)
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
          set({ [key]: [...values, '$$'] } as Partial<Formula>)
        }
      >
        + input
      </button>
    </div>
  );

  switch (formula.type) {
    case 'sum':
    case 'mean':
    case 'min':
    case 'max':
      return refList(formula.inputs, 'inputs');
    case 'count':
      return (
        <div className="flex flex-col gap-1">
          {refList(formula.inputs, 'inputs')}
          <span className="text-content-secondary">where (optional)</span>
          <ConditionEditor
            condition={
              formula.where ?? {
                type: 'simple',
                dataKey: '@current' as `@${string}`,
                operator: 'eq',
                value: '',
              }
            }
            refs={refs}
            onChange={(c) => set({ where: c })}
          />
        </div>
      );
    case 'conditional':
      return (
        <div className="flex flex-col gap-1">
          <ConditionEditor
            condition={formula.condition}
            refs={refs}
            onChange={(c) => set({ condition: c })}
          />
          <div className="flex items-center gap-1">
            <span className="text-content-secondary">then</span>
            <input
              key={String(formula.then)}
              className={`${inputClass} w-16`}
              defaultValue={String(formula.then)}
              onBlur={(e) => set({ then: parseScalar(e.target.value) })}
            />
            <span className="text-content-secondary">else</span>
            <input
              key={String(formula.else)}
              className={`${inputClass} w-16`}
              defaultValue={String(formula.else)}
              onBlur={(e) => set({ else: parseScalar(e.target.value) })}
            />
          </div>
        </div>
      );
    case 'lookup':
      return (
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1">
            <span className="text-content-secondary">input</span>
            <RefInput
              value={String(formula.input)}
              refs={refs}
              className="w-40"
              onCommit={(v) => set({ input: v as never })}
            />
          </div>
          {formula.table.map((row, i) => (
            <div key={i} className="flex items-center gap-1">
              <span className="text-content-secondary">≥</span>
              <input
                key={row.when}
                type="number"
                className={`${inputClass} w-14`}
                defaultValue={row.when}
                onBlur={(e) =>
                  set({
                    table: formula.table.map((r, j) =>
                      j === i ? { ...r, when: Number(e.target.value) } : r,
                    ),
                  })
                }
              />
              <span className="text-content-secondary">→</span>
              <input
                key={String(row.then)}
                className={`${inputClass} w-16`}
                defaultValue={String(row.then)}
                onBlur={(e) =>
                  set({
                    table: formula.table.map((r, j) =>
                      j === i
                        ? { ...r, then: parseLookupScalar(e.target.value) }
                        : r,
                    ),
                  })
                }
              />
              <button
                type="button"
                className={removeBtn}
                aria-label="Remove band"
                onClick={() =>
                  set({ table: formula.table.filter((_, j) => j !== i) })
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
              set({ table: [...formula.table, { when: 0, then: '' }] })
            }
          >
            + band
          </button>
          <div className="flex items-center gap-1">
            <span className="text-content-secondary">default</span>
            <input
              key={String(formula.default ?? '')}
              className={`${inputClass} w-16`}
              defaultValue={String(formula.default ?? '')}
              onBlur={(e) =>
                set({
                  default:
                    e.target.value === ''
                      ? undefined
                      : parseLookupScalar(e.target.value),
                })
              }
            />
          </div>
        </div>
      );
    case 'sample':
    case 'split': {
      return (
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1">
            <span className="text-content-secondary">input</span>
            {typeof formula.input === 'string' ? (
              <RefInput
                value={formula.input}
                refs={refs}
                className="w-40"
                onCommit={(v) => set({ input: v as never })}
              />
            ) : (
              <>
                <span className="border-border-default bg-surface-subtle text-content-secondary rounded border px-1.5 py-0.5 text-xxs">
                  {Array.isArray(formula.input)
                    ? `${formula.input.length} items`
                    : 'inline value'}
                </span>
                <button
                  type="button"
                  title="Convert to a $$ ref"
                  className="text-content-secondary hover:text-content-primary cursor-pointer text-xxs underline"
                  onClick={() => set({ input: '$$' as never })}
                >
                  → ref
                </button>
              </>
            )}
          </div>
          {formula.type === 'split' && (
            <div className="flex items-center gap-1">
              <span className="text-content-secondary">mode</span>
              <select
                className={selectClass}
                value={formula.mode}
                onChange={(e) =>
                  set({ mode: e.target.value as 'into' | 'size' })
                }
              >
                <option value="into">into n bins</option>
                <option value="size">bins of n</option>
              </select>
            </div>
          )}
          <div className="flex items-center gap-1">
            <span className="text-content-secondary">n</span>
            <input
              key={String(formula.n)}
              className={`${inputClass} w-14`}
              defaultValue={String(formula.n)}
              onBlur={(e) =>
                set({
                  n:
                    e.target.value.startsWith('$')
                      ? (e.target.value as `$$${string}`)
                      : Number(e.target.value) || 0,
                })
              }
            />
          </div>
        </div>
      );
    }
    case 'loop-aggregate': {
      const f = formula as LoopAggregateFormula;
      const needsField = f.op !== 'count';
      return (
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1">
            <span className="text-content-secondary">loop</span>
            <select
              className={selectClass}
              value={f.loopId}
              onChange={(e) => set({ loopId: e.target.value })}
            >
              <option value="">—</option>
              {loopIds.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
            <span className="text-content-secondary">op</span>
            <select
              className={selectClass}
              value={f.op}
              onChange={(e) =>
                set({ op: e.target.value as LoopAggregateFormula['op'] })
              }
            >
              {['count', 'sum', 'mean', 'min', 'max'].map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          </div>
          {needsField && 'field' in f && (
            <div className="flex items-center gap-1">
              <span className="text-content-secondary">field</span>
              <RefInput
                value={(f as { field?: string }).field ?? ''}
                refs={refs}
                className="w-40"
                placeholder="@loop.screen.field"
                onCommit={(v) => set({ field: v } as Partial<Formula>)}
              />
            </div>
          )}
          <span className="text-content-secondary">where (optional)</span>
          <ConditionEditor
            condition={
              f.where ?? {
                type: 'simple',
                dataKey: '@loopId' as `@${string}`,
                operator: 'eq',
                value: '',
              }
            }
            refs={refs}
            onChange={(c) => set({ where: c })}
          />
        </div>
      );
    }
    case 'collect-loop':
      return (
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1">
            <span className="text-content-secondary">loop</span>
            <select
              className={selectClass}
              value={formula.loopId}
              onChange={(e) => set({ loopId: e.target.value })}
            >
              <option value="">—</option>
              {loopIds.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-content-secondary">screen</span>
            <select
              className={selectClass}
              value={formula.screen ?? ''}
              onChange={(e) =>
                set({ screen: e.target.value || undefined })
              }
            >
              <option value="">(all)</option>
              {screenSlugs.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>
      );
  }
}

export default function ComputeEditor({
  computations,
  refs,
  loopIds,
  screenSlugs,
  onChange,
}: {
  computations: Computation[];
  refs: string[];
  loopIds: string[];
  screenSlugs: string[];
  onChange: (computations: Computation[]) => void;
}) {
  return (
    <div className="flex max-h-72 flex-col gap-1.5 overflow-auto">
      {computations.map((comp, i) => (
        <div
          key={i}
          className="border-border-default bg-background flex flex-col gap-1 rounded-md border p-1.5"
        >
          <div className="flex items-center gap-1">
            <input
              key={comp.outputKey}
              className={`${inputClass} w-28`}
              defaultValue={comp.outputKey}
              placeholder="outputKey"
              onBlur={(e) =>
                onChange(
                  computations.map((c, j) =>
                    j === i ? { ...c, outputKey: e.target.value } : c,
                  ),
                )
              }
            />
            <select
              className={selectClass}
              value={comp.formula.type}
              onChange={(e) =>
                onChange(
                  computations.map((c, j) =>
                    j === i
                      ? { ...c, formula: skeleton(e.target.value as Formula['type']) }
                      : c,
                  ),
                )
              }
            >
              {FORMULA_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <button
              type="button"
              className={`${removeBtn} ml-auto`}
              aria-label={`Remove computation ${comp.outputKey}`}
              onClick={() =>
                onChange(computations.filter((_, j) => j !== i))
              }
            >
              ×
            </button>
          </div>
          <FormulaEditor
            formula={comp.formula}
            refs={refs}
            loopIds={loopIds}
            screenSlugs={screenSlugs}
            onChange={(f) =>
              onChange(
                computations.map((c, j) => (j === i ? { ...c, formula: f } : c)),
              )
            }
          />
        </div>
      ))}
      <button
        type="button"
        className="border-border-default text-content-secondary hover:text-content-primary w-fit cursor-pointer rounded-md border border-dashed px-1.5 py-px text-xxs"
        onClick={() =>
          onChange([
            ...computations,
            {
              outputKey: `out-${computations.length + 1}`,
              formula: skeleton('sum'),
            },
          ])
        }
      >
        + computation
      </button>
    </div>
  );
}
