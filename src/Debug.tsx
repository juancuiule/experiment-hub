'use client'

import { FrameworkEdge } from "@/lib/edges";
import { FrameworkNode, LoopNode } from "@/lib/nodes";
import { InLoopState, State } from "@/lib/types";
import { CirclePlay, CloudUpload, GitFork, LucideIcon, Repeat, Route, Split, Wallpaper } from "lucide-react";
import { useExperimentStore } from "./data/store";

const NODE_ICONS: Record<string, LucideIcon> = {
  start: CirclePlay,
  screen: Wallpaper,
  branch: Split,
  path: Route,
  fork: GitFork,
  loop: Repeat,
  checkpoint: CloudUpload,
};

const NODE_COLORS: Record<string, string> = {
  start: "bg-green-100 text-green-800 border-green-300",
  screen: "bg-blue-100 text-blue-800 border-blue-300",
  branch: "bg-yellow-100 text-yellow-800 border-yellow-300",
  path: "bg-purple-100 text-purple-800 border-purple-300",
  fork: "bg-orange-100 text-orange-800 border-orange-300",
  loop: "bg-pink-100 text-pink-800 border-pink-300",
  checkpoint: "bg-gray-100 text-gray-700 border-gray-300",
};

function findLoopState(state: State, nodeId: string): InLoopState | null {
  if (state.type === "in-loop") {
    if (state.node.id === nodeId) return state;
    return findLoopState(state.innerState, nodeId);
  }
  if (state.type === "in-path") return findLoopState(state.innerState, nodeId);
  return null;
}

// Returns the full chain of active node IDs from outermost to innermost.
function getCurrentPath(state: State): string[] {
  if (state.type === "in-node") return [state.node.id];
  if (state.type === "in-path") return [state.node.id, ...getCurrentPath(state.innerState)];
  if (state.type === "in-loop") return [state.node.id, ...getCurrentPath(state.innerState)];
  return [];
}

type Connection = { label: string; toId: string };

function getConnections(node: FrameworkNode, edges: FrameworkEdge[]): Connection[] {
  const result: Connection[] = [];
  for (const edge of edges) {
    const fromNodeId = edge.from.split('.')[0];
    if (fromNodeId !== node.id) continue;
    switch (edge.type) {
      case 'sequential':
        result.push({ label: '→', toId: edge.to }); break;
      case 'branch-condition':
        result.push({ label: `branch:${edge.from.split('.')[1]}`, toId: edge.to }); break;
      case 'branch-default':
        result.push({ label: 'default', toId: edge.to }); break;
      case 'path-contains':
        result.push({ label: `[${edge.order}]`, toId: edge.to }); break;
      case 'loop-template':
        result.push({ label: 'template', toId: edge.to }); break;
      case 'fork-edge':
        result.push({ label: `fork:${edge.from.split('.')[1]}`, toId: edge.to }); break;
    }
  }
  return result;
}

function LoopDetail({ node, state }: { node: LoopNode; state: State }) {
  const loopState = findLoopState(state, node.id);
  const resolvedValues = loopState?.values ?? (node.props.type === "static" ? node.props.values : null);

  return (
    <div className="flex flex-col gap-0.5 pl-4 text-xxs">
      <span className="text-gray-400">
        type:{" "}
        <span className={node.props.type === "static" ? "text-blue-600" : "text-orange-600"}>
          {node.props.type}
        </span>
      </span>
      {node.props.type === "dynamic" && (
        <span className="text-gray-400">
          dataKey: <span className="text-gray-600">{node.props.dataKey}</span>
        </span>
      )}
      {resolvedValues && (
        <span className="text-gray-400">
          values: [
          {resolvedValues.map((v, i) => (
            <span key={i}>
              {i > 0 && <span className="text-gray-300">, </span>}
              <span className={loopState && i === loopState.index ? "text-black font-bold" : "text-gray-600"}>
                {v}
              </span>
            </span>
          ))}
          ]
          {loopState && (
            <span> (idx: <span className="text-gray-600">{loopState.index}</span>)</span>
          )}
        </span>
      )}
    </div>
  );
}

type ActiveRole = "leaf" | "container" | null;

function NodeCard({
  node,
  edges,
  role,
  state,
}: {
  node: FrameworkNode;
  edges: FrameworkEdge[];
  role: ActiveRole;
  state: State;
}) {
  const connections = getConnections(node, edges);
  const colorClass = NODE_COLORS[node.type] ?? "bg-gray-100 text-gray-800 border-gray-300";
  const Icon = NODE_ICONS[node.type];

  const wrapperClass =
    role === "leaf" ? "ring-2 ring-black shadow-md" :
      role === "container" ? "ring-1 ring-black/30 border-dashed" :
        "opacity-50";

  return (
    <div className={`rounded border p-2 font-mono text-xxs flex flex-col gap-1 transition-all ${wrapperClass}`}>
      <div className="flex items-center gap-2">
        {role === "leaf" && <span className="w-2 h-2 rounded-full bg-black shrink-0" />}
        {role === "container" && <span className="w-2 h-2 rounded-full border border-black shrink-0" />}
        <span className={`px-1.5 py-0.5 rounded border text-xxs font-semibold flex items-center gap-1 ${colorClass}`}>
          {Icon && <Icon size={10} />}
          {node.type}
        </span>
        <span className="text-gray-700 truncate">{node.id}</span>
      </div>
      {node.type === "loop" && <LoopDetail node={node} state={state} />}
      {connections.length > 0 && (
        <div className="flex flex-wrap gap-1 pl-4">
          {connections.map((c, i) => (
            <span key={i} className="text-gray-500">
              <span className="text-gray-400">{c.label}</span>{" "}
              <span className="text-gray-600">{c.toId}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export function StateDebug() {
  const { step } = useExperimentStore();

  if (!step) {
    return <div className="font-mono text-xxs text-gray-400 p-2">No experiment loaded.</div>;
  }

  const { experiment: { nodes, edges }, state } = step;
  const currentPath = getCurrentPath(state);
  const leafId = currentPath.at(-1) ?? null;

  function getRole(nodeId: string): ActiveRole {
    if (nodeId === leafId) return "leaf";
    if (currentPath.includes(nodeId)) return "container";
    return null;
  }

  return (
    <div className="my-5 border-gray-200">
      <div className="font-mono text-xxs text-gray-400 mb-2 tracking-wider uppercase gap-1 w-full">
        <div>Debug — {nodes.length} nodes</div>
        <div className="flex">
          <span>State - {state.type}</span>
          {currentPath.length > 0 && (
            <>
              <span>·</span>
              {currentPath.map((id, i) => (
                <span key={id} className="flex items-center gap-1">
                  {i > 0 && <span className="text-gray-300">›</span>}
                  <span className={i === currentPath.length - 1 ? "text-black" : "text-gray-500"}>{id}</span>
                </span>
              ))}
            </>
          )}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {nodes.map((node) => (
          <NodeCard
            key={node.id}
            node={node}
            edges={edges}
            role={getRole(node.id)}
            state={state}
          />
        ))}
      </div>
    </div>
  );
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isPrimitiveArray(v: unknown[]): boolean {
  return v.every(item => typeof item !== 'object' || item === null);
}

function Leaf({ value }: { value: unknown }) {
  if (value === null || value === undefined) return <span className="text-gray-300">null</span>;
  if (typeof value === 'boolean') return <span className="text-purple-600">{value.toString()}</span>;
  if (typeof value === 'number') return <span className="text-blue-600">{value}</span>;
  if (typeof value === 'string') return <span className="text-green-700">"{value}"</span>;
  if (Array.isArray(value)) {
    return (
      <span className="text-gray-500">
        [{(value as unknown[]).map((item, i) => (
          <span key={i}>{i > 0 && <span className="text-gray-300">, </span>}<Leaf value={item} /></span>
        ))}]
      </span>
    );
  }
  return null;
}

function DataTree({ data, depth = 0 }: { data: Record<string, unknown>; depth?: number }) {
  return (
    <div className={`flex flex-col gap-0.5 font-mono text-xxs ${depth > 0 ? 'border-l border-gray-200 pl-2 ml-1' : ''}`}>
      {Object.entries(data).map(([key, value]) => {
        const isComplex = isPlainObject(value) || (Array.isArray(value) && !isPrimitiveArray(value as unknown[]));
        if (isComplex) {
          const children = isPlainObject(value)
            ? value
            : (value as unknown[]).reduce<Record<string, unknown>>((acc, v, i) => { acc[i] = v; return acc; }, {});
          return (
            <div key={key} className="flex flex-col gap-0.5">
              <span className="text-gray-500">{key}</span>
              <DataTree data={children} depth={depth + 1} />
            </div>
          );
        }
        return (
          <div key={key} className="flex gap-1.5 items-baseline">
            <span className="text-gray-400 shrink-0">{key}:</span>
            <Leaf value={value} />
          </div>
        );
      })}
    </div>
  );
}

function DataSection({ title, data }: { title: string; data: Record<string, unknown> }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="font-mono text-[9px] uppercase tracking-wider text-gray-400">{title}</span>
      <div className="rounded border p-2">
        <DataTree data={data} />
      </div>
    </div>
  );
}

export function DataDebug() {
  const { step } = useExperimentStore();

  if (!step) {
    return <div className="font-mono text-xxs text-gray-400 p-2">No experiment loaded.</div>;
  }

  const { context } = step;
  const { data, branches, forks, checkpoints, loops, start } = context;

  const hasData = data && Object.keys(data).length > 0;
  const hasBranches = branches && Object.keys(branches).length > 0;
  const hasForks = forks && Object.keys(forks).length > 0;
  const hasCheckpoints = checkpoints && Object.keys(checkpoints).length > 0;
  const hasLoops = loops && Object.keys(loops).length > 0;
  const hasStart = start && Object.keys(start).length > 0;
  const isEmpty = !hasData && !hasBranches && !hasForks && !hasCheckpoints && !hasLoops && !hasStart;

  if (isEmpty) {
    return (
      <div className="my-5">
        <div className="font-mono text-[9px] uppercase tracking-wider text-gray-400 mb-2">Data</div>
        <div className="font-mono text-xxs text-gray-300 italic">No data collected yet.</div>
      </div>
    );
  }

  return (
    <div className="my-5 flex flex-col gap-3">
      <div className="font-mono text-[9px] uppercase tracking-wider text-gray-400">Data</div>
      {hasStart && <DataSection title="start" data={start} />}
      {hasData && <DataSection title="collected" data={data} />}
      {hasBranches && <DataSection title="branches taken" data={branches} />}
      {hasForks && <DataSection title="forks assigned" data={forks} />}
      {hasCheckpoints && <DataSection title="checkpoints" data={checkpoints} />}
      {hasLoops && <DataSection title="loops" data={loops} />}
    </div>
  );
}