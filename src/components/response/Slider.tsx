"use client";

import { SliderComponent } from "@/lib/components/response";
import { Context } from "@/lib/types";
import * as SliderPrimitive from "@radix-ui/react-slider";
import { Controller, UseFormReturn } from "react-hook-form";
import { Label } from "../Label";
import { FieldError } from "../primitives";

type Props = {
  component: SliderComponent;
  form: UseFormReturn<Record<string, any>>;
  context: Context;
};

export function Slider({ component, form, context }: Props) {
  const {
    control,
    formState: { errors },
  } = form;
  const { dataKey } = component.props;
  const min = component.props.min ?? 0;
  const max = component.props.max ?? 100;

  return (
    <Controller
      control={control}
      name={dataKey}
      render={({ field }) => {
        const value = field.value ?? min;
        return (
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <Label context={context}>{component.props.label}</Label>
              {component.props.showValue && (
                <span className="text-sm font-medium tabular-nums">
                  {value}
                </span>
              )}
            </div>
            <div>
              <SliderPrimitive.Root
                value={[value]}
                min={min}
                max={max}
                step={component.props.step ?? 1}
                onValueChange={([val]) => field.onChange(val)}
                className="relative flex items-center w-full h-5 select-none touch-none"
              >
                <SliderPrimitive.Track className="relative h-px bg-border flex-1 rounded-full">
                  <SliderPrimitive.Range className="absolute h-full bg-primary rounded-full" />
                </SliderPrimitive.Track>
                <SliderPrimitive.Thumb className="block w-4 h-4 bg-primary rounded-full outline-none focus-visible:ring-2 focus-visible:ring-primary/20 cursor-grab active:cursor-grabbing" />
              </SliderPrimitive.Root>
            </div>
            {(component.props.minLabel || component.props.maxLabel) && (
              <div className="flex justify-between mt-1">
                <span className="text-xs text-muted-foreground uppercase tracking-wide">
                  {component.props.minLabel}
                </span>
                <span className="text-xs text-muted-foreground uppercase tracking-wide">
                  {component.props.maxLabel}
                </span>
              </div>
            )}
            <FieldError
              message={errors[dataKey]?.message as string | undefined}
            />
          </div>
        );
      }}
    />
  );
}
