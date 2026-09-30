import { EXPERIMENTS } from '@/src/data/experiments';
import Link from 'next/link';

export default function ScreensIndex() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 p-4">
      <h1 className="text-content-primary text-lg font-semibold">
        Screen editor
      </h1>
      <p className="text-content-secondary text-xs">
        Pick an experiment to edit its screens. The same editor opens when you
        double-click a screen node in the graph view.
      </p>
      <div className="flex flex-col gap-1">
        {Object.entries(EXPERIMENTS).map(([slug, exp]) => (
          <Link
            key={slug}
            href={`/screens/${slug}`}
            className="border-border-default hover:border-accent rounded-lg border px-3 py-2 text-sm"
          >
            <span className="text-content-primary font-medium">{slug}</span>
            <span className="text-content-secondary ml-2 text-xxs">
              {exp.screens?.length ?? 0} screens · {exp.nodes.length} nodes
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
