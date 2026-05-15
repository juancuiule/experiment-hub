"use client";

import { CheckboxesComponent } from "@/lib/components/response";
import { Context } from "@/lib/types";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Controller, UseFormReturn } from "react-hook-form";
import { twMerge } from "tailwind-merge";
import { Label } from "../Label";
import { CheckIcon, FieldError, resolveOptions } from "../primitives";

type Props = {
  component: CheckboxesComponent;
  form: UseFormReturn<Record<string, any>>;
  context: Context;
};

export function Checkboxes({ component, form, context }: Props) {
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
          <Label context={context}>{component.props.label}</Label>
          <div className="flex flex-col gap-2">
            {resolveOptions(component.props.options, context).map((opt) => {
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
                      "size-4 border border-gray-400 rounded-sm",
                      "flex items-center justify-center shrink-0",
                      "data-[state=checked]:bg-black data-[state=checked]:border-black",
                      "transition-colors duration-75",
                    )}
                  >
                    <CheckboxPrimitive.Indicator>
                      <CheckIcon />
                    </CheckboxPrimitive.Indicator>
                  </CheckboxPrimitive.Root>
                  <Label
                    className="text-sm"
                    htmlFor={`${dataKey}-${opt.value}`}
                    context={context}
                  >
                    {opt.label}
                  </Label>
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
