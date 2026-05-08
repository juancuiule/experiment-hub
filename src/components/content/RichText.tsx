"use client";

import { RichTextComponent } from "@/lib/components/content";
import { resolveValuesInString } from "@/lib/resolve";
import { Context } from "@/lib/types";
import Markdown from "react-markdown";

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
            <h1 {...props} className="text-5xl font-bold mb-4" />
          ),
          h2: ({ node, ...props }) => (
            <h2 {...props} className="text-3xl font-bold mb-3" />
          ),
          h3: ({ node, ...props }) => (
            <h3 {...props} className="text-xl font-bold mb-2" />
          ),
          p: ({ node, ...props }) => (
            <p {...props} className="text-foreground mb-[1lh]" />
          ),
          a: ({ node, ...props }) => (
            <a {...props} className="text-info underline" />
          ),
          strong: ({ node, ...props }) => (
            <strong {...props} className="font-bold" />
          ),
          ul: ({ node, ...props }) => (
            <ul {...props} className="list-disc list-inside mb-2" />
          ),
          ol: ({ node, ...props }) => (
            <ol {...props} className="list-decimal list-inside mb-2" />
          ),
          blockquote: ({ node, ...props }) => (
            <blockquote
              {...props}
              className="border-l-4 border-border pl-4 text-muted-foreground"
            />
          ),
          code: ({ node, ...props }) => (
            <code
              {...props}
              className="bg-surface text-foreground rounded p-1 text-sm whitespace-break-spaces"
            />
          ),
          pre: ({ node, ...props }) => (
            <pre
              {...props}
              className="bg-surface text-foreground rounded text-sm [&>code]:block [&>code]:bg-transparent"
            />
          ),
        }}
      >
        {resolveValuesInString(content, context)}
      </Markdown>
    </div>
  );
}
