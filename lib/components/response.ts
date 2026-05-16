import { BaseComponent } from ".";

type ResponseComponentBaseProps = {
  dataKey: string;
  required?: boolean;
  errorMessage?: string;
};

type ValidationRule<T = never> = [T] extends [never]
  ? { errorMessage?: string }
  : { value: T; errorMessage?: string };

type TextValidation = {
  minLength?: ValidationRule<number>;
  maxLength?: ValidationRule<number>;
  pattern?: ValidationRule<string>;
};

export interface BaseResponseComponent<
  U extends string,
  Props,
> extends BaseComponent<"response", U> {
  props: Props & ResponseComponentBaseProps;
}

export interface SliderComponent extends BaseResponseComponent<
  "slider",
  {
    label: string;
    min?: number;
    max?: number;
    step?: number;
    defaultValue?: number;
    minLabel?: string;
    maxLabel?: string;
    showValue?: boolean;
    minValue?: ValidationRule<number>;
    maxValue?: ValidationRule<number>;
  }
> {}

export interface SingleCheckboxComponent extends BaseResponseComponent<
  "single-checkbox",
  {
    label: string;
    defaultValue: boolean;
    shouldBe?: boolean;
  }
> {}

export interface TextInputComponent extends BaseResponseComponent<
  "text-input",
  {
    label: string;
    placeholder?: string;
  } & TextValidation
> {}

export interface TextAreaComponent extends BaseResponseComponent<
  "text-area",
  {
    label: string;
    placeholder?: string;
    lines?: number;
  } & TextValidation
> {}

export interface DateInputComponent extends BaseResponseComponent<
  "date-input",
  {
    label: string;
  }
> {}

export interface TimeInputComponent extends BaseResponseComponent<
  "time-input",
  {
    label: string;
  }
> {}

export type Option = {
  label: string;
  value: string;
};

export type OptionsSource =
  | Option[]
  | `$$${string}`
  | `@${string}`
  | `$${string}`;

export interface DropdownComponent extends BaseResponseComponent<
  "dropdown",
  {
    label: string;
    options: OptionsSource;
    randomize?: boolean;
    reshuffleInLoop?: boolean;
  }
> {}

export interface RadioComponent extends BaseResponseComponent<
  "radio",
  {
    label: string;
    options: OptionsSource;
    randomize?: boolean;
    reshuffleInLoop?: boolean;
  }
> {}

export interface CheckboxesComponent extends BaseResponseComponent<
  "checkboxes",
  {
    label: string;
    options: OptionsSource;
    min?: number;
    max?: number;
    randomize?: boolean;
    reshuffleInLoop?: boolean;
  }
> {}

export interface NumericInputComponent extends BaseResponseComponent<
  "numeric-input",
  {
    label: string;
    placeholder?: string;
    min?: number;
    max?: number;
    step?: number;
    defaultValue?: number;
  }
> {}

export type LikertOption = Option;

export interface LikertScaleComponent extends BaseResponseComponent<
  "likert-scale",
  {
    label: string;
    options: LikertOption[];
  }
> {}

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

type RandomizableResponseComponent =
  | DropdownComponent
  | RadioComponent
  | CheckboxesComponent;

export function isRandomizableResponseComponent(
  component: ResponseComponent,
): component is RandomizableResponseComponent {
  return (
    component.template === "radio" ||
    component.template === "dropdown" ||
    component.template === "checkboxes"
  );
}

export function hasRandomizedOptions(
  component: ResponseComponent,
): component is RandomizableResponseComponent {
  return (
    isRandomizableResponseComponent(component) &&
    Boolean(component.props.randomize)
  );
}
