'use client';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { FrameworkNode, NodeType } from '@experiment-hub/engine/nodes';
import {
  CircleStop,
  Database,
  GitBranch,
  Layers,
  Monitor,
  Play,
  Repeat,
  Save,
  Shuffle,
  Sigma,
  type LucideIcon,
} from 'lucide-react';
import { twMerge } from 'tailwind-merge';
import {
  ARM_COLORS,
  HANDLE_CHILDREN,
  HANDLE_DEFAULT,
  HANDLE_IN,
  HANDLE_NEXT,
  HANDLE_TEMPLATE,
  branchHandle,
  conditionToString,
  forkHandle,
  type EditorNode,
  type EditorNodeData,
} from './adapter';

// ─── Type meta ───────────────────────────────────────────────────────────────

const TYPE_META: Record<NodeType, { icon: LucideIcon; label: string; accent: string }> = {
  start: { icon: Play, label: 'Start', accent: '#64748b' },
  screen: { icon: Monitor, label: 'Screen', accent: '#60a6bc' },
  branch: { icon: GitBranch, label: 'Branch', accent: '#8b5cf6' },
  fork: { icon: Shuffle, label: 'Fork', accent: '#f97316' },
  path: { icon: Layers, label: 'Path', accent: '#14b8a6' },
  loop: { icon: Repeat, label: 'Loop', accent: '#ec4899' },
  checkpoint: { icon: Save, label: 'Checkpoint', accent: '#0cc084' },
  compute: { icon: Sigma, label: 'Compute', accent: '#f59e0b' },
  data: { icon: Database, label: 'Data', accent: '#0ea5e9' },
  end: { icon: CircleStop, label: 'End', accent: '#64748b' },
};

// ─── Handle styles ───────────────────────────────────────────────────────────

const handleClass =
  '!size-2.5 !rounded-full !border-2 !border-content-secondary !bg-background-surface';

/** Source handle docked to a row's right edge. */
const rowHandleStyle = {
  position: 'absolute',
  right: -6,
  top: '50%',
  transform: 'translateY(-50%)',
} as const;

function ArmHandle({ id, color }: { id: string; color: string }) {
  return (
    <Handle
      id={id}
      type="source"
      position={Position.Right}
      className={handleClass}
      style={{ ...rowHandleStyle, borderColor: color }}
    />
  );
}

// ─── Row helpers ─────────────────────────────────────────────────────────────

function Row({
  label,
  children,
}: {
  label: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 px-3 py-1.5 text-xs">
      <span className="text-content-secondary shrink-0">{label}</span>
      <span className="text-content-primary min-w-0 truncate font-mono">
        {children}
      </span>
    </div>
  );
}

/** Right-docked handle row — used for named outputs (arms, else, template, next). */
function HandleRow({
  label,
  detail,
  color,
  handleId,
}: {
  label: string;
  detail?: string;
  color: string;
  handleId: string;
}) {
  return (
    <div className="relative flex items-center justify-between gap-3 px-3 py-1.5">
      <span className="flex min-w-0 items-center gap-1.5">
        <span
          className="size-2 shrink-0 rounded-full"
          style={{ backgroundColor: color }}
        />
        <span className="text-content-primary truncate text-xs">{label}</span>
      </span>
      {detail && (
        <span className="text-content-secondary truncate font-mono text-xxs">
          {detail}
        </span>
      )}
      <ArmHandle id={handleId} color={color} />
    </div>
  );
}

/** Data socket row — exposes a key this node produces (read-only for now). */
function DataSocket({ fieldKey }: { fieldKey: string }) {
  return (
    <div className="relative flex items-center justify-end gap-1.5 px-3 py-0.5">
      <span className="text-content-secondary truncate font-mono text-xxs">
        {fieldKey}
      </span>
      <span className="border-content-active bg-background-surface size-1.5 shrink-0 rounded-full border" />
    </div>
  );
}

// ─── Per-type bodies ─────────────────────────────────────────────────────────

function NodeBody({
  node,
  data,
}: {
  node: FrameworkNode;
  data: EditorNodeData;
}) {
  switch (node.type) {
    case 'start':
      return node.props ? (
        <Row label="param">
          {node.props.param.key}={node.props.param.value}
        </Row>
      ) : (
        <Row label="entry">default</Row>
      );

    case 'screen':
      return (
        <>
          <Row label="screen">{node.props.slug}</Row>
          {data.fields.slice(0, 4).map((k) => (
            <DataSocket key={k} fieldKey={k} />
          ))}
          {data.fields.length > 4 && (
            <p className="text-content-secondary px-3 pb-1 text-right text-xxs">
              +{data.fields.length - 4} fields
            </p>
          )}
        </>
      );

    case 'branch':
      return (
        <>
          {node.props.branches.map((branch, i) => (
            <HandleRow
              key={branch.id}
              label={branch.name}
              detail={conditionToString(branch.config)}
              color={ARM_COLORS[i % ARM_COLORS.length]}
              handleId={branchHandle(branch.id)}
            />
          ))}
          <HandleRow label="else" color="#6b7280" handleId={HANDLE_DEFAULT} />
        </>
      );

    case 'fork':
      return (
        <>
          {node.props.forks.map((fork, i) => (
            <HandleRow
              key={fork.id}
              label={fork.name}
              detail={fork.weight != null ? `×${fork.weight}` : undefined}
              color={ARM_COLORS[i % ARM_COLORS.length]}
              handleId={forkHandle(fork.id)}
            />
          ))}
        </>
      );

    case 'path':
      return (
        <>
          {node.props.randomized && <Row label="order">randomized</Row>}
          {node.props.stepper && <Row label="stepper">{node.props.stepper.style}</Row>}
          <HandleRow label="contains" color="#a8a29e" handleId={HANDLE_CHILDREN} />
          <HandleRow label="next" color="#9ca3af" handleId={HANDLE_NEXT} />
        </>
      );

    case 'loop':
      return (
        <>
          <Row label="items">
            {node.props.type === 'static'
              ? `${node.props.values.length} static`
              : node.props.dataKey}
          </Row>
          {node.props.itemKey && <Row label="item key">{node.props.itemKey}</Row>}
          {node.props.randomized && <Row label="order">randomized</Row>}
          <HandleRow label="each" detail="template" color="#a8a29e" handleId={HANDLE_TEMPLATE} />
          <HandleRow label="next" color="#9ca3af" handleId={HANDLE_NEXT} />
        </>
      );

    case 'compute':
      return (
        <>
          {data.outputs.slice(0, 4).map((k) => (
            <DataSocket key={k} fieldKey={k} />
          ))}
          {data.outputs.length > 4 && (
            <p className="text-content-secondary px-3 pb-1 text-right text-xxs">
              +{data.outputs.length - 4} outputs
            </p>
          )}
        </>
      );

    case 'data':
      return (
        <>
          {data.outputs.slice(0, 4).map((k) => (
            <DataSocket key={k} fieldKey={k} />
          ))}
          {data.outputs.length > 4 && (
            <p className="text-content-secondary px-3 pb-1 text-right text-xxs">
              +{data.outputs.length - 4} keys
            </p>
          )}
        </>
      );

    case 'checkpoint':
      return <Row label="name">{node.props.name}</Row>;

    case 'end':
      return null;
  }
}

function nodeTitle(node: FrameworkNode): string {
  switch (node.type) {
    case 'screen':
      return node.props.slug;
    case 'branch':
    case 'fork':
    case 'path':
    case 'checkpoint':
    case 'compute':
    case 'data':
      return node.props.name;
    default:
      return node.id;
  }
}

// ─── Node ────────────────────────────────────────────────────────────────────

export default function FlowNode({ data, type }: NodeProps<EditorNode>) {
  const meta = TYPE_META[type as NodeType];
  const Icon = meta.icon;
  const node = data.node;
  const { childIndex } = data as EditorNodeData;

  return (
    <div
      className={twMerge(
        'bg-background-surface border-border-default relative w-60 rounded-xl border shadow-sm',
        'shadow-black/5',
      )}
    >
      {node.type !== 'start' && (
        <Handle
          id={HANDLE_IN}
          type="target"
          position={Position.Left}
          className={handleClass}
        />
      )}

      {childIndex != null && (
        <span className="border-border-default bg-background-surface text-content-secondary absolute -top-2 -left-2 z-10 flex size-5 items-center justify-center rounded-full border font-mono text-xxs">
          {childIndex + 1}
        </span>
      )}

      <div className="border-border-default flex items-center gap-2 border-b px-3 py-2">
        <span
          className="flex size-5 shrink-0 items-center justify-center rounded-md"
          style={{ backgroundColor: `${meta.accent}1a`, color: meta.accent }}
        >
          <Icon size={12} strokeWidth={2} />
        </span>
        <span className="text-content-primary min-w-0 truncate text-xs font-semibold">
          {nodeTitle(node)}
        </span>
        <span className="text-content-secondary ml-auto shrink-0 text-xxs">
          {meta.label}
        </span>
      </div>

      <div className="py-1">
        <NodeBody node={node} data={data as EditorNodeData} />
      </div>

      {['start', 'screen', 'checkpoint', 'compute', 'data'].includes(node.type) && (
        <Handle
          id={HANDLE_NEXT}
          type="source"
          position={Position.Right}
          className={handleClass}
        />
      )}
    </div>
  );
}
