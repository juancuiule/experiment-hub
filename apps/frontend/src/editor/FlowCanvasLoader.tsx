'use client';
import type { ExperimentFlow } from '@experiment-hub/engine/types';
import dynamic from 'next/dynamic';

// The canvas is a pure client surface — skip SSR so React Flow never mounts
// against a zero-size container.
const FlowCanvas = dynamic(() => import('./FlowCanvas'), { ssr: false });

export default function FlowCanvasLoader(props: {
  slug: string;
  experiment: ExperimentFlow;
}) {
  return <FlowCanvas {...props} />;
}
