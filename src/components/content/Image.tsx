"use client";

import { ImageComponent } from "@/lib/components/content";
import { resolveValuesInString } from "@/lib/resolve";
import { Context } from "@/lib/types";

type Props = {
  component: ImageComponent;
  context: Context;
};

function resolveInterpolatedImageUrl(
  template: string,
  context: Context,
): string | null {
  const resolved = resolveValuesInString(template, context).trim();
  if (!resolved || resolved.startsWith("//")) return null;
  if (
    resolved.startsWith("/") ||
    resolved.startsWith("./") ||
    resolved.startsWith("../")
  ) {
    return resolved;
  }
  try {
    const parsed = new URL(resolved);
    return parsed.protocol === "http:" || parsed.protocol === "https:"
      ? resolved
      : null;
  } catch {
    return null;
  }
}

export function Image({ component, context }: Props) {
  const alt = resolveValuesInString(component.props.alt, context);
  const src = component.props.url.includes("{{")
    ? resolveInterpolatedImageUrl(component.props.url, context)
    : component.props.url;

  return (
    <div className="my-3">
      <img src={src ?? undefined} alt={alt} className="w-full" />
    </div>
  );
}
