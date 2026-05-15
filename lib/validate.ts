import { Condition } from "./conditions";
import { ExperimentFlow } from "./types";

export type ValidationError = { code: string; message: string };

// ---------------------------------------------------------------------------
// Condition helpers
// ---------------------------------------------------------------------------

function validateConditionStructure(
  cond: Condition,
  context: string,
): ValidationError[] {
  const errors: ValidationError[] = [];

  if (cond.type === "and" || cond.type === "or") {
    if (cond.conditions.length === 0) {
      errors.push({
        code: `condition-empty-${cond.type}`,
        message: `${context} has an "${cond.type}" condition with no children`,
      });
    }
    for (const child of cond.conditions) {
      errors.push(...validateConditionStructure(child, context));
    }
  } else if (cond.type === "not") {
    errors.push(...validateConditionStructure(cond.condition, context));
  }

  return errors;
}

function collectConditionDataKeys(cond: Condition): string[] {
  if (cond.type === "simple") return [cond.dataKey];
  if (cond.type === "and" || cond.type === "or") {
    return cond.conditions.flatMap(collectConditionDataKeys);
  }
  if (cond.type === "not") return collectConditionDataKeys(cond.condition);
  return [];
}

// ---------------------------------------------------------------------------
// 1. Node identity
// ---------------------------------------------------------------------------

function checkNodeIdentity(flow: ExperimentFlow): ValidationError[] {
  const errors: ValidationError[] = [];

  const seen = new Set<string>();
  for (const node of flow.nodes) {
    if (seen.has(node.id)) {
      errors.push({
        code: "duplicate-node-id",
        message: `Duplicate node id "${node.id}"`,
      });
    }
    seen.add(node.id);
  }

  const starts = flow.nodes.filter((n) => n.type === "start");
  if (starts.length === 0) {
    errors.push({ code: "missing-start", message: "Flow has no start node" });
  }

  return errors;
}

// ---------------------------------------------------------------------------
// 2. Edge endpoints
// ---------------------------------------------------------------------------

function checkEdgeEndpoints(flow: ExperimentFlow): ValidationError[] {
  const errors: ValidationError[] = [];
  const nodeIds = new Set(flow.nodes.map((n) => n.id));

  for (const edge of flow.edges) {
    const fromNodeId = edge.from.split(".")[0];
    if (!nodeIds.has(fromNodeId)) {
      errors.push({
        code: "unknown-node",
        message: `Edge references unknown source node "${fromNodeId}" as source`,
      });
    }
    if (!nodeIds.has(edge.to)) {
      errors.push({
        code: "unknown-node",
        message: `Edge references unknown target node "${edge.to}" as target`,
      });
    }
  }

  return errors;
}

// ---------------------------------------------------------------------------
// 3. Node-to-edge wiring
// ---------------------------------------------------------------------------

function checkEdgeWiring(flow: ExperimentFlow): ValidationError[] {
  const errors: ValidationError[] = [];
  const nodeMap = new Map(flow.nodes.map((n) => [n.id, n]));

  // Per-node checks
  for (const node of flow.nodes) {
    switch (node.type) {
      case "start": {
        const count = flow.edges.filter(
          (e) => e.type === "sequential" && e.from === node.id,
        ).length;
        if (count === 0) {
          errors.push({
            code: "missing-edge",
            message: `Start node "${node.id}" has no sequential outgoing edge`,
          });
        }
        break;
      }

      case "checkpoint": {
        const count = flow.edges.filter(
          (e) => e.type === "sequential" && e.from === node.id,
        ).length;
        if (count > 1) {
          errors.push({
            code: "ambiguous-edge",
            message: `Checkpoint "${node.id}" has ${count} sequential outgoing edges; at most one is allowed`,
          });
        }
        break;
      }

      case "branch": {
        const hasDefault = flow.edges.some(
          (e) => e.type === "branch-default" && e.from === node.id,
        );
        if (!hasDefault) {
          errors.push({
            code: "missing-edge",
            message: `Branch "${node.id}" has no branch-default edge`,
          });
        }
        for (const branch of node.props.branches) {
          const hasConditionEdge = flow.edges.some(
            (e) =>
              e.type === "branch-condition" &&
              e.from === `${node.id}.${branch.id}`,
          );
          if (!hasConditionEdge) {
            errors.push({
              code: "unrouted-branch",
              message: `Branch "${node.id}" has condition "${branch.id}" with no corresponding branch-condition edge`,
            });
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

      case "fork": {
        if (node.props.forks.length < 2) {
          errors.push({
            code: "missing-edge",
            message: `Fork "${node.id}" must have at least two arms; found ${node.props.forks.length}`,
          });
        }
        for (const fork of node.props.forks) {
          const hasForkEdge = flow.edges.some(
            (e) => e.type === "fork-edge" && e.from === `${node.id}.${fork.id}`,
          );
          if (!hasForkEdge) {
            errors.push({
              code: "missing-edge",
              message: `Fork "${node.id}" has fork "${fork.id}" with no corresponding fork-edge`,
            });
          }
        }
        break;
      }

      case "path": {
        const hasChildren = flow.edges.some(
          (e) => e.type === "path-contains" && e.from === node.id,
        );
        if (!hasChildren) {
          errors.push({
            code: "missing-edge",
            message: `Path "${node.id}" has no path-contains edges`,
          });
        }
        const seqCount = flow.edges.filter(
          (e) => e.type === "sequential" && e.from === node.id,
        ).length;
        if (seqCount === 0) {
          errors.push({
            code: "missing-edge",
            message: `Path "${node.id}" has no sequential exit edge`,
          });
        } else if (seqCount > 1) {
          errors.push({
            code: "ambiguous-edge",
            message: `Path "${node.id}" has ${seqCount} sequential exit edges; exactly one is required`,
          });
        }
        break;
      }

      case "loop": {
        const count = flow.edges.filter(
          (e) => e.type === "loop-template" && e.from === node.id,
        ).length;
        if (count === 0) {
          errors.push({
            code: "missing-edge",
            message: `Loop "${node.id}" has no loop-template edge`,
          });
        } else if (count > 1) {
          errors.push({
            code: "duplicate-edge",
            message: `Loop "${node.id}" has ${count} loop-template edges; exactly one is required`,
          });
        }
        break;
      }
    }
  }

  // Per-edge checks
  for (const edge of flow.edges) {
    switch (edge.type) {
      case "branch-condition": {
        const [nodeId, branchId] = edge.from.split(".");
        const node = nodeMap.get(nodeId);
        if (
          node?.type === "branch" &&
          !node.props.branches.some((b) => b.id === branchId)
        ) {
          errors.push({
            code: "invalid-edge",
            message: `Branch-condition edge "${edge.from}" references non-existent branch id "${branchId}"`,
          });
        }
        break;
      }

      case "fork-edge": {
        const [nodeId, forkId] = edge.from.split(".");
        const node = nodeMap.get(nodeId);
        if (
          node?.type === "fork" &&
          !node.props.forks.some((f) => f.id === forkId)
        ) {
          errors.push({
            code: "invalid-edge",
            message: `Fork-edge "${edge.from}" references non-existent fork id "${forkId}"`,
          });
        }
        break;
      }

      case "path-contains": {
        const node = nodeMap.get(edge.from);
        if (node && node.type !== "path") {
          errors.push({
            code: "invalid-edge",
            message: `Path-contains edge from "${edge.from}" does not source from a path node`,
          });
        }
        break;
      }

      case "loop-template": {
        const node = nodeMap.get(edge.from);
        if (node && node.type !== "loop") {
          errors.push({
            code: "invalid-edge",
            message: `Loop-template edge from "${edge.from}" does not source from a loop node`,
          });
        }
        break;
      }
    }
  }

  return errors;
}

// ---------------------------------------------------------------------------
// 4. Screen definitions
// ---------------------------------------------------------------------------

function checkScreenDefinitions(flow: ExperimentFlow): ValidationError[] {
  const errors: ValidationError[] = [];
  const screens = flow.screens ?? [];

  // Screen nodes must have a matching definition
  const slugSet = new Set(screens.map((s) => s.slug));
  for (const node of flow.nodes) {
    if (node.type === "screen" && !slugSet.has(node.props.slug)) {
      errors.push({
        code: "missing-screen",
        message: `Screen node "${node.id}" references slug "${node.props.slug}" with no screen definition`,
      });
    }
  }

  // Screen slugs must be unique
  const seenSlugs = new Set<string>();
  for (const screen of screens) {
    if (seenSlugs.has(screen.slug)) {
      errors.push({
        code: "duplicate-screen",
        message: `Duplicate screen definition for slug "${screen.slug}"`,
      });
    }
    seenSlugs.add(screen.slug);
  }

  // Screen definitions must be referenced by at least one screen node
  const referencedSlugs = new Set(
    flow.nodes
      .filter(
        (n): n is Extract<(typeof flow.nodes)[number], { type: "screen" }> =>
          n.type === "screen",
      )
      .map((n) => n.props.slug),
  );
  for (const screen of screens) {
    if (!referencedSlugs.has(screen.slug)) {
      errors.push({
        code: "unreferenced-screen",
        message: `Screen definition "${screen.slug}" is not referenced by any screen node`,
      });
    }
  }

  return errors;
}

// ---------------------------------------------------------------------------
// 5 & 6. Reference availability
// ---------------------------------------------------------------------------

function checkReferences(flow: ExperimentFlow): ValidationError[] {
  const rawErrors: ValidationError[] = [];
  const nodeMap = new Map(flow.nodes.map((n) => [n.id, n]));
  const screenMap = new Map((flow.screens ?? []).map((s) => [s.slug, s]));

  // Build lookup maps from the edge list
  const seqNext = new Map<string, string>();
  const branchForkTargets = new Map<string, string[]>();
  const pathChildren = new Map<string, { to: string; order: number }[]>();
  const loopTemplateOf = new Map<string, string>();

  for (const edge of flow.edges) {
    switch (edge.type) {
      case "sequential":
        seqNext.set(edge.from, edge.to);
        break;
      case "branch-condition":
      case "branch-default":
      case "fork-edge": {
        const nodeId = edge.from.split(".")[0];
        const targets = branchForkTargets.get(nodeId) ?? [];
        targets.push(edge.to);
        branchForkTargets.set(nodeId, targets);
        break;
      }
      case "path-contains": {
        const children = pathChildren.get(edge.from) ?? [];
        children.push({ to: edge.to, order: edge.order });
        pathChildren.set(edge.from, children);
        break;
      }
      case "loop-template":
        loopTemplateOf.set(edge.from, edge.to);
        break;
    }
  }

  function extractTokens(text: string): string[] {
    return [...text.matchAll(/(\$\$[\w.-]+|@[\w.]+)/g)].map((m) => m[0]);
  }

  function checkText(
    text: string,
    context: string,
    available: Set<string>,
    insideLoop: boolean,
  ) {
    for (const token of extractTokens(text)) {
      if (token.startsWith("@")) {
        if (!insideLoop) {
          rawErrors.push({
            code: "invalid-reference",
            message: `${context} uses "${token}" but is not inside a loop`,
          });
        }
      } else {
        const path = token.slice(2);
        const ok = [...available].some(
          (a) => path === a || path.startsWith(a + "."),
        );
        if (!ok) {
          rawErrors.push({
            code: "unavailable-reference",
            message: `${context} references "${token}" but that data is not guaranteed to be available at this point`,
          });
        }
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
      case "start":
      case "checkpoint": {
        const next = seqNext.get(nodeId);
        if (next) return walk(next, current, dataPath, insideLoop);
        break;
      }

      case "screen": {
        const screen = screenMap.get(node.props.slug);
        if (screen) {
          for (const component of screen.components) {
            const props = component.props as Record<string, unknown>;
            for (const field of ["label", "content", "text"] as const) {
              if (typeof props[field] === "string") {
                checkText(
                  props[field] as string,
                  `Screen "${node.props.slug}"`,
                  current,
                  insideLoop,
                );
              }
            }
          }
          const prefix = [...dataPath, node.props.slug].join(".");
          for (const component of screen.components) {
            if (component.componentFamily === "response") {
              current.add(`${prefix}.${component.props.dataKey}`);
            }
          }
        }
        const next = seqNext.get(nodeId);
        if (next) return walk(next, current, dataPath, insideLoop);
        break;
      }

      case "path": {
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

      case "loop": {
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

      case "branch": {
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

      case "fork": {
        const targets = branchForkTargets.get(nodeId) ?? [];
        for (const target of targets) {
          walk(target, new Set(current), dataPath, insideLoop);
        }
        break;
      }
    }

    return current;
  }

  const startNode = flow.nodes.find((n) => n.type === "start");
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

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function validateExperiment(flow: ExperimentFlow): ValidationError[] {
  return [
    ...checkNodeIdentity(flow),
    ...checkEdgeEndpoints(flow),
    ...checkEdgeWiring(flow),
    ...checkScreenDefinitions(flow),
    ...checkReferences(flow),
  ];
}
