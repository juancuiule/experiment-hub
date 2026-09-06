import { ExperimentFlow } from '@experiment-hub/engine/types';

const pandemic: ExperimentFlow = {
  dictionary: {
    es: {
      frequency: {
        daily: 'Todos los días',
        weekly: 'Una o varias veces a la semana',
        monthly: 'Una o varias veces al mes',
        sporadically: 'Muy esporádicamente',
        never: 'Nunca',
      },
      'yes-no': {
        yes: 'Sí',
        no: 'No',
      },
      'psychedelics-substances': {
        mushrooms: 'Hongos',
        lsd: 'LSD o análogo',
        ayahuasca: 'Ayahuasca',
        dmt: 'DMT',
        '5-meo-dmt': '5-MeO-DMT',
        ibogaine: 'Iboga/ibogaina',
        'san-pedro': 'San Pedro',
        'bufo-alvarius': 'Bufo alvarius',
      },
      'psychoactive-substances': {
        marijuana: 'Marihuana',
        stimulants: 'Estimulantes (modafinilo, cocaína, anfetaminas)',
        sedatives: 'Sedativos (hipnóticos, opióides, benzodiacepinas)',
        dissociatives: 'Disociativos (ketamina, salvia divinorum)',
        alcohol: 'Alcohol',
        mdma: 'MDMA / éxtasis',
        otro: 'Otro',
      },
    },
  },
  defaultLocale: 'es',
  options: {
    frequency: [
      { label: '[[frequency.daily]]', value: 'daily' },
      { label: '[[frequency.weekly]]', value: 'weekly' },
      { label: '[[frequency.monthly]]', value: 'monthly' },
      { label: '[[frequency.sporadically]]', value: 'sporadically' },
      { label: '[[frequency.never]]', value: 'never' },
    ],
    'yes-no': [
      { label: '[[yes-no.yes]]', value: 'yes' },
      { label: '[[yes-no.no]]', value: 'no' },
    ],
    'psychedelics-substances': [
      { label: '[[psychedelics-substances.mushrooms]]', value: 'mushrooms' },
      { label: '[[psychedelics-substances.lsd]]', value: 'lsd' },
      { label: '[[psychedelics-substances.ayahuasca]]', value: 'ayahuasca' },
      { label: '[[psychedelics-substances.dmt]]', value: 'dmt' },
      { label: '[[psychedelics-substances.5-meo-dmt]]', value: '5-meo-dmt' },
      { label: '[[psychedelics-substances.ibogaine]]', value: 'ibogaine' },
      { label: '[[psychedelics-substances.san-pedro]]', value: 'san-pedro' },
      {
        label: '[[psychedelics-substances.bufo-alvarius]]',
        value: 'bufo-alvarius',
      },
    ],
    'psychoactive-substances': [
      { label: '[[psychoactive-substances.marijuana]]', value: 'marijuana' },
      { label: '[[psychoactive-substances.stimulants]]', value: 'stimulants' },
      { label: '[[psychoactive-substances.sedatives]]', value: 'sedatives' },
      {
        label: '[[psychoactive-substances.dissociatives]]',
        value: 'dissociatives',
      },
      { label: '[[psychoactive-substances.alcohol]]', value: 'alcohol' },
      { label: '[[psychoactive-substances.mdma]]', value: 'mdma' },
      { label: '[[psychoactive-substances.otro]]', value: 'otro' },
    ],
    'stai-intensity-scale': [
      { label: 'Nada', value: 'nothing' },
      { label: 'Algo', value: 'something' },
      { label: 'Bastante', value: 'quite_a_bit' },
      { label: 'Mucho', value: 'very_much' },
    ],
    'stai-frequency-scale': [
      { label: 'Casi nunca', value: 'almost_never' },
      { label: 'A veces', value: 'sometimes' },
      { label: 'A menudo', value: 'often' },
      { label: 'Casi siempre', value: 'almost_always' },
    ],
    'panas-scale': [
      { label: 'Nada', value: 'nothing' },
      { label: '', value: 'a_little' }, // Un poco
      { label: 'Moderado', value: 'moderately' },
      { label: '', value: 'quite_a_bit' }, // Bastante
      { label: 'Mucho', value: 'extremely' },
    ],
    'agreement-scale': [
      { label: 'No estoy de acuerdo', value: 'disagree' },
      { label: 'Ni de acuerdo ni en desacuerdo', value: 'neutral' },
      { label: 'Estoy de acuerdo', value: 'agree' },
    ],
    'resilience-scale': [
      { label: 'No estoy de acuerdo', value: 'strongly_disagree' },
      { label: '', value: 'disagree' },
      { label: '', value: 'slightly_disagree' },
      { label: 'Ni de acuerdo ni en desacuerdo', value: 'neutral' },
      { label: '', value: 'slightly_agree' },
      { label: '', value: 'agree' },
      { label: 'Estoy de acuerdo', value: 'strongly_agree' },
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
      id: 'screen-stai-state',
      type: 'screen',
      props: { slug: 'stai-state' },
    },
    {
      id: 'screen-stai-trait',
      type: 'screen',
      props: { slug: 'stai-trait' },
    },
    {
      id: 'screen-panas',
      type: 'screen',
      props: { slug: 'panas' },
    },
    {
      id: 'screen-bieps',
      type: 'screen',
      props: { slug: 'bieps' },
    },
    {
      id: 'screen-cd-risc',
      type: 'screen',
      props: { slug: 'cd-risc' },
    },
    {
      id: 'screen-thanks',
      type: 'screen',
      props: { slug: 'thanks' },
    },
    { id: 'end', type: 'end' },
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
      to: 'screen-stai-state',
    },
    {
      type: 'sequential',
      from: 'screen-psychoactive-quarantine-change',
      to: 'screen-stai-state',
    },
    {
      type: 'sequential',
      from: 'screen-stai-state',
      to: 'screen-stai-trait',
    },
    {
      type: 'sequential',
      from: 'screen-stai-trait',
      to: 'screen-panas',
    },
    {
      type: 'sequential',
      from: 'screen-panas',
      to: 'screen-bieps',
    },
    {
      type: 'sequential',
      from: 'screen-bieps',
      to: 'screen-cd-risc',
    },
    {
      type: 'sequential',
      from: 'screen-cd-risc',
      to: 'screen-thanks',
    },
    { type: 'sequential', from: 'screen-thanks', to: 'end' },
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
            then: {
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
            options: '%psychedelics-substances',
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
            then: {
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
              '¿Realizás o realizaste un programa sostenido de microdosificación de psicodélicos?',
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
            then: {
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
            options: {
              source: '$$psychedelics-options.psychedelic-substances',
              labelKey: 'psychedelics-substances',
            },
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
            options: '%psychoactive-substances',
            required: false,
          },
        },
        {
          componentFamily: 'control',
          template: 'conditional',
          props: {
            if: {
              type: 'simple',
              dataKey: '$psychoactive-substances',
              operator: 'length-gt',
              value: 0,
            },
            then: {
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
                text: 'Nunca consumí estas sustancias',
                alignBottom: true,
              },
            },
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
                      label:
                        '[[psychoactive-substances.{{#for-each-psychoactive-substance.value}}]]',
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
                      then: {
                        componentFamily: 'response',
                        template: 'single-checkbox',
                        props: {
                          label:
                            'Mi consumo de [[psychoactive-substances.{{#for-each-psychoactive-substance.value}}]] disminuyó por factores externos. (Ej. no tengo, me queda poco, vivo con otra gente, etc.)',
                          dataKey:
                            'psychoactive-{{#for-each-psychoactive-substance.value}}-decrease-external',
                          defaultValue: false,
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
      slug: 'stai-state',
      components: [
        {
          componentFamily: 'content',
          template: 'rich-text',
          props: {
            content:
              '### ¿Cómo te sentís en este momento? \n\n Marcá como te estás sintiendo en relación a cada frase.',
          },
        },
        {
          componentFamily: 'control',
          template: 'for-each',
          props: {
            id: 'for-each-sentiment',
            type: 'static',
            values: [
              { question: 'Me siento calmado/a', id: 'calm' },
              { question: 'Me siento seguro/a', id: 'secure' },
              { question: 'Estoy tenso/a', id: 'tense' },
              { question: 'Me siento disgustado/a', id: 'upset' },
              { question: 'Me siento "como pez en el agua"', id: 'at_ease' },
              { question: 'Me siento alterado/a', id: 'disturbed' },
              {
                question:
                  'En este momento estoy preocupado/a por algún posible problema',
                id: 'worried',
              },
              { question: 'Me siento satisfecho/a', id: 'satisfied' },
              { question: 'Me siento asustado/a', id: 'frightened' },
              { question: 'Me siento cómodo/a', id: 'comfortable' },
              { question: 'Tengo confianza en mí mismo/a', id: 'confident' },
              { question: 'Me siento nervioso/a', id: 'nervous' },
              { question: 'Me siento agitado/a', id: 'agitated' },
              { question: 'Me siento indeciso/a', id: 'indecisive' },
              { question: 'Me siento tranquilo/a', id: 'relaxed' },
              { question: 'Me siento "a gusto"', id: 'content' },
              { question: 'Estoy preocupado/a', id: 'anxious' },
              { question: 'Me siento aturdido/a', id: 'confused' },
              { question: 'Me siento equilibrado/a', id: 'balanced' },
              { question: 'Me siento bien', id: 'good' },
            ],
            component: {
              componentFamily: 'layout',
              template: 'group',
              props: {
                name: 'sentiment-{{#for-each-sentiment.value.id}}',
                components: [
                  {
                    componentFamily: 'response',
                    template: 'radio',
                    props: {
                      required: false, // TODO: remove, just for testing
                      label: '{{#for-each-sentiment.value.question}}',
                      dataKey: 'sentiment-{{#for-each-sentiment.value.id}}',
                      options: '%stai-intensity-scale',
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
      slug: 'stai-trait',
      components: [
        {
          componentFamily: 'content',
          template: 'rich-text',
          props: {
            content:
              '### Y generalmente, ¿cómo te sentís? \n\n Marcá cómo te sentís generalmente en relación a cada frase. No estés mucho tiempo pensando cada frase, no hay respuestas buenas o malas.',
          },
        },
        {
          componentFamily: 'control',
          template: 'for-each',
          props: {
            id: 'for-each-trait-sentiment',
            type: 'static',
            values: [
              { question: 'Me siento bien', id: 'feeling_good' },
              {
                question: 'Me siento "a gusto" conmigo mismo/a',
                id: 'at_ease_with_self',
              },
              {
                question:
                  'Quisiera ser tan feliz como otras personas parecen serlo',
                id: 'wish_happier',
              },
              { question: 'Siento que fallo', id: 'feel_failure' },
              { question: 'Me siento descansado/a', id: 'feel_rested' },
              {
                question: 'Soy una persona tranquila, serena y calmada',
                id: 'calm_person',
              },
              {
                question:
                  'Siento que las dificultades se amontonan y no las puedo superar',
                id: 'overwhelmed',
              },
              {
                question: 'Me preocupo demasiado por cosas sin importancia',
                id: 'worry_trivial',
              },
              { question: 'Soy feliz', id: 'happy' },
              { question: 'Tengo malos pensamientos', id: 'bad_thoughts' },
              {
                question: 'Me falta confianza en mí mismo/a',
                id: 'lack_confidence',
              },
              { question: 'Me siento seguro/a', id: 'feel_secure' },
              { question: 'Puedo decidirme rápidamente', id: 'decide_quickly' },
              { question: 'Me siento fuera de lugar', id: 'feel_out_of_place' },
              { question: 'Me siento satisfecho/a', id: 'feel_satisfied' },
              {
                question:
                  'Algunas cosas poco importantes ocupan mi cabeza y me molestan',
                id: 'trivial_thoughts_bother',
              },
              {
                question:
                  'Los desengaños me afectan tanto que no me los puedo sacar de la cabeza',
                id: 'disappointments_linger',
              },
              { question: 'Soy una persona estable', id: 'stable_person' },
              {
                question:
                  'Cuando pienso en las cosas que tengo entre manos me pongo nervioso/a y tenso/a',
                id: 'nervous_about_tasks',
              },
            ],
            component: {
              componentFamily: 'layout',
              template: 'group',
              props: {
                name: 'trait-sentiment-{{#for-each-trait-sentiment.value.id}}',
                components: [
                  {
                    componentFamily: 'response',
                    template: 'radio',
                    props: {
                      required: false, // TODO: remove, just for testing
                      label: '{{#for-each-trait-sentiment.value.question}}',
                      dataKey:
                        'trait-sentiment-{{#for-each-trait-sentiment.value.id}}',
                      options: '%stai-frequency-scale',
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
      slug: 'panas',
      components: [
        {
          componentFamily: 'content',
          template: 'rich-text',
          props: {
            content:
              '### ¿Cómo te sentiste durante la última semana?\n\nMarcá como te sentiste durante la última semana, incluyendo hoy, en relación a cada frase.',
          },
        },
        {
          componentFamily: 'control',
          template: 'for-each',
          props: {
            id: 'for-each-panas',
            type: 'static',
            values: [
              { question: 'Interesado/a por las cosas', id: 'interested' },
              { question: 'Angustiado/a', id: 'distressed' },
              { question: 'Ilusionado/a o emocionado/a', id: 'excited' },
              { question: 'Afectado/a', id: 'upset' },
              { question: 'Fuerte', id: 'strong' },
              { question: 'Culpable', id: 'guilty' },
              { question: 'Asustado/a', id: 'scared' },
              { question: 'Agresivo/a', id: 'hostile' },
              { question: 'Entusiasmado/a', id: 'enthusiastic' },
              { question: 'Satisfecho/a consigo mismo/a', id: 'proud' },
              { question: 'Irritable', id: 'irritable' },
              { question: 'Despierto/a', id: 'alert' },
              { question: 'Avergonzado/a', id: 'ashamed' },
              { question: 'Inspirado/a', id: 'inspired' },
              { question: 'Nervioso/a', id: 'nervous' },
              { question: 'Decidido/a', id: 'determined' },
              { question: 'Concentrado/a', id: 'attentive' },
              { question: 'Agitado/a', id: 'jittery' },
              { question: 'Activo/a', id: 'active' },
              { question: 'Miedoso/a', id: 'afraid' },
            ],
            component: {
              componentFamily: 'layout',
              template: 'group',
              props: {
                name: 'panas-{{#for-each-panas.value.id}}',
                components: [
                  {
                    componentFamily: 'response',
                    template: 'likert-scale',
                    props: {
                      label: '{{#for-each-panas.value.question}}',
                      dataKey: 'panas-{{#for-each-panas.value.id}}',
                      options: '%panas-scale',
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
            alignBottom: true,
          },
        },
      ],
    },
    {
      slug: 'bieps',
      components: [
        {
          componentFamily: 'content',
          template: 'rich-text',
          props: {
            content:
              '### ¿Qué pensaste y sentiste durante el último mes?\n\nMarcá qué pensaste y cómo te sentiste durante el último mes. Recordá, no hay respuestas buenas o malas: todo sirve.',
          },
        },
        {
          componentFamily: 'control',
          template: 'for-each',
          props: {
            id: 'for-each-bieps',
            type: 'static',
            values: [
              {
                question: 'Creo que sé lo que quiero hacer con mi vida.',
                id: 'life_purpose',
              },
              {
                question: 'Si algo me sale mal puedo aceptarlo, admitirlo.',
                id: 'self_acceptance',
              },
              {
                question: 'Me importa pensar qué haré en el futuro.',
                id: 'future_orientation',
              },
              {
                question: 'Puedo decir lo que pienso sin mayores problemas.',
                id: 'autonomy_expression',
              },
              {
                question: 'Generalmente le caigo bien a la gente.',
                id: 'social_bonds',
              },
              {
                question: 'Siento que podré lograr las metas que me proponga.',
                id: 'self_efficacy',
              },
              {
                question: 'Cuento con personas que me ayudan si lo necesito.',
                id: 'social_support',
              },
              {
                question:
                  'En general hago lo que quiero, soy poco influenciable.',
                id: 'autonomy_independence',
              },
              {
                question:
                  'Soy una persona capaz de pensar en un proyecto para mi vida.',
                id: 'project_capacity',
              },
              {
                question:
                  'Puedo aceptar mis equivocaciones y tratar de mejorar.',
                id: 'error_acceptance',
              },
              {
                question: 'Puedo tomar decisiones sin dudar mucho.',
                id: 'decisiveness',
              },
              {
                question:
                  'Encaro sin mayores problemas mis obligaciones diarias.',
                id: 'daily_functioning',
              },
            ],
            component: {
              componentFamily: 'layout',
              template: 'group',
              props: {
                name: 'bieps-{{#for-each-bieps.value.id}}',
                components: [
                  {
                    componentFamily: 'response',
                    template: 'likert-scale',
                    props: {
                      label: '{{#for-each-bieps.value.question}}',
                      dataKey: 'bieps-{{#for-each-bieps.value.id}}',
                      options: '%agreement-scale',
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
            alignBottom: true,
          },
        },
      ],
    },
    {
      slug: 'cd-risc',
      components: [
        {
          componentFamily: 'content',
          template: 'rich-text',
          props: {
            content:
              '### ¿Cómo te representa cada frase?\n\nMarcá cómo creés que mejor te representa cada una de las siguientes frases.',
          },
        },
        {
          componentFamily: 'control',
          template: 'for-each',
          props: {
            id: 'for-each-cdrisc',
            type: 'static',
            values: [
              {
                question: 'Soy capaz de adaptarme cuando surgen cambios.',
                id: 'able_to_adapt',
              },
              {
                question: 'Usualmente manejo los problemas de distintos modos.',
                id: 'multiple_coping',
              },
              {
                question:
                  'Puedo alcanzar mis objetivos aunque haya obstáculos.',
                id: 'goal_persistence',
              },
              {
                question:
                  'No me doy por vencido/a aunque las cosas parezcan no tener solución.',
                id: 'perseverance',
              },
              {
                question:
                  'Los éxitos del pasado me dan confianza para enfrentarme a nuevos desafíos.',
                id: 'past_success',
              },
              {
                question:
                  'Cuando me enfrento a los problemas intento ver su lado cómico.',
                id: 'finds_humor',
              },
              {
                question:
                  'Enfrentarme a las dificultades puede hacerme más fuerte.',
                id: 'stress_strengthens',
              },
              {
                question:
                  'Tengo tendencia a recuperarme pronto luego de enfermedades o dificultades.',
                id: 'bounces_back',
              },
              {
                question:
                  'Siempre me esfuerzo sin importar cuál pueda ser el resultado.',
                id: 'self_disciplined',
              },
              {
                question: 'Sé a quién acudir para buscar ayuda.',
                id: 'social_support',
              },
              {
                question:
                  'Soy capaz de manejar sentimientos desagradables como tristeza, temor o enfado.',
                id: 'emotional_regulation',
              },
              {
                question: 'Tengo el control de mi vida.',
                id: 'sense_of_control',
              },
              { question: 'Me gustan los retos.', id: 'likes_challenges' },
              {
                question: 'Trabajo para conseguir mis objetivos.',
                id: 'goal_orientation',
              },
              {
                question: 'Estoy orgulloso/a de mis logros.',
                id: 'proud_of_achievements',
              },
              {
                question: 'Sea como sea, doy lo mejor de mí.',
                id: 'gives_best',
              },
              {
                question: 'Soy capaz de adaptarme a los cambios.',
                id: 'adaptability',
              },
              {
                question:
                  'Veo el lado positivo de las cosas aunque no vayan como quisiera.',
                id: 'positive_appraisal',
              },
              {
                question:
                  'La confianza en mí mismo/a me permite pasar los tiempos difíciles.',
                id: 'self_confidence_resilience',
              },
              {
                question:
                  'Cuando estoy en una situación difícil generalmente encuentro una salida.',
                id: 'finds_way_out',
              },
              {
                question:
                  'Generalmente tengo energía para hacer aquello que tengo que hacer.',
                id: 'has_energy',
              },
            ],
            component: {
              componentFamily: 'layout',
              template: 'group',
              props: {
                name: 'cdrisc-{{#for-each-cdrisc.value.id}}',
                components: [
                  {
                    componentFamily: 'response',
                    template: 'likert-scale',
                    props: {
                      label: '{{#for-each-cdrisc.value.question}}',
                      dataKey: 'cdrisc-{{#for-each-cdrisc.value.id}}',
                      options: '%resilience-scale',
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
            content:
              '# ¡Gracias por participar! \n\n Cuando los resultados estés analizados, vas a poder verlos en [https://elgatoylacaja.com.ar/labs](https://elgatoylacaja.com.ar/labs) Ahí encontrás también otros experimentos, sus resultados y las publicaciones en las que se convirtieron.',
          },
        },
        {
          componentFamily: 'content',
          template: 'rich-text',
          props: {
            content:
              '### Queremos entender las conciencias en su diversidad. Mientras más personas participen, más vamos a aprender.',
          },
        },
      ],
    },
  ],
};

export default pandemic;
