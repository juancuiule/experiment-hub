'use client';

import { ForEachComponent } from '@experiment-hub/engine/components/control';
import { mergeContext } from '@experiment-hub/engine/flow';
import { getValue } from '@experiment-hub/engine/resolve';
import { Context, ContextData } from '@experiment-hub/engine/types';
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
    // A randomized for-each has its presentation order computed once at screen
    // entry and stored in context; prefer it so the order is stable across
    // re-renders and never recomputed locally.
    const shuffled =
      context.screenData?.shuffledForeachOrders?.[component.props.id];
    if (shuffled) return shuffled;

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
          <Fragment key={`${component.props.id}-${JSON.stringify(itemValue)}`}>
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
