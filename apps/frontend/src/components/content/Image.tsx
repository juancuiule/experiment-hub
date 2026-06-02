'use client';

import { ImageComponent } from '@experiment-hub/engine/components/content';
import {
  resolveInterpolatedImageUrl,
  resolveValuesInString,
} from '@experiment-hub/engine/resolve';
import { Context } from '@experiment-hub/engine/types';
import { twMerge } from 'tailwind-merge';

type Props = {
  component: ImageComponent;
  context: Context;
};

export function Image({ component, context }: Props) {
  const alt = resolveValuesInString(component.props.alt, context);
  const src = component.props.url.includes('{{')
    ? resolveInterpolatedImageUrl(component.props.url, context)
    : component.props.url;

  return (
    <div className="my-3">
      <img
        src={src ?? undefined}
        alt={alt}
        className={twMerge('w-full', component.props.className)}
      />
    </div>
  );
}
