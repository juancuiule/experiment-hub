import { describe, expect, it } from 'vitest';
import { generateCodebook } from '../../codebook/generate';
import { toCsv } from '../../codebook/render/csv';
import { toJson } from '../../codebook/render/json';
import { toMarkdown } from '../../codebook/render/markdown';
import { Codebook } from '../../codebook/types';
import { ExperimentFlow } from '../../types';
import { makeScreen, seq } from '../test-helpers';

const flow: ExperimentFlow = {
  nodes: [start(), makeScreen('s', 'survey'), end()],
  edges: [seq('start', 's'), seq('s', 'end')],
  screens: [
    {
      slug: 'survey',
      components: [
        {
          componentFamily: 'response',
          template: 'radio',
          props: {
            label: 'Pick, carefully',
            dataKey: 'clarity',
            options: [
              { label: 'Clear', value: 'clear' },
              { label: 'Murky', value: 'murky' },
            ],
          },
        },
      ],
    },
  ],
};

function start() {
  return { id: 'start', type: 'start' as const };
}
function end() {
  return { id: 'end', type: 'end' as const };
}

const cb: Codebook = generateCodebook(flow, 'demo');

describe('toMarkdown', () => {
  const md = toMarkdown(cb);
  it('renders a section heading and the variable key', () => {
    expect(md).toContain('## Collected');
    expect(md).toContain('survey.clarity');
  });
  it('renders a markdown table header row', () => {
    expect(md).toMatch(/\| Key \| Type \|/);
  });
  it('lists enum option values', () => {
    expect(md).toContain('clear');
    expect(md).toContain('murky');
  });
  it('escapes pipe characters so the table is not broken', () => {
    // label "Pick, carefully" has no pipe; craft one to verify escaping.
    const piped = toMarkdown({
      ...cb,
      collected: [
        { section: 'collected', key: 'k', type: 'string', repetition: { kind: 'none' }, label: 'a | b' },
      ],
    });
    expect(piped).toContain('a \\| b');
  });
});

describe('toCsv', () => {
  const csv = toCsv(cb);
  it('starts with a header row including section and key', () => {
    const header = csv.split('\n')[0];
    expect(header.startsWith('section,key,')).toBe(true);
  });
  it('emits one row per variable with the section as the first column', () => {
    expect(csv).toMatch(/\ncollected,survey\.clarity,/);
  });
  it('quotes fields containing commas (RFC-4180)', () => {
    // The label "Pick, carefully" must be quoted.
    expect(csv).toContain('"Pick, carefully"');
  });
});

describe('toJson', () => {
  it('round-trips to the original codebook', () => {
    expect(JSON.parse(toJson(cb))).toEqual(cb);
  });
});
