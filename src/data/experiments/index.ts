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
        id: 'screen-test',
        type: 'screen',
        props: {
          slug: 'test',
        },
      },
      { id: 'end', type: 'end' },
    ],
    edges: [
      { from: 'start', to: 'screen-test', type: 'sequential' },
      { from: 'screen-test', to: 'end', type: 'sequential' },
    ],
    screens: [
      {
        slug: 'test',
        components: [
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
        ],
      },
    ],
  },
};
