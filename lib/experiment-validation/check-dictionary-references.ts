import { flattenMessages } from '../i18n';
import { DICTIONARY_TOKEN_RE, TEMPLATE_TOKEN_RE } from '../tokens';
import { ExperimentFlow, MessageTree } from '../types';
import { ValidationError } from './types';

// Every [[key]] token found in `text`, in order of appearance (with duplicates).
function extractKeys(text: string): string[] {
  return [...text.matchAll(DICTIONARY_TOKEN_RE)].map((match) => match[1]);
}

// The dotted path of every string leaf in a message tree (with duplicates).
// Two distinct source positions producing the same dotted path — e.g. a flat
// "a.b" key alongside a nested a → b — appear twice here, which flattenMessages
// would otherwise silently resolve last-wins. Duplicates are detected downstream.
function leafPaths(tree: MessageTree, prefix = ''): string[] {
  return Object.entries(tree).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof value === 'string' ? [path] : leafPaths(value, path);
  });
}

// The distinct values that appear more than once in `items`, in first-seen order.
function duplicates(items: string[]): string[] {
  return [...new Set(items.filter((item, i) => items.indexOf(item) !== i))];
}

const REGEX_META_RE = /[.*+?^${}()|[\]\\]/g;
const escapeRegex = (s: string) => s.replace(REGEX_META_RE, '\\$&');

// Builds an anchored matcher for a dynamic dictionary key by replacing each
// {{ }} token with a [\w\-]+ wildcard and escaping the literal segments.
// "experience.{{$$screen.drug}}" → /^experience\.[\w\-]+$/
// Each {{ }} fills exactly one path segment (no dot), so the matcher does not
// accept deeper-nested keys.
//
// This is intentionally stricter than the runtime: resolveMessagesInString would
// happily look up a key whose {{ }} resolved to a dot-containing value (spanning
// segments). We assume single-segment values — the documented advice is to feed
// dynamic keys from constrained sources (fixed option sets, compute outputs). A
// dot-containing value is therefore reported as unknown-dictionary-key rather than
// silently passing; see docs/i18n.md "Dynamic dictionary keys".
function dynamicKeyMatcher(key: string): RegExp {
  let pattern = '';
  let last = 0;
  for (const m of key.matchAll(TEMPLATE_TOKEN_RE)) {
    pattern += escapeRegex(key.slice(last, m.index)) + '[\\w\\-]+';
    last = (m.index ?? 0) + m[0].length;
  }
  pattern += escapeRegex(key.slice(last));
  return new RegExp(`^${pattern}$`);
}

// Validates i18n dictionary usage:
// - unknown-dictionary-key: a [[key]] is referenced (in a component prop or
//   nested inside a message) but defined in no locale.
// - dictionary-locale-mismatch: a key exists in some locales but not others,
//   so the active locale could silently fall back or render literal.
// - unknown-default-locale: `defaultLocale` is set but is not a dictionary key.
// - dictionary-key-collision: a locale defines the same dotted key from both a
//   nested path and a flat key, which flattenMessages resolves last-wins.
export function checkDictionaryReferences(
  flow: ExperimentFlow,
): ValidationError[] {
  const dictionary = flow.dictionary ?? {};
  const locales = Object.keys(dictionary);

  // Flatten each locale's (possibly nested) tree to dotted keys once, up front.
  const flatByLocale: Record<string, Record<string, string>> =
    Object.fromEntries(
      locales.map((locale) => [locale, flattenMessages(dictionary[locale])]),
    );

  // Collisions: the same dotted key reached via both a nested path and a flat
  // key. flattenMessages collapses these last-wins, so we inspect raw leaves.
  const collisionErrors: ValidationError[] = locales.flatMap((locale) => {
    const collisions = duplicates(leafPaths(dictionary[locale]));
    return collisions.length === 0
      ? []
      : [
          {
            code: 'dictionary-key-collision',
            category: 'reference',
            message: `Locale "${locale}" defines the same dotted key from both a nested path and a flat key: ${collisions.join(
              ', ',
            )}`,
          },
        ];
  });

  // Keys referenced by component props (any string prop) plus shared-option
  // labels and keys referenced from within dictionary messages themselves
  // (nested [[ ]]). Both `screens` and `options` are scanned because [[ ]] is
  // resolved wherever resolveValuesInString runs — component rendering and
  // shared-option labels (resolveOptionsSource → Label). Node props are NOT
  // scanned: they never pass through resolveValuesInString, and scanning them
  // would risk false positives on literal bracketed text in node names.
  //
  // TODO: only scan props that actually support dictionary references, rather
  // than any string prop. The current approach is simpler but risks false
  // positives on literal bracketed text in props that do not support [[ ]].
  const referenced = new Set([
    ...extractKeys(JSON.stringify(flow.screens ?? [])),
    ...extractKeys(JSON.stringify(flow.options ?? {})),
    ...locales.flatMap((locale) =>
      Object.values(flatByLocale[locale]).flatMap(extractKeys),
    ),
  ]);

  // Defined keys, per locale and unioned.
  const keysByLocale: Record<string, Set<string>> = Object.fromEntries(
    locales.map((locale) => [locale, new Set(Object.keys(flatByLocale[locale]))]),
  );
  const allKeys = new Set(
    locales.flatMap((locale) => Object.keys(flatByLocale[locale])),
  );

  const defaultLocaleErrors: ValidationError[] =
    flow.defaultLocale && !locales.includes(flow.defaultLocale)
      ? [
          {
            code: 'unknown-default-locale',
            category: 'reference',
            message: `defaultLocale "${flow.defaultLocale}" is not a key of the dictionary (locales: ${
              locales.join(', ') || 'none'
            })`,
          },
        ]
      : [];

  const refs = [...referenced];
  const allKeysList = [...allKeys];

  const unknownStaticErrors: ValidationError[] = refs
    .filter((key) => !key.includes('{{') && !allKeys.has(key))
    .map((key) => ({
      code: 'unknown-dictionary-key',
      category: 'reference',
      message: `Dictionary reference [[${key}]] is not defined in any locale`,
    }));

  const unknownDynamicErrors: ValidationError[] = refs
    .filter((key) => key.includes('{{'))
    .filter((key) => {
      const matcher = dynamicKeyMatcher(key);
      return !allKeysList.some((defined) => matcher.test(defined));
    })
    .map((key) => {
      const stem = key.slice(0, key.indexOf('{{'));
      return {
        code: 'unknown-dictionary-key',
        category: 'reference',
        message: `Dictionary reference [[${key}]] matches no defined key (stem "${stem}")`,
      };
    });

  const mismatchErrors: ValidationError[] = locales.flatMap((locale) => {
    const missing = [...allKeys].filter((key) => !keysByLocale[locale].has(key));
    return missing.length === 0
      ? []
      : [
          {
            code: 'dictionary-locale-mismatch',
            category: 'reference',
            severity: 'warning',
            message: `Locale "${locale}" is missing keys defined in other locales: ${missing.join(
              ', ',
            )}`,
          },
        ];
  });

  return [
    ...collisionErrors,
    ...defaultLocaleErrors,
    ...unknownStaticErrors,
    ...unknownDynamicErrors,
    ...mismatchErrors,
  ];
}
