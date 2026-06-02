/**
 * Common shape of every edge: a `type` discriminant plus the `from`/`to` node
 * ids it connects. Some edge types narrow `from` to a `nodeId.subId` form.
 */
type BaseEdge = {
  type: string; // edge type
  from: string; // node id
  to: string; // node id
};

/**
 * Plain "do `to` after `from`" link — the default way to chain nodes. Start,
 * path, and loop nodes each require exactly one outgoing sequential edge to
 * define what follows them.
 */
export interface SequentialEdge extends BaseEdge {
  type: "sequential";
}

/**
 * Connects one arm of a branch node to its target. `from` is
 * `branchNodeId.branchId`, naming which `Branch` (by its `id`) this edge serves.
 * The runner takes the first branch-condition edge (in declaration order) whose
 * `Branch.config` is true.
 */
export interface BranchConditionEdge extends BaseEdge {
  type: "branch-condition";
  from: `${string}.${string}`; // BranchNode id + Branch.id (e.g. "branch1.branchA")
}

/**
 * Fallback edge out of a branch node, taken when none of its branch-condition
 * edges match. Every branch node requires exactly one. `from` is the bare
 * branch node id.
 */
export interface BranchDefaultEdge extends BaseEdge {
  type: "branch-default";
}

/**
 * Marks `to` as a member of the path node `from`. `order` is the 0-based
 * position within the path; it is ignored when the path is `randomized`. A path
 * needs at least one of these (plus a separate sequential edge for what comes
 * after the path).
 */
export interface PathContainmentEdge extends BaseEdge {
  type: "path-contains";
  order: number; // position within the path
}

/**
 * Points a loop node `from` at the single node `to` that serves as the template
 * rendered once per iteration. Each loop node has exactly one loop-template edge
 * (plus a separate sequential edge for what comes after the loop).
 */
export interface LoopTemplateEdge extends BaseEdge {
  type: "loop-template";
}

/**
 * Connects one outcome of a fork node to its target. `from` is
 * `forkNodeId.forkId`, naming which `Fork` (by its `id`) this edge serves. A
 * fork needs at least two fork-edges — exactly one per declared `Fork.id`.
 */
export interface ForkEdge extends BaseEdge {
  type: "fork-edge";
  from: `${string}.${string}`; // ForkNode id + Fork.id (e.g. "fork1.groupA")
}

export type FrameworkEdge =
  | SequentialEdge
  | BranchConditionEdge
  | BranchDefaultEdge
  | PathContainmentEdge
  | LoopTemplateEdge
  | ForkEdge;

export function isPathEdge(edge: FrameworkEdge): edge is PathContainmentEdge {
  return edge.type === "path-contains";
}

export function isForkEdge(edge: FrameworkEdge): edge is ForkEdge {
  return edge.type === "fork-edge";
}

export function isLoopEdge(edge: FrameworkEdge): edge is LoopTemplateEdge {
  return edge.type === "loop-template";
}

export function isSequentialEdge(edge: FrameworkEdge): edge is SequentialEdge {
  return edge.type === "sequential";
}

export function isBranchConditionEdge(
  edge: FrameworkEdge,
): edge is BranchConditionEdge {
  return edge.type === "branch-condition";
}

export function isBranchDefaultEdge(
  edge: FrameworkEdge,
): edge is BranchDefaultEdge {
  return edge.type === "branch-default";
}
