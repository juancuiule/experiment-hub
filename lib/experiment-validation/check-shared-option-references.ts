import { ScreenComponent } from '../components';
import { ExperimentFlow } from '../types';
import { ValidationError } from './types';

export function checkSharedOptionReferences(
  flow: ExperimentFlow,
): ValidationError[] {
  const errors: ValidationError[] = [];
  const definedOptions = new Set(Object.keys(flow.options ?? {}));
  const hasSupportedTemplatePlaceholder =
    /\{\{(?:\$\$|\$|@|#)[a-zA-Z0-9_.\-]+\}\}/;

  function checkComponent(component: ScreenComponent, screenSlug: string) {
    const props = component.props as Record<string, unknown>;
    if (typeof props.options === 'string' && props.options.startsWith('%')) {
      const name = props.options.slice(1);
      if (
        !definedOptions.has(name) &&
        !hasSupportedTemplatePlaceholder.test(name)
      ) {
        errors.push({
          code: 'unknown-shared-options',
          category: 'reference',
          message: `Screen "${screenSlug}" references undefined shared option set "%${name}"`,
        });
      }
    }
    if (
      component.componentFamily === 'layout' &&
      component.template === 'group'
    ) {
      for (const child of component.props.components)
        checkComponent(child, screenSlug);
    } else if (component.componentFamily === 'control') {
      if (component.template === 'conditional') {
        checkComponent(component.props.component, screenSlug);
        if (component.props.else)
          checkComponent(component.props.else, screenSlug);
      } else if (component.template === 'for-each') {
        checkComponent(component.props.component, screenSlug);
      }
    }
  }

  for (const screen of flow.screens ?? []) {
    for (const component of screen.components) {
      checkComponent(component, screen.slug);
    }
  }

  return errors;
}
