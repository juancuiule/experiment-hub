import { describe, expect, it } from 'vitest';
import { buildMessages, flattenMessages, selectLocale } from '../i18n';
import { ExperimentFlow } from '../types';

const base: ExperimentFlow = { nodes: [], edges: [] };

const withDictionary: ExperimentFlow = {
  ...base,
  defaultLocale: 'en',
  dictionary: {
    en: { greeting: 'Hello', cta: 'Continue' },
    es: { greeting: 'Hola', cta: 'Continuar' },
  },
};

describe('selectLocale', () => {
  it('returns the ?lang= param when it is a defined locale', () => {
    expect(selectLocale({ lang: 'es' }, withDictionary)).toBe('es');
  });

  it('falls back to defaultLocale when the param is absent', () => {
    expect(selectLocale({}, withDictionary)).toBe('en');
  });

  it('falls back to defaultLocale when the param is not a defined locale', () => {
    expect(selectLocale({ lang: 'fr' }, withDictionary)).toBe('en');
  });

  it('ignores array-valued params', () => {
    expect(selectLocale({ lang: ['es', 'en'] }, withDictionary)).toBe('en');
  });

  it('uses the first locale when defaultLocale is unset', () => {
    const exp: ExperimentFlow = {
      ...base,
      dictionary: { de: { greeting: 'Hallo' }, es: { greeting: 'Hola' } },
    };
    expect(selectLocale({}, exp)).toBe('de');
  });

  it('returns undefined when the experiment has no dictionary', () => {
    expect(selectLocale({ lang: 'es' }, base)).toBeUndefined();
  });
});

describe('buildMessages', () => {
  it('returns the active locale messages', () => {
    expect(buildMessages(withDictionary, 'es')).toEqual({
      greeting: 'Hola',
      cta: 'Continuar',
    });
  });

  it('merges default-locale messages underneath as fallback', () => {
    const exp: ExperimentFlow = {
      ...base,
      defaultLocale: 'en',
      dictionary: {
        en: { greeting: 'Hello', cta: 'Continue', footer: 'Bye' },
        es: { greeting: 'Hola', cta: 'Continuar' },
      },
    };
    // `footer` only exists in en — it should be present via fallback.
    expect(buildMessages(exp, 'es')).toEqual({
      greeting: 'Hola',
      cta: 'Continuar',
      footer: 'Bye',
    });
  });

  it('returns undefined when the experiment has no dictionary', () => {
    expect(buildMessages(base, 'en')).toBeUndefined();
  });

  it('returns undefined when locale is undefined', () => {
    expect(buildMessages(withDictionary, undefined)).toBeUndefined();
  });

  it('flattens a nested locale tree into dotted keys', () => {
    const exp: ExperimentFlow = {
      ...base,
      defaultLocale: 'es',
      dictionary: {
        es: {
          welcome: { title: '# Bienvenido/a', cta: 'Empezar' },
          survey: { question: '¿Listo?' },
        },
      },
    };
    expect(buildMessages(exp, 'es')).toEqual({
      'welcome.title': '# Bienvenido/a',
      'welcome.cta': 'Empezar',
      'survey.question': '¿Listo?',
    });
  });

  it('falls back across nested trees per dotted key', () => {
    const exp: ExperimentFlow = {
      ...base,
      defaultLocale: 'en',
      dictionary: {
        en: { welcome: { title: 'Hello', footer: 'Bye' } },
        es: { welcome: { title: 'Hola' } },
      },
    };
    // welcome.footer only exists in en — present via fallback.
    expect(buildMessages(exp, 'es')).toEqual({
      'welcome.title': 'Hola',
      'welcome.footer': 'Bye',
    });
  });

  it('allows mixing nested objects and flat dotted keys in one locale', () => {
    const exp: ExperimentFlow = {
      ...base,
      defaultLocale: 'en',
      dictionary: {
        en: { welcome: { title: 'Hello' }, 'survey.cta': 'Submit' },
      },
    };
    expect(buildMessages(exp, 'en')).toEqual({
      'welcome.title': 'Hello',
      'survey.cta': 'Submit',
    });
  });
});

describe('flattenMessages', () => {
  it('flattens a nested tree to dotted keys', () => {
    expect(
      flattenMessages({ a: { b: 'x', c: { d: 'y' } }, e: 'z' }),
    ).toEqual({ 'a.b': 'x', 'a.c.d': 'y', e: 'z' });
  });

  it('returns a flat map unchanged', () => {
    expect(flattenMessages({ 'a.b': 'x' })).toEqual({ 'a.b': 'x' });
  });

  it('returns an empty object for an empty tree', () => {
    expect(flattenMessages({})).toEqual({});
  });
});
