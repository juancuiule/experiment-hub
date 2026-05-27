import { ScreenComponent } from './components';
import { Condition } from './conditions';
import {
  FrameworkEdge,
  isBranchConditionEdge,
  isBranchDefaultEdge,
  isForkEdge,
  isLoopEdge,
  isPathEdge,
  isSequentialEdge,
} from './edges';
import {
  BranchNode,
  ForkNode,
  Formula,
  FrameworkNode,
  ScreenNode,
} from './nodes';
import { resolveValuesInString } from './resolve';
import { FrameworkScreen } from './screen';
import { Context, ExperimentFlow } from './types';

export type ErrorCategory =
  | 'screen'
  | 'node'
  | 'branch'
  | 'edge'
  | 'reference'
  | 'component'
  | 'fork';

export type ValidationError = {
  code: string;
  nodeType?: FrameworkNode['type'];
  category: ErrorCategory;
  message: string;
};

function isNested(node: FrameworkNode, edges: FrameworkEdge[]): boolean {
  // A node is considered to be inside a path or loop (nested)
  // if there is a path-contains or loop-template edge from
  // any ancestor path or loop node to it, even if the node is not
  // a direct child of the template (i.e. nested multiple levels
  // deep inside the template).
  // COMPLETE THIS...
  return edges.some((edge) => {
    return (
      edge.to === node.id &&
      (edge.type === 'path-contains' || edge.type === 'loop-template')
    );
  });
}

function validateConditionStructure(
  condition: Condition,
  category: ErrorCategory,
): ValidationError[] {
  const errors: ValidationError[] = [];

  switch (condition.type) {
    case 'and':
    case 'or': {
      if (condition.conditions.length === 0) {
        errors.push({
          code: 'condition-empty',
          category,
          message: `A "${condition.type}" condition has no children, but at least one condition is required`,
        });
      }

      errors.push(
        ...condition.conditions.flatMap((child) =>
          validateConditionStructure(child, category),
        ),
      );
      break;
    }
    case 'not': {
      errors.push(...validateConditionStructure(condition.condition, category));
    }
  }

  return errors;
}

// Helper: valida que una colección de hijos no esté vacía y que sus ids sean únicos
function validateChildContainer<N extends BranchNode | ForkNode>(
  nodes: FrameworkNode[],
  nodeType: N['type'],
  getChildren: (node: N) => Array<{ id: string }>,
  childLabel: 'branch' | 'fork',
  childCollectionKey: 'branches' | 'forks',
) {
  const errors: ValidationError[] = [];
  nodes
    .filter((n): n is N => n.type === nodeType)
    .forEach((node) => {
      const children = getChildren(node);

      if (children.length === 0) {
        errors.push({
          code: `empty-${childLabel}`,
          category: childLabel,
          nodeType,
          message: `${nodeType} node "${node.id}" has no ${childCollectionKey} defined`,
        });
      }

      const seenIds = new Set<string>();
      children.forEach((child) => {
        if (seenIds.has(child.id)) {
          errors.push({
            code: `duplicate-${childLabel}-id`,
            category: childLabel,
            nodeType,
            message: `${nodeType} node "${node.id}" has duplicate ${childLabel} id "${child.id}" in ${childCollectionKey}: ${JSON.stringify(children)}`,
          });
        }
        seenIds.add(child.id);
      });
    });
  return errors;
}

function collectConditionDataKeys(cond: Condition): string[] {
  if (cond.type === 'simple') return [cond.dataKey];
  if (cond.type === 'and' || cond.type === 'or') {
    return cond.conditions.flatMap(collectConditionDataKeys);
  }
  if (cond.type === 'not') return collectConditionDataKeys(cond.condition);
  return [];
}

function checkNodes({ nodes }: ExperimentFlow): ValidationError[] {
  const errors: ValidationError[] = [];

  // 1. Check duplicated node ids
  const nodesById = new Map<string, FrameworkNode[]>();
  nodes.forEach((node) => {
    const existing = nodesById.get(node.id) ?? [];
    nodesById.set(node.id, [...existing, node]);
  });
  nodesById.forEach((group, id) => {
    if (group.length > 1) {
      errors.push({
        code: 'duplicate-node-id',
        category: 'node',
        message: `Duplicate node id "${id}" found in nodes: ${group.map((n) => JSON.stringify(n)).join(', ')}`,
      });
    }
  });

  // 2. Check that there is at least one start node
  if (!nodes.some((node) => node.type === 'start')) {
    errors.push({
      code: 'missing-start',
      category: 'node',
      message: 'Flow has no start node',
      nodeType: 'start',
    });
  }

  // 3. Check that there is at least one start node
  if (!nodes.some((node) => node.type === 'end')) {
    errors.push({
      code: 'missing-end',
      category: 'node',
      message: 'Flow has no end node',
      nodeType: 'end',
    });
  }

  // 4. Check branch nodes structure
  const branchErrors = validateChildContainer<BranchNode>(
    nodes,
    'branch',
    (n) => n.props.branches,
    'branch',
    'branches',
  );

  // 5. Check fork nodes structure
  const forkErrors = validateChildContainer<ForkNode>(
    nodes,
    'fork',
    (n) => n.props.forks,
    'fork',
    'forks',
  );

  errors.push(...branchErrors, ...forkErrors);

  return errors;
}

function checkEdgeEndpoints(flow: ExperimentFlow): ValidationError[] {
  const errors: ValidationError[] = [];

  const nodeIds = new Set(flow.nodes.map((n) => n.id));

  flow.edges.forEach((edge) => {
    // Split fromNodeId on dot to allow branch-condition and fork-edge
    // types to reference sub-elements of a node, but validate the base
    // node id against the node list to ensure all edge types reference
    // valid nodes.
    const [fromNodeId] = edge.from.split('.');

    if (
      edge.from.split('.').length > 1 &&
      edge.type !== 'fork-edge' &&
      edge.type !== 'branch-condition'
    ) {
      errors.push({
        code: 'invalid-edge',
        category: 'edge',
        message: `${edge.type} edge has invalid "from" reference "${edge.from}" with too many dot segments; only fork-edge and branch-condition edges can reference sub-elements of a node. ${JSON.stringify(edge)}`,
      });
    }

    if (!nodeIds.has(fromNodeId)) {
      errors.push({
        code: 'unknown-node',
        category: 'edge',
        message: `Edge references unknown source node "${fromNodeId}". ${JSON.stringify(edge)}`,
      });
    }
    if (!nodeIds.has(edge.to)) {
      errors.push({
        code: 'unknown-node',
        category: 'edge',
        message: `Edge references unknown target node "${edge.to}". ${JSON.stringify(edge)}`,
      });
    }
    if (edge.to.includes('.')) {
      errors.push({
        code: 'invalid-edge',
        category: 'edge',
        message: `Edge has invalid target "${edge.to}" with dot notation; edge targets must reference node ids only. ${JSON.stringify(edge)}`,
      });
    }
  });

  return errors;
}

function checkScreenDefinitions(flow: ExperimentFlow): ValidationError[] {
  const errors: ValidationError[] = [];
  const { screens = [], nodes } = flow;

  const screenNodes = nodes.filter((n): n is ScreenNode => n.type === 'screen');

  // 1. Check duplicated screen slugs
  const screensMap = new Map<string, FrameworkScreen[]>();
  const duplicatedSlugs = new Set<string>();
  screens.forEach((screen) => {
    const screens = screensMap.get(screen.slug);
    if (screens) {
      duplicatedSlugs.add(screen.slug);
      screensMap.set(screen.slug, [...screens, screen]);
    } else {
      screensMap.set(screen.slug, [screen]);
    }
  });

  duplicatedSlugs.forEach((slug) => {
    errors.push({
      code: 'duplicate-screen',
      category: 'screen',
      message: `Duplicate screen slug "${slug}" found in screens: ${screensMap
        .get(slug)
        ?.map((s) => JSON.stringify(s))
        .join(', ')}`,
    });
  });

  // 2. Check that all screen nodes reference a defined screen slug
  screenNodes.forEach((node) => {
    if (!screensMap.has(node.props.slug)) {
      errors.push({
        code: 'missing-screen',
        category: 'screen',
        message: `Screen node "${node.id}" references slug "${node.props.slug}" with no screen definition`,
      });
    }
  });

  // 3. Check that all screen definitions are referenced by at least one screen node
  const referencedSlugs = new Set(screenNodes.map((node) => node.props.slug));

  screensMap.keys().forEach((slug) => {
    if (!referencedSlugs.has(slug)) {
      errors.push({
        code: 'unreferenced-screen',
        category: 'screen',
        message: `Screen definition "${slug}" is not referenced by any screen node`,
      });
    }
  });

  return errors;
}

function checkEdgeWiring(flow: ExperimentFlow): ValidationError[] {
  // Check that edges are wired correctly according to node types and edge types:
  const errors: ValidationError[] = [];

  const { nodes, edges } = flow;

  const nodesMap = new Map(nodes.map((n) => [n.id, n]));

  const noSequential: FrameworkNode['type'][] = ['branch', 'fork', 'end'];
  const optionalSequential: FrameworkNode['type'][] = [
    'checkpoint',
    'screen',
    'compute',
    'path',
    'loop',
  ];

  const isFrom = (node: FrameworkNode) => (edge: FrameworkEdge) =>
    edge.from.split('.')[0] === node.id;

  // Check sequential edges from nodes
  nodes.forEach((node) => {
    const outgoingSequential = edges
      .filter(isSequentialEdge)
      .filter(isFrom(node));

    // - Start nodes:
    // -> exactly one sequential edge required;
    // - Checkpoint, Screen, Compute, Path, Loop nodes:
    // -> exactly one sequential edge required, unless the node is
    // inside a path or loop template, in which case sequential edges
    // are optional and sequencing is handled by the template node;
    const requiresSequential =
      node.type === 'start' ||
      (optionalSequential.includes(node.type) && !isNested(node, edges));

    if (requiresSequential && outgoingSequential.length === 0) {
      errors.push({
        code: 'missing-edge',
        category: 'edge',
        nodeType: node.type,
        message: `${node.type} node "${node.id}" has no sequential outgoing edge`,
      });
    }

    // - Branch, Fork nodes:
    // -> cant have sequential edges (sequencing is handled by them internally);
    // - End nodes:
    // -> cant have sequential edges (no next node after end);
    if (noSequential.includes(node.type) && outgoingSequential.length > 0) {
      errors.push({
        code: 'invalid-edge',
        category: 'edge',
        nodeType: node.type,
        message: `${node.type} node "${node.id}" has ${outgoingSequential.length} sequential outgoing edge(s), but nodes of type "${node.type}" cannot have sequential edges`,
      });
    }

    // Every node that requires a sequential edge must not have more
    // than one sequential edge (to avoid ambiguity about the next
    // node after the current node).
    if (!noSequential.includes(node.type) && outgoingSequential.length > 1) {
      errors.push({
        code: 'ambiguous-edge',
        category: 'edge',
        nodeType: node.type,
        message: `${node.type} node "${node.id}" has ${outgoingSequential.length} sequential outgoing edges; at most one is allowed`,
      });
    }
  });

  // Check non-sequential edges from nodes according to node type
  nodes.forEach((node) => {
    switch (node.type) {
      // - Path nodes:
      // => at least one path-contains edge required;
      case 'path': {
        const contains = edges.filter(isFrom(node)).filter(isPathEdge);
        if (contains.length === 0) {
          errors.push({
            code: 'missing-edge',
            category: 'edge',
            nodeType: 'path',
            message: `Path node "${node.id}" has no path-contains outgoing edges`,
          });
        }
        break;
      }

      // - Loop nodes:
      // => exactly one loop-template edge required;
      case 'loop': {
        const templates = edges.filter(isFrom(node)).filter(isLoopEdge);
        if (templates.length !== 1) {
          const missing = templates.length == 0;
          errors.push({
            code: missing ? 'missing-edge' : 'duplicate-edge',
            category: 'edge',
            nodeType: 'loop',
            message: `Loop node "${node.id}" has ${missing ? 'no' : 'more than one'} loop-template outgoing edge`,
          });
        }
        break;
      }

      // - Fork nodes:
      // => at least two fork-edge edges required;
      // => each fork-edge must correspond to a fork in the node;
      case 'fork': {
        const forkEdges = edges.filter(isForkEdge).filter(isFrom(node));
        if (forkEdges.length < 2) {
          errors.push({
            code: 'missing-edge',
            category: 'edge',
            nodeType: 'fork',
            message: `Fork node "${node.id}" has ${forkEdges.length} fork-edge outgoing edges; at least two are required`,
          });
        }

        const forks = node.props.forks.map((f) => f.id);

        forkEdges.forEach((edge) => {
          const forkId = edge.from.split('.')[1];
          if (!forks.includes(forkId)) {
            errors.push({
              code: 'invalid-edge',
              category: 'edge',
              nodeType: 'fork',
              message: `Fork-edge "${edge.from}" references fork id "${forkId}" which does not exist in fork node "${node.id}"`,
            });
          }
        });

        forks.forEach((forkId) => {
          const hasForkEdge = forkEdges.some(
            (e) => e.from === `${node.id}.${forkId}`,
          );
          if (!hasForkEdge) {
            errors.push({
              code: 'unrouted-fork',
              category: 'fork',
              nodeType: 'fork',
              message: `Fork "${node.id}" has fork "${forkId}" with no corresponding fork-edge`,
            });
          }
        });
        break;
      }

      // - Branch nodes:
      // => at least one branch-condition and branch-default edge required;
      // => each branch-condition edge must correspond to a branch in the node;
      // => only one branch-default edge allowed;
      case 'branch': {
        const defaultEdges = edges
          .filter(isBranchDefaultEdge)
          .filter(isFrom(node));

        if (defaultEdges.length !== 1) {
          const missing = defaultEdges.length == 0;
          errors.push({
            code: missing ? 'missing-edge' : 'ambiguous-edge',
            category: 'edge',
            nodeType: 'branch',
            message: `Branch node "${node.id}" has ${missing ? 'no' : 'more than one'} branch-default outgoing edge`,
          });
        }

        const conditionEdges = edges
          .filter(isBranchConditionEdge)
          .filter(isFrom(node));

        const branches = node.props.branches.map((b) => b.id);

        if (conditionEdges.length === 0) {
          errors.push({
            code: 'missing-edge',
            category: 'edge',
            nodeType: 'branch',
            message: `Branch node "${node.id}" has no branch-condition outgoing edges`,
          });
        }

        conditionEdges.forEach((edge) => {
          const branchId = edge.from.split('.')[1];
          if (!branches.includes(branchId)) {
            errors.push({
              code: 'invalid-edge',
              category: 'edge',
              nodeType: 'branch',
              message: `Branch-condition edge "${edge.from}" references branch id "${branchId}" which does not exist in branch node "${node.id}"`,
            });
          }
        });

        branches.forEach((branchId) => {
          const hasConditionEdge = conditionEdges.some(
            (e) => e.from === `${node.id}.${branchId}`,
          );
          if (!hasConditionEdge) {
            errors.push({
              code: 'unrouted-branch',
              category: 'branch',
              nodeType: 'branch',
              message: `Branch "${node.id}" has branch "${branchId}" with no corresponding branch-condition edge`,
            });
          }
        });

        break;
      }
    }
  });

  const requiresSource: Partial<
    Record<FrameworkEdge['type'], FrameworkNode['type']>
  > = {
    'branch-condition': 'branch',
    'branch-default': 'branch',
    'path-contains': 'path',
    'loop-template': 'loop',
    'fork-edge': 'fork',
  };

  // Check that edges of certain types are sourced from nodes of the correct type
  // according to the requiresSource mapping above
  edges.forEach((edge) => {
    const [nodeId] = edge.from.split('.');
    const node = nodesMap.get(nodeId);
    const requiredType = requiresSource[edge.type];
    if (node && requiredType && node.type !== requiredType) {
      errors.push({
        code: 'invalid-edge',
        category: 'edge',
        nodeType: node.type,
        message: `Edge of type "${edge.type}" has source "${edge.from}" which is a node of type "${node.type}", but it must source from a node of type "${requiredType}"`,
      });
    }
  });

  return errors;
}

function checkReferences(flow: ExperimentFlow): ValidationError[] {
  const rawErrors: ValidationError[] = [];
  const pushReferenceError = (code: string, message: string) =>
    rawErrors.push({ code, category: 'reference', message });
  const pushNodeError = (code: string, message: string) =>
    rawErrors.push({ code, category: 'node', message });
  const nodeMap = new Map(flow.nodes.map((n) => [n.id, n]));
  const screenMap = new Map((flow.screens ?? []).map((s) => [s.slug, s]));

  // Build lookup maps from the edge list
  const seqNext = new Map<string, string>();
  const branchForkTargets = new Map<string, string[]>();
  const pathChildren = new Map<string, { to: string; order: number }[]>();
  const loopTemplateOf = new Map<string, string>();

  for (const edge of flow.edges) {
    switch (edge.type) {
      case 'sequential':
        seqNext.set(edge.from, edge.to);
        break;
      case 'branch-condition':
      case 'branch-default':
      case 'fork-edge': {
        const nodeId = edge.from.split('.')[0];
        const targets = branchForkTargets.get(nodeId) ?? [];
        targets.push(edge.to);
        branchForkTargets.set(nodeId, targets);
        break;
      }
      case 'path-contains': {
        const children = pathChildren.get(edge.from) ?? [];
        children.push({ to: edge.to, order: edge.order });
        pathChildren.set(edge.from, children);
        break;
      }
      case 'loop-template':
        loopTemplateOf.set(edge.from, edge.to);
        break;
    }
  }

  function extractTokens(text: string): string[] {
    // Wrapped interpolations in label/content strings: {{$$foo.bar}}, {{@foo.bar}}
    const wrapped = [...text.matchAll(/\{\{(\$\$|@)([\w.\-]+)\}\}/g)].map(
      (m) => `${m[1]}${m[2]}`,
    );
    if (wrapped.length > 0) return wrapped;
    // Bare reference: entire string is a direct key (condition dataKeys)
    const m = text.match(/^(\$\$|@)([\w.\-]+)$/);
    return m ? [`${m[1]}${m[2]}`] : [];
  }

  function checkText(
    text: string,
    context: string,
    available: Set<string>,
    insideLoop: boolean,
  ) {
    for (const token of extractTokens(text)) {
      if (token.startsWith('@')) {
        if (!insideLoop) {
          pushReferenceError(
            'invalid-reference',
            `${context} uses "${token}" but is not inside a loop`,
          );
        }
      } else {
        const path = token.slice(2);
        const ok = [...available].some(
          (a) => path === a || path.startsWith(a + '.'),
        );
        if (!ok) {
          pushReferenceError(
            'unavailable-reference',
            `${context} references "${token}" but that data is not guaranteed to be available at this point`,
          );
        }
      }
    }
    // Detect bare $$... embedded in longer text (missing {{}} — won't be interpolated)
    const hasWrapped = /\{\{(?:\$\$|@)[\w.\-]+\}\}/.test(text);
    const isWholeBare = /^(?:\$\$|@)[\w.\-]+$/.test(text);
    if (!hasWrapped && !isWholeBare) {
      for (const m of text.matchAll(/\$\$([\w.\-]+)/g)) {
        pushReferenceError(
          'unwrapped-token',
          `${context} contains "$$${m[1]}" without {{…}} — it will not be interpolated at runtime`,
        );
      }
    }
  }

  function checkFormulaInput(
    input: string,
    context: string,
    available: Set<string>,
    nodeOutputs: Set<string>,
    insideLoop: boolean,
  ) {
    if (input.startsWith('$') && !input.startsWith('$$')) {
      const key = input.slice(1);
      if (!nodeOutputs.has(key)) {
        pushReferenceError(
          'unavailable-reference',
          `${context} uses "$${key}" but that output is not yet defined earlier in the same compute node`,
        );
      }
    } else {
      checkText(input, context, available, insideLoop);
    }
  }

  function checkFormulaInputs(
    formula: Formula,
    context: string,
    available: Set<string>,
    nodeOutputs: Set<string>,
    insideLoop: boolean,
  ) {
    switch (formula.type) {
      case 'sum':
      case 'mean':
      case 'min':
      case 'max': {
        for (const inp of formula.inputs) {
          checkFormulaInput(inp, context, available, nodeOutputs, insideLoop);
        }
        break;
      }
      case 'count': {
        for (const inp of formula.inputs) {
          checkFormulaInput(inp, context, available, nodeOutputs, insideLoop);
        }
        if (formula.where) {
          for (const key of collectConditionDataKeys(formula.where)) {
            if (!key.startsWith('@')) {
              checkFormulaInput(
                key,
                context,
                available,
                nodeOutputs,
                insideLoop,
              );
            }
          }
        }
        break;
      }
      case 'conditional': {
        for (const key of collectConditionDataKeys(formula.condition)) {
          checkFormulaInput(key, context, available, nodeOutputs, insideLoop);
        }
        break;
      }
      case 'lookup': {
        checkFormulaInput(
          formula.input,
          context,
          available,
          nodeOutputs,
          insideLoop,
        );
        break;
      }
      case 'sample': {
        if (!Array.isArray(formula.input)) {
          checkFormulaInput(
            formula.input,
            context,
            available,
            nodeOutputs,
            insideLoop,
          );
        }
        break;
      }
    }
  }

  // available: dot-joined data paths guaranteed to be written up to this point
  // dataPath: nesting context for how screen data is stored (e.g. ["path-profile"])
  // insideLoop: whether we are walking a loop template subgraph
  function walk(
    nodeId: string,
    available: Set<string>,
    dataPath: string[],
    insideLoop: boolean,
  ): Set<string> {
    const node = nodeMap.get(nodeId);
    if (!node) return available;

    const current = new Set(available);

    switch (node.type) {
      case 'start':
      case 'checkpoint': {
        const next = seqNext.get(nodeId);
        if (next) return walk(next, current, dataPath, insideLoop);
        break;
      }

      case 'screen': {
        const screen = screenMap.get(node.props.slug);
        if (screen) {
          const prefix = [...dataPath, node.props.slug].join('.');
          const screenLabel = `Screen "${node.props.slug}"`;

          function processComponent(component: ScreenComponent, ctx: Context) {
            const props = component.props as Record<string, unknown>;
            // Note: We only validate wrapped references in labels/content (checkText will catch unwrapped tokens).
            // Dynamic dataKeys like 'rating-{{$$foo.bar}}' are not validated here but work correctly at runtime
            // because resolveValuesInString() interpolates the template in RenderComponent before form creation.
            for (const field of ['label', 'content', 'text'] as const) {
              if (typeof props[field] === 'string') {
                checkText(
                  props[field] as string,
                  screenLabel,
                  current,
                  insideLoop,
                );
              }
            }
            if (component.componentFamily === 'response') {
              current.add(
                `${prefix}.${resolveValuesInString(component.props.dataKey, ctx)}`,
              );
            } else if (
              component.componentFamily === 'layout' &&
              component.template === 'group'
            ) {
              for (const child of component.props.components)
                processComponent(child, ctx);
            } else if (component.componentFamily === 'control') {
              if (component.template === 'conditional') {
                processComponent(component.props.component, ctx);
                if (component.props.else)
                  processComponent(component.props.else, ctx);
              } else if (
                component.template === 'for-each' &&
                component.props.type === 'static'
              ) {
                component.props.values.forEach((value, index) => {
                  const subCtx: Context = {
                    screenData: {
                      foreachData: { [component.props.id]: { index, value } },
                    },
                  };
                  processComponent(component.props.component, subCtx);
                });
              }
              // dynamic for-each: keys not resolvable statically — skip
            }
          }

          for (const component of screen.components) {
            processComponent(component, {});
          }
        }
        const next = seqNext.get(nodeId);
        if (next) return walk(next, current, dataPath, insideLoop);
        break;
      }

      case 'compute': {
        const nodeLabel = `Compute "${nodeId}"`;
        const prefix = [...dataPath, nodeId].join('.');
        const nodeOutputs = new Set<string>();
        const seenOutputKeys = new Set<string>();
        for (const { outputKey, formula } of node.props.computations) {
          if (seenOutputKeys.has(outputKey)) {
            pushNodeError(
              'duplicate-output-key',
              `Compute "${nodeId}" has duplicate outputKey "${outputKey}"`,
            );
          }
          seenOutputKeys.add(outputKey);
          if (formula.type === 'lookup') {
            const seenWhen = new Set<number>();
            for (const entry of formula.table) {
              const key = Number(entry.when);
              if (seenWhen.has(key)) {
                pushNodeError(
                  'duplicate-lookup-key',
                  `Compute "${nodeId}" output "${outputKey}" has duplicate lookup key "${entry.when}"`,
                );
              }
              seenWhen.add(key);
            }
          }
          if (
            formula.type === 'sample' &&
            (!Number.isInteger(formula.n) || formula.n <= 0)
          ) {
            pushNodeError(
              'invalid-sample-size',
              `Compute "${nodeId}" output "${outputKey}" has sample size n="${formula.n}", but n must be a positive integer`,
            );
          }
          checkFormulaInputs(
            formula,
            nodeLabel,
            current,
            nodeOutputs,
            insideLoop,
          );
          current.add(`${prefix}.${outputKey}`);
          nodeOutputs.add(outputKey);
        }
        const next = seqNext.get(nodeId);
        if (next) return walk(next, current, dataPath, insideLoop);
        break;
      }

      case 'path': {
        const children = (pathChildren.get(nodeId) ?? []).sort(
          (a, b) => a.order - b.order,
        );
        let childAvailable = new Set(current);
        for (const { to } of children) {
          childAvailable = walk(
            to,
            childAvailable,
            [...dataPath, nodeId],
            insideLoop,
          );
        }
        childAvailable.forEach((k) => current.add(k));
        const next = seqNext.get(nodeId);
        if (next) return walk(next, current, dataPath, insideLoop);
        break;
      }

      case 'loop': {
        // Walk template for @-ref validation only; loop data is dynamically keyed
        // so it is not added to the available set for nodes after the loop.
        const templateId = loopTemplateOf.get(nodeId);
        if (templateId) {
          walk(templateId, new Set(current), [...dataPath, nodeId], true);
        }
        const next = seqNext.get(nodeId);
        if (next) return walk(next, current, dataPath, insideLoop);
        break;
      }

      case 'branch': {
        for (const branch of node.props.branches) {
          for (const dataKey of collectConditionDataKeys(branch.config)) {
            checkText(
              dataKey,
              `Branch "${node.id}" condition`,
              current,
              insideLoop,
            );
          }
        }
        // Walk each target in isolation — data written in one branch is not
        // guaranteed to be available in another.
        const targets = branchForkTargets.get(nodeId) ?? [];
        for (const target of targets) {
          walk(target, new Set(current), dataPath, insideLoop);
        }
        break;
      }

      case 'fork': {
        const targets = branchForkTargets.get(nodeId) ?? [];
        for (const target of targets) {
          walk(target, new Set(current), dataPath, insideLoop);
        }
        break;
      }
    }

    return current;
  }

  const startNode = flow.nodes.find((n) => n.type === 'start');
  if (startNode) walk(startNode.id, new Set(), [], false);

  // Deduplicate: the same screen may be reached via multiple branch paths
  const seen = new Set<string>();
  return rawErrors.filter((e) => {
    const key = `${e.code}:${e.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function checkSharedOptionReferences(flow: ExperimentFlow): ValidationError[] {
  const errors: ValidationError[] = [];
  const pushReferenceError = (code: string, message: string) =>
    errors.push({ code, category: 'reference', message });
  const definedOptions = new Set(Object.keys(flow.options ?? {}));
  const hasSupportedTemplatePlaceholder =
    /\{\{(?:\$\$|\$|@|#)[a-zA-Z0-9_.\-]+\}\}/;

  function checkComponent(component: ScreenComponent, screenSlug: string) {
    const props = component.props as Record<string, unknown>;
    if (typeof props.options === 'string' && props.options.startsWith('%')) {
      const name = props.options.slice(1);
      // For templated option references like '%mirada-{{@loop.value}}':
      // - Static validation cannot fully validate the resolved keys (e.g., 'mirada-1', 'mirada-2', ...)
      // - The actual validation happens at runtime when resolveOptionsSource() evaluates the template
      // - We only skip static checks for placeholders supported by resolveValuesInString()
      if (
        !definedOptions.has(name) &&
        !hasSupportedTemplatePlaceholder.test(name)
      ) {
        pushReferenceError(
          'unknown-shared-options',
          `Screen "${screenSlug}" references undefined shared option set "%${name}"`,
        );
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

export function validateExperiment(flow: ExperimentFlow): ValidationError[] {
  return [
    ...checkNodes(flow),
    ...checkEdgeEndpoints(flow),
    ...checkScreenDefinitions(flow),
    ...checkEdgeWiring(flow),

    ...checkReferences(flow),
    ...checkSharedOptionReferences(flow),
  ];
}
