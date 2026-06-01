import { flattenMessages } from '../i18n';
import { DICTIONARY_TOKEN_RE } from '../tokens';
import { ExperimentFlow } from '../types';
import { ValidationError } from './types';

// Collects every [[key]] token found in `text` into `into`.
function collectKeys(text: string, into: Set<string>): void {
  for (const match of text.matchAll(DICTIONARY_TOKEN_RE)) into.add(match[1]);
}

// Validates i18n dictionary usage:
// - unknown-dictionary-key: a [[key]] is referenced (in a component prop or
//   nested inside a message) but defined in no locale.
// - dictionary-locale-mismatch: a key exists in some locales but not others,
//   so the active locale could silently fall back or render literal.
// - unknown-default-locale: `defaultLocale` is set but is not a dictionary key.
export function checkDictionaryReferences(
  flow: ExperimentFlow,
): ValidationError[] {
  const errors: ValidationError[] = [];
  const dictionary = flow.dictionary ?? {};
  const locales = Object.keys(dictionary);

  // Flatten each locale's (possibly nested) tree to dotted keys once, up front.
  const flatByLocale = new Map<string, Record<string, string>>();
  for (const locale of locales) {
    flatByLocale.set(locale, flattenMessages(dictionary[locale]));
  }

  // Keys referenced by component props (any string prop) plus keys referenced
  // from within dictionary messages themselves (nested [[ ]]).
  const referenced = new Set<string>();
  collectKeys(JSON.stringify(flow.screens ?? []), referenced);
  for (const locale of locales) {
    for (const message of Object.values(flatByLocale.get(locale)!)) {
      collectKeys(message, referenced);
    }
  }

  // Defined keys, per locale and unioned.
  const definedByLocale = new Map<string, Set<string>>();
  const allKeys = new Set<string>();
  for (const locale of locales) {
    const keys = new Set(Object.keys(flatByLocale.get(locale)!));
    definedByLocale.set(locale, keys);
    keys.forEach((key) => allKeys.add(key));
  }

  if (flow.defaultLocale && !locales.includes(flow.defaultLocale)) {
    errors.push({
      code: 'unknown-default-locale',
      category: 'reference',
      message: `defaultLocale "${flow.defaultLocale}" is not a key of the dictionary (locales: ${
        locales.join(', ') || 'none'
      })`,
    });
  }

  for (const key of referenced) {
    if (!allKeys.has(key)) {
      errors.push({
        code: 'unknown-dictionary-key',
        category: 'reference',
        message: `Dictionary reference [[${key}]] is not defined in any locale`,
      });
    }
  }

  for (const locale of locales) {
    const keys = definedByLocale.get(locale)!;
    const missing = [...allKeys].filter((key) => !keys.has(key));
    if (missing.length > 0) {
      errors.push({
        code: 'dictionary-locale-mismatch',
        category: 'reference',
        severity: 'warning',
        message: `Locale "${locale}" is missing keys defined in other locales: ${missing.join(
          ', ',
        )}`,
      });
    }
  }

  return errors;
}
