'use client';
import '@xyflow/react/dist/style.css';
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  Panel,
  ReactFlow,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type Edge,
  type IsValidConnection,
  type Node,
  type OnNodeDrag,
  type OnNodesChange,
  type OnSelectionChangeParams,
  type XYPosition,
} from '@xyflow/react';
import type { Condition } from '@experiment-hub/engine/conditions';
import { validateExperiment } from '@experiment-hub/engine/experiment-validation';
import type { NodeType } from '@experiment-hub/engine/nodes';
import type { ExperimentFlow } from '@experiment-hub/engine/types';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import {
  createContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import LiveScreenPreview from './LiveScreenPreview';
import {
  clearPositions,
  loadPositions,
  removePositions,
  savePositions,
} from './positions';
import {
  addArm,
  addNode,
  canConnect,
  connect,
  deleteEdgeIds,
  deleteNodes,
  duplicateNodes,
  canParent,
  containerMembersOf,
  reconnect,
  removeArm,
  reorderMember,
  setNodeName,
  setParent,
  setComputations,
  setDataMap,
  setScreenSlug,
  updateArm,
} from './mutations';
import ConditionEditor from './ConditionEditor';
import ComputeEditor from './ComputeEditor';
import DataEditor from './DataEditor';
import { refSuggestions } from './ref-suggestions';
import {
  CONTAINER_COLORS,
  CONTAINER_PAD,
  layoutFlow,
  toFlowGraph,
  type ContainerNodeData,
  type EditorEdge,
  type EditorNode,
} from './adapter';
import ContainerNode from './ContainerNode';
import FlowEdge from './FlowEdge';
import FlowNode from './FlowNode';
import {
  DEFAULT_VIEW_OPTIONS,
  ViewOptionsContext,
  type ViewOptions,
} from './view-options';

const NODE_TYPES: NodeType[] = [
  'start',
  'screen',
  'branch',
  'fork',
  'path',
  'loop',
  'checkpoint',
  'compute',
  'data',
  'end',
];

const nodeTypes = {
  ...Object.fromEntries(NODE_TYPES.map((t) => [t, FlowNode])),
  container: ContainerNode,
};

const edgeTypes = { pill: FlowEdge };

const TYPE_COLORS: Record<NodeType, string> = {
  start: '#64748b',
  screen: '#60a6bc',
  branch: '#8b5cf6',
  fork: '#f97316',
  path: '#14b8a6',
  loop: '#ec4899',
  checkpoint: '#0cc084',
  compute: '#f59e0b',
  data: '#0ea5e9',
  end: '#64748b',
};

const minimapColor = (node: EditorNode) =>
  node.type === 'container'
    ? CONTAINER_COLORS[(node.data as ContainerNodeData).kind]
    : TYPE_COLORS[node.type as NodeType];

/** Which container id is a live drop target (for frame highlighting). */
export const DropTargetContext = createContext<string | null>(null);

/** Absolute canvas position of a node, walking its parentId chain. */
const nodeAbs = (n: Node, byId: Map<string, Node>): XYPosition => {
  let { x, y } = n.position;
  for (let p = n.parentId; p; ) {
    const par = byId.get(p);
    if (!par) break;
    x += par.position.x;
    y += par.position.y;
    p = par.parentId;
  }
  return { x, y };
};

const nodeCenter = (n: Node, byId: Map<string, Node>): XYPosition => {
  const a = nodeAbs(n, byId);
  const w = n.measured?.width ?? n.width ?? 240;
  const h = n.measured?.height ?? n.height ?? 90;
  return { x: a.x + w / 2, y: a.y + h / 2 };
};

const containerRect = (
  c: Node,
  byId: Map<string, Node>,
): { x: number; y: number; w: number; h: number } => {
  const p = nodeAbs(c, byId);
  return {
    x: p.x,
    y: p.y,
    // measured = rendered DOM size (the card can be wider than layout);
    // style = the layout/grown size. Prefer measured for hit-testing.
    w: c.measured?.width ?? Number(c.style?.width ?? 0),
    h: c.measured?.height ?? Number(c.style?.height ?? 0),
  };
};

type Rect = { x: number; y: number; w: number; h: number };

const rectsOverlap = (a: Rect, b: Rect) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

const nodeRect = (n: Node, byId: Map<string, Node>): Rect => ({
  ...nodeAbs(n, byId),
  w: n.measured?.width ?? n.width ?? 240,
  h: n.measured?.height ?? n.height ?? 90,
});

/** Deepest container the rect overlaps (excluding `skipId`). Dropping a node
 *  so it touches the frame joins it — center-inside was too strict: a tall
 *  node dropped on a shallow frame lands center-outside and silently misses. */
const deepestHit = (
  nodes: Node[],
  byId: Map<string, Node>,
  rect: Rect,
  skipId: string,
): Node | null => {
  const depth = (c: Node): number => {
    let d = 0;
    for (let p = c.parentId; p; ) {
      d++;
      p = byId.get(p)?.parentId;
    }
    return d;
  };
  return (
    nodes
      .filter(
        (n) =>
          n.type === 'container' &&
          n.id !== skipId &&
          rectsOverlap(rect, containerRect(n, byId)),
      )
      .sort((a, b) => depth(b) - depth(a))[0] ?? null
  );
};

/** Re-runs dagre (clears saved manual positions) then refits the view. */
function TidyButton({ onTidy }: { onTidy: () => void }) {
  const rf = useReactFlow();
  return (
    <button
      type="button"
      onClick={() => {
        onTidy();
        // fitView after the relayout lands in state
        setTimeout(() => rf.fitView({ duration: 200 }), 60);
      }}
      className="text-content-secondary border-border-default hover:bg-content-primary/5 hover:text-content-primary mt-0.5 cursor-pointer rounded-md border px-2 py-1 text-left text-xxs"
    >
      Tidy layout
    </button>
  );
}

/** "+ Node" menu — adds a node at the viewport center. */
function AddNodeMenu({ onAdd }: { onAdd: (type: NodeType) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="text-content-secondary border-border-default hover:bg-content-primary/5 hover:text-content-primary cursor-pointer rounded-md border px-2 py-1 text-left text-xxs"
      >
        + node
      </button>
      {open && (
        <div className="bg-background-surface border-border-default absolute top-full left-0 z-10 mt-1 flex max-h-64 w-32 flex-col overflow-y-auto rounded-lg border shadow-md">
          {NODE_TYPES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => {
                onAdd(t);
                setOpen(false);
              }}
              className="text-content-primary hover:bg-content-primary/5 cursor-pointer px-2.5 py-1 text-left text-xs capitalize"
            >
              {t}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function FlowCanvas({
  slug,
  experiment,
}: {
  slug: string;
  experiment: ExperimentFlow;
}) {
  // Draft flow — the canvas edits this copy, never the fetched config.
  const [draft, setDraft] = useState(experiment);
  const past = useRef<ExperimentFlow[]>([]);
  const future = useRef<ExperimentFlow[]>([]);
  const [depth, setDepth] = useState({ undo: 0, redo: 0 });
  const [dirty, setDirty] = useState(false);
  const [publish, setPublish] = useState<{
    status: 'idle' | 'saving' | 'ok' | 'error';
    msg?: string;
  }>({ status: 'idle' });
  const syncDepth = () =>
    setDepth({ undo: past.current.length, redo: future.current.length });

  const mutate = (fn: (f: ExperimentFlow) => ExperimentFlow) => {
    setDraft((prev) => {
      const next = fn(prev);
      if (next === prev) return prev;
      past.current.push(prev);
      future.current = [];
      return next;
    });
    syncDepth();
    setDirty(true);
  };

  const undo = () => {
    setDraft((prev) => {
      const p = past.current.pop();
      if (!p) return prev;
      future.current.push(prev);
      return p;
    });
    syncDepth();
  };

  const redo = () => {
    setDraft((prev) => {
      const f = future.current.pop();
      if (!f) return prev;
      past.current.push(prev);
      return f;
    });
    syncDepth();
  };

  const router = useRouter();
  const [nodes, setNodes, onNodesChange] = useNodesState<EditorNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<EditorEdge>([]);
  const [view, setView] = useState<ViewOptions>(DEFAULT_VIEW_OPTIONS);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [inspectorTab, setInspectorTab] = useState<'raw' | 'live'>('raw');
  const [layoutVersion, setLayoutVersion] = useState(0);
  const { resolvedTheme } = useTheme();

  const toggle = (key: keyof ViewOptions) =>
    setView((v) => ({ ...v, [key]: !v[key] }));

  const graph = useMemo(() => {
    const g = toFlowGraph(draft);
    const laid = layoutFlow(g.nodes, g.edges);
    const saved = loadPositions(slug);
    return {
      ...g,
      nodes: laid.map((n) =>
        saved[n.id] ? { ...n, position: saved[n.id] } : n,
      ),
    };
  }, [draft, slug, layoutVersion]); // layoutVersion: "Tidy" re-runs layout

  const issues = useMemo(() => validateExperiment(draft), [draft]);
  const refs = useMemo(() => refSuggestions(draft), [draft]);
  const loopIds = useMemo(
    () => draft.nodes.filter((n) => n.type === 'loop').map((n) => n.id),
    [draft],
  );
  const screenSlugs = useMemo(
    () => (draft.screens ?? []).map((s) => s.slug),
    [draft],
  );

  // Live positions — updated on every position change so draft edits rebuild
  // nodes without losing where the user put things.
  const posRef = useRef<Record<string, XYPosition>>({});
  const selRef = useRef<Set<string>>(new Set());
  const clipboard = useRef<string[]>([]);

  /** Grow/shrink container styles so members are always covered with padding.
   *  Floors at the dagre layout size; only runs on drop/rebuild — fitting
   *  during the drag would chase the dragged member and make the escape
   *  gesture unreachable. A member whose center sits within ESCAPE_MARGIN of
   *  the border still counts (dropped colliding → frame covers it); beyond
   *  that it's treated as escaping. */
  const ESCAPE_MARGIN = 12;
  const fitFrames = (list: EditorNode[]): EditorNode[] =>
    list.map((n) => {
      if (n.type !== 'container') return n;
      const base = (n.data as ContainerNodeData).layoutSize;
      const minW = Number(base?.width ?? n.style?.width ?? 0);
      const minH = Number(base?.height ?? n.style?.height ?? 0);
      const curW = Number(n.style?.width ?? minW);
      const curH = Number(n.style?.height ?? minH);
      const kids = list.filter((k) => {
        if (k.parentId !== n.id) return false;
        const kw = k.measured?.width ?? k.width ?? 240;
        const kh = k.measured?.height ?? k.height ?? 90;
        const cx = k.position.x + kw / 2;
        const cy = k.position.y + kh / 2;
        return (
          cx >= -ESCAPE_MARGIN &&
          cx <= curW + ESCAPE_MARGIN &&
          cy >= -ESCAPE_MARGIN &&
          cy <= curH + ESCAPE_MARGIN
        );
      });
      const maxX = Math.max(
        ...kids.map(
          (k) => k.position.x + (k.measured?.width ?? k.width ?? 240),
        ),
        0,
      );
      const maxY = Math.max(
        ...kids.map(
          (k) => k.position.y + (k.measured?.height ?? k.height ?? 90),
        ),
        0,
      );
      const w = Math.max(minW, maxX + CONTAINER_PAD);
      const h = Math.max(minH, maxY + CONTAINER_PAD);
      return w === curW && h === curH
        ? n
        : { ...n, style: { ...n.style, width: w, height: h } };
    });

  const handleNodesChange: OnNodesChange<EditorNode> = (changes) => {
    for (const c of changes)
      if (c.type === 'position' && c.position) posRef.current[c.id] = c.position;
    onNodesChange(changes);
  };

  // Rebuild nodes only when the graph changes (draft edits, layout re-runs).
  // Positions come from posRef (authoritative in-session) → saved → dagre.
  useEffect(() => {
    setNodes(
      fitFrames(
        graph.nodes.map((n) => ({
          ...n,
          position: posRef.current[n.id] ?? n.position,
          selected: selRef.current.has(n.id) || undefined,
        })),
      ),
    );
  }, [graph, setNodes]);

  useEffect(() => {
    setEdges(view.dataFlow ? [...graph.edges, ...graph.dataEdges] : graph.edges);
  }, [graph, view.dataFlow, setEdges]);

  // ── Edit callbacks ─────────────────────────────────────────────────────────

  // While an edge endpoint is being reconnected, validate against the draft
  // *without* that edge — otherwise max-1 outputs stay occupied by the edge
  // the user is trying to move.
  const reconnecting = useRef<string | null>(null);
  const onReconnectStart = (_e: unknown, edge: Edge) => {
    reconnecting.current = edge.id;
  };
  const onReconnectEnd = () => {
    reconnecting.current = null;
  };

  const isValidConnection: IsValidConnection = (conn) => {
    const base = reconnecting.current
      ? deleteEdgeIds(draft, [reconnecting.current])
      : draft;
    return !!(
      conn.source &&
      conn.target &&
      conn.sourceHandle &&
      conn.targetHandle &&
      canConnect(base, {
        source: conn.source,
        sourceHandle: conn.sourceHandle,
        target: conn.target,
      })
    );
  };

  const onConnect = (conn: Connection) => {
    const { source, target, sourceHandle } = conn;
    if (!source || !target || !sourceHandle || !conn.targetHandle) return;
    mutate((f) => connect(f, { source, sourceHandle, target }));
  };

  const onReconnect = (oldEdge: Edge, conn: Connection) => {
    const { source, target, sourceHandle } = conn;
    if (!source || !target || !sourceHandle || !conn.targetHandle) return;
    mutate((f) => reconnect(f, oldEdge.id, { source, sourceHandle, target }));
  };

  const onNodesDelete = (deleted: Node[]) => {
    if (deleted.length) mutate((f) => deleteNodes(f, deleted.map((n) => n.id)));
  };

  const onEdgesDelete = (deleted: Edge[]) => {
    if (deleted.length) mutate((f) => deleteEdgeIds(f, deleted.map((e) => e.id)));
  };

  // Live drop-target highlight while dragging over a container.
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);

  const onNodeDrag: OnNodeDrag = (_e, node) => {
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const hit = deepestHit(nodes, byId, nodeRect(node, byId), node.id);
    setDropTargetId(
      hit && hit.id !== node.parentId && canParent(draft, node.id, hit.id)
        ? hit.id
        : null,
    );
  };

  const onNodeDragStop: OnNodeDrag = (_e, node) => {
    setDropTargetId(null);
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const dragged = byId.get(node.id);
    if (!dragged) return;

    const center = nodeCenter(node, byId);
    const target = deepestHit(nodes, byId, nodeRect(node, byId), node.id);
    const currentParent = dragged.parentId;
    const MARGIN = ESCAPE_MARGIN;

    // Drop into a container that can take it → member; inner dagre seats it.
    if (
      target &&
      target.id !== currentParent &&
      canParent(draft, node.id, target.id)
    ) {
      delete posRef.current[node.id];
      removePositions(slug, [node.id]);
      mutate((f) => setParent(f, node.id, target.id));
      return;
    }

    // Member dragged clearly out of its parent frame → unparent, keep the
    // drop position in absolute coords.
    if (currentParent) {
      const par = byId.get(currentParent);
      if (par) {
        const r = containerRect(par, byId);
        const escaped =
          center.x < r.x - MARGIN ||
          center.x > r.x + r.w + MARGIN ||
          center.y < r.y - MARGIN ||
          center.y > r.y + r.h + MARGIN;
        if (escaped) {
          posRef.current[node.id] = nodeAbs(node, byId);
          savePositions(slug, posRef.current);
          mutate((f) => setParent(f, node.id, null));
          return;
        }
      }
    }

    // Member dropped inside its own frame (reaching here means it didn't
    // escape) — check for a reorder: if its center-x now sorts it among
    // siblings differently than the declared order, rewrite `path-contains`
    // orders and let the layout reseat them.
    if (currentParent) {
      const sibs = nodes.filter((n) => n.parentId === currentParent);
      if (sibs.length > 1) {
        const byX = sibs
          .map((s) => ({
            id: s.id,
            cx:
              nodeAbs(s, byId).x +
              (s.measured?.width ?? s.width ?? 240) / 2,
          }))
          .sort((a, b) => a.cx - b.cx);
        const newIndex = byX.findIndex((s) => s.id === node.id);
        const curIndex = containerMembersOf(draft, currentParent).indexOf(
          node.id,
        );
        if (newIndex >= 0 && newIndex !== curIndex) {
          // Clear member positions so the inner layout reseats in new order.
          for (const s of sibs) delete posRef.current[s.id];
          removePositions(
            slug,
            sibs.map((s) => s.id),
          );
          mutate((f) => reorderMember(f, currentParent, node.id, newIndex));
          return;
        }
      }
    }

    // Plain move — refit frames so a member dropped near the border gets
    // covered (and an inward move shrinks the frame back to fit).
    posRef.current[node.id] = node.position;
    savePositions(slug, posRef.current);
    setNodes((prev) => fitFrames(prev));
  };

  const tidy = () => {
    clearPositions(slug);
    posRef.current = {};
    setLayoutVersion((v) => v + 1);
  };

  // ── Selection / inspector ──────────────────────────────────────────────────

  const raw = useMemo(() => {
    if (!selectedId) return null;
    const node = draft.nodes.find((n) => n.id === selectedId);
    if (!node) return null;
    const screen =
      node.type === 'screen'
        ? draft.screens?.find((s) => s.slug === node.props.slug)
        : undefined;
    const touching = draft.edges.filter(
      (e) => e.from.split('.')[0] === node.id || e.to === node.id,
    );
    return { node, screen, edges: touching };
  }, [selectedId, draft]);

  const onSelectionChange = ({ nodes: sel }: OnSelectionChangeParams) => {
    selRef.current = new Set(sel.map((n) => n.id));
    const id = sel[0]?.id ?? null;
    setSelectedId(id);
    const node = id ? draft.nodes.find((n) => n.id === id) : null;
    setInspectorTab(node?.type === 'screen' ? 'live' : 'raw');
  };

  // Double-click a screen node → drill into its screen editor.
  const onNodeDoubleClick = (_: unknown, node: { id: string }) => {
    const n = draft.nodes.find((x) => x.id === node.id);
    if (n?.type === 'screen')
      router.push(`/screens/${slug}/${n.props.slug}`);
  };

  // ── Keyboard: undo/redo + copy/paste ───────────────────────────────────────

  const copy = () => {
    const ids = [...selRef.current];
    if (ids.length) clipboard.current = ids;
  };

  const paste = () => {
    if (!clipboard.current.length) return;
    const { flow: next, ids: newIds, map } = duplicateNodes(
      draft,
      clipboard.current,
    );
    // Children copy their relative position; top-level copies offset so the
    // paste reads as a new cluster.
    for (const [oldId, newId] of map) {
      const old = nodes.find((n) => n.id === oldId);
      const oldPos = posRef.current[oldId] ?? old?.position;
      if (!oldPos) continue;
      const d = old?.parentId ? 0 : 72;
      posRef.current[newId] = { x: oldPos.x + d, y: oldPos.y + d };
    }
    selRef.current = new Set(newIds);
    setSelectedId(newIds[0] ?? null);
    mutate(() => next);
    savePositions(slug, posRef.current);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'Escape') {
        selRef.current = new Set();
        setSelectedId(null);
        setNodes((prev) =>
          prev.map((n) => (n.selected ? { ...n, selected: false } : n)),
        );
        return;
      }
      if (!(e.metaKey || e.ctrlKey)) return;
      const k = e.key.toLowerCase();
      if (k === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      }
      if (k === 'c') copy();
      if (k === 'v') paste();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const errors = issues.filter((i) => i.severity !== 'warning');
  const warnings = issues.filter((i) => i.severity === 'warning');

  const toggles: { key: keyof ViewOptions; label: string; hint?: string }[] = [
    { key: 'dataFlow', label: 'Data flow', hint: `${graph.dataEdges.length}` },
    { key: 'fields', label: 'Fields' },
    { key: 'preview', label: 'Screen preview' },
    { key: 'labels', label: 'Edge labels' },
    { key: 'details', label: 'Prop details' },
  ];

  const downloadJson = () => {
    const blob = new Blob([JSON.stringify(draft, null, 2)], {
      type: 'application/json',
    });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${slug}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const onPublish = async () => {
    setPublish({ status: 'saving' });
    try {
      const res = await fetch(`/publish/${slug}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(draft),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setDirty(false);
        setPublish({
          status: 'ok',
          msg: `published ${String(data.version ?? '').slice(0, 12)}`,
        });
      } else {
        setPublish({
          status: 'error',
          msg:
            data.error ??
            data.message ??
            JSON.stringify(data).slice(0, 120) ??
            `HTTP ${res.status}`,
        });
      }
    } catch {
      setPublish({ status: 'error', msg: 'publish request failed' });
    }
  };

  const selected = raw?.node;
  const selectedHasName =
    selected && 'props' in selected && 'name' in (selected.props ?? {});
  const memberIdsOfSelected =
    selected && (selected.type === 'path' || selected.type === 'loop')
      ? containerMembersOf(draft, selected.id)
      : [];
  const memberLabel = (id: string) => {
    const m = draft.nodes.find((n) => n.id === id);
    return m && 'props' in m && m.props && 'name' in m.props
      ? (m.props.name as string)
      : id;
  };
  const moveMember = (nodeId: string, index: number) => {
    if (selected) mutate((f) => reorderMember(f, selected.id, nodeId, index));
  };

  return (
    <div className="border-border-default bg-background h-[75vh] w-full overflow-hidden rounded-xl border">
      <ViewOptionsContext.Provider value={view}>
        <DropTargetContext.Provider value={dropTargetId}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={handleNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView
          minZoom={0.2}
          isValidConnection={isValidConnection}
          onConnect={onConnect}
          onReconnect={onReconnect}
          onReconnectStart={onReconnectStart}
          onReconnectEnd={onReconnectEnd}
          reconnectRadius={20}
          onNodesDelete={onNodesDelete}
          onEdgesDelete={onEdgesDelete}
          deleteKeyCode={['Backspace', 'Delete']}
          multiSelectionKeyCode={['Shift', 'Meta', 'Control']}
          selectionKeyCode="Shift"
          onNodeDrag={onNodeDrag}
          onNodeDragStop={onNodeDragStop}
          onSelectionChange={onSelectionChange}
          onNodeDoubleClick={onNodeDoubleClick}
          colorMode={resolvedTheme === 'dark' ? 'dark' : 'light'}
        >
          <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
          <Controls showInteractive={false} />
          <MiniMap
            nodeColor={minimapColor}
            pannable
            zoomable
            className="!bg-background-surface"
          />

          <Panel position="top-left">
            <div className="bg-background-surface border-border-default flex flex-col gap-1 rounded-lg border p-2.5 shadow-sm">
              {toggles.map(({ key, label, hint }) => (
                <label
                  key={key}
                  className="text-content-primary flex cursor-pointer items-center gap-2 text-xs"
                >
                  <input
                    type="checkbox"
                    checked={view[key]}
                    onChange={() => toggle(key)}
                    className="accent-[#a78bfa]"
                  />
                  {label}
                  {hint && (
                    <span className="text-content-secondary font-mono text-xxs">
                      {hint}
                    </span>
                  )}
                </label>
              ))}
              <div className="border-border-default mt-1 flex flex-col gap-1 border-t pt-1.5">
                <AddNodeMenu
                  onAdd={(type) => {
                    const { flow, id } = addNode(draft, type);
                    mutate(() => flow);
                    setSelectedId(id);
                  }}
                />
                <TidyButton onTidy={tidy} />
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={undo}
                    disabled={!depth.undo}
                    className="text-content-secondary border-border-default hover:bg-content-primary/5 hover:text-content-primary flex-1 cursor-pointer rounded-md border px-2 py-1 text-xxs disabled:opacity-40"
                  >
                    Undo
                  </button>
                  <button
                    type="button"
                    onClick={redo}
                    disabled={!depth.redo}
                    className="text-content-secondary border-border-default hover:bg-content-primary/5 hover:text-content-primary flex-1 cursor-pointer rounded-md border px-2 py-1 text-xxs disabled:opacity-40"
                  >
                    Redo
                  </button>
                </div>
                <button
                  type="button"
                  onClick={downloadJson}
                  className="text-content-secondary border-border-default hover:bg-content-primary/5 hover:text-content-primary cursor-pointer rounded-md border px-2 py-1 text-left text-xxs"
                >
                  Download JSON
                </button>
                <button
                  type="button"
                  onClick={onPublish}
                  disabled={publish.status === 'saving'}
                  className="text-primary border-border-default hover:bg-primary/10 cursor-pointer rounded-md border px-2 py-1 text-left text-xxs font-medium disabled:opacity-50"
                >
                  {publish.status === 'saving'
                    ? 'Publishing…'
                    : dirty
                      ? 'Publish ●'
                      : 'Publish'}
                </button>
                {publish.msg && (
                  <span
                    className={`font-mono text-xxs leading-snug ${
                      publish.status === 'error'
                        ? 'text-error'
                        : 'text-content-secondary'
                    }`}
                  >
                    {publish.msg}
                  </span>
                )}
              </div>
              <p className="text-content-secondary border-border-default mt-1 border-t pt-1.5 text-xxs">
                Click a node to inspect
                <br />
                ⇧ multi-select · ⌘Z undo · ⌘C/V copy/paste
              </p>
            </div>
          </Panel>

          {(raw || issues.length > 0) && (
            <Panel
              position="top-right"
              className="flex w-96 max-w-96 flex-col gap-2"
            >
              {raw && selected && (
                <div className="bg-background-surface border-border-default overflow-hidden rounded-lg border shadow-sm">
                  <div className="border-border-default flex items-center justify-between gap-2 border-b px-3 py-1.5">
                    <span className="text-content-primary min-w-0 truncate font-mono text-xs font-semibold">
                      {selected.id}
                    </span>
                    <div className="flex shrink-0 items-center gap-1">
                      {raw.screen && (
                        <div className="border-border-default mr-1 flex overflow-hidden rounded-md border text-xxs">
                          {(['live', 'raw'] as const).map((t) => (
                            <button
                              key={t}
                              type="button"
                              onClick={() => setInspectorTab(t)}
                              className={`cursor-pointer px-2 py-0.5 ${
                                inspectorTab === t
                                  ? 'bg-content-primary/10 text-content-primary font-medium'
                                  : 'text-content-secondary'
                              }`}
                            >
                              {t}
                            </button>
                          ))}
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => setSelectedId(null)}
                        className="text-content-secondary hover:text-content-primary cursor-pointer text-xs"
                        aria-label="Close inspector"
                      >
                        ✕
                      </button>
                    </div>
                  </div>

                  {/* ── edit affordances ── */}
                  <div className="border-border-default flex flex-col gap-1.5 border-b px-3 py-2">
                    {selectedHasName && (
                      <label className="flex items-center gap-2 text-xxs">
                        <span className="text-content-secondary w-12 shrink-0">
                          name
                        </span>
                        <input
                          key={(selected.props as { name: string }).name}
                          className="border-border-default bg-background text-content-primary min-w-0 flex-1 rounded border px-1.5 py-0.5 font-mono"
                          defaultValue={(selected.props as { name: string }).name}
                          onBlur={(e) =>
                            mutate((d) =>
                              setNodeName(d, selected.id, e.target.value),
                            )
                          }
                        />
                      </label>
                    )}
                    {selected.type === 'screen' && (
                      <label className="flex items-center gap-2 text-xxs">
                        <span className="text-content-secondary w-12 shrink-0">
                          screen
                        </span>
                        <select
                          className="border-border-default bg-background text-content-primary min-w-0 flex-1 rounded border px-1.5 py-0.5 font-mono"
                          value={selected.props.slug}
                          onChange={(e) =>
                            setDraft((d) =>
                              setScreenSlug(d, selected.id, e.target.value),
                            )
                          }
                        >
                          {(draft.screens ?? []).map((s) => (
                            <option key={s.slug} value={s.slug}>
                              {s.slug}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                    {(selected.type === 'branch' ||
                      selected.type === 'fork') && (
                      <div className="flex flex-col gap-1.5 text-xxs">
                        <div className="flex items-center gap-2">
                          <span className="text-content-secondary w-12 shrink-0">
                            arms
                          </span>
                          <button
                            type="button"
                            onClick={() => mutate((f) => addArm(f, selected.id))}
                            className="border-border-default text-content-secondary hover:text-content-primary cursor-pointer rounded-full border border-dashed px-1.5 py-px"
                          >
                            + arm
                          </button>
                        </div>
                        <div className="flex max-h-72 flex-col gap-1.5 overflow-auto">
                          {(
                            (selected.type === 'branch'
                              ? selected.props.branches
                              : selected.props.forks) as {
                              id: string;
                              name: string;
                              weight?: number;
                              config?: Condition;
                            }[]
                          ).map((arm) => (
                            <div
                              key={arm.id}
                              className="border-border-default bg-background flex flex-col gap-1 rounded-md border p-1.5"
                            >
                              <div className="flex items-center gap-1">
                                <input
                                  key={arm.name}
                                  className="border-border-default bg-background-surface text-content-primary min-w-0 flex-1 rounded border px-1.5 py-0.5 font-mono text-xxs"
                                  defaultValue={arm.name}
                                  onBlur={(e) =>
                                    mutate((f) =>
                                      updateArm(f, selected.id, arm.id, {
                                        name: e.target.value,
                                      }),
                                    )
                                  }
                                  aria-label={`Arm ${arm.id} name`}
                                />
                                {selected.type === 'fork' && (
                                  <input
                                    key={arm.weight ?? 'w'}
                                    type="number"
                                    className="border-border-default bg-background-surface text-content-primary w-14 rounded border px-1.5 py-0.5 font-mono text-xxs"
                                    defaultValue={arm.weight ?? ''}
                                    placeholder="weight"
                                    onBlur={(e) =>
                                      mutate((f) =>
                                        updateArm(f, selected.id, arm.id, {
                                          weight:
                                            e.target.value === ''
                                              ? undefined
                                              : Number(e.target.value),
                                        }),
                                      )
                                    }
                                    aria-label={`Arm ${arm.id} weight`}
                                  />
                                )}
                                <button
                                  type="button"
                                  aria-label={`Remove arm ${arm.name}`}
                                  onClick={() =>
                                    mutate((f) =>
                                      removeArm(f, selected.id, arm.id),
                                    )
                                  }
                                  className="text-content-secondary hover:text-error cursor-pointer text-xs"
                                >
                                  ×
                                </button>
                              </div>
                              {selected.type === 'branch' && arm.config && (
                                <ConditionEditor
                                  condition={arm.config}
                                  refs={refs}
                                  onChange={(c) =>
                                    mutate((f) =>
                                      updateArm(f, selected.id, arm.id, {
                                        config: c,
                                      }),
                                    )
                                  }
                                />
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {(selected.type === 'path' ||
                      selected.type === 'loop') && (
                      <div className="flex flex-col gap-1.5 text-xxs">
                        <span className="text-content-secondary">
                          {selected.type === 'loop' ? 'template' : 'steps'}
                        </span>
                        {memberIdsOfSelected.length === 0 && (
                          <span className="text-content-secondary">
                            drop nodes onto the frame
                          </span>
                        )}
                        {memberIdsOfSelected.map((id, i) => (
                          <div key={id} className="flex items-center gap-1.5">
                            <span className="text-content-secondary w-4 shrink-0 font-mono">
                              {i + 1}.
                            </span>
                            <span className="text-content-primary min-w-0 flex-1 wrap-anywhere font-mono">
                              {memberLabel(id)}
                            </span>
                            {selected.type === 'path' && (
                              <>
                                <button
                                  type="button"
                                  aria-label={`Move ${id} up`}
                                  disabled={i === 0}
                                  onClick={() => moveMember(id, i - 1)}
                                  className="text-content-secondary hover:text-content-primary cursor-pointer disabled:opacity-30"
                                >
                                  ↑
                                </button>
                                <button
                                  type="button"
                                  aria-label={`Move ${id} down`}
                                  disabled={
                                    i === memberIdsOfSelected.length - 1
                                  }
                                  onClick={() => moveMember(id, i + 1)}
                                  className="text-content-secondary hover:text-content-primary cursor-pointer disabled:opacity-30"
                                >
                                  ↓
                                </button>
                              </>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    {selected.type === 'compute' && (
                      <div className="flex flex-col gap-1.5 text-xxs">
                        <span className="text-content-secondary">
                          computations
                        </span>
                        <ComputeEditor
                          computations={selected.props.computations}
                          refs={refs}
                          loopIds={loopIds}
                          screenSlugs={screenSlugs}
                          onChange={(computations) =>
                            mutate((f) =>
                              setComputations(f, selected.id, computations),
                            )
                          }
                        />
                      </div>
                    )}
                    {selected.type === 'data' && (
                      <div className="flex flex-col gap-1.5 text-xxs">
                        <span className="text-content-secondary">data</span>
                        <DataEditor
                          data={selected.props.data}
                          onChange={(data) =>
                            mutate((f) => setDataMap(f, selected.id, data))
                          }
                        />
                      </div>
                    )}
                  </div>

                  {inspectorTab === 'live' && raw.screen ? (
                    <div className="max-h-[70vh] overflow-auto p-3">
                      <LiveScreenPreview flow={draft} screen={raw.screen} />
                    </div>
                  ) : (
                    <div className="max-h-96 overflow-auto p-3">
                      <pre className="text-content-primary font-mono text-xxs leading-relaxed whitespace-pre-wrap">
                        {JSON.stringify(
                          {
                            id: selected.id,
                            type: selected.type,
                            props:
                              'props' in selected ? selected.props : undefined,
                          },
                          null,
                          2,
                        )}
                      </pre>
                      {raw.screen && (
                        <>
                          <p className="text-content-secondary border-border-default mt-2 border-t pt-2 font-mono text-xxs">
                            screen — {raw.screen.slug}
                          </p>
                          <pre className="text-content-primary font-mono text-xxs leading-relaxed whitespace-pre-wrap">
                            {JSON.stringify(raw.screen.components, null, 2)}
                          </pre>
                        </>
                      )}
                      {raw.edges.length > 0 && (
                        <>
                          <p className="text-content-secondary border-border-default mt-2 border-t pt-2 font-mono text-xxs">
                            edges
                          </p>
                          <pre className="text-content-primary font-mono text-xxs leading-relaxed whitespace-pre-wrap">
                            {JSON.stringify(raw.edges, null, 2)}
                          </pre>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}

              {issues.length > 0 && (
                <details className="bg-background-surface border-border-default rounded-lg border p-3 shadow-sm">
                  <summary className="text-content-primary cursor-pointer text-xs font-semibold">
                    {errors.length} errors · {warnings.length} warnings
                  </summary>
                  <ul className="mt-2 flex max-h-64 flex-col gap-1 overflow-auto">
                    {issues.map((issue, i) => (
                      <li key={i} className="text-xxs leading-snug">
                        <span
                          className={
                            issue.severity === 'warning'
                              ? 'text-warning'
                              : 'text-error'
                          }
                        >
                          [{issue.code}]
                        </span>{' '}
                        <span className="text-content-secondary">
                          {issue.message}
                        </span>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </Panel>
          )}
        </ReactFlow>
        </DropTargetContext.Provider>
      </ViewOptionsContext.Provider>
    </div>
  );
}
