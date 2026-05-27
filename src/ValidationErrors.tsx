import { ErrorCategory, ValidationError } from '@/lib/experiment-validation';
import { AlertOctagonIcon } from 'lucide-react';
import { twMerge } from 'tailwind-merge';
import {
  BADGE_CLASSES,
  BADGE_ICONS,
  DEfAULT_BADGE_CLASS,
  NodeTypeBadge,
} from './nodeConfig';

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

function ErrorCard({ error }: { error: ValidationError }) {
  const { category, nodeType } = error;

  return (
    <div className="flex flex-col gap-1 rounded border p-2 font-mono text-xs">
      <div className="flex items-center gap-2">
        <ErrorCategoryBadge category={category} />
        {nodeType && nodeType !== category && <NodeTypeBadge type={nodeType} />}
        <span className="text-content-primary truncate font-bold">
          {error.code}
        </span>
      </div>
      <div className="text-content-secondary">{error.message}</div>
    </div>
  );
}

export function ValidationErrors({ errors }: { errors: ValidationError[] }) {
  return (
    <div className="flex flex-col gap-3 p-4">
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
