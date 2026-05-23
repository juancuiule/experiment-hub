'use client';

import { ScreenComponent } from '@/lib/components';
import { ConditionalComponent } from '@/lib/components/control';
import { evaluateCondition } from '@/lib/conditions';
import { Context, ContextData } from '@/lib/types';
import { UseFormReturn } from 'react-hook-form';
import { RenderProps } from '../primitives';

type Props = {
  component: ConditionalComponent;
  form: UseFormReturn<ContextData>;
  context: Context;
  isLoading: boolean;
  renderChild: (props: RenderProps) => React.ReactNode;
};

export function Conditional({
  component,
  form,
  context,
  isLoading,
  renderChild,
}: Props) {
  const {
    if: condition,
    component: innerComponent,
    else: elseComponent,
  } = component.props;

  const shouldRender = evaluateCondition(condition, context);

  if (!shouldRender) {
    if (!elseComponent) return null;
    return renderChild({
      component: elseComponent as ScreenComponent,
      form,
      context,
      isLoading,
    });
  }

  return renderChild({
    component: innerComponent as ScreenComponent,
    form,
    context,
    isLoading,
  });
}
