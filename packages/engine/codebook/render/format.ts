import { CodebookVariable, Repetition } from '../types';

// Compact human text for a variable's options: inline values, or "→ ref".
export function optionsText(options: CodebookVariable['options']): string {
  if (!options) return '';
  if (Array.isArray(options)) return options.map((o) => o.value).join(', ');
  return `→ ${options.ref}`;
}

// Compact human text for repetition.
export function repetitionText(repetition: Repetition): string {
  switch (repetition.kind) {
    case 'none':
      return '—';
    case 'static':
      return `×${repetition.count}`;
    case 'dynamic':
      return `per ${repetition.over}`;
  }
}

// Constraints as "min=0, max=10".
export function constraintsText(
  constraints: CodebookVariable['constraints'],
): string {
  if (!constraints) return '';
  return Object.entries(constraints)
    .map(([k, v]) => `${k}=${v}`)
    .join(', ');
}
