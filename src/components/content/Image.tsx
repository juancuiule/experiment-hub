"use client";

import { ImageComponent } from "@/lib/components/content";
import { resolveInterpolatedImageUrl, resolveValuesInString } from "@/lib/resolve";
import { Context } from "@/lib/types";

type Props = {
  component: ImageComponent;
  context: Context;
};

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
