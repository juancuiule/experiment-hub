'use client';

import { AccordionComponent } from '@experiment-hub/engine/components/content';
import { resolveValuesInString } from '@experiment-hub/engine/resolve';
import { Context } from '@experiment-hub/engine/types';
import Markdown from 'react-markdown';

type Props = {
  component: AccordionComponent;
  context: Context;
};

const markdownComponents = {
  p: ({ node: _node, ...props }: React.HTMLAttributes<HTMLParagraphElement> & { node?: unknown }) => (
    <p {...props} className="text-content-primary mb-[1lh]" />
  ),
  a: ({ node: _node, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { node?: unknown }) => (
    <a {...props} className="text-content-active underline" />
  ),
  strong: ({ node: _node, ...props }: React.HTMLAttributes<HTMLElement> & { node?: unknown }) => (
    <strong {...props} className="font-bold" />
  ),
  ul: ({ node: _node, ...props }: React.HTMLAttributes<HTMLUListElement> & { node?: unknown }) => (
    <ul {...props} className="mb-2 list-inside list-disc" />
  ),
  ol: ({ node: _node, ...props }: React.HTMLAttributes<HTMLOListElement> & { node?: unknown }) => (
    <ol {...props} className="mb-2 list-inside list-decimal" />
  ),
};

export function Accordion({ component, context }: Props) {
  const { title, body } = component.props;
  return (
    <details className="border-border-default rounded border">
      <summary className="text-content-primary cursor-pointer px-4 py-3 font-medium select-none">
        <Markdown components={markdownComponents}>
          {resolveValuesInString(title, context)}
        </Markdown>
      </summary>
      <div className="border-border-default border-t px-4 py-3">
        <Markdown components={markdownComponents}>
          {resolveValuesInString(body, context)}
        </Markdown>
      </div>
    </details>
  );
}
