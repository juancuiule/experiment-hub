import { BaseComponent } from '.';

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
> extends BaseComponent<'response', U> {
  props: Props & ResponseComponentBaseProps;
}

type TooltipConfig = {
  prefix?: string;
  suffix?: string;
};

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

export type SingleCheckboxComponent = BaseResponseComponent<
  'single-checkbox',
  {
    label: string;
    defaultValue: boolean;
    shouldBe?: boolean;
  }
>;

export type TextInputComponent = BaseResponseComponent<
  'text-input',
  {
    label: string;
    placeholder?: string;
  } & TextValidation
>;

export type TextAreaComponent = BaseResponseComponent<
  'text-area',
  {
    label: string;
    placeholder?: string;
    lines?: number;
  } & TextValidation
>;

export type DateInputComponent = BaseResponseComponent<
  'date-input',
  {
    label: string;
  }
>;

export type TimeInputComponent = BaseResponseComponent<
  'time-input',
  {
    label: string;
  }
>;

export type Option = {
  label: string;
  value: string;
  anchor?: 'first' | 'last';
  tooltip?: string;
};

export type OptionsSource =
  | Option[]
  | `$$${string}`
  | `@${string}`
  | `$${string}`
  | `%${string}`;

export type DropdownComponent = BaseResponseComponent<
  'dropdown',
  {
    label: string;
    options: OptionsSource;
    randomize?: boolean;
    reshuffleInLoop?: boolean;
  }
>;

export type RadioComponent = BaseResponseComponent<
  'radio',
  {
    label: string;
    options: OptionsSource;
    randomize?: boolean;
    reshuffleInLoop?: boolean;
  }
>;

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

export type LikertOption = {
  value: string;
  label?: string;
};

export type LikertOptionsSource = LikertOption[] | `%${string}`;

export type LikertScaleComponent = BaseResponseComponent<
  'likert-scale',
  {
    label: string;
    options: LikertOptionsSource;
  }
>;

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
    component.template === 'radio' ||
    component.template === 'dropdown' ||
    component.template === 'checkboxes'
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
