"use client";

import { ScreenComponent } from "@/lib/components";
import { Option, OptionsSource } from "@/lib/components/response";
import { resolveOptionsSource } from "@/lib/resolve";
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
  return resolveOptionsSource(options, context);
}

export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p role="alert" aria-live="polite" className="text-error text-xs mt-1">{message}</p>;
}