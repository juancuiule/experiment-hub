import { ExperimentFlow } from '../types';
import { checkNodes } from './check-nodes';
import { checkEdgeEndpoints } from './check-edge-endpoints';
import { checkScreenDefinitions } from './check-screen-definitions';
import { checkEdgeWiring } from './check-edge-wiring';
import { checkReferences } from './check-references';
import { checkSharedOptionReferences } from './check-shared-option-references';
import { ValidationError } from './types';

export type { ErrorCategory, ValidationError } from './types';

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
