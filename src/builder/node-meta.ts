import { FrameworkNode, NodeType } from '@/lib/nodes';
import {
  CircleStop,
  FileText,
  FlagTriangleRight,
  GitBranch,
  Repeat,
  Route,
  Save,
  Shuffle,
  Sigma,
  type LucideIcon,
} from 'lucide-react';

export interface NodeTypeMeta {
  type: NodeType;
  label: string;
  description: string;
  icon: LucideIcon;
  /** Tailwind classes for the node's accent strip / chip. */
  accent: string;
  /** Whether the palette can spawn this node (start/end are usually singletons). */
  spawnable: boolean;
}

export const NODE_META: Record<NodeType, NodeTypeMeta> = {
  start: {
    type: 'start',
    label: 'Start',
    description: 'Entry point. Optionally assigns a condition group.',
    icon: FlagTriangleRight,
    accent: 'bg-emerald-500 text-emerald-50',
    spawnable: false,
  },
  screen: {
    type: 'screen',
    label: 'Screen',
    description: 'A participant-facing screen with components.',
    icon: FileText,
    accent: 'bg-sky-500 text-sky-50',
    spawnable: true,
  },
  branch: {
    type: 'branch',
    label: 'Branch',
    description: 'Routes by evaluating conditions in order.',
    icon: GitBranch,
    accent: 'bg-amber-500 text-amber-50',
    spawnable: true,
  },
  path: {
    type: 'path',
    label: 'Path',
    description: 'An ordered (optionally randomized) sub-sequence.',
    icon: Route,
    accent: 'bg-indigo-500 text-indigo-50',
    spawnable: true,
  },
  fork: {
    type: 'fork',
    label: 'Fork',
    description: 'Randomly assigns participants to weighted groups.',
    icon: Shuffle,
    accent: 'bg-violet-500 text-violet-50',
    spawnable: true,
  },
  loop: {
    type: 'loop',
    label: 'Loop',
    description: 'Repeats a template over static or dynamic values.',
    icon: Repeat,
    accent: 'bg-cyan-500 text-cyan-50',
    spawnable: true,
  },
  checkpoint: {
    type: 'checkpoint',
    label: 'Checkpoint',
    description: 'Persists collected data (calls send()).',
    icon: Save,
    accent: 'bg-slate-500 text-slate-50',
    spawnable: true,
  },
  compute: {
    type: 'compute',
    label: 'Compute',
    description: 'Derives values via formulas (sum, sample, …).',
    icon: Sigma,
    accent: 'bg-rose-500 text-rose-50',
    spawnable: true,
  },
  end: {
    type: 'end',
    label: 'End',
    description: 'Terminal node.',
    icon: CircleStop,
    accent: 'bg-zinc-700 text-zinc-50',
    spawnable: false,
  },
};

export const PALETTE_ORDER: NodeType[] = [
  'screen',
  'branch',
  'path',
  'fork',
  'loop',
  'compute',
  'checkpoint',
];

/** Human title shown on a node card. */
export function nodeTitle(node: FrameworkNode): string {
  switch (node.type) {
    case 'screen':
      return node.props.slug;
    case 'start':
      return node.props?.name ?? 'start';
    case 'branch':
    case 'fork':
    case 'path':
    case 'compute':
    case 'checkpoint':
      return node.props.name;
    case 'loop':
      return node.id;
    case 'end':
      return 'end';
  }
}

/** Secondary descriptor shown under the title. */
export function nodeSubtitle(node: FrameworkNode): string | undefined {
  switch (node.type) {
    case 'branch':
      return `${node.props.branches.length} branch(es)`;
    case 'fork':
      return `${node.props.forks.length} group(s)`;
    case 'loop':
      return node.props.type === 'static'
        ? `static · ${node.props.values.length} items`
        : `dynamic · ${node.props.dataKey}`;
    case 'compute':
      return `${node.props.computations.length} computation(s)`;
    case 'path':
      return node.props.randomized ? 'randomized' : 'ordered';
    case 'start':
      return node.props?.param
        ? `${node.props.param.key}=${node.props.param.value}`
        : undefined;
    default:
      return undefined;
  }
}

let seq = 0;
function uid(prefix: string): string {
  seq += 1;
  return `${prefix}-${Date.now().toString(36)}${seq}`;
}

/** Builds a sensible default node of a given type for the palette. */
export function makeNode(type: NodeType): FrameworkNode {
  const id = uid(type);
  switch (type) {
    case 'screen':
      return { id, type, props: { slug: uid('screen-slug') } };
    case 'branch':
      return {
        id,
        type,
        props: { name: 'New branch', branches: [] },
      };
    case 'path':
      return { id, type, props: { name: 'New path' } };
    case 'fork':
      return { id, type, props: { name: 'New fork', forks: [] } };
    case 'loop':
      return { id, type, props: { type: 'static', values: [] } };
    case 'compute':
      return { id, type, props: { name: 'New compute', computations: [] } };
    case 'checkpoint':
      return { id, type, props: { name: 'New checkpoint' } };
    case 'start':
      return { id, type };
    case 'end':
      return { id, type };
  }
}
