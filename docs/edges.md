# Edges

key files: `lib/edges.ts`

As said before nodes are connected to each other through edges, which define the flow of the experiment. Each edge has a `type`, a `from` prop that is used to define the id of the node that is the source of the edge, and a `to` prop that is used to define the id of the node that is the target of the edge.

There are different types of edges that can be used to connect the nodes, and each type of edge has a specific function. The available types of edges are:

- `sequential`
- `branch-condition` and `branch-default`
- `path-contains`
- `loop-template`
- `fork-edge`

The `sequential` edge is used to connect two nodes in a sequential manner, meaning that the target node will be executed after the source node is executed.

The `branch-condition` edge is used to connect a branch node to the different branches that can be taken from that point. The `branch-default` edge is used to connect a branch node to the default branch that will be taken if none of the conditions for the other branches are met. The `from` prop of the `branch-condition` edge has to satisfy the `branchNodeId.branchId` format, where `branchNodeId` is the id of the branch node, and `branchId` is the id of the branch that is being connected. The source of this edge has to be a branch node.

The `path-contains` edge is used to connect a path node to the different nodes that are contained in that path. This edge has an extra prop called `order` that is used to define the order of the nodes in the path. If the path is randomized this order will be ignored. The source node of this edge has to be a path node. The order of the nodes in a path is determined by the order of the edges in the experiment configuration. If the path is randomized, this order will be ignored and the nodes will be randomized instead. It's a 0 index based order, so the first node in the path should have an edge with order 0, the second node should have an edge with order 1, and so on.

The `loop-template` edge is used to connect a loop node to the node that serves as a template for the different iterations of the loop. The source node of this edge has to be a loop node.

The `fork-edge` is used to connect a fork node to the different paths that can be taken from that point. The `from` prop of the `fork-edge` has to satisfy the `forkNodeId.forkId` format, where `forkNodeId` is the id of the fork node, and `forkId` is the id of the fork that is being connected. The source of this edge has to be a fork node.

## Nodes - Edges Validation

There are some rules or validations that can ensure that the experiment is well formed and that it can be executed without errors. These rules are:

- Every edge should connect two existing nodes. This means that the `from` and `to` props of each edge should correspond to the id of an existing node (or branch/fork sub id).
- There should be at least one start node.
- All the start nodes should be connected to at least one other node through a sequential edge.
- Every branch node should have at least one branch-condition edge connecting it to a branch, and one branch-default edge connecting it to the default branch.
- Every fork node should have at least two fork-edge connecting it to different nodes, and exactly one fork-edge per fork ID declared in `props.forks`. A fork with only one arm is semantically meaningless.
- Every path node should have at least one path-contains edge connecting it to a node that is contained in that path.
- Every path node should have exactly one sequential edge connecting it to the next node in the flow after the path.
- Every loop node should have only one loop-template edge connecting it to a node that serves as a template for the different iterations of the loop.
- Every screen node should have a slug prop that corresponds to a screen that has been defined in the experiment.
- Every dataKey value used in the condition config of a branch node should correspond to a data key that is being collected in the experiment previously.
- Every dataKey value used in the dynamic loop node should correspond to a data key that is being collected in the experiment previously.
- The loop node should have a sequential edge connecting it to the next node in the flow after the loop.
