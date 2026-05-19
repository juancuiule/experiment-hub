'use client';

import { LikertScaleComponent, Option } from '@/lib/components/response';
import { resolveLikertOptionsSource } from '@/lib/resolve';
import { Context } from '@/lib/types';
import * as RadioGroupPrimitive from '@radix-ui/react-radio-group';
import { Controller, UseFormReturn } from 'react-hook-form';
import { twMerge } from 'tailwind-merge';
import { Label } from '../Label';
import { FieldError } from '../primitives';

type Props = {
  component: LikertScaleComponent;
  form: UseFormReturn<Record<string, any>>;
  context: Context;
  sharedOptions?: Record<string, Option[]>;
};

export function LikertScale({ component, form, context, sharedOptions }: Props) {
  const {
    control,
    formState: { errors },
  } = form;
  const { dataKey } = component.props;
  const options = resolveLikertOptionsSource(component.props.options, sharedOptions);

  return (
    <Controller
      control={control}
      name={dataKey}
      render={({ field }) => (
        <div className="flex flex-col gap-1">
          <Label id={`${dataKey}-label`} context={context}>
            {component.props.label}
          </Label>
          <RadioGroupPrimitive.Root
            value={field.value}
            onValueChange={field.onChange}
            aria-labelledby={`${dataKey}-label`}
            className="mt-3 flex flex-row items-start justify-between gap-4"
          >
            {options.map((opt, i) => {
              return (
                <div
                  key={opt.value}
                  className={twMerge(
                    'flex flex-1 flex-col items-center justify-center gap-1',
                  )}
                >
                  <RadioGroupPrimitive.Item
                    id={`${dataKey}-${opt.value}`}
                    value={opt.value}
                    aria-label={
                      opt.label
                        ? `${opt.value} — ${opt.label}`
                        : String(opt.value)
                    }
                    className="border-border-default data-[state=checked]:border-content-active relative flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full border transition duration-150 ease-out active:scale-95"
                  >
                    <span className="text-content-secondary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-xs">
                      <span className="ml-0.5">{i + 1}</span>
                    </span>
                    <RadioGroupPrimitive.Indicator
                      className={twMerge(
                        'flex size-6 items-center justify-center rounded-full text-xs',
                        'bg-content-active text-content-inverted z-10 text-center',
                      )}
                    >
                      {i + 1}
                    </RadioGroupPrimitive.Indicator>
                  </RadioGroupPrimitive.Item>
                  {opt.label && (
                    <Label
                      htmlFor={`${dataKey}-${opt.value}`}
                      context={context}
                      className={twMerge(
                        'w-full text-center text-xs text-balance',
                      )}
                    >
                      {opt.label}
                    </Label>
                  )}
                </div>
              );
            })}
          </RadioGroupPrimitive.Root>
          <FieldError
            message={errors[dataKey]?.message as string | undefined}
          />
        </div>
      )}
    />
  );
}
