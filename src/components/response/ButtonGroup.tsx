'use client';

import { ButtonGroupComponent, Option } from '@/lib/components/response';
import { resolveValuesInString } from '@/lib/resolve';
import { Context } from '@/lib/types';
import { Check, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Controller, UseFormReturn } from 'react-hook-form';
import { twMerge } from 'tailwind-merge';
import { FieldError, resolveOptions } from '../primitives';

type Props = {
  component: ButtonGroupComponent;
  form: UseFormReturn<Record<string, any>>;
  context: Context;
  sharedOptions?: Record<string, Option[]>;
  triggerSubmit?: () => void;
};

export function ButtonGroup({
  component,
  form,
  context,
  sharedOptions,
  triggerSubmit,
}: Props) {
  const {
    control,
    setValue,
    formState: { errors },
  } = form;

  const {
    dataKey,
    correctKey,
    showFeedback = false,
    advanceAfterMs,
    storeIsCorrect = false,
    label,
  } = component.props;

  const [picked, setPicked] = useState<string | null>(null);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const options = resolveOptions(
    component.props.options,
    context,
    dataKey,
    sharedOptions,
  );

  function handlePick(onChange: (v: string) => void, value: string) {
    if (picked !== null) return;

    onChange(value);

    if (storeIsCorrect && correctKey !== undefined) {
      setValue(`${dataKey}:correct`, value === correctKey, {
        shouldValidate: false,
      });
    }

    setPicked(value);

    if (advanceAfterMs !== undefined) {
      timerRef.current = setTimeout(() => {
        triggerSubmit?.();
      }, advanceAfterMs);
    }
  }

  function handleKeyDown(
    e: React.KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
      e.preventDefault();
      const next = (index + 1) % options.length;
      setFocusedIndex(next);
      buttonRefs.current[next]?.focus();
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const prev = (index - 1 + options.length) % options.length;
      setFocusedIndex(prev);
      buttonRefs.current[prev]?.focus();
    }
  }

  return (
    <Controller
      control={control}
      name={dataKey}
      defaultValue=""
      render={({ field }) => (
        <div className="flex flex-col gap-1">
          <div
            role="group"
            aria-label={label ?? 'Choose an answer'}
            className="flex flex-col gap-2"
          >
            {options.map((opt, i) => {
              const isPicked = picked === opt.value;
              const isCorrect = opt.value === correctKey;
              const isDisabled = picked !== null;

              let stateClasses = '';
              let feedbackIcon: React.ReactNode = '';

              if (showFeedback) {
                if (picked !== null && isCorrect) {
                  stateClasses =
                    'border-primary bg-primary/10 text-primary font-medium';
                }
              }
              if (isPicked && showFeedback && correctKey !== undefined) {
                if (isCorrect) {
                  stateClasses =
                    'border-primary bg-primary/10 text-primary font-medium';
                  feedbackIcon = <Check className="mb-px inline" size={16} />;
                } else {
                  stateClasses =
                    'border-error bg-error/10 text-error font-medium';
                  feedbackIcon = <X className="mb-px inline" size={16} />;
                }
              } else if (isPicked) {
                stateClasses =
                  'border-primary bg-primary/10 text-primary font-medium';
              }

              return (
                <button
                  key={opt.value}
                  ref={(el) => {
                    buttonRefs.current[i] = el;
                  }}
                  type="button"
                  disabled={isDisabled}
                  tabIndex={focusedIndex === i ? 0 : -1}
                  onFocus={() => setFocusedIndex(i)}
                  onKeyDown={(e) => handleKeyDown(e, i)}
                  onClick={() => handlePick(field.onChange, opt.value)}
                  className={twMerge(
                    'w-full rounded-sm border px-4 py-3 text-left text-sm',
                    'transition-[transform,background-color,border-color,color,opacity] duration-150 ease-out',
                    'border-border-default text-content-primary bg-transparent',
                    'focus-visible:ring-ring/50 focus-visible:ring-2 focus-visible:outline-none',
                    !isDisabled &&
                    'hover:bg-background-surface cursor-pointer active:scale-[0.98]',
                    isDisabled && !isPicked && 'cursor-not-allowed opacity-40',
                    isDisabled && 'active:scale-100',
                    stateClasses,
                    'flex flex-row items-center justify-between',
                  )}
                >
                  {resolveValuesInString(opt.label, context)}
                  {feedbackIcon}
                </button>
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
