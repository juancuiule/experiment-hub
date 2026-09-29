import { listExperiments } from '@/src/data/fetch-experiment';

function ExperimentCard({
  slug,
  version,
}: {
  slug: string;
  version: string;
}) {
  return (
    <a
      href={`/experiments/${slug}`}
      className="hover:bg-background-surface block rounded border px-2 py-1"
    >
      <span className="text-sm font-semibold">{slug}</span>
      <div>
        <p className="text-content-secondary font-mono text-xs">
          {version.slice(0, 12)}
        </p>
      </div>
    </a>
  );
}

// Lists what the backend actually serves — published configs, not the
// authored corpus (which can contain unpublished work in progress).
export default async function Page() {
  const experiments = await listExperiments();

  return (
    <div className="mt-2 flex flex-col gap-2">
      <h1 className="mb-4 text-2xl font-bold">Experiments</h1>
      <div className="flex flex-col gap-2">
        {experiments.map((e) => (
          <ExperimentCard key={e.slug} slug={e.slug} version={e.version} />
        ))}
      </div>
    </div>
  );
}
