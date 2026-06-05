'use client';

import {
  Option,
  RadioComponent,
} from '@experiment-hub/engine/components/response';
import { resolveOptions } from '@experiment-hub/engine/resolve';
import { Context, ContextData } from '@experiment-hub/engine/types';
import * as RadioGroupPrimitive from '@radix-ui/react-radio-group';
import { Controller, UseFormReturn } from 'react-hook-form';
import { twMerge } from 'tailwind-merge';
import { Label } from '../Label';
import { FieldError, OptionTooltip } from '../primitives';

type Props = {
  component: RadioComponent;
  form: UseFormReturn<ContextData>;
  context: Context;
  sharedOptions?: Record<string, Option[]>;
};

export function Radio({ component, form, context, sharedOptions }: Props) {
  const {
    control,
    formState: { errors },
  } = form;
  const { dataKey, direction = 'vertical' } = component.props;

  return (
    <Controller
      control={control}
      name={dataKey}
      defaultValue=""
      render={({ field }) => (
        <div className="flex flex-col gap-1">
          <Label context={context} tooltip={component.props.labelTooltip}>{component.props.label}</Label>
          <RadioGroupPrimitive.Root
            value={field.value}
            onValueChange={field.onChange}
            className={
              direction === 'horizontal'
                ? 'mt-2 gap-2 grid grid-cols-4'
                : 'mt-2 flex flex-col gap-2'
            }
          >
            {resolveOptions(
              component.props.options,
              context,
              component.props.dataKey,
              sharedOptions,
            ).map((opt) =>
              direction === 'horizontal' ? (
                <label
                  key={opt.value}
                  htmlFor={`${dataKey}-${opt.value}`}
                  className={twMerge(
                    'group flex flex-col items-start w-full gap-2 transition duration-150 ease-out',
                    'border-content-secondary bg-background-surface',
                    'has-data-[state=checked]:border-content-active has-data-[state=checked]:bg-content-active/10',
                    'rounded-md border p-2',
                    'focus-within:ring-ring/50 focus-within:ring-2 active:scale-95',
                    'cursor-pointer',
                  )}
                >
                  <RadioGroupPrimitive.Item
                    id={`${dataKey}-${opt.value}`}
                    value={opt.value}
                    className="border-content-secondary data-[state=checked]:border-content-active focus-visible:ring-ring/50 flex h-4 w-4 shrink-0 cursor-pointer items-center justify-center rounded-full border transition duration-150 ease-out focus-visible:ring-2 active:scale-90"
                  >
                    <RadioGroupPrimitive.Indicator className="bg-content-active h-2 w-2 rounded-full" />
                  </RadioGroupPrimitive.Item>
                  <Label
                    context={context}
                    className="group-has-data-[state=checked]:text-content-active cursor-pointer text-sm"
                  >
                    {opt.label}
                  </Label>
                  {opt.tooltip && <OptionTooltip text={opt.tooltip} />}
                </label>
              ) : (
                <div key={opt.value} className="flex items-center gap-2">
                  <RadioGroupPrimitive.Item
                    id={`${dataKey}-${opt.value}`}
                    value={opt.value}
                    className="border-content-secondary data-[state=checked]:border-content-active focus-visible:ring-ring/50 flex h-4 w-4 shrink-0 cursor-pointer items-center justify-center rounded-full border transition duration-150 ease-out focus-visible:ring-2 active:scale-90"
                  >
                    <RadioGroupPrimitive.Indicator className="bg-content-active h-2 w-2 rounded-full" />
                  </RadioGroupPrimitive.Item>
                  <div className="flex items-center gap-1">
                    <Label
                      context={context}
                      className="cursor-pointer text-sm"
                      htmlFor={`${dataKey}-${opt.value}`}
                    >
                      {opt.label}
                    </Label>
                    {opt.tooltip && <OptionTooltip text={opt.tooltip} />}
                  </div>
                </div>
              ),
            )}
          </RadioGroupPrimitive.Root>
          <FieldError
            message={errors[dataKey]?.message as string | undefined}
          />
        </div>
      )}
    />
  );
}
