'use client';

import { ScreenComponent } from '@experiment-hub/engine/components';
import { Option } from '@experiment-hub/engine/components/response';
import { Context, ContextData } from '@experiment-hub/engine/types';
import { Info } from 'lucide-react';
import { UseFormReturn } from 'react-hook-form';

export type RenderProps = {
  component: ScreenComponent;
  form: UseFormReturn<ContextData>;
  context: Context;
  isLoading: boolean;
  sharedOptions?: Record<string, Option[]>;
};

export function OptionTooltip({ text }: { text: string }) {
  return (
    <div className="group/tooltip relative flex items-center">
      <Info className="text-content-secondary size-3.5 cursor-help" />
      <div className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-1 flex origin-bottom -translate-x-1/2 scale-95 flex-col items-center opacity-0 transition-[opacity,transform] duration-150 ease-out group-hover/tooltip:scale-100 group-hover/tooltip:opacity-100">
        <div className="bg-content-active text-content-inverted max-w-48 rounded-md px-2 py-1 text-left text-xs whitespace-normal shadow-md">
          {text}
        </div>
        <div
          className="bg-content-active -mt-px h-1.5 w-3"
          style={{ clipPath: 'polygon(50% 100%, 0 0, 100% 0)' }}
        />
      </div>
    </div>
  );
}

export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" aria-live="polite" className="text-error mt-1 text-xs">
      {message}
    </p>
  );
}
