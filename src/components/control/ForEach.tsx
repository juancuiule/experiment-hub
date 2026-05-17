"use client";

import { ScreenComponent } from "@/lib/components";
import { ForEachComponent } from "@/lib/components/control";
import { mergeContext } from "@/lib/flow";
import { getValue } from "@/lib/resolve";
import { Context } from "@/lib/types";
import { Fragment, useMemo } from "react";
import { UseFormReturn, useWatch } from "react-hook-form";
import { RenderProps } from "../primitives";

type Props = {
  component: ForEachComponent;
  form: UseFormReturn<Record<string, any>>;
  context: Context;
  isLoading: boolean;
  renderChild: (props: RenderProps) => React.ReactNode;
};

export function ForEach({
  component,
  form,
  context,
  isLoading,
  renderChild,
}: Props) {
  const { component: template } = component.props;
  const formValues = useWatch({ control: form.control });

  const items: string[] = useMemo(() => {
    return component.props.type === "static"
      ? component.props.values
      : (getValue(component.props.dataKey, context) as string[]) || [];
  }, [context, formValues]);

  return (
    <>
      {items.map((itemValue, index) => {
        const itemContext: Context = mergeContext(context, {
          screenData: {
            foreachData: {
              [component.props.id]: { value: itemValue, index },
            },
          },
        });

        const resolvedTemplate: ScreenComponent =
          component.props.type === "static" &&
          template.componentFamily === "response"
            ? {
                ...template,
                props: {
                  ...template.props,
                  dataKey: template.props.dataKey
                    .replace("@index", String(index))
                    .replace("@value", String(itemValue)),
                },
              }
            : template;

        return (
          <Fragment key={`${component.props.id}-${itemValue}`}>
            {renderChild({
              component: resolvedTemplate,
              form,
              context: itemContext,
              isLoading,
            })}
          </Fragment>
        );
      })}
    </>
  );
}
