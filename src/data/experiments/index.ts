import { ExperimentFlow } from '@/lib/types';
import ejercicio1 from './ejercicio-1';
import pandemic from './pandemic';

export const EXPERIMENTS: Record<string, ExperimentFlow> = {
  experiment: pandemic,
  'ejercicio-1': ejercicio1,
  miradas: {
    nodes: [
      { id: 'start', type: 'start' },
      {
        id: 'compute',
        type: 'compute',
        props: {
          name: 'randomize-images',
          computations: [
            {
              outputKey: 'miradas',
              formula: {
                type: 'sample',
                input: Array.from({ length: 36 }).map((_, i) =>
                  (i + 1).toString(),
                ),
                n: 12,
              },
            },
          ],
        },
      },
      {
        id: 'terms',
        type: 'screen',
        props: { slug: 'terms' },
      },
      {
        id: 'intro',
        type: 'screen',
        props: { slug: 'intro' },
      },
      {
        id: 'loop',
        type: 'loop',
        props: {
          dataKey: '$$compute.miradas',
          type: 'dynamic',
          stepper: {
            label: 'Retrato {index}/{total}',
            style: 'dashed',
          },
        },
      },
      {
        id: 'screen-mirada',
        type: 'screen',
        props: { slug: 'mirada' },
      },
      // {
      //   id: 'compute-correct',
      //   type: 'compute',
      //   props: {
      //     name: 'compute-correct',
      //     computations: [
      //       {
      //         outputKey: 'correct-1',
      //         formula: {
      //           type: 'conditional',
      //           condition: {
      //             type: 'simple',
      //             dataKey: '$$loop.1.mirada.mirada-1',
      //             operator: 'eq',
      //             value: 'playful',
      //           },
      //           then: 1,
      //           else: 0,
      //         },
      //       },
      //       {
      //         outputKey: 'correct-2',
      //         formula: {
      //           type: 'conditional',
      //           condition: {
      //             type: 'simple',
      //             dataKey: '$$loop.2.mirada.mirada-2',
      //             operator: 'eq',
      //             value: 'terrified',
      //           },
      //           then: 1,
      //           else: 0,
      //         },
      //       },
      //       {
      //         outputKey: 'correct-3',
      //         formula: {
      //           type: 'conditional',
      //           condition: {
      //             type: 'simple',
      //             dataKey: '$$loop.3.mirada.mirada-3',
      //             operator: 'eq',
      //             value: 'joking',
      //           },
      //           then: 1,
      //           else: 0,
      //         },
      //       },
      //       {
      //         outputKey: 'correct-4',
      //         formula: {
      //           type: 'conditional',
      //           condition: {
      //             type: 'simple',
      //             dataKey: '$$loop.4.mirada.mirada-4',
      //             operator: 'eq',
      //             value: 'joking',
      //           },
      //           then: 1,
      //           else: 0,
      //         },
      //       },
      //       {
      //         outputKey: 'total-correct',
      //         formula: {
      //           type: 'sum',
      //           inputs: [
      //             '$correct-1',
      //             '$correct-2',
      //             '$correct-3',
      //             '$correct-4',
      //           ],
      //         },
      //       },
      //     ],
      //   },
      // },
      // {
      //   id: 'end',
      //   type: 'screen',
      //   props: { slug: 'end' },
      // },
    ],
    edges: [
      { type: 'sequential', from: 'start', to: 'compute' },
      { type: 'sequential', from: 'compute', to: 'terms' },
      { type: 'sequential', from: 'terms', to: 'intro' },
      { type: 'sequential', from: 'intro', to: 'loop' },
      { type: 'loop-template', from: 'loop', to: 'screen-mirada' },
      // { type: 'sequential', from: 'loop', to: 'compute-correct' },
      // { type: 'sequential', from: 'compute-correct', to: 'end' },
    ],
    screens: [
      // {
      //   slug: 'end',
      //   components: [
      //     {
      //       componentFamily: 'content',
      //       template: 'rich-text',
      //       props: {
      //         content: '## ¡Gracias por participar!',
      //       },
      //     },
      //   ],
      // },
      {
        slug: 'terms',
        components: [
          {
            componentFamily: 'content',
            template: 'rich-text',
            props: {
              content:
                '# Antes de empezar \n\n El objetivo de este experimento es aprender más sobre los factores que afectan la forma en la que reconocemos emociones en los rostros de las personas. \n\n Vas a ver 12 fotos de pares de ojos. Para cada uno, elegí y hace click sobre la palabra que mejor describa lo que la persona en la fotografía está pensando o sintiendo. Las definiciones de estas palabras están estandarizadas y se pueden ver durante el experimento. \n\n El experimento completo dura unos 5 minutos. Tu participación es absolutamente voluntaria y te podés bajar en cualquier momento. No esperamos ningún tipo de inconveniente o riesgo por participar. Los datos son confidenciales y anónimos. \n\nSi tenés cualquier tipo de duda, nos mandás un mail a labs@elgatoylacaja.com. Si la pregunta se nos escapa, o querés hacer otro tipo de comentario, tené en mente que podés contactarte con el Comité de Ética en Investigación, Centro de Educación Médica e Investigaciones Clínicas “Norberto Quirno”. Hospital Universitario sede Saavedra, Av. Galván 4102. Ciudad de Buenos Aires, (C1425DQK) - República Argentina. Tel: 5299-0100, interno 2879. \n\n Apenas esté el análisis de estos datos vamos (como siempre) a publicar los resultados en www.elgatoylacaja.com para conversar sobre lo que aprendimos gracias a tu participación.',
            },
          },
          {
            componentFamily: 'layout',
            template: 'button',
            props: {
              text: 'Empezar',
              alignBottom: true,
            },
          },
        ],
      },
      {
        slug: 'intro',
        components: [
          {
            componentFamily: 'content',
            template: 'rich-text',
            props: {
              content:
                '## Importante \n\n Leé las 4 palabras antes de contestar. \n\n Si no entendés alguna palabra, al lado tenés un botón con la explicación. \n Indicá con precisión tu nivel de confianza, usando toda la escala. \n Al finalizar, recibirás una devolución en base a tus respuestas.',
            },
          },
          {
            componentFamily: 'layout',
            template: 'button',
            props: {
              text: 'Empezar',
              alignBottom: true,
            },
          },
        ],
      },
      {
        slug: 'mirada',
        components: [
          {
            componentFamily: 'content',
            template: 'image',
            props: {
              url: 'https://investigacion.elgatoylacaja.com/emociones/images/miradas/{{@loop.value}}.png',
              alt: 'Retrato de mirada',
            },
          },
          {
            componentFamily: 'response',
            template: 'radio',
            props: {
              label: '¿Qué opción describe mejor a esta persona?',
              dataKey: 'mirada-{{@loop.value}}',
              options: '%mirada-{{@loop.value}}',
              randomize: true,
              reshuffleInLoop: true,
            },
          },
          {
            componentFamily: 'layout',
            template: 'button',
            props: {
              text: 'Siguiente',
              alignBottom: true,
            },
          },
        ],
      },
    ],
    options: {
      'mirada-1': [
        { label: 'Juguetón', value: 'playful' },
        { label: 'Reconfortante', value: 'comforting' },
        { label: 'Irritado', value: 'irritated' },
        { label: 'Aburrido', value: 'bored' },
      ],
      'mirada-2': [
        { label: 'Aterrorizado', value: 'terrified' },
        { label: 'Molesto', value: 'upset' },
        { label: 'Arrogante', value: 'arrogant' },
        { label: 'Enfadado', value: 'angry' },
      ],
      'mirada-3': [
        { label: 'Bromista', value: 'joking' },
        { label: 'Agobiada', value: 'overwhelmed' },
        { label: 'Deseo', value: 'desire' },
        { label: 'Convencida', value: 'convinced' },
      ],
      'mirada-4': [
        { label: 'Bromista', value: 'joking' },
        { label: 'Insistente', value: 'insistent' },
        { label: 'Entretenido', value: 'entertained' },
        { label: 'Relajado', value: 'relaxed' },
      ],
      'mirada-5': [
        { label: 'Irritado', value: 'irritated' },
        { label: 'Sarcástico', value: 'sarcastic' },
        { label: 'Preocupado', value: 'worried' },
        { label: 'Amistoso', value: 'friendly' },
      ],
      'mirada-6': [
        { label: 'Asustada', value: 'scared' },
        { label: 'Fantasiosa', value: 'fanciful' },
        { label: 'Impaciente', value: 'impatient' },
        { label: 'Alarmada', value: 'alarmed' },
      ],
      'mirada-7': [
        { label: 'Arrepentido', value: 'regretful' },
        { label: 'Amistoso', value: 'friendly' },
        { label: 'Intranquilo', value: 'uneasy' },
        { label: 'Decaído', value: 'downcast' },
      ],
      'mirada-8': [
        { label: 'Abatido', value: 'dejected' },
        { label: 'Aliviado', value: 'relieved' },
        { label: 'Tímido', value: 'shy' },
        { label: 'Entusiasmado', value: 'excited' },
      ],
      'mirada-9': [
        { label: 'Enfadada', value: 'angry' },
        { label: 'Hostil', value: 'hostile' },
        { label: 'Horrorizada', value: 'horrified' },
        { label: 'Angustiada', value: 'distressed' },
      ],
      'mirada-10': [
        { label: 'Prudente', value: 'cautious' },
        { label: 'Insistente', value: 'insistent' },
        { label: 'Aburrido', value: 'bored' },
        { label: 'Asustado', value: 'scared' },
      ],
      'mirada-11': [
        { label: 'Aterrorizado', value: 'terrified' },
        { label: 'Entretenido', value: 'entertained' },
        { label: 'Arrepentido', value: 'regretful' },
        { label: 'Seductor', value: 'seductive' },
      ],
      'mirada-12': [
        { label: 'Indiferente', value: 'indifferent' },
        { label: 'Abochornado', value: 'embarrassed' },
        { label: 'Escéptico', value: 'skeptical' },
        { label: 'Decaído', value: 'downcast' },
      ],
      'mirada-13': [
        { label: 'Decidido', value: 'decisive' },
        { label: 'Expectante', value: 'expectant' },
        { label: 'Amenazante', value: 'threatening' },
        { label: 'Tímido', value: 'shy' },
      ],
      'mirada-14': [
        { label: 'Irritado', value: 'irritated' },
        { label: 'Decepcionado', value: 'disappointed' },
        { label: 'Deprimido', value: 'depressed' },
        { label: 'Acusante', value: 'accusing' },
      ],
      'mirada-15': [
        { label: 'Abstraída', value: 'absorbed' },
        { label: 'Agobiada', value: 'overwhelmed' },
        { label: 'Alentadora', value: 'encouraging' },
        { label: 'Entretenida', value: 'entertained' },
      ],
      'mirada-16': [
        { label: 'Irritado', value: 'irritated' },
        { label: 'Considerado', value: 'considerate' },
        { label: 'Alentador', value: 'encouraging' },
        { label: 'Compasivo', value: 'compassionate' },
      ],
      'mirada-17': [
        { label: 'Insegura', value: 'insecure' },
        { label: 'Afectuosa', value: 'affectionate' },
        { label: 'Juguetona', value: 'playful' },
        { label: 'Asustada', value: 'scared' },
      ],
      'mirada-18': [
        { label: 'Decidida', value: 'decisive' },
        { label: 'Entretenida', value: 'entertained' },
        { label: 'Asustada', value: 'scared' },
        { label: 'Aburrida', value: 'bored' },
      ],
      'mirada-19': [
        { label: 'Arrogante', value: 'arrogant' },
        { label: 'Agradecida', value: 'grateful' },
        { label: 'Sarcástica', value: 'sarcastic' },
        { label: 'Vacilante', value: 'hesitant' },
      ],
      'mirada-20': [
        { label: 'Imponente', value: 'imposing' },
        { label: 'Amistoso', value: 'friendly' },
        { label: 'Culpable', value: 'guilty' },
        { label: 'Horrorizado', value: 'horrified' },
      ],
      'mirada-21': [
        { label: 'Abochornada', value: 'embarrassed' },
        { label: 'Fantasiosa', value: 'fanciful' },
        { label: 'Confundida', value: 'confused' },
        { label: 'En pánico', value: 'panicked' },
      ],
      'mirada-22': [
        { label: 'Angustiada', value: 'distressed' },
        { label: 'Agradecida', value: 'grateful' },
        { label: 'Insistente', value: 'insistent' },
        { label: 'Suplicante', value: 'pleading' },
      ],
      'mirada-23': [
        { label: 'Satisfecho', value: 'satisfied' },
        { label: 'Arrepentido', value: 'regretful' },
        { label: 'Desafiante', value: 'defiant' },
        { label: 'Curioso', value: 'curious' },
      ],
      'mirada-24': [
        { label: 'Abstraído', value: 'absorbed' },
        { label: 'Irritado', value: 'irritated' },
        { label: 'Entusiasmado', value: 'excited' },
        { label: 'Hostil', value: 'hostile' },
      ],
      'mirada-25': [
        { label: 'En pánico', value: 'panicked' },
        { label: 'Incrédula', value: 'incredulous' },
        { label: 'Abatida', value: 'dejected' },
        { label: 'Interesada', value: 'interested' },
      ],
      'mirada-26': [
        { label: 'Alarmado', value: 'alarmed' },
        { label: 'Tímido', value: 'shy' },
        { label: 'Hostil', value: 'hostile' },
        { label: 'Ansioso', value: 'anxious' },
      ],
      'mirada-27': [
        { label: 'Bromista', value: 'joking' },
        { label: 'Prudente', value: 'cautious' },
        { label: 'Arrogante', value: 'arrogant' },
        { label: 'Tranquilizadora', value: 'reassuring' },
      ],
      'mirada-28': [
        { label: 'Interesada', value: 'interested' },
        { label: 'Bromista', value: 'joking' },
        { label: 'Afectuosa', value: 'affectionate' },
        { label: 'Satisfecha', value: 'satisfied' },
      ],
      'mirada-29': [
        { label: 'Impaciente', value: 'impatient' },
        { label: 'Asustada', value: 'scared' },
        { label: 'Irritada', value: 'irritated' },
        { label: 'Reflexiva', value: 'reflective' },
      ],
      'mirada-30': [
        { label: 'Agradecida', value: 'grateful' },
        { label: 'Seductora', value: 'seductive' },
        { label: 'Hostil', value: 'hostile' },
        { label: 'Decepcionada', value: 'disappointed' },
      ],
      'mirada-31': [
        { label: 'Avergonzada', value: 'ashamed' },
        { label: 'Segura', value: 'confident' },
        { label: 'Bromista', value: 'joking' },
        { label: 'Decaída', value: 'downcast' },
      ],
      'mirada-32': [
        { label: 'Serio', value: 'serious' },
        { label: 'Avergonzado', value: 'ashamed' },
        { label: 'Desconcertado', value: 'puzzled' },
        { label: 'Alarmado', value: 'alarmed' },
      ],
      'mirada-33': [
        { label: 'Abochornado', value: 'embarrassed' },
        { label: 'Culpable', value: 'guilty' },
        { label: 'Fantasioso', value: 'fanciful' },
        { label: 'Preocupado', value: 'worried' },
      ],
      'mirada-34': [
        { label: 'Asustada', value: 'scared' },
        { label: 'Desconcertada', value: 'puzzled' },
        { label: 'Recelosa', value: 'suspicious' },
        { label: 'Aterrorizada', value: 'terrified' },
      ],
      'mirada-35': [
        { label: 'Perpleja', value: 'perplexed' },
        { label: 'Nerviosa', value: 'nervous' },
        { label: 'Insistente', value: 'insistent' },
        { label: 'Abstraída', value: 'absorbed' },
      ],
      'mirada-36': [
        { label: 'Avergonzado', value: 'ashamed' },
        { label: 'Nervioso', value: 'nervous' },
        { label: 'Desconfiado', value: 'distrustful' },
        { label: 'Indeciso', value: 'indecisive' },
      ],
    },
  },
};
