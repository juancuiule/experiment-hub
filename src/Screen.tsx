'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

import { Option } from '@/lib/components/response';
import { FrameworkScreen } from '@/lib/screen';
import { buildScreenBindings } from '@/lib/screen-bindings';
import { Context, ContextData } from '@/lib/types';
import { DataSection } from './components/DataTree';
import { RenderComponent } from './components/RenderComponent';

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
  const { schema, defaultValues } = buildScreenBindings(
    screen.components,
    context,
  );
  const form = useForm<ContextData>({
    resolver: zodResolver(schema),
    defaultValues,
    shouldUnregister: true,
  });

  const onSubmit = (data: ContextData) => {
    const shuffledOptions = context.screenData?.shuffledOptions ?? {};
    const orders = Object.fromEntries(
      Object.entries(shuffledOptions)
        .filter(([key]) => key in data)
        .map(([key, opts]) => [
          `${key}:order`,
          (opts as Array<{ value: string }>).map((o) => o.value),
        ]),
    );
    onNext({ ...data, ...orders }).catch((err) =>
      console.error('Failed to advance experiment:', err),
    );
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
            context={context}
            isLoading={isLoading}
            sharedOptions={sharedOptions}
          />
        ))}
      </form>
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
