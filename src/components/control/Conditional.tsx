"use client";

import { ScreenComponent } from "@/lib/components";
import { ConditionalComponent } from "@/lib/components/control";
import { evaluateCondition } from "@/lib/conditions";
import { Context } from "@/lib/types";
import { UseFormReturn, useWatch } from "react-hook-form";
import { RenderProps } from "../primitives";

type Props = {
  component: ConditionalComponent;
  form: UseFormReturn<Record<string, any>>;
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
  const formValues = useWatch({ control: form.control });
  const {
    if: condition,
    component: innerComponent,
    else: elseComponent,
  } = component.props;

  const enrichedContext: Context = {
    ...context,
    screenData: formValues as Record<string, any>,
  };
  const shouldRender = evaluateCondition(condition, enrichedContext);

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
