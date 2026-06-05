import { BaseComponent } from '.';

/**
 * Props shared by every response component. `dataKey` is where the collected
 * value is stored; `required` blocks advancing until filled; `errorMessage` is
 * the fallback message for the `required` check (per-rule messages override it).
 */
type ResponseComponentBaseProps = {
  dataKey: string;
  required?: boolean;
  errorMessage?: string;
  labelTooltip?: string;
};

/**
 * A single validation constraint with its own optional `errorMessage`. When the
 * rule carries a threshold (e.g. a min length), `T` is that value's type and
 * `value` is required; rules without a threshold omit `value`.
 */
type ValidationRule<T = never> = [T] extends [never]
  ? { errorMessage?: string }
  : { value: T; errorMessage?: string };

/** Text-field validation rules shared by `text-input` and `text-area`. */
type TextValidation = {
  minLength?: ValidationRule<number>;
  maxLength?: ValidationRule<number>;
  pattern?: ValidationRule<string>;
};

/**
 * Base for the `response` family — components that collect data. Each one's
 * `props` are merged with {@link ResponseComponentBaseProps}.
 */
export interface BaseResponseComponent<
  U extends string,
  Props,
> extends BaseComponent<'response', U> {
  props: Props & ResponseComponentBaseProps;
}

/** Slider tooltip text wrapper: shows the value as `<prefix><value><suffix>`. */
type TooltipConfig = {
  prefix?: string;
  suffix?: string;
};

/**
 * Collects a number within a range via a drag slider. `defaultValue` only sets
 * the thumb's visual start — the participant must move the slider for a value to
 * be submitted, so an untouched slider collects `null` (and `required` means
 * "must have interacted"). `tooltip`/`showValue` surface the live value;
 * `minValue`/`maxValue` add threshold validation.
 *
 * Collected value: `number | null`.
 */
export type SliderComponent = BaseResponseComponent<
  'slider',
  {
    label: string;
    min?: number;
    max?: number;
    step?: number;
    defaultValue?: number;
    minLabel?: string;
    maxLabel?: string;
    showValue?: boolean;
    tooltip?: true | TooltipConfig;
    minValue?: ValidationRule<number>;
    maxValue?: ValidationRule<number>;
  }
>;

/**
 * Collects a boolean from a single checkbox. `defaultValue` sets the initial
 * state; `shouldBe` (if set) requires the value to equal it — useful for consent
 * gates.
 *
 * Collected value: `boolean`.
 */
export type SingleCheckboxComponent = BaseResponseComponent<
  'single-checkbox',
  {
    label: string;
    defaultValue: boolean;
    shouldBe?: boolean;
  }
>;

/**
 * Collects a single line of free-form text. Supports the `TextValidation` rules
 * (`minLength`/`maxLength`/`pattern`).
 *
 * Collected value: `string`.
 */
export type TextInputComponent = BaseResponseComponent<
  'text-input',
  {
    label: string;
    placeholder?: string;
  } & TextValidation
>;

/**
 * Collects multi-line free-form text — use over `text-input` for longer answers.
 * `lines` sets the initial visible height; supports the same `TextValidation`
 * rules (a `maxLength` also shows a live character counter).
 *
 * Collected value: `string`.
 */
export type TextAreaComponent = BaseResponseComponent<
  'text-area',
  {
    label: string;
    placeholder?: string;
    lines?: number;
  } & TextValidation
>;

/**
 * Collects a date. Collected value: `string`.
 */
export type DateInputComponent = BaseResponseComponent<
  'date-input',
  {
    label: string;
  }
>;

/**
 * Collects a time. Collected value: `string`.
 */
export type TimeInputComponent = BaseResponseComponent<
  'time-input',
  {
    label: string;
  }
>;

/**
 * One choice in a dropdown/radio/checkboxes list. `value` is stored on
 * selection; `label` is shown. `anchor` pins the option to the `first`/`last`
 * end of a shuffled list; `tooltip` adds an info icon with hover text.
 */
export type Option = {
  label: string;
  value: string;
  anchor?: 'first' | 'last';
  tooltip?: string;
};

/**
 * Where a choice component gets its options. Either an inline `Option[]` or a
 * reference: `$$` experiment-wide data, `@` current loop item, `$` live form
 * value, or `%` a named shared set from `ExperimentFlow.options`.
 */
export type OptionsSource =
  | Option[]
  | `$$${string}`
  | `@${string}`
  | `$${string}`
  | `%${string}`;

/**
 * Single selection from a dropdown list. `options` accepts any `OptionsSource`.
 * `randomize` shuffles options per participant (respecting each option's
 * `anchor`) and records the shown order under `<dataKey>:order`;
 * `reshuffleInLoop` controls reshuffling per loop iteration (default `true`).
 *
 * Collected value: `string` (the selected option's `value`).
 */
export type DropdownComponent = BaseResponseComponent<
  'dropdown',
  {
    label: string;
    options: OptionsSource;
    randomize?: boolean;
    reshuffleInLoop?: boolean;
  }
>;

/**
 * Single selection shown as a radio-button list. Same `options`/`randomize`/
 * `reshuffleInLoop` semantics as `dropdown` (shuffled order recorded under
 * `<dataKey>:order`).
 *
 * Collected value: `string` (the selected option's `value`).
 */
export type RadioComponent = BaseResponseComponent<
  'radio',
  {
    label: string;
    options: OptionsSource;
    randomize?: boolean;
    reshuffleInLoop?: boolean;
  }
>;

/**
 * Multiple selection from a checkbox list. `min`/`max` bound how many may be
 * selected; same `options`/`randomize`/`reshuffleInLoop` semantics as
 * `dropdown` (shuffled order recorded under `<dataKey>:order`).
 *
 * Collected value: `string[]` (the selected options' `value`s).
 */
export type CheckboxesComponent = BaseResponseComponent<
  'checkboxes',
  {
    label: string;
    options: OptionsSource;
    min?: number;
    max?: number;
    randomize?: boolean;
    reshuffleInLoop?: boolean;
  }
>;

/**
 * Collects a number via a typed input field — use over `slider` when a precise
 * value is expected. `min`/`max`/`step` constrain the input; `defaultValue`
 * pre-fills it.
 *
 * Collected value: `number`.
 */
export type NumericInputComponent = BaseResponseComponent<
  'numeric-input',
  {
    label: string;
    placeholder?: string;
    min?: number;
    max?: number;
    step?: number;
    defaultValue?: number;
  }
>;

/** One point on a Likert scale: `value` is stored, `label` is the shown text. */
export type LikertOption = {
  value: string;
  label?: string;
};

/**
 * Likert scale points: either an inline `LikertOption[]` or a `%`-named shared
 * set from `ExperimentFlow.options`.
 */
export type LikertOptionsSource = LikertOption[] | `%${string}`;

/**
 * Collects a response on an ordered agree/disagree or frequency scale (replaces
 * the old `rating` component). The `options` array alone defines the scale's
 * length and labels — no symmetry is enforced, so any custom or numeric scale is
 * possible.
 *
 * Collected value: `string` (the selected option's `value`).
 */
export type LikertScaleComponent = BaseResponseComponent<
  'likert-scale',
  {
    label: string;
    options: LikertOptionsSource;
  }
>;

/** Union of every `response`-family component. */
export type ResponseComponent =
  | SliderComponent
  | SingleCheckboxComponent
  | TextInputComponent
  | TextAreaComponent
  | DateInputComponent
  | TimeInputComponent
  | DropdownComponent
  | RadioComponent
  | CheckboxesComponent
  | NumericInputComponent
  | LikertScaleComponent;

/** The three components whose options can be shuffled (`randomize`). */
type RandomizableResponseComponent =
  | DropdownComponent
  | RadioComponent
  | CheckboxesComponent;

/** Type guard: true for `dropdown`/`radio`/`checkboxes` (option-list components). */
export function isRandomizableResponseComponent(
  component: ResponseComponent,
): component is RandomizableResponseComponent {
  return (
    component.template === 'radio' ||
    component.template === 'dropdown' ||
    component.template === 'checkboxes'
  );
}

/**
 * Type guard: true only when the component is option-list-based *and* has
 * `randomize` enabled — i.e. its options are actually shuffled at runtime.
 */
export function hasRandomizedOptions(
  component: ResponseComponent,
): component is RandomizableResponseComponent {
  return (
    isRandomizableResponseComponent(component) &&
    Boolean(component.props.randomize)
  );
}

/**
 * The empty/default form value for a component's `dataKey` before interaction:
 * `[]` for `checkboxes`, `false`/`defaultValue` for `single-checkbox`, `null`
 * for `slider` and unset `numeric-input`, and `''` for everything else.
 */
export function defaultPerTemplate(
  component: ResponseComponent,
): string | boolean | string[] | number | null {
  switch (component.template) {
    case 'radio':
    case 'dropdown':
      return '';
    case 'checkboxes':
      return [];
    case 'single-checkbox':
      return component.props.defaultValue ?? false;
    case 'slider':
      return null;
    case 'numeric-input':
      return component.props.defaultValue ?? null;
    default:
      return '';
  }
}
