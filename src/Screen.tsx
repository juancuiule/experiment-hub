"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { FrameworkScreen } from "@/lib/screen";
import { Context } from "@/lib/types";
import { buildSchema } from "@/lib/validation";
import { RenderComponent } from "./components/RenderComponent";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ScreenProps = {
  screen: FrameworkScreen;
  isLoading: boolean;
  onNext: (data?: Record<string, any>) => Promise<void>;
  context: Context;
};

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function buildDefaultValues(screen: FrameworkScreen): Record<string, any> {
  const values: Record<string, any> = {};
  for (const c of screen.components) {
    if (c.componentFamily !== "response") continue;
    switch (c.template) {
      case "checkboxes":
        values[c.props.dataKey] = [];
        break;
      case "single-checkbox":
        values[c.props.dataKey] = c.props.defaultValue ?? false;
        break;
      case "slider":
        values[c.props.dataKey] = c.props.defaultValue ?? c.props.min ?? 0;
        break;
      case "numeric-input":
        values[c.props.dataKey] = c.props.defaultValue ?? null;
        break;
      default:
        values[c.props.dataKey] = "";
    }
  }
  return values;
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export function Screen({ screen, isLoading, onNext, context }: ScreenProps) {
  const form = useForm<Record<string, any>>({
    resolver: zodResolver(buildSchema(screen)),
    defaultValues: buildDefaultValues(screen),
  });

  const onSubmit = (data: Record<string, any>) => {
    onNext(data).catch((err) =>
      console.error("Failed to advance experiment:", err),
    );
  };

  const values = form.watch();

  return (
    <form
      className="h-full flex-1 flex flex-col gap-[var(--field-gap)]"
      key={screen.slug}
      onSubmit={form.handleSubmit(onSubmit)}
    >
      {screen.components.map((component, i) => (
        <RenderComponent
          key={
            component.componentFamily === "response"
              ? component.props.dataKey
              : i
          }
          component={component}
          form={form}
          context={context}
          isLoading={isLoading}
        />
      ))}
      <div className="absolute w-[calc(100vw-512px)] h-[20svh] overflow-y-scroll right-0 top-[80svh] p-2 bg-gray-100">
        <pre className="text-xs">
          <code>{JSON.stringify(values, null, 2)}</code>
        </pre>
      </div>
    </form>
  );
}
