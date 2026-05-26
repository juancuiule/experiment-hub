'use client';

import {
  CheckboxesComponent,
  defaultPerTemplate,
  Option,
} from '@/lib/components/response';
import { Context, ContextData } from '@/lib/types';
import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import { Check } from 'lucide-react';
import { Controller, UseFormReturn } from 'react-hook-form';
import { twMerge } from 'tailwind-merge';
import { Label } from '../Label';
import { FieldError, OptionTooltip, resolveOptions } from '../primitives';

type Props = {
  component: CheckboxesComponent;
  form: UseFormReturn<ContextData>;
  context: Context;
  sharedOptions?: Record<string, Option[]>;
};

export function Checkboxes({ component, form, context, sharedOptions }: Props) {
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
          <Label context={context}>{component.props.label}</Label>
          <div className="flex flex-col gap-2">
            {resolveOptions(
              component.props.options,
              context,
              component.props.dataKey,
              sharedOptions,
            ).map((opt) => {
              const checked =
                Array.isArray(field.value) && field.value.includes(opt.value);
              return (
                <div key={opt.value} className="flex items-center gap-2">
                  <CheckboxPrimitive.Root
                    id={`${dataKey}-${opt.value}`}
                    checked={checked}
                    onCheckedChange={(isChecked) => {
                      const current = Array.isArray(field.value)
                        ? field.value
                        : [];
                      field.onChange(
                        isChecked
                          ? [...current, opt.value]
                          : current.filter((v: string) => v !== opt.value),
                      );
                    }}
                    className={twMerge(
                      'border-border-default size-4 rounded-sm border',
                      'flex shrink-0 items-center justify-center',
                      'data-[state=checked]:bg-content-active data-[state=checked]:border-content-active',
                      'cursor-pointer transition duration-75 ease-out active:scale-95',
                    )}
                  >
                    <CheckboxPrimitive.Indicator>
                      <Check className="text-content-inverted size-4" />
                    </CheckboxPrimitive.Indicator>
                  </CheckboxPrimitive.Root>
                  <Label
                    className="text-sm"
                    htmlFor={`${dataKey}-${opt.value}`}
                    context={context}
                  >
                    {opt.label}
                  </Label>
                  {opt.tooltip && <OptionTooltip text={opt.tooltip} />}
                </div>
              );
            })}
          </div>
          <FieldError
            message={errors[dataKey]?.message as string | undefined}
          />
        </div>
      )}
    />
  );
}
