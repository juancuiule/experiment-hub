'use client';

import { VideoComponent } from '@experiment-hub/engine/components/content';

type Props = {
  component: VideoComponent;
};

export function Video({ component }: Props) {
  return (
    <div className="my-3">
      <video
        src={component.props.url}
        autoPlay={component.props.autoplay}
        muted={component.props.muted}
        loop={component.props.loop}
        controls={component.props.controls}
        className="w-full"
      />
    </div>
  );
}
