/**
 * All reference prefix tokens used in experiment definitions.
 *
 * These appear as the leading character(s) of bare keys in formula inputs,
 * condition dataKeys, and loop/forEach sources — and as the first segment
 * inside {{…}} template tokens in component props.
 *
 *   DATA    $$ → context.data => (collected by earlier screens / computes)
 *   SCREEN  $  → context.screenData => (current screen / compute node outputs)
 *   LOOP    @  → context.loopData => (current loop iteration .value / .index)
 *   FOREACH #  → context.screenData.foreachData => (current for-each component .value / .index)
 *   SHARED  %  → ExperimentFlow.options => (named shared option sets — not a template ref)
 */
export const PREFIX = {
  DATA: '$$' as const,
  SCREEN: '$' as const,
  LOOP: '@' as const,
  FOREACH: '#' as const,
  SHARED: '%' as const,
} as const;

// The four prefixes that appear in {{…}} template tokens and bare reference
// strings. SHARED (%) names option sets, not runtime data — excluded here.
export type RefPrefix =
  | typeof PREFIX.DATA
  | typeof PREFIX.SCREEN
  | typeof PREFIX.LOOP
  | typeof PREFIX.FOREACH;

// A parsed bare reference: prefix identifies the data source, path is passed
// to getPath() for property traversal.
export type ParsedRef = { prefix: RefPrefix; path: string };

// — Parsing helpers —

// Parse a bare reference string (e.g. "$$screen.field" or "@loop.value").
// Returns null when text is not a valid bare reference.
export function parseRef(text: string): ParsedRef | null {
  const m = text.match(BARE_REF_RE);
  if (!m) return null;
  return { prefix: m[1] as RefPrefix, path: m[2] };
}

// Parse a reference string whose path may contain nested {{…}} tokens
// (e.g. "$$loop.{{#forEach.index}}.answer"). Returns null when text is not
// a valid reference.
export function parseRefWithNested(text: string): ParsedRef | null {
  const m = text.match(FULL_REF_WITH_NESTED_RE);
  if (!m) return null;
  return { prefix: m[1] as RefPrefix, path: m[2] };
}

// — Regex patterns —

// Matches {{prefix+path}} where path may include one level of nested {{…}}
// tokens. Captures: [1] prefix, [2] path (possibly containing {{…}} segments).
// Safe to share: String.prototype.replace() collects all matches before invoking
// callbacks, so nested calls from within a replacer do not corrupt lastIndex.
export const TEMPLATE_TOKEN_RE =
  /\{\{(\$\$|\$|@|#)((?:[\w.\-]|\{\{(?:\$\$|\$|@|#)[\w.\-]+\}\})+)\}\}/g;

// Matches a complete reference string whose path may contain nested {{…}} tokens.
// Captures: [1] prefix, [2] path. Used by parseRefWithNested.
export const FULL_REF_WITH_NESTED_RE =
  /^(\$\$|\$|@|#)((?:[\w.\-]|\{\{(?:\$\$|\$|@|#)[\w.\-]+\}\})+)$/;

// Tests whether a string starts with a reference prefix. Captures: [1] prefix.
export const STARTS_WITH_PREFIX_RE = /^(\$\$|\$|@|#)/;

// Matches a complete bare reference string (no braces). Captures: [1] prefix, [2] path.
export const BARE_REF_RE = /^(\$\$|\$|@|#)([\w.\-]+)$/;

// Tests whether text contains at least one wrapped {{prefix+path}} token.
// Matches simple (non-nested) tokens; nested tokens contain inner simple tokens
// so this test returns true for nested template strings as well.
export const HAS_WRAPPED_TOKEN_RE = /\{\{(?:\$\$|\$|@|#)[\w.\-]+\}\}/;

// Tests whether the entire string is a bare reference (no braces).
export const IS_BARE_REF_RE = /^(?:\$\$|\$|@|#)[\w.\-]+$/;

// Finds bare $$ patterns (no surrounding braces). Used for unwrapped-token detection.
export const BARE_DOUBLE_DOLLAR_RE = /\$\$([\w.\-]+)/g;
