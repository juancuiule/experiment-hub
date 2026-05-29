'use client';

import { ButtonComponent } from '@/lib/components/layout';
import { resolveValuesInString } from '@/lib/resolve';
import { Context } from '@/lib/types';
import { twMerge } from 'tailwind-merge';

type Props = {
  component: ButtonComponent;
  isLoading: boolean;
  context: Context;
};

export function Button({ component, isLoading, context }: Props) {
  const text = component.props.text
    ? resolveValuesInString(component.props.text, context)
    : 'Continue';
  return (
    <div className={twMerge(component.props.alignBottom ? 'mt-auto pt-5' : '')}>
      <button
        type="submit"
        disabled={component.props.disabled || isLoading}
        className="bg-background-inverted text-content-inverted hover:bg-background-inverted/80 h-10 w-full cursor-pointer rounded-sm text-sm font-medium tracking-wide uppercase transition duration-150 ease-out active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100"
      >
        {isLoading ? '…' : text}
      </button>
    </div>
  );
}
