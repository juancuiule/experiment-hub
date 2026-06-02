import { collectFields, Field, isButtonPayload, isOrderMarker } from '../fields';
import { getDefaultBranchNode } from '../flow/graph';
import { Formula } from '../nodes';
import { ExperimentFlow } from '../types';
import { conditionToText, describeField } from './describe';
import {
  Codebook,
  CodebookVariable,
  FieldType,
  OptionsRef,
  Repetition,
} from './types';
import { LoopRepetition, ScreenOccurrence, walkExperiment } from './walk';

// Cap how many inline pool values are listed before summarizing the rest.
const POOL_LIMIT = 20;

type Primitive = string | number | boolean;

function optionFromValue(v: Primitive): { value: string; label: string } {
  const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
  return { value: s, label: s };
}

// Renders an inline array as option rows, capped with a "+N more" marker.
function poolOptions(items: unknown[]): { value: string; label: string }[] {
  const shown = items.slice(0, POOL_LIMIT).map((v) => optionFromValue(v as Primitive));
  if (items.length > POOL_LIMIT) {
    shown.push({ value: '…', label: `+${items.length - POOL_LIMIT} more` });
  }
  return shown;
}

// Static metadata derived from a compute formula: its output type, the
// statically-known value domain (lookup bands, conditional branches) or sampled
// pool (inline-array sample/split), and a short description.
type ComputeMeta = {
  type: FieldType;
  options?: { value: string; label: string }[] | OptionsRef;
  description?: string;
};

function describeCompute(formula: Formula): ComputeMeta {
  switch (formula.type) {
    case 'sum':
    case 'mean':
    case 'min':
    case 'max':
    case 'count':
    case 'loop-aggregate':
      return { type: 'number' };

    case 'lookup': {
      const values: Primitive[] = formula.table.map((e) => e.then);
      if (formula.default != null) values.push(formula.default);
      return { type: 'enum', options: values.map(optionFromValue) };
    }

    case 'conditional': {
      const { then, else: otherwise } = formula;
      const bothNumber =
        typeof then === 'number' && typeof otherwise === 'number';
      const bothBoolean =
        typeof then === 'boolean' && typeof otherwise === 'boolean';
      return {
        type: bothNumber ? 'number' : bothBoolean ? 'boolean' : 'enum',
        options: [optionFromValue(then), optionFromValue(otherwise)],
      };
    }

    case 'sample':
    case 'split': {
      if (Array.isArray(formula.input)) {
        return {
          type: 'unknown',
          options: poolOptions(formula.input),
          description: `${formula.type === 'sample' ? 'Random sample' : 'Bins'} from a ${formula.input.length}-item static pool`,
        };
      }
      return {
        type: 'unknown',
        options: { ref: formula.input },
        description: `${formula.type === 'sample' ? 'Random sample' : 'Bins'} drawn from ${formula.input}`,
      };
    }

    default:
      // collect-loop → an object keyed by field; no single scalar domain.
      return { type: 'unknown' };
  }
}

// Combines a field's own (within-screen) for-each loops with the enclosing
// loop-node repetition into a single Repetition descriptor.
function repetitionFor(
  field: Field,
  loop: LoopRepetition | undefined,
): Repetition {
  const foreach = field.kind === 'dynamic' ? field.loops : [];
  const enclosingDynamic = loop?.kind === 'dynamic' ? loop : undefined;

  if (foreach.length > 0 || enclosingDynamic) {
    const loopIds = [
      ...(enclosingDynamic ? [enclosingDynamic.loopId] : []),
      ...foreach.map((l) => l.id),
    ];
    const over =
      foreach.length > 0 ? foreach[foreach.length - 1].dataKey : enclosingDynamic!.over;
    return { kind: 'dynamic', over, loopIds };
  }
  if (loop?.kind === 'static') return { kind: 'static', count: loop.count };
  return { kind: 'none' };
}

function fieldToVariable(field: Field, occ: ScreenOccurrence): CodebookVariable {
  const fieldKey = field.kind === 'static' ? field.key : field.keyTemplate;
  const key = [...occ.dataPath, occ.slug, fieldKey].join('.');
  const base: CodebookVariable = {
    section: 'collected',
    key,
    repetition: repetitionFor(field, occ.loop),
    type: 'unknown',
    screen: occ.slug,
    nodePath: occ.dataPath,
  };

  if (isButtonPayload(field.source)) {
    return { ...base, template: 'button-payload', description: 'Button click payload' };
  }
  if (isOrderMarker(field.source)) {
    return {
      ...base,
      type: 'string[]',
      template: 'order',
      description: `Presentation order for ${field.source.ref.props.dataKey}`,
    };
  }

  const d = describeField(field.source);
  const variable: CodebookVariable = {
    ...base,
    type: d.type,
    template: field.source.template,
    label: d.label,
    required: d.required,
  };
  if (d.options) variable.options = d.options;
  if (d.constraints) variable.constraints = d.constraints;
  if (field.gate) variable.conditional = conditionToText(field.gate);
  return variable;
}

export function generateCodebook(
  experiment: ExperimentFlow,
  experimentSlug?: string,
): Codebook {
  const { screens, computes, visitedNodeIds } = walkExperiment(experiment);
  const screenBySlug = new Map(
    (experiment.screens ?? []).map((s) => [s.slug, s]),
  );

  // ── Collected ──────────────────────────────────────────────────────────────
  const collected: CodebookVariable[] = [];
  for (const occ of screens) {
    const screen = screenBySlug.get(occ.slug);
    if (!screen) continue;
    for (const field of collectFields(screen.components, occ.context)) {
      collected.push(fieldToVariable(field, occ));
    }
  }

  // ── Derived (compute outputs) ────────────────────────────────────────────────
  const derived: CodebookVariable[] = [];
  for (const { node, dataPath } of computes) {
    for (const c of node.props.computations) {
      const meta = describeCompute(c.formula);
      const variable: CodebookVariable = {
        section: 'derived',
        key: [...dataPath, node.id, c.outputKey].join('.'),
        repetition: { kind: 'none' },
        type: meta.type,
        template: `compute:${c.formula.type}`,
        description: meta.description ?? node.props.name,
        nodePath: dataPath,
      };
      if (meta.options) variable.options = meta.options;
      derived.push(variable);
    }
  }

  // ── System / metadata ────────────────────────────────────────────────────────
  const system: CodebookVariable[] = [];
  const startNodes = experiment.nodes.filter((n) => n.type === 'start');
  if (startNodes.length > 1) {
    const groups = startNodes
      .map((n) => (n.type === 'start' && n.props?.name) || n.id)
      .join(', ');
    system.push({
      section: 'system',
      key: 'start.group',
      repetition: { kind: 'none' },
      type: 'string',
      template: 'system:assignment',
      description: `Assigned start group (${groups})`,
    });
  }

  for (const node of experiment.nodes) {
    if (!visitedNodeIds.has(node.id)) continue;
    if (node.type === 'branch') {
      system.push({
        section: 'system',
        key: `branches.${node.id}`,
        repetition: { kind: 'none' },
        type: 'enum',
        template: 'system:branch',
        description: node.props.name,
        options: [
          ...node.props.branches.map((b) => ({ value: b.id, label: b.name })),
          // Only when a branch-default edge actually exists can "default" occur.
          ...(getDefaultBranchNode(experiment, node.id)
            ? [{ value: 'default', label: 'Default' }]
            : []),
        ],
      });
    } else if (node.type === 'fork') {
      system.push({
        section: 'system',
        key: `forks.${node.id}`,
        repetition: { kind: 'none' },
        type: 'enum',
        template: 'system:fork',
        description: node.props.name,
        options: node.props.forks.map((f) => ({ value: f.id, label: f.name })),
      });
    } else if (node.type === 'path' && node.props.randomized) {
      system.push({
        section: 'system',
        key: `paths.${node.id}.order`,
        repetition: { kind: 'none' },
        type: 'string[]',
        template: 'system:order',
        description: `Randomized step order of path "${node.props.name}"`,
      });
    } else if (node.type === 'loop' && node.props.randomized) {
      system.push({
        section: 'system',
        key: `loops.${node.id}.order`,
        repetition: { kind: 'none' },
        type: 'string[]',
        template: 'system:order',
        description: `Randomized iteration order of loop "${node.id}"`,
      });
    } else if (node.type === 'checkpoint') {
      system.push({
        section: 'system',
        key: `checkpoints.${node.props.name}`,
        repetition: { kind: 'none' },
        type: 'string',
        template: 'system:checkpoint',
        description: 'ISO timestamp recorded when the checkpoint is passed',
      });
    }
  }

  // Per-screen timing pair (enteredAt/submittedAt), keyed like buildTimingKey.
  const timingKeys = new Set<string>();
  for (const occ of screens) {
    const key = `timings.${[...occ.dataPath, occ.slug].join('/')}`;
    if (timingKeys.has(key)) continue;
    timingKeys.add(key);
    system.push({
      section: 'system',
      key,
      repetition: occ.loop
        ? occ.loop.kind === 'static'
          ? { kind: 'static', count: occ.loop.count }
          : { kind: 'dynamic', over: occ.loop.over, loopIds: [occ.loop.loopId] }
        : { kind: 'none' },
      type: 'unknown',
      template: 'system:timing',
      description: 'enteredAt / submittedAt timestamps for the screen',
    });
  }

  return { experimentSlug, collected, derived, system };
}
