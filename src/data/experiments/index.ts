import { ExperimentFlow } from '@/lib/types';
import ejercicio1 from './ejercicio-1';
import emociones from './emociones';
import ocean from './ocean';
import pandemic from './pandemic';

export const EXPERIMENTS: Record<string, ExperimentFlow> = {
  experiment: pandemic,
  'ejercicio-1': ejercicio1,
  emociones,
  test: {
    nodes: [
      { id: 'start', type: 'start' },
      {
        id: 'loop-city',
        type: 'loop',
        props: {
          type: 'static',
          values: ['New York', 'Los Angeles', 'Chicago'],
        },
      },
      {
        id: 'screen-test',
        type: 'screen',
        props: {
          slug: 'test',
        },
      },
      { id: 'end', type: 'end' },
    ],
    edges: [
      { from: 'start', to: 'loop-city', type: 'sequential' },
      {
        from: 'loop-city',
        to: 'screen-test',
        type: 'loop-template',
      },
      {
        from: 'loop-city',
        to: 'end',
        type: 'sequential',
      },
    ],
    screens: [
      {
        slug: 'test',
        components: [
          {
            componentFamily: 'content',
            template: 'rich-text',
            props: {
              content:
                "# What's your favorite fruit in {{@loop-city.value}}? \n\n ## Alguna cosa \n\n ### Un h3 \n\n #### Un h4 para probar \n\n ##### Otro título, ahora h5",
            },
          },
          {
            componentFamily: 'control',
            template: 'for-each',
            id: 'for-each-fruit',
            props: {
              id: 'for-each-fruit',
              type: 'static',
              values: ['apple', 'banana', 'orange'],
              component: {
                componentFamily: 'response',
                template: 'slider',
                props: {
                  label: 'How much do you like {{#for-each-fruit.value}}s?',
                  dataKey: 'slider-{{#for-each-fruit.value}}',
                  min: 0,
                  max: 10,
                  tooltip: true,
                },
              },
            },
          },
          {
            componentFamily: 'layout',
            template: 'button',
            props: {
              text: 'Submit',
            },
          },
        ],
      },
    ],
  },
  buttons: {
    nodes: [
      { id: 'start', type: 'start' },
      {
        id: 'fisrt',
        type: 'screen',
        props: {
          slug: 'first-screen',
        },
      },
      {
        id: 'branch',
        type: 'branch',
        props: {
          name: 'Branch',
          branches: [
            {
              id: 'more',
              name: 'Answer more questions',
              config: {
                type: 'simple',
                dataKey: '$$first-screen.answer-more',
                operator: 'eq',
                value: 'yes',
              },
            },
          ],
        },
      },
      {
        id: 'more-screen',
        type: 'screen',
        props: {
          slug: 'more-screen',
        },
      },
      { id: 'end', type: 'end' },
    ],
    edges: [
      { from: 'start', to: 'fisrt', type: 'sequential' },
      { from: 'fisrt', to: 'branch', type: 'sequential' },

      {
        from: 'branch.more',
        to: 'more-screen',
        type: 'branch-condition',
      },
      {
        from: 'branch',
        to: 'end',
        type: 'branch-default',
      },
      {
        from: 'more-screen',
        to: 'end',
        type: 'sequential',
      },
    ],
    screens: [
      {
        slug: 'first-screen',
        components: [
          {
            componentFamily: 'content',
            template: 'rich-text',
            props: { content: '# This is the first screen' },
          },
          {
            componentFamily: 'layout',
            template: 'button',
            props: {
              text: 'Answer more questions',
              payload: { dataKey: 'answer-more', value: 'yes' },
            },
          },
          {
            componentFamily: 'layout',
            template: 'button',
            props: {
              text: 'Skip',
              payload: { dataKey: 'answer-more', value: 'no' },
            },
          },
        ],
      },
      {
        slug: 'more-screen',
        components: [
          {
            componentFamily: 'content',
            template: 'rich-text',
            props: { content: '# This is the more screen' },
          },
          {
            componentFamily: 'layout',
            template: 'button',
            props: {
              text: 'Go to end',
            },
          },
        ],
      },
    ],
  },
  ocean: ocean,
};
