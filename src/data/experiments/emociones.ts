import { ExperimentFlow } from '@/lib/types';

const emociones: ExperimentFlow = {
  nodes: [
    { id: 'start', type: 'start' },
    {
      id: 'compute-sample-items',
      type: 'compute',
      props: {
        name: 'randomize-images',
        description:
          'Randomiza las imágenes que se le muestran a cada participante, eligiendo 12 de un total de 36',
        computations: [
          {
            outputKey: 'selected-items',
            formula: {
              type: 'sample',
              input: [
                {
                  id: 'mirada-1',
                  img: '1',
                  correctAnswer: 'playful',
                  options: [
                    {
                      label: 'Juguetón',
                      value: 'playful',
                      tooltip: 'Un ejemplo de tooltip',
                    },
                    { label: 'Reconfortante', value: 'comforting' },
                    { label: 'Irritado', value: 'irritated' },
                    { label: 'Aburrido', value: 'bored' },
                  ],
                },
                {
                  id: 'mirada-2',
                  img: '2',
                  correctAnswer: 'upset',
                  options: [
                    { label: 'Aterrorizado', value: 'terrified' },
                    { label: 'Molesto', value: 'upset' },
                    { label: 'Arrogante', value: 'arrogant' },
                    { label: 'Enfadado', value: 'angry' },
                  ],
                },
                {
                  id: 'mirada-3',
                  img: '3',
                  correctAnswer: 'desire',
                  options: [
                    { label: 'Bromista', value: 'joking' },
                    { label: 'Agobiada', value: 'overwhelmed' },
                    { label: 'Deseo', value: 'desire' },
                    { label: 'Convencida', value: 'convinced' },
                  ],
                },
                {
                  id: 'mirada-4',
                  img: '4',
                  correctAnswer: 'insistent',
                  options: [
                    { label: 'Bromista', value: 'joking' },
                    { label: 'Insistente', value: 'insistent' },
                    { label: 'Entretenido', value: 'entertained' },
                    { label: 'Relajado', value: 'relaxed' },
                  ],
                },
                {
                  id: 'mirada-5',
                  img: '5',
                  correctAnswer: 'sarcastic',
                  options: [
                    { label: 'Irritado', value: 'irritated' },
                    { label: 'Sarcástico', value: 'sarcastic' },
                    { label: 'Preocupado', value: 'worried' },
                    { label: 'Amistoso', value: 'friendly' },
                  ],
                },
                {
                  id: 'mirada-6',
                  img: '6',
                  correctAnswer: 'fanciful',
                  options: [
                    { label: 'Asustada', value: 'scared' },
                    { label: 'Fantasiosa', value: 'fanciful' },
                    { label: 'Impaciente', value: 'impatient' },
                    { label: 'Alarmada', value: 'alarmed' },
                  ],
                },
                {
                  id: 'mirada-7',
                  img: '7',
                  correctAnswer: 'uneasy',
                  options: [
                    { label: 'Arrepentido', value: 'regretful' },
                    { label: 'Amistoso', value: 'friendly' },
                    { label: 'Intranquilo', value: 'uneasy' },
                    { label: 'Decaído', value: 'downcast' },
                  ],
                },
                {
                  id: 'mirada-8',
                  img: '8',
                  correctAnswer: 'dejected',
                  options: [
                    { label: 'Abatido', value: 'dejected' },
                    { label: 'Aliviado', value: 'relieved' },
                    { label: 'Tímido', value: 'shy' },
                    { label: 'Entusiasmado', value: 'excited' },
                  ],
                },
                {
                  id: 'mirada-9',
                  img: '9',
                  correctAnswer: 'distressed',
                  options: [
                    { label: 'Enfadada', value: 'angry' },
                    { label: 'Hostil', value: 'hostile' },
                    { label: 'Horrorizada', value: 'horrified' },
                    { label: 'Angustiada', value: 'distressed' },
                  ],
                },
                {
                  id: 'mirada-10',
                  img: '10',
                  correctAnswer: 'cautious',
                  options: [
                    { label: 'Prudente', value: 'cautious' },
                    { label: 'Insistente', value: 'insistent' },
                    { label: 'Aburrido', value: 'bored' },
                    { label: 'Asustado', value: 'scared' },
                  ],
                },
                {
                  id: 'mirada-11',
                  img: '11',
                  correctAnswer: 'regretful',
                  options: [
                    { label: 'Aterrorizado', value: 'terrified' },
                    { label: 'Entretenido', value: 'entertained' },
                    { label: 'Arrepentido', value: 'regretful' },
                    { label: 'Seductor', value: 'seductive' },
                  ],
                },
                {
                  id: 'mirada-12',
                  img: '12',
                  correctAnswer: 'skeptical',
                  options: [
                    { label: 'Indiferente', value: 'indifferent' },
                    { label: 'Abochornado', value: 'embarrassed' },
                    { label: 'Escéptico', value: 'skeptical' },
                    { label: 'Decaído', value: 'downcast' },
                  ],
                },
                {
                  id: 'mirada-13',
                  img: '13',
                  correctAnswer: 'decisive',
                  options: [
                    { label: 'Decidido', value: 'decisive' },
                    { label: 'Expectante', value: 'expectant' },
                    { label: 'Amenazante', value: 'threatening' },
                    { label: 'Tímido', value: 'shy' },
                  ],
                },
                {
                  id: 'mirada-14',
                  img: '14',
                  correctAnswer: 'accusing',
                  options: [
                    { label: 'Irritado', value: 'irritated' },
                    { label: 'Decepcionado', value: 'disappointed' },
                    { label: 'Deprimido', value: 'depressed' },
                    { label: 'Acusante', value: 'accusing' },
                  ],
                },
                {
                  id: 'mirada-15',
                  img: '15',
                  correctAnswer: 'absorbed',
                  options: [
                    { label: 'Abstraída', value: 'absorbed' },
                    { label: 'Agobiada', value: 'overwhelmed' },
                    { label: 'Alentadora', value: 'encouraging' },
                    { label: 'Entretenida', value: 'entertained' },
                  ],
                },
                {
                  id: 'mirada-16',
                  img: '16',
                  correctAnswer: 'considerate',
                  options: [
                    { label: 'Irritado', value: 'irritated' },
                    { label: 'Considerado', value: 'considerate' },
                    { label: 'Alentador', value: 'encouraging' },
                    { label: 'Compasivo', value: 'compassionate' },
                  ],
                },
                {
                  id: 'mirada-17',
                  img: '17',
                  correctAnswer: 'insecure',
                  options: [
                    { label: 'Insegura', value: 'insecure' },
                    { label: 'Afectuosa', value: 'affectionate' },
                    { label: 'Juguetona', value: 'playful' },
                    { label: 'Asustada', value: 'scared' },
                  ],
                },
                {
                  id: 'mirada-18',
                  img: '18',
                  correctAnswer: 'decisive',
                  options: [
                    { label: 'Decidida', value: 'decisive' },
                    { label: 'Entretenida', value: 'entertained' },
                    { label: 'Asustada', value: 'scared' },
                    { label: 'Aburrida', value: 'bored' },
                  ],
                },
                {
                  id: 'mirada-19',
                  img: '19',
                  correctAnswer: 'hesitant',
                  options: [
                    { label: 'Arrogante', value: 'arrogant' },
                    { label: 'Agradecida', value: 'grateful' },
                    { label: 'Sarcástica', value: 'sarcastic' },
                    { label: 'Vacilante', value: 'hesitant' },
                  ],
                },
                {
                  id: 'mirada-20',
                  img: '20',
                  correctAnswer: 'friendly',
                  options: [
                    { label: 'Imponente', value: 'imposing' },
                    { label: 'Amistoso', value: 'friendly' },
                    { label: 'Culpable', value: 'guilty' },
                    { label: 'Horrorizado', value: 'horrified' },
                  ],
                },
                {
                  id: 'mirada-21',
                  img: '21',
                  correctAnswer: 'fanciful',
                  options: [
                    { label: 'Abochornada', value: 'embarrassed' },
                    { label: 'Fantasiosa', value: 'fanciful' },
                    { label: 'Confundida', value: 'confused' },
                    { label: 'En pánico', value: 'panicked' },
                  ],
                },
                {
                  id: 'mirada-22',
                  img: '22',
                  correctAnswer: 'distressed',
                  options: [
                    { label: 'Angustiada', value: 'distressed' },
                    { label: 'Agradecida', value: 'grateful' },
                    { label: 'Insistente', value: 'insistent' },
                    { label: 'Suplicante', value: 'pleading' },
                  ],
                },
                {
                  id: 'mirada-23',
                  img: '23',
                  correctAnswer: 'defiant',
                  options: [
                    { label: 'Satisfecho', value: 'satisfied' },
                    { label: 'Arrepentido', value: 'regretful' },
                    { label: 'Desafiante', value: 'defiant' },
                    { label: 'Curioso', value: 'curious' },
                  ],
                },
                {
                  id: 'mirada-24',
                  img: '24',
                  correctAnswer: 'absorbed',
                  options: [
                    { label: 'Abstraído', value: 'absorbed' },
                    { label: 'Irritado', value: 'irritated' },
                    { label: 'Entusiasmado', value: 'excited' },
                    { label: 'Hostil', value: 'hostile' },
                  ],
                },
                {
                  id: 'mirada-25',
                  img: '25',
                  correctAnswer: 'interested',
                  options: [
                    { label: 'En pánico', value: 'panicked' },
                    { label: 'Incrédula', value: 'incredulous' },
                    { label: 'Abatida', value: 'dejected' },
                    { label: 'Interesada', value: 'interested' },
                  ],
                },
                {
                  id: 'mirada-26',
                  img: '26',
                  correctAnswer: 'hostile',
                  options: [
                    { label: 'Alarmado', value: 'alarmed' },
                    { label: 'Tímido', value: 'shy' },
                    { label: 'Hostil', value: 'hostile' },
                    { label: 'Ansioso', value: 'anxious' },
                  ],
                },
                {
                  id: 'mirada-27',
                  img: '27',
                  correctAnswer: 'cautious',
                  options: [
                    { label: 'Bromista', value: 'joking' },
                    { label: 'Prudente', value: 'cautious' },
                    { label: 'Arrogante', value: 'arrogant' },
                    { label: 'Tranquilizadora', value: 'reassuring' },
                  ],
                },
                {
                  id: 'mirada-28',
                  img: '28',
                  correctAnswer: 'interested',
                  options: [
                    { label: 'Interesada', value: 'interested' },
                    { label: 'Bromista', value: 'joking' },
                    { label: 'Afectuosa', value: 'affectionate' },
                    { label: 'Satisfecha', value: 'satisfied' },
                  ],
                },
                {
                  id: 'mirada-29',
                  img: '29',
                  correctAnswer: 'reflective',
                  options: [
                    { label: 'Impaciente', value: 'impatient' },
                    { label: 'Asustada', value: 'scared' },
                    { label: 'Irritada', value: 'irritated' },
                    { label: 'Reflexiva', value: 'reflective' },
                  ],
                },
                {
                  id: 'mirada-30',
                  img: '30',
                  correctAnswer: 'seductive',
                  options: [
                    { label: 'Agradecida', value: 'grateful' },
                    { label: 'Seductora', value: 'seductive' },
                    { label: 'Hostil', value: 'hostile' },
                    { label: 'Decepcionada', value: 'disappointed' },
                  ],
                },
                {
                  id: 'mirada-31',
                  img: '31',
                  correctAnswer: 'confident',
                  options: [
                    { label: 'Avergonzada', value: 'ashamed' },
                    { label: 'Segura', value: 'confident' },
                    { label: 'Bromista', value: 'joking' },
                    { label: 'Decaída', value: 'downcast' },
                  ],
                },
                {
                  id: 'mirada-32',
                  img: '32',
                  correctAnswer: 'serious',
                  options: [
                    { label: 'Serio', value: 'serious' },
                    { label: 'Avergonzado', value: 'ashamed' },
                    { label: 'Desconcertado', value: 'puzzled' },
                    { label: 'Alarmado', value: 'alarmed' },
                  ],
                },
                {
                  id: 'mirada-33',
                  img: '33',
                  correctAnswer: 'fanciful',
                  options: [
                    { label: 'Abochornado', value: 'embarrassed' },
                    { label: 'Culpable', value: 'guilty' },
                    { label: 'Fantasioso', value: 'fanciful' },
                    { label: 'Preocupado', value: 'worried' },
                  ],
                },
                {
                  id: 'mirada-34',
                  img: '34',
                  correctAnswer: 'suspicious',
                  options: [
                    { label: 'Asustada', value: 'scared' },
                    { label: 'Desconcertada', value: 'puzzled' },
                    { label: 'Recelosa', value: 'suspicious' },
                    { label: 'Aterrorizada', value: 'terrified' },
                  ],
                },
                {
                  id: 'mirada-35',
                  img: '35',
                  correctAnswer: 'nervous',
                  options: [
                    { label: 'Perpleja', value: 'perplexed' },
                    { label: 'Nerviosa', value: 'nervous' },
                    { label: 'Insistente', value: 'insistent' },
                    { label: 'Abstraída', value: 'absorbed' },
                  ],
                },
                {
                  id: 'mirada-36',
                  img: '36',
                  correctAnswer: 'distrustful',
                  options: [
                    { label: 'Avergonzado', value: 'ashamed' },
                    { label: 'Nervioso', value: 'nervous' },
                    { label: 'Desconfiado', value: 'distrustful' },
                    { label: 'Indeciso', value: 'indecisive' },
                  ],
                },
              ],
              n: 2,
            },
          },
        ],
      },
    },
    {
      id: 'screen-terms',
      type: 'screen',
      props: { slug: 'terms' },
    },
    {
      id: 'screen-intro',
      type: 'screen',
      props: { slug: 'intro' },
    },
    {
      id: 'loop-miradas',
      type: 'loop',
      props: {
        dataKey: '$$compute-sample-items.selected-items',
        type: 'dynamic',
        itemKey: 'id',
        stepper: {
          label: 'Retrato {index}/{total}',
          style: 'continuous',
        },
      },
    },
    {
      id: 'screen-mirada',
      type: 'screen',
      props: { slug: 'mirada' },
    },
    {
      id: 'compute-correct',
      type: 'compute',
      props: {
        name: 'compute-correct',
        computations: [
          {
            outputKey: 'total',
            formula: {
              type: 'loop-aggregate',
              loopId: 'loop-miradas',
              op: 'count',
            },
          },
          {
            outputKey: 'total-correct',
            formula: {
              type: 'loop-aggregate',
              loopId: 'loop-miradas',
              op: 'count',
              where: {
                type: 'simple',
                operator: 'eq',
                dataKey: '@loop-miradas.mirada.answer',
                value: '@loop-miradas.value.correctAnswer',
              },
            },
          },
          {
            outputKey: 'feedback-text',
            formula: {
              type: 'lookup',
              input: '$total-correct',
              table: [
                {
                  when: 0,
                  then: 'No ganarás el mundial de póker, pero contribuiste a la ciencia sobre el reconocimiento de las emociones :)',
                },
                {
                  when: 3,
                  then: 'Y dado que había 4 posibilidades, medio que es indistinguible del azar. Si sos un generador de respuestas aleatorias, felicitaciones, tu desempeño fue impecable.',
                },
                {
                  when: 6,
                  then: 'Qué emoción. Si te miraras al espejo, probablemente la reconocerías.',
                },
                {
                  when: 10,
                  then: '¡Increíble! Has logrado reconocer todas las emociones correctamente.',
                },
              ],
            },
          },
          {
            outputKey: 'feedback-image',
            formula: {
              type: 'lookup',
              input: '$total-correct',
              table: [
                {
                  when: 0,
                  then: 'https://investigacion.elgatoylacaja.com/emociones/images/feedback_01.png',
                },
                {
                  when: 3,
                  then: 'https://investigacion.elgatoylacaja.com/emociones/images/feedback_02.png',
                },
                {
                  when: 6,
                  then: 'https://investigacion.elgatoylacaja.com/emociones/images/feedback_03.png',
                },
                {
                  when: 10,
                  then: 'https://investigacion.elgatoylacaja.com/emociones/images/feedback_04.png',
                },
              ],
            },
          },
        ],
      },
    },
    {
      id: 'checkpoint-answers',
      type: 'checkpoint',
      props: {
        name: 'checkpoint-answers',
      },
    },
    {
      id: 'screen-regressors',
      type: 'screen',
      props: { slug: 'regressors' },
    },
    {
      id: 'screen-end',
      type: 'screen',
      props: { slug: 'end' },
    },
    { id: 'end', type: 'end' },
  ],
  edges: [
    { type: 'sequential', from: 'start', to: 'compute-sample-items' },
    { type: 'sequential', from: 'compute-sample-items', to: 'screen-terms' },
    { type: 'sequential', from: 'screen-terms', to: 'screen-intro' },
    { type: 'sequential', from: 'screen-intro', to: 'loop-miradas' },
    { type: 'loop-template', from: 'loop-miradas', to: 'screen-mirada' },
    { type: 'sequential', from: 'loop-miradas', to: 'compute-correct' },
    { type: 'sequential', from: 'compute-correct', to: 'checkpoint-answers' },
    { type: 'sequential', from: 'checkpoint-answers', to: 'screen-regressors' },
    { type: 'sequential', from: 'screen-regressors', to: 'screen-end' },
    { type: 'sequential', from: 'screen-end', to: 'end' },
  ],
  screens: [
    {
      slug: 'terms',
      components: [
        {
          componentFamily: 'content',
          template: 'rich-text',
          props: {
            content:
              '# Antes de empezar \n\n El objetivo de este experimento es aprender más sobre los factores que afectan la forma en la que reconocemos emociones en los rostros de las personas. \n\n Vas a ver 12 fotos de pares de ojos. Para cada uno, elegí y hace click sobre la palabra que mejor describa lo que la persona en la fotografía está pensando o sintiendo. Las definiciones de estas palabras están estandarizadas y se pueden ver durante el experimento. \n\n El experimento completo dura unos 5 minutos. Tu participación es absolutamente voluntaria y te podés bajar en cualquier momento. No esperamos ningún tipo de inconveniente o riesgo por participar. Los datos son confidenciales y anónimos. \n\nSi tenés cualquier tipo de duda, nos mandás un mail a [labs@elgatoylacaja.com](mailto:labs@elgatoylacaja.com). Si la pregunta se nos escapa, o querés hacer otro tipo de comentario, tené en mente que podés contactarte con el Comité de Ética en Investigación, Centro de Educación Médica e Investigaciones Clínicas “Norberto Quirno”. Hospital Universitario sede Saavedra, Av. Galván 4102. Ciudad de Buenos Aires, (C1425DQK) - República Argentina. Tel: 5299-0100, interno 2879. \n\n Apenas esté el análisis de estos datos vamos (como siempre) a publicar los resultados en [www.elgatoylacaja.com](https://elgatoylacaja.com) para conversar sobre lo que aprendimos gracias a tu participación.',
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
              '## Importante \n\n Leé las 4 palabras antes de contestar. \n\n Si no entendés alguna palabra, al lado tenés un botón con la explicación. \n\n Indicá con precisión tu nivel de confianza, usando toda la escala. \n\n Al finalizar, recibirás una devolución en base a tus respuestas.',
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
            url: 'https://investigacion.elgatoylacaja.com/emociones/images/miradas/{{@loop-miradas.value.img}}.png',
            alt: 'Retrato de mirada',
          },
        },
        {
          componentFamily: 'response',
          template: 'radio',
          props: {
            label: '¿Qué opción describe mejor a esta persona?',
            dataKey: 'answer',
            options: '@loop-miradas.value.options',
            randomize: true,
            reshuffleInLoop: true,
          },
        },
        {
          componentFamily: 'response',
          template: 'slider',
          props: {
            label: '¿Cuánto confiás en tu respuesta?',
            dataKey: 'confidence',
            minLabel: 'No confío nada',
            maxLabel: 'Confío completamente',
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
    {
      slug: 'regressors',
      components: [
        // {
        //   componentFamily: 'control',
        //   template: 'for-each',
        //   props: {
        //     type: 'dynamic',
        //     id: 'for-each-mirada',
        //     dataKey: '$$compute-sample-items.selected-items',
        //     component: {
        //       componentFamily: 'layout',
        //       template: 'group',
        //       props: {
        //         // Show each result and if it was correct or not, to encourage participants to answer the next questions carefully
        //         name: 'Answer result',
        //         components: [
        //           {
        //             componentFamily: 'content',
        //             template: 'image',
        //             props: {
        //               url: 'https://investigacion.elgatoylacaja.com/emociones/images/miradas/{{#for-each-mirada.value.img}}.png',
        //               alt: '',
        //             },
        //           },
        //           {
        //             componentFamily: 'content',
        //             template: 'rich-text',
        //             props: {
        //               content:
        //                 'Tu respuesta:{{$$loop-miradas.{{#for-each-mirada.value.id}}.mirada.answer}}',
        //             },
        //           },
        //           {
        //             componentFamily: 'control',
        //             template: 'for-each',
        //             props: {
        //               id: 'for-each-option',
        //               type: 'dynamic',
        //               dataKey: '#for-each-mirada.value.options',
        //               component: {
        //                 componentFamily: 'control',
        //                 template: 'conditional',
        //                 props: {
        //                   if: {
        //                     type: 'simple',
        //                     dataKey: '#for-each-option.value.value',
        //                     operator: 'eq',
        //                     value: '#for-each-mirada.value.correctAnswer',
        //                   },
        //                   component: {
        //                     componentFamily: 'content',
        //                     template: 'rich-text',
        //                     props: {
        //                       content:
        //                         '{{#for-each-option.value.label}} (correcta) \n\n',
        //                     },
        //                   },
        //                   else: {
        //                     componentFamily: 'content',
        //                     template: 'rich-text',
        //                     props: {
        //                       content: '{{#for-each-option.value.label}} \n\n',
        //                     },
        //                   },
        //                 },
        //               },
        //             },
        //           },
        //         ],
        //       },
        //     },
        //   },
        // },
        {
          componentFamily: 'content',
          template: 'rich-text',
          props: {
            content:
              '## Casi terminamos \n\n Para terminar, nos ayudaría mucho si respondés estas preguntas sobre vos. Nos van a ayudar a entender mejor los resultados del experimento, y como siempre, los datos son confidenciales y anónimos.',
          },
        },
        {
          componentFamily: 'response',
          template: 'numeric-input',
          props: {
            label: 'Edad',
            dataKey: 'edad',
            min: 18,
            max: 120,
          },
        },
        {
          componentFamily: 'response',
          template: 'dropdown',
          props: {
            label: 'Nivel educativo',
            dataKey: 'nivel-educativo',
            options: '%niveles-educativos',
          },
        },
        {
          componentFamily: 'response',
          template: 'dropdown',
          props: {
            label: 'Género',
            dataKey: 'genero',
            options: '%generos',
          },
        },
        {
          componentFamily: 'response',
          template: 'radio',
          props: {
            label: '¿Tenés hijos?',
            dataKey: 'tiene-hijos',
            options: [
              { label: 'Sí', value: 'si' },
              { label: 'No', value: 'no' },
            ],
          },
        },
        {
          componentFamily: 'control',
          template: 'conditional',
          props: {
            if: {
              type: 'simple',
              dataKey: '$tiene-hijos',
              operator: 'eq',
              value: 'si',
            },
            component: {
              componentFamily: 'response',
              template: 'numeric-input',
              props: {
                label: '¿Cuántos hijos tenés?',
                dataKey: 'cantidad-hijos',
                min: 1,
              },
            },
          },
        },
        //
        {
          componentFamily: 'response',
          template: 'radio',
          props: {
            label: '¿Consumiste alguna vez MDMA (éxtasis)?',
            dataKey: 'consumio-mdma',
            options: [
              { label: 'Sí', value: 'si' },
              { label: 'No', value: 'no' },
            ],
          },
        },
        {
          componentFamily: 'control',
          template: 'conditional',
          props: {
            if: {
              type: 'simple',
              dataKey: '$consumio-mdma',
              operator: 'eq',
              value: 'si',
            },
            component: {
              componentFamily: 'layout',
              template: 'group',
              props: {
                name: 'Preguntas consumo MDMA',
                components: [
                  {
                    componentFamily: 'response',
                    template: 'radio',
                    props: {
                      label: '¿Cuándo fue la última vez que consumiste?',
                      dataKey: 'ultima-vez-consumo',
                      options: '%ultima-vez-consumo',
                    },
                  },
                  {
                    componentFamily: 'response',
                    template: 'numeric-input',
                    props: {
                      label:
                        '¿Cuántas veces consumiste en los últimos 12 meses?',
                      dataKey: 'veces-consumo-ultimos-12-meses',
                      min: 1,
                    },
                  },
                  {
                    componentFamily: 'response',
                    template: 'numeric-input',
                    props: {
                      label:
                        '¿Cuántas veces estimás que consumiste MDMA en toda tu vida?',
                      dataKey: 'veces-consumo-toda-vida',
                      min: 1,
                    },
                  },
                ],
              },
            },
          },
        },
        {
          componentFamily: 'response',
          template: 'slider',
          props: {
            label: 'Más allá de las instituciones, te considerás una persona:',
            dataKey: 'religiosidad',
            minLabel: 'Nada religiosa',
            maxLabel: 'Muy religiosa',
          },
        },
        {
          componentFamily: 'response',
          template: 'slider',
          props: {
            label:
              'Creés que la economía de una sociedad debería estar principalmente manejada por:',
            dataKey: 'mercado-estado',
            minLabel: 'El mercado',
            maxLabel: 'El estado',
          },
        },
        {
          componentFamily: 'response',
          template: 'slider',
          props: {
            label:
              'Si tuvieras que definir tu posición política, ¿dónde te ubicarías?',
            dataKey: 'conservador-progresista',
            minLabel: 'Absolutamente conservador',
            maxLabel: 'Absolutamente progresista',
          },
        },
        {
          componentFamily: 'layout',
          template: 'button',
          props: {
            text: 'Finalizar',
            alignBottom: true,
          },
        },
      ],
    },
    {
      slug: 'end',
      components: [
        {
          componentFamily: 'content',
          template: 'rich-text',
          props: {
            content:
              '## ¡Gracias por participar!\n\nRespuestas correctas: {{$$compute-correct.total-correct}} / {{$$compute-correct.total}} \n\n {{$$compute-correct.feedback-text}}',
          },
        },
        {
          componentFamily: 'content',
          template: 'image',
          props: {
            url: '{{$$compute-correct.feedback-image}}',
            alt: 'Imagen de feedback',
          },
        },
      ],
    },
  ],
  options: {
    'niveles-educativos': [
      { label: 'Primaria incompleta', value: 'primaria-incompleta' },
      { label: 'Primaria completa', value: 'primaria-completa' },
      { label: 'Secundaria incompleta', value: 'secundaria-incompleta' },
      { label: 'Secundaria completa', value: 'secundaria-completa' },
      {
        label: 'Terciario/Universitario incompleto',
        value: 'terciario-universitario-incompleto',
      },
      {
        label: 'Terciario/Universitario completo',
        value: 'terciario-universitario-completo',
      },
    ],
    generos: [
      { label: 'Mujer', value: 'mujer' },
      { label: 'Varón', value: 'varon' },
      { label: 'Otro', value: 'otro' },
    ],
    'ultima-vez-consumo': [
      { label: 'En los últimos 3 días', value: 'ultimos-tres-dias' },
      { label: 'En los últimos 7 días', value: 'ultimos-siete-dias' },
      { label: 'En los últimos 30 días', value: 'ultimos-treinta-dias' },
      { label: 'En los últimos 12 meses', value: 'ultimos-doce-meses' },
      { label: 'Hace más de 12 meses', value: 'mas-de-doce-meses' },
    ],
  },
};

export default emociones;
