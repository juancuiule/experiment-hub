'use client';

import {
  defaultPerTemplate,
  SingleCheckboxComponent,
} from '@experiment-hub/engine/components/response';
import { Context, ContextData } from '@experiment-hub/engine/types';
import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import { Check } from 'lucide-react';
import { Controller, UseFormReturn } from 'react-hook-form';
import { twMerge } from 'tailwind-merge';
import { Label } from '../Label';
import { FieldError } from '../primitives';

type Props = {
  component: SingleCheckboxComponent;
  form: UseFormReturn<ContextData>;
  context: Context;
};

export function SingleCheckbox({ component, form, context }: Props) {
  const {
    control,
    formState: { errors },
  } = form;
  const { dataKey } = component.props;

  return (
    <Controller
      control={control}
      name={dataKey}
      defaultValue={defaultPerTemplate(component)}
      render={({ field }) => (
        <div className="flex flex-col gap-1">
          <div className="flex items-start gap-2">
            <CheckboxPrimitive.Root
              id={`${dataKey}`}
              checked={field.value ?? false}
              onCheckedChange={field.onChange}
              className={twMerge(
                'border-border-default size-4 rounded-sm border',
                'flex shrink-0 items-center justify-center',
                'data-[state=checked]:bg-content-active data-[state=checked]:border-content-active',
                'cursor-pointer transition duration-75 ease-out active:scale-95',
                'translate-y-0.5',
              )}
            >
              <CheckboxPrimitive.Indicator>
                <Check className="text-content-inverted size-4" />
              </CheckboxPrimitive.Indicator>
            </CheckboxPrimitive.Root>
            <Label
              context={context}
              className="text-sm leading-tight"
              htmlFor={`${dataKey}`}
            >
              {component.props.label}
            </Label>
          </div>
          <FieldError
            message={errors[dataKey]?.message as string | undefined}
          />
        </div>
      )}
    />
  );
}
