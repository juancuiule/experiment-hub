"use client";

import { ButtonComponent } from "@/lib/components/layout";
import { resolveValuesInString } from "@/lib/resolve";
import { Context } from "@/lib/types";
import { twMerge } from "tailwind-merge";

type Props = {
  component: ButtonComponent;
  isLoading: boolean;
  context: Context;
};

export function Button({ component, isLoading, context }: Props) {
  const text = component.props.text
    ? resolveValuesInString(component.props.text, context)
    : "Continue";
  return (
    <div className={twMerge(component.props.alignBottom ? "mt-auto pt-5" : "")}>
      <button
        type="submit"
        disabled={component.props.disabled || isLoading}
        className="w-full h-10 bg-background-inverted text-content-inverted uppercase text-sm font-medium tracking-wide rounded-sm hover:bg-background-inverted/80 active:scale-[0.98] disabled:active:scale-100 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition duration-150 ease-out"
      >
        {isLoading ? "…" : text}
      </button>
    </div>
  );
}
