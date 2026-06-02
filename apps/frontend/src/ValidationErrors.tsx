import { ErrorCategory, ValidationError } from '@experiment-hub/engine/experiment-validation';
import { AlertOctagonIcon, OctagonX, TriangleAlert } from 'lucide-react';
import { twMerge } from 'tailwind-merge';
import {
  BADGE_CLASSES,
  BADGE_ICONS,
  DEfAULT_BADGE_CLASS,
  NodeTypeBadge,
} from './debug/nodeConfig';

function ErrorCategoryBadge({ category }: { category: ErrorCategory }) {
  const categoryClass = BADGE_CLASSES[category] ?? DEfAULT_BADGE_CLASS;
  const Icon = BADGE_ICONS[category] ?? AlertOctagonIcon;

  return (
    <span
      className={twMerge(
        'flex items-center gap-1 rounded border px-1 py-0.5 font-semibold',
        categoryClass,
      )}
    >
      <Icon size={12} />
      {category}
    </span>
  );
}

function SeverityBadge({ severity }: { severity: 'error' | 'warning' }) {
  const severityClass =
    severity === 'warning'
      ? 'bg-warning/20 text-warning'
      : 'bg-error/20 text-error';
  const Icon = severity === 'warning' ? TriangleAlert : OctagonX;

  return (
    <span
      className={twMerge(
        'flex h-full items-center gap-1 rounded border px-1 py-0.5 font-semibold',
        'aspect-square',
        severityClass,
      )}
    >
      <Icon size={12} />
    </span>
  );
}

function ErrorCard({ error }: { error: ValidationError }) {
  const { category, nodeType, severity = 'error' } = error;
  return (
    <div className="flex flex-col gap-1 rounded border p-2 font-mono text-xs">
      <div className="flex items-center gap-2">
        <SeverityBadge severity={severity} />
        <ErrorCategoryBadge category={category} />
        {nodeType && nodeType !== category && <NodeTypeBadge type={nodeType} />}
        <span className="text-content-primary truncate font-bold">
          {error.code}
        </span>
      </div>
      <div className="text-content-secondary line-clamp-2 hover:line-clamp-none">
        {error.message}
      </div>
    </div>
  );
}

export function ValidationErrors({ errors }: { errors: ValidationError[] }) {
  return (
    <div className="flex flex-col gap-3 py-4">
      <span className="text-content-secondary font-mono text-[9px] tracking-wider uppercase">
        Validation Errors
      </span>
      <div className="flex flex-col gap-2">
        {errors.map((error, index) => (
          <ErrorCard key={index} error={error} />
        ))}
      </div>
    </div>
  );
}
