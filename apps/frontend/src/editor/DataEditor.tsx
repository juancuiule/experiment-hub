'use client';

const inputClass =
  'border-border-default bg-background text-content-primary min-w-0 rounded border px-1.5 py-0.5 font-mono text-xxs';

/** Parse a value input: valid JSON wins, otherwise keep the raw string. */
const parseValue = (s: string): unknown => {
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
};

/** Key/JSON-value row editor for a `data` node's `props.data` map. */
export default function DataEditor({
  data,
  onChange,
}: {
  data: Record<string, unknown>;
  onChange: (data: Record<string, unknown>) => void;
}) {
  const entries = Object.entries(data);

  const setAt = (i: number, key: string, value: unknown) => {
    const next = [...entries];
    next[i] = [key, value];
    onChange(Object.fromEntries(next));
  };
  const removeAt = (i: number) =>
    onChange(Object.fromEntries(entries.filter((_, j) => j !== i)));
  const add = () =>
    onChange({ ...data, [`key-${entries.length + 1}`]: 'value' });

  return (
    <div className="flex max-h-64 flex-col gap-1 overflow-auto">
      {entries.map(([key, value], i) => (
        <div key={i} className="flex items-start gap-1">
          <input
            key={`k-${key}`}
            className={`${inputClass} w-24`}
            defaultValue={key}
            placeholder="key"
            onBlur={(e) =>
              e.target.value && setAt(i, e.target.value, value)
            }
          />
          <textarea
            key={`v-${JSON.stringify(value)}`}
            className={`${inputClass} min-h-5 flex-1 resize-y`}
            rows={1}
            defaultValue={
              typeof value === 'string' ? value : JSON.stringify(value)
            }
            placeholder='value (JSON for arrays/objects)'
            onBlur={(e) => setAt(i, key, parseValue(e.target.value))}
          />
          <button
            type="button"
            aria-label={`Remove ${key}`}
            onClick={() => removeAt(i)}
            className="text-content-secondary hover:text-error cursor-pointer text-xs"
          >
            ×
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        className="border-border-default text-content-secondary hover:text-content-primary w-fit cursor-pointer rounded-md border border-dashed px-1.5 py-px text-xxs"
      >
        + key
      </button>
    </div>
  );
}
