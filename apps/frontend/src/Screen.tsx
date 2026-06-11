'use client';

import { useMemo } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

import { deepMerge } from '@experiment-hub/engine/flow';
import { Option } from '@experiment-hub/engine/components/response';
import { FrameworkScreen } from '@experiment-hub/engine/screen';
import { augmentSubmitData, buildScreenBindings } from '@experiment-hub/engine/screen-bindings';
import { Context, ContextData } from '@experiment-hub/engine/types';
import { useExperimentStore } from './data/store';
import { RenderComponent } from './components/RenderComponent';
import { DataSection } from './debug/DataTree';

type ScreenProps = {
  screen: FrameworkScreen;
  isLoading: boolean;
  onNext: (data?: ContextData) => Promise<void>;
  context: Context;
  sharedOptions?: Record<string, Option[]>;
};

export function Screen({
  screen,
  isLoading,
  onNext,
  context,
  sharedOptions,
}: ScreenProps) {
  const { schema, defaultValues } = useMemo(
    () => buildScreenBindings(screen.components, context),
    [screen, context],
  );
  const form = useForm<ContextData>({
    resolver: zodResolver(schema),
    defaultValues,
    shouldUnregister: true,
  });

  const screenData = form.watch();
  const liveContext = useMemo(
    () => deepMerge(context, { screenData }),
    [context, screenData],
  );

  const error = useExperimentStore((s) => s.error);

  const onSubmit = (data: ContextData) => {
    onNext(augmentSubmitData(data, context));
  };

  return (
    <>
      <form
        className="flex h-full flex-1 flex-col gap-4"
        key={screen.slug}
        onSubmit={form.handleSubmit(onSubmit)}
      >
        {screen.components.map((component, i) => (
          <RenderComponent
            key={
              component.componentFamily === 'response'
                ? component.props.dataKey
                : i
            }
            component={component}
            form={form}
            context={liveContext}
            isLoading={isLoading}
            sharedOptions={sharedOptions}
          />
        ))}
      </form>
      {error && (
        <p className="text-error my-2" role="alert">
          {error}
        </p>
      )}
      {process.env.NODE_ENV === 'development' && (
        <details className="my-2">
          <summary className="text-content-secondary cursor-pointer text-xs">
            Form Data (for debugging)
          </summary>
          <DataSection title="form" data={form.watch()} />
        </details>
      )}
    </>
  );
}
