"use client";

import { LikertScaleComponent } from "@/lib/components/response";
import { Context } from "@/lib/types";
import * as RadioGroupPrimitive from "@radix-ui/react-radio-group";
import { Controller, UseFormReturn } from "react-hook-form";
import { twMerge } from "tailwind-merge";
import { Label } from "../Label";
import { FieldError } from "../primitives";

type Props = {
  component: LikertScaleComponent;
  form: UseFormReturn<Record<string, any>>;
  context: Context;
};

export function LikertScale({ component, form, context }: Props) {
  const {
    control,
    formState: { errors },
  } = form;
  const { dataKey } = component.props;
  const options = component.props.options;

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
            className="flex justify-between mt-3 flex-row gap-4 items-start"
          >
            {options.map((opt, i) => (
              <div
                key={opt.value}
                className="flex justify-center items-center flex-col flex-1 gap-1"
              >
                <RadioGroupPrimitive.Item
                  id={`${dataKey}-${opt.value}`}
                  value={opt.value}
                  aria-label={
                    opt.label
                      ? `${opt.value} — ${opt.label}`
                      : String(opt.value)
                  }
                  className="size-8 rounded-full relative border border-border flex items-center justify-center shrink-0 data-[state=checked]:border-primary transition-colors"
                >
                  <span className="text-xs absolute top-1/2 -translate-y-1/2 left-1/2 -translate-x-1/2 text-muted-foreground">
                    <span className="ml-0.5">{i + 1}</span>
                  </span>
                  <RadioGroupPrimitive.Indicator
                    className={twMerge(
                      "size-6 flex items-center justify-center text-xs rounded-full",
                      "bg-primary text-primary-foreground z-10 text-center",
                    )}
                  >
                    {i + 1}
                  </RadioGroupPrimitive.Indicator>
                </RadioGroupPrimitive.Item>
                {opt.label && (
                  <Label
                    htmlFor={`${dataKey}-${opt.value}`}
                    context={context}
                    className="text-xs w-full text-center text-balance"
                  >
                    {opt.label}
                  </Label>
                )}
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
