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

Validation (each with its own `errorMessage`):
- `required?: boolean` — when `true`, the participant must actively move the slider before advancing (null check). This is the standard `required` behaviour: "filled" for a slider means "interacted with".
- `minValue?: { value: number; errorMessage?: string }` — the selected value must be at or above this threshold
- `maxValue?: { value: number; errorMessage?: string }` — the selected value must be at or below this threshold

Collected value: `number | null` (null when the participant has not yet moved the slider)

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
- `options: Option[]` — array of `{ label: string; value: string }` objects
- `randomize?: boolean` — if true, the order of options is shuffled for each participant.

Collected value: `{ value: string }` always. When `randomize: true`, an `order: string[]` field is added containing the shuffled option sequence. Reference `$$screen.dataKey.value` in branch conditions and answer piping.

### `radio`

Collects a single selection displayed as a radio button list.

- `label: string`
- `options: Option[]` — array of `{ label: string; value: string }` objects
- `randomize?: boolean` — if true, the order of options is shuffled for each participant.

Collected value: `{ value: string }` always. When `randomize: true`, an `order: string[]` field is added. Reference `$$screen.dataKey.value` in branch conditions and answer piping.

### `checkboxes`

Collects one or more selections from a list of checkboxes.

- `label: string`
- `options: Option[]` — array of `{ label: string; value: string }` objects
- `min?: number` — minimum number of options that must be selected
- `max?: number` — maximum number of options that can be selected
- `randomize?: boolean` — if true, the order of options is shuffled for each participant.

Collected value: `{ value: string[] }` always. When `randomize: true`, an `order: string[]` field is added. Reference `$$screen.dataKey.value` in branch conditions and answer piping.

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
- `options: LikertOption[]` — ordered array of scale points, each as `{ label: string; value: string }`. The researcher defines all points explicitly, allowing asymmetric, custom-labeled, or numeric scales of any length.

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

Renders a single component only when a condition is met. Uses `ConditionConfig` (see below) to define the condition.

- `operator: Operator` — the comparison operator (see ConditionConfig Operators)
- `dataKey` — a `$$`, `@` or `$` reference to the value to evaluate (see Data Keys)
- `value: string | number | boolean` — the value to compare against
- `component: ScreenComponent` — the component to render if the condition is true

> **Note:** The flat `{ operator, dataKey, value }` shape here will eventually be unified with the `ConditionConfig` nested structure used by `branch` nodes for consistency.

### `for-each`

Renders a component template once per item in a list. Mirrors the `loop` node but operates within a single screen render rather than across flow steps.

- `type: "static" | "dynamic"`
- For `static`: `values: string[]` — explicit list of values to iterate over
- For `dynamic`: `dataKey` — a `$$` or `$` reference to a collected array to iterate over
- `component: ScreenComponent` — the template component rendered for each item

## ConditionConfig Operators

The `ConditionConfig` type is used by both the `branch` node and the `conditional` component. The available operators are:

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
