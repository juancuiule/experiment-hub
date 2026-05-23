"use client";

import { Option, RadioComponent } from "@/lib/components/response";
import { Context } from "@/lib/types";
import * as RadioGroupPrimitive from "@radix-ui/react-radio-group";
import { Controller, UseFormReturn } from "react-hook-form";
import { Label } from "../Label";
import { FieldError, resolveOptions } from "../primitives";

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
            className="flex flex-col gap-2 mt-2"
          >
            {resolveOptions(component.props.options, context, component.props.dataKey, sharedOptions).map((opt) => (
              <div key={opt.value} className="flex items-center gap-2">
                <RadioGroupPrimitive.Item
                  id={`${dataKey}-${opt.value}`}
                  value={opt.value}
                  className="w-4 h-4 rounded-full border border-content-secondary flex items-center justify-center shrink-0 data-[state=checked]:border-content-active active:scale-90 transition duration-150 ease-out focus-visible:ring-2 focus-visible:ring-ring/50 cursor-pointer"
                >
                  <RadioGroupPrimitive.Indicator className="w-2 h-2 rounded-full bg-content-active" />
                </RadioGroupPrimitive.Item>
                <Label
                  context={context}
                  className="text-sm"
                  htmlFor={`${dataKey}-${opt.value}`}
                >
                  {opt.label}
                </Label>
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
