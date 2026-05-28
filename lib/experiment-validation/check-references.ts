import { ScreenComponent } from '../components';
import { Condition } from '../conditions';
import { FrameworkEdge } from '../edges';
import { Formula } from '../nodes';
import { resolveValuesInString } from '../resolve';
import { Context, ExperimentFlow } from '../types';
import { ValidationError } from './types';

export function collectConditionDataKeys(cond: Condition): string[] {
  if (cond.type === 'simple') return [cond.dataKey];
  if (cond.type === 'and' || cond.type === 'or') {
    return cond.conditions.flatMap(collectConditionDataKeys);
  }
  if (cond.type === 'not') return collectConditionDataKeys(cond.condition);
  return [];
}

type EdgeMaps = {
  seqNext: Map<string, string>;
  branchForkTargets: Map<string, string[]>;
  pathChildren: Map<string, { to: string; order: number }[]>;
  loopTemplateOf: Map<string, string>;
};

function buildEdgeMaps(edges: FrameworkEdge[]): EdgeMaps {
  const seqNext = new Map<string, string>();
  const branchForkTargets = new Map<string, string[]>();
  const pathChildren = new Map<string, { to: string; order: number }[]>();
  const loopTemplateOf = new Map<string, string>();

  for (const edge of edges) {
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

  return { seqNext, branchForkTargets, pathChildren, loopTemplateOf };
}

function extractTokens(text: string): string[] {
  const wrapped = [...text.matchAll(/\{\{(\$\$|@)([\w.\-]+)\}\}/g)].map(
    (m) => `${m[1]}${m[2]}`,
  );
  if (wrapped.length > 0) return wrapped;
  const m = text.match(/^(\$\$|@)([\w.\-]+)$/);
  return m ? [`${m[1]}${m[2]}`] : [];
}

function checkText(
  text: string,
  context: string,
  available: Set<string>,
  insideLoop: boolean,
  errors: ValidationError[],
) {
  for (const token of extractTokens(text)) {
    if (token.startsWith('@')) {
      if (!insideLoop) {
        errors.push({
          code: 'invalid-reference',
          category: 'reference',
          message: `${context} uses "${token}" but is not inside a loop`,
        });
      }
    } else {
      const path = token.slice(2);
      const ok = [...available].some(
        (a) => path === a || path.startsWith(a + '.'),
      );
      if (!ok) {
        errors.push({
          code: 'unavailable-reference',
          category: 'reference',
          message: `${context} references "${token}" but that data is not guaranteed to be available at this point`,
        });
      }
    }
  }
  const hasWrapped = /\{\{(?:\$\$|@)[\w.\-]+\}\}/.test(text);
  const isWholeBare = /^(?:\$\$|@)[\w.\-]+$/.test(text);
  if (!hasWrapped && !isWholeBare) {
    for (const m of text.matchAll(/\$\$([\w.\-]+)/g)) {
      errors.push({
        code: 'unwrapped-token',
        category: 'reference',
        message: `${context} contains "$$${m[1]}" without {{…}} — it will not be interpolated at runtime`,
      });
    }
  }
}

function checkFormulaInput(
  input: string,
  context: string,
  available: Set<string>,
  nodeOutputs: Set<string>,
  insideLoop: boolean,
  errors: ValidationError[],
) {
  if (input.startsWith('$') && !input.startsWith('$$')) {
    const key = input.slice(1);
    if (!nodeOutputs.has(key)) {
      errors.push({
        code: 'unavailable-reference',
        category: 'reference',
        message: `${context} uses "$${key}" but that output is not yet defined earlier in the same compute node`,
      });
    }
  } else {
    checkText(input, context, available, insideLoop, errors);
  }
}

function checkFormulaInputs(
  formula: Formula,
  context: string,
  available: Set<string>,
  nodeOutputs: Set<string>,
  insideLoop: boolean,
  errors: ValidationError[],
) {
  switch (formula.type) {
    case 'sum':
    case 'mean':
    case 'min':
    case 'max': {
      for (const inp of formula.inputs) {
        checkFormulaInput(
          inp,
          context,
          available,
          nodeOutputs,
          insideLoop,
          errors,
        );
      }
      break;
    }
    case 'count': {
      for (const inp of formula.inputs) {
        checkFormulaInput(
          inp,
          context,
          available,
          nodeOutputs,
          insideLoop,
          errors,
        );
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
              errors,
            );
          }
        }
      }
      break;
    }
    case 'conditional': {
      for (const key of collectConditionDataKeys(formula.condition)) {
        checkFormulaInput(
          key,
          context,
          available,
          nodeOutputs,
          insideLoop,
          errors,
        );
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
        errors,
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
          errors,
        );
      }
      break;
    }
  }
}

export function checkReferences(flow: ExperimentFlow): ValidationError[] {
  const rawErrors: ValidationError[] = [];
  const nodeMap = new Map(flow.nodes.map((n) => [n.id, n]));
  const screenMap = new Map((flow.screens ?? []).map((s) => [s.slug, s]));
  const { seqNext, branchForkTargets, pathChildren, loopTemplateOf } =
    buildEdgeMaps(flow.edges);

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
            for (const field of ['label', 'content', 'text'] as const) {
              if (typeof props[field] === 'string') {
                checkText(
                  props[field] as string,
                  screenLabel,
                  current,
                  insideLoop,
                  rawErrors,
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
            rawErrors.push({
              code: 'duplicate-output-key',
              category: 'node',
              message: `Compute "${nodeId}" has duplicate outputKey "${outputKey}"`,
            });
          }
          seenOutputKeys.add(outputKey);
          if (formula.type === 'lookup') {
            const seenWhen = new Set<number>();
            for (const entry of formula.table) {
              const key = Number(entry.when);
              if (seenWhen.has(key)) {
                rawErrors.push({
                  code: 'duplicate-lookup-key',
                  category: 'node',
                  message: `Compute "${nodeId}" output "${outputKey}" has duplicate lookup key "${entry.when}"`,
                });
              }
              seenWhen.add(key);
            }
          }
          if (
            formula.type === 'sample' &&
            (!Number.isInteger(formula.n) || formula.n <= 0)
          ) {
            rawErrors.push({
              code: 'invalid-sample-size',
              category: 'node',
              message: `Compute "${nodeId}" output "${outputKey}" has sample size n="${formula.n}", but n must be a positive integer`,
            });
          }
          checkFormulaInputs(
            formula,
            nodeLabel,
            current,
            nodeOutputs,
            insideLoop,
            rawErrors,
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
              rawErrors,
            );
          }
        }
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

  const seen = new Set<string>();
  return rawErrors.filter((e) => {
    const key = `${e.code}:${e.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
