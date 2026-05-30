import { ScreenComponent } from '@/lib/components';

type Family = 'content' | 'response' | 'layout' | 'control';

export interface ComponentTemplateMeta {
  family: Family;
  template: string;
  label: string;
}

/** All renderable templates, grouped for the "add component" menu. */
export const COMPONENT_TEMPLATES: ComponentTemplateMeta[] = [
  { family: 'content', template: 'rich-text', label: 'Rich text' },
  { family: 'content', template: 'image', label: 'Image' },
  { family: 'content', template: 'video', label: 'Video' },
  { family: 'content', template: 'audio', label: 'Audio' },
  { family: 'response', template: 'slider', label: 'Slider' },
  { family: 'response', template: 'radio', label: 'Radio' },
  { family: 'response', template: 'checkboxes', label: 'Checkboxes' },
  { family: 'response', template: 'dropdown', label: 'Dropdown' },
  { family: 'response', template: 'single-checkbox', label: 'Single checkbox' },
  { family: 'response', template: 'text-input', label: 'Text input' },
  { family: 'response', template: 'text-area', label: 'Text area' },
  { family: 'response', template: 'numeric-input', label: 'Numeric input' },
  { family: 'response', template: 'date-input', label: 'Date input' },
  { family: 'response', template: 'time-input', label: 'Time input' },
  { family: 'response', template: 'likert-scale', label: 'Likert scale' },
  { family: 'layout', template: 'button', label: 'Button' },
  { family: 'layout', template: 'group', label: 'Group' },
  { family: 'control', template: 'conditional', label: 'Conditional' },
  { family: 'control', template: 'for-each', label: 'For each' },
];

export const FAMILY_ACCENT: Record<Family, string> = {
  content: 'bg-slate-200 text-slate-700',
  response: 'bg-sky-100 text-sky-700',
  layout: 'bg-emerald-100 text-emerald-700',
  control: 'bg-amber-100 text-amber-700',
};

/** Build a minimal valid component for a template. */
export function makeComponent(meta: ComponentTemplateMeta): ScreenComponent {
  const { family, template } = meta;
  if (family === 'content') {
    if (template === 'rich-text')
      return { componentFamily: 'content', template, props: { content: '# New text' } } as ScreenComponent;
    return {
      componentFamily: 'content',
      template,
      props: { src: '' },
    } as unknown as ScreenComponent;
  }
  if (family === 'layout') {
    if (template === 'button')
      return { componentFamily: 'layout', template, props: { text: 'Submit' } } as ScreenComponent;
    return { componentFamily: 'layout', template, props: {} } as unknown as ScreenComponent;
  }
  if (family === 'control') {
    return {
      componentFamily: 'control',
      template,
      props: {},
    } as unknown as ScreenComponent;
  }
  // response
  const base = { dataKey: 'answer', label: 'New question' } as Record<string, unknown>;
  if (template === 'radio' || template === 'checkboxes' || template === 'dropdown') {
    base.options = [];
  }
  if (template === 'single-checkbox') base.defaultValue = false;
  if (template === 'likert-scale') base.options = [];
  return {
    componentFamily: 'response',
    template,
    props: base,
  } as unknown as ScreenComponent;
}

/** String-valued prop keys we expose as quick-edit fields in the inspector. */
export const QUICK_FIELDS = [
  'label',
  'dataKey',
  'content',
  'text',
  'placeholder',
  'src',
] as const;
