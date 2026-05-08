"use client";

import { DropdownComponent } from "@/lib/components/response";
import { resolveValuesInString } from "@/lib/resolve";
import { Context } from "@/lib/types";
import * as SelectPrimitive from "@radix-ui/react-select";
import { Controller, UseFormReturn } from "react-hook-form";
import { ChevronDownIcon, FieldError, resolveOptions } from "../primitives";
import { Label } from "../Label";

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
              className="flex items-center justify-between border-b border-border pb-1 pt-1 w-full outline-none focus:border-primary transition-colors data-placeholder:text-muted-foreground text-sm"
            >
              <SelectPrimitive.Value placeholder="Select one" />
              <SelectPrimitive.Icon>
                <ChevronDownIcon />
              </SelectPrimitive.Icon>
            </SelectPrimitive.Trigger>
            <SelectPrimitive.Portal>
              <SelectPrimitive.Content className="bg-surface border border-border shadow-md rounded-[var(--radius)] z-50 overflow-hidden">
                <SelectPrimitive.Viewport className="p-1">
                  {resolveOptions(component.props.options, context).map(
                    (opt) => (
                      <SelectPrimitive.Item
                        key={opt.value}
                        value={opt.value}
                        className="flex items-center px-3 py-2 text-sm cursor-pointer outline-none data-highlighted:bg-surface-hover rounded-[var(--radius)]"
                      >
                        <SelectPrimitive.ItemText>
                          {opt.label}
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
