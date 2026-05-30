import { FlowBuilder } from '@/src/builder/FlowBuilder';
import { EXPERIMENTS } from '@/src/data/experiments';
import Link from 'next/link';
import { notFound } from 'next/navigation';

export const revalidate = 0;

export default async function BuilderPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const flow = EXPERIMENTS[slug];
  if (!flow) notFound();

  return (
    // Break out of the root layout's centered max-w-lg main.
    <div className="fixed inset-0 z-40 flex flex-col bg-background">
      <FlowBuilder slug={slug} source={flow} />
      <Link
        href="/builder"
        className="sr-only"
        aria-label="Back to experiments"
      >
        Back
      </Link>
    </div>
  );
}
