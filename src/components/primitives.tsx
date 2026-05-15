"use client";

import { ScreenComponent } from "@/lib/components";
import { Option, OptionsSource } from "@/lib/components/response";
import { getValue } from "@/lib/resolve";
import { Context } from "@/lib/types";
import { UseFormReturn } from "react-hook-form";

export type RenderProps = {
  component: ScreenComponent;
  form: UseFormReturn<Record<string, any>>;
  context: Context;
  isLoading: boolean;
};

export function resolveOptions(
  options: OptionsSource,
  context: Context,
  dataKey?: string,
): Option[] {
  if (dataKey && context.screenData?.shuffledOptions?.[dataKey]) {
    return context.screenData.shuffledOptions[dataKey] as Option[];
  }
  if (Array.isArray(options)) return options;
  const value = getValue(options, context);
  if (!Array.isArray(value)) return [];
  return value.map((item: unknown) =>
    typeof item === "string" ? { label: item, value: item } : (item as Option),
  );
}

export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p role="alert" aria-live="polite" className="text-error text-xs mt-1">{message}</p>;
}

export function CheckIcon() {
  return (
    <svg className="size-3 text-white" viewBox="0 0 12 12" fill="none">
      <path
        d="M2 6l3 3 5-5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ChevronDownIcon() {
  return (
    <svg className="size-4 text-gray-400" viewBox="0 0 16 16" fill="none">
      <path
        d="M4 6l4 4 4-4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
