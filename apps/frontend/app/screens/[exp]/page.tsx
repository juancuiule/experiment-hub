import { EXPERIMENTS } from '@/src/data/experiments';
import Link from 'next/link';
import { notFound } from 'next/navigation';

export default async function ExperimentScreensPage({
  params,
}: {
  params: Promise<{ exp: string }>;
}) {
  const { exp } = await params;
  const experiment = EXPERIMENTS[exp];
  if (!experiment) notFound();

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 p-4">
      <div className="flex items-baseline gap-3">
        <h1 className="text-content-primary text-lg font-semibold">{exp}</h1>
        <span className="text-content-secondary font-mono text-xxs">
          {experiment.screens?.length ?? 0} screens
        </span>
      </div>
      <div className="flex flex-col gap-1">
        {(experiment.screens ?? []).map((s) => (
          <Link
            key={s.slug}
            href={`/screens/${exp}/${s.slug}`}
            className="border-border-default hover:border-accent rounded-lg border px-3 py-2 text-sm"
          >
            <span className="text-content-primary font-mono">{s.slug}</span>
            <span className="text-content-secondary ml-2 text-xxs">
              {s.components.length} components
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
