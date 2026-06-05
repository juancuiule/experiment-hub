'use client';

import {
  defaultPerTemplate,
  RangeSliderComponent,
} from '@experiment-hub/engine/components/response';
import { resolveValuesInString } from '@experiment-hub/engine/resolve';
import { Context, ContextData } from '@experiment-hub/engine/types';
import * as SliderPrimitive from '@radix-ui/react-slider';
import { Controller, UseFormReturn } from 'react-hook-form';
import { twMerge } from 'tailwind-merge';
import { Label } from '../Label';
import { FieldError } from '../primitives';

type Props = {
  component: RangeSliderComponent;
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

// Explicit strings so Tailwind's scanner picks up both variants at build time.
// Quoted attribute values ("0"/"1") are required by the CSS spec.
const THUMB_TOOLTIP_ACTIVE_CLASS = [
  '[[data-active-thumb="0"]_&]:opacity-100 [[data-active-thumb="0"]_&]:scale-100',
  '[[data-active-thumb="1"]_&]:opacity-100 [[data-active-thumb="1"]_&]:scale-100',
] as const;

export function RangeSlider({ component, form, context }: Props) {
  const {
    control,
    formState: { errors },
  } = form;
  const { dataKey } = component.props;
  const min = component.props.min ?? 0;
  const max = component.props.max ?? 100;
  const hasExplicitDefault = component.props.defaultValue !== undefined;
  const defaultValue = component.props.defaultValue ?? [min, max];

  return (
    <Controller
      control={control}
      name={dataKey}
      defaultValue={defaultPerTemplate(component)}
      render={({ field }) => {
        const hasInteracted = field.value !== null && field.value !== undefined;
        const [loVal, hiVal] = hasInteracted
          ? (field.value as [number, number])
          : defaultValue;

        const showThumbs = hasInteracted || hasExplicitDefault;
        const thumbClass = hasInteracted
          ? 'bg-content-active'
          : showThumbs
            ? 'bg-content-secondary/60'
            : 'cursor-pointer opacity-0';

        const tooltipConfig = component.props.tooltip;
        const loPercent = ((loVal - min) / (max - min)) * 100;
        const hiPercent = ((hiVal - min) / (max - min)) * 100;

        return (
          <div className="flex flex-col gap-1">
            <div className="mb-2 flex items-center justify-between">
              <Label context={context} tooltip={component.props.labelTooltip}>
                {component.props.label}
              </Label>
              {component.props.showValue && hasInteracted && (
                <span className="text-content-primary text-sm font-medium tabular-nums">
                  {loVal} – {hiVal}
                </span>
              )}
            </div>
            <div data-slider className="relative">
              {tooltipConfig &&
                hasInteracted &&
                [
                  { val: loVal, percent: loPercent, idx: 0 },
                  { val: hiVal, percent: hiPercent, idx: 1 },
                ].map(({ val, percent, idx }) => (
                  <div
                    key={idx}
                    style={{
                      left: `calc(${percent}% + ${8 * (1 - (2 * percent) / 100)}px)`,
                    }}
                    className={twMerge(
                      'pointer-events-none absolute bottom-7 z-50 flex origin-bottom -translate-x-1/2 scale-95 flex-col items-center opacity-0 transition-[opacity,transform] duration-150 ease-out',
                      THUMB_TOOLTIP_ACTIVE_CLASS[idx],
                    )}
                  >
                    <div className="bg-content-active text-content-inverted rounded-md px-2 py-1 text-sm font-medium whitespace-nowrap tabular-nums shadow-md">
                      {formatTooltipValue(val, tooltipConfig)}
                    </div>
                    <div
                      className="bg-content-active -mt-px h-1.5 w-3"
                      style={{ clipPath: 'polygon(50% 100%, 0 0, 100% 0)' }}
                    />
                  </div>
                ))}
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
                    onFocus={(e) => {
                      e.currentTarget
                        .closest('[data-slider]')
                        ?.setAttribute('data-active-thumb', String(i));
                    }}
                    onBlur={(e) => {
                      e.currentTarget
                        .closest('[data-slider]')
                        ?.removeAttribute('data-active-thumb');
                    }}
                    className={twMerge(
                      'block h-4 w-4 rounded-full transition-transform duration-100 ease-out outline-none',
                      showThumbs
                        ? 'focus-visible:ring-ring/50 cursor-grab focus-visible:ring-4 active:scale-125 active:cursor-grabbing'
                        : '',
                      thumbClass,
                    )}
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
