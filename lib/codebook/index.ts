export { generateCodebook } from './generate';
export { toMarkdown } from './render/markdown';
export { toCsv } from './render/csv';
export { toJson } from './render/json';
// Pure presentation helpers — no DOM/React; safe to reuse in the client view.
export {
  optionsText,
  repetitionText,
  constraintsText,
} from './render/format';
export type {
  Codebook,
  CodebookVariable,
  FieldType,
  Repetition,
} from './types';
