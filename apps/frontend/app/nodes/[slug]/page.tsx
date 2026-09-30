import { fetchExperiment } from '@/src/data/fetch-experiment';
import FlowCanvasLoader from '@/src/editor/FlowCanvasLoader';
import { notFound } from 'next/navigation';

export const revalidate = 0;

type Props = { params: Promise<{ slug: string }> };

export default async function NodeGraphPage({ params }: Props) {
  const { slug } = await params;
  const loaded = await fetchExperiment(slug);

  if (!loaded) {
    notFound();
  }

  const { config: experiment, version } = loaded;

  return (
    <div className="flex w-full flex-1 flex-col gap-3">
      <div className="flex items-baseline gap-3">
        <h1 className="text-content-primary text-lg font-semibold">{slug}</h1>
        <span className="text-content-secondary font-mono text-xxs">
          {version.slice(0, 12)} · {experiment.nodes.length} nodes ·{' '}
          {experiment.edges.length} edges
        </span>
      </div>
      <FlowCanvasLoader slug={slug} experiment={experiment} />
    </div>
  );
}
