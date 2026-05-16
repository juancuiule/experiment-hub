"use client";

import { SliderComponent } from "@/lib/components/response";
import { resolveValuesInString } from "@/lib/resolve";
import { Context } from "@/lib/types";
import * as SliderPrimitive from "@radix-ui/react-slider";
import { Controller, UseFormReturn } from "react-hook-form";
import { twMerge } from "tailwind-merge";
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
        const hasInteracted = field.value !== null && field.value !== undefined;
        const defaultValue = component.props.defaultValue;
        const showThumb = hasInteracted || defaultValue !== undefined;
        const thumbPosition = hasInteracted
          ? (field.value as number)
          : (defaultValue ?? min);

        const thumbClass = hasInteracted ? "bg-content-active" : showThumb ? "bg-content-secondary/60" : "cursor-pointer opacity-0";

        return (
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between mb-2">
              <Label context={context}>{component.props.label}</Label>
              {component.props.showValue && hasInteracted && (
                <span className="text-sm font-medium tabular-nums text-content-primary">
                  {field.value}
                </span>
              )}
            </div>
            <div>
              <SliderPrimitive.Root
                value={[thumbPosition]}
                min={min}
                max={max}
                step={component.props.step ?? 1}
                onValueChange={([val]) => field.onChange(val)}
                className="relative flex items-center w-full h-5 select-none touch-none"
              >
                <SliderPrimitive.Track className="relative h-0.5 bg-content-secondary/60 flex-1 rounded-full">
                  <SliderPrimitive.Range className={`absolute h-full rounded-full ${hasInteracted ? "bg-content-active" : "bg-transparent"}`} />
                </SliderPrimitive.Track>
                <SliderPrimitive.Thumb className={twMerge(
                  'block w-4 h-4 rounded-full outline-none',
                  hasInteracted || showThumb ? 'focus-visible:ring-4 focus-visible:ring-content-active/50 cursor-grab active:cursor-grabbing' : '',
                  thumbClass
                )} />
              </SliderPrimitive.Root>
            </div>
            {(component.props.minLabel || component.props.maxLabel) && (
              <div className="flex justify-between mt-0">
                <span className="text-xs text-content-secondary uppercase tracking-wide">
                  {component.props.minLabel ? resolveValuesInString(component.props.minLabel, context) : undefined}
                </span>
                <span className="text-xs text-content-secondary uppercase tracking-wide">
                  {component.props.maxLabel ? resolveValuesInString(component.props.maxLabel, context) : undefined}
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
