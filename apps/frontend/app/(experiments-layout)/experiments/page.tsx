import { EXPERIMENTS } from '@/src/data/experiments';

function ExperimentCard({ slug }: { slug: string }) {
  const experiment = EXPERIMENTS[slug];

  const { nodes, edges, screens = [] } = experiment;

  return (
    <a
      href={`/experiments/${slug}`}
      className="hover:bg-background-surface block rounded border px-2 py-1"
    >
      <span className="text-sm font-semibold">{slug}</span>
      <div>
        <p className="text-content-secondary text-xs">
          {nodes.length} nodes, {edges.length} edges, {screens.length} screens
        </p>
      </div>
    </a>
  );
}

export default function Page() {
  return (
    <div className="mt-2 flex flex-col gap-2">
      <h1 className="mb-4 text-2xl font-bold">Experiments</h1>
      <div className="flex flex-col gap-2">
        {Object.keys(EXPERIMENTS).map((slug) => (
          <ExperimentCard key={slug} slug={slug} />
        ))}
      </div>
    </div>
  );
}
