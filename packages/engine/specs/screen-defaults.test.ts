import { describe, expect, it } from 'vitest';
import { ScreenComponent } from '../components';
import { buildScreenBindings } from '../screen-bindings';
import { Context } from '../types';

function makeContext(overrides: Partial<Context> = {}): Context {
  return { data: {}, loopData: {}, ...overrides };
}

function defaultValues(components: ScreenComponent[], context: Context) {
  return buildScreenBindings(components, context).defaultValues;
}

describe('buildScreenBindings — defaults, static for-each', () => {
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

    expect(defaultValues(components, makeContext())).toEqual({
      'pick-a': '',
      'pick-b': '',
    });
  });
});

describe('buildScreenBindings — defaults, dynamic for-each', () => {
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

    expect(
      defaultValues(
        components,
        makeContext({ data: { items: ['x', 'y', 'z'] } }),
      ),
    ).toEqual({
      'pick-x': '',
      'pick-y': '',
      'pick-z': '',
    });
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

    expect(defaultValues(components, makeContext())).toEqual({});
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

    expect(
      defaultValues(components, makeContext({ data: { items: ['a', 'b'] } })),
    ).toEqual({
      'tags-a': [],
      'tags-b': [],
    });
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

    expect(
      defaultValues(components, makeContext({ data: { items: ['p', 'q'] } })),
    ).toEqual({
      'rating-p': null,
      'rating-q': null,
    });
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

    expect(
      defaultValues(
        components,
        makeContext({ screenData: { selected: ['m', 'n'] } }),
      ),
    ).toEqual({
      'opt-m': '',
      'opt-n': '',
    });
  });
});

describe('buildScreenBindings — initialValue resolution', () => {
  it('uses $$data reference as default for slider', () => {
    const components: ScreenComponent[] = [
      {
        componentFamily: 'response',
        template: 'slider',
        props: {
          dataKey: 'rating',
          label: 'Rating',
          initialValue: '$$priorScore',
        },
      },
    ];
    expect(
      defaultValues(components, makeContext({ data: { priorScore: 72 } })),
    ).toEqual({ rating: 72 });
  });

  it('uses $$data reference as default for numeric-input', () => {
    const components: ScreenComponent[] = [
      {
        componentFamily: 'response',
        template: 'numeric-input',
        props: {
          dataKey: 'age',
          label: 'Age',
          initialValue: '$$previousAge',
        },
      },
    ];
    expect(
      defaultValues(
        components,
        makeContext({ data: { previousAge: 25 } }),
      ),
    ).toEqual({ age: 25 });
  });

  it('uses $$data reference as default for radio', () => {
    const components: ScreenComponent[] = [
      {
        componentFamily: 'response',
        template: 'radio',
        props: {
          dataKey: 'choice',
          label: 'Choice',
          options: [],
          initialValue: '$$lastChoice',
        },
      },
    ];
    expect(
      defaultValues(
        components,
        makeContext({ data: { lastChoice: 'option-a' } }),
      ),
    ).toEqual({ choice: 'option-a' });
  });

  it('falls back to template default when reference is unresolvable', () => {
    const components: ScreenComponent[] = [
      {
        componentFamily: 'response',
        template: 'slider',
        props: {
          dataKey: 'rating',
          label: 'Rating',
          initialValue: '$$missing',
        },
      },
    ];
    expect(defaultValues(components, makeContext())).toEqual({ rating: null });
  });

  it('falls back to template default when resolved value is null', () => {
    const components: ScreenComponent[] = [
      {
        componentFamily: 'response',
        template: 'slider',
        props: {
          dataKey: 'rating',
          label: 'Rating',
          initialValue: '$$priorScore',
        },
      },
    ];
    // null stored from a previously untouched slider
    expect(
      defaultValues(components, makeContext({ data: { priorScore: null } })),
    ).toEqual({ rating: null });
  });

  it('resolves initialValue per iteration inside dynamic for-each', () => {
    const components: ScreenComponent[] = [
      {
        componentFamily: 'control',
        template: 'for-each',
        props: {
          id: 'item',
          type: 'dynamic',
          dataKey: '$$items',
          component: {
            componentFamily: 'response',
            template: 'slider',
            props: {
              dataKey: 'rating-{{#item.value}}',
              label: 'Rating',
              initialValue: '$$priorScore',
            },
          },
        },
      },
    ];
    expect(
      defaultValues(
        components,
        makeContext({ data: { items: ['a', 'b'], priorScore: 50 } }),
      ),
    ).toEqual({ 'rating-a': 50, 'rating-b': 50 });
  });
});
