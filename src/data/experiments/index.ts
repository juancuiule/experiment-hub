import { ExperimentFlow } from '@/lib/types';
import ejercicio1 from './ejercicio-1';
import emociones from './emociones';
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
};
