import { FrameworkNode } from '@/lib/nodes';
import {
  CirclePlay,
  CloudUpload,
  Cpu,
  GitFork,
  LucideIcon,
  Repeat,
  Route,
  Split,
  Wallpaper,
} from 'lucide-react';

export const NODE_ICONS: Record<string, LucideIcon> = {
  start: CirclePlay,
  screen: Wallpaper,
  branch: Split,
  path: Route,
  fork: GitFork,
  loop: Repeat,
  checkpoint: CloudUpload,
  compute: Cpu,
};

export const NODE_COLORS: Record<FrameworkNode['type'], string> = {
  start: 'bg-green-100 text-green-800 border-green-300',
  screen: 'bg-blue-100 text-blue-800 border-blue-300',
  branch: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  path: 'bg-purple-100 text-purple-800 border-purple-300',
  fork: 'bg-orange-100 text-orange-800 border-orange-300',
  loop: 'bg-pink-100 text-pink-800 border-pink-300',
  checkpoint: 'bg-gray-100 text-gray-700 border-gray-300',
  compute: 'bg-cyan-100 text-cyan-800 border-cyan-300',
};

export function NodeTypeBadge({ type }: { type: FrameworkNode['type'] }) {
  const colorClass =
    NODE_COLORS[type] ?? 'bg-gray-100 text-gray-700 border-gray-300';
  const Icon = NODE_ICONS[type];
  return (
    <span
      className={`text-xxs flex items-center gap-1 rounded border px-1.5 py-0.5 font-semibold ${colorClass}`}
    >
      {Icon && <Icon size={10} />}
      {type}
    </span>
  );
}
