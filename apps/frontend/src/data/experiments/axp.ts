import { ExperimentFlow } from '@experiment-hub/engine/types';

const alteredXperience: ExperimentFlow = {
  dictionary: {
    es: {
      substances: {
        cannabis: 'Cannabis',
        psilocybin: 'Psilocibina',
        alcohol: 'Alcohol',
        mdma: 'MDMA',
      },
      doses: {
        low: 'Dosis baja',
        medium: 'Dosis media',
        high: 'Dosis alta',
      },
    },
  },
  defaultLocale: 'es',
  options: {
    substances: [
      { label: '[[substances.cannabis]]', value: 'cannabis' },
      { label: '[[substances.psilocybin]]', value: 'psilocybin' },
      { label: '[[substances.alcohol]]', value: 'alcohol' },
      { label: '[[substances.mdma]]', value: 'mdma' },
    ],
    doses: [
      { label: '[[doses.low]]', value: 'low' },
      { label: '[[doses.medium]]', value: 'medium' },
      { label: '[[doses.high]]', value: 'high' },
    ],
  },
  nodes: [
    { id: 'start', type: 'start' },
    { id: 'screen-terms', type: 'screen', props: { slug: 'terms' } },
    { id: 'screen-substance', type: 'screen', props: { slug: 'substance' } },
    { id: 'screen-dose', type: 'screen', props: { slug: 'dose' } },
    { id: 'screen-context', type: 'screen', props: { slug: 'context' } },
    { id: 'screen-photo', type: 'screen', props: { slug: 'photo' } },
    { id: 'screen-asc-intro', type: 'screen', props: { slug: 'asc-intro' } },
    { id: 'screen-asc-1', type: 'screen', props: { slug: 'asc-1' } },
    { id: 'screen-asc-2', type: 'screen', props: { slug: 'asc-2' } },
    { id: 'screen-asc-3', type: 'screen', props: { slug: 'asc-3' } },
    { id: 'screen-asc-4', type: 'screen', props: { slug: 'asc-4' } },
    { id: 'screen-free-text', type: 'screen', props: { slug: 'free-text' } },
    { id: 'screen-thanks', type: 'screen', props: { slug: 'thanks' } },
    { id: 'end', type: 'end' },
  ],
  edges: [
    { type: 'sequential', from: 'start', to: 'screen-terms' },
    { type: 'sequential', from: 'screen-terms', to: 'screen-substance' },
    { type: 'sequential', from: 'screen-substance', to: 'screen-dose' },
    { type: 'sequential', from: 'screen-dose', to: 'screen-context' },
    { type: 'sequential', from: 'screen-context', to: 'screen-photo' },
    { type: 'sequential', from: 'screen-photo', to: 'screen-asc-intro' },
    { type: 'sequential', from: 'screen-asc-intro', to: 'screen-asc-1' },
    { type: 'sequential', from: 'screen-asc-1', to: 'screen-asc-2' },
    { type: 'sequential', from: 'screen-asc-2', to: 'screen-asc-3' },
    { type: 'sequential', from: 'screen-asc-3', to: 'screen-asc-4' },
    { type: 'sequential', from: 'screen-asc-4', to: 'screen-free-text' },
    { type: 'sequential', from: 'screen-free-text', to: 'screen-thanks' },
    { type: 'sequential', from: 'screen-thanks', to: 'end' },
  ],
  screens: [
    {
      slug: 'terms',
      components: [
        {
          componentFamily: 'content',
          template: 'rich-text',
          props: { content: '# Altered X Project' },
        },
        {
          componentFamily: 'content',
          template: 'rich-text',
          props: {
            content:
              'Este es un esfuerzo para organizar y sistematizar nuestro conocimiento sobre la experiencia subjetiva humana durante diferentes estados de conciencia.\n\nAlgunos de estos estados son muy diferentes de nuestras experiencias ordinarias y distintas personas los experimentan de maneras particulares. Por eso tu participación es muy importante.\n\nEn este experimento nos enfocamos en estados alterados inducidos por cannabis, psilocibina, alcohol y MDMA. Si aceptás participar, te vamos a hacer preguntas sobre una de tus experiencias alteradas. Va a llevar entre 5 y 10 minutos.\n\nToda experiencia que compartas será completamente anónima y todos los datos estarán disponibles abiertamente para investigadores de todo el mundo.',
          },
        },
        {
          componentFamily: 'response',
          template: 'single-checkbox',
          props: {
            label: 'Acepto participar.',
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
              componentFamily: 'layout',
              template: 'button',
              props: { text: 'Empezar →', alignBottom: true },
            },
            else: {
              componentFamily: 'layout',
              template: 'button',
              props: { text: 'Empezar →', alignBottom: true, disabled: true },
            },
          },
        },
      ],
    },
    {
      slug: 'substance',
      components: [
        {
          componentFamily: 'content',
          template: 'rich-text',
          props: {
            content:
              '### Cada experiencia es única\n\nPensá en una vez que hayas tomado cannabis, psilocibina, alcohol o MDMA y visualizá esa experiencia.\n\nConcentrate en una sola experiencia alterada, inducida voluntariamente. Pensá en dónde estabas, cómo fue, los sonidos y olores que te rodeaban.\n\nIntentá revivir la sensación de tu cuerpo y mente entrando en esa experiencia. Una vez que te hayas enfocado en ese momento, podemos continuar.',
          },
        },
        {
          componentFamily: 'response',
          template: 'dropdown',
          props: {
            label: 'La sustancia que tomé fue:',
            dataKey: 'substance',
            options: '%substances',
            required: true,
          },
        },
        {
          componentFamily: 'layout',
          template: 'button',
          props: { text: 'Siguiente →', alignBottom: true },
        },
      ],
    },
    {
      slug: 'dose',
      components: [
        {
          componentFamily: 'content',
          template: 'rich-text',
          props: { content: '### Tu experiencia\n\nLa dosis que tomé fue:' },
        },
        {
          componentFamily: 'response',
          template: 'radio',
          props: {
            label: '',
            dataKey: 'dose',
            options: '%doses',
            required: true,
          },
        },
        {
          componentFamily: 'layout',
          template: 'button',
          props: { text: 'Siguiente →', alignBottom: true },
        },
      ],
    },
    {
      slug: 'context',
      components: [
        {
          componentFamily: 'content',
          template: 'rich-text',
          props: {
            content:
              '### [[substances.{{$$substance.substance}}]] / [[doses.{{$$dose.dose}}]]\n\nDescribí el contexto en el que tuviste esta experiencia.',
          },
        },
        {
          componentFamily: 'response',
          template: 'text-area',
          props: {
            label: 'Estaba...',
            dataKey: 'context',
            required: false,
          },
        },
        {
          componentFamily: 'layout',
          template: 'button',
          props: { text: 'Siguiente →', alignBottom: true },
        },
      ],
    },
    {
      slug: 'photo',
      components: [
        {
          componentFamily: 'content',
          template: 'rich-text',
          props: {
            content:
              '### [[substances.{{$$substance.substance}}]] / [[doses.{{$$dose.dose}}]]\n\nSi tenés una foto que te recuerde esa experiencia, podés compartirla acá.',
          },
        },
        {
          componentFamily: 'layout',
          template: 'button',
          props: { text: 'Siguiente →', alignBottom: true },
        },
      ],
    },
    {
      slug: 'asc-intro',
      components: [
        {
          componentFamily: 'content',
          template: 'rich-text',
          props: {
            content:
              '## ¡Perfecto!\n\nAhora te vamos a hacer una serie de preguntas para que describas lo que experimentaste.\n\nPara cada frase, indicá en qué medida te describe lo que viviste, comparado con tu estado habitual.',
          },
        },
        {
          componentFamily: 'layout',
          template: 'button',
          props: { text: 'Siguiente →', alignBottom: true },
        },
      ],
    },
    {
      slug: 'asc-1',
      components: [
        {
          componentFamily: 'content',
          template: 'rich-text',
          props: {
            content:
              '### [[substances.{{$$substance.substance}}]] / [[doses.{{$$dose.dose}}]]',
          },
        },
        {
          componentFamily: 'control',
          template: 'for-each',
          props: {
            id: 'for-each-asc-1',
            type: 'static',
            randomized: true,
            values: [
              {
                question: 'Sentí miedo sin poder decir exactamente por qué.',
                id: 'anxiety_1',
                dimension: 'anxiety',
              },
              {
                question: 'Me sentí amenazado/a.',
                id: 'anxiety_2',
                dimension: 'anxiety',
              },
              {
                question:
                  'Las formas de las cosas parecían cambiar al ritmo de los sonidos y ruidos.',
                id: 'synesthesia_1',
                dimension: 'audio_visual_synesthesia',
              },
              {
                question:
                  'El color de las cosas parecía modificarse con los sonidos y ruidos.',
                id: 'synesthesia_2',
                dimension: 'audio_visual_synesthesia',
              },
              {
                question: 'Experimenté una paz profunda en mí mismo/a.',
                id: 'bliss_1',
                dimension: 'blissful_state',
              },
              {
                question: 'Experimenté un amor que todo lo abarcaba.',
                id: 'bliss_2',
                dimension: 'blissful_state',
              },
            ],
            component: {
              componentFamily: 'layout',
              template: 'group',
              props: {
                name: 'asc-{{#for-each-asc-1.value.id}}',
                components: [
                  {
                    componentFamily: 'response',
                    template: 'slider',
                    props: {
                      label: '{{#for-each-asc-1.value.question}}',
                      minLabel: 'No, nada más que lo habitual',
                      maxLabel: 'Sí, completamente',
                      dataKey: 'asc-{{#for-each-asc-1.value.id}}',
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
          props: { text: 'Siguiente →', alignBottom: true },
        },
      ],
    },
    {
      slug: 'asc-2',
      components: [
        {
          componentFamily: 'content',
          template: 'rich-text',
          props: {
            content:
              '### [[substances.{{$$substance.substance}}]] / [[doses.{{$$dose.dose}}]]',
          },
        },
        {
          componentFamily: 'control',
          template: 'for-each',
          props: {
            id: 'for-each-asc-2',
            type: 'static',
            randomized: true,
            values: [
              {
                question:
                  'Las cosas cotidianas adquirieron un significado especial.',
                id: 'meaning_1',
                dimension: 'changed_meaning',
              },
              {
                question:
                  'Las cosas a mi alrededor tenían un significado extraño para mí.',
                id: 'meaning_2',
                dimension: 'changed_meaning',
              },
              {
                question:
                  'Vi escenas pasar ante mí en la oscuridad total o con los ojos cerrados.',
                id: 'complex_imagery_1',
                dimension: 'complex_imagery',
              },
              {
                question: 'Mi imaginación era extremadamente vívida.',
                id: 'complex_imagery_2',
                dimension: 'complex_imagery',
              },
              {
                question: 'Tuve la sensación de no tener cuerpo.',
                id: 'disembodiment_1',
                dimension: 'disembodiment',
              },
              {
                question: 'Tuve la sensación de estar fuera de mi cuerpo.',
                id: 'disembodiment_2',
                dimension: 'disembodiment',
              },
            ],
            component: {
              componentFamily: 'layout',
              template: 'group',
              props: {
                name: 'asc-{{#for-each-asc-2.value.id}}',
                components: [
                  {
                    componentFamily: 'response',
                    template: 'slider',
                    props: {
                      label: '{{#for-each-asc-2.value.question}}',
                      minLabel: 'No, nada más que lo habitual',
                      maxLabel: 'Sí, completamente',
                      dataKey: 'asc-{{#for-each-asc-2.value.id}}',
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
          props: { text: 'Siguiente →', alignBottom: true },
        },
      ],
    },
    {
      slug: 'asc-3',
      components: [
        {
          componentFamily: 'content',
          template: 'rich-text',
          props: {
            content:
              '### [[substances.{{$$substance.substance}}]] / [[doses.{{$$dose.dose}}]]',
          },
        },
        {
          componentFamily: 'control',
          template: 'for-each',
          props: {
            id: 'for-each-asc-3',
            type: 'static',
            randomized: true,
            values: [
              {
                question:
                  'Vi patrones regulares en la oscuridad completa o con los ojos cerrados.',
                id: 'elementary_imagery_1',
                dimension: 'elementary_imagery',
              },
              {
                question:
                  'Vi colores ante mí en la oscuridad total o con los ojos cerrados.',
                id: 'elementary_imagery_2',
                dimension: 'elementary_imagery',
              },
              {
                question: 'Todo parecía unificarse en una sola cosa.',
                id: 'unity_1',
                dimension: 'experience_of_unity',
              },
              {
                question:
                  'Los conflictos y las contradicciones parecían disolverse.',
                id: 'unity_2',
                dimension: 'experience_of_unity',
              },
              {
                question:
                  'Tuve dificultad para distinguir lo importante de lo que no lo era.',
                id: 'impaired_cognition_1',
                dimension: 'impaired_control_cognition',
              },
              {
                question:
                  'No podía completar un pensamiento; mis pensamientos se desconectaban repetidamente.',
                id: 'impaired_cognition_2',
                dimension: 'impaired_control_cognition',
              },
            ],
            component: {
              componentFamily: 'layout',
              template: 'group',
              props: {
                name: 'asc-{{#for-each-asc-3.value.id}}',
                components: [
                  {
                    componentFamily: 'response',
                    template: 'slider',
                    props: {
                      label: '{{#for-each-asc-3.value.question}}',
                      minLabel: 'No, nada más que lo habitual',
                      maxLabel: 'Sí, completamente',
                      dataKey: 'asc-{{#for-each-asc-3.value.id}}',
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
          props: { text: 'Siguiente →', alignBottom: true },
        },
      ],
    },
    {
      slug: 'asc-4',
      components: [
        {
          componentFamily: 'content',
          template: 'rich-text',
          props: {
            content:
              '### [[substances.{{$$substance.substance}}]] / [[doses.{{$$dose.dose}}]]',
          },
        },
        {
          componentFamily: 'control',
          template: 'for-each',
          props: {
            id: 'for-each-asc-4',
            type: 'static',
            randomized: true,
            values: [
              {
                question: 'Me sentí muy profundo/a.',
                id: 'insightfulness_1',
                dimension: 'insightfulness',
              },
              {
                question:
                  'Obtuve claridad sobre conexiones que antes me desconcertaban.',
                id: 'insightfulness_2',
                dimension: 'insightfulness',
              },
              {
                question:
                  'Tuve la sensación de estar conectado/a con un poder superior.',
                id: 'spiritual_1',
                dimension: 'spiritual_experience',
              },
              {
                question: 'Mi experiencia tuvo aspectos religiosos.',
                id: 'spiritual_2',
                dimension: 'spiritual_experience',
              },
            ],
            component: {
              componentFamily: 'layout',
              template: 'group',
              props: {
                name: 'asc-{{#for-each-asc-4.value.id}}',
                components: [
                  {
                    componentFamily: 'response',
                    template: 'slider',
                    props: {
                      label: '{{#for-each-asc-4.value.question}}',
                      minLabel: 'No, nada más que lo habitual',
                      maxLabel: 'Sí, completamente',
                      dataKey: 'asc-{{#for-each-asc-4.value.id}}',
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
          props: { text: 'Siguiente →', alignBottom: true },
        },
      ],
    },
    {
      slug: 'free-text',
      components: [
        {
          componentFamily: 'content',
          template: 'rich-text',
          props: {
            content:
              '### [[substances.{{$$substance.substance}}]] / [[doses.{{$$dose.dose}}]]\n\nDescribí libremente tu experiencia con tus propias palabras.',
          },
        },
        {
          componentFamily: 'response',
          template: 'text-area',
          props: {
            label: 'Mi experiencia fue...',
            dataKey: 'free-description',
            required: false,
          },
        },
        {
          componentFamily: 'layout',
          template: 'button',
          props: { text: 'Finalizar →', alignBottom: true },
        },
        {
          componentFamily: 'layout',
          template: 'button',
          props: {
            text: 'Saltar pregunta',
            alignBottom: true,
            payload: {
              dataKey: 'free-description',
              value: '',
            },
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
              '# ¡Gracias por participar!\n\nTus datos fueron registrados. Cuando los resultados estén analizados, vas a poder verlos en [alteredxproject.com](http://www.alteredxproject.com)',
          },
        },
      ],
    },
  ],
};

export default alteredXperience;
