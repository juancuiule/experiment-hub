'use client'

import { ValidationError } from "@/lib/validate";
import { AlertTriangle, ArrowRightLeft, Box, Hash, LucideIcon, Split, Wallpaper } from "lucide-react";
import { NodeTypeBadge } from "./nodeConfig";

type ErrorCategory = 'screen' | 'node' | 'branch' | 'edge' | 'reference';

const CATEGORY_COLORS: Record<ErrorCategory, string> = {
  screen: "bg-blue-100 text-blue-800 border-blue-300",
  branch: "bg-yellow-100 text-yellow-800 border-yellow-300",
  edge: "bg-teal-100 text-teal-800 border-teal-300",
  reference: "bg-orange-100 text-orange-800 border-orange-300",
  node: "bg-gray-100 text-gray-700 border-gray-300",
};

const CATEGORY_ICONS: Record<ErrorCategory, LucideIcon> = {
  screen: Wallpaper,
  branch: Split,
  edge: ArrowRightLeft,
  reference: Hash,
  node: Box,
};


function getCategory(code: string): ErrorCategory {
  if (code.includes('screen')) return 'screen';
  if (code.includes('branch') || code.includes('condition')) return 'branch';
  if (code.includes('reference')) return 'reference';
  if (code.includes('edge')) return 'edge';
  return 'node';
}

function extractNodeType(message: string): string | null {
  const match = message.match(/^(Start node|Branch|Checkpoint|Fork|Loop|Path|Screen node|Screen)\s/);
  if (!match) return null;
  return match[1].toLowerCase().replace(' node', '');
}

function ErrorCard({ error }: { error: ValidationError }) {
  const category = getCategory(error.code);
  const nodeType = extractNodeType(error.message);
  const colorClass = CATEGORY_COLORS[category];
  const Icon = CATEGORY_ICONS[category];

  return (
    <div className="rounded border p-2 font-mono text-xxs flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <AlertTriangle size={10} className="text-red-500 shrink-0" />
        <span className={`px-1.5 py-0.5 rounded border text-xxs font-semibold flex items-center gap-1 ${colorClass}`}>
          <Icon size={10} />
          {category}
        </span>
        {nodeType && nodeType !== category && <NodeTypeBadge type={nodeType} />}
        <span className="text-content-primary truncate">{error.code}</span>
      </div>
      <div className="pl-4 text-content-secondary">{error.message}</div>
    </div>
  );
}

export function ValidationErrors({ errors }: { errors: ValidationError[] }) {
  return (
    <div className="p-4 flex flex-col gap-3">
      <span className="font-mono text-[9px] uppercase tracking-wider text-gray-400">
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
