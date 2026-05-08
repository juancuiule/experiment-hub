import { createContext, useContext } from 'react'
import type { UseFormReturn } from 'react-hook-form'
import type { Context } from './types'
import type {
  TextInputComponent,
  TextAreaComponent,
  NumericInputComponent,
  DateInputComponent,
  TimeInputComponent,
  SingleCheckboxComponent,
  CheckboxesComponent,
  RadioComponent,
  DropdownComponent,
  SliderComponent,
  LikertScaleComponent,
} from './components/response'
import type { ButtonComponent } from './components/layout'
import type { RichTextComponent } from './components/content'

type ResponseProps<C> = {
  component: C
  form: UseFormReturn<Record<string, any>>
  context: Context
}

export type TextInputRenderProps      = ResponseProps<TextInputComponent>
export type TextAreaRenderProps       = ResponseProps<TextAreaComponent>
export type NumericInputRenderProps   = ResponseProps<NumericInputComponent>
export type DateInputRenderProps      = ResponseProps<DateInputComponent>
export type TimeInputRenderProps      = ResponseProps<TimeInputComponent>
export type SingleCheckboxRenderProps = ResponseProps<SingleCheckboxComponent>
export type CheckboxesRenderProps     = ResponseProps<CheckboxesComponent>
export type RadioRenderProps          = ResponseProps<RadioComponent>
export type DropdownRenderProps       = ResponseProps<DropdownComponent>
export type SliderRenderProps         = ResponseProps<SliderComponent>
export type LikertScaleRenderProps    = ResponseProps<LikertScaleComponent>

export type ButtonRenderProps   = { component: ButtonComponent; isLoading: boolean }
export type RichTextRenderProps = { component: RichTextComponent; context: Context }

export type ComponentRegistry = Partial<{
  'text-input':      React.ComponentType<TextInputRenderProps>
  'text-area':       React.ComponentType<TextAreaRenderProps>
  'numeric-input':   React.ComponentType<NumericInputRenderProps>
  'date-input':      React.ComponentType<DateInputRenderProps>
  'time-input':      React.ComponentType<TimeInputRenderProps>
  'single-checkbox': React.ComponentType<SingleCheckboxRenderProps>
  'checkboxes':      React.ComponentType<CheckboxesRenderProps>
  'radio':           React.ComponentType<RadioRenderProps>
  'dropdown':        React.ComponentType<DropdownRenderProps>
  'slider':          React.ComponentType<SliderRenderProps>
  'likert-scale':    React.ComponentType<LikertScaleRenderProps>
  'button':          React.ComponentType<ButtonRenderProps>
  'rich-text':       React.ComponentType<RichTextRenderProps>
}>

const ComponentRegistryContext = createContext<ComponentRegistry>({})

export function ComponentRegistryProvider({
  registry,
  children,
}: {
  registry: ComponentRegistry
  children: React.ReactNode
}) {
  return (
    <ComponentRegistryContext.Provider value={registry}>
      {children}
    </ComponentRegistryContext.Provider>
  )
}

export function useComponentRegistry(): ComponentRegistry {
  return useContext(ComponentRegistryContext)
}
