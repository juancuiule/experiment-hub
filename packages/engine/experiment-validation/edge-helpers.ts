import { FrameworkEdge } from '../edges';
import { FrameworkNode } from '../nodes';

export const isFrom = (node: FrameworkNode) => (edge: FrameworkEdge) =>
  edge.from.split('.')[0] === node.id;
