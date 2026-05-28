import { flatMap, Handlers, on } from '@/lib/component-walker';
import { Condition } from '@/lib/conditions';
import {
  FrameworkEdge,
  isBranchConditionEdge,
  isForkEdge,
  isPathEdge,
  isSequentialEdge,
} from '@/lib/edges';
import { validateExperiment } from '@/lib/experiment-validation';
import { ComputeNode, Formula, FrameworkNode, StartNode } from '@/lib/nodes';
import { resolveValuesInString } from '@/lib/resolve';
import { FrameworkScreen } from '@/lib/screen';
import { ExperimentFlow } from '@/lib/types';
import { EXPERIMENTS } from '@/src/data/experiments';
import { DataDebug, StateDebug } from '@/src/Debug';
import Experiment from '@/src/Experiment';
import { ValidationErrors } from '@/src/ValidationErrors';

import { notFound } from 'next/navigation';
type Props = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
  params: Promise<{ slug: string }>;
};

export const revalidate = 0; // Disable caching to ensure fresh data on each request

function determineStartingNode(
  searchParams: { [key: string]: string | string[] | undefined },
  experiment: ExperimentFlow,
) {
  const keys = Object.keys(searchParams);
  const startNodes = experiment.nodes.filter((node) => node.type === 'start');

  for (const node of startNodes) {
    if (node.props && keys.includes(node.props.param.key)) {
      if (node.props.param.value) {
        const paramValue = searchParams[node.props.param.key];
        if (paramValue === node.props.param.value) {
          return node.id; // Return the ID of the starting node
        }
      }
    }
  }

  return startNodes[0].id;
}

export default async function Home(props: Props) {
  const { slug } = await props.params;
  const searchParams = await props.searchParams;

  const experiment = EXPERIMENTS[slug];

  if (!experiment) {
    notFound();
  }

  const referenceErrors = checkReferences(experiment);

  const errors = validateExperiment(experiment);

  if (errors.length > 0) {
    console.log('== Experiment validation errors: ==');
    errors.forEach((error) => console.log(error));
    return <ValidationErrors errors={errors} />;
  }

  const startingNode = determineStartingNode(searchParams, experiment);

  return (
    <>
      {process.env.NODE_ENV === 'development' && (
        <details className="my-2">
          <summary className="text-content-secondary cursor-pointer text-xs">
            Debug Info
          </summary>
          <StateDebug />
        </details>
      )}
      <Experiment startingNode={startingNode} experiment={experiment} />
      {process.env.NODE_ENV === 'development' && (
        <details className="my-2">
          <summary className="text-content-secondary cursor-pointer text-xs">
            Data Debug
          </summary>
          <DataDebug />
        </details>
      )}
    </>
  );
}

const isFrom = (node: FrameworkNode) => (edge: FrameworkEdge) => {
  return edge.from.split('.')[0] === node.id;
};

// The experiment uses multiple types of references:
// - $dataKey:
// => for referencing data collected from response components in the same screen
// => for referencing data computed previously in the current compute node
// Example: $slider => context.screenData.slider => in the same screen
// Example: $total-correct => nodeOutputs['total-correct'] => in the same compute node

// - $$node-id.dataKey: (it can have multiple levels of nesting, e.g. $$node-id1.node-id2.dataKey)
// => for referencing data previously collected from other screens or compute nodes
// Example: $$regressors.age => context.data.regressors.age

// - @loopId for referencing the current iteration value of a loop
// => for referencing the current iteration of a loop, which is stored in
// context.loopData with the loop node id as key, can be used with .value
// to reference the value of the current iteration or with .index to reference
// the index of the current iteration.
// Example: @loopSports.value => context.loopData.loopSports.value

// - #forEachDrug for referencing the current iteration value of a for-each component loop,
// which is stored in context.screenData.foreachData with the for-each node id as key,
// can be used with .value to reference the value of the current iteration or
// with .index to reference the index of the current iteration.
// Example: #foreachDrug.value => context.screenData.foreachData.foreachDrug.value

function referencesInCondition(condition: Condition): string[] {
  switch (condition.type) {
    case 'simple': {
      return [condition.dataKey];
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
    case 'count-correct':
      return [];
    case 'sample':
      return Array.isArray(formula.input) ? [] : [formula.input];
    default:
      return [];
  }
}

function referencesInCompute(compute: ComputeNode) {
  return compute.props.computations.flatMap((c) =>
    referencesInFormula(c.formula),
  );
}

function extractRefs(text: string): string[] {
  const wrapped = [...text.matchAll(/\{\{((?:\$\$|@|#)[\w.\-]+)\}\}/g)].map(
    (m) => m[1],
  );
  if (wrapped.length > 0) return wrapped;
  const m = text.match(/^(\$\$|@|#)([\w.\-]+)$/);
  return m ? [`${m[1]}${m[2]}`] : [];
}

type ForeachCtx = Record<string, { index: number; value: string }>;

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
    // We skip conditional components because we can't guarantee which branch
    // will be taken, so we can't guarantee which dataKeys will be available.
    // We also skip buttons and other content components because they don't produce dataKeys.
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
  screen: FrameworkScreen,
  avail: Available,
): string[] {
  return TEXT_PROPS.flatMap((field) => {
    if (typeof props[field] !== 'string') return [];
    return extractRefs(props[field] as string)
      .filter((ref) => !isAvailable(ref, avail))
      .map(
        (ref) => `Screen "${screen.slug}": reference "${ref}" is not available`,
      );
  });
}

function referencesInScreen(
  screen: FrameworkScreen,
  available: Available,
): string[] {
  const handlers: Handlers<string, Available> = [
    on({ componentFamily: 'response' }, (c, avail) =>
      propsErrors(c.props, screen, avail),
    ),
    on({ componentFamily: 'content' }, (c, avail) =>
      propsErrors(c.props, screen, avail),
    ),
    on({ componentFamily: 'layout', template: 'button' }, (c, avail) =>
      propsErrors(c.props, screen, avail),
    ),
    on(
      { componentFamily: 'layout', template: 'group' },
      (c, avail, recur): string[] => recur(c.props.components, avail),
    ),
    on(
      { componentFamily: 'control', template: 'conditional' },
      (c, avail, recur): string[] => [
        ...recur([c.props.component], avail),
        ...(c.props.else ? recur([c.props.else], avail) : []),
      ],
    ),
    on(
      { componentFamily: 'control', template: 'for-each' },
      (c, avail, recur): string[] => {
        const sourceErrors =
          c.props.type === 'dynamic'
            ? extractRefs(c.props.dataKey)
                .filter((ref) => !isAvailable(ref, avail))
                .map(
                  (ref) =>
                    `Screen "${screen.slug}": reference "${ref}" is not available`,
                )
            : [];
        const innerAvail = {
          ...avail,
          forEach: [...avail.forEach, c.props.id],
        };
        return [...sourceErrors, ...recur([c.props.component], innerAvail)];
      },
    ),
  ];

  return flatMap(screen.components, available, handlers);
}

function referencesInNode(node: FrameworkNode): string[] {
  switch (node.type) {
    case 'start':
    case 'end':
    case 'checkpoint':
    case 'screen':
    case 'path':
    case 'fork': {
      // This nodes dont use any type of reference
      break;
    }
    case 'branch': {
      // We should check reference usage in the conditions/config
      // of the branches
      return node.props.branches.flatMap((branch) => {
        return referencesInCondition(branch.config);
      });
    }
    case 'loop': {
      // We should check reference usage in dynamic loops
      if (node.props.type === 'dynamic') {
        return [node.props.dataKey];
      }
      break;
    }
    case 'compute': {
      // Handled incrementally in walkFrom's compute case.
      break;
    }
  }
  return [];
}

type Available = {
  // Used at node and sreen level
  dataKeys: string[]; // => will be referenced by $$
  loops: string[]; // => will be referenced by @

  // Used only at screen level
  screenKeys: string[]; // => will be referenced by $ (screen or computation)
  forEach: string[]; // => will be referenced by #
};

function isAvailable(reference: string, available: Available): boolean {
  if (reference.startsWith('$$')) {
    const dataKey = reference.slice(2);
    return available.dataKeys.includes(dataKey);
  }
  if (reference.startsWith('$')) {
    const screenKey = reference.slice(1);
    return available.screenKeys.includes(screenKey);
  }
  if (reference.startsWith('@')) {
    const [loopId] = reference.slice(1).split('.');
    return available.loops.includes(loopId);
  }
  if (reference.startsWith('#')) {
    const [forEachId] = reference.slice(1).split('.');
    return available.forEach.includes(forEachId);
  }
  return false;
}

// References can be used in different places in the experiment definition,
// such as in the props of components, in the conditions of edges, etc.
// This function will check that all references point to existing dataKeys,
// loops or foreach in the experiment definition.
function checkReferences(experiment: ExperimentFlow) {
  const { nodes, edges, screens = [] } = experiment;

  // This function walks through the experiment nodes collecting which
  // values will be available in the context at each point and checks that
  // all references used in the experiment are valid, meaning that they
  // point to existing dataKeys, loops or foreach in the experiment
  // definition at that time.
  function walkFrom(nodeId: string, _available: Available, dataPath: string[]) {
    const available = {
      dataKeys: _available.dataKeys,
      loops: _available.loops,
      // screenKeys and forEach are only available within screens (or compute nodes)
      // since they reference values that are produced within the screen (e.g. responses
      // or computations) or within the for-each component, so we reset them when we
      // enter a new node. This means that $ and # references can not be used to
      // reference values produced in previous screens or for-each components, but
      // only values produced in the same screen or for-each component.
      screenKeys: [],
      forEach: [],
    };

    // We should find the node with the given id and check which
    // references it uses.
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) {
      console.error(`Node with id ${nodeId} not found`);
      return available;
    }

    const refInNode = referencesInNode(node);
    refInNode.forEach((ref) => {
      if (!isAvailable(ref, available)) {
        console.error(
          `Reference "${ref}" in node "${node.id}" is not available`,
        );
      }
    });

    const edgesFrom = edges.filter(isFrom(node));

    const nextSeqId = edgesFrom.find(isSequentialEdge)?.to.split('.')[0];

    switch (node.type) {
      case 'start':
      case 'checkpoint': {
        if (nextSeqId) {
          return walkFrom(nextSeqId, available, dataPath);
        }
        return available;
      }
      case 'screen': {
        const screen = screens.find((s) => s.slug === node.props.slug);
        if (screen) {
          const prefix = [...dataPath, node.props.slug].join('.');
          const screenDataKeys = collectScreenDataKeys(screen);

          // $ refs within this screen see its own response fields
          const screenAvailable: Available = {
            ...available,
            screenKeys: screenDataKeys,
          };

          const screenErrors = referencesInScreen(screen, screenAvailable);
          screenErrors.forEach((e) => console.error(e));

          // Downstream nodes can reference this screen's fields as $$prefix.key
          const newAvailable: Available = {
            ...available,
            dataKeys: [
              ...available.dataKeys,
              ...screenDataKeys.map((k) => `${prefix}.${k}`),
            ],
          };

          if (nextSeqId) {
            return walkFrom(nextSeqId, newAvailable, dataPath);
          }
          return newAvailable;
        }
        return available;
      }
      case 'path': {
        const children = edgesFrom
          .filter(isPathEdge)
          .sort((e1, e2) => e1.order - e2.order);

        if (node.props.randomized) {
          // If the path is randomized, we should check each child path separately,
          // since they can have different references and we should check that all of them are valid.
          children.forEach((child) => {
            walkFrom(child.to, available, [...dataPath, node.id]);
          });
          // After checking all child paths we should add all the references from all child
          // paths to the available references for the next nodes, since all of them will
          // be available in the next nodes.
        } else {
          // If the path is not randomized we should check each child path in order and accumulate
          // the available references, since all of them will be available in the next paths.
        }

        if (nextSeqId) {
          return walkFrom(nextSeqId, available, dataPath);
        }
        return available;
      }
      case 'branch': {
        const branches = edgesFrom.filter(
          (edge) => isBranchConditionEdge(edge) || isSequentialEdge(edge),
        );
        branches.forEach((branch) => {
          walkFrom(branch.to, available, dataPath);
        });
        return available;
      }
      case 'compute': {
        const prefix = [...dataPath, node.id].join('.');
        // Validate each computation against only the outputs produced so far,
        // then accumulate — computation N cannot reference output N+1.
        // $ refs within a compute node address prior outputs in the same node;
        // $$ refs address data from earlier nodes.
        let computeAvailable: Available = available;

        node.props.computations.forEach((computation) => {
          const refs = referencesInFormula(computation.formula);
          refs.forEach((ref) => {
            if (!isAvailable(ref, computeAvailable)) {
              console.error(
                `Compute "${node.id}" output "${computation.outputKey}": reference "${ref}" is not available`,
              );
            }
          });

          computeAvailable = {
            ...computeAvailable,
            screenKeys: [...computeAvailable.screenKeys, computation.outputKey],
            // This is a bit imprecise since it allows later computations in the same node
            // to reference earlier outputs using $$, but it simplifies the implementation.
            // If we wanted to be more precise we would need to track the outputs that will
            // be produced by the current compute node separately and only add them to the
            // available outside this forEach loop
            dataKeys: [
              ...computeAvailable.dataKeys,
              `${prefix}.${computation.outputKey}`,
            ],
          };
        });

        if (nextSeqId) {
          return walkFrom(nextSeqId, computeAvailable, dataPath);
        }
        return computeAvailable;
      }
      case 'fork': {
        const forks = edgesFrom.filter(isForkEdge);
        forks.forEach((fork) => {
          walkFrom(fork.to, available, dataPath);
        });
        // We can not be sure that all the forks will be executed
        // so we should not add the references from the forks to the
        // available references for the next nodes. They will only be
        // available in the nodes of each fork path.
        return available;
      }
      case 'loop': {
        // const template = edgesFrom.find(isFrom(node));
        //
        if (nextSeqId) {
          return walkFrom(nextSeqId, available, dataPath);
        }
        return available;
      }
      case 'end': {
        return available;
      }
      default: {
        return available;
      }
    }
  }

  // Start from each start node
  const startNodes = nodes.filter((n): n is StartNode => n.type === 'start');
  const initialAvailable = {
    screenKeys: [],
    dataKeys: [],
    loops: [],
    forEach: [],
  };

  startNodes.forEach((start) => {
    walkFrom(start.id, initialAvailable, []);
  });
}
