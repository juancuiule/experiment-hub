'use client';

import {
  defaultPerTemplate,
  RangeSliderComponent,
} from '@experiment-hub/engine/components/response';
import { resolveValuesInString } from '@experiment-hub/engine/resolve';
import { Context, ContextData } from '@experiment-hub/engine/types';
import * as SliderPrimitive from '@radix-ui/react-slider';
import { Controller, UseFormReturn } from 'react-hook-form';
import { Label } from '../Label';
import { FieldError } from '../primitives';

type Props = {
  component: RangeSliderComponent;
  form: UseFormReturn<ContextData>;
  context: Context;
};

export function RangeSlider({ component, form, context }: Props) {
  const {
    control,
    formState: { errors },
  } = form;
  const { dataKey } = component.props;
  const min = component.props.min ?? 0;
  const max = component.props.max ?? 100;
  const defaultValue = component.props.defaultValue ?? [min, max];

  return (
    <Controller
      control={control}
      name={dataKey}
      defaultValue={defaultPerTemplate(component)}
      render={({ field }) => {
        const hasInteracted =
          field.value !== null && field.value !== undefined;
        const [loVal, hiVal] = hasInteracted
          ? (field.value as [number, number])
          : defaultValue;

        return (
          <div className="flex flex-col gap-1">
            <div className="mb-2 flex items-center justify-between">
              <Label context={context}>{component.props.label}</Label>
              {component.props.showValue && hasInteracted && (
                <span className="text-content-primary text-sm font-medium tabular-nums">
                  {loVal} – {hiVal}
                </span>
              )}
            </div>
            <div className="relative">
              <SliderPrimitive.Root
                value={[loVal, hiVal]}
                min={min}
                max={max}
                step={component.props.step ?? 1}
                onValueChange={([lo, hi]) => field.onChange([lo, hi])}
                className="relative flex h-5 w-full touch-none items-center select-none"
              >
                <SliderPrimitive.Track className="bg-content-secondary/60 relative h-0.5 flex-1 rounded-full">
                  <SliderPrimitive.Range
                    className={`absolute h-full rounded-full ${hasInteracted ? 'bg-content-active' : 'bg-transparent'}`}
                  />
                </SliderPrimitive.Track>
                {[0, 1].map((i) => (
                  <SliderPrimitive.Thumb
                    key={i}
                    className={`block h-4 w-4 rounded-full outline-none transition-transform duration-100 ease-out focus-visible:ring-ring/50 cursor-grab focus-visible:ring-4 active:scale-125 active:cursor-grabbing ${hasInteracted ? 'bg-content-active' : 'bg-content-secondary/60'}`}
                  />
                ))}
              </SliderPrimitive.Root>
            </div>
            {(component.props.minLabel || component.props.maxLabel) && (
              <div className="mt-0 flex justify-between">
                <span className="text-content-secondary w-full max-w-2/5 text-left text-xs tracking-wide uppercase">
                  {component.props.minLabel
                    ? resolveValuesInString(component.props.minLabel, context)
                    : undefined}
                </span>
                <span className="text-content-secondary w-full max-w-2/5 text-right text-xs tracking-wide uppercase">
                  {component.props.maxLabel
                    ? resolveValuesInString(component.props.maxLabel, context)
                    : undefined}
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
