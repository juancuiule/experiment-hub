'use client';

import { defaultPerTemplate, SliderComponent } from '@experiment-hub/engine/components/response';
import { resolveValuesInString } from '@experiment-hub/engine/resolve';
import { Context, ContextData } from '@experiment-hub/engine/types';
import * as SliderPrimitive from '@radix-ui/react-slider';
import { Controller, UseFormReturn } from 'react-hook-form';
import { twMerge } from 'tailwind-merge';
import { Label } from '../Label';
import { FieldError } from '../primitives';

type Props = {
  component: SliderComponent;
  form: UseFormReturn<ContextData>;
  context: Context;
};

function formatTooltipValue(
  value: number,
  tooltip: true | { prefix?: string; suffix?: string },
): string {
  if (tooltip === true) return String(value);
  return `${tooltip.prefix ?? ''}${value}${tooltip.suffix ?? ''}`;
}

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
      defaultValue={defaultPerTemplate(component)}
      render={({ field }) => {
        const hasInteracted = field.value !== null && field.value !== undefined;
        const defaultValue = component.props.defaultValue;
        const showThumb = hasInteracted || defaultValue !== undefined;
        const thumbPosition = hasInteracted
          ? (field.value as number)
          : (defaultValue ?? min);

        const thumbClass = hasInteracted
          ? 'bg-content-active'
          : showThumb
            ? 'bg-content-secondary/60'
            : 'cursor-pointer opacity-0';

        const tooltipConfig = component.props.tooltip;
        const shouldShowTooltip = !!tooltipConfig && hasInteracted;
        const percent = ((thumbPosition - min) / (max - min)) * 100;

        return (
          <div className="flex flex-col gap-1">
            <div className="mb-2 flex items-center justify-between">
              <Label context={context}>{component.props.label}</Label>
              {component.props.showValue && hasInteracted && (
                <span className="text-content-primary text-sm font-medium tabular-nums">
                  {field.value}
                </span>
              )}
            </div>
            <div className="group relative">
              {shouldShowTooltip && (
                <div
                  style={{
                    left: `calc(${percent}% + ${8 * (1 - (2 * percent) / 100)}px)`,
                  }}
                  className="pointer-events-none absolute bottom-7 z-50 flex origin-bottom -translate-x-1/2 scale-95 flex-col items-center opacity-0 transition-[opacity,transform] duration-150 ease-out group-focus-within:scale-100 group-focus-within:opacity-100 group-active:scale-100 group-active:opacity-100"
                >
                  <div className="bg-content-active text-content-inverted rounded-md px-2 py-1 text-sm font-medium whitespace-nowrap tabular-nums shadow-md">
                    {formatTooltipValue(thumbPosition, tooltipConfig)}
                  </div>
                  <div
                    className="bg-content-active -mt-px h-1.5 w-3"
                    style={{ clipPath: 'polygon(50% 100%, 0 0, 100% 0)' }}
                  />
                </div>
              )}
              <SliderPrimitive.Root
                value={[thumbPosition]}
                min={min}
                max={max}
                step={component.props.step ?? 1}
                onValueChange={([val]) => field.onChange(val)}
                className="group relative flex h-5 w-full touch-none items-center select-none"
              >
                <SliderPrimitive.Track className="bg-content-secondary/60 relative h-0.5 flex-1 rounded-full">
                  <SliderPrimitive.Range
                    className={`absolute h-full rounded-full ${hasInteracted ? 'bg-content-active' : 'bg-transparent'}`}
                  />
                </SliderPrimitive.Track>
                <SliderPrimitive.Thumb
                  className={twMerge(
                    'block h-4 w-4 rounded-full transition-transform duration-100 ease-out outline-none',
                    hasInteracted || showThumb
                      ? 'focus-visible:ring-ring/50 cursor-grab group-active:scale-125 group-active:cursor-grabbing focus-visible:ring-4'
                      : '',
                    thumbClass,
                  )}
                />
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
