# Answer Piping

key files: `lib/resolve.ts`, `src/components/Label.tsx`

Answer piping lets you interpolate collected data, loop context, and live screen values into any user-visible string prop using `{{ }}` template syntax.

## Token prefixes

| Prefix | Source | Example |
|---|---|---|
| `$$` | `context.data` — experiment-wide collected data | `{{$$welcome.name}}` |
| `$` | `context.screenData` — current screen's live form values | `{{$slider}}` |
| `@` | `context.loopData` — current loop iteration | `{{@loop-sports.value}}`, `{{@loop-sports.index}}` |
| `#` | `context.screenData.foreachData` — current for-each item | `{{#foreach-sport.value}}` |

Keys support dotted paths and hyphens: `{{$$survey.follow-up}}`, `{{$$prayer-frequency}}`.

Unresolvable tokens are left literal — `{{$$missing.key}}` renders as-is, making typos visible during development.

> For **localized static copy** use the separate `[[key]]` dictionary token, not `{{ }}`. It resolves against the active locale's messages and runs before the `{{ }}` pass (so a dictionary message may itself contain `{{ }}`). See [i18n](./i18n.md).
> A `[[ ]]` key may also contain `{{ }}` to compute the key from runtime data (e.g. `[[experience.{{$$screen.drug}}]]`); the inner `{{ }}` resolves before the dictionary lookup. See [i18n](./i18n.md#dynamic-dictionary-keys).

## Supported props

The following props currently support interpolation:

| Prop | Components |
|---|---|
| `label` | all response components, `single-checkbox` |
| `options[].label` | `radio`, `checkboxes`, `dropdown`, `likert-scale` |
| `placeholder` | `text-input`, `text-area`, `numeric-input` |
| `minLabel` / `maxLabel` | `slider` |
| `text` | `button` |
| `content` | `rich-text` |
| `alt` | `image` |
| `url` | `image` (only when interpolated result is `http(s)` or a relative path; unsafe schemes are blocked) |

## How it works

`resolveValuesInString(text, context)` in `lib/resolve.ts` is the single implementation. It applies the regex `/\{\{(\$\$|\$|@|#)([a-zA-Z0-9_.\-]+)\}\}/g` and looks up each token via `getValue(key, context)`.

The `Label` component in `src/components/Label.tsx` calls `resolveValuesInString` before passing text to the markdown renderer, so labels also support inline markdown on top of interpolation.

## Examples

```ts
// Label with loop context
{ label: "How do you feel about {{@loop-1.value}}?" }

// Option label with collected data
{ options: [{ label: "{{$$user.name}}'s pick", value: "a" }] }

// Placeholder with collected name
{ placeholder: "Describe {{$$welcome.name}}'s experience..." }

// Button text with loop item
{ text: "Continue to {{@loop-1.value}}" }
```
