'use client';

import { DateInputComponent } from '@/lib/components/response';
import { Context, ContextData } from '@/lib/types';
import { UseFormReturn } from 'react-hook-form';
import { Input } from '../Input';
import { Label } from '../Label';
import { FieldError } from '../primitives';

type Props = {
  component: DateInputComponent;
  form: UseFormReturn<ContextData>;
  context: Context;
};

export function DateInput({ component, form, context }: Props) {
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
      <Input id={dataKey} {...register(dataKey)} type="date" />
      <FieldError message={errors[dataKey]?.message as string | undefined} />
    </div>
  );
}
