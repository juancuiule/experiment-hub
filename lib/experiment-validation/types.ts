import { FrameworkNode } from '../nodes';

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
