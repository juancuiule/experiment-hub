'use client';

import { Option, RadioComponent } from '@/lib/components/response';
import { Context, ContextData } from '@/lib/types';
import * as RadioGroupPrimitive from '@radix-ui/react-radio-group';
import { Controller, UseFormReturn } from 'react-hook-form';
import { Label } from '../Label';
import { resolveOptions } from '@/lib/resolve';
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
  const { dataKey } = component.props;

  return (
    <Controller
      control={control}
      name={dataKey}
      defaultValue=""
      render={({ field }) => (
        <div className="flex flex-col gap-1">
          <Label context={context}>{component.props.label}</Label>
          <RadioGroupPrimitive.Root
            value={field.value}
            onValueChange={field.onChange}
            className="mt-2 flex flex-col gap-2"
          >
            {resolveOptions(
              component.props.options,
              context,
              component.props.dataKey,
              sharedOptions,
            ).map((opt) => (
              <div key={opt.value} className="flex items-center gap-2">
                <RadioGroupPrimitive.Item
                  id={`${dataKey}-${opt.value}`}
                  value={opt.value}
                  className="border-content-secondary data-[state=checked]:border-content-active focus-visible:ring-ring/50 flex h-4 w-4 shrink-0 cursor-pointer items-center justify-center rounded-full border transition duration-150 ease-out focus-visible:ring-2 active:scale-90"
                >
                  <RadioGroupPrimitive.Indicator className="bg-content-active h-2 w-2 rounded-full" />
                </RadioGroupPrimitive.Item>
                <Label
                  context={context}
                  className="text-sm"
                  htmlFor={`${dataKey}-${opt.value}`}
                >
                  {opt.label}
                </Label>
                {opt.tooltip && <OptionTooltip text={opt.tooltip} />}
              </div>
            ))}
          </RadioGroupPrimitive.Root>
          <FieldError
            message={errors[dataKey]?.message as string | undefined}
          />
        </div>
      )}
    />
  );
}
