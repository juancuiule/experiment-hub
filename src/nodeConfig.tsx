import { CirclePlay, CloudUpload, GitFork, LucideIcon, Repeat, Route, Split, Wallpaper } from "lucide-react";

export const NODE_ICONS: Record<string, LucideIcon> = {
  start: CirclePlay,
  screen: Wallpaper,
  branch: Split,
  path: Route,
  fork: GitFork,
  loop: Repeat,
  checkpoint: CloudUpload,
};

export const NODE_COLORS: Record<string, string> = {
  start: "bg-green-100 text-green-800 border-green-300",
  screen: "bg-blue-100 text-blue-800 border-blue-300",
  branch: "bg-yellow-100 text-yellow-800 border-yellow-300",
  path: "bg-purple-100 text-purple-800 border-purple-300",
  fork: "bg-orange-100 text-orange-800 border-orange-300",
  loop: "bg-pink-100 text-pink-800 border-pink-300",
  checkpoint: "bg-gray-100 text-gray-700 border-gray-300",
};

export function NodeTypeBadge({ type }: { type: string }) {
  const colorClass = NODE_COLORS[type] ?? "bg-gray-100 text-gray-700 border-gray-300";
  const Icon = NODE_ICONS[type];
  return (
    <span className={`px-1.5 py-0.5 rounded border text-xxs font-semibold flex items-center gap-1 ${colorClass}`}>
      {Icon && <Icon size={10} />}
      {type}
    </span>
  );
}
