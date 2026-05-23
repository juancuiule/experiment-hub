'use client';

import { RichTextComponent } from '@/lib/components/content';
import { resolveValuesInString } from '@/lib/resolve';
import { Context } from '@/lib/types';
import Markdown from 'react-markdown';

type Props = {
  component: RichTextComponent;
  context: Context;
};

export function RichText({ component, context }: Props) {
  const { content } = component.props;
  return (
    <div>
      <Markdown
        components={{
          h1: ({ node, ...props }) => (
            <h1
              {...props}
              className="text-content-primary mb-4 text-5xl font-bold"
            />
          ),
          h2: ({ node, ...props }) => (
            <h2
              {...props}
              className="text-content-primary mb-3 text-3xl font-bold"
            />
          ),
          h3: ({ node, ...props }) => (
            <h3
              {...props}
              className="text-content-primary mb-2 text-xl font-bold"
            />
          ),
          p: ({ node, ...props }) => (
            <p {...props} className="text-content-primary mb-[1lh]" />
          ),
          a: ({ node, ...props }) => (
            <a {...props} className="text-content-active underline" />
          ),
          strong: ({ node, ...props }) => (
            <strong {...props} className="font-bold" />
          ),
          ul: ({ node, ...props }) => (
            <ul {...props} className="mb-2 list-inside list-disc" />
          ),
          ol: ({ node, ...props }) => (
            <ol {...props} className="mb-2 list-inside list-decimal" />
          ),
          blockquote: ({ node, ...props }) => (
            <blockquote
              {...props}
              className="border-border-default *:text-content-secondary! border-l-4 pl-4"
            />
          ),
          code: ({ node, ...props }) => (
            <code
              {...props}
              className="bg-background-surface text-content-primary rounded p-1 text-sm whitespace-break-spaces"
            />
          ),
          pre: ({ node, ...props }) => (
            <pre
              {...props}
              className="bg-background-surface text-content-primary rounded text-sm [&>code]:block [&>code]:bg-transparent"
            />
          ),
        }}
      >
        {resolveValuesInString(content, context)}
      </Markdown>
    </div>
  );
}
