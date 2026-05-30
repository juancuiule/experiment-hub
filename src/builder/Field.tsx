'use client';

import { ReactNode } from 'react';

const inputCls =
  'w-full rounded-md border border-border-default bg-background px-2.5 py-1.5 text-sm text-content-primary outline-none transition focus:border-content-active focus:ring-1 focus:ring-ring';

export function FieldRow({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-content-secondary">
        {label}
      </span>
      {children}
      {hint ? (
        <span className="text-xxs text-content-secondary/70">{hint}</span>
      ) : null}
    </label>
  );
}

export function TextField({
  label,
  value,
  onChange,
  placeholder,
  hint,
  mono,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: string;
  mono?: boolean;
}) {
  return (
    <FieldRow label={label} hint={hint}>
      <input
        className={mono ? `${inputCls} font-mono text-xs` : inputCls}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </FieldRow>
  );
}

export function NumberField({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  hint?: string;
}) {
  return (
    <FieldRow label={label} hint={hint}>
      <input
        type="number"
        className={inputCls}
        value={value ?? ''}
        onChange={(e) =>
          onChange(e.target.value === '' ? undefined : Number(e.target.value))
        }
      />
    </FieldRow>
  );
}

export function TextareaField({
  label,
  value,
  onChange,
  rows = 4,
  hint,
  mono,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  hint?: string;
  mono?: boolean;
}) {
  return (
    <FieldRow label={label} hint={hint}>
      <textarea
        className={mono ? `${inputCls} font-mono text-xs` : inputCls}
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </FieldRow>
  );
}

export function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
  hint,
}: {
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (v: T) => void;
  hint?: string;
}) {
  return (
    <FieldRow label={label} hint={hint}>
      <select
        className={inputCls}
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </FieldRow>
  );
}

export function ToggleField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-2">
      <span className="text-xs font-medium text-content-secondary">
        {label}
      </span>
      <input
        type="checkbox"
        className="accent-content-active size-4"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  );
}
