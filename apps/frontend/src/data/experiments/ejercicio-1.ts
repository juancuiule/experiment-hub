import { ExperimentFlow } from '@experiment-hub/engine/types';

const ejercicio1: ExperimentFlow = {
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
                      label: 'Una batería que arranca bien pero se cae rápido',
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
                  then: {
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
                  then: {
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
                  label: 'Mi __estado de ánimo__ últimamente se parece más a…',
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
                  then: {
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
                  then: {
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
                  then: {
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
                  then: {
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

export default ejercicio1;
