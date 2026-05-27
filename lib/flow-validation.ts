import { Handlers, on, flatMap as walkComponentTree } from './component-walker';
import { ScreenComponent } from './components';
import { Condition } from './conditions';
import { FrameworkEdge } from './edges';
import { Formula, FrameworkNode } from './nodes';
import { resolveValuesInString } from './resolve';
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

function checkNodes(flow: ExperimentFlow): ValidationError[] {
  const errors: ValidationError[] = [];

  const startNodes = flow.nodes.filter((node) => node.type === 'start');
  if (startNodes.length === 0) {
    errors.push({
      code: 'missing-start',
      category: 'node',
      message: 'Flow has no start node',
    });
  }

  const ids = new Map<string, FrameworkNode>();
  const duplicateIds = new Set<string>();

  flow.nodes.forEach((node) => {
    if (ids.has(node.id)) {
      duplicateIds.add(node.id);
    } else {
      ids.set(node.id, node);
    }
  });

  duplicateIds.forEach((id) => {
    const nodes = flow.nodes.filter((node) => node.id === id);
    errors.push({
      code: 'duplicate-node-id',
      category: 'node',
      message: `Duplicate node id "${id}" found in nodes: ${nodes.map((_) => JSON.stringify(_, null, 2)).join('\n\n')}`,
    });
  });

  return errors;
}

function checkEdgeEndpoints(flow: ExperimentFlow): ValidationError[] {
  const errors: ValidationError[] = [];

  const ids = new Set(flow.nodes.map((node) => node.id));

  flow.edges.forEach((edge) => {
    const from = edge.from.split('.')[0];
    if (!ids.has(from)) {
      errors.push({
        code: 'unknown-node',
        category: 'edge',
        message: `Edge "from" references non-existent node id "${from}". ${JSON.stringify(edge, null, 2)}`,
      });
    }

    const to = edge.to.split('.')[0];
    if (!ids.has(to)) {
      errors.push({
        code: 'unknown-node',
        category: 'edge',
        message: `Edge "to" references non-existent node id "${to}".`,
      });
    }
  });

  return errors;
}

function checkEdgeWiring(flow: ExperimentFlow): ValidationError[] {
  const errors: ValidationError[] = [];
  const pushEdgeError = (code: string, message: string) =>
    errors.push({ code, category: 'edge', message });
  const pushBranchError = (code: string, message: string) =>
    errors.push({ code, category: 'branch', message });

  const nodeMap = new Map(flow.nodes.map((n) => [n.id, n]));

  // Pre-index edges by `from` to avoid O(n×m) scanning inside the per-node loop.
  // checkReferences already uses this pattern for its traversal maps; we mirror it here.
  const edgesByFrom = new Map<string, FrameworkEdge[]>();
  for (const edge of flow.edges) {
    const list = edgesByFrom.get(edge.from);
    if (list) list.push(edge);
    else edgesByFrom.set(edge.from, [edge]);
  }
  const fromEdges = (id: string): FrameworkEdge[] => edgesByFrom.get(id) ?? [];
  const countEdgeType = (id: string, type: string) =>
    fromEdges(id).filter((e) => e.type === type).length;
  const hasEdgeType = (id: string, type: string) =>
    fromEdges(id).some((e) => e.type === type);

  for (const node of flow.nodes) {
    switch (node.type) {
      case 'start': {
        const count = countEdgeType(node.id, 'sequential');
        if (count === 0) {
          pushEdgeError(
            'missing-edge',
            `Start node "${node.id}" has no sequential outgoing edge`,
          );
        }
        break;
      }

      case 'checkpoint': {
        const count = countEdgeType(node.id, 'sequential');
        if (count > 1) {
          pushEdgeError(
            'ambiguous-edge',
            `Checkpoint "${node.id}" has ${count} sequential outgoing edges; at most one is allowed`,
          );
        }
        break;
      }

      case 'branch': {
        if (!hasEdgeType(node.id, 'branch-default')) {
          pushEdgeError(
            'missing-edge',
            `Branch "${node.id}" has no branch-default edge`,
          );
        }
        for (const branch of node.props.branches) {
          if (!hasEdgeType(`${node.id}.${branch.id}`, 'branch-condition')) {
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
          if (!hasEdgeType(`${node.id}.${fork.id}`, 'fork-edge')) {
            pushEdgeError(
              'missing-edge',
              `Fork "${node.id}" has fork "${fork.id}" with no corresponding fork-edge`,
            );
          }
        }
        break;
      }

      case 'path': {
        if (!hasEdgeType(node.id, 'path-contains')) {
          pushEdgeError(
            'missing-edge',
            `Path "${node.id}" has no path-contains edges`,
          );
        }
        const count = countEdgeType(node.id, 'sequential');
        if (count === 0) {
          pushEdgeError(
            'missing-edge',
            `Path "${node.id}" has no sequential exit edge`,
          );
        } else if (count > 1) {
          pushEdgeError(
            'ambiguous-edge',
            `Path "${node.id}" has ${count} sequential exit edges; exactly one is required`,
          );
        }
        break;
      }

      case 'loop': {
        const templateCount = countEdgeType(node.id, 'loop-template');
        if (templateCount === 0) {
          pushEdgeError(
            'missing-edge',
            `Loop "${node.id}" has no loop-template edge`,
          );
        } else if (templateCount > 1) {
          pushEdgeError(
            'duplicate-edge',
            `Loop "${node.id}" has ${templateCount} loop-template edges; exactly one is required`,
          );
        }
        break;
      }
    }
  }

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

function checkScreenDefinitions(flow: ExperimentFlow): ValidationError[] {
  const errors: ValidationError[] = [];
  const pushScreenError = (code: string, message: string) =>
    errors.push({ code, category: 'screen', message });
  const screens = flow.screens ?? [];

  const slugSet = new Set(screens.map((s) => s.slug));
  // Collect referencedSlugs in the same pass that checks for missing-screen,
  // eliminating a separate O(n) scan over nodes.
  const referencedSlugs = new Set<string>();
  for (const node of flow.nodes) {
    if (node.type === 'screen') {
      referencedSlugs.add(node.props.slug);
      if (!slugSet.has(node.props.slug)) {
        pushScreenError(
          'missing-screen',
          `Screen node "${node.id}" references slug "${node.props.slug}" with no screen definition`,
        );
      }
    }
  }

  const seenSlugs = new Set<string>();
  for (const screen of screens) {
    if (seenSlugs.has(screen.slug)) {
      pushScreenError(
        'duplicate-screen',
        `Duplicate screen definition for slug "${screen.slug}"`,
      );
    }
    seenSlugs.add(screen.slug);
    if (!referencedSlugs.has(screen.slug)) {
      pushScreenError(
        'unreferenced-screen',
        `Screen definition "${screen.slug}" is not referenced by any screen node`,
      );
    }
  }

  return errors;
}

function checkReachability(flow: ExperimentFlow): ValidationError[] {
  const errors: ValidationError[] = [];
  const startNodes = flow.nodes.filter((n) => n.type === 'start');
  if (startNodes.length === 0) return errors;

  // Build full adjacency from all edges (strip compound ids like "branch.arm" to base node id)
  const adjacency = new Map<string, string[]>();
  for (const edge of flow.edges) {
    const from = edge.from.split('.')[0];
    const to = edge.to.split('.')[0];
    const list = adjacency.get(from);
    if (list) list.push(to);
    else adjacency.set(from, [to]);
  }

  const reachable = new Set<string>();
  const queue = startNodes.map((n) => n.id);
  while (queue.length > 0) {
    const nodeId = queue.shift()!;
    if (reachable.has(nodeId)) continue;
    reachable.add(nodeId);
    for (const target of adjacency.get(nodeId) ?? []) {
      if (!reachable.has(target)) queue.push(target);
    }
  }

  for (const node of flow.nodes) {
    if (!reachable.has(node.id)) {
      errors.push({
        code: 'unreachable-node',
        category: 'node',
        message: `Node "${node.id}" (${node.type}) is unreachable from any start node`,
      });
    }
  }

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
        let ok = false;
        for (const a of available) {
          if (path === a || path.startsWith(a + '.')) {
            ok = true;
            break;
          }
        }
        if (!ok) {
          pushReferenceError(
            'unavailable-reference',
            `${context} references "${token}" but that data is not guaranteed to be available at this point`,
          );
        }
      }
    }
    // Detect bare $$... not inside {{…}} wrappers — they won't be interpolated at runtime.
    // Strip {{…}} sections first so their contents don't trigger false positives.
    const isWholeBare = /^(?:\$\$|@)[\w.\-]+$/.test(text);
    if (!isWholeBare) {
      const stripped = text.replace(/\{\{[^}]*\}\}/g, '');
      for (const m of stripped.matchAll(/\$\$([\w.\-]+)/g)) {
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
      case 'count-correct': {
        // Validate the $$-prefixed items array reference
        checkText(formula.itemsKey, context, available, insideLoop);
        // Validate that loopId points to a real loop node
        const loopNode = nodeMap.get(formula.loopId);
        if (!loopNode) {
          pushReferenceError(
            'unavailable-reference',
            `${context} count-correct formula references non-existent loop node "${formula.loopId}"`,
          );
        } else if (loopNode.type !== 'loop') {
          pushReferenceError(
            'invalid-reference',
            `${context} count-correct formula "loopId" "${formula.loopId}" must reference a loop node, but it is a ${loopNode.type} node`,
          );
        }
        break;
      }
    }
  }

  // available: dot-joined data paths guaranteed to be written up to this point
  // dataPath: nesting context for how screen data is stored (e.g. ["path-profile"])
  // insideLoop: whether we are walking a loop template subgraph
  // pathVisited: nodes visited on the current traversal path — guards against sequential cycles
  function walk(
    nodeId: string,
    available: Set<string>,
    dataPath: string[],
    insideLoop: boolean,
    pathVisited: Set<string> = new Set(),
  ): Set<string> {
    // Guard: a cycle in the sequential/path graph would cause infinite recursion.
    // Each branch/fork arm receives a copy of pathVisited so sibling arms are independent.
    if (pathVisited.has(nodeId)) return available;
    const visited = new Set(pathVisited);
    visited.add(nodeId);

    const node = nodeMap.get(nodeId);
    if (!node) return available;

    const current = new Set(available);

    switch (node.type) {
      case 'start':
      case 'checkpoint': {
        const next = seqNext.get(nodeId);
        if (next) return walk(next, current, dataPath, insideLoop, visited);
        break;
      }

      case 'screen': {
        const screen = screenMap.get(node.props.slug);
        if (screen) {
          const prefix = [...dataPath, node.props.slug].join('.');
          const screenLabel = `Screen "${node.props.slug}"`;

          function processComponent(component: ScreenComponent, ctx: Context) {
            const props = component.props as Record<string, unknown>;
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
        if (next) return walk(next, current, dataPath, insideLoop, visited);
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
        if (next) return walk(next, current, dataPath, insideLoop, visited);
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
            visited,
          );
        }
        childAvailable.forEach((k) => current.add(k));
        const next = seqNext.get(nodeId);
        if (next) return walk(next, current, dataPath, insideLoop, visited);
        break;
      }

      case 'loop': {
        // Validate dynamic dataKey against the data available at this point in the graph
        if (node.props.type === 'dynamic') {
          checkText(
            node.props.dataKey,
            `Loop "${nodeId}"`,
            current,
            insideLoop,
          );
        }
        // Walk template for @-ref validation only; loop data is dynamically keyed
        // so it is not added to the available set for nodes after the loop.
        const templateId = loopTemplateOf.get(nodeId);
        if (templateId) {
          walk(
            templateId,
            new Set(current),
            [...dataPath, nodeId],
            true,
            visited,
          );
        }
        const next = seqNext.get(nodeId);
        if (next) return walk(next, current, dataPath, insideLoop, visited);
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
        // Each branch arm is an independent sub-walk: data written in one arm is
        // not guaranteed available in another, and cycle detection is per-arm.
        const targets = branchForkTargets.get(nodeId) ?? [];
        for (const target of targets) {
          walk(
            target,
            new Set(current),
            dataPath,
            insideLoop,
            new Set(visited),
          );
        }
        break;
      }

      case 'fork': {
        const targets = branchForkTargets.get(nodeId) ?? [];
        for (const target of targets) {
          walk(
            target,
            new Set(current),
            dataPath,
            insideLoop,
            new Set(visited),
          );
        }
        break;
      }
    }

    return current;
  }

  const startNode = flow.nodes.find((n) => n.type === 'start');
  if (startNode) walk(startNode.id, new Set(), [], false);

  // Deduplicate: the same node may be reached via multiple branch/fork arms,
  // each producing an identical error. Keep the first occurrence of each.
  const seen = new Set<string>();
  return rawErrors.filter((e) => {
    const key = `${e.code}:${e.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const VALID_TEMPLATES: Record<string, Set<string>> = {
  content: new Set(['rich-text', 'image', 'video', 'audio']),
  response: new Set([
    'slider',
    'single-checkbox',
    'text-input',
    'text-area',
    'date-input',
    'time-input',
    'dropdown',
    'radio',
    'checkboxes',
    'numeric-input',
    'likert-scale',
  ]),
  layout: new Set(['button', 'group']),
  control: new Set(['conditional', 'for-each']),
};

// Shared traversal over every component in every screen, applying `onLeaf` to each.
// Container components (group, conditional, for-each) are both passed to `onLeaf`
// and recursed into so their children are also visited.
function forEachComponent(
  flow: ExperimentFlow,
  onLeaf: (component: ScreenComponent, screenSlug: string) => ValidationError[],
): ValidationError[] {
  const handlers: Handlers<ValidationError, string> = [
    on({ componentFamily: 'layout', template: 'group' }, (c, slug, recur) => [
      ...onLeaf(c, slug),
      ...recur(c.props.components, slug),
    ]),
    on(
      { componentFamily: 'control', template: 'conditional' },
      (c, slug, recur) => [
        ...onLeaf(c, slug),
        ...recur([c.props.component], slug),
        ...(c.props.else ? recur([c.props.else], slug) : []),
      ],
    ),
    on(
      { componentFamily: 'control', template: 'for-each' },
      (c, slug, recur) => [
        ...onLeaf(c, slug),
        ...recur([c.props.component], slug),
      ],
    ),
    on({}, (c, slug) => onLeaf(c, slug)),
  ];
  return (flow.screens ?? []).flatMap((screen) =>
    walkComponentTree(screen.components, screen.slug, handlers),
  );
}

function checkComponentTemplates(flow: ExperimentFlow): ValidationError[] {
  return forEachComponent(flow, (component, slug) => {
    const { componentFamily, template } = component;
    const validTemplates = VALID_TEMPLATES[componentFamily];
    if (!validTemplates) {
      return [
        {
          code: 'unknown-template',
          category: 'component',
          message: `Screen "${slug}" uses unknown componentFamily "${componentFamily}"`,
        },
      ];
    }
    if (!validTemplates.has(template)) {
      return [
        {
          code: 'unknown-template',
          category: 'component',
          message: `Screen "${slug}" uses unknown template "${template}" for componentFamily "${componentFamily}"`,
        },
      ];
    }
    return [];
  });
}

function checkSharedOptionReferences(flow: ExperimentFlow): ValidationError[] {
  const definedOptions = new Set(Object.keys(flow.options ?? {}));
  const hasSupportedTemplatePlaceholder =
    /\{\{(?:\$\$|\$|@|#)[a-zA-Z0-9_.\-]+\}\}/;

  return forEachComponent(flow, (component, slug) => {
    const props = component.props as Record<string, unknown>;
    if (typeof props.options === 'string' && props.options.startsWith('%')) {
      const name = props.options.slice(1);
      // For templated option references like '%mirada-{{@loop.value}}':
      // static validation cannot resolve the template; the actual check happens
      // at runtime in resolveOptionsSource(). Skip only for known placeholder syntax.
      if (
        !definedOptions.has(name) &&
        !hasSupportedTemplatePlaceholder.test(name)
      ) {
        return [
          {
            code: 'unknown-shared-options',
            category: 'reference',
            message: `Screen "${slug}" references undefined shared option set "%${name}"`,
          },
        ];
      }
    }
    return [];
  });
}

export function validateExperiment(flow: ExperimentFlow): ValidationError[] {
  return [
    ...checkNodes(flow),
    ...checkEdgeEndpoints(flow),
    ...checkEdgeWiring(flow),
    ...checkReachability(flow),
    ...checkScreenDefinitions(flow),
    ...checkReferences(flow),
    ...checkSharedOptionReferences(flow),
    ...checkComponentTemplates(flow),
  ];
}
