import { Condition } from '../conditions';
import { Context } from '../types';
import { ScreenComponent } from '.';
import { ResponseComponent } from './response';

export type ForEachMeta =
  | { type: 'static'; id: string; values: string[] }
  | { type: 'dynamic'; id: string; dataKey: `$$${string}` | `$${string}` };

export type ComponentVisitor<T> = {
  response?: (c: ResponseComponent, ctx: Context) => T[];
  group?: (children: ScreenComponent[], ctx: Context) => T[];
  conditional?: (
    thenC: ScreenComponent,
    elseC: ScreenComponent | undefined,
    condition: Condition,
    ctx: Context,
  ) => T[];
  forEach?: (template: ScreenComponent, meta: ForEachMeta, ctx: Context) => T[];
};

export function walkComponents<T>(
  components: ScreenComponent[],
  context: Context,
  visitor: ComponentVisitor<T>,
): T[] {
  return components.flatMap((component) =>
    walkComponent(component, context, visitor),
  );
}

function walkComponent<T>(
  component: ScreenComponent,
  context: Context,
  visitor: ComponentVisitor<T>,
): T[] {
  switch (component.componentFamily) {
    case 'response':
      return visitor.response?.(component, context) ?? [];
    case 'layout':
      if (component.template === 'group') {
        return visitor.group?.(component.props.components, context) ?? [];
      }
      return [];
    case 'control':
      if (component.template === 'conditional') {
        return (
          visitor.conditional?.(
            component.props.component,
            component.props.else,
            component.props.if,
            context,
          ) ?? []
        );
      }
      if (component.template === 'for-each') {
        const meta: ForEachMeta =
          component.props.type === 'static'
            ? {
                type: 'static',
                id: component.props.id,
                values: component.props.values,
              }
            : {
                type: 'dynamic',
                id: component.props.id,
                dataKey: component.props.dataKey,
              };
        return visitor.forEach?.(component.props.component, meta, context) ?? [];
      }
      return [];
    case 'content':
      return [];
  }
}
