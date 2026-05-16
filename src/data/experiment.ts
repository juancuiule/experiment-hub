import { ExperimentFlow } from '@/lib/types';

export const experiment: ExperimentFlow = {
  nodes: [
    { id: 'start', type: 'start' },
    { id: 'screen-terms', type: 'screen', props: { slug: 'terms' } },
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
          {
            id: 'unrouted-branch',
            name: 'unrouted-branch',
            config: {
              type: 'simple',
              dataKey: '$$psychedelics-options.nonexistent-key',
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

    // {
    //   id: 'screen-psychedelics-general',
    //   type: 'screen',
    //   props: { slug: 'psychedelics-general' },
    // },
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
      id: 'start-google',
      type: 'start',
      props: {
        name: 'Google',
        param: {
          key: 'source',
          value: 'google',
        },
      },
    },

    // condition-empty-and + condition-empty-or
    {
      id: 'branch-empty-conditions',
      type: 'branch',
      props: {
        name: 'empty-conditions-test',
        branches: [
          {
            id: 'empty-and',
            name: 'empty-and',
            config: { type: 'and', conditions: [] },
          },
          {
            id: 'empty-or',
            name: 'empty-or',
            config: { type: 'or', conditions: [] },
          },
        ],
      },
    },

    // missing-edge: fork arms have no fork-edge
    {
      id: 'fork-no-edges',
      type: 'fork',
      props: {
        name: 'fork-no-edges',
        forks: [
          { id: 'arm-1', name: 'arm-1' },
          { id: 'arm-2', name: 'arm-2' },
        ],
      },
    },

    // missing-edge: loop has no loop-template edge
    {
      id: 'loop-no-template',
      type: 'loop',
      props: { type: 'static', values: ['a', 'b'] },
    },

    // missing-edge: path has no path-contains + no sequential exit
    {
      id: 'path-empty',
      type: 'path',
      props: { name: 'empty-path' },
    },

    // ambiguous-edge: path with 2 sequential exits
    {
      id: 'path-ambiguous',
      type: 'path',
      props: { name: 'ambiguous-exit-path' },
    },

    // duplicate-edge: loop with 2 loop-template edges
    {
      id: 'loop-dual-template',
      type: 'loop',
      props: { type: 'static', values: ['x', 'y'] },
    },

    // invalid-reference + unavailable-reference (via screen content)
    {
      id: 'screen-bad-refs',
      type: 'screen',
      props: { slug: 'bad-refs' },
    },
  ],
  edges: [
    { type: 'sequential', from: 'start', to: 'screen-terms' },
    { type: 'sequential', from: 'screen-terms', to: 'screen-first-questions' },

    // unknown-node: both source and target are nonexistent nodes
    { type: 'sequential', from: 'ghost-source', to: 'ghost-target' },

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
      from: 'checkpoint-first-questions',
      to: 'path-psychedelics',
    },

    {
      type: 'sequential',
      from: 'screen-psychedelics-options',
      to: 'branch-psychedelics',
    },
    // {
    //   type: 'branch-condition',
    //   from: 'branch-psychedelics.consumed-psychedelics',
    //   to: 'path-psychedelics',
    // },

    {
      type: 'path-contains',
      from: 'path-psychedelics',
      to: 'screen-psychedelics-general',
      order: 0,
    },
    {
      type: 'path-contains',
      from: 'path-psychedelics',
      to: 'screen-psychedelics-most-impactful',
      order: 1,
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

    // {
    //   type: 'branch-default',
    //   from: 'branch-psychedelics',
    //   to: 'screen-psychoactive-options',
    // },
    {
      type: 'sequential',
      from: 'path-psychedelics',
      to: 'screen-psychoactive-options',
    },

    // invalid-reference + unavailable-reference (screen-bad-refs inside non-loop path)
    {
      type: 'path-contains',
      from: 'path-psychedelics',
      to: 'screen-bad-refs',
      order: 4,
    },

    // invalid-edge: branch-condition references non-existent branch id on a branch node
    {
      type: 'branch-condition',
      from: 'branch-psychedelics.nonexistent-branch',
      to: 'screen-terms',
    },

    // invalid-edge: fork-edge references non-existent arm id on a fork node
    {
      type: 'fork-edge',
      from: 'fork-no-edges.nonexistent-arm',
      to: 'screen-terms',
    },

    // invalid-edge: path-contains edge sourced from a non-path node
    { type: 'path-contains', from: 'start', to: 'screen-terms', order: 0 },

    // invalid-edge: loop-template edge sourced from a non-loop node
    { type: 'loop-template', from: 'start', to: 'screen-terms' },

    // ambiguous-edge: path with 2 sequential exits
    {
      type: 'path-contains',
      from: 'path-ambiguous',
      to: 'screen-terms',
      order: 0,
    },
    { type: 'sequential', from: 'path-ambiguous', to: 'screen-terms' },
    {
      type: 'sequential',
      from: 'path-ambiguous',
      to: 'screen-first-questions',
    },

    // duplicate-edge: loop with 2 loop-template edges
    { type: 'loop-template', from: 'loop-dual-template', to: 'screen-terms' },
    {
      type: 'loop-template',
      from: 'loop-dual-template',
      to: 'screen-first-questions',
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
            content: '# Pandemica, conciencias y sustancias',
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
          },
        },
        {
          componentFamily: 'response',
          template: 'radio',
          props: {
            label: '¿Con qué frecuencia orás?',
            dataKey: 'prayer-frequency',
            options: [
              { label: 'Todos los días', value: 'daily' },
              { label: 'Una o varias veces a la semana', value: 'weekly' },
              { label: 'Una o varias veces al mes', value: 'monthly' },
              { label: 'Muy esporádicamente', value: 'sporadically' },
              { label: 'Nunca', value: 'never' },
            ],
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
          },
        },
        {
          componentFamily: 'response',
          template: 'radio',
          props: {
            label: '¿Con qué frecuencia meditás?',
            dataKey: 'meditation-frequency',
            options: [
              { label: 'Todos los días', value: 'daily' },
              { label: 'Una o varias veces a la semana', value: 'weekly' },
              { label: 'Una o varias veces al mes', value: 'monthly' },
              { label: 'Muy esporádicamente', value: 'sporadically' },
              { label: 'Nunca', value: 'never' },
            ],
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
            options: [
              { label: 'Sí', value: 'yes' },
              { label: 'No', value: 'no' },
            ],
          },
        },
        {
          componentFamily: 'response',
          template: 'radio',
          props: {
            label:
              '¿Estuviste internada/o problemas psicológicos o psiquiátricos?',
            dataKey: 'hospitalized-for-mental-health',
            options: [
              { label: 'Sí', value: 'yes' },
              { label: 'No', value: 'no' },
            ],
          },
        },
        {
          componentFamily: 'response',
          template: 'radio',
          props: {
            label: '¿Tomás actualmente alguna medicación psiquiátrica?',
            dataKey: 'currently-taking-psychiatric-medication',
            options: [
              { label: 'Sí', value: 'yes' },
              { label: 'No', value: 'no' },
            ],
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
    // {
    //   slug: 'psychedelics-options',
    //   components: [
    //     {
    //       componentFamily: 'content',
    //       template: 'rich-text',
    //       props: {
    //         content:
    //           '## Marcá si consumiste alguna vez alguno de los siguientes psicodelicos:',
    //       },
    //     },
    //     {
    //       componentFamily: 'response',
    //       template: 'checkboxes',
    //       props: {
    //         label: '',
    //         dataKey: 'psychedelic-substances',
    //         options: [
    //           { label: 'Hongos', value: 'mushrooms' },
    //           { label: 'LSD o análogo', value: 'lsd' },
    //           { label: 'Ayahuasca', value: 'ayahuasca' },
    //           { label: 'DMT', value: 'dmt' },
    //           { label: '5-MeO-DMT', value: '5-meo-dmt' },
    //           { label: 'Iboga/ibogaina', value: 'ibogaine' },
    //           { label: 'San Pedro', value: 'san-pedro' },
    //           { label: 'Bufo alvarius', value: 'bufo-alvarius' },
    //         ],
    //         required: false,
    //       },
    //     },
    //     {
    //       componentFamily: 'control',
    //       template: 'conditional',
    //       props: {
    //         if: {
    //           type: 'simple',
    //           dataKey: '$psychedelic-substances',
    //           operator: 'length-gt',
    //           value: 0,
    //         },
    //         component: {
    //           componentFamily: 'layout',
    //           template: 'button',
    //           props: {
    //             text: 'Continuar',
    //             alignBottom: true,
    //           },
    //         },
    //         else: {
    //           componentFamily: 'layout',
    //           template: 'button',
    //           props: {
    //             text: 'No consumí',
    //             alignBottom: true,
    //           },
    //         },
    //       },
    //     },
    //   ],
    // },
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
            options: [
              { label: 'Sí', value: 'yes' },
              { label: 'No', value: 'no' },
            ],
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
    // duplicate-screen: second definition with slug 'terms'
    { slug: 'terms', components: [] },

    // invalid-reference (@-token outside a loop) + unavailable-reference ($$-token not yet in available set)
    {
      slug: 'bad-refs',
      components: [
        {
          componentFamily: 'content',
          template: 'rich-text',
          props: {
            content:
              'Loop value: @loop-test.value and missing: $$nonexistent-screen.data',
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
  ],
};

export const _experiment: ExperimentFlow = {
  nodes: [
    { id: 'start', type: 'start' },
    { id: 'screen-family', type: 'screen', props: { slug: 'family' } },
    { id: 'screen-welcome', type: 'screen', props: { slug: 'welcome' } },
    {
      id: 'loop-test',
      type: 'loop',
      props: {
        type: 'static',
        values: ['apple', 'banana', 'kiwi'],
      },
    },
    {
      id: 'inner-loop',
      type: 'loop',
      props: {
        type: 'static',
        values: ['big', 'medium', 'small'],
      },
    },
  ],
  edges: [
    { type: 'sequential', from: 'start', to: 'screen-family' },
    { type: 'sequential', from: 'screen-family', to: 'loop-test' },
    { type: 'loop-template', from: 'loop-test', to: 'inner-loop' },
    { type: 'loop-template', from: 'inner-loop', to: 'screen-welcome' },
  ],
  screens: [
    {
      slug: 'family',
      components: [
        {
          componentFamily: 'content',
          template: 'rich-text',
          props: { content: '## General questions about your family' },
        },
        {
          componentFamily: 'response',
          template: 'radio',
          props: {
            label: 'Do you have children?',
            dataKey: 'has-children',
            options: [
              { label: 'Yes', value: 'yes' },
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
              dataKey: '$has-children',
              operator: 'eq',
              value: 'yes',
            },
            component: {
              componentFamily: 'response',
              template: 'numeric-input',
              props: {
                label: 'How many children do you have?',
                dataKey: 'number-of-children',
              },
            },
          },
        },
        {
          componentFamily: 'control',
          template: 'conditional',
          props: {
            if: {
              type: 'simple',
              dataKey: '$has-children',
              operator: 'eq',
              value: 'no',
            },
            component: {
              componentFamily: 'response',
              template: 'radio',
              props: {
                label: 'Would you like to have children in the future?',
                dataKey: 'wants-children',
                options: [
                  { label: 'Yes', value: 'yes' },
                  { label: 'No', value: 'no' },
                ],
              },
            },
          },
        },
        {
          componentFamily: 'control',
          template: 'conditional',
          props: {
            if: {
              type: 'simple',
              dataKey: '$wants-children',
              operator: 'eq',
              value: 'yes',
            },
            component: {
              componentFamily: 'response',
              template: 'numeric-input',
              props: {
                label: 'How many children would you like to have?',
                dataKey: 'desired-number-of-children',
              },
            },
          },
        },
        {
          componentFamily: 'layout',
          template: 'button',
          props: {
            text: 'Continue',
            alignBottom: true,
          },
        },
      ],
    },
    {
      slug: 'welcome',
      components: [
        {
          componentFamily: 'content',
          template: 'image',
          props: {
            url: '/fruits/{{@loop-test.value}}.png',
            alt: '{{@loop-test.value}} image',
            className: 'w-16 mx-auto',
          },
        },
        {
          componentFamily: 'content',
          template: 'rich-text',
          props: {
            content:
              '## Welcome ({{@inner-loop.value}} {{@loop-test.value}}) \n Lorem ipsum  dolor sit amet, consectetur adipiscing elit. Proin quis elit lacus. Pellentesque auctor pharetra enim in commodo. Etiam tincidunt maximus ante, a varius eros posuere eget. Vestibulum sed ultricies urna. Duis suscipit interdum eros, et semper ante. Pellentesque sed elementum justo.',
          },
        },
        {
          componentFamily: 'response',
          template: 'checkboxes',
          props: {
            label: 'Select **your** `favorite` {{@loop-test.value}} varieties',
            dataKey: 'favorite-varieties',
            randomize: true,
            options: [
              { label: 'Variety 1', value: 'variety-1' },
              { label: 'Variety 2', value: 'variety-2' },
              { label: 'Variety 3', value: 'variety-3' },
            ],
          },
        },
        {
          componentFamily: 'control',
          template: 'for-each',
          props: {
            id: 'for-each-favorite-variety',
            type: 'dynamic',
            dataKey: '$favorite-varieties',
            component: {
              componentFamily: 'layout',
              template: 'group',
              props: {
                name: 'favorite-variety-{{#for-each-favorite-variety.index}}',
                components: [
                  {
                    componentFamily: 'content',
                    template: 'rich-text',
                    props: {
                      content:
                        '- You selected **{{#for-each-favorite-variety.value}}** as one of your favorite {{@loop-test.value}} varieties',
                    },
                  },
                  {
                    componentFamily: 'response',
                    template: 'radio',
                    props: {
                      label:
                        'Would you recommend {{#for-each-favorite-variety.value}} to a friend?',
                      dataKey: 'recommend-{{#for-each-favorite-variety.value}}',
                      options: [
                        { label: 'Yes', value: 'yes' },
                        { label: 'No', value: 'no' },
                      ],
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
            text: 'Continue',
            alignBottom: true,
          },
        },
      ],
    },
  ],
};

export const cocuco: ExperimentFlow = {
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
      to: 'screen-psychedelics-most-impactful',
      order: 1,
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
  ],
  screens: [
    {
      slug: 'terms',
      components: [
        {
          componentFamily: 'content',
          template: 'rich-text',
          props: {
            content: '# Pandemica, conciencias y sustancias',
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
          },
        },
        {
          componentFamily: 'response',
          template: 'radio',
          props: {
            label: '¿Con qué frecuencia orás?',
            dataKey: 'prayer-frequency',
            options: [
              { label: 'Todos los días', value: 'daily' },
              { label: 'Una o varias veces a la semana', value: 'weekly' },
              { label: 'Una o varias veces al mes', value: 'monthly' },
              { label: 'Muy esporádicamente', value: 'sporadically' },
              { label: 'Nunca', value: 'never' },
            ],
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
          },
        },
        {
          componentFamily: 'response',
          template: 'radio',
          props: {
            label: '¿Con qué frecuencia meditás?',
            dataKey: 'meditation-frequency',
            options: [
              { label: 'Todos los días', value: 'daily' },
              { label: 'Una o varias veces a la semana', value: 'weekly' },
              { label: 'Una o varias veces al mes', value: 'monthly' },
              { label: 'Muy esporádicamente', value: 'sporadically' },
              { label: 'Nunca', value: 'never' },
            ],
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
            options: [
              { label: 'Sí', value: 'yes' },
              { label: 'No', value: 'no' },
            ],
          },
        },
        {
          componentFamily: 'response',
          template: 'radio',
          props: {
            label:
              '¿Estuviste internada/o problemas psicológicos o psiquiátricos?',
            dataKey: 'hospitalized-for-mental-health',
            options: [
              { label: 'Sí', value: 'yes' },
              { label: 'No', value: 'no' },
            ],
          },
        },
        {
          componentFamily: 'response',
          template: 'radio',
          props: {
            label: '¿Tomás actualmente alguna medicación psiquiátrica?',
            dataKey: 'currently-taking-psychiatric-medication',
            options: [
              { label: 'Sí', value: 'yes' },
              { label: 'No', value: 'no' },
            ],
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
            options: [
              { label: 'Sí', value: 'yes' },
              { label: 'No', value: 'no' },
            ],
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
  ],
};
