import { ErrorCategory } from '@/lib/experiment-validation';
import { FrameworkNode } from '@/lib/nodes';
import {
  ArrowRightLeft,
  Box,
  CirclePlay,
  ClipboardX,
  CloudUpload,
  Cpu,
  GitFork,
  Hash,
  LucideIcon,
  Repeat,
  Route,
  Split,
  Wallpaper,
} from 'lucide-react';
import { twMerge } from 'tailwind-merge';

export const BADGE_ICONS: Partial<
  Record<FrameworkNode['type'] | ErrorCategory, LucideIcon>
> = {
  // Node types
  start: CirclePlay,
  screen: Wallpaper,
  branch: Split,
  path: Route,
  fork: GitFork,
  loop: Repeat,
  checkpoint: CloudUpload,
  compute: Cpu,
  // Error categories
  edge: ArrowRightLeft,
  reference: Hash,
  node: Box,
  component: ClipboardX,
};

export const BADGE_CLASSES: Partial<
  Record<FrameworkNode['type'] | ErrorCategory, string>
> = {
  // Node types
  start: 'bg-lime-100 text-lime-700 border-lime-500',
  screen: 'bg-sky-100 text-sky-700 border-sky-500',
  branch: 'bg-orange-100 text-orange-700 border-orange-500',
  path: 'bg-violet-100 text-violet-700 border-violet-500',
  fork: 'bg-red-100 text-red-700 border-red-500',
  loop: 'bg-yellow-100 text-yellow-700 border-yellow-500',
  checkpoint: 'bg-teal-100 text-teal-700 border-teal-500',
  compute: 'bg-neutral-100 text-neutral-700 border-neutral-500',
  // Error categories
  // edge: 'bg-gray-100 text-gray-700 border-gray-500',
  // reference: 'bg-gray-100 text-gray-700 border-gray-500',
  // node: 'bg-gray-100 text-gray-700 border-gray-500',
  // component: 'bg-gray-100 text-gray-700 border-gray-500',
};

export const DEfAULT_BADGE_CLASS = 'bg-gray-100 text-gray-700 border-gray-300';

export function NodeTypeBadge({ type }: { type: FrameworkNode['type'] }) {
  const nodeClass = BADGE_CLASSES[type] ?? DEfAULT_BADGE_CLASS;
  const Icon = BADGE_ICONS[type] ?? Box;
  return (
    <span
      className={twMerge(
        'flex items-center gap-1 rounded border px-1 py-0.5 font-semibold',
        nodeClass,
      )}
    >
      <Icon size={12} />
      {type}
    </span>
  );
}
