import { ExperimentFlow } from '@experiment-hub/engine/types';

type Pecado = {
  id: number;
  name: string;
  description: {
    pre: string;
    post: string;
  };
};

const pecados: Pecado[] = [
  {
    id: 1,
    name: 'gula',
    description: {
      pre: 'La',
      post: 'es el apetito desmedido por comer y beber.',
    },
  },
  {
    id: 2,
    name: 'envidia',
    description: {
      pre: 'La',
      post: 'es el sentimiento de tristeza o enojo que experimenta la persona que no tiene o desearía tener para sí sola algo que otra posee.',
    },
  },
  {
    id: 3,
    name: 'ira',
    description: {
      pre: 'La',
      post: 'es el sentimiento no controlado de odio y enfado.',
    },
  },
  {
    id: 4,
    name: 'lujuria',
    description: {
      pre: 'La',
      post: 'es deseo sexual descontrolado o exacerbado.',
    },
  },
  {
    id: 5,
    name: 'pereza',
    description: {
      pre: 'La',
      post: 'es el tedio o descuido en realizar actividades.',
    },
  },
  {
    id: 6,
    name: 'avaricia',
    description: {
      pre: 'La',
      post: 'es el deseo de obtener bienes, riquezas o poder con la sola intención de atesorarlos para sí mismo/a.',
    },
  },
  {
    id: 7,
    name: 'soberbia',
    description: {
      pre: 'La',
      post: 'es el sentimiento de superioridad frente a otras personas que provoca un trato distante o despreciativo hacia ellas.',
    },
  },
];

const experimentoPecados: ExperimentFlow = {
  nodes: [
    { id: 'start', type: 'start' },
    {
      id: 'screen-terms',
      type: 'screen',
      props: {
        slug: 'terms',
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
      id: 'sample-pecados',
      type: 'compute',
      props: {
        name: 'Sample Pecados',
        computations: [
          {
            outputKey: 'pecados',
            formula: {
              type: 'sample',
              input: pecados,
              n: pecados.length,
            },
          },
        ],
      },
    },
    // {
    //   id: 'loop-pecados',
    //   type: 'loop',
    //   props: {
    //     type: 'static',
    //     itemKey: 'id',
    //     values: pecados,
    //     randomized: true,
    //   },
    // },
    {
      id: 'screen-pecados',
      type: 'screen',
      props: {
        slug: 'pecados',
      },
    },
    {
      id: 'screen-cambios',
      type: 'screen',
      props: {
        slug: 'cambios',
      },
    },
    {
      id: 'end',
      type: 'end',
    },
  ],
  edges: [
    { from: 'start', to: 'screen-terms', type: 'sequential' },
    { from: 'screen-terms', to: 'screen-instructions', type: 'sequential' },
    { from: 'screen-instructions', to: 'sample-pecados', type: 'sequential' },
    { from: 'sample-pecados', to: 'screen-pecados', type: 'sequential' },
    { from: 'screen-pecados', to: 'screen-cambios', type: 'sequential' },
    { from: 'screen-cambios', to: 'end', type: 'sequential' },
    // { from: 'loop-pecados', to: 'screen-pecado', type: 'loop-template' },
    // { from: 'loop-pecados', to: 'end', type: 'sequential' },
  ],
  screens: [
    {
      slug: 'terms',
      components: [
        {
          componentFamily: 'content',
          template: 'rich-text',
          props: {
            content: '# Antes de empezar',
          },
        },
        {
          componentFamily: 'content',
          template: 'rich-text',
          props: {
            content:
              'Gracias por ser parte de esta nueva investigación. El siguiente experimento dura unos 10 minutos, tu participación es absolutamente voluntaria y te podés bajar en cualquier momento. No esperamos ningún tipo de inconveniente o riesgo por participar. Los datos son confidenciales y anónimos. \n\n Si tenés cualquier tipo de duda, nos mandás un mail a [labs@elgatoylacaja.com](mailto:labs@elgatoylacaja.com). Si la pregunta se nos escapa, o querés hacer otro tipo de comentario, tené en mente que podés contactarte con el Comité de Ética en Investigación, Centro de Educación Médica e Investigaciones Clínicas “Norberto Quirno”. Hospital Universitario sede Saavedra, Av. Galván 4102. Ciudad de Buenos Aires, (C1425DQK) - República Argentina. Tel: 5299-0100, interno 2879. \n\n Apenas esté el análisis de estos datos vamos a publicar los resultados en [www.elgatoylacaja.com/labs](www.elgatoylacaja.com/labs) para conversar sobre lo que aprendimos gracias a tu participación.',
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
            content:
              '### Sobre este experimento \n\n Gula, Ira, Lujuria, Pereza, Envidia, Avaricia, Soberbia. \n\n Cada uno de los llamados ‘pecados capitales’ es, de alguna manera, la manifestación de un deseo o motivación que podemos encontrar a lo largo de muchas culturas y eras. Este experimento no busca investigar estos impulsos desde un enfoque religioso; ni siquiera desde una perspectiva ética y moral. Las preguntas que estás por responder no tienen respuestas correctas ni pretenden de ninguna manera establecer algún juicio de valor. Lo que queremos estudiar son los motores de nuestros deseos y sus mecanismos de regulación individuales y colectivos. ¡Arranquemos!',
          },
        },
        {
          componentFamily: 'layout',
          template: 'button',
          props: {
            text: 'Continuar',
          },
        },
      ],
    },
    {
      slug: 'pecados',
      components: [
        {
          componentFamily: 'content',
          template: 'rich-text',
          props: {
            content:
              '## Parte 1 de 5: Un poquito de introspección \n\n Primero, vamos a preguntarte cómo percibís cada uno de estos impulsos en vos. Por favor, respondé de forma libre y honesta, moviendo el cursor hasta la posición que mejor te represente en cada caso. Los cursores empiezan en posiciones aleatorias.',
          },
        },
        {
          componentFamily: 'control',
          template: 'for-each',
          props: {
            id: 'for-each-pecado',
            type: 'dynamic',
            dataKey: '$$sample-pecados.pecados',
            component: {
              componentFamily: 'layout',
              template: 'group',
              props: {
                name: 'pecado-group-{{#for-each-pecado.value.name}}',
                components: [
                  {
                    componentFamily: 'content',
                    template: 'rich-text',
                    props: {
                      content: '#### {{#for-each-pecado.index}}',
                    },
                  },
                  {
                    componentFamily: 'response',
                    template: 'slider',
                    props: {
                      label:
                        '{{#for-each-pecado.value.description.pre}} **{{#for-each-pecado.value.name}}** {{#for-each-pecado.value.description.post}}. ¿Qué tan presente está este impulso en tu vida?',
                      dataKey: 'slider-{{#for-each-pecado.value.name}}',
                      min: 0,
                      max: 100,
                      tooltip: true,
                    },
                  },
                  {
                    componentFamily: 'response',
                    template: 'dropdown',
                    props: {
                      label:
                        '¿Con cuánta fecuencia experimentás {{#for-each-pecado.value.name}}?',
                      dataKey: 'frecuencia-{{#for-each-pecado.value.name}}',
                      options: [
                        { label: 'Muy baja', value: 'muy-baja' },
                        { label: 'Baja', value: 'baja' },
                        { label: 'Media', value: 'media' },
                        { label: 'Alta', value: 'alta' },
                        { label: 'Muy alta', value: 'muy-alta' },
                      ],
                    },
                  },
                  {
                    componentFamily: 'response',
                    template: 'slider',
                    props: {
                      label:
                        'Cuando sentís envidia, ¿cuán intensa es esa sensación?',
                      dataKey: 'intensidad-{{#for-each-pecado.value.name}}',
                      min: 0,
                      max: 10,
                    },
                  },
                ],
              },
            },
          },
        },
        {
          componentFamily: 'layout',
          template: 'button',
          props: {
            text: 'Siguiente',
          },
        },
      ],
    },
    {
      slug: 'cambios',
      components: [
        {
          componentFamily: 'content',
          template: 'rich-text',
          props: {
            content:
              '## Parte 2 de 5: ¿Cómo te gustaría ser? \n\n Abajo están las respuestas que diste en la pantalla anterior. Si pudieras modificar libremente qué tan presentes están estas características en vos, ¿en dónde te ubicarías en cada caso? Mayor cantidad de barras pintadas representa mayor presencia de ese impulso.',
          },
        },
        {
          componentFamily: 'control',
          template: 'for-each',
          props: {
            id: 'for-each-pecado-cambio',
            type: 'dynamic',
            dataKey: '$$sample-pecados.pecados',
            component: {
              componentFamily: 'response',
              template: 'slider',
              props: {
                label:
                  '¿Cómo te gustaría ser en relación a {{#for-each-pecado-cambio.value.name}}?',
                dataKey: 'cambio-{{#for-each-pecado-cambio.value.name}}',
                min: 0,
                max: 100,
              },
            },
          },
        },
      ],
    },
  ],
};

export default experimentoPecados;
