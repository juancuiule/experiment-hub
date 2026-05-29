'use client';

import { AudioComponent } from '@/lib/components/content';

type Props = {
  component: AudioComponent;
};

export function Audio({ component }: Props) {
  return (
    <div className="my-3">
      <audio
        src={component.props.url}
        autoPlay={component.props.autoplay}
        loop={component.props.loop}
        controls={component.props.controls ?? true}
        className="w-full"
      />
    </div>
  );
}
