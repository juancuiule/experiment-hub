import { ExperimentFlow } from '@/lib/types';

/**
 * Bilingual demo experiment for the i18n dictionary feature.
 *
 * All participant-facing copy is addressed through [[key]] dictionary tokens
 * instead of being hard-coded. The active locale is chosen from the ?lang=
 * query param (e.g. /experiments/i18n-demo?lang=en), falling back to
 * `defaultLocale` ("es") when the param is absent or unknown.
 *
 * It also shows that a dictionary message may itself contain {{ }} answer-piping:
 * `[[thanks.body]]` resolves to a string containing {{$$welcome.name}}, which the
 * second resolution pass fills with the name collected on the welcome screen.
 */
const i18nDemo: ExperimentFlow = {
  defaultLocale: 'es',
  dictionary: {
    es: {
      'welcome.title': '# Bienvenido/a',
      'welcome.intro':
        'Este es un experimento de demostración del sistema multilingüe. Cambiá el idioma con el parámetro `?lang=en` en la URL.',
      'welcome.name-label': '¿Cómo te llamás?',
      'welcome.name-placeholder': 'Escribí tu nombre…',
      'welcome.cta': 'Empezar',
      'survey.question': 'Hola {{$$welcome.name}}, ¿qué tan claro fue esto?',
      'survey.opt-clear': 'Muy claro',
      'survey.opt-ok': 'Más o menos',
      'survey.opt-confusing': 'Confuso',
      'survey.cta': 'Enviar',
      'thanks.title': '# ¡Gracias!',
      'thanks.body':
        'Listo, {{$$welcome.name}}. Respondiste **{{$$survey.clarity}}**. ¡Gracias por participar!',
    },
    en: {
      'welcome.title': '# Welcome',
      'welcome.intro':
        'This is a demo experiment for the multilingual system. Switch languages with the `?lang=en` URL parameter.',
      'welcome.name-label': "What's your name?",
      'welcome.name-placeholder': 'Type your name…',
      'welcome.cta': 'Start',
      'survey.question': 'Hi {{$$welcome.name}}, how clear was this?',
      'survey.opt-clear': 'Very clear',
      'survey.opt-ok': 'Somewhat',
      'survey.opt-confusing': 'Confusing',
      'survey.cta': 'Submit',
      'thanks.title': '# Thank you!',
      'thanks.body':
        'All done, {{$$welcome.name}}. You answered **{{$$survey.clarity}}**. Thanks for taking part!',
    },
  },
  nodes: [
    { id: 'start', type: 'start' },
    { id: 'screen-welcome', type: 'screen', props: { slug: 'welcome' } },
    { id: 'screen-survey', type: 'screen', props: { slug: 'survey' } },
    { id: 'screen-thanks', type: 'screen', props: { slug: 'thanks' } },
    { id: 'end', type: 'end' },
  ],
  edges: [
    { from: 'start', to: 'screen-welcome', type: 'sequential' },
    { from: 'screen-welcome', to: 'screen-survey', type: 'sequential' },
    { from: 'screen-survey', to: 'screen-thanks', type: 'sequential' },
    { from: 'screen-thanks', to: 'end', type: 'sequential' },
  ],
  screens: [
    {
      slug: 'welcome',
      components: [
        {
          componentFamily: 'content',
          template: 'rich-text',
          props: { content: '[[welcome.title]]' },
        },
        {
          componentFamily: 'content',
          template: 'rich-text',
          props: { content: '[[welcome.intro]]' },
        },
        {
          componentFamily: 'response',
          template: 'text-input',
          props: {
            label: '[[welcome.name-label]]',
            placeholder: '[[welcome.name-placeholder]]',
            dataKey: 'name',
          },
        },
        {
          componentFamily: 'layout',
          template: 'button',
          props: { text: '[[welcome.cta]]' },
        },
      ],
    },
    {
      slug: 'survey',
      components: [
        {
          componentFamily: 'response',
          template: 'radio',
          props: {
            // The label pipes the name via {{ }} from inside a [[ ]] message.
            label: '[[survey.question]]',
            dataKey: 'clarity',
            options: [
              { label: '[[survey.opt-clear]]', value: 'clear' },
              { label: '[[survey.opt-ok]]', value: 'ok' },
              { label: '[[survey.opt-confusing]]', value: 'confusing' },
            ],
          },
        },
        {
          componentFamily: 'layout',
          template: 'button',
          props: { text: '[[survey.cta]]' },
        },
      ],
    },
    {
      slug: 'thanks',
      components: [
        {
          componentFamily: 'content',
          template: 'rich-text',
          props: { content: '[[thanks.title]]' },
        },
        {
          componentFamily: 'content',
          template: 'rich-text',
          props: { content: '[[thanks.body]]' },
        },
      ],
    },
  ],
};

export default i18nDemo;
