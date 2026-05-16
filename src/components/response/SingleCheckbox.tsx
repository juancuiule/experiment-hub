"use client";

import { SingleCheckboxComponent } from "@/lib/components/response";
import { Context } from "@/lib/types";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Controller, UseFormReturn } from "react-hook-form";
import { twMerge } from "tailwind-merge";
import { Label } from "../Label";
import { FieldError } from "../primitives";
import { Check } from "lucide-react";

type Props = {
  component: SingleCheckboxComponent;
  form: UseFormReturn<Record<string, any>>;
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
      render={({ field }) => (
        <div className="flex flex-col gap-1">
          <div className="flex items-start gap-2">
            <CheckboxPrimitive.Root
              id={`${dataKey}`}
              checked={field.value}
              onCheckedChange={field.onChange}
              className={twMerge(
                "size-4 border border-border-default rounded-sm",
                "flex items-center justify-center shrink-0",
                "data-[state=checked]:bg-content-active data-[state=checked]:border-content-active",
                "transition duration-75 ease-out cursor-pointer active:scale-95",
                "translate-y-0.5",
              )}
            >
              <CheckboxPrimitive.Indicator>
                <Check className="size-4 text-content-inverted" />
              </CheckboxPrimitive.Indicator>
            </CheckboxPrimitive.Root>
            <Label
              context={context}
              className="leading-tight text-sm"
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
