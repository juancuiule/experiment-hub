import { Codebook, CodebookVariable } from '../types';
import { optionsText, repetitionText } from './format';

const COLUMNS = [
  'Key',
  'Type',
  'Label / Description',
  'Options',
  'Required',
  'Repeated',
  'Condition',
  'Source',
] as const;

// Escapes a markdown table cell: pipes break columns, newlines break rows.
function cell(value: string | undefined): string {
  return (value ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

function row(variable: CodebookVariable): string {
  const required =
    variable.required === undefined ? '' : variable.required ? 'yes' : 'no';
  const cells = [
    `\`${variable.key}\``,
    variable.type,
    variable.label ?? variable.description ?? '',
    optionsText(variable.options),
    required,
    repetitionText(variable.repetition),
    variable.conditional ?? '',
    variable.screen ?? variable.template ?? '',
  ];
  return `| ${cells.map(cell).join(' | ')} |`;
}

function section(title: string, variables: CodebookVariable[]): string {
  const header = `| ${COLUMNS.join(' | ')} |`;
  const divider = `| ${COLUMNS.map(() => '---').join(' | ')} |`;
  const body =
    variables.length > 0
      ? variables.map(row).join('\n')
      : `| _none_ |${' |'.repeat(COLUMNS.length - 1)}`;
  return `## ${title}\n\n${header}\n${divider}\n${body}`;
}

export function toMarkdown(codebook: Codebook): string {
  const title = codebook.experimentSlug
    ? `# Codebook — ${codebook.experimentSlug}`
    : '# Codebook';
  return [
    title,
    section('Collected variables', codebook.collected),
    section('Derived variables', codebook.derived),
    section('System / metadata', codebook.system),
  ].join('\n\n');
}
