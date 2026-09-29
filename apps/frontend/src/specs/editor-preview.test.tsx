import { render, screen } from '@testing-library/react';
import type { ExperimentFlow } from '@experiment-hub/engine/types';
import { describe, expect, it } from 'vitest';
import LiveScreenPreview from '../editor/LiveScreenPreview';
import { buildMockContext } from '../editor/mock-context';

const flow: ExperimentFlow = {
  nodes: [
    { id: 'start', type: 'start' },
    {
      id: 'prior',
      type: 'screen',
      props: { slug: 'prior' },
    },
    {
      id: 'loop-items',
      type: 'loop',
      props: {
        type: 'dynamic',
        dataKey: '$$config.items',
      },
    },
    { id: 'screen-main', type: 'screen', props: { slug: 'main' } },
  ],
  edges: [
    { type: 'sequential', from: 'start', to: 'prior' },
    { type: 'sequential', from: 'prior', to: 'loop-items' },
    { type: 'loop-template', from: 'loop-items', to: 'screen-main' },
  ],
  options: {
    colors: [
      { label: 'Red', value: 'red' },
      { label: 'Blue', value: 'blue' },
    ],
  },
  screens: [
    {
      slug: 'prior',
      components: [
        {
          componentFamily: 'response',
          template: 'slider',
          props: { dataKey: 'confidence', label: 'Confidence?', min: 0, max: 10 },
        },
      ],
    },
    {
      slug: 'main',
      components: [
        {
          componentFamily: 'content',
          template: 'rich-text',
          props: {
            content:
              'Prior: {{$$prior.confidence}} — item {{@loop-items.value.label}}',
          },
        },
        {
          componentFamily: 'control',
          template: 'for-each',
          props: {
            type: 'dynamic',
            dataKey: '$$config.items',
            id: 'fe',
            component: {
              componentFamily: 'response',
              template: 'text-input',
              props: {
                dataKey: 'note-{{#fe.value.id}}',
                label: 'Note for {{#fe.value.label}}',
              },
            },
          },
        },
        {
          componentFamily: 'response',
          template: 'radio',
          props: {
            dataKey: 'pick',
            label: 'Pick',
            options: '%colors',
          },
        },
      ],
    },
  ],
};

describe('buildMockContext', () => {
  const main = flow.screens!.find((s) => s.slug === 'main')!;
  const ctx = buildMockContext(flow, main);

  it('fakes $$ refs from producer screen field types', () => {
    // prior.confidence is a slider 0-10 → mid value
    expect(ctx.data?.prior?.confidence).toBe(5);
  });

  it('fakes arrays for $$ refs consumed by for-each dataKeys', () => {
    expect(Array.isArray(ctx.data?.config?.items)).toBe(true);
    expect(ctx.data?.config?.items).toHaveLength(3);
  });

  it('seeds @loop data from the loop dataKey items', () => {
    expect(ctx.loopData?.['loop-items']?.value).toEqual(
      expect.objectContaining({ id: 'item-1' }),
    );
    expect(ctx.loopData?.['loop-items']?.index).toBe(0);
  });

  it('seeds #forEach data under screenData.foreachData', () => {
    expect(ctx.screenData?.foreachData?.fe?.value).toEqual(
      expect.objectContaining({ id: 'item-1' }),
    );
  });
});

describe('LiveScreenPreview', () => {
  it('renders a screen live with mocked refs resolving', () => {
    const main = flow.screens!.find((s) => s.slug === 'main')!;
    render(<LiveScreenPreview flow={flow} screen={main} />);
    // {{$$prior.confidence}} resolved to the fake slider value
    expect(screen.getByText(/Prior: 5/)).toBeTruthy();
    // {{@loop-items.value.label}} resolved
    expect(screen.getByText(/item Item 1/)).toBeTruthy();
    // for-each rendered 3 items → 3 text inputs
    expect(screen.getAllByRole('textbox').length).toBeGreaterThanOrEqual(3);
  });
});
