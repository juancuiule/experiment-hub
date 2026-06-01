import { flattenMessages } from '../i18n';
import { DICTIONARY_TOKEN_RE } from '../tokens';
import { ExperimentFlow, MessageTree } from '../types';
import { ValidationError } from './types';

// Collects every [[key]] token found in `text` into `into`.
function collectKeys(text: string, into: Set<string>): void {
  for (const match of text.matchAll(DICTIONARY_TOKEN_RE)) into.add(match[1]);
}

// Walks a message tree, pushing the dotted path of every string leaf into
// `into` (with duplicates). Two distinct source positions producing the same
// dotted path — e.g. a flat "a.b" key alongside a nested a → b — appear as a
// duplicate, which flattenMessages would otherwise silently resolve last-wins.
function collectLeafPaths(
  tree: MessageTree,
  prefix: string,
  into: string[],
): void {
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') into.push(path);
    else collectLeafPaths(value, path, into);
  }
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
  // Detect collisions first: a flat "a.b" key and a nested a → b both produce
  // the dotted key "a.b", which flattenMessages resolves last-wins silently.
  const flatByLocale = new Map<string, Record<string, string>>();
  for (const locale of locales) {
    const leaves: string[] = [];
    collectLeafPaths(dictionary[locale], '', leaves);
    const seen = new Set<string>();
    const collisions = new Set<string>();
    for (const path of leaves) {
      if (seen.has(path)) collisions.add(path);
      seen.add(path);
    }
    if (collisions.size > 0) {
      errors.push({
        code: 'dictionary-key-collision',
        category: 'reference',
        message: `Locale "${locale}" defines the same dotted key from both a nested path and a flat key: ${[
          ...collisions,
        ].join(', ')}`,
      });
    }
    flatByLocale.set(locale, flattenMessages(dictionary[locale]));
  }

  // Keys referenced by component props (any string prop) plus keys referenced
  // from within dictionary messages themselves (nested [[ ]]). Only `screens`
  // are scanned because [[ ]] is resolved exclusively where resolveValuesInString
  // runs — component rendering — never from node props; scanning nodes would
  // risk false positives on literal bracketed text in branch/checkpoint names.
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
