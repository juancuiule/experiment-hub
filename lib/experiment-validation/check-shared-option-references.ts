import { flatMap, Handlers, on } from '../component-walker';
import { HAS_WRAPPED_TOKEN_RE } from '../tokens';
import { ExperimentFlow } from '../types';
import { ValidationError } from './types';

export function checkSharedOptionReferences(
  flow: ExperimentFlow,
): ValidationError[] {
  const definedOptions = new Set(Object.keys(flow.options ?? {}));
  const hasSupportedTemplatePlaceholder = HAS_WRAPPED_TOKEN_RE;

  // State = screen slug, threaded through for use in error messages.
  const handlers: Handlers<ValidationError, string> = [
    on({ componentFamily: 'response' }, (c, screenSlug): ValidationError[] => {
      const props = c.props as Record<string, unknown>;
      if (typeof props.options !== 'string' || !props.options.startsWith('%'))
        return [];
      const name = props.options.slice(1);
      if (definedOptions.has(name) || hasSupportedTemplatePlaceholder.test(name))
        return [];
      return [
        {
          code: 'unknown-shared-options',
          category: 'reference',
          message: `Screen "${screenSlug}" references undefined shared option set "%${name}"`,
        },
      ];
    }),
    on(
      { componentFamily: 'layout', template: 'group' },
      (c, slug, recur): ValidationError[] => recur(c.props.components, slug),
    ),
    on(
      { componentFamily: 'control', template: 'conditional' },
      (c, slug, recur): ValidationError[] => [
        ...recur([c.props.component], slug),
        ...(c.props.else ? recur([c.props.else], slug) : []),
      ],
    ),
    on(
      { componentFamily: 'control', template: 'for-each' },
      (c, slug, recur): ValidationError[] =>
        recur([c.props.component], slug),
    ),
  ];

  return (flow.screens ?? []).flatMap((screen) =>
    flatMap(screen.components, screen.slug, handlers),
  );
}
