import { listExperiments } from '@/src/data/fetch-experiment';
import { GitBranch } from 'lucide-react';
import Link from 'next/link';

export const revalidate = 0;

export default async function NodesIndexPage() {
  let experiments: Awaited<ReturnType<typeof listExperiments>> = [];
  let unreachable = false;

  try {
    experiments = await listExperiments();
  } catch {
    unreachable = true;
  }

  if (unreachable) {
    return (
      <p className="text-content-secondary text-sm">
        Can&apos;t reach the backend — start it with{' '}
        <code className="font-mono">pnpm dev:backend</code> and seed with{' '}
        <code className="font-mono">pnpm --filter @experiment-hub/backend seed</code>.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <h1 className="text-content-primary text-lg font-semibold">
        Experiment graphs
      </h1>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {experiments.map((exp) => (
          <Link
            key={exp.slug}
            href={`/nodes/${exp.slug}`}
            className="bg-background-surface border-border-default hover:border-content-active flex items-center gap-2 rounded-lg border p-3 transition-colors"
          >
            <GitBranch size={14} className="text-content-secondary" />
            <span className="text-content-primary truncate text-sm">
              {exp.slug}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
