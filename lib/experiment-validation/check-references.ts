import { flatMap, Handlers, on } from '../component-walker';
import { Condition } from '../conditions';
import { resolveIterKey } from '../flow';
import {
  BARE_DOUBLE_DOLLAR_RE,
  HAS_WRAPPED_TOKEN_RE,
  IS_BARE_REF_RE,
  PREFIX,
  TEMPLATE_TOKEN_RE,
  parseRef,
} from '../tokens';
import {
  isBranchConditionEdge,
  isBranchDefaultEdge,
  isForkEdge,
  isLoopEdge,
  isPathEdge,
  isSequentialEdge,
} from '../edges';
import { Formula, FrameworkNode, StartNode } from '../nodes';
import { resolveValuesInString } from '../resolve';
import { FrameworkScreen } from '../screen';
import { ExperimentFlow } from '../types';
import { isFrom } from './edge-helpers';
import { ValidationError } from './types';

// The experiment uses multiple types of references:
// - $dataKey:
// => for referencing data collected from response components in the same screen
// => for referencing data computed previously in the current compute node
// Example: $slider => context.screenData.slider => in the same screen
// Example: $total-correct => nodeOutputs['total-correct'] => in the same compute node
//
// - $$node-id.dataKey: (it can have multiple levels of nesting, e.g. $$node-id1.node-id2.dataKey)
// => for referencing data previously collected from other screens or compute nodes
// Example: $$regressors.age => context.data.regressors.age
//
// - @loopId for referencing the current iteration value of a loop
// => stored in context.loopData keyed by the loop node id, used with .value or .index
// Example: @loopSports.value => context.loopData.loopSports.value
//
// - #forEachId for referencing the current iteration value of a for-each component loop
// => stored in context.screenData.foreachData keyed by the for-each id, used with .value/.index
// Example: #foreachDrug.value => context.screenData.foreachData.foreachDrug.value

function referencesInCondition(condition: Condition): string[] {
  switch (condition.type) {
    case 'simple': {
      return [
        condition.dataKey,
        ...(typeof condition.value === 'string' && parseRef(condition.value)
          ? [condition.value]
          : []),
      ];
    }
    case 'and':
    case 'or': {
      return condition.conditions.flatMap(referencesInCondition);
    }
    case 'not': {
      return referencesInCondition(condition.condition);
    }
  }
}

function referencesInFormula(formula: Formula): string[] {
  switch (formula.type) {
    case 'sum':
    case 'mean':
    case 'min':
    case 'max':
      return formula.inputs;
    case 'count': {
      const { inputs, where } = formula;
      return [...inputs, ...(where ? referencesInCondition(where) : [])];
    }
    case 'conditional':
      return referencesInCondition(formula.condition);
    case 'lookup':
      return [formula.input];
    case 'loop-aggregate':
      // Items come from context.loops[loopId].values and the where / field
      // references ($<field>, @item) are iteration-scoped, so a loop-aggregate
      // has no outer-scope references to validate. loopId is checked separately.
      return [];
    case 'collect-loop':
      // Reads the loop's own iteration data; no outer-scope references to
      // validate. loopId is checked separately.
      return [];
    case 'sample':
    case 'split':
      return Array.isArray(formula.input) ? [] : [formula.input];
    default:
      return [];
  }
}

// Extracts all static references from a text prop. For simple tokens like
// {{$$foo.bar}} the full reference is returned. For tokens with a nested
// template in the path (e.g. {{$$loop.{{#id.index}}.val}}) the outer path is
// dynamic, so only the inner references are extracted for static validation.
function extractRefs(text: string): string[] {
  const allMatches = [...text.matchAll(TEMPLATE_TOKEN_RE)];
  if (allMatches.length > 0) {
    return allMatches.flatMap((m) => {
      const path = m[2];
      if (/\{\{/.test(path)) return extractRefs(path);
      return [`${m[1]}${path}`];
    });
  }
  const ref = parseRef(text);
  return ref ? [`${ref.prefix}${ref.path}`] : [];
}

type Available = {
  // Used at node and screen level
  dataKeys: Set<string>; // => referenced by $$
  loops: Set<string>; // => referenced by @

  // Used only at screen level (reset on entering each node)
  screenKeys: Set<string>; // => referenced by $ (screen response or compute output)
  forEach: Set<string>; // => referenced by #
};

// A reference is available if some collected key equals it or is an ancestor of
// it. Responses that store object values only contribute the leaf dataKey (e.g.
// "welcome.profile"), so a reference into the object's interior
// ("welcome.profile.address.city") is matched against that ancestor. The "+ ."
// guard keeps "welcome.profileX" from matching the key "welcome.profile".
function hasKeyOrAncestor(path: string, keys: Set<string>): boolean {
  return [...keys].some((key) => path === key || path.startsWith(`${key}.`));
}

function isAvailable(reference: string, available: Available): boolean {
  const ref = parseRef(reference);
  if (!ref) return false;
  switch (ref.prefix) {
    case PREFIX.DATA:
      return hasKeyOrAncestor(ref.path, available.dataKeys);
    case PREFIX.SCREEN:
      return hasKeyOrAncestor(ref.path, available.screenKeys);
    case PREFIX.LOOP:
      return available.loops.has(ref.path.split('.')[0]);
    case PREFIX.FOREACH:
      return available.forEach.has(ref.path.split('.')[0]);
  }
}

// Maps an unavailable reference to a ValidationError. An @ reference that is not
// in scope means it is used outside the loop it belongs to; anything else is data
// that is not guaranteed to have been written at this point in the flow.
function unavailableRefError(ref: string, context: string): ValidationError {
  if (ref.startsWith(PREFIX.LOOP)) {
    return {
      code: 'invalid-reference',
      category: 'reference',
      message: `${context} uses "${ref}" but is not inside a loop`,
    };
  }
  return {
    code: 'unavailable-reference',
    category: 'reference',
    message: `${context} references "${ref}" but that data is not guaranteed to be available at this point`,
  };
}

// A bare $$ token sitting in prose without {{…}} braces is never interpolated
// at runtime (resolveValuesInString only replaces wrapped tokens), so it leaks
// to the participant verbatim. We scan only for $$ — flagging bare $, @ or #
// would false-positive on currency ("$5"), handles ("@you") and counts ("#1").
function unwrappedRefErrors(text: string, context: string): ValidationError[] {
  if (HAS_WRAPPED_TOKEN_RE.test(text) || IS_BARE_REF_RE.test(text)) return [];
  return [...text.matchAll(BARE_DOUBLE_DOLLAR_RE)].map((m) => ({
    code: 'unwrapped-token',
    category: 'reference' as const,
    message: `${context} contains "$$${m[1]}" without {{…}} — it will not be interpolated at runtime`,
  }));
}

type ForeachCtx = Record<string, { index: number; value: string }>;

// All response dataKeys a screen produces, resolving for-each interpolation so
// that statically-expanded iterations contribute distinct keys. These become the
// $ (screen-local) references available within the screen and the $$ keys exposed
// to downstream nodes.
function collectScreenDataKeys(screen: FrameworkScreen): string[] {
  const handlers: Handlers<string, ForeachCtx> = [
    on({ componentFamily: 'response' }, (c, foreachData) => [
      resolveValuesInString(c.props.dataKey, { screenData: { foreachData } }),
    ]),
    on({ template: 'group' }, (c, ctx, recur) =>
      recur(c.props.components, ctx),
    ),
    on({ template: 'for-each' }, (c, ctx, recur) => {
      if (c.props.type !== 'static') return [];
      return c.props.values.flatMap((value, index) =>
        recur([c.props.component], {
          ...ctx,
          [c.props.id]: { index, value },
        }),
      );
    }),
    on({ componentFamily: 'layout', template: 'button' }, (c, foreachData) =>
      // We treat button payload keys as screen data since they can
      // be referenced by downstream nodes. This is a bit misleading since
      // the payload value isn't really "produced" until the button is clicked
      // and the dataKey is not available for $ references within the same screen,
      // but it keeps the model simpler and more consistent for downstream nodes.
      // Another issue is that this dataKey will not always be present to downstream nodes
      // — if the button is never clicked, or if it's behind a conditional that doesn't
      // run — but we can't guarantee that for any screen data so it doesn't create a
      // new class of "sometimes available" data.
      c.props.payload
        ? [
            resolveValuesInString(c.props.payload.dataKey, {
              screenData: { foreachData },
            }),
          ]
        : [],
    ),
    // Conditional components are skipped: we can't guarantee which branch runs,
    // so we can't guarantee which dataKeys are produced.
  ];
  return flatMap(screen.components, {}, handlers);
}

// All prop keys across every component type whose value type includes string.
// Derived so that TEXT_PROPS can only contain valid component prop keys.
type ComponentStringPropKey =
  FrameworkScreen['components'][number] extends infer C
    ? C extends { props: infer P }
      ? { [K in keyof P]: P[K] extends string | undefined ? K : never }[keyof P]
      : never
    : never;

const TEXT_PROPS = [
  'label',
  'content',
  'text',
  'url',
  'alt',
  'placeholder',
  'minLabel',
  'maxLabel',
  'dataKey',
  'errorMessage',
] as const satisfies ReadonlyArray<ComponentStringPropKey>;

function propsErrors(
  props: Record<string, unknown>,
  context: string,
  avail: Available,
): ValidationError[] {
  return TEXT_PROPS.flatMap((field) => {
    if (typeof props[field] !== 'string') return [];
    const text = props[field] as string;
    return [
      ...unavailableRefErrors(text, avail, context),
      ...unwrappedRefErrors(text, context),
    ];
  });
}

function unavailableRefErrors(
  text: string,
  available: Available,
  context: string,
): ValidationError[] {
  return extractRefs(text)
    .filter((ref) => !isAvailable(ref, available))
    .map((ref) => unavailableRefError(ref, context));
}

function referencesInScreen(
  screen: FrameworkScreen,
  available: Available,
): ValidationError[] {
  const context = `Screen "${screen.slug}"`;
  const handlers: Handlers<ValidationError, Available> = [
    on({ componentFamily: 'response' }, (c, avail) =>
      propsErrors(c.props, context, avail),
    ),
    on({ componentFamily: 'content' }, (c, avail) =>
      propsErrors(c.props, context, avail),
    ),
    on({ componentFamily: 'layout', template: 'button' }, (c, avail) => [
      ...propsErrors(c.props, context, avail),
      // Here we validate the payload dataKey and value (if value is a string) as well
      ...(c.props.payload
        ? [
            ...unavailableRefErrors(
              c.props.payload.dataKey,
              avail,
              `${context} button payload dataKey`,
            ),
            ...(typeof c.props.payload.value === 'string'
              ? unavailableRefErrors(
                  c.props.payload.value,
                  avail,
                  `${context} button payload value`,
                )
              : []),
          ]
        : []),
    ]),
    on(
      { componentFamily: 'layout', template: 'group' },
      (c, avail, recur): ValidationError[] => recur(c.props.components, avail),
    ),
    on(
      { componentFamily: 'control', template: 'conditional' },
      (c, avail, recur): ValidationError[] => [
        ...recur([c.props.component], avail),
        ...(c.props.else ? recur([c.props.else], avail) : []),
      ],
    ),
    on(
      { componentFamily: 'control', template: 'for-each' },
      (c, avail, recur): ValidationError[] => {
        const sourceErrors =
          c.props.type === 'dynamic'
            ? extractRefs(c.props.dataKey)
                .filter((ref) => !isAvailable(ref, avail))
                .map((ref) => unavailableRefError(ref, context))
            : [];
        const innerAvail = {
          ...avail,
          forEach: new Set([...avail.forEach, c.props.id]),
        };
        return [...sourceErrors, ...recur([c.props.component], innerAvail)];
      },
    ),
  ];

  return flatMap(screen.components, available, handlers);
}

// References used directly on a node (branch conditions, dynamic loop source).
// Compute nodes are handled incrementally in the walk's compute case.
function referencesInNode(node: FrameworkNode): string[] {
  switch (node.type) {
    case 'branch': {
      return node.props.branches.flatMap((branch) =>
        referencesInCondition(branch.config),
      );
    }
    case 'loop': {
      if (node.props.type === 'dynamic') {
        return [node.props.dataKey];
      }
      return [];
    }
    default:
      return [];
  }
}

// References can be used in many places in the experiment definition: component
// props, edge/branch conditions, compute formulas, loop sources. This walk
// collects which values are in scope at each point and reports references that
// point to data, loops or for-each ids that aren't guaranteed to be available.
export function checkReferences(experiment: ExperimentFlow): ValidationError[] {
  const { nodes, edges, screens = [] } = experiment;
  const rawErrors: ValidationError[] = [];
  const visitingNow = new Set<string>();

  function walkFrom(
    nodeId: string,
    _available: Available,
    dataPath: string[],
  ): Available {
    if (visitingNow.has(nodeId)) return _available;
    visitingNow.add(nodeId);
    try {
      return walkFromInner(nodeId, _available, dataPath);
    } finally {
      visitingNow.delete(nodeId);
    }
  }

  function walkFromInner(
    nodeId: string,
    _available: Available,
    dataPath: string[],
  ): Available {
    const available: Available = {
      dataKeys: _available.dataKeys,
      loops: _available.loops,
      // screenKeys and forEach reference values produced inside a screen (or
      // compute node) or a for-each component, so they reset on each node. $ and
      // # references therefore can only address values from the same screen /
      // compute / for-each, never earlier ones.
      screenKeys: new Set<string>(),
      forEach: new Set<string>(),
    };

    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return available;

    referencesInNode(node).forEach((ref) => {
      if (!isAvailable(ref, available)) {
        rawErrors.push(unavailableRefError(ref, `Node "${node.id}"`));
      }
    });

    const edgesFrom = edges.filter(isFrom(node));
    const nextSeqId = edgesFrom.find(isSequentialEdge)?.to.split('.')[0];

    switch (node.type) {
      case 'start':
      case 'checkpoint': {
        if (nextSeqId) return walkFrom(nextSeqId, available, dataPath);
        return available;
      }
      case 'screen': {
        const screen = screens.find((s) => s.slug === node.props.slug);
        if (screen) {
          const prefix = [...dataPath, node.props.slug].join('.');
          const screenDataKeys = collectScreenDataKeys(screen);

          // $ refs within this screen see its own response fields.
          const screenAvailable: Available = {
            ...available,
            screenKeys: new Set(screenDataKeys),
          };
          rawErrors.push(...referencesInScreen(screen, screenAvailable));

          // Downstream nodes can reference this screen's fields as $$prefix.key.
          const newAvailable: Available = {
            ...available,
            dataKeys: new Set([
              ...available.dataKeys,
              ...screenDataKeys.map((k) => `${prefix}.${k}`),
            ]),
          };

          if (nextSeqId) return walkFrom(nextSeqId, newAvailable, dataPath);
          return newAvailable;
        }
        return available;
      }
      case 'path': {
        const children = edgesFrom
          .filter(isPathEdge)
          .sort((e1, e2) => e1.order - e2.order);
        const childDataPath = [...dataPath, node.id];

        let afterPath: Available;
        if (node.props.randomized) {
          // Children run in unknown order — each only sees pre-path available.
          // After the path all children's data is reachable, so union results.
          const results = children.map((child) =>
            walkFrom(child.to, available, childDataPath),
          );
          afterPath = results.reduce<Available>(
            (acc, result) => ({
              ...acc,
              dataKeys: new Set([...acc.dataKeys, ...result.dataKeys]),
              loops: new Set([...acc.loops, ...result.loops]),
            }),
            available,
          );
        } else {
          // Children run in declared order — each sees the accumulated output of
          // all preceding children.
          afterPath = children.reduce<Available>(
            (acc, child) => walkFrom(child.to, acc, childDataPath),
            available,
          );
        }

        if (nextSeqId) return walkFrom(nextSeqId, afterPath, dataPath);
        return afterPath;
      }
      case 'branch': {
        const branches = edgesFrom.filter(
          (edge) => isBranchConditionEdge(edge) || isBranchDefaultEdge(edge),
        );
        branches.forEach((branch) => {
          walkFrom(branch.to, available, dataPath);
        });
        return available;
      }
      case 'compute': {
        const prefix = [...dataPath, node.id].join('.');
        // Validate each computation against only the outputs produced so far,
        // then accumulate — computation N cannot reference output N+1. $ refs
        // within a compute node address prior outputs in the same node; $$ refs
        // address data from earlier nodes.
        let computeAvailable: Available = available;

        node.props.computations.forEach((computation) => {
          referencesInFormula(computation.formula).forEach((ref) => {
            if (!isAvailable(ref, computeAvailable)) {
              rawErrors.push(
                unavailableRefError(
                  ref,
                  `Compute "${node.id}" output "${computation.outputKey}"`,
                ),
              );
            }
          });

          const { formula, outputKey } = computation;
          if (
            formula.type === 'loop-aggregate' ||
            formula.type === 'collect-loop'
          ) {
            const loopExists = nodes.some(
              (n) => n.id === formula.loopId && n.type === 'loop',
            );
            if (!loopExists) {
              rawErrors.push({
                code: 'unknown-node',
                category: 'reference',
                message: `Compute "${node.id}" output "${outputKey}" ${formula.type} references loop "${formula.loopId}" which is not a loop node in this experiment`,
              });
            }
          }

          if (formula.type === 'loop-aggregate') {
            const loopRefs = [
              ...(formula.where ? referencesInCondition(formula.where) : []),
              ...(formula.op === 'count' ? [] : [formula.field]),
            ].filter((ref) => ref.startsWith(PREFIX.LOOP));

            loopRefs.forEach((ref) => {
              const refLoopId = parseRef(ref)?.path.split('.')[0];
              if (refLoopId !== formula.loopId) {
                rawErrors.push({
                  code: 'invalid-reference',
                  category: 'reference',
                  message: `Compute "${node.id}" output "${outputKey}" loop-aggregate uses "${ref}" but loopId is "${formula.loopId}"`,
                });
              }
            });
          }

          computeAvailable = {
            ...computeAvailable,
            screenKeys: new Set([
              ...computeAvailable.screenKeys,
              computation.outputKey,
            ]),
            // Slightly imprecise: this lets later computations reference earlier
            // outputs via $$ as well as $, but it keeps the implementation simple.
            dataKeys: new Set([
              ...computeAvailable.dataKeys,
              `${prefix}.${computation.outputKey}`,
            ]),
          };
        });

        if (nextSeqId) return walkFrom(nextSeqId, computeAvailable, dataPath);
        return computeAvailable;
      }
      case 'fork': {
        edgesFrom.filter(isForkEdge).forEach((fork) => {
          walkFrom(fork.to, available, dataPath);
        });
        // Forks are mutually exclusive, so their outputs are not guaranteed for
        // downstream nodes — only within each fork arm.
        return available;
      }
      case 'loop': {
        const templateEdge = edgesFrom.find(isLoopEdge);
        let afterLoop = available;
        if (templateEdge) {
          const loopAvailable: Available = {
            ...available,
            loops: new Set([...available.loops, node.id]),
          };
          if (node.props.type === 'static') {
            // Walk once per value — the runtime data path is [loopId, value],
            // so each iteration produces distinct $$ keys downstream.
            const allKeys = new Set(available.dataKeys);
            node.props.values.forEach((value, index) => {
              const iterResult = walkFrom(templateEdge.to, loopAvailable, [
                ...dataPath,
                node.id,
                resolveIterKey(value, index, node.props.itemKey),
              ]);
              iterResult.dataKeys.forEach((k) => allKeys.add(k));
            });
            afterLoop = { ...available, dataKeys: allKeys };
          } else {
            // Dynamic loop: source array unknown at validation time — validate
            // template references but don't carry any keys downstream.
            walkFrom(templateEdge.to, loopAvailable, [...dataPath, node.id]);
          }
        }
        if (nextSeqId) return walkFrom(nextSeqId, afterLoop, dataPath);
        return afterLoop;
      }
      case 'end':
      default:
        return available;
    }
  }

  const initialAvailable: Available = {
    dataKeys: new Set(),
    loops: new Set(),
    screenKeys: new Set(),
    forEach: new Set(),
  };

  // Walk from every start node. Shared downstream nodes, multiple start nodes,
  // and re-walking static-loop bodies per value all produce duplicate errors,
  // so dedup by code+message before returning.
  nodes
    .filter((n): n is StartNode => n.type === 'start')
    .forEach((start) => walkFrom(start.id, initialAvailable, []));

  const seen = new Set<string>();
  return rawErrors.filter((e) => {
    const key = `${e.code}:${e.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
