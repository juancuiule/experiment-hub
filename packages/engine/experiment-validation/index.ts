import { ExperimentFlow } from '../types';
import { checkNodes } from './check-nodes';
import { checkEdgeEndpoints } from './check-edge-endpoints';
import { checkCycles } from './check-cycles';
import { checkScreenDefinitions } from './check-screen-definitions';
import { checkEdgeWiring } from './check-edge-wiring';
import { checkUnreachableNodes } from './check-unreachable-nodes';
import { checkReferences } from './check-references';
import { checkSharedOptionReferences } from './check-shared-option-references';
import { checkForeachRandomization } from './check-foreach-randomization';
import { checkDictionaryReferences } from './check-dictionary-references';
import { ValidationError } from './types';

export type { ErrorCategory, ValidationError } from './types';

export function validateExperiment(flow: ExperimentFlow): ValidationError[] {
  return [
    ...checkNodes(flow),
    ...checkEdgeEndpoints(flow),
    ...checkCycles(flow),
    ...checkScreenDefinitions(flow),
    ...checkEdgeWiring(flow),
    ...checkUnreachableNodes(flow),
    ...checkReferences(flow),
    ...checkSharedOptionReferences(flow),
    ...checkForeachRandomization(flow),
    ...checkDictionaryReferences(flow),
  ];
}
