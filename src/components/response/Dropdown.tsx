'use client';

import { DropdownComponent, Option } from '@/lib/components/response';
import { resolveValuesInString } from '@/lib/resolve';
import { Context, ContextData } from '@/lib/types';
import * as SelectPrimitive from '@radix-ui/react-select';
import { ChevronDown } from 'lucide-react';
import { Controller, UseFormReturn } from 'react-hook-form';
import { Label } from '../Label';
import { FieldError, OptionTooltip, resolveOptions } from '../primitives';
import { defaultPerTemplate } from '@/lib/screen-defaults';

type Props = {
  component: DropdownComponent;
  form: UseFormReturn<ContextData>;
  context: Context;
  sharedOptions?: Record<string, Option[]>;
};

export function Dropdown({ component, form, context, sharedOptions }: Props) {
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
          <Label htmlFor={dataKey} context={context}>
            {component.props.label}
          </Label>
          <SelectPrimitive.Root
            value={field.value}
            onValueChange={field.onChange}
          >
            <SelectPrimitive.Trigger
              id={dataKey}
              className="border-border-default focus:border-content-active data-placeholder:text-content-secondary flex w-full items-center justify-between border-b pt-1 pb-1 text-sm transition-[border-color] duration-150 ease-out outline-none"
            >
              <SelectPrimitive.Value placeholder="Select one" />
              <SelectPrimitive.Icon>
                <ChevronDown className="text-content-secondary size-4" />
              </SelectPrimitive.Icon>
            </SelectPrimitive.Trigger>
            <SelectPrimitive.Portal>
              <SelectPrimitive.Content
                position="popper"
                sideOffset={4}
                className="bg-background-surface border-border-default z-50 overflow-hidden rounded-sm border shadow-md"
                style={{ minWidth: 'var(--radix-select-trigger-width)' }}
              >
                <SelectPrimitive.Viewport className="p-1">
                  {resolveOptions(
                    component.props.options,
                    context,
                    component.props.dataKey,
                    sharedOptions,
                  ).map((opt) => (
                    <SelectPrimitive.Item
                      key={opt.value}
                      value={opt.value}
                      className="data-highlighted:bg-content-active data-highlighted:text-content-inverted flex cursor-pointer items-center gap-2 rounded-sm px-3 py-2 text-sm outline-none"
                    >
                      <SelectPrimitive.ItemText>
                        {resolveValuesInString(opt.label, context)}
                      </SelectPrimitive.ItemText>
                      {opt.tooltip && <OptionTooltip text={opt.tooltip} />}
                    </SelectPrimitive.Item>
                  ))}
                </SelectPrimitive.Viewport>
              </SelectPrimitive.Content>
            </SelectPrimitive.Portal>
          </SelectPrimitive.Root>
          <FieldError
            message={errors[dataKey]?.message as string | undefined}
          />
        </div>
      )}
    />
  );
}
