'use client';

import { ScreenComponent } from '@/lib/components';
import { GroupComponent } from '@/lib/components/layout';
import { Context, ContextData } from '@/lib/types';
import { Fragment } from 'react';
import { UseFormReturn } from 'react-hook-form';
import { RenderProps } from '../primitives';

type Props = {
  component: GroupComponent;
  form: UseFormReturn<ContextData>;
  context: Context;
  isLoading: boolean;
  renderChild: (props: RenderProps) => React.ReactNode;
};

export function Group({
  component,
  form,
  context,
  isLoading,
  renderChild,
}: Props) {
  return (
    <div className="my-2 flex flex-col gap-0.5">
      {component.props.components.map((child, i) => (
        <Fragment
          key={child.componentFamily === 'response' ? child.props.dataKey : i}
        >
          {renderChild({
            component: child as ScreenComponent,
            form,
            context,
            isLoading,
          })}
        </Fragment>
      ))}
    </div>
  );
}
