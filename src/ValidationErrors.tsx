'use client';

import { ErrorCategory, ValidationError } from '@/lib/flow-validation';
import { FrameworkNode } from '@/lib/nodes';
import {
  ArrowRightLeft,
  Box,
  ClipboardX,
  Hash,
  LucideIcon,
  Split,
  Wallpaper,
} from 'lucide-react';
import { NodeTypeBadge } from './nodeConfig';

const CATEGORY_COLORS: Record<ErrorCategory, string> = {
  screen: 'bg-blue-100 text-blue-800 border-blue-300',
  branch: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  edge: 'bg-teal-100 text-teal-800 border-teal-300',
  reference: 'bg-orange-100 text-orange-800 border-orange-300',
  node: 'bg-gray-100 text-gray-700 border-gray-300',
  component: 'bg-red-100 text-red-800 border-red-300',
};

const CATEGORY_ICONS: Record<ErrorCategory, LucideIcon> = {
  screen: Wallpaper,
  branch: Split,
  edge: ArrowRightLeft,
  reference: Hash,
  node: Box,
  component: ClipboardX,
};

function extractNodeType(message: string): string | null {
  const match = message.match(
    /^(Start node|Branch|Checkpoint|Fork|Loop|Path|Screen node|Screen)\s/,
  );
  if (!match) return null;
  return match[1].toLowerCase().replace(' node', '');
}

function ErrorCard({ error }: { error: ValidationError }) {
  const category = error.category;
  const nodeType = extractNodeType(error.message) as
    | FrameworkNode['type']
    | null;
  const colorClass = CATEGORY_COLORS[category];
  const Icon = CATEGORY_ICONS[category];

  return (
    <div className="text-xxs flex flex-col gap-1 rounded border p-2 font-mono">
      <div className="flex items-center gap-2">
        <span
          className={`text-xxs flex items-center gap-1 rounded border px-1.5 py-0.5 font-semibold ${colorClass}`}
        >
          <Icon size={10} />
          {category}
        </span>
        {nodeType && nodeType !== category && <NodeTypeBadge type={nodeType} />}
        <span className="text-content-primary truncate">{error.code}</span>
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
