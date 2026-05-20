# Option Anchoring

key files (proposed): `lib/components/response.ts`, `lib/utils.ts`, `lib/flow.ts`

Some options must stay at a fixed position regardless of randomization — "Other (please specify)" must stay last, "None of the above" must stay last, "All of the above" must stay first. This proposal adds an `anchor` property to the `Option` type that pins an option to the beginning or end of the list even when `randomize: true`.

## The problem

The current `shuffle()` function treats all options equally. There is no way to express that a particular option should survive randomization at a fixed position. Workarounds (putting the pinned option in a separate non-randomized field, or omitting randomization entirely) are semantically incorrect and force authors to restructure their experiment.

## Proposed change

### 1. Extend the `Option` type

```ts
// lib/components/response.ts
export type Option = {
  label: string;
  value: string;
  anchor?: "first" | "last";
};
```

`anchor` is optional. Options without it behave exactly as today.

### 2. Add a stable-sort shuffle utility

```ts
// lib/utils.ts
export function shuffleAnchored<T extends { anchor?: "first" | "last" }>(
  array: T[]
): T[] {
  const firsts = array.filter((o) => o.anchor === "first");
  const lasts  = array.filter((o) => o.anchor === "last");
  const middle = array.filter((o) => !o.anchor);

  return [...firsts, ...shuffle(middle), ...lasts];
}
```

`firsts` and `lasts` preserve their relative declaration order among themselves (useful when multiple "always-first" options exist, e.g., a header-like option plus a specific one). `shuffle()` remains unchanged and can still be used for fully-unanchored lists.

### 3. Use `shuffleAnchored` in `computeShuffledOptions`

```ts
// lib/flow.ts  (inside computeShuffledOptions)
// before:
context.screenData.shuffledOptions[dataKey] = shuffle(options);

// after:
context.screenData.shuffledOptions[dataKey] = shuffleAnchored(options);
```

No other call sites need to change — the rest of the resolution pipeline (primitives.tsx, resolve.ts) is unaware of anchoring.

---

## Usage

```ts
// direct options array
{
  type: "checkboxes",
  dataKey: "topics",
  randomize: true,
  options: [
    { label: "Politics",           value: "politics" },
    { label: "Sports",             value: "sports" },
    { label: "Science",            value: "science" },
    { label: "None of the above",  value: "none",  anchor: "last" },
    { label: "Other",              value: "other", anchor: "last" },
  ],
}
```

After shuffling, "None of the above" always appears before "Other" (their relative order is preserved), while the other three options are randomized among themselves.

### Shared options

`anchor` works identically when options come from a shared options reference (`%name`) because `resolveOptionsSource` returns a plain `Option[]` — anchoring is applied at shuffle time, not at resolution time.

---

## Multiple anchors at the same end

When more than one option has `anchor: "last"`, they appear in the order they were declared:

```ts
options: [
  { label: "Option A", value: "a" },
  { label: "Option B", value: "b" },
  { label: "None of the above", value: "none", anchor: "last" },
  { label: "Other",             value: "other", anchor: "last" },
]
// rendered: [shuffled(A, B), None of the above, Other]
```

This is deterministic and predictable without needing a numeric `order` field.

---

## What does NOT change

| Thing | Status |
|---|---|
| `Option` without `anchor` | Unchanged behavior |
| `shuffle()` utility | Unchanged — still used for fully-unanchored arrays |
| `reshuffleInLoop` logic | Unchanged — anchoring is applied inside the shuffle step |
| Likert scale | No change — `LikertOption` is a separate type and is never randomized |
| Validation / Zod schema | No change — `anchor` is a display-time concern only |
| Response values / data collection | No change — `value` is what gets stored, not `anchor` |

---

## Files to touch

| File | Change |
|---|---|
| `lib/components/response.ts` | Add `anchor?: "first" \| "last"` to `Option` |
| `lib/utils.ts` | Add `shuffleAnchored()` next to `shuffle()` |
| `lib/flow.ts` | Replace `shuffle(options)` with `shuffleAnchored(options)` inside `computeShuffledOptions` |

Three files, minimal surface area. No schema migrations, no context shape changes, no breaking changes to existing experiments.
