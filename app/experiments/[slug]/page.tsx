import { flatMap, on } from '@/lib/component-walker';
import { Condition } from '@/lib/conditions';
import {
  FrameworkEdge,
  isBranchConditionEdge,
  isForkEdge,
  isPathEdge,
  isSequentialEdge,
} from '@/lib/edges';
import { validateExperiment } from '@/lib/experiment-validation';
import { ComputeNode, FrameworkNode, StartNode } from '@/lib/nodes';
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

function referencesInCompute(compute: ComputeNode) {
  return compute.props.computations.flatMap((computation) => {
    switch (computation.formula.type) {
      case 'sum':
      case 'mean':
      case 'min':
      case 'max': {
        return computation.formula.inputs;
      }
      case 'count': {
        const { inputs, where } = computation.formula;
        return [...inputs, ...(where ? referencesInCondition(where) : [])];
      }
      case 'conditional': {
        return referencesInCondition(computation.formula.condition);
      }
      case 'lookup': {
        return [computation.formula.input];
      }
      case 'count-correct': {
        // This compute node is a bit weird, we should improve it before
        // using it.
        return [];
      }
      case 'sample': {
        if (!Array.isArray(computation.formula.input)) {
          return [computation.formula.input];
        }
        return [];
      }
      default: {
        return [];
      }
    }
  });
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
      return referencesInCompute(node);
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

function nodeKeys(node: FrameworkNode, screens: FrameworkScreen[]): string[] {
  switch (node.type) {
    case 'compute': {
      return node.props.computations.map((c) => c.outputKey);
    }
    case 'screen': {
      const screen = screens.find((s) => s.slug === node.props.slug);
      if (screen) {
        // Here we should use something similar to the component-walker
        // or collectFields function in order to add keys to the available ones
      }
      return [];
    }
    default: {
      return [];
    }
  }
}

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
  function walkFrom(nodeId: string, available: Available, dataPath: string[]) {
    // We should find the node with the given id and check which
    // references it uses.
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) {
      console.error(`Node with id ${nodeId} not found`);
      return available;
    }

    console.log(`Walking from node ${node.type} ${node.id}`);

    const refInNode = referencesInNode(node);
    available.screenKeys = [
      ...available.screenKeys,
      ...nodeKeys(node, screens),
    ];
    refInNode.forEach((ref) => {
      if (!isAvailable(ref, available)) {
        console.error(
          `Reference "${ref}" in node "${node.id}" is not available in the current context. Available: ${JSON.stringify(available)}`,
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
          // const prefix = [...dataPath, node.props.slug].join('.');
          // 3. Add this screen keys to the available keys for the next
          // nodes using the prefix as namespace
          const newAvailable = available;
          if (nextSeqId) {
            return walkFrom(nextSeqId, newAvailable, dataPath);
          }
          return newAvailable; // THIS IS NOT COMPLETE
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
        // We should add the dataKeys computed in this node to the
        // savailable references for the next nodes
        const newAvailable = {
          ...available,
          dataKeys: [
            ...available.dataKeys,
            ...node.props.computations.map((c) => `${prefix}.${c.outputKey}`),
          ],
        };

        if (nextSeqId) {
          return walkFrom(nextSeqId, newAvailable, dataPath);
        }
        return newAvailable;
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
