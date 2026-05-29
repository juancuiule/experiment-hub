// Reference prefix alternation. $$ must precede $ in every alternation so
// "$$foo" always matches the $$ prefix rather than $ followed by "$foo".

// Matches {{prefix+path}} where path may include one level of nested {{…}}
// tokens. Captures: [1] prefix, [2] path (possibly containing {{…}} segments).
// Safe to share: String.prototype.replace() collects all matches before invoking
// callbacks, so nested calls from within a replacer do not corrupt lastIndex.
export const TEMPLATE_TOKEN_RE =
  /\{\{(\$\$|\$|@|#)((?:[\w.\-]|\{\{(?:\$\$|\$|@|#)[\w.\-]+\}\})+)\}\}/g;

// Matches a complete reference string whose path may contain nested {{…}} tokens.
// Captures: [1] prefix, [2] path. Used by getPrefixAndPath.
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
