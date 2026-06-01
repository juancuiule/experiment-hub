import { ExperimentFlow, MessageTree } from './types';

// Query-string key used to request a locale at runtime, e.g. ?lang=es.
export const LOCALE_PARAM = 'lang';

// Flattens a (possibly nested) message tree into dotted keys:
// { welcome: { title: "x" } } → { "welcome.title": "x" }. String leaves with
// already-dotted keys pass through unchanged, so flat and nested forms mix.
export function flattenMessages(
  tree: MessageTree,
  prefix = '',
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') {
      out[path] = value;
    } else {
      Object.assign(out, flattenMessages(value, path));
    }
  }
  return out;
}

// Returns the locale used as the fallback source: the experiment's
// `defaultLocale` when it is a key of the dictionary, otherwise the first
// declared locale. Returns undefined when there is no dictionary.
export function defaultLocaleOf(experiment: ExperimentFlow): string | undefined {
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
  const fallbackLocale = defaultLocaleOf(experiment);
  const fallback =
    fallbackLocale && fallbackLocale !== locale
      ? flattenMessages(dictionary[fallbackLocale])
      : undefined;
  return { ...fallback, ...flattenMessages(dictionary[locale]) };
}
