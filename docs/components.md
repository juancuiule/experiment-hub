# Components

key files: `lib/components/index.ts`, `lib/components/content.ts`, `lib/components/response.ts`, `lib/components/layout.ts`, `lib/components/control.ts`

Components are the building blocks of screens. Each screen contains an ordered list of `ScreenComponent`s that are rendered in sequence to the participant.

All components share a base structure:

- `id?`: optional string identifier for the component
- `componentFamily`: the family the component belongs to (`content`, `response`, `layout`, or `control`)
- `template`: the specific component type within its family

There are four component families: `content`, `response`, `layout`, and `control`.

## Content Components

Content components display information to the participant. They have no data collection and produce no output.

### `rich-text`

- `content: string` — HTML/markdown content to render

### `image`

- `url: string` — URL of the image
- `alt: string` — alternative text for the image

Both `url` and `alt` support answer piping interpolation. For security, interpolated `url` values are only allowed when they resolve to `http(s)` URLs or relative paths (`/`, `./`, `../`).

### `video`

- `url: string` — URL of the video
- `autoplay?: boolean` — whether the video should autoplay on render
- `muted?: boolean` — whether the video should be muted
- `loop?: boolean` — whether the video should loop when it ends
- `controls?: boolean` — whether to show playback controls to the participant

### `audio`

- `url: string` — URL of the audio file
- `autoplay?: boolean` — whether the audio should autoplay on render
- `loop?: boolean` — whether the audio should loop when it ends
- `controls?: boolean` — whether to show playback controls to the participant

## Response Components

Response components collect data from the participant. All response components share these base props in addition to their own:

- `dataKey: string` — the key under which the collected value will be stored
- `required?: boolean` — whether the field must be filled before advancing
- `errorMessage?: string` — fallback error message shown when `required` is not met. Individual validation rules (e.g. `minLength`, `pattern`) each carry their own `errorMessage` and take precedence over this one.

### `slider`

Collects a numeric value within a range.

- `label: string`
- `min?: number`
- `max?: number`
- `step?: number`
- `defaultValue?: number` — sets the visual starting position of the thumb; does **not** pre-fill the form value. The participant must still move the slider for a value to be submitted.
- `minLabel?: string` — label shown at the minimum end
- `maxLabel?: string` — label shown at the maximum end
- `showValue?: boolean` — whether to display the current numeric value once the participant has interacted
- `tooltip?: true | { prefix?: string; suffix?: string }` — shows the current value in a tooltip above the slider thumb. Pass `true` for a plain numeric tooltip, or an object to add a `prefix` and/or `suffix` (e.g. `{ suffix: "%" }` renders `"42%"`).

Validation (each with its own `errorMessage`):
- `required?: boolean` — when `true`, the participant must actively move the slider before advancing (null check). This is the standard `required` behaviour: "filled" for a slider means "interacted with".
- `minValue?: { value: number; errorMessage?: string }` — the selected value must be at or above this threshold
- `maxValue?: { value: number; errorMessage?: string }` — the selected value must be at or below this threshold

Collected value: `number | null` (null when the participant has not yet moved the slider)

### `range-slider`

Collects a numeric range via a two-handle drag slider. The participant drags a lower and upper thumb to define a `[lowerBound, upperBound]` interval. Like `slider`, an untouched range slider collects `null`, so `required` means "the participant must have moved at least one handle."

- `label: string`
- `min?: number`
- `max?: number`
- `step?: number`
- `defaultValue?: [number, number]` — sets the visual starting positions of the two thumbs; does **not** pre-fill the form value. The participant must still interact for a value to be submitted.
- `minLabel?: string` — label shown at the minimum end
- `maxLabel?: string` — label shown at the maximum end
- `showValue?: boolean` — whether to display the current `lowerBound – upperBound` values once the participant has interacted

Validation:
- `required?: boolean` — when `true`, the participant must interact with the slider before advancing (null check)

Collected value: `[number, number] | null` — `[lowerBound, upperBound]` where `lowerBound ≤ upperBound`. Null when the participant has not yet moved the slider.

### `single-checkbox`

Collects a boolean value from a single checkbox.

- `label: string`
- `defaultValue: boolean`
- `shouldBe?: boolean` — if set, validation will require the value to match this boolean (useful for consent checkboxes)

Collected value: `boolean`

### `text-input`

Collects a single line of free-form text.

- `label: string`
- `placeholder?: string`

Validation (each with its own `errorMessage`):
- `minLength?: { value: number; errorMessage?: string }`
- `maxLength?: { value: number; errorMessage?: string }`
- `pattern?: { value: string; errorMessage?: string }` — a regex pattern the input must match

Collected value: `string`

### `text-area`

Collects a multi-line free-form text response. Use instead of `text-input` when longer answers are expected.

- `label: string`
- `placeholder?: string`
- `lines?: number` — the number of visible lines (controls the initial height of the textarea)

Validation (each with its own `errorMessage`):
- `minLength?: { value: number; errorMessage?: string }`
- `maxLength?: { value: number; errorMessage?: string }` — when set, a character counter is shown to the participant
- `pattern?: { value: string; errorMessage?: string }` — a regex pattern the input must match

Collected value: `string`

### `date-input`

Collects a date.

- `label: string`

Collected value: `string`

### `time-input`

Collects a time.

- `label: string`

Collected value: `string`

### `dropdown`

Collects a single selection from a dropdown list.

- `label: string`
- `options: OptionsSource` — the option list. Accepts:
  - `Option[]` — explicit array of `{ label: string; value: string; anchor?: "first" | "last"; tooltip?: string }` objects. When `tooltip` is set on an individual option, an info icon is shown next to the option label; hovering it reveals the tooltip text.
  - `` `$$screen.dataKey` `` — reference to experiment-wide collected data (must be an array of options)
  - `` `@field` `` — field from the current loop iteration value
  - `` `$field` `` — current screen's live form value
  - `` `%name` `` — named shared option set defined in `ExperimentFlow.options`
- `randomize?: boolean` — if true, the order of options is shuffled for each participant.
- `reshuffleInLoop?: boolean` — when used inside a loop and `randomize: true`, controls whether the options are reshuffled on each loop iteration (`true`, default) or keep the first shuffled order (`false`).

**Anchoring options** (`anchor` field on `Option`): When `randomize: true`, individual options can be pinned to a fixed position using `anchor`:
- `anchor: "last"` — the option always appears at the end of the list (e.g. "None of the above", "Other")
- `anchor: "first"` — the option always appears at the beginning (e.g. "All of the above")
- When multiple options share the same anchor direction, they appear in their declaration order relative to each other. Only the unanchored options are shuffled.

Collected value: `string` — the `value` of the selected option, stored directly under the `dataKey`. Reference as `$$screenSlug.dataKey` in branch conditions and answer piping. When `randomize: true`, the shuffled option order is stored as a parallel key `dataKey:order` (e.g. `pick:order`) containing a `string[]` of values in the displayed order.

### `radio`

Collects a single selection displayed as a radio button list.

- `label: string`
- `options: OptionsSource` — the option list. Accepts the same variants as `dropdown` above, including `anchor` and `tooltip` on individual `Option` objects.
- `randomize?: boolean` — if true, the order of options is shuffled for each participant.
- `reshuffleInLoop?: boolean` — when used inside a loop and `randomize: true`, controls whether the options are reshuffled on each loop iteration (`true`, default) or keep the first shuffled order (`false`).

Collected value: `string` — the `value` of the selected option. Reference as `$$screenSlug.dataKey`. When `randomize: true`, the shuffled order is stored as `dataKey:order`.

### `checkboxes`

Collects one or more selections from a list of checkboxes.

- `label: string`
- `options: OptionsSource` — the option list. Accepts the same variants as `dropdown` above, including `anchor` and `tooltip` on individual `Option` objects.
- `min?: number` — minimum number of options that must be selected
- `max?: number` — maximum number of options that can be selected
- `randomize?: boolean` — if true, the order of options is shuffled for each participant.
- `reshuffleInLoop?: boolean` — when used inside a loop and `randomize: true`, controls whether the options are reshuffled on each loop iteration (`true`, default) or keep the first shuffled order (`false`).

Collected value: `string[]` — array of selected option values. Reference as `$$screenSlug.dataKey`. When `randomize: true`, the shuffled order is stored as `dataKey:order`.

### `numeric-input`

Collects a numeric value via a typed input field. Unlike `slider`, this does not constrain the interaction to a drag gesture and is better suited when the participant needs to enter a precise value.

- `label: string`
- `placeholder?: string`
- `min?: number` — minimum allowed value
- `max?: number` — maximum allowed value
- `step?: number` — increment step for browser controls
- `defaultValue?: number`

Collected value: `number`

### `likert-scale`

Collects a response on a symmetric agree/disagree or frequency scale. Replaces the `rating` component with a more flexible and semantically accurate structure for psychometric measurements.

- `label: string` — the question or statement being rated
- `options: LikertOptionsSource` — the scale points. Accepts:
  - `LikertOption[]` — explicit ordered array, each as `{ value: string; label?: string }`. The researcher defines all points explicitly, allowing asymmetric, custom-labeled, or numeric scales of any length.
  - `` `%name` `` — named shared option set defined in `ExperimentFlow.options` (must contain `LikertOption` objects)

The `options` array determines the scale length and labels entirely. A 5-point Likert scale would have 5 items, a 7-point would have 7, etc. There is no enforced symmetry — the researcher is responsible for defining a meaningful scale.

Collected value: `string` (the `value` of the selected option)

## Layout Components

Layout components control the structure and navigation of a screen.

### `button`

Advances the screen when clicked.

- `text?: string` — button label
- `disabled?: boolean`
- `alignBottom?: boolean` — pins the button to the bottom of the screen

### `group`

Groups a set of components together under a named container. Useful for organizing related components visually or logically.

- `name: string` — identifier for the group
- `components: ScreenComponent[]` — the nested components to render

## Control Components

Control components add conditional rendering and iteration logic within a single screen. Unlike the `loop` node (which operates at the flow/navigation level), control components operate purely at the render level inside a screen.

### `conditional`

Renders a component only when a condition is met. Uses the full `Condition` type (the same composable structure used by `branch` nodes).

- `if: Condition` — the condition to evaluate. Accepts a `SimpleCondition` or any compound type (`and`, `or`, `not`). See ConditionConfig Operators below.
- `component: ScreenComponent` — the component to render when the condition is `true`
- `else?: ScreenComponent` — optional component to render when the condition is `false`

Example:
```ts
{
  componentFamily: "control",
  template: "conditional",
  props: {
    if: { type: "simple", operator: "eq", dataKey: "$hasChildren", value: true },
    component: { componentFamily: "response", template: "numeric-input", props: { label: "How many?", dataKey: "childCount" } },
  },
}
```

### `for-each`

Renders a component template once per item in a list. Mirrors the `loop` node but operates within a single screen render rather than across flow steps.

- `id: string` — unique identifier for this for-each within the screen. Used to reference the current item inside the template via `{{#id.value}}` and `{{#id.index}}`.
- `type: "static" | "dynamic"`
- For `static`: `values: string[]` — explicit list of values to iterate over
- For `dynamic`: `dataKey` — a `$$`, `$`, `@`, or `#` reference to a collected array to iterate over
- `component: ScreenComponent` — the template component rendered for each item. Inside this template, use `{{#foreachId.value}}` and `{{#foreachId.index}}` (with the `#` prefix) to access the current iteration's value and index. The `dataKey` of response components inside a for-each template typically contains `{{#id.value}}` to produce a unique key per item (e.g. `"rating-{{#fe.value}}"`).
- `randomized?: boolean` — when `true`, the values are shuffled once at screen entry and rendered in that order. The presentation order is recorded in submitted form data as `<id>:order` (an array of the displayed values), mirroring the `<dataKey>:order` mechanism for randomized response options. All iterations still render simultaneously on the same screen — this only affects visual order. Invalid on a `dynamic` for-each whose `dataKey` uses the `$` prefix (live form state is not resolvable at screen entry); `$$`, `@`, and `#` prefixes are supported.
- `reshuffleInLoop?: boolean` — when the for-each is inside a loop and `randomized: true`, controls whether the order is reshuffled on each loop iteration (`true`) or kept stable across iterations (`false`, default).

Example:
```ts
{
  componentFamily: "control",
  template: "for-each",
  props: {
    id: "fe",
    type: "static",
    values: ["apple", "banana", "cherry"],
    component: {
      componentFamily: "response",
      template: "radio",
      props: { dataKey: "rating-{{#fe.value}}", label: "Rate {{#fe.value}}", options: [] },
    },
  },
}
```

## ConditionConfig Operators

The `Condition` type is used by both the `branch` node and the `conditional` component. A condition is either a `SimpleCondition` or a `CompoundCondition`.

**Compound condition types:**

| Type | Shape | Meaning |
|------|-------|---------|
| `and` | `{ type: "and"; conditions: Condition[] }` | All sub-conditions must be true |
| `or` | `{ type: "or"; conditions: Condition[] }` | At least one sub-condition must be true |
| `not` | `{ type: "not"; condition: Condition }` | The single sub-condition must be false |

**Simple condition shape:** `{ type: "simple"; operator: Operator; dataKey: string; value: string | number | boolean }`

The `dataKey` in a `SimpleCondition` accepts `$$`, `@`, or `$` prefixed references (see [Data Keys](./data-keys.md)).

The available operators are:

**Base operators** (compare scalar values):

| Operator | Meaning               |
| -------- | --------------------- |
| `eq`     | equal                 |
| `neq`    | not equal             |
| `lt`     | less than             |
| `lte`    | less than or equal    |
| `gt`     | greater than          |
| `gte`    | greater than or equal |

**Array operators** (work on arrays or strings):

| Operator     | Meaning                                  |
| ------------ | ---------------------------------------- |
| `contains`   | the array includes the given value       |
| `length-eq`  | length equals value                      |
| `length-neq` | length does not equal value              |
| `length-lt`  | length is less than value                |
| `length-lte` | length is less than or equal to value    |
| `length-gt`  | length is greater than value             |
| `length-gte` | length is greater than or equal to value |

For `length-*` operators, if the target is a string, its character length is used. If undefined, the condition evaluates to `false`.
