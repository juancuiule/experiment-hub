// Structured codebook model derived from a typed ExperimentFlow.
// Renderers (markdown/csv/json) project this; nothing here imports React.

export type Repetition =
  | { kind: 'none' }
  // Statically-known repetition count (e.g. a static loop's iterations).
  // The concrete per-iteration rows are enumerated separately; this annotates them.
  | { kind: 'static'; count: number }
  // Runtime-cardinality repetition: one template row standing for an unknown
  // number of columns, one per item in `over` (a $$/@ data reference).
  | { kind: 'dynamic'; over: string; loopIds: string[] };

export type FieldType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'string[]'
  | 'enum'
  | 'enum[]'
  | 'date'
  | 'time'
  | 'unknown';

// A reference to an option set whose values aren't statically inline:
// `%name` shared sets or `$$`/`@`/`$` dynamic sources.
export type OptionsRef = { ref: string };

export type CodebookVariable = {
  section: 'collected' | 'derived' | 'system';
  // Full graph-aware data path matching the exported column. For dynamic fields
  // this is the key TEMPLATE (tokens left visible).
  key: string;
  repetition: Repetition;
  type: FieldType;
  // Provenance: response template ('slider'…), 'compute:<formula>', or a system kind.
  template?: string;
  // Raw label/question text — interpolation tokens are NOT resolved.
  label?: string;
  options?: { value: string; label: string }[] | OptionsRef;
  required?: boolean;
  constraints?: Record<string, unknown>;
  // Human-readable visibility condition; omitted when the field is always collected.
  conditional?: string;
  // Source screen slug (collected section).
  screen?: string;
  // Enclosing path/loop node ids, outermost first.
  nodePath?: string[];
  // Short explanation for derived/system variables.
  description?: string;
};

export type Codebook = {
  experimentSlug?: string;
  collected: CodebookVariable[];
  derived: CodebookVariable[];
  system: CodebookVariable[];
};
