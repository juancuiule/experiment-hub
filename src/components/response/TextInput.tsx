"use client";

import { TextInputComponent } from "@/lib/components/response";
import { resolveValuesInString } from "@/lib/resolve";
import { Context, ContextData } from "@/lib/types";
import { UseFormReturn } from "react-hook-form";
import { Input } from "../Input";
import { Label } from "../Label";
import { FieldError } from "../primitives";

type Props = {
  component: TextInputComponent;
  form: UseFormReturn<ContextData>;
  context: Context;
};

export function TextInput({ component, form, context }: Props) {
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
      <Input
        id={dataKey}
        {...register(dataKey)}
        type="text"
        placeholder={placeholder ? resolveValuesInString(placeholder, context) : undefined}
      />
      <FieldError message={errors[dataKey]?.message as string | undefined} />
    </div>
  );
}
