'use client';

import { ScreenComponent } from '@/lib/components';
import { Option, OptionsSource } from '@/lib/components/response';
import { resolveOptionsSource } from '@/lib/resolve';
import { Context, ContextData } from '@/lib/types';
import { UseFormReturn } from 'react-hook-form';

export type RenderProps = {
  component: ScreenComponent;
  form: UseFormReturn<ContextData>;
  context: Context;
  isLoading: boolean;
  sharedOptions?: Record<string, Option[]>;
};

export function resolveOptions(
  options: OptionsSource,
  context: Context,
  dataKey?: string,
  sharedOptions?: Record<string, Option[]>,
): Option[] {
  if (dataKey && context.screenData?.shuffledOptions?.[dataKey]) {
    return context.screenData.shuffledOptions[dataKey] as Option[];
  }
  return resolveOptionsSource(options, context, sharedOptions);
}

export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" aria-live="polite" className="text-error mt-1 text-xs">
      {message}
    </p>
  );
}
