import { flatMap, Handlers, on } from '../component-walker';
import { parseRef, PREFIX } from '../tokens';
import { ExperimentFlow } from '../types';
import { ValidationError } from './types';

// `randomized: true` on a for-each whose dynamic dataKey uses the `$` (screen,
// live form state) prefix is invalid: `$`-referenced values only exist inside
// React at render time, so there is no stable list to shuffle at screen entry.
// All other prefixes ($$, @, #) resolve at enter-step time and are supported.
export function checkForeachRandomization(
  flow: ExperimentFlow,
): ValidationError[] {
  const { screens = [] } = flow;

  const handlers: Handlers<ValidationError, void> = [
    on({ componentFamily: 'control', template: 'for-each' }, (c, _s, recur) => {
      const errors: ValidationError[] = [];
      if (c.props.randomized && c.props.type === 'dynamic') {
        const ref = parseRef(c.props.dataKey);
        if (ref?.prefix === PREFIX.SCREEN) {
          errors.push({
            code: 'invalid-randomized-foreach',
            category: 'component',
            message: `For-each "${c.props.id}" sets randomized:true with a $-prefixed dataKey "${c.props.dataKey}", which references live form state unavailable at screen entry. Use a $$, @, or # prefix instead.`,
          });
        }
      }
      return [...errors, ...recur([c.props.component], _s)];
    }),

    on({ componentFamily: 'layout', template: 'group' }, (c, _s, recur) =>
      recur(c.props.components, _s),
    ),

    on(
      { componentFamily: 'control', template: 'conditional' },
      (c, _s, recur) => [
        ...recur([c.props.then], _s),
        ...(c.props.else ? recur([c.props.else], _s) : []),
      ],
    ),
  ];

  return screens.flatMap((screen) =>
    flatMap(screen.components, undefined, handlers),
  );
}
