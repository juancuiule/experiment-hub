import { generateCodebook, toCsv, toJson, toMarkdown } from '@/lib/codebook';
import { EXPERIMENTS } from '@/src/data/experiments';
import { CodebookView } from '@/src/codebook/CodebookView';
import { notFound } from 'next/navigation';

type Props = {
  params: Promise<{ slug: string }>;
};

export const revalidate = 0;

export default async function CodebookPage(props: Props) {
  const { slug } = await props.params;
  const experiment = EXPERIMENTS[slug];

  if (!experiment) {
    notFound();
  }

  const codebook = generateCodebook(experiment, slug);

  return (
    <CodebookView
      slug={slug}
      codebook={codebook}
      markdown={toMarkdown(codebook)}
      csv={toCsv(codebook)}
      json={toJson(codebook)}
    />
  );
}
