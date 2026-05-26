import { ExperimentFlow } from '@/lib/types';

const emociones: ExperimentFlow = {
  nodes: [
    { id: 'start', type: 'start' },
    {
      id: 'compute',
      type: 'compute',
      props: {
        name: 'randomize-images',
        computations: [
          {
            outputKey: 'selected-items',
            formula: {
              type: 'sample',
              input: [
                {
                  id: '1',
                  correctAnswer: 'playful',
                  options: [
                    { label: 'Juguetón', value: 'playful' },
                    { label: 'Reconfortante', value: 'comforting' },
                    { label: 'Irritado', value: 'irritated' },
                    { label: 'Aburrido', value: 'bored' },
                  ],
                },
                {
                  id: '2',
                  correctAnswer: 'upset',
                  options: [
                    { label: 'Aterrorizado', value: 'terrified' },
                    { label: 'Molesto', value: 'upset' },
                    { label: 'Arrogante', value: 'arrogant' },
                    { label: 'Enfadado', value: 'angry' },
                  ],
                },
                {
                  id: '3',
                  correctAnswer: 'desire',
                  options: [
                    { label: 'Bromista', value: 'joking' },
                    { label: 'Agobiada', value: 'overwhelmed' },
                    { label: 'Deseo', value: 'desire' },
                    { label: 'Convencida', value: 'convinced' },
                  ],
                },
                {
                  id: '4',
                  correctAnswer: 'insistent',
                  options: [
                    { label: 'Bromista', value: 'joking' },
                    { label: 'Insistente', value: 'insistent' },
                    { label: 'Entretenido', value: 'entertained' },
                    { label: 'Relajado', value: 'relaxed' },
                  ],
                },
                {
                  id: '5',
                  correctAnswer: 'sarcastic',
                  options: [
                    { label: 'Irritado', value: 'irritated' },
                    { label: 'Sarcástico', value: 'sarcastic' },
                    { label: 'Preocupado', value: 'worried' },
                    { label: 'Amistoso', value: 'friendly' },
                  ],
                },
                {
                  id: '6',
                  correctAnswer: 'fanciful',
                  options: [
                    { label: 'Asustada', value: 'scared' },
                    { label: 'Fantasiosa', value: 'fanciful' },
                    { label: 'Impaciente', value: 'impatient' },
                    { label: 'Alarmada', value: 'alarmed' },
                  ],
                },
                {
                  id: '7',
                  correctAnswer: 'uneasy',
                  options: [
                    { label: 'Arrepentido', value: 'regretful' },
                    { label: 'Amistoso', value: 'friendly' },
                    { label: 'Intranquilo', value: 'uneasy' },
                    { label: 'Decaído', value: 'downcast' },
                  ],
                },
                {
                  id: '8',
                  correctAnswer: 'dejected',
                  options: [
                    { label: 'Abatido', value: 'dejected' },
                    { label: 'Aliviado', value: 'relieved' },
                    { label: 'Tímido', value: 'shy' },
                    { label: 'Entusiasmado', value: 'excited' },
                  ],
                },
                {
                  id: '9',
                  correctAnswer: 'distressed',
                  options: [
                    { label: 'Enfadada', value: 'angry' },
                    { label: 'Hostil', value: 'hostile' },
                    { label: 'Horrorizada', value: 'horrified' },
                    { label: 'Angustiada', value: 'distressed' },
                  ],
                },
                {
                  id: '10',
                  correctAnswer: 'cautious',
                  options: [
                    { label: 'Prudente', value: 'cautious' },
                    { label: 'Insistente', value: 'insistent' },
                    { label: 'Aburrido', value: 'bored' },
                    { label: 'Asustado', value: 'scared' },
                  ],
                },
                {
                  id: '11',
                  correctAnswer: 'regretful',
                  options: [
                    { label: 'Aterrorizado', value: 'terrified' },
                    { label: 'Entretenido', value: 'entertained' },
                    { label: 'Arrepentido', value: 'regretful' },
                    { label: 'Seductor', value: 'seductive' },
                  ],
                },
                {
                  id: '12',
                  correctAnswer: 'skeptical',
                  options: [
                    { label: 'Indiferente', value: 'indifferent' },
                    { label: 'Abochornado', value: 'embarrassed' },
                    { label: 'Escéptico', value: 'skeptical' },
                    { label: 'Decaído', value: 'downcast' },
                  ],
                },
                {
                  id: '13',
                  correctAnswer: 'decisive',
                  options: [
                    { label: 'Decidido', value: 'decisive' },
                    { label: 'Expectante', value: 'expectant' },
                    { label: 'Amenazante', value: 'threatening' },
                    { label: 'Tímido', value: 'shy' },
                  ],
                },
                {
                  id: '14',
                  correctAnswer: 'accusing',
                  options: [
                    { label: 'Irritado', value: 'irritated' },
                    { label: 'Decepcionado', value: 'disappointed' },
                    { label: 'Deprimido', value: 'depressed' },
                    { label: 'Acusante', value: 'accusing' },
                  ],
                },
                {
                  id: '15',
                  correctAnswer: 'absorbed',
                  options: [
                    { label: 'Abstraída', value: 'absorbed' },
                    { label: 'Agobiada', value: 'overwhelmed' },
                    { label: 'Alentadora', value: 'encouraging' },
                    { label: 'Entretenida', value: 'entertained' },
                  ],
                },
                {
                  id: '16',
                  correctAnswer: 'considerate',
                  options: [
                    { label: 'Irritado', value: 'irritated' },
                    { label: 'Considerado', value: 'considerate' },
                    { label: 'Alentador', value: 'encouraging' },
                    { label: 'Compasivo', value: 'compassionate' },
                  ],
                },
                {
                  id: '17',
                  correctAnswer: 'insecure',
                  options: [
                    { label: 'Insegura', value: 'insecure' },
                    { label: 'Afectuosa', value: 'affectionate' },
                    { label: 'Juguetona', value: 'playful' },
                    { label: 'Asustada', value: 'scared' },
                  ],
                },
                {
                  id: '18',
                  correctAnswer: 'decisive',
                  options: [
                    { label: 'Decidida', value: 'decisive' },
                    { label: 'Entretenida', value: 'entertained' },
                    { label: 'Asustada', value: 'scared' },
                    { label: 'Aburrida', value: 'bored' },
                  ],
                },
                {
                  id: '19',
                  correctAnswer: 'hesitant',
                  options: [
                    { label: 'Arrogante', value: 'arrogant' },
                    { label: 'Agradecida', value: 'grateful' },
                    { label: 'Sarcástica', value: 'sarcastic' },
                    { label: 'Vacilante', value: 'hesitant' },
                  ],
                },
                {
                  id: '20',
                  correctAnswer: 'friendly',
                  options: [
                    { label: 'Imponente', value: 'imposing' },
                    { label: 'Amistoso', value: 'friendly' },
                    { label: 'Culpable', value: 'guilty' },
                    { label: 'Horrorizado', value: 'horrified' },
                  ],
                },
                {
                  id: '21',
                  correctAnswer: 'fanciful',
                  options: [
                    { label: 'Abochornada', value: 'embarrassed' },
                    { label: 'Fantasiosa', value: 'fanciful' },
                    { label: 'Confundida', value: 'confused' },
                    { label: 'En pánico', value: 'panicked' },
                  ],
                },
                {
                  id: '22',
                  correctAnswer: 'distressed',
                  options: [
                    { label: 'Angustiada', value: 'distressed' },
                    { label: 'Agradecida', value: 'grateful' },
                    { label: 'Insistente', value: 'insistent' },
                    { label: 'Suplicante', value: 'pleading' },
                  ],
                },
                {
                  id: '23',
                  correctAnswer: 'defiant',
                  options: [
                    { label: 'Satisfecho', value: 'satisfied' },
                    { label: 'Arrepentido', value: 'regretful' },
                    { label: 'Desafiante', value: 'defiant' },
                    { label: 'Curioso', value: 'curious' },
                  ],
                },
                {
                  id: '24',
                  correctAnswer: 'absorbed',
                  options: [
                    { label: 'Abstraído', value: 'absorbed' },
                    { label: 'Irritado', value: 'irritated' },
                    { label: 'Entusiasmado', value: 'excited' },
                    { label: 'Hostil', value: 'hostile' },
                  ],
                },
                {
                  id: '25',
                  correctAnswer: 'interested',
                  options: [
                    { label: 'En pánico', value: 'panicked' },
                    { label: 'Incrédula', value: 'incredulous' },
                    { label: 'Abatida', value: 'dejected' },
                    { label: 'Interesada', value: 'interested' },
                  ],
                },
                {
                  id: '26',
                  correctAnswer: 'hostile',
                  options: [
                    { label: 'Alarmado', value: 'alarmed' },
                    { label: 'Tímido', value: 'shy' },
                    { label: 'Hostil', value: 'hostile' },
                    { label: 'Ansioso', value: 'anxious' },
                  ],
                },
                {
                  id: '27',
                  correctAnswer: 'cautious',
                  options: [
                    { label: 'Bromista', value: 'joking' },
                    { label: 'Prudente', value: 'cautious' },
                    { label: 'Arrogante', value: 'arrogant' },
                    { label: 'Tranquilizadora', value: 'reassuring' },
                  ],
                },
                {
                  id: '28',
                  correctAnswer: 'interested',
                  options: [
                    { label: 'Interesada', value: 'interested' },
                    { label: 'Bromista', value: 'joking' },
                    { label: 'Afectuosa', value: 'affectionate' },
                    { label: 'Satisfecha', value: 'satisfied' },
                  ],
                },
                {
                  id: '29',
                  correctAnswer: 'reflective',
                  options: [
                    { label: 'Impaciente', value: 'impatient' },
                    { label: 'Asustada', value: 'scared' },
                    { label: 'Irritada', value: 'irritated' },
                    { label: 'Reflexiva', value: 'reflective' },
                  ],
                },
                {
                  id: '30',
                  correctAnswer: 'seductive',
                  options: [
                    { label: 'Agradecida', value: 'grateful' },
                    { label: 'Seductora', value: 'seductive' },
                    { label: 'Hostil', value: 'hostile' },
                    { label: 'Decepcionada', value: 'disappointed' },
                  ],
                },
                {
                  id: '31',
                  correctAnswer: 'confident',
                  options: [
                    { label: 'Avergonzada', value: 'ashamed' },
                    { label: 'Segura', value: 'confident' },
                    { label: 'Bromista', value: 'joking' },
                    { label: 'Decaída', value: 'downcast' },
                  ],
                },
                {
                  id: '32',
                  correctAnswer: 'serious',
                  options: [
                    { label: 'Serio', value: 'serious' },
                    { label: 'Avergonzado', value: 'ashamed' },
                    { label: 'Desconcertado', value: 'puzzled' },
                    { label: 'Alarmado', value: 'alarmed' },
                  ],
                },
                {
                  id: '33',
                  correctAnswer: 'fanciful',
                  options: [
                    { label: 'Abochornado', value: 'embarrassed' },
                    { label: 'Culpable', value: 'guilty' },
                    { label: 'Fantasioso', value: 'fanciful' },
                    { label: 'Preocupado', value: 'worried' },
                  ],
                },
                {
                  id: '34',
                  correctAnswer: 'suspicious',
                  options: [
                    { label: 'Asustada', value: 'scared' },
                    { label: 'Desconcertada', value: 'puzzled' },
                    { label: 'Recelosa', value: 'suspicious' },
                    { label: 'Aterrorizada', value: 'terrified' },
                  ],
                },
                {
                  id: '35',
                  correctAnswer: 'nervous',
                  options: [
                    { label: 'Perpleja', value: 'perplexed' },
                    { label: 'Nerviosa', value: 'nervous' },
                    { label: 'Insistente', value: 'insistent' },
                    { label: 'Abstraída', value: 'absorbed' },
                  ],
                },
                {
                  id: '36',
                  correctAnswer: 'distrustful',
                  options: [
                    { label: 'Avergonzado', value: 'ashamed' },
                    { label: 'Nervioso', value: 'nervous' },
                    { label: 'Desconfiado', value: 'distrustful' },
                    { label: 'Indeciso', value: 'indecisive' },
                  ],
                },
              ],
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
        dataKey: '$$compute.selected-items',
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
    {
      id: 'compute-correct',
      type: 'compute',
      props: {
        name: 'compute-correct',
        computations: [
          {
            outputKey: 'total-correct',
            formula: {
              type: 'count-correct',
              itemsKey: '$$compute.selected-items',
              loopId: 'loop',
              screenSlug: 'mirada',
              answerKey: 'answer',
              correctKey: 'correctAnswer',
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
      id: 'end',
      type: 'screen',
      props: { slug: 'end' },
    },
  ],
  edges: [
    { type: 'sequential', from: 'start', to: 'compute' },
    { type: 'sequential', from: 'compute', to: 'terms' },
    { type: 'sequential', from: 'terms', to: 'intro' },
    { type: 'sequential', from: 'intro', to: 'loop' },
    { type: 'loop-template', from: 'loop', to: 'screen-mirada' },
    { type: 'sequential', from: 'loop', to: 'compute-correct' },
    { type: 'sequential', from: 'compute-correct', to: 'end' },
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
            url: 'https://investigacion.elgatoylacaja.com/emociones/images/miradas/{{@loop.value.id}}.png',
            alt: 'Retrato de mirada',
          },
        },
        {
          componentFamily: 'response',
          template: 'radio',
          props: {
            label:
              '¿Qué opción describe mejor a esta persona? (id: {{@loop.value.id}})',
            dataKey: 'answer',
            options: '@loop.value.options',
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
      slug: 'end',
      components: [
        {
          componentFamily: 'content',
          template: 'rich-text',
          props: {
            content:
              '## ¡Gracias por participar!\n\nRespuestas correctas: {{$$compute-correct.total-correct}} / 12 \n\n {{$$compute-correct.feedback-text}}',
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
};

export default emociones;
