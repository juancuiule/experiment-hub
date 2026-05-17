import { ScreenComponent } from './components';

type Field = {};

export function getComponentFields(component: ScreenComponent): Field[] {
  switch (component.componentFamily) {
    case 'content': {
      // No fields to collect from content components
      return [];
    }
    case 'layout': {
      if (component.template === 'group') {
        return component.props.components.flatMap(getComponentFields);
      }
      return [];
    }
    case 'control': {
      switch (component.template) {
        case 'conditional': {
          return [];
        }
        case 'for-each': {
          return [];
        }
      }
    }
    case 'response': {
    }
  }

  return [];
}

export function getFields(components: ScreenComponent[]): Field[] {
  return [];
}
