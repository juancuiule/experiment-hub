"use client";

import { DropdownComponent } from "@/lib/components/response";
import { resolveValuesInString } from "@/lib/resolve";
import { Context } from "@/lib/types";
import * as SelectPrimitive from "@radix-ui/react-select";
import { ChevronDown } from "lucide-react";
import { Controller, UseFormReturn } from "react-hook-form";
import { Label } from "../Label";
import { FieldError, resolveOptions } from "../primitives";

type Props = {
  component: DropdownComponent;
  form: UseFormReturn<Record<string, any>>;
  context: Context;
};

export function Dropdown({ component, form, context }: Props) {
  const {
    control,
    formState: { errors },
  } = form;
  const { dataKey } = component.props;

  return (
    <Controller
      control={control}
      name={dataKey}
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
              className="flex items-center justify-between border-b border-border-default pb-1 pt-1 w-full outline-none focus:border-content-active transition-colors data-placeholder:text-content-secondary text-sm"
            >
              <SelectPrimitive.Value placeholder="Select one" />
              <SelectPrimitive.Icon>
                <ChevronDown className="size-4 text-content-secondary" />
              </SelectPrimitive.Icon>
            </SelectPrimitive.Trigger>
            <SelectPrimitive.Portal>
              <SelectPrimitive.Content className="bg-background-surface border border-border-default shadow-md rounded-sm z-50 overflow-hidden">
                <SelectPrimitive.Viewport className="p-1">
                  {resolveOptions(component.props.options, context, component.props.dataKey).map(
                    (opt) => (
                      <SelectPrimitive.Item
                        key={opt.value}
                        value={opt.value}
                        className="flex items-center px-3 py-2 text-sm cursor-pointer outline-none data-highlighted:bg-content-active data-highlighted:text-content-inverted rounded-sm"
                      >
                        <SelectPrimitive.ItemText>
                          {resolveValuesInString(opt.label, context)}
                        </SelectPrimitive.ItemText>
                      </SelectPrimitive.Item>
                    ),
                  )}
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
