import { EXPERIMENTS } from '@/src/data/experiments';
import ScreenEditor from '@/src/editor/ScreenEditor';
import { notFound } from 'next/navigation';

export default async function ScreenEditorPage({
  params,
}: {
  params: Promise<{ exp: string; slug: string }>;
}) {
  const { exp, slug } = await params;
  const experiment = EXPERIMENTS[exp];
  if (!experiment?.screens?.some((s) => s.slug === slug)) notFound();

  return (
    <div className="flex w-full flex-1 flex-col gap-3">
      <div className="flex items-baseline gap-3">
        <h1 className="text-content-primary text-lg font-semibold">
          {exp} <span className="text-content-secondary">/</span> {slug}
        </h1>
        <span className="text-content-secondary font-mono text-xxs">
          screen editor
        </span>
      </div>
      <ScreenEditor experiment={experiment} screenSlug={slug} slug={exp} />
    </div>
  );
}
