'use client';
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type EdgeProps,
} from '@xyflow/react';
import type { EditorEdge } from './adapter';

/** Bezier edge with a mid-edge pill label, colored by edge role/arm. */
export default function FlowEdge(props: EdgeProps<EditorEdge>) {
  const { id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data } = props;
  const [path, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const color = data?.color ?? '#9ca3af';

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        markerEnd={props.markerEnd}
        style={{
          stroke: color,
          strokeWidth: data?.dataflow ? 1.25 : 2,
          strokeOpacity: data?.dataflow ? 0.75 : 1,
          strokeDasharray: data?.dashed ? '5 4' : undefined,
        }}
      />
      {data?.label && (
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan bg-background-surface pointer-events-none absolute rounded-full border px-1.5 py-px font-mono text-xxs"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              borderColor: color,
              color,
            }}
          >
            {data.label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
