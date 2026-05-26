import { ScreenComponent } from './components';
import { Condition } from './conditions';
import { Formula } from './nodes';
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

function checkNodeIdentity(flow: ExperimentFlow): ValidationError[] {
  const errors: ValidationError[] = [];
  const pushNodeError = (code: string, message: string) =>
    errors.push({ code, category: 'node', message });

  const seen = new Set<string>();
  for (const node of flow.nodes) {
    if (seen.has(node.id)) {
      pushNodeError('duplicate-node-id', `Duplicate node id "${node.id}"`);
    }
    seen.add(node.id);
  }

  const starts = flow.nodes.filter((n) => n.type === 'start');
  if (starts.length === 0) {
    pushNodeError('missing-start', 'Flow has no start node');
  }

  return errors;
}

function checkEdgeEndpoints(flow: ExperimentFlow): ValidationError[] {
  const errors: ValidationError[] = [];
  const pushEdgeError = (code: string, message: string) =>
    errors.push({ code, category: 'edge', message });
  const nodeIds = new Set(flow.nodes.map((n) => n.id));

  for (const edge of flow.edges) {
    const fromNodeId = edge.from.split('.')[0];
    if (!nodeIds.has(fromNodeId)) {
      pushEdgeError(
        'unknown-node',
        `Edge references unknown source node "${fromNodeId}" as source`,
      );
    }
    if (!nodeIds.has(edge.to)) {
      pushEdgeError(
        'unknown-node',
        `Edge references unknown target node "${edge.to}" as target`,
      );
    }
  }

  return errors;
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

function checkScreenDefinitions(flow: ExperimentFlow): ValidationError[] {
  const errors: ValidationError[] = [];
  const pushScreenError = (code: string, message: string) =>
    errors.push({ code, category: 'screen', message });
  const screens = flow.screens ?? [];

  // Screen nodes must have a matching definition
  const slugSet = new Set(screens.map((s) => s.slug));
  for (const node of flow.nodes) {
    if (node.type === 'screen' && !slugSet.has(node.props.slug)) {
      pushScreenError(
        'missing-screen',
        `Screen node "${node.id}" references slug "${node.props.slug}" with no screen definition`,
      );
    }
  }

  // Screen slugs must be unique
  const seenSlugs = new Set<string>();
  for (const screen of screens) {
    if (seenSlugs.has(screen.slug)) {
      pushScreenError(
        'duplicate-screen',
        `Duplicate screen definition for slug "${screen.slug}"`,
      );
    }
    seenSlugs.add(screen.slug);
  }

  // Screen definitions must be referenced by at least one screen node
  const referencedSlugs = new Set(
    flow.nodes
      .filter(
        (n): n is Extract<(typeof flow.nodes)[number], { type: 'screen' }> =>
          n.type === 'screen',
      )
      .map((n) => n.props.slug),
  );
  for (const screen of screens) {
    if (!referencedSlugs.has(screen.slug)) {
      pushScreenError(
        'unreferenced-screen',
        `Screen definition "${screen.slug}" is not referenced by any screen node`,
      );
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

function checkComponentTemplates(flow: ExperimentFlow): ValidationError[] {
  const errors: ValidationError[] = [];
  const pushComponentError = (code: string, message: string) =>
    errors.push({ code, category: 'component', message });

  function checkComponent(component: ScreenComponent, screenSlug: string) {
    const { componentFamily, template } = component;
    const validTemplates = VALID_TEMPLATES[componentFamily];
    if (!validTemplates) {
      pushComponentError(
        'unknown-template',
        `Screen "${screenSlug}" uses unknown componentFamily "${componentFamily}"`,
      );
    } else if (!validTemplates.has(template)) {
      pushComponentError(
        'unknown-template',
        `Screen "${screenSlug}" uses unknown template "${template}" for componentFamily "${componentFamily}"`,
      );
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

function checkSharedOptionReferences(flow: ExperimentFlow): ValidationError[] {
  const errors: ValidationError[] = [];
  const pushReferenceError = (code: string, message: string) =>
    errors.push({ code, category: 'reference', message });
  const definedOptions = new Set(Object.keys(flow.options ?? {}));

  function checkComponent(component: ScreenComponent, screenSlug: string) {
    const props = component.props as Record<string, unknown>;
    if (typeof props.options === 'string' && props.options.startsWith('%')) {
      const name = props.options.slice(1);
      // For templated option references like '%mirada-{{@loop.value}}':
      // - Static validation cannot fully validate the resolved keys (e.g., 'mirada-1', 'mirada-2', ...)
      // - The actual validation happens at runtime when resolveOptionsSource() evaluates the template
      // - We only check non-templated references here (those without '{{')
      if (!definedOptions.has(name) && !name.includes('{{')) {
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
    ...checkNodeIdentity(flow),
    ...checkEdgeEndpoints(flow),
    ...checkEdgeWiring(flow),
    ...checkScreenDefinitions(flow),
    ...checkReferences(flow),
    ...checkSharedOptionReferences(flow),
    ...checkComponentTemplates(flow),
  ];
}
