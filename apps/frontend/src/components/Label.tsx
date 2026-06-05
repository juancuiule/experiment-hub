'use client';

import { resolveValuesInString } from '@experiment-hub/engine/resolve';
import { Context } from '@experiment-hub/engine/types';
import { Info } from 'lucide-react';
import Markdown from 'react-markdown';
import { twMerge } from 'tailwind-merge';

interface Props extends React.LabelHTMLAttributes<HTMLLabelElement> {
  children: string;
  context?: Context;
  tooltip?: string;
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

function RenderText({
  children,
  context,
}: {
  children: string;
  context?: Context;
}) {
  return (
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
  );
}

function Tooltip({ children }: { children: React.ReactNode }) {
  return (
    <div className="group/tooltip relative flex w-fit items-center">
      <Info className="text-content-secondary size-3.5 cursor-help" />
      <div
        className={twMerge(
          'absolute bottom-full left-1/2 origin-bottom -translate-x-1/2',
          'group-hover/tooltip:scale-100 group-hover/tooltip:opacity-100',
          'scale-95 opacity-0 transition-[opacity,transform] duration-150 ease-out',
          'pointer-events-none z-50 mb-1 flex w-max max-w-64 flex-col items-center',
        )}
      >
        <div className="bg-content-active text-content-inverted block rounded-md px-2 py-1 text-left text-xs whitespace-normal shadow-md">
          {children}
        </div>
        <div
          className="bg-content-active -mt-px h-1.5 w-3"
          style={{ clipPath: 'polygon(50% 100%, 0 0, 100% 0)' }}
        />
      </div>
    </div>
  );
}

export function Label({ children, context, tooltip, ...props }: Props) {
  const label = (
    <label {...props}>
      <RenderText context={context}>{children}</RenderText>
    </label>
  );

  if (tooltip) {
    return (
      <div className="flex items-center gap-2">
        {label}
        <Tooltip>{tooltip}</Tooltip>
      </div>
    );
  }

  return label;
}
