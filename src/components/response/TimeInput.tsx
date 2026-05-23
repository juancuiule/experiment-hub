"use client";

import { TimeInputComponent } from "@/lib/components/response";
import { Context, ScreenFormData } from "@/lib/types";
import { UseFormReturn } from "react-hook-form";
import { Input } from "../Input";
import { Label } from "../Label";
import { FieldError } from "../primitives";

type Props = {
  component: TimeInputComponent;
  form: UseFormReturn<ScreenFormData>;
  context: Context;
};

export function TimeInput({ component, form, context }: Props) {
  const {
    register,
    formState: { errors },
  } = form;
  const { dataKey } = component.props;

  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={dataKey} context={context}>
        {component.props.label}
      </Label>
      <Input id={dataKey} {...register(dataKey)} type="time" />
      <FieldError message={errors[dataKey]?.message as string | undefined} />
    </div>
  );
}
