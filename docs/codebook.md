# Codebook / Data Dictionary

key files: `lib/codebook/`, `app/experiments/[slug]/codebook/page.tsx`,
`src/codebook/CodebookView.tsx`

The codebook is **derived from the typed `ExperimentFlow`** — no separate
maintenance. It documents every variable an experiment can produce so an analyst
can map exported columns to their meaning, type, options, and provenance.

## Getting a codebook

- **In-app:** visit `/experiments/<slug>/codebook` — a table view with
  download/copy buttons for Markdown, CSV, and JSON.
- **Programmatically:** `generateCodebook(experiment, slug?)` in `lib/codebook`
  returns the structured `Codebook`; `toMarkdown` / `toCsv` / `toJson` render it.

```ts
import { generateCodebook, toMarkdown } from '@/lib/codebook';
const codebook = generateCodebook(EXPERIMENTS['my-study'], 'my-study');
const md = toMarkdown(codebook);
```

## Sections

| Section | Contents |
|---|---|
| **collected** | Participant-produced fields: response components, button payloads, and `:order` companions of randomized option lists. |
| **derived** | Compute-node outputs (one per `computations[].outputKey`), labelled `compute:<formula>`. |
| **system** | Engine metadata that lands in the export: per-screen timings, assignment group (when >1 start node), branch/fork choices, randomized path/loop order, and checkpoint timestamps. |

## How variables are identified

Each variable's `key` is the **full graph-aware data path** matching the export
column. A static walk from the start nodes accumulates the `dataPath` prefix the
engine nests data under: a screen inside path `p` and loop `l` produces keys like
`l.<iter>.p.<screen>.<field>`. A screen reached at multiple graph positions
yields **distinct entries**.

The walk follows **all** branch arms and fork outcomes (any participant could
take any of them) and **enumerates static loop iterations** into concrete rows;
unreachable nodes are excluded.

## Dynamic (runtime-cardinality) variables

A field whose column count depends on runtime data — a **dynamic for-each** or a
**dynamic loop** — is shown as a single **template row**: the key keeps its
`{{…}}`/`<iter>` template, and `repetition` is
`{ kind: 'dynamic', over: <source array>, loopIds: [...] }` (rendered as
`per $$source`). Statically-known repetition shows as `×N`.

## Per-variable metadata

`type` (string/number/boolean/enum/enum[]/date/time/string[]/unknown),
`template` (the response template or `compute:*`/`system:*`), raw `label`
(interpolation tokens left **unresolved** — the codebook documents the template,
not one participant's text), `options` (inline `{value,label}[]` or a
`{ ref }` for `%shared`/`$$dynamic` sources), `required`, `constraints`
(min/max/length/pattern/select bounds/shouldBe), `conditional` (a human-readable
visibility condition), `screen`, and `nodePath`.

## Module layout

```
lib/codebook/
  types.ts      # Codebook, CodebookVariable, Repetition, FieldType
  describe.ts   # describeField() + conditionToText()
  walk.ts       # walkExperiment() — static graph walk with dataPath
  generate.ts   # generateCodebook() — orchestrates walk + collectFields + describe
  render/       # markdown.ts, csv.ts, json.ts (+ shared format.ts)
```

`walk.ts` reuses `lib/flow/graph.ts` helpers; per-screen field extraction reuses
`collectFields` (so for-each unrolling and `:order` companions come for free);
`describe.ts` parallels `field-schema.ts`'s type/constraint logic. The `lib/`
layer is React-free and unit-tested under `lib/specs/codebook/`.

## Not covered (v1)

- Labels/options are shown raw; `[[ ]]`/`{{ }}` are not resolved for a locale.
- Dynamic columns are described, not enumerated against real data.
