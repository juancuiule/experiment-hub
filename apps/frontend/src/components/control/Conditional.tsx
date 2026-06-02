'use client';

import { ScreenComponent } from '@experiment-hub/engine/components';
import { ConditionalComponent } from '@experiment-hub/engine/components/control';
import { evaluateCondition } from '@experiment-hub/engine/conditions';
import { Context, ContextData } from '@experiment-hub/engine/types';
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
    then: innerComponent,
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
