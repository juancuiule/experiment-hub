import { describe, expect, it } from 'vitest';
import { buildMessages, selectLocale } from '../i18n';
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
});
