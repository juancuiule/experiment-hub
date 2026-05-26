'use client';

import { FrameworkEdge } from '@/lib/edges';
import { FrameworkNode, LoopNode } from '@/lib/nodes';
import { InLoopState, State } from '@/lib/types';
import { DataSection } from './components/DataTree';
import { useExperimentStore } from './data/store';
import { NodeTypeBadge } from './nodeConfig';

function findLoopState(state: State, nodeId: string): InLoopState | null {
  if (state.type === 'in-loop') {
    if (state.node.id === nodeId) return state;
    return findLoopState(state.innerState, nodeId);
  }
  if (state.type === 'in-path') return findLoopState(state.innerState, nodeId);
  return null;
}

// Returns the full chain of active node IDs from outermost to innermost.
function getCurrentPath(state: State): string[] {
  if (state.type === 'in-node') return [state.node.id];
  if (state.type === 'in-path')
    return [state.node.id, ...getCurrentPath(state.innerState)];
  if (state.type === 'in-loop')
    return [state.node.id, ...getCurrentPath(state.innerState)];
  return [];
}

type Connection = { label: string; toId: string };

function getConnections(
  node: FrameworkNode,
  edges: FrameworkEdge[],
): Connection[] {
  const result: Connection[] = [];
  for (const edge of edges) {
    const fromNodeId = edge.from.split('.')[0];
    if (fromNodeId !== node.id) continue;
    switch (edge.type) {
      case 'sequential':
        result.push({ label: '→', toId: edge.to });
        break;
      case 'branch-condition':
        result.push({
          label: `branch:${edge.from.split('.')[1]}`,
          toId: edge.to,
        });
        break;
      case 'branch-default':
        result.push({ label: 'default', toId: edge.to });
        break;
      case 'path-contains':
        result.push({ label: `[${edge.order}]`, toId: edge.to });
        break;
      case 'loop-template':
        result.push({ label: 'template', toId: edge.to });
        break;
      case 'fork-edge':
        result.push({
          label: `fork:${edge.from.split('.')[1]}`,
          toId: edge.to,
        });
        break;
    }
  }
  return result;
}

function LoopDetail({ node, state }: { node: LoopNode; state: State }) {
  const loopState = findLoopState(state, node.id);
  const resolvedValues =
    loopState?.values ??
    (node.props.type === 'static' ? node.props.values : null);

  return (
    <div className="text-xxs flex flex-col gap-0.5 pl-4">
      <span className="text-content-secondary">
        type:{' '}
        <span
          className={
            node.props.type === 'static' ? 'text-blue-600' : 'text-orange-600'
          }
        >
          {node.props.type}
        </span>
      </span>
      {node.props.type === 'dynamic' && (
        <span className="text-content-secondary">
          dataKey:{' '}
          <span className="text-content-primary">{node.props.dataKey}</span>
        </span>
      )}
      {resolvedValues && (
        <span className="text-content-secondary">
          values: [
          {resolvedValues.map((v, i) => (
            <span key={i}>
              {i > 0 && <span className="text-content-secondary">, </span>}
              <span
                className={
                  loopState && i === loopState.index
                    ? 'text-content-primary font-bold'
                    : 'text-content-secondary'
                }
              >
                {JSON.stringify(v, null, 2)}
              </span>
            </span>
          ))}
          ]
          {loopState && (
            <span>
              {' '}
              (idx:{' '}
              <span className="text-content-primary">{loopState.index}</span>)
            </span>
          )}
        </span>
      )}
    </div>
  );
}

type ActiveRole = 'leaf' | 'container' | null;

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

  const wrapperClass =
    role === 'leaf'
      ? 'ring-2 ring-background-inverted shadow-md'
      : role === 'container'
        ? 'ring-1 ring-background-inverted/30 border-dashed'
        : 'opacity-50';

  return (
    <div
      className={`text-xxs flex flex-col gap-1 rounded border p-2 font-mono transition-[box-shadow,opacity] duration-150 ${wrapperClass}`}
    >
      <div className="flex items-center gap-2">
        {role === 'leaf' && (
          <span className="bg-background-inverted h-2 w-2 shrink-0 rounded-full" />
        )}
        {role === 'container' && (
          <span className="border-content-primary h-2 w-2 shrink-0 rounded-full border" />
        )}
        <NodeTypeBadge type={node.type} />
        <span className="text-content-secondary truncate">{node.id}</span>
      </div>
      {node.type === 'loop' && <LoopDetail node={node} state={state} />}
      {connections.length > 0 && (
        <div className="flex flex-wrap gap-1 pl-4">
          {connections.map((c, i) => (
            <span key={i} className="text-content-secondary">
              <span className="text-content-secondary">{c.label}</span>{' '}
              <span className="text-content-primary">{c.toId}</span>
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
    return (
      <div className="text-xxs text-content-secondary p-2 font-mono">
        No experiment loaded.
      </div>
    );
  }

  const {
    experiment: { nodes, edges },
    state,
  } = step;
  const currentPath = getCurrentPath(state);
  const leafId = currentPath.at(-1) ?? null;

  function getRole(nodeId: string): ActiveRole {
    if (nodeId === leafId) return 'leaf';
    if (currentPath.includes(nodeId)) return 'container';
    return null;
  }

  return (
    <div className="my-5">
      <div className="text-xxs text-content-primary mb-2 w-full gap-1 font-mono tracking-wider uppercase">
        <div>Debug — {nodes.length} nodes</div>
        <div className="flex">
          <span>State - {state.type}</span>
          {currentPath.length > 0 && (
            <>
              <span>·</span>
              {currentPath.map((id, i) => (
                <span key={id} className="flex items-center gap-1">
                  {i > 0 && <span className="text-content-secondary">›</span>}
                  <span
                    className={
                      i === currentPath.length - 1
                        ? 'text-content-primary'
                        : 'text-content-secondary'
                    }
                  >
                    {id}
                  </span>
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

export function DataDebug() {
  const { step } = useExperimentStore();

  if (!step) {
    return (
      <div className="text-xxs text-content-secondary p-2 font-mono">
        No experiment loaded.
      </div>
    );
  }

  const { context, state } = step;
  const {
    data,
    branches,
    screenData,
    timings,
    forks,
    checkpoints,
    loops,
    start,
  } = context;

  const hasScreenData = screenData && Object.keys(screenData).length > 0;
  const hasData = data && Object.keys(data).length > 0;
  const hasBranches = branches && Object.keys(branches).length > 0;
  const hasForks = forks && Object.keys(forks).length > 0;
  const hasCheckpoints = checkpoints && Object.keys(checkpoints).length > 0;
  const hasLoops = loops && Object.keys(loops).length > 0;
  const hasStart = start && Object.keys(start).length > 0;
  const hasTimings = timings && Object.keys(timings).length > 0;
  const isEmpty =
    !hasData &&
    !hasBranches &&
    !hasForks &&
    !hasCheckpoints &&
    !hasLoops &&
    !hasStart &&
    !hasScreenData &&
    !hasTimings;

  if (isEmpty) {
    return (
      <div className="my-5">
        <div className="text-content-secondary mb-2 font-mono text-[9px] tracking-wider uppercase">
          Data
        </div>
        <div className="text-xxs text-content-secondary font-mono italic">
          No data collected yet.
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {hasStart && <DataSection title="start" data={start} />}
      {hasScreenData && <DataSection title="screen data" data={screenData} />}
      {hasData && <DataSection title="collected" data={data} />}
      {hasBranches && <DataSection title="branches taken" data={branches} />}
      {hasForks && <DataSection title="forks assigned" data={forks} />}
      {hasCheckpoints && <DataSection title="checkpoints" data={checkpoints} />}
      {hasLoops && <DataSection title="loops" data={loops} />}
      {hasTimings && <DataSection title="timings" data={timings} />}
      <DataSection title="current state" data={state} />
    </div>
  );
}
