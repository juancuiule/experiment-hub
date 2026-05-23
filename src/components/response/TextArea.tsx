"use client";

import { TextAreaComponent } from "@/lib/components/response";
import { resolveValuesInString } from "@/lib/resolve";
import { Context, ContextData } from "@/lib/types";
import { UseFormReturn } from "react-hook-form";
import { twMerge } from "tailwind-merge";
import { Label } from "../Label";
import { FieldError } from "../primitives";

type Props = {
  component: TextAreaComponent;
  form: UseFormReturn<ContextData>;
  context: Context;
};

export function TextArea({ component, form, context }: Props) {
  const {
    register,
    formState: { errors },
  } = form;
  const { dataKey, placeholder } = component.props;

  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={dataKey} context={context}>
        {component.props.label}
      </Label>
      <textarea
        id={dataKey}
        {...register(dataKey)}
        rows={component.props.lines ?? 4}
        placeholder={placeholder ? resolveValuesInString(placeholder, context) : undefined}
        className={twMerge(
          "border-b border-border-default py-1 outline-none bg-transparent w-full placeholder:text-content-secondary focus:border-content-active transition-[border-color,color] duration-150 ease-out text-sm",
          "resize-none",
        )}
      />
      <FieldError message={errors[dataKey]?.message as string | undefined} />
    </div>
  );
}
