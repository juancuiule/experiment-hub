"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { ScreenComponent } from "@/lib/components";
import { FrameworkScreen } from "@/lib/screen";
import { Context } from "@/lib/types";
import { buildSchema } from "@/lib/validation";
import { RenderComponent } from "./components/RenderComponent";
import { DataSection } from "./Debug";

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

function collectDefaults(
  components: ScreenComponent[],
  context: Context,
  values: Record<string, any> = {},
): Record<string, any> {
  for (const c of components) {
    if (c.componentFamily !== "response") {
      if (c.componentFamily === "layout" && c.template === "group") {
        collectDefaults(c.props.components, context, values);
      } else if (c.componentFamily === "control" && c.template === "conditional") {
        collectDefaults([c.props.component], context, values);
        if (c.props.else) collectDefaults([c.props.else], context, values);
      } else if (
        c.componentFamily === "control" &&
        c.template === "for-each" &&
        c.props.type === "static"
      ) {
        const inner = c.props.component;
        for (let i = 0; i < c.props.values.length; i++) {
          let resolved: ScreenComponent;
          if (inner.componentFamily === "response") {
            resolved = {
              ...inner,
              props: {
                ...inner.props,
                dataKey: inner.props.dataKey.replace("@index", String(i)),
              },
            } as typeof inner;
          } else {
            resolved = inner;
          }
          collectDefaults([resolved], context, values);
        }
      }
      continue;
    }
    switch (c.template) {
      case "radio":
      case "dropdown":
        values[c.props.dataKey] = "";
        break;
      case "checkboxes":
        values[c.props.dataKey] = [];
        break;
      case "single-checkbox":
        values[c.props.dataKey] = c.props.defaultValue ?? false;
        break;
      case "slider":
        values[c.props.dataKey] = null;
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

function buildDefaultValues(
  screen: FrameworkScreen,
  context: Context,
): Record<string, any> {
  return collectDefaults(screen.components, context);
}


// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export function Screen({ screen, isLoading, onNext, context }: ScreenProps) {
  const form = useForm<Record<string, any>>({
    resolver: zodResolver(buildSchema(screen)),
    // TODO: this defaultValues are only valid at initial render
    // if a component is added/removed during the screen, the defaultValues won't be updated
    // because we are using shouldUnregister: true, when a component is removed, its value will be removed from the form state
    // and we should move the defaultValues logic in the "register" of each component, so when a component is added, its default value will be set in the form state
    defaultValues: buildDefaultValues(screen, context),
    shouldUnregister: true,
  });

  const onSubmit = (data: Record<string, any>) => {
    const shuffledOptions = context.screenData?.shuffledOptions ?? {};
    const orders = Object.fromEntries(
      Object.entries(shuffledOptions)
        .filter(([key]) => key in data)
        .map(([key, opts]) => [`${key}__order`, (opts as Array<{ value: string }>).map((o) => o.value)]),
    );
    onNext({ ...data, ...orders }).catch((err) =>
      console.error("Failed to advance experiment:", err),
    );
  };

  return (
    <form
      className="h-full flex-1 flex flex-col gap-4"
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
      <div className="flex flex-col gap-3">
        <DataSection title="form" data={form.watch()} />
      </div>
    </form>
  );
}
