'use client';

import { ForEachComponent } from '@/lib/components/control';
import { mergeContext } from '@/lib/flow';
import { getValue } from '@/lib/resolve';
import { Context, ContextData } from '@/lib/types';
import { Fragment, useMemo } from 'react';
import { UseFormReturn } from 'react-hook-form';
import { RenderProps } from '../primitives';

type Props = {
  component: ForEachComponent;
  form: UseFormReturn<ContextData>;
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

  const items: string[] = useMemo(() => {
    return component.props.type === 'static'
      ? component.props.values
      : (getValue(component.props.dataKey, context) as string[]) || [];
  }, [context]);

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

        return (
          <Fragment key={`${component.props.id}-${itemValue}`}>
            {renderChild({
              component: template,
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
