import { EXPERIMENTS } from '@/src/data/experiments';
import Link from 'next/link';

export const metadata = { title: 'Flow Builder · Experiment Hub' };

export default function BuilderIndex() {
  const slugs = Object.keys(EXPERIMENTS);
  return (
    <div className="flex w-full flex-col gap-4 py-6">
      <header>
        <h1 className="text-lg font-semibold text-content-primary">
          Flow Builder
        </h1>
        <p className="text-sm text-content-secondary">
          Visually inspect and configure experiment flows. Edits are in-memory
          (a prototype) — they never touch the real experiment definitions.
        </p>
      </header>
      <ul className="flex flex-col gap-2">
        {slugs.map((slug) => {
          const flow = EXPERIMENTS[slug];
          return (
            <li key={slug}>
              <Link
                href={`/builder/${slug}`}
                className="flex items-center justify-between rounded-lg border border-border-default bg-background-surface px-4 py-3 transition hover:border-content-active hover:shadow-sm"
              >
                <span className="font-mono text-sm font-medium text-content-primary">
                  {slug}
                </span>
                <span className="text-xxs text-content-secondary">
                  {flow.nodes.length} nodes · {flow.edges.length} edges ·{' '}
                  {flow.screens?.length ?? 0} screens
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
