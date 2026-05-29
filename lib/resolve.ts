import {
  LikertOption,
  LikertOptionsSource,
  Option,
  OptionsSource,
} from './components/response';
import {
  FULL_REF_WITH_NESTED_RE,
  TEMPLATE_TOKEN_RE,
} from './tokens';
import { Context } from './types';

type Prefix = '$$' | '@' | '$' | '#';

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
  return text.replace(TEMPLATE_TOKEN_RE, (match, prefix: Prefix, path: string) => {
    const resolved = getValue(`${prefix}${path}`, context, _depth + 1);
    return resolved != null ? String(resolved) : match;
  });
}

export function getPrefixAndPath(
  text: string,
): { prefix: Prefix; path: string } | null {
  const match = text.match(FULL_REF_WITH_NESTED_RE);
  if (match) {
    const [, prefix, path] = match;
    return { prefix: prefix as Prefix, path };
  }
  return null;
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
  const { prefix, path } = getPrefixAndPath(resolvedKey) || {};
  if (!prefix || !path) {
    throw new Error(`Invalid key format: ${key}`);
  }

  switch (prefix) {
    case '$': {
      return getPath(path, screenData ?? {});
    }
    case '$$': {
      return getPath(path, data);
    }
    case '@': {
      return getPath(path, loopData);
    }
    case '#': {
      return getPath(path, screenData?.foreachData || {});
    }
  }

  throw new Error(`Invalid prefix: ${prefix}`);
}
