'use client';

const inputClass =
  'border-border-default bg-background text-content-primary min-w-0 rounded border px-1.5 py-0.5 font-mono text-xxs';

let counter = 0;

/** Ref-ish input with suggestion datalist. Commits on blur. */
export default function RefInput({
  value,
  refs,
  onCommit,
  placeholder = '$$x.y',
  className = '',
}: {
  value: string;
  refs: string[];
  onCommit: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const id = `ref-input-${++counter}`;
  return (
    <>
      <input
        key={value}
        list={id}
        className={`${inputClass} ${className}`}
        defaultValue={value}
        placeholder={placeholder}
        onBlur={(e) => onCommit(e.target.value)}
      />
      <datalist id={id}>
        {refs.map((r) => (
          <option key={r} value={r} />
        ))}
      </datalist>
    </>
  );
}
