import { ExperimentFlow, MessageTree } from './types';

// Query-string key used to request a locale at runtime, e.g. ?lang=es.
export const LOCALE_PARAM = 'lang';

// Flattens a (possibly nested) message tree into dotted keys:
// { welcome: { title: "x" } } → { "welcome.title": "x" }. String leaves with
// already-dotted keys pass through unchanged, so flat and nested forms mix.
//
// The result has a null prototype. Message keys are author-controlled and may
// collide with Object.prototype members (toString, constructor, __proto__).
// On an ordinary object, a lookup of an *undefined* such key returns the
// inherited member (e.g. messages["toString"] → a function), which downstream
// lookups would mistake for a present message. A null prototype makes every
// unmapped key read as undefined. (Object.fromEntries uses defineProperty
// semantics, so a literal "__proto__" key is a normal own property, not
// prototype mutation — this guards lookups, not pollution.)
export function flattenMessages(
  tree: MessageTree,
  prefix = '',
): Record<string, string> {
  return Object.assign(
    Object.create(null) as Record<string, string>,
    Object.fromEntries(
      Object.entries(tree).flatMap(([key, value]) => {
        const path = prefix ? `${prefix}.${key}` : key;
        return typeof value === 'string'
          ? [[path, value] as const]
          : Object.entries(flattenMessages(value, path));
      }),
    ),
  );
}

// Returns the locale used as the fallback source: the experiment's
// `defaultLocale` when it is a key of the dictionary, otherwise the first
// declared locale. Returns undefined when there is no dictionary.
export function defaultLocaleOf(
  experiment: ExperimentFlow,
): string | undefined {
  const locales = Object.keys(experiment.dictionary ?? {});
  if (locales.length === 0) return undefined;
  const { defaultLocale } = experiment;
  if (defaultLocale && locales.includes(defaultLocale)) return defaultLocale;
  return locales[0];
}

// Picks the active locale for a run. Prefers the ?lang= query param when it
// names a defined locale; otherwise falls back to the experiment default.
// Returns undefined for experiments without a dictionary.
export function selectLocale(
  params: Record<string, string | string[] | undefined>,
  experiment: ExperimentFlow,
): string | undefined {
  const locales = Object.keys(experiment.dictionary ?? {});
  if (locales.length === 0) return undefined;
  const requested = params[LOCALE_PARAM];
  if (typeof requested === 'string' && locales.includes(requested)) {
    return requested;
  }
  return defaultLocaleOf(experiment);
}

// Flattens the active locale's messages with default-locale messages merged
// underneath, so keys missing in the active locale fall back to the default.
// Returns undefined when there is no dictionary or no locale.
export function buildMessages(
  experiment: ExperimentFlow,
  locale: string | undefined,
): Record<string, string> | undefined {
  const { dictionary } = experiment;
  if (!dictionary || !locale) return undefined;

  const active = dictionary[locale] ?? {};
  if (!dictionary[locale]) {
    console.warn(
      `Locale "${locale}" not found in dictionary; falling back to default locale for any missing keys.`,
    );
  }

  const fallbackLocale = defaultLocaleOf(experiment);
  const fallback =
    fallbackLocale && fallbackLocale !== locale
      ? flattenMessages(dictionary[fallbackLocale])
      : undefined;
  // Compose onto a null prototype: spreading into `{}` would re-inherit
  // Object.prototype, reviving the unmapped-builtin-key lookup hazard that
  // flattenMessages avoids. This object becomes context.messages.
  return Object.assign(
    Object.create(null) as Record<string, string>,
    fallback ?? {},
    flattenMessages(active),
  );
}
