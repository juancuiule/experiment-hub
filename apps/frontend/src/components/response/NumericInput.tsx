'use client';

import { NumericInputComponent } from '@experiment-hub/engine/components/response';
import { resolveValuesInString } from '@experiment-hub/engine/resolve';
import { Context, ContextData } from '@experiment-hub/engine/types';
import { UseFormReturn } from 'react-hook-form';
import { Input } from '../Input';
import { Label } from '../Label';
import { FieldError } from '../primitives';

type Props = {
  component: NumericInputComponent;
  form: UseFormReturn<ContextData>;
  context: Context;
};

export function NumericInput({ component, form, context }: Props) {
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
        {...register(dataKey, { valueAsNumber: true })}
        type="number"
        onWheel={(e) => e.currentTarget.blur()}
        placeholder={
          placeholder ? resolveValuesInString(placeholder, context) : undefined
        }
        min={component.props.min}
        max={component.props.max}
        step={component.props.step}
      />
      <FieldError message={errors[dataKey]?.message as string | undefined} />
    </div>
  );
}
