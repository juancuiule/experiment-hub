import { ExperimentFlow } from '@experiment-hub/engine/types';

type ScreenData = {
  id: number;
  img: string;
  text: string;
  question: string;
};
type Treatment = ScreenData[];
export const treatments: Treatment[] = [
  [
    {
      id: 1,
      img: '1_1.png',
      text: 'Mauricio Macri fue el presidente de Boca Juniors que más títulos ganó en la historia del club (17 contando torneos locales y copas internacionales). Todavía sigue existiendo un fuerte vínculo entre Macri y los principales dirigentes xeneizes. Por ejemplo, Daniel Angelici (actual presidente de Boca) ganó la presidencia del club en 2011 con el apoyo de Mauricio Macri.',
      question:
        '¿Sabías que Angelici lanzó este año una nueva agrupación en el radicalismo para respaldar la coalición con el PRO?',
    },
    {
      id: 2,
      img: '1_2.png',
      text: 'En diciembre de 2019 se elegirá un nuevo presidente en Boca Juniors. Uno de los candidatos, Christian Gribaudo, cuenta con el apoyo de Mauricio Macri. Hasta hace unos días, Gribaudo se desempeñaba como Secretario General de Boca Juniors siendo a la vez funcionario del gobierno de María Eugenia Vidal en la Provincia de Buenos Aires.',
      question:
        '¿Sabías que Gribaudo fue diputado nacional del macrismo entre 2007 y 2011?',
    },
    {
      id: 3,
      img: '1_3.png',
      text: 'Existe una relación histórica que vincula a River Plate con el peronismo. Por ejemplo, el estadio Monumental se llama “Antonio Vespucio Liberti”, honrando a quien fuera presidente de River en cuatro ocasiones. Al terminar su mandato, Liberti fue funcionario del segundo gobierno del General Juan Domingo Perón.',
      question:
        '¿Sabías que, bajo la presidencia de Liberti, River ganó 3 títulos nacionales y 3 copas internacionales?',
    },
    {
      id: 4,
      img: '1_4.png',
      text: 'Rodolfo D’Onofrio, actual presidente de River, fue quien más copas internacionales obtuvo en la historia del club. D’Onofrio declaró repetidas veces que, una vez terminado su mandato en River, tiene pensado dedicarse a la política. De hecho, en su juventud militaba en una agrupación cercana al peronismo.',
      question:
        '¿Sabías que D’Onofrio fue mencionado como posible candidato del peronismo por la Ciudad de Buenos Aires?',
    },
  ],
  [
    {
      id: 5,
      img: '2_1.png',
      text: 'Hay un vínculo que conecta fuertemente a River con Cambiemos: la familia Santilli. Diego Santilli, ex ministro de Medio Ambiente de Macri y actual vicejefe de gobierno de la Ciudad de Buenos Aires, es socio y fanático de River. De hecho, su padre (Hugo Santilli) fue presidente de River en la década de 1980.',
      question:
        '¿Sabías que, bajo la presidencia de Hugo Santilli, River ganó la Copa Libertadores y la Copa Intercontinental de 1986?',
    },
    {
      id: 6,
      img: '2_2.png',
      text: 'Varios políticos de Cambiemos son, simultáneamente, funcionarios públicos y dirigentes del Club Atlético River Plate. Por ejemplo, Agustín Forchieri (presidente del bloque de diputados de la Ciudad por Cambiemos) es socio y presidente de una agrupación riverplatense.',
      question:
        '¿Sabías que José Luis Acevedo (diputado de la Ciudad de Buenos Aires por Cambiemos) tiene a su cargo la Defensoría del Socio de River?',
    },
    {
      id: 7,
      img: '2_3.png',
      text: 'La hinchada de Boca siempre tuvo una impronta popular y peronista. Por ejemplo, el máximo ídolo de la hinchada de Boca, Diego Armando Maradona, demostró en repetidas ocasiones su apoyo y cariño por Cristina Fernández de Kirchner. Por otro lado, Maradona declaró estar enemistado con Macri desde la época en que Diego era futbolista y Macri era el presidente de Boca.',
      question:
        '¿Sabías que hasta los propios hinchas de Boca han cantado en contra de Mauricio Macri?',
    },
    {
      id: 8,
      img: '2_4.png',
      text: 'Existe una relación histórica que vincula a Boca Juniors con el peronismo. De hecho, el propio General Juan Domingo Perón era hincha de Boca. Esto fue confirmado por periodistas y también por ex funcionarios del peronismo como Ramón Cereijo, quien fuera ministro de Hacienda en el primer gobierno de Perón.',
      question:
        '¿Sabías que el General Perón gritó un gol de Boca en la cancha de River en un superclásico jugado en el año 1953?',
    },
  ],
  [
    {
      id: 9,
      img: '3_1.png',
      text: 'El Club Atlético River Plate es el club mejor posicionado en la tabla histórica de la Primera División Argentina. Desde que el fútbol es profesional, River es el club que más campeonatos locales ganó (36 torneos), que más partidos ganó, y que más goles hizo. Además, los millonarios son dueños del “Monumental”, el estadio más grande de Argentina.',
      question: '¿Sabías que River es el club argentino que tiene más socios?',
    },
    {
      id: 10,
      img: '3_2.png',
      text: 'El Club Atlético Boca Juniors es el club argentino con mayor cantidad de títulos oficiales, contando torneos nacionales y copas internacionales. Los xeneizes poseen el récord de más partidos invictos en la historia del profesionalismo (40 partidos). Además, son el único club del país que nunca descendió ni salió último en la tabla de posiciones. ',
      question:
        '¿Sabías que Boca es el único club argentino en haber ganado al menos un título por década?',
    },
    {
      id: 11,
      img: '3_3.png',
      text: 'El Frente de Todxs es una coalición política electoral que participará de las elecciones presidenciales de la República Argentina en el 2019. La fórmula presidencial está compuesta por Alberto Fernández y Cristina Fernández de Kirchner. Esta coalición, que incluye al Partido Justicialista, cuenta con el respaldo de la Confederación General del Trabajo (CGT).',
      question:
        '¿Sabías que el Frente de Todxs es una coalición que incluye a 19 partidos políticos?',
    },
    {
      id: 12,
      img: '3_4.png',
      text: 'Juntos por el Cambio (JxC) es una coalición política electoral que participará de las elecciones presidenciales de la República Argentina en el 2019. La fórmula presidencial está compuesta por Mauricio Macri y Miguel Ángel Pichetto. Esta coalición representa al oficialismo nacional, bonaerense y porteño en las próximas elecciones.',
      question:
        '¿Sabías que Juntos por el Cambio es una coalición que incluye a 8 partidos políticos?',
    },
  ],
  [
    {
      id: 13,
      img: '4_1.png',
      text: 'La Copa Libertadores de América se disputó por primera vez en 1960 con el nombre “Copa de Campeones de América”. Los clubes argentinos son quienes más veces ganaron este certamen (25 veces), seguidos por los clubes brasileros (18 veces). En su formato actual, participan anualmente 47 clubes de 10 países.',
      question:
        '¿Sabías que los dos clubes que más veces participaron en la Copa Libertadores son uruguayos?',
    },
    {
      id: 14,
      img: '4_2.png',
      text: 'En el formato actual, seis equipos argentinos accederán a disputar la Copa Libertadores 2020: los cuatro equipos mejor ubicados de la Superliga 2018-19, el campeón de la Copa Argentina 2019 y el campeón de la Copa de la Superliga 2019. También clasifican directamente el campeón de la Copa Libertadores 2019 y de la Copa Sudamericana 2019.',
      question:
        '¿Sabías que por primera vez un club argentino jugará la Copa Libertadores mientras disputa la segunda división?',
    },
    {
      id: 15,
      img: '4_3.png',
      text: 'El domingo 27 de octubre de 2019 se llevarán a cabo elecciones en la República Argentina, donde se elegirán los próximos presidente y vicepresidente. Para que una fórmula presidencial se proclame ganadora en primera vuelta deberá obtener al menos 45% de los votos positivos o bien el 40% con una diferencia de 10% sobre la fórmula que ocupe el segundo lugar.',
      question:
        '¿Sabías que en estas elecciones los argentinos también elegirán 130 diputados y 24 senadores nacionales?',
    },
    {
      id: 16,
      img: '4_4.png',
      text: 'El 11 de agosto de 2019 ocurrieron las elecciones primarias, abiertas, simultáneas y obligatorias (PASO). Participaron en las mismas casi 26 millones de votantes, lo cual representa el 76% del padrón. Los candidatos que superaron el 1.5% de los votos válidos en las PASO quedaron habilitados para presentarse a las elecciones presidenciales. ',
      question:
        '¿Sabías que 4 fórmulas presidenciales quedaron inhabilitadas por no haber conseguido suficientes votos en las últimas PASO?',
    },
  ],
];

const tribalismo: ExperimentFlow = {
  nodes: [
    { id: 'start', type: 'start' },
    {
      id: 'sample-treatment',
      type: 'compute',
      props: {
        name: 'Sample Treatment',
        computations: [
          {
            outputKey: 'treatment',
            formula: {
              type: 'sample',
              input: treatments,
              n: 1,
            },
          },
        ],
      },
    },
    {
      id: 'treatment-loop',
      type: 'loop',
      props: {
        type: 'dynamic',
        randomized: true,
        dataKey: '$$sample-treatment.treatment.0',
        itemKey: 'id',
        stepper: {
          label: 'Dato {index} de {total}',
          style: 'continuous',
        },
      },
    },

    {
      id: 'treatment-screen',
      type: 'screen',
      props: {
        slug: 'treatment-screen',
      },
    },

    { id: 'end', type: 'end' },
  ],
  edges: [
    { from: 'start', to: 'sample-treatment', type: 'sequential' },
    { from: 'sample-treatment', to: 'treatment-loop', type: 'sequential' },
    {
      from: 'treatment-loop',
      to: 'treatment-screen',
      type: 'loop-template',
    },
    {
      from: 'treatment-loop',
      to: 'end',
      type: 'sequential',
    },
  ],
  screens: [
    {
      slug: 'treatment-screen',
      components: [
        {
          componentFamily: 'content',
          template: 'image',
          props: {
            url: '/tribalismo/{{@treatment-loop.value.img}}?raw=true&token=GHSAT0AAAAAAD2O2G5RTKJK6Q7SK6E6BNWY2Q3NDXQ',
            alt: 'Treatment image',
          },
        },
        {
          componentFamily: 'content',
          template: 'rich-text',
          props: {
            content: '{{@treatment-loop.value.text}}',
          },
        },
        {
          componentFamily: 'content',
          template: 'rich-text',
          props: {
            content: '#### {{@treatment-loop.value.question}}',
          },
        },
        {
          componentFamily: 'layout',
          template: 'button',
          props: {
            text: 'No tenía idea',
            payload: {
              dataKey: '{{@treatment-loop.value.id}}-answer',
              value: 'no-idea',
            },
          },
        },
        {
          componentFamily: 'layout',
          template: 'button',
          props: {
            text: 'Ya lo sabía',
            payload: {
              dataKey: '{{@treatment-loop.value.id}}-answer',
              value: 'knew-it',
            },
          },
        },
      ],
    },
  ],
};

export default tribalismo;
