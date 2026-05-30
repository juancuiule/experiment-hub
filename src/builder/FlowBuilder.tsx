'use client';

import { validateExperiment } from '@/lib/experiment-validation';
import { ExperimentFlow } from '@/lib/types';
import { AlertTriangle, CheckCircle2, RotateCcw } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Canvas } from './Canvas';
import { Inspector } from './Inspector';
import { Palette } from './Palette';
import { useFlowEditor } from './useFlowEditor';

export function FlowBuilder({
  slug,
  source,
}: {
  slug: string;
  source: ExperimentFlow;
}) {
  const editor = useFlowEditor(source);
  const [showJson, setShowJson] = useState(false);

  const errors = useMemo(
    () => validateExperiment(editor.flow),
    [editor.flow],
  );
  const blocking = errors.filter((e) => e.severity !== 'warning');

  return (
    <div className="flex h-full w-full flex-col">
      {/* Toolbar */}
      <div className="flex items-center gap-3 border-b border-border-default bg-background-surface px-4 py-2">
        <Link
          href="/builder"
          className="text-xs text-content-secondary hover:text-content-active"
        >
          ← Experiments
        </Link>
        <span className="font-mono text-sm font-semibold text-content-primary">
          {slug}
        </span>
        {editor.isDirty ? (
          <span className="text-xxs rounded-full bg-amber-100 px-2 py-0.5 text-amber-700">
            edited
          </span>
        ) : null}

        <div className="flex-1" />

        <ValidationBadge count={blocking.length} />
        <button
          type="button"
          onClick={() => setShowJson((v) => !v)}
          className="rounded-md border border-border-default px-2.5 py-1 text-xs text-content-secondary hover:border-content-active"
        >
          {showJson ? 'Hide' : 'View'} JSON
        </button>
        <button
          type="button"
          onClick={editor.reset}
          disabled={!editor.isDirty}
          className="flex items-center gap-1 rounded-md border border-border-default px-2.5 py-1 text-xs text-content-secondary hover:border-content-active disabled:opacity-40"
        >
          <RotateCcw className="size-3.5" /> Reset
        </button>
      </div>

      {/* Validation detail strip */}
      {errors.length > 0 ? (
        <div className="flex flex-wrap gap-x-4 gap-y-1 border-b border-border-default bg-amber-50 px-4 py-1.5">
          {errors.slice(0, 4).map((e, i) => (
            <span
              key={i}
              className="text-xxs text-amber-800"
              title={e.message}
            >
              <span className="font-mono">{e.code}</span> · {e.message}
            </span>
          ))}
          {errors.length > 4 ? (
            <span className="text-xxs text-amber-800">
              +{errors.length - 4} more
            </span>
          ) : null}
        </div>
      ) : null}

      {/* Body */}
      <div className="flex min-h-0 flex-1">
        <Palette onAdd={editor.addNode} hasSelection={Boolean(editor.selectedId)} />
        <div className="relative min-w-0 flex-1">
          <Canvas
            nodes={editor.flow.nodes}
            edges={editor.flow.edges}
            selectedId={editor.selectedId}
            onSelect={editor.select}
          />
          {showJson ? (
            <pre className="absolute inset-2 overflow-auto rounded-lg border border-border-default bg-background-surface/95 p-3 font-mono text-xxs text-content-primary shadow-lg">
              {JSON.stringify(editor.flow, null, 2)}
            </pre>
          ) : null}
        </div>
        <Inspector
          node={editor.selectedNode}
          flow={editor.flow}
          onChange={(next) => editor.updateNode(next.id, next)}
          onChangeScreen={editor.updateScreen}
          onDelete={editor.deleteNode}
        />
      </div>
    </div>
  );
}

function ValidationBadge({ count }: { count: number }) {
  if (count === 0) {
    return (
      <span className="flex items-center gap-1 text-xs text-success">
        <CheckCircle2 className="size-4" /> valid
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 text-xs text-error">
      <AlertTriangle className="size-4" /> {count} issue(s)
    </span>
  );
}
