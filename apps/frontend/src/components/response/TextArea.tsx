'use client';

import { TextAreaComponent } from '@experiment-hub/engine/components/response';
import { resolveValuesInString } from '@experiment-hub/engine/resolve';
import { Context, ContextData } from '@experiment-hub/engine/types';
import { UseFormReturn } from 'react-hook-form';
import { twMerge } from 'tailwind-merge';
import { Label } from '../Label';
import { FieldError } from '../primitives';

type Props = {
  component: TextAreaComponent;
  form: UseFormReturn<ContextData>;
  context: Context;
};

export function TextArea({ component, form, context }: Props) {
  const {
    register,
    formState: { errors },
  } = form;
  const { dataKey, placeholder } = component.props;

  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={dataKey} context={context} tooltip={component.props.labelTooltip}>
        {component.props.label}
      </Label>
      <textarea
        id={dataKey}
        {...register(dataKey)}
        rows={component.props.lines ?? 4}
        placeholder={
          placeholder ? resolveValuesInString(placeholder, context) : undefined
        }
        className={twMerge(
          'border-border-default placeholder:text-content-secondary focus:border-content-active w-full border-b bg-transparent py-1 text-sm transition-[border-color,color] duration-150 ease-out outline-none',
          'resize-none',
        )}
      />
      <FieldError message={errors[dataKey]?.message as string | undefined} />
    </div>
  );
}
