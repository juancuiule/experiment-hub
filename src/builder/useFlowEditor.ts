'use client';

import { FrameworkScreen } from '@/lib/screen';
import { ExperimentFlow } from '@/lib/types';
import { FrameworkNode, NodeType } from '@/lib/nodes';
import { ScreenComponent } from '@/lib/components';
import { useCallback, useMemo, useState } from 'react';
import { makeNode } from './node-meta';

/** Structured-clone the source flow so edits never touch the real EXPERIMENTS. */
function clone(flow: ExperimentFlow): ExperimentFlow {
  return typeof structuredClone === 'function'
    ? structuredClone(flow)
    : JSON.parse(JSON.stringify(flow));
}

export interface FlowEditor {
  flow: ExperimentFlow;
  selectedId: string | null;
  selectedNode: FrameworkNode | undefined;
  isDirty: boolean;
  select: (id: string | null) => void;
  addNode: (type: NodeType) => void;
  deleteNode: (id: string) => void;
  /** Replace a node by id with the produced value. */
  updateNode: (id: string, next: FrameworkNode) => void;
  /** Replace the screen with the given slug (or insert it if missing). */
  updateScreen: (slug: string, components: ScreenComponent[]) => void;
  reset: () => void;
}

export function useFlowEditor(source: ExperimentFlow): FlowEditor {
  const [flow, setFlow] = useState<ExperimentFlow>(() => clone(source));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dirtyCount, setDirtyCount] = useState(0);
  const bump = () => setDirtyCount((c) => c + 1);

  const select = useCallback((id: string | null) => setSelectedId(id), []);

  const addNode = useCallback(
    (type: NodeType) => {
      const node = makeNode(type);
      setFlow((prev) => {
        const next = clone(prev);
        next.nodes = [...next.nodes, node];
        // Wire a sequential edge from the current selection, if any.
        if (selectedId) {
          next.edges = [
            ...next.edges,
            { type: 'sequential', from: selectedId, to: node.id },
          ];
        }
        // A new screen node gets an empty screen to edit.
        if (node.type === 'screen') {
          const screens = next.screens ?? [];
          next.screens = [
            ...screens,
            { slug: node.props.slug, components: [] },
          ];
        }
        return next;
      });
      setSelectedId(node.id);
      bump();
    },
    [selectedId],
  );

  const deleteNode = useCallback(
    (id: string) => {
      setFlow((prev) => {
        const next = clone(prev);
        const removed = next.nodes.find((n) => n.id === id);
        next.nodes = next.nodes.filter((n) => n.id !== id);
        next.edges = next.edges.filter(
          (e) => e.from.split('.')[0] !== id && e.to.split('.')[0] !== id,
        );
        if (removed?.type === 'screen' && next.screens) {
          next.screens = next.screens.filter(
            (s) => s.slug !== removed.props.slug,
          );
        }
        return next;
      });
      setSelectedId((cur) => (cur === id ? null : cur));
      bump();
    },
    [],
  );

  const updateNode = useCallback((id: string, nextNode: FrameworkNode) => {
    setFlow((prev) => {
      const next = clone(prev);
      next.nodes = next.nodes.map((n) => (n.id === id ? nextNode : n));
      return next;
    });
    bump();
  }, []);

  const updateScreen = useCallback(
    (slug: string, components: ScreenComponent[]) => {
      setFlow((prev) => {
        const next = clone(prev);
        const screens: FrameworkScreen[] = next.screens
          ? [...next.screens]
          : [];
        const idx = screens.findIndex((s) => s.slug === slug);
        if (idx === -1) screens.push({ slug, components });
        else screens[idx] = { slug, components };
        next.screens = screens;
        return next;
      });
      bump();
    },
    [],
  );

  const reset = useCallback(() => {
    setFlow(clone(source));
    setSelectedId(null);
    setDirtyCount(0);
  }, [source]);

  const selectedNode = useMemo(
    () => flow.nodes.find((n) => n.id === selectedId),
    [flow.nodes, selectedId],
  );

  return {
    flow,
    selectedId,
    selectedNode,
    isDirty: dirtyCount > 0,
    select,
    addNode,
    deleteNode,
    updateNode,
    updateScreen,
    reset,
  };
}
