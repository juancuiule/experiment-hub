import { Codebook, CodebookVariable } from '../types';
import { constraintsText, optionsText, repetitionText } from './format';

const HEADER = [
  'section',
  'key',
  'type',
  'label',
  'options',
  'required',
  'repetition',
  'constraints',
  'condition',
  'screen',
  'template',
  'description',
] as const;

// RFC-4180 field quoting: wrap in quotes (escaping inner quotes) when the value
// contains a comma, quote, or newline.
function csvField(value: string | undefined): string {
  const v = value ?? '';
  if (/[",\n\r]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

function row(variable: CodebookVariable): string {
  const required =
    variable.required === undefined ? '' : variable.required ? 'true' : 'false';
  return [
    variable.section,
    variable.key,
    variable.type,
    variable.label ?? '',
    optionsText(variable.options),
    required,
    repetitionText(variable.repetition),
    constraintsText(variable.constraints),
    variable.conditional ?? '',
    variable.screen ?? '',
    variable.template ?? '',
    variable.description ?? '',
  ]
    .map(csvField)
    .join(',');
}

export function toCsv(codebook: Codebook): string {
  const all = [
    ...codebook.collected,
    ...codebook.derived,
    ...codebook.system,
  ];
  return [HEADER.join(','), ...all.map(row)].join('\n');
}
