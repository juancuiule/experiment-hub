import { ExperimentFlow } from '@/lib/types';

type Question = {
  id: string;
  text: string;
  reverse?: boolean;
};

const questions: Question[] = [
  {
    id: '1',
    text: 'A quien le gusta hablar',
  },
  {
    id: '2',
    text: 'Que tiende siempre a encontrar fallas en los demás',
    reverse: true,
  },
  {
    id: '3',
    text: 'Que tiene capacidad para finalizar una tarea',
  },
  { id: '4', text: 'Que es depresivo/a o triste' },
  { id: '5', text: 'Que es original y a quien se le ocurren nuevas ideas' },
  {
    id: '6',
    text: 'Que es reservado/a',
    reverse: true,
  },
  {
    id: '7',
    text: 'Que ayuda a los demás y no es egoísta',
  },
  {
    id: '8',
    text: 'Que puede ser un poco descuidado/a',
    reverse: true,
  },
  {
    id: '9',
    text: 'Que es relajado/a y que maneja bien los problemas',
    reverse: true,
  },
  {
    id: '10',
    text: 'Que es curioso/a respecto de las cosas',
  },
  { id: '11', text: 'Que está lleno/a de energía' },
  { id: '12', text: 'Que empieza peleas con los demás', reverse: true },
  { id: '13', text: 'Que es un trabajador/a confiable' },
  { id: '14', text: 'Que puede ser tenso/a' },
  { id: '15', text: 'Que es ingenioso/a' },
  { id: '16', text: 'Que siempre genera mucho entusiasmo' },
  { id: '17', text: 'Que puede perdonar de manera natural' },
  { id: '18', text: 'Que tiende a ser desorganizado/a', reverse: true },
  { id: '19', text: 'Que se preocupa mucho por todo' },
  { id: '20', text: 'Que tiene una imaginación muy activa' },
  { id: '21', text: 'Que tiende a ser callado/a', reverse: true },
  { id: '22', text: 'Que generalmente es muy confiable' },
  { id: '23', text: 'Que tiende a ser perezoso/a', reverse: true },
  {
    id: '24',
    text: 'Que es emocionalmente estable y que no se altera fácilmente',
    reverse: true,
  },
  { id: '25', text: 'Que es imaginativo/a' },
  { id: '26', text: 'Que tiene una personalidad asertiva' },
  { id: '27', text: 'Que puede ser frío/a y distante', reverse: true },
  { id: '28', text: 'Que persevera hasta que las tareas estén terminadas' },
  { id: '29', text: 'Que puede tener alteraciones en los estados de ánimo' },
  { id: '30', text: 'Que tiene valores artísticos' },
  { id: '31', text: 'Que a veces es tímido/a e inhibido/a', reverse: true },
  { id: '32', text: 'Que es muy considerado/a y amable con los demás' },
  { id: '33', text: 'Que hace las cosas de modo eficiente' },
  {
    id: '34',
    text: 'Que permanece calmo/a en situaciones tensas',
    reverse: true,
  },
  { id: '35', text: 'Que prefiere el trabajo rutinario', reverse: true },
  { id: '36', text: 'Que es sociable' },
  {
    id: '37',
    text: 'Que a veces puede tratar mal a los demás',
    reverse: true,
  },
  { id: '38', text: 'Que puede fijarse metas y seguirlas' },
  { id: '39', text: 'Que se pone nervioso/a fácilmente' },
  { id: '40', text: 'A quien le gusta pensar y reflexionar' },
  { id: '41', text: 'Que tiene pocos intereses artísticos', reverse: true },
  { id: '42', text: 'A quien le gusta cooperar con los demás' },
  { id: '43', text: 'Que se distrae fácilmente', reverse: true },
  {
    id: '44',
    text: 'Que tiene gustos sofisticados en arte, música o literatura',
  },
];

const ocean: ExperimentFlow = {
  nodes: [
    { id: 'start', type: 'start' },
    {
      id: 'screen-intro',
      type: 'screen',
      props: {
        slug: 'intro',
      },
    },
    {
      id: 'screen-instructions',
      type: 'screen',
      props: {
        slug: 'instructions',
      },
    },
    {
      id: 'compute-split',
      type: 'compute',
      props: {
        name: 'Split ocean questions in 4 screens',
        computations: [
          {
            outputKey: 'question-bins',
            formula: {
              type: 'split',
              input: questions,
              mode: 'into',
              n: 4,
            },
          },
        ],
      },
    },
    {
      id: 'loops',
      type: 'loop',
      props: {
        type: 'dynamic',
        dataKey: '$$compute-split.question-bins',
        randomized: true,
        stepper: {
          label: '',
          style: 'dashed',
        },
      },
    },
    {
      id: 'screen-questionnaire',
      type: 'screen',
      props: {
        slug: 'questions',
      },
    },
    {
      // The answers are scattered across the (randomized) loop screens under
      // data.loops.<iter>.questions.question-<id>. collect-loop flattens them
      // into one object keyed by field name, regardless of which screen each
      // question appeared on.
      id: 'compute-collect',
      type: 'compute',
      props: {
        name: 'Flatten questionnaire answers across screens',
        computations: [
          {
            outputKey: 'ans',
            formula: {
              type: 'collect-loop',
              loopId: 'loops',
              screen: 'questions',
              omitKeys: ['for-each-question:order'],
            },
          },
        ],
      },
    },
    {
      // Per-category sums of the flattened answers. NOTE: these are RAW sums —
      // reverse-keyed items (question.reverse) are not yet reverse-scored, so
      // the totals aren't psychometrically correct until reversal is added.
      id: 'compute-score',
      type: 'compute',
      props: {
        name: 'OCEAN category sums',
        computations: [
          {
            outputKey: 'extraversion',
            formula: {
              type: 'sum',
              inputs: [
                '$$compute-collect.ans.question-1',
                '$$compute-collect.ans.question-6',
                '$$compute-collect.ans.question-11',
                '$$compute-collect.ans.question-16',
                '$$compute-collect.ans.question-21',
                '$$compute-collect.ans.question-26',
                '$$compute-collect.ans.question-31',
                '$$compute-collect.ans.question-36',
              ],
            },
          },
          {
            outputKey: 'agreeableness',
            formula: {
              type: 'sum',
              inputs: [
                '$$compute-collect.ans.question-2',
                '$$compute-collect.ans.question-7',
                '$$compute-collect.ans.question-12',
                '$$compute-collect.ans.question-17',
                '$$compute-collect.ans.question-22',
                '$$compute-collect.ans.question-27',
                '$$compute-collect.ans.question-32',
                '$$compute-collect.ans.question-37',
                '$$compute-collect.ans.question-42',
              ],
            },
          },
          {
            outputKey: 'conscientiousness',
            formula: {
              type: 'sum',
              inputs: [
                '$$compute-collect.ans.question-3',
                '$$compute-collect.ans.question-8',
                '$$compute-collect.ans.question-13',
                '$$compute-collect.ans.question-18',
                '$$compute-collect.ans.question-23',
                '$$compute-collect.ans.question-28',
                '$$compute-collect.ans.question-33',
                '$$compute-collect.ans.question-38',
                '$$compute-collect.ans.question-43',
              ],
            },
          },
          {
            outputKey: 'neuroticism',
            formula: {
              type: 'sum',
              inputs: [
                '$$compute-collect.ans.question-4',
                '$$compute-collect.ans.question-9',
                '$$compute-collect.ans.question-14',
                '$$compute-collect.ans.question-19',
                '$$compute-collect.ans.question-24',
                '$$compute-collect.ans.question-29',
                '$$compute-collect.ans.question-34',
                '$$compute-collect.ans.question-39',
              ],
            },
          },
          {
            outputKey: 'openness',
            formula: {
              type: 'sum',
              inputs: [
                '$$compute-collect.ans.question-5',
                '$$compute-collect.ans.question-10',
                '$$compute-collect.ans.question-15',
                '$$compute-collect.ans.question-20',
                '$$compute-collect.ans.question-25',
                '$$compute-collect.ans.question-30',
                '$$compute-collect.ans.question-35',
                '$$compute-collect.ans.question-40',
                '$$compute-collect.ans.question-41',
                '$$compute-collect.ans.question-44',
              ],
            },
          },
        ],
      },
    },
    {
      id: 'screen-regressors',
      type: 'screen',
      props: {
        slug: 'regressors',
      },
    },
    { id: 'end', type: 'end' },
  ],
  edges: [
    { from: 'start', to: 'screen-intro', type: 'sequential' },
    { from: 'screen-intro', to: 'screen-instructions', type: 'sequential' },
    { from: 'screen-instructions', to: 'compute-split', type: 'sequential' },
    { from: 'compute-split', to: 'loops', type: 'sequential' },
    { from: 'loops', to: 'screen-questionnaire', type: 'loop-template' },
    { from: 'loops', to: 'compute-collect', type: 'sequential' },
    { from: 'compute-collect', to: 'compute-score', type: 'sequential' },
    { from: 'compute-score', to: 'screen-regressors', type: 'sequential' },
    { from: 'screen-regressors', to: 'end', type: 'sequential' },
  ],
  screens: [
    {
      slug: 'intro',
      components: [
        {
          componentFamily: 'content',
          template: 'rich-text',
          props: {
            content: `## Los Cinco Grandes \n\n El objetivo de este experimento es tratar de entender, comprimir y clasificar nuestra personalidad usando una serie de preguntas estándar que corresponden a uno de los tests de personalidad más extendidos y más conocidos de la psicología moderna. \n\n Estos datos son súper relevantes a la hora de entender cómo la forma en la que somos se cruza con todos los demás experimentos que hemos hecho y los que vamos a hacer en el futuro. \n\n Esta encuesta es parte de nuestra iniciativa de entender a las personas y sus conciencias en toda su diversidad, y cómo se relaciona esa diversidad con el espectro de posibles reacciones ante la situación actual. \n\n Como siempre, te recordamos que mientras más distintas seamos las personas participantes, más vamos a poder aprender. Tu participación es voluntaria y todos tus datos están anonimizados y van a ser usados para intentar construir conocimiento científico nuevo. \n\n Es muy importante que te tomes el tiempo necesario para leer y responder todas las preguntas de la forma que mejor te representen, para que los resultados obtenidos sean lo más verídicos y útiles posible y también para que los resultados que te presentemos al final te describan con mayor precisión. \n\n Apenas esté el análisis de estos datos vamos a publicar los resultados en [www.elgatoylacaja.com.ar/labs](www.elgatoylacaja.com.ar/labs) para conversar sobre lo que aprendimos gracias a tu participación.`,
          },
        },
        {
          componentFamily: 'layout',
          template: 'button',
          props: {
            text: 'Empezar',
          },
        },
      ],
    },
    {
      slug: 'instructions',
      components: [
        {
          componentFamily: 'content',
          template: 'rich-text',
          props: {
            content: `## Instrucciones \n\n Te vamos a mostrar un listado de características que usualmente se utilizan para describir a las personas. \n\n Indicanos por favor en qué medida la frase te describe adecuadamente.`,
          },
        },
        {
          componentFamily: 'layout',
          template: 'button',
          props: {
            text: 'Empezar',
          },
        },
      ],
    },
    {
      slug: 'questions',
      components: [
        {
          componentFamily: 'content',
          template: 'rich-text',
          props: {
            content: `### Yo me veo a mi mismo/a como alguien...`,
          },
        },
        {
          componentFamily: 'control',
          template: 'for-each',
          props: {
            id: 'for-each-question',
            dataKey: '@loops.value',
            type: 'dynamic',
            randomized: true,
            component: {
              componentFamily: 'response',
              template: 'likert-scale',
              props: {
                label: '{{#for-each-question.value.text}}',
                dataKey: `question-{{#for-each-question.value.id}}`,
                options: '%agreement-scale',
              },
            },
          },
        },
        {
          componentFamily: 'control',
          template: 'conditional',
          props: {
            if: {
              // index is 0-based; with `into: 4` there are 4 bins (indices
              // 0–3), so pages 0–2 show "Siguiente" and the last (index 3)
              // shows "Terminar". Keep this in sync with the split `n`.
              type: 'simple',
              dataKey: '@loops.index',
              operator: 'lt',
              value: 3,
            },
            then: {
              componentFamily: 'layout',
              template: 'button',
              props: {
                text: 'Siguiente',
              },
            },
            else: {
              componentFamily: 'layout',
              template: 'button',
              props: {
                text: 'Terminar',
              },
            },
          },
        },
      ],
    },
    {
      slug: 'regressors',
      components: [
        {
          componentFamily: 'content',
          template: 'rich-text',
          props: {
            content: `### ¡Esto último y terminamos!`,
          },
        },
        {
          componentFamily: 'response',
          template: 'numeric-input',
          props: {
            label: 'Edad',
            dataKey: 'age',
            min: 18,
            max: 120,
          },
        },
        {
          componentFamily: 'response',
          template: 'dropdown',
          props: {
            label: 'Género',
            dataKey: 'gender',
            options: '%gender',
          },
        },
        {
          componentFamily: 'response',
          template: 'text-input',
          props: {
            label: 'Nacionalidad',
            dataKey: 'nationality',
          },
        },
        {
          componentFamily: 'layout',
          template: 'button',
          props: {
            text: 'Terminar',
          },
        },
      ],
    },
  ],
  options: {
    // acuerdo
    'agreement-scale': [
      { label: 'No estoy de acuerdo', value: '1' },
      { label: '', value: '2' },
      { label: 'Ni de acuerdo ni en desacuerdo', value: '3' },
      { label: '', value: '4' },
      { label: 'Estoy de acuerdo', value: '5' },
    ],
    // género
    gender: [
      { label: 'Mujer', value: 'woman' },
      { label: 'Varón', value: 'man' },
      { label: 'No binarie', value: 'non-binary' },
      { label: 'Género fluido', value: 'gender-fluid' },
      {
        label: 'Ninguna de estas opciones me identifica',
        value: 'none-of-these',
      },
      { label: 'Prefiero no decirlo', value: 'prefer-not-to-say' },
    ],
  },
};

export default ocean;
