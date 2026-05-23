import { describe, it, expect } from 'vitest';
import { buildDefaultValues } from '../screen-defaults';
import { ScreenComponent } from '../components';
import { Context } from '../types';

function makeContext(overrides: Partial<Context> = {}): Context {
  return { data: {}, loopData: {}, ...overrides };
}

describe('buildDefaultValues — static for-each', () => {
  it('produces defaults for each value', () => {
    const components: ScreenComponent[] = [
      {
        componentFamily: 'control',
        template: 'for-each',
        props: {
          id: 'loop',
          type: 'static',
          values: ['a', 'b'],
          component: {
            componentFamily: 'response',
            template: 'radio',
            props: {
              dataKey: 'pick-{{#loop.value}}',
              label: 'Pick',
              options: [],
            },
          },
        },
      },
    ];

    const defaults = buildDefaultValues(components, makeContext());
    expect(defaults).toEqual({ 'pick-a': '', 'pick-b': '' });
  });
});

describe('buildDefaultValues — dynamic for-each', () => {
  it('produces defaults when context contains the dataKey values', () => {
    const components: ScreenComponent[] = [
      {
        componentFamily: 'control',
        template: 'for-each',
        props: {
          id: 'loop',
          type: 'dynamic',
          dataKey: '$$items',
          component: {
            componentFamily: 'response',
            template: 'radio',
            props: {
              dataKey: 'pick-{{#loop.value}}',
              label: 'Pick',
              options: [],
            },
          },
        },
      },
    ];

    const defaults = buildDefaultValues(
      components,
      makeContext({ data: { items: ['x', 'y', 'z'] } }),
    );
    expect(defaults).toEqual({ 'pick-x': '', 'pick-y': '', 'pick-z': '' });
  });

  it('produces no defaults when the context key is missing', () => {
    const components: ScreenComponent[] = [
      {
        componentFamily: 'control',
        template: 'for-each',
        props: {
          id: 'loop',
          type: 'dynamic',
          dataKey: '$$missing',
          component: {
            componentFamily: 'response',
            template: 'radio',
            props: {
              dataKey: 'pick-{{#loop.value}}',
              label: 'Pick',
              options: [],
            },
          },
        },
      },
    ];

    const defaults = buildDefaultValues(components, makeContext());
    expect(defaults).toEqual({});
  });

  it('produces [] default for checkboxes inside dynamic for-each', () => {
    const components: ScreenComponent[] = [
      {
        componentFamily: 'control',
        template: 'for-each',
        props: {
          id: 'loop',
          type: 'dynamic',
          dataKey: '$$items',
          component: {
            componentFamily: 'response',
            template: 'checkboxes',
            props: {
              dataKey: 'tags-{{#loop.value}}',
              label: 'Tags',
              options: [],
              required: false,
            },
          },
        },
      },
    ];

    const defaults = buildDefaultValues(
      components,
      makeContext({ data: { items: ['a', 'b'] } }),
    );
    expect(defaults).toEqual({ 'tags-a': [], 'tags-b': [] });
  });

  it('produces null default for slider inside dynamic for-each', () => {
    const components: ScreenComponent[] = [
      {
        componentFamily: 'control',
        template: 'for-each',
        props: {
          id: 'loop',
          type: 'dynamic',
          dataKey: '$$items',
          component: {
            componentFamily: 'response',
            template: 'slider',
            props: {
              dataKey: 'rating-{{#loop.value}}',
              label: 'Rating',
              min: 0,
              max: 10,
              required: false,
            },
          },
        },
      },
    ];

    const defaults = buildDefaultValues(
      components,
      makeContext({ data: { items: ['p', 'q'] } }),
    );
    expect(defaults).toEqual({ 'rating-p': null, 'rating-q': null });
  });

  it('resolves dataKey from screenData ($) prefix', () => {
    const components: ScreenComponent[] = [
      {
        componentFamily: 'control',
        template: 'for-each',
        props: {
          id: 'loop',
          type: 'dynamic',
          dataKey: '$selected',
          component: {
            componentFamily: 'response',
            template: 'radio',
            props: {
              dataKey: 'opt-{{#loop.value}}',
              label: 'Opt',
              options: [],
            },
          },
        },
      },
    ];

    const defaults = buildDefaultValues(
      components,
      makeContext({ screenData: { selected: ['m', 'n'] } }),
    );
    expect(defaults).toEqual({ 'opt-m': '', 'opt-n': '' });
  });
});
