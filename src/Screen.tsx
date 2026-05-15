"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { FrameworkScreen } from "@/lib/screen";
import { ScreenComponent } from "@/lib/components";
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

function collectDefaults(
  components: ScreenComponent[],
  values: Record<string, any> = {},
): Record<string, any> {
  for (const c of components) {
    if (c.componentFamily !== "response") {
      if (c.componentFamily === "layout" && c.template === "group") {
        collectDefaults(c.props.components, values);
      } else if (c.componentFamily === "control" && c.template === "conditional") {
        // Known limitation: a for-each wrapping a conditional is not recursed here (deferred).
        // Known limitation: the else branch of a conditional is not enforced in superRefine (deferred).
        collectDefaults([c.props.component], values);
        if (c.props.else) collectDefaults([c.props.else], values);
      } else if (c.componentFamily === "control" && c.template === "for-each" && c.props.type === "static") {
        const inner = c.props.component;
        for (let i = 0; i < c.props.values.length; i++) {
          let resolved: ScreenComponent;
          if (inner.componentFamily === "response") {
            // `inner` is narrowed to ResponseComponent here; spread is type-safe.
            // The explicit cast is needed because spreading a union-typed `props`
            // with an overridden `dataKey` cannot be unified back to the specific
            // variant by TypeScript without a widening assertion.
            resolved = {
              ...inner,
              props: { ...inner.props, dataKey: inner.props.dataKey.replace("@index", String(i)) },
            } as typeof inner;
          } else {
            resolved = inner;
          }
          collectDefaults([resolved], values);
        }
      }
      continue;
    }
    switch (c.template) {
      case "checkboxes":
        values[c.props.dataKey] = [];
        break;
      case "single-checkbox":
        values[c.props.dataKey] = c.props.defaultValue ?? false;
        break;
      case "slider":
        values[c.props.dataKey] = c.props.requiresInteraction
          ? null
          : (c.props.defaultValue ?? c.props.min ?? 0);
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

function buildDefaultValues(screen: FrameworkScreen): Record<string, any> {
  return collectDefaults(screen.components);
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
    </form>
  );
}
