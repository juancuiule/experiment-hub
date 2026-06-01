import {
  LikertOption,
  LikertOptionsSource,
  Option,
  OptionsSource,
} from './components/response';
import {
  DICTIONARY_TOKEN_RE,
  PREFIX,
  ParsedRef,
  RefPrefix,
  TEMPLATE_TOKEN_RE,
  parseRefWithNested,
} from './tokens';
import { Context } from './types';

/*
template syntax:
all of this between {{ and }} will be replaced with the value of the key in the context

- $$ => context.data
        example: {{$$user.name}} => context.data.user.name
-  $ => context.screenData
        example: {{$slider}} => context.screenData.slider
-  @ => context.loopData
        example: {{@loopSports.value}} => context.loopData.loopSports.value
-  # => context.screenData.foreachData
        example: {{#foreachSport.value}} => context.screenData.foreachData.foreachSport.value
*/
export function resolveValuesInString(
  text: string,
  context: Context,
  _depth = 0,
): string {
  if (_depth > 10) return text;
  // Dictionary ([[key]]) pass runs first so that a resolved message may itself
  // contain {{ }} answer-piping tokens, which the subsequent pass resolves.
  const withMessages = resolveMessagesInString(text, context, _depth);
  return withMessages.replace(
    TEMPLATE_TOKEN_RE,
    (match, prefix: RefPrefix, path: string) => {
      const resolved = getValue(`${prefix}${path}`, context, _depth + 1);
      return resolved != null ? String(resolved) : match;
    },
  );
}

// Replaces [[key]] tokens with the active locale's message (default-locale
// fallback is already merged into context.messages by the runtime). Missing
// keys are left literal so typos are visible during development. Nested [[ ]]
// inside a message are resolved recursively under the shared depth guard.
function resolveMessagesInString(
  text: string,
  context: Context,
  _depth = 0,
): string {
  const messages = context.messages;
  if (!messages || _depth > 10) return text;
  return text.replace(DICTIONARY_TOKEN_RE, (match, key: string) => {
    const message = messages[key];
    if (message == null) return match;
    return resolveMessagesInString(message, context, _depth + 1);
  });
}

export function getPrefixAndPath(text: string): ParsedRef | null {
  return parseRefWithNested(text);
}

export function getPath(text: string, record: Record<string, any>): any {
  return text
    .split('.')
    .reduce((obj, key) => (obj == null ? undefined : obj[key]), record);
}

export function resolveOptionsSource(
  options: OptionsSource,
  context: Context,
  sharedOptions?: Record<string, Option[]>,
): Option[] {
  if (Array.isArray(options)) return options;
  if (options.startsWith('%')) {
    const name = options.slice(1);
    const key = resolveValuesInString(name, context);
    return sharedOptions?.[key] ?? [];
  }
  const value = getValue(options, context);
  if (!Array.isArray(value)) return [];
  return value.map((item: unknown) =>
    typeof item === 'string' ? { label: item, value: item } : (item as Option),
  );
}

// Resolves the option list for a response component, preferring pre-shuffled
// options stored in the screen context (keyed by dataKey) over re-resolving
// from the source. This preserves shuffle order across re-renders.
export function resolveOptions(
  options: OptionsSource,
  context: Context,
  dataKey?: string,
  sharedOptions?: Record<string, Option[]>,
): Option[] {
  if (dataKey && context.screenData?.shuffledOptions?.[dataKey]) {
    return context.screenData.shuffledOptions[dataKey] as Option[];
  }
  return resolveOptionsSource(options, context, sharedOptions);
}

export function resolveLikertOptionsSource(
  options: LikertOptionsSource,
  sharedOptions?: Record<string, Option[]>,
): LikertOption[] {
  if (Array.isArray(options)) return options;
  const name = options.slice(1);
  return sharedOptions?.[name] ?? [];
}

export function resolveInterpolatedImageUrl(
  template: string,
  context: Context,
): string | null {
  const resolved = resolveValuesInString(template, context).trim();
  if (!resolved || resolved.startsWith('//')) return null;
  if (
    resolved.startsWith('/') ||
    resolved.startsWith('./') ||
    resolved.startsWith('../')
  ) {
    return resolved;
  }
  try {
    const parsed = new URL(resolved);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
      ? resolved
      : null;
  } catch {
    return null;
  }
}

export function getValue(key: string, context: Context, _depth = 0) {
  const { data = {}, screenData, loopData = {} } = context;

  const resolvedKey = resolveValuesInString(key, context, _depth);
  const ref = getPrefixAndPath(resolvedKey);
  if (!ref) throw new Error(`Invalid key format: ${key}`);

  switch (ref.prefix) {
    case PREFIX.SCREEN:
      return getPath(ref.path, screenData ?? {});
    case PREFIX.DATA:
      return getPath(ref.path, data);
    case PREFIX.LOOP:
      return getPath(ref.path, loopData);
    case PREFIX.FOREACH:
      return getPath(ref.path, screenData?.foreachData || {});
  }
}
