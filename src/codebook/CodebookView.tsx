'use client';

import type { Codebook, CodebookVariable } from '@/lib/codebook';
import { optionsText, repetitionText } from '@/lib/codebook/render/format';
import { useState } from 'react';

function VariableTable({ variables }: { variables: CodebookVariable[] }) {
  if (variables.length === 0) {
    return <p className="text-content-secondary text-sm">No variables.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left text-xs">
        <thead className="text-content-secondary border-b">
          <tr>
            {[
              'Key',
              'Type',
              'Label / Description',
              'Options',
              'Req',
              'Repeated',
              'Condition',
              'Source',
            ].map((h) => (
              <th key={h} className="px-2 py-1 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {variables.map((v, i) => (
            <tr key={`${v.key}-${i}`} className="border-b align-top">
              <td className="px-2 py-1 font-mono">{v.key}</td>
              <td className="px-2 py-1 font-mono">{v.type}</td>
              <td className="px-2 py-1">{v.label ?? v.description ?? ''}</td>
              <td className="px-2 py-1">{optionsText(v.options)}</td>
              <td className="px-2 py-1">
                {v.required === undefined ? '' : v.required ? 'yes' : 'no'}
              </td>
              <td className="px-2 py-1">{repetitionText(v.repetition)}</td>
              <td className="px-2 py-1 font-mono">{v.conditional ?? ''}</td>
              <td className="px-2 py-1">{v.screen ?? v.template ?? ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DownloadButton({
  label,
  filename,
  content,
  mime,
}: {
  label: string;
  filename: string;
  content: string;
  mime: string;
}) {
  const [copied, setCopied] = useState(false);

  const download = () => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copy = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <span className="flex items-center gap-1">
      <button
        type="button"
        onClick={download}
        className="rounded border px-2 py-1 text-xs hover:bg-content-primary/10"
      >
        Download {label}
      </button>
      <button
        type="button"
        onClick={copy}
        className="rounded border px-2 py-1 text-xs hover:bg-content-primary/10"
      >
        {copied ? 'Copied!' : 'Copy'}
      </button>
    </span>
  );
}

type Props = {
  slug: string;
  codebook: Codebook;
  markdown: string;
  csv: string;
  json: string;
};

export function CodebookView({ slug, codebook, markdown, csv, json }: Props) {
  return (
    <div className="flex flex-col gap-6 py-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">Codebook — {slug}</h1>
        <div className="flex flex-wrap gap-3">
          <DownloadButton
            label="Markdown"
            filename={`${slug}-codebook.md`}
            content={markdown}
            mime="text/markdown"
          />
          <DownloadButton
            label="CSV"
            filename={`${slug}-codebook.csv`}
            content={csv}
            mime="text/csv"
          />
          <DownloadButton
            label="JSON"
            filename={`${slug}-codebook.json`}
            content={json}
            mime="application/json"
          />
        </div>
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="text-base font-semibold">Collected variables</h2>
        <VariableTable variables={codebook.collected} />
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-base font-semibold">Derived variables</h2>
        <VariableTable variables={codebook.derived} />
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-base font-semibold">System / metadata</h2>
        <VariableTable variables={codebook.system} />
      </section>
    </div>
  );
}
