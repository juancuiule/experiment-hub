'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import { deepMerge } from '@experiment-hub/engine/flow';
import { buildScreenBindings } from '@experiment-hub/engine/screen-bindings';
import type { FrameworkScreen } from '@experiment-hub/engine/screen';
import type { Context, ContextData, ExperimentFlow } from '@experiment-hub/engine/types';
import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { RenderComponent } from '@/src/components/RenderComponent';
import { buildMockContext } from './mock-context';

/**
 * Renders a screen's real component tree with a generated context — `$$`/`@`/`#`
 * refs resolve to plausible fakes, form controls are live (answers update `$`
 * refs via the same form.watch() merge Screen uses). Non-submitting.
 */
export default function LiveScreenPreview({
  flow,
  screen,
  overrides,
}: {
  flow: ExperimentFlow;
  screen: FrameworkScreen;
  overrides?: Record<string, ContextData>;
}) {
  const context = useMemo(
    () => buildMockContext(flow, screen, overrides),
    [flow, screen, overrides],
  );
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
  const liveContext = useMemo<Context>(
    () => deepMerge(context, { screenData }),
    [context, screenData],
  );

  return (
    <form
      onSubmit={(e) => e.preventDefault()}
      className="flex flex-col gap-4"
    >
      {screen.components.map((component, i) => (
        <RenderComponent
          key={
            component.componentFamily === 'response'
              ? (component.props as { dataKey?: string }).dataKey
              : i
          }
          component={component}
          form={form}
          context={liveContext}
          isLoading={false}
          sharedOptions={flow.options}
        />
      ))}
    </form>
  );
}
