import { ExperimentFlow } from '@/lib/types';

export const experiment: ExperimentFlow = {
  options: {
    frequency: [
      { label: 'Todos los días', value: 'daily' },
      { label: 'Una o varias veces a la semana', value: 'weekly' },
      { label: 'Una o varias veces al mes', value: 'monthly' },
      { label: 'Muy esporádicamente', value: 'sporadically' },
      { label: 'Nunca', value: 'never' },
    ],
    'yes-no': [
      { label: 'Sí', value: 'yes' },
      { label: 'No', value: 'no' },
    ],
  },
  nodes: [
    { id: 'start', type: 'start' },
    { id: 'screen-terms', type: 'screen', props: { slug: 'terms' } },
    {
      id: 'screen-first-questions',
      type: 'screen',
      props: { slug: 'first-questions' },
    },
    {
      id: 'checkpoint-first-questions',
      type: 'checkpoint',
      props: {
        name: 'first-questions-completed',
      },
    },
    {
      id: 'screen-psychedelics-options',
      type: 'screen',
      props: { slug: 'psychedelics-options' },
    },
    {
      id: 'branch-psychedelics',
      type: 'branch',
      props: {
        name: 'psychedelic-substances',
        branches: [
          {
            id: 'consumed-psychedelics',
            name: 'consumed-psychedelics',
            config: {
              type: 'simple',
              dataKey: '$$psychedelics-options.psychedelic-substances',
              operator: 'length-gt',
              value: 0,
            },
          },
        ],
      },
    },
    {
      id: 'path-psychedelics',
      type: 'path',
      props: {
        name: 'psychedelic-experiences-report',
        description:
          'Path for reporting psychedelic experiences, only shown to those who consumed psychedelics',
        stepper: {
          label: '{index} / {total}',
          style: 'dashed',
        },
      },
    },
    {
      id: 'screen-psychedelics-general',
      type: 'screen',
      props: { slug: 'psychedelics-general' },
    },
    {
      id: 'branch-most-impactful-psychedelic',
      type: 'branch',
      props: {
        name: 'most-impactful-psychedelic',
        description:
          'Branch to check if the had experiences with more than one psychedelic substance and, if so, ask which one was more impactful',
        branches: [
          {
            id: 'had-multiple-psychedelics',
            name: 'had-multiple-psychedelics',
            config: {
              type: 'simple',
              dataKey: '$$psychedelics-options.psychedelic-substances',
              operator: 'length-gt',
              value: 1,
            },
          },
        ],
      },
    },
    {
      id: 'screen-psychedelics-most-impactful',
      type: 'screen',
      props: { slug: 'psychedelics-most-impactful' },
    },
    {
      id: 'screen-psychedelics-last-time',
      type: 'screen',
      props: { slug: 'psychedelics-last-time' },
    },
    {
      id: 'screen-psychedelics-motives',
      type: 'screen',
      props: { slug: 'psychedelics-motives' },
    },

    {
      id: 'screen-psychoactive-options',
      type: 'screen',
      props: { slug: 'psychoactive-options' },
    },
    {
      id: 'branch-psychoactives',
      type: 'branch',
      props: {
        name: 'psychoactive-substances',
        branches: [
          {
            id: 'consumed-psychoactives',
            name: 'consumed-psychoactives',
            config: {
              type: 'simple',
              dataKey: '$$psychoactive-options.psychoactive-substances',
              operator: 'length-gt',
              value: 0,
            },
          },
        ],
      },
    },
    {
      id: 'screen-psychoactive-quarantine-change',
      type: 'screen',
      props: { slug: 'psychoactive-quarantine-change' },
    },
    {
      id: 'screen-thanks',
      type: 'screen',
      props: { slug: 'thanks' },
    },
  ],
  edges: [
    { type: 'sequential', from: 'start', to: 'screen-terms' },
    { type: 'sequential', from: 'screen-terms', to: 'screen-first-questions' },

    {
      type: 'sequential',
      from: 'screen-first-questions',
      to: 'checkpoint-first-questions',
    },

    {
      type: 'sequential',
      from: 'checkpoint-first-questions',
      to: 'screen-psychedelics-options',
    },

    {
      type: 'sequential',
      from: 'screen-psychedelics-options',
      to: 'branch-psychedelics',
    },
    {
      type: 'branch-condition',
      from: 'branch-psychedelics.consumed-psychedelics',
      to: 'path-psychedelics',
    },

    {
      type: 'path-contains',
      from: 'path-psychedelics',
      to: 'screen-psychedelics-general',
      order: 0,
    },
    {
      type: 'path-contains',
      from: 'path-psychedelics',
      to: 'branch-most-impactful-psychedelic',
      order: 1,
    },
    {
      type: 'branch-condition',
      from: 'branch-most-impactful-psychedelic.had-multiple-psychedelics',
      to: 'screen-psychedelics-most-impactful',
    },
    {
      type: 'branch-default',
      from: 'branch-most-impactful-psychedelic',
      to: 'screen-psychedelics-last-time',
    },
    {
      type: 'path-contains',
      from: 'path-psychedelics',
      to: 'screen-psychedelics-last-time',
      order: 2,
    },
    {
      type: 'path-contains',
      from: 'path-psychedelics',
      to: 'screen-psychedelics-motives',
      order: 3,
    },
    {
      type: 'branch-default',
      from: 'branch-psychedelics',
      to: 'screen-psychoactive-options',
    },
    {
      type: 'sequential',
      from: 'path-psychedelics',
      to: 'screen-psychoactive-options',
    },
    {
      type: 'sequential',
      from: 'screen-psychoactive-options',
      to: 'branch-psychoactives',
    },
    {
      type: 'branch-condition',
      from: 'branch-psychoactives.consumed-psychoactives',
      to: 'screen-psychoactive-quarantine-change',
    },
    {
      type: 'branch-default',
      from: 'branch-psychoactives',
      to: 'screen-thanks',
    },
    {
      type: 'sequential',
      from: 'screen-psychoactive-quarantine-change',
      to: 'screen-thanks',
    },
  ],
  screens: [
    {
      slug: 'terms',
      components: [
        {
          componentFamily: 'content',
          template: 'rich-text',
          props: {
            content: '# Pandemia, conciencias y sustancias',
          },
        },
        {
          componentFamily: 'content',
          template: 'rich-text',
          props: {
            content:
              'El objetivo de este experimento es tratar de entender mejor cómo algunos aspectos de nuestra personalidad, la realización (o no) de práctica contemplativas como el rezo y la meditación y el consumo (o no) de distintas sustancias psicoactivas se relacionan con la forma en la que atravesamos el aislamiento durante la pandemia.',
          },
        },
        {
          componentFamily: 'content',
          template: 'rich-text',
          props: {
            content:
              'Esta encuesta no está dirigida específicamente a meditadores expertas, practicantes religiosos o consumidores de estas sustancias, sino que nos interesa entender a las personas y sus conciencia en toda su diversidad, y cómo se relaciona esa diversidad con el espectro de posibles reacciones ante la situación actual.  Mientras más distintas seamos las personas participantes, más vamos a poder aprender.',
          },
        },
        {
          componentFamily: 'content',
          template: 'rich-text',
          props: {
            content:
              'Tu participación es voluntaria y todos tus datos están anonimizados y van a ser usados para intentar construir conocimiento científico nuevo.',
          },
        },
        {
          componentFamily: 'content',
          template: 'rich-text',
          props: {
            content:
              'La finalidad del estudio es puramente académica y de ninguna manera incentiva al consumo de sustancias psicoactivas, aunque tampoco lo juzgamos. Estamos para aprender.',
          },
        },
        {
          componentFamily: 'response',
          template: 'single-checkbox',
          props: {
            label: 'Estoy de acuerdo y acepto participar de este estudio',
            dataKey: 'consent',
            required: true,
            defaultValue: false,
            shouldBe: true,
          },
        },
        {
          componentFamily: 'control',
          template: 'conditional',
          props: {
            if: {
              type: 'simple',
              dataKey: '$consent',
              operator: 'eq',
              value: true,
            },
            component: {
              id: 'start-button',
              componentFamily: 'layout',
              template: 'button',
              props: {
                text: 'Empezar',
                alignBottom: true,
              },
            },
            else: {
              id: 'start-button',
              componentFamily: 'layout',
              template: 'button',
              props: {
                text: 'Empezar',
                alignBottom: true,
                disabled: true,
              },
            },
          },
        },
      ],
    },
    {
      slug: 'first-questions',
      components: [
        {
          componentFamily: 'content',
          template: 'rich-text',
          props: {
            content: '## Para empezar',
          },
        },
        {
          componentFamily: 'response',
          template: 'slider',
          props: {
            label: '¿Cuán religioso/a te considerás?',
            minLabel: 'Nada',
            maxLabel: 'Muy',
            dataKey: 'religiosity',
            tooltip: true,
          },
        },
        {
          componentFamily: 'response',
          template: 'radio',
          props: {
            label: '¿Con qué frecuencia orás?',
            dataKey: 'prayer-frequency',
            options: '%frequency',
          },
        },
        {
          componentFamily: 'response',
          template: 'slider',
          props: {
            label: '¿Cómo cambió esa frecuencia con la cuarentena?',
            minLabel: 'Disminuyó mucho',
            maxLabel: 'Aumentó mucho',
            dataKey: 'prayer-frequency-change',
            tooltip: true,
          },
        },
        {
          componentFamily: 'response',
          template: 'radio',
          props: {
            label: '¿Con qué frecuencia meditás?',
            dataKey: 'meditation-frequency',
            options: '%frequency',
          },
        },
        {
          componentFamily: 'response',
          template: 'slider',
          props: {
            label: '¿Cómo cambió esa frecuencia con la cuarentena?',
            minLabel: 'Disminuyó mucho',
            maxLabel: 'Aumentó mucho',
            dataKey: 'meditation-frequency-change',
          },
        },
        {
          componentFamily: 'response',
          template: 'radio',
          props: {
            label:
              '¿Recibiste previamente asistencia psicológica o psiquiátrica?',
            dataKey: 'received-mental-health-assistance',
            options: '%yes-no',
          },
        },
        {
          componentFamily: 'response',
          template: 'radio',
          props: {
            label:
              '¿Estuviste internada/o problemas psicológicos o psiquiátricos?',
            dataKey: 'hospitalized-for-mental-health',
            options: '%yes-no',
          },
        },
        {
          componentFamily: 'response',
          template: 'radio',
          props: {
            label: '¿Tomás actualmente alguna medicación psiquiátrica?',
            dataKey: 'currently-taking-psychiatric-medication',
            options: '%yes-no',
          },
        },
        {
          componentFamily: 'layout',
          template: 'button',
          props: {
            text: 'Continuar',
            alignBottom: true,
          },
        },
      ],
    },
    {
      slug: 'psychedelics-options',
      components: [
        {
          componentFamily: 'content',
          template: 'rich-text',
          props: {
            content:
              '## Marcá si consumiste alguna vez alguno de los siguientes psicodelicos:',
          },
        },
        {
          componentFamily: 'response',
          template: 'checkboxes',
          props: {
            label: '',
            dataKey: 'psychedelic-substances',
            randomize: true,
            options: [
              { label: 'Hongos', value: 'mushrooms' },
              { label: 'LSD o análogo', value: 'lsd' },
              { label: 'Ayahuasca', value: 'ayahuasca' },
              { label: 'DMT', value: 'dmt' },
              { label: '5-MeO-DMT', value: '5-meo-dmt' },
              { label: 'Iboga/ibogaina', value: 'ibogaine' },
              { label: 'San Pedro', value: 'san-pedro' },
              { label: 'Bufo alvarius', value: 'bufo-alvarius' },
            ],
            required: false,
          },
        },
        {
          componentFamily: 'control',
          template: 'conditional',
          props: {
            if: {
              type: 'simple',
              dataKey: '$psychedelic-substances',
              operator: 'length-gt',
              value: 0,
            },
            component: {
              componentFamily: 'layout',
              template: 'button',
              props: {
                text: 'Continuar',
                alignBottom: true,
              },
            },
            else: {
              componentFamily: 'layout',
              template: 'button',
              props: {
                text: 'No consumí',
                alignBottom: true,
              },
            },
          },
        },
      ],
    },
    {
      slug: 'psychedelics-general',
      components: [
        {
          componentFamily: 'content',
          template: 'rich-text',
          props: {
            content: '## Sobre esos psicodélicos:',
          },
        },
        {
          componentFamily: 'response',
          template: 'numeric-input',
          props: {
            label:
              '¿Cuántas veces consumiste una dosis con efectos perceptibles (media o alta) de psicodélicos en toda tu vida? Si no lo recordás, con una respuesta aproximada alcanza.',
            dataKey: 'psychedelic-lifetime-use',
          },
        },
        {
          componentFamily: 'response',
          template: 'slider',
          props: {
            label:
              '¿Cómo calificarías tu experiencia promedio con los psicodélicos?',
            minLabel: 'Muy mala',
            maxLabel: 'Excelente',
            dataKey: 'psychedelic-average-experience',
          },
        },
        {
          componentFamily: 'response',
          template: 'radio',
          props: {
            label:
              '¿Realizás o realizaste un prorama sostenido de microdosificación de psicodélicos?',
            dataKey: 'psychedelic-microdosing',
            options: '%yes-no',
          },
        },
        {
          componentFamily: 'response',
          template: 'slider',
          props: {
            label:
              'Desde el comienzo de la cuarentena, tu consumo de sutancia psicodélicas...',
            minLabel: 'Disminuyó mucho',
            maxLabel: 'Aumentó mucho',
            dataKey: 'psychedelic-use-change',
          },
        },
        {
          componentFamily: 'control',
          template: 'conditional',
          props: {
            if: {
              type: 'simple',
              dataKey: '$psychedelic-use-change',
              operator: 'lte',
              value: 45,
            },
            component: {
              componentFamily: 'response',
              template: 'single-checkbox',
              props: {
                label:
                  'Mi consumo disminuyó por factores externos. (Ej. no tengo, me queda poco, vivo con otra gente, etc.)',
                dataKey: 'psychedelic-use-decrease-external',
                defaultValue: false,
                required: false,
              },
            },
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
      slug: 'psychedelics-most-impactful',
      components: [
        {
          componentFamily: 'content',
          template: 'rich-text',
          props: {
            content:
              'De los siguientes psicodélicos, ¿cuál fue más significativo en tu vida?',
          },
        },
        {
          componentFamily: 'response',
          template: 'radio',
          props: {
            label: '',
            options: '$$psychedelics-options.psychedelic-substances',
            dataKey: 'psychedelic-most-impactful',
            required: true,
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
      slug: 'psychedelics-last-time',
      components: [
        {
          componentFamily: 'content',
          template: 'rich-text',
          props: {
            content:
              '## ¿Cuándo fue la última vez que consumiste una dosis con efectos perceptibles de un psicodélico?',
          },
        },
        {
          componentFamily: 'response',
          template: 'radio',
          props: {
            label: '',
            dataKey: 'psychedelic-last-time',
            options: [
              { label: 'Hace menos de una semana', value: 'less-than-week' },
              { label: 'Este mes', value: 'this-month' },
              { label: 'El mes pasado', value: 'last-month' },
              {
                label: 'En algún momento en los últimos seis meses',
                value: 'last-six-months',
              },
              { label: 'El año pasado', value: 'last-year' },
              { label: 'Hace dos años', value: 'two-years-ago' },
              { label: 'Hace más de dos años', value: 'more-than-two-years' },
              {
                label: 'Hace más de cinco años',
                value: 'more-than-five-years',
              },
              { label: 'Hace más de diez años', value: 'more-than-ten-years' },
            ],
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
      slug: 'psychedelics-motives',
      components: [
        {
          componentFamily: 'content',
          template: 'rich-text',
          props: {
            content:
              '## ¿Por cuáles de estos motivos consumiste psicodélicos alguna vez?',
          },
        },
        {
          componentFamily: 'response',
          template: 'checkboxes',
          props: {
            label: '',
            randomize: true,
            dataKey: 'psychedelic-use-motives',
            options: [
              {
                label: 'Exploración o curiosidad acerca del psicodélico',
                value: 'exploration',
              },
              { label: 'Diversión con amigos', value: 'fun-with-friends' },
              { label: 'Diversión solo', value: 'fun-alone' },
              {
                label: 'Para salir de la rutina diaria',
                value: 'break-routine',
              },
              {
                label: 'Búsqueda de crecimiento y desarrollo personal',
                value: 'personal-growth',
              },
              {
                label: 'Como una práctica religiosa o espiritual',
                value: 'religious-spiritual',
              },
              {
                label: 'Como medicación con finalidad terapéutica',
                value: 'therapeutic-medication',
              },
            ],
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
      slug: 'psychoactive-options',
      components: [
        {
          componentFamily: 'content',
          template: 'rich-text',
          props: {
            content:
              '## ¿Consumís o consumiste alguna de las siguientes sustancias psicoactivas?',
          },
        },
        {
          componentFamily: 'response',
          template: 'checkboxes',
          props: {
            label: '',
            dataKey: 'psychoactive-substances',
            options: [
              { label: 'Marihuana', value: 'marijuana' },
              {
                label: 'Estimulantes (modafinilo, cocaína, anfetaminas)',
                value: 'stimulants',
              },
              {
                label: 'Sedativos (hipnóticos, opióides, benzodiacepinas)',
                value: 'sedatives',
              },
              {
                label: 'Disociativos (ketamina, salvia divinorum)',
                value: 'dissociatives',
              },
              { label: 'Alcohol', value: 'alcohol' },
              { label: 'MDMD / éxtasis', value: 'mdma' },
              { label: 'Otro', value: 'otro' },
            ],
            required: false,
          },
        },
        {
          componentFamily: 'layout',
          template: 'button',
          props: {
            text: 'Continuar',
            alignBottom: true,
          },
        },
      ],
    },
    {
      slug: 'psychoactive-quarantine-change',
      components: [
        {
          componentFamily: 'content',
          template: 'rich-text',
          props: {
            content: '### ¿Cómo cambió tu consumo con la cuarentena?',
          },
        },
        {
          componentFamily: 'control',
          template: 'for-each',
          props: {
            id: 'for-each-psychoactive-substance',
            type: 'dynamic',
            dataKey: '$$psychoactive-options.psychoactive-substances',
            component: {
              componentFamily: 'layout',
              template: 'group',
              props: {
                name: 'psychoactive-substance-change-{{#for-each-psychoactive-substance.value}}',
                components: [
                  {
                    componentFamily: 'response',
                    template: 'slider',
                    props: {
                      label: '{{#for-each-psychoactive-substance.value}}',
                      minLabel: 'Disminuyó mucho',
                      maxLabel: 'Aumentó mucho',
                      dataKey:
                        'psychoactive-change-{{#for-each-psychoactive-substance.value}}',
                    },
                  },
                  {
                    componentFamily: 'control',
                    template: 'conditional',
                    props: {
                      if: {
                        type: 'simple',
                        dataKey:
                          '$psychoactive-change-{{#for-each-psychoactive-substance.value}}',
                        operator: 'lte',
                        value: 45,
                      },
                      component: {
                        componentFamily: 'response',
                        template: 'single-checkbox',
                        props: {
                          label:
                            'Mi consumo de {{#for-each-psychoactive-substance.value}} disminuyó por factores externos. (Ej. no tengo, me queda poco, vivo con otra gente, etc.)',
                          dataKey:
                            'psychoactive-{{#for-each-psychoactive-substance.value}}-decrease-external',
                          defaultValue: true,
                          required: false,
                        },
                      },
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
            text: 'Continuar',
            alignBottom: true,
          },
        },
      ],
    },
    {
      slug: 'thanks',
      components: [
        {
          componentFamily: 'content',
          template: 'rich-text',
          props: {
            content: '# ¡Gracias por participar!',
          },
        },
      ],
    },
  ],
};

export const EXPERIMENTS: Record<string, ExperimentFlow> = {
  experiment,
  'ejercicio-1': {
    nodes: [
      { id: 'start', type: 'start' },
      { id: 'screen-intro', type: 'screen', props: { slug: 'intro' } },
      {
        id: 'path-questions',
        type: 'path',
        props: {
          name: 'questions',
          description: 'Path with the questions screens',
          stepper: {
            label: '{index} / {total}',
            style: 'dashed',
          },
        },
      },

      {
        id: 'screen-energy-sleep-mood',
        type: 'screen',
        props: { slug: 'energy-sleep-mood' },
      },
      {
        id: 'screen-mind-stress-body',
        type: 'screen',
        props: { slug: 'mind-stress-body' },
      },

      {
        id: 'screen-thanks',
        type: 'screen',
        props: { slug: 'thanks' },
      },
    ],
    edges: [
      { type: 'sequential', from: 'start', to: 'screen-intro' },
      { type: 'sequential', from: 'screen-intro', to: 'path-questions' },
      {
        type: 'path-contains',
        from: 'path-questions',
        to: 'screen-energy-sleep-mood',
        order: 0,
      },
      {
        type: 'path-contains',
        from: 'path-questions',
        to: 'screen-mind-stress-body',
        order: 1,
      },
      {
        type: 'sequential',
        from: 'path-questions',
        to: 'screen-thanks',
      },
    ],
    options: {},
    screens: [
      {
        slug: 'intro',
        components: [
          {
            componentFamily: 'content',
            template: 'rich-text',
            props: {
              content: '# Mi estado actual, en palabras',
            },
          },
          {
            componentFamily: 'content',
            template: 'rich-text',
            props: {
              content:
                '### Qué busca \n Empezar este cuadernillo mirando de frente cómo estás hoy.',
            },
          },
          {
            componentFamily: 'content',
            template: 'rich-text',
            props: {
              content:
                '### Por qué puede servir \n A veces sentimos que estamos mal, bien o más o menos, pero no nos detenemos a mirar qué significa eso en concreto. Este ejercicio propone una primera foto del estado actual del cuerpo y de la vida cotidiana. No para etiquetarte ni para juzgarte, sino para volver más visible cómo te estás sintiendo y desde dónde arrancás.',
            },
          },
          {
            componentFamily: 'content',
            template: 'rich-text',
            props: {
              content:
                '### Cómo hacerlo \n Leé cada frase y tildá las opciones que más se parezcan a cómo estás hoy. Podés marcar más de una. Si ninguna te representa del todo, completá "otro" con tus propias palabras. La idea es responder con honestidad, sin pensar demasiado y sin buscar la opción perfecta. ',
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
        slug: 'energy-sleep-mood',
        components: [
          {
            componentFamily: 'content',
            template: 'rich-text',
            props: {
              content: '## Energía, sueño y estado de ánimo',
            },
          },
          {
            componentFamily: 'layout',
            template: 'group',
            props: {
              name: 'energy',
              components: [
                {
                  componentFamily: 'response',
                  template: 'checkboxes',
                  props: {
                    label: 'Mi __energía__ últimamente se parece más a ...',
                    dataKey: 'energy',
                    options: [
                      {
                        label: 'Una batería bastante cargada',
                        value: 'charged-battery',
                      },
                      {
                        label:
                          'Una batería que arranca bien pero se cae rápido',
                        value: 'battery-drops-quickly',
                      },
                      {
                        label: 'Una batería baja casi todo el tiempo',
                        value: 'low-battery',
                      },
                      {
                        label: 'Una batería impredecible',
                        value: 'unpredictable-battery',
                      },
                      {
                        label: 'Un cuerpo cansado pero pasado de vueltas',
                        value: 'tired-overwhelmed-body',
                      },
                      { label: 'Un cuerpo apagado', value: 'turned-off-body' },
                      { label: 'Otro', value: 'other' },
                    ],
                  },
                },
                {
                  componentFamily: 'control',
                  template: 'conditional',
                  props: {
                    if: {
                      type: 'simple',
                      dataKey: '$energy',
                      operator: 'contains',
                      value: 'other',
                    },
                    component: {
                      componentFamily: 'response',
                      template: 'text-input',
                      props: {
                        label: '¿Cómo describirías tu energía?',
                        dataKey: 'energy-other',
                      },
                    },
                  },
                },
              ],
            },
          },

          {
            componentFamily: 'layout',
            template: 'group',
            props: {
              name: 'sleep',
              components: [
                {
                  componentFamily: 'response',
                  template: 'checkboxes',
                  props: {
                    label:
                      'Mi relación con el __sueño__ últimamente se parece más a…',
                    dataKey: 'sleep',
                    options: [
                      {
                        label: 'Me cuesta bajar y dormirme',
                        value: 'hard-to-fall-asleep',
                      },
                      {
                        label: 'Me duermo, pero me despierto',
                        value: 'wake-up-at-night',
                      },
                      {
                        label: 'Duermo muchas horas, pero descanso poco',
                        value: 'long-sleep-low-quality',
                      },
                      {
                        label: 'Me acuesto demasiado tarde',
                        value: 'go-to-bed-late',
                      },
                      {
                        label: 'Me cuesta sostener horarios',
                        value: 'irregular-sleep',
                      },
                      {
                        label: 'Siento que nunca termino de recuperarme',
                        value: 'never-rested',
                      },
                      {
                        label: 'Duermo razonablemente bien',
                        value: 'reasonably-good-sleep',
                      },
                      { label: 'Otro', value: 'other' },
                    ],
                  },
                },
                {
                  componentFamily: 'control',
                  template: 'conditional',
                  props: {
                    if: {
                      type: 'simple',
                      dataKey: '$sleep',
                      operator: 'contains',
                      value: 'other',
                    },
                    component: {
                      componentFamily: 'response',
                      template: 'text-input',
                      props: {
                        label: '¿Cómo describirías tu relación con el sueño?',
                        dataKey: 'sleep-other',
                      },
                    },
                  },
                },
              ],
            },
          },

          {
            componentFamily: 'layout',
            template: 'group',
            props: {
              name: 'mood',
              components: [
                {
                  componentFamily: 'response',
                  template: 'checkboxes',
                  props: {
                    label:
                      'Mi __estado de ánimo__ últimamente se parece más a…',
                    dataKey: 'mood',
                    options: [
                      { label: 'Estable', value: 'stable' },
                      { label: 'Sereno', value: 'serene' },
                      { label: 'Bueno', value: 'good' },
                      {
                        label: 'Expansivo, acelerado o eufórico',
                        value: 'expansive-accelerated-euphoric',
                      },
                      { label: 'Cambiante', value: 'changing' },
                      { label: 'Apagado', value: 'turned-off' },
                      { label: 'Triste', value: 'sad' },
                      {
                        label: 'Con poco interés o disfrute',
                        value: 'little-interest-enjoyment',
                      },
                      { label: 'Otro', value: 'other' },
                    ],
                  },
                },
                {
                  componentFamily: 'control',
                  template: 'conditional',
                  props: {
                    if: {
                      type: 'simple',
                      dataKey: '$mood',
                      operator: 'contains',
                      value: 'other',
                    },
                    component: {
                      componentFamily: 'response',
                      template: 'text-input',
                      props: {
                        label: '¿Cómo describirías tu estado de ánimo?',
                        dataKey: 'mood-other',
                      },
                    },
                  },
                },
              ],
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
        slug: 'mind-stress-body',
        components: [
          {
            componentFamily: 'content',
            template: 'rich-text',
            props: {
              content: '## Mente, estrés y cuerpo',
            },
          },
          {
            componentFamily: 'layout',
            template: 'group',
            props: {
              name: 'mind',
              components: [
                {
                  componentFamily: 'response',
                  template: 'checkboxes',
                  props: {
                    label: 'Mi __mente__ últimamente se parece más a…',
                    dataKey: 'mind',
                    options: [
                      { label: 'Clara y enfocada', value: 'clear-focused' },
                      { label: 'Dispersa', value: 'scattered' },
                      { label: 'Acelerada', value: 'accelerated' },
                      { label: 'Nublada', value: 'cloudy' },
                      { label: 'Rumiativa', value: 'ruminative' },
                      { label: 'Lenta o apagada', value: 'slow-turned-off' },
                      { label: 'Bastante ordenada', value: 'quite-ordered' },
                      { label: 'Otro', value: 'other' },
                    ],
                  },
                },
                {
                  componentFamily: 'control',
                  template: 'conditional',
                  props: {
                    if: {
                      type: 'simple',
                      dataKey: '$mind',
                      operator: 'contains',
                      value: 'other',
                    },
                    component: {
                      componentFamily: 'response',
                      template: 'text-input',
                      props: {
                        label: '¿Cómo describirías tu mente?',
                        dataKey: 'mind-other',
                      },
                    },
                  },
                },
              ],
            },
          },
          {
            componentFamily: 'layout',
            template: 'group',
            props: {
              name: 'stress',
              components: [
                {
                  componentFamily: 'response',
                  template: 'checkboxes',
                  props: {
                    label: 'Mi __estrés__ últimamente se expresa como…',
                    dataKey: 'stress',
                    options: [
                      { label: 'Rumiación', value: 'rumination' },
                      {
                        label: 'Taquicardia o aceleración',
                        value: 'tachycardia',
                      },
                      { label: 'Irritabilidad', value: 'irritability' },
                      { label: 'Contracturas', value: 'contractures' },
                      {
                        label: 'Digestión errática',
                        value: 'erratic-digestion',
                      },
                      { label: 'Agotamiento', value: 'exhaustion' },
                      { label: 'Insomnio', value: 'insomnia' },
                      { label: 'Sensación de desborde', value: 'overwhelmed' },
                      { label: 'Bloqueo', value: 'blockage' },
                      { label: 'Otro', value: 'other' },
                    ],
                  },
                },
                {
                  componentFamily: 'control',
                  template: 'conditional',
                  props: {
                    if: {
                      type: 'simple',
                      dataKey: '$stress',
                      operator: 'contains',
                      value: 'other',
                    },
                    component: {
                      componentFamily: 'response',
                      template: 'text-input',
                      props: {
                        label: '¿Cómo describirías tu estrés?',
                        dataKey: 'stress-other',
                      },
                    },
                  },
                },
              ],
            },
          },
          {
            componentFamily: 'layout',
            template: 'group',
            props: {
              name: 'body',
              components: [
                {
                  componentFamily: 'response',
                  template: 'checkboxes',
                  props: {
                    label: 'Mi __cuerpo__ últimamente se siente más como…',
                    dataKey: 'body',
                    options: [
                      { label: 'Relajado', value: 'relaxed' },
                      { label: 'Tenso', value: 'tense' },
                      { label: 'Inflamado', value: 'inflamed' },
                      { label: 'Pesado', value: 'heavy' },
                      { label: 'Cansado', value: 'tired' },
                      { label: 'Acelerado', value: 'overwhelmed' },
                      { label: 'Desconectado', value: 'disconnected' },
                      { label: 'Fuerte', value: 'strong' },
                      { label: 'Liviano', value: 'light' },
                      { label: 'Frágil', value: 'fragile' },
                      { label: 'Rígido', value: 'rigid' },
                      { label: 'Otro', value: 'other' },
                    ],
                  },
                },
                {
                  componentFamily: 'control',
                  template: 'conditional',
                  props: {
                    if: {
                      type: 'simple',
                      dataKey: '$body',
                      operator: 'contains',
                      value: 'other',
                    },
                    component: {
                      componentFamily: 'response',
                      template: 'text-input',
                      props: {
                        label: '¿Cómo describirías tu cuerpo?',
                        dataKey: 'body-other',
                      },
                    },
                  },
                },
              ],
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

      //
      {
        slug: 'thanks',
        components: [
          {
            componentFamily: 'content',
            template: 'rich-text',
            props: {
              content: '# ¡Gracias por participar!',
            },
          },
        ],
      },
    ],
  },
};
