import { ScreenComponent } from './components';
import { Condition } from './conditions';
import { Formula, FrameworkNode, ScreenNode } from './nodes';
import { resolveValuesInString } from './resolve';
import { FrameworkScreen } from './screen';
import { Context, ExperimentFlow } from './types';

export type ErrorCategory =
  | 'screen'
  | 'node'
  | 'branch'
  | 'edge'
  | 'reference'
  | 'component';

export type ValidationError = {
  code: string;
  nodeType?: FrameworkNode['type'];
  category: ErrorCategory;
  message: string;
};

function validateConditionStructure(
  cond: Condition,
  context: string,
): ValidationError[] {
  const errors: ValidationError[] = [];
  const pushBranchError = (code: string, message: string) =>
    errors.push({ code, category: 'branch', message });

  if (cond.type === 'and' || cond.type === 'or') {
    if (cond.conditions.length === 0) {
      pushBranchError(
        `condition-empty-${cond.type}`,
        `${context} has an "${cond.type}" condition with no children`,
      );
    }
    for (const child of cond.conditions) {
      errors.push(...validateConditionStructure(child, context));
    }
  } else if (cond.type === 'not') {
    errors.push(...validateConditionStructure(cond.condition, context));
  }

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
  const nodesMap = new Map<string, FrameworkNode[]>();
  const duplicatedIds = new Set<string>();
  nodes.forEach((node) => {
    const nodes = nodesMap.get(node.id);
    if (nodes) {
      duplicatedIds.add(node.id);
      nodesMap.set(node.id, [...nodes, node]);
    } else {
      nodesMap.set(node.id, [node]);
    }
  });

  duplicatedIds.forEach((id) => {
    errors.push({
      code: 'duplicate-node-id',
      category: 'node',
      message: `Duplicate node id "${id}" found in nodes: ${nodesMap
        .get(id)
        ?.map((n) => JSON.stringify(n))
        .join(', ')}`,
    });
  });

  // 2. Check that there is at least one start node
  const startNodes = nodes.filter((node) => node.type === 'start');
  if (startNodes.length === 0) {
    errors.push({
      code: 'missing-start',
      category: 'node',
      message: 'Flow has no start node',
      nodeType: 'start',
    });
  }

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

function checkEdgeWiring(flow: ExperimentFlow): ValidationError[] {
  const errors: ValidationError[] = [];
  const pushEdgeError = (code: string, message: string) =>
    errors.push({ code, category: 'edge', message });
  const pushBranchError = (code: string, message: string) =>
    errors.push({ code, category: 'branch', message });
  const nodeMap = new Map(flow.nodes.map((n) => [n.id, n]));

  // Per-node checks
  for (const node of flow.nodes) {
    switch (node.type) {
      case 'start': {
        const count = flow.edges.filter(
          (e) => e.type === 'sequential' && e.from === node.id,
        ).length;
        if (count === 0) {
          pushEdgeError(
            'missing-edge',
            `Start node "${node.id}" has no sequential outgoing edge`,
          );
        }
        break;
      }

      case 'checkpoint': {
        const count = flow.edges.filter(
          (e) => e.type === 'sequential' && e.from === node.id,
        ).length;
        if (count > 1) {
          pushEdgeError(
            'ambiguous-edge',
            `Checkpoint "${node.id}" has ${count} sequential outgoing edges; at most one is allowed`,
          );
        }
        break;
      }

      case 'branch': {
        const hasDefault = flow.edges.some(
          (e) => e.type === 'branch-default' && e.from === node.id,
        );
        if (!hasDefault) {
          pushEdgeError(
            'missing-edge',
            `Branch "${node.id}" has no branch-default edge`,
          );
        }
        for (const branch of node.props.branches) {
          const hasConditionEdge = flow.edges.some(
            (e) =>
              e.type === 'branch-condition' &&
              e.from === `${node.id}.${branch.id}`,
          );
          if (!hasConditionEdge) {
            pushBranchError(
              'unrouted-branch',
              `Branch "${node.id}" has condition "${branch.id}" with no corresponding branch-condition edge`,
            );
          }
          errors.push(
            ...validateConditionStructure(
              branch.config,
              `Branch "${node.id}" condition "${branch.id}"`,
            ),
          );
        }
        break;
      }

      case 'fork': {
        if (node.props.forks.length < 2) {
          pushEdgeError(
            'missing-edge',
            `Fork "${node.id}" must have at least two arms; found ${node.props.forks.length}`,
          );
        }
        for (const fork of node.props.forks) {
          const hasForkEdge = flow.edges.some(
            (e) => e.type === 'fork-edge' && e.from === `${node.id}.${fork.id}`,
          );
          if (!hasForkEdge) {
            pushEdgeError(
              'missing-edge',
              `Fork "${node.id}" has fork "${fork.id}" with no corresponding fork-edge`,
            );
          }
        }
        break;
      }

      case 'path': {
        const hasChildren = flow.edges.some(
          (e) => e.type === 'path-contains' && e.from === node.id,
        );
        if (!hasChildren) {
          pushEdgeError(
            'missing-edge',
            `Path "${node.id}" has no path-contains edges`,
          );
        }
        const seqCount = flow.edges.filter(
          (e) => e.type === 'sequential' && e.from === node.id,
        ).length;
        if (seqCount === 0) {
          pushEdgeError(
            'missing-edge',
            `Path "${node.id}" has no sequential exit edge`,
          );
        } else if (seqCount > 1) {
          pushEdgeError(
            'ambiguous-edge',
            `Path "${node.id}" has ${seqCount} sequential exit edges; exactly one is required`,
          );
        }
        break;
      }

      case 'loop': {
        const count = flow.edges.filter(
          (e) => e.type === 'loop-template' && e.from === node.id,
        ).length;
        if (count === 0) {
          pushEdgeError(
            'missing-edge',
            `Loop "${node.id}" has no loop-template edge`,
          );
        } else if (count > 1) {
          pushEdgeError(
            'duplicate-edge',
            `Loop "${node.id}" has ${count} loop-template edges; exactly one is required`,
          );
        }
        break;
      }
    }
  }

  // Per-edge checks
  for (const edge of flow.edges) {
    switch (edge.type) {
      case 'branch-condition': {
        const [nodeId, branchId] = edge.from.split('.');
        const node = nodeMap.get(nodeId);
        if (
          node?.type === 'branch' &&
          !node.props.branches.some((b) => b.id === branchId)
        ) {
          pushEdgeError(
            'invalid-edge',
            `Branch-condition edge "${edge.from}" references non-existent branch id "${branchId}"`,
          );
        }
        break;
      }

      case 'fork-edge': {
        const [nodeId, forkId] = edge.from.split('.');
        const node = nodeMap.get(nodeId);
        if (
          node?.type === 'fork' &&
          !node.props.forks.some((f) => f.id === forkId)
        ) {
          pushEdgeError(
            'invalid-edge',
            `Fork-edge "${edge.from}" references non-existent fork id "${forkId}"`,
          );
        }
        break;
      }

      case 'path-contains': {
        const node = nodeMap.get(edge.from);
        if (node && node.type !== 'path') {
          pushEdgeError(
            'invalid-edge',
            `Path-contains edge from "${edge.from}" does not source from a path node`,
          );
        }
        break;
      }

      case 'loop-template': {
        const node = nodeMap.get(edge.from);
        if (node && node.type !== 'loop') {
          pushEdgeError(
            'invalid-edge',
            `Loop-template edge from "${edge.from}" does not source from a loop node`,
          );
        }
        break;
      }
    }
  }

  return errors;
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
