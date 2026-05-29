'use client';

import { resolveValuesInString } from '@/lib/resolve';
import { Context } from '@/lib/types';
import Markdown from 'react-markdown';
import { twMerge } from 'tailwind-merge';

interface Props extends React.LabelHTMLAttributes<HTMLLabelElement> {
  children: string;
  context?: Context;
}

const allowedElements = [
  'b',
  'i',
  'em',
  'strong',
  'u',
  's',
  'del',
  'code',
  'a',
  'p',
];

export function Label({ children, context, ...props }: Props) {
  return (
    <label {...props}>
      <Markdown
        allowedElements={allowedElements}
        components={{
          p: ({ children }) => <>{children}</>,
          code: ({ node: _node, className, children, ...props }) => {
            return (
              <code
                className={twMerge(
                  'bg-content-primary/10 rounded px-1 text-sm',
                  className,
                )}
                {...props}
              >
                {children}
              </code>
            );
          },
        }}
      >
        {context ? resolveValuesInString(children, context) : children}
      </Markdown>
    </label>
  );
}
