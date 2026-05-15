"use client";

import { TextAreaComponent } from "@/lib/components/response";
import { resolveValuesInString } from "@/lib/resolve";
import { Context } from "@/lib/types";
import { UseFormReturn } from "react-hook-form";
import { twMerge } from "tailwind-merge";
import { Label } from "../Label";
import { FieldError, inputBase } from "../primitives";

type Props = {
  component: TextAreaComponent;
  form: UseFormReturn<Record<string, any>>;
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
          "border-b border-gray-300 py-1 outline-none bg-transparent w-full placeholder:text-gray-500 focus:border-black transition-colors text-sm",
          "resize-none",
        )}
      />
      <FieldError message={errors[dataKey]?.message as string | undefined} />
    </div>
  );
}
