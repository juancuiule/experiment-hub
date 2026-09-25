import { describe, expect, it } from 'vitest';
import { conditionToText, describeField } from '../../codebook/describe';
import { ResponseComponent } from '../../components/response';

function comp(template: string, props: Record<string, unknown>): ResponseComponent {
  return { componentFamily: 'response', template, props } as ResponseComponent;
}

describe('describeField', () => {
  it('describes a required text-input with length/pattern constraints', () => {
    const d = describeField(
      comp('text-input', {
        dataKey: 'name',
        label: 'Your name',
        minLength: { value: 2 },
        maxLength: { value: 40 },
        pattern: { value: '^[a-z]+$' },
      }),
    );
    expect(d.type).toBe('string');
    expect(d.required).toBe(true);
    expect(d.label).toBe('Your name');
    expect(d.constraints).toMatchObject({
      minLength: 2,
      maxLength: 40,
      pattern: '^[a-z]+$',
    });
  });

  it('treats required as false when explicitly disabled', () => {
    const d = describeField(
      comp('text-input', { dataKey: 'x', label: 'X', required: false }),
    );
    expect(d.required).toBe(false);
  });

  it('describes a radio with inline options as enum', () => {
    const d = describeField(
      comp('radio', {
        dataKey: 'pick',
        label: 'Pick one',
        options: [
          { label: 'Yes', value: 'y' },
          { label: 'No', value: 'n' },
        ],
      }),
    );
    expect(d.type).toBe('enum');
    expect(d.options).toEqual([
      { value: 'y', label: 'Yes' },
      { value: 'n', label: 'No' },
    ]);
  });

  it('describes a radio with a shared/dynamic options source as a ref', () => {
    const d = describeField(
      comp('radio', { dataKey: 'q', label: 'Q', options: '%agreement' }),
    );
    expect(d.type).toBe('enum');
    expect(d.options).toEqual({ ref: '%agreement' });
  });

  it('describes checkboxes as enum[] with select bounds', () => {
    const d = describeField(
      comp('checkboxes', {
        dataKey: 'c',
        label: 'C',
        options: [{ label: 'A', value: 'a' }],
        min: 1,
        max: 2,
      }),
    );
    expect(d.type).toBe('enum[]');
    expect(d.constraints).toMatchObject({ minSelect: 1, maxSelect: 2 });
  });

  it('describes a slider as number with range + threshold constraints', () => {
    const d = describeField(
      comp('slider', {
        dataKey: 's',
        label: 'S',
        min: 0,
        max: 10,
        minValue: { value: 2 },
      }),
    );
    expect(d.type).toBe('number');
    expect(d.constraints).toMatchObject({ min: 0, max: 10, minValue: 2 });
  });

  it('describes numeric-input as number with min/max', () => {
    const d = describeField(
      comp('numeric-input', { dataKey: 'n', label: 'N', min: 1, max: 5 }),
    );
    expect(d.type).toBe('number');
    expect(d.constraints).toMatchObject({ min: 1, max: 5 });
  });

  it('describes single-checkbox as boolean with shouldBe', () => {
    const d = describeField(
      comp('single-checkbox', {
        dataKey: 'consent',
        label: 'I agree',
        defaultValue: false,
        shouldBe: true,
      }),
    );
    expect(d.type).toBe('boolean');
    expect(d.constraints).toMatchObject({ shouldBe: true });
  });

  it('maps date-input and time-input to their own types', () => {
    expect(describeField(comp('date-input', { dataKey: 'd', label: 'D' })).type).toBe(
      'date',
    );
    expect(describeField(comp('time-input', { dataKey: 't', label: 'T' })).type).toBe(
      'time',
    );
  });

  it('maps likert-scale to enum', () => {
    const d = describeField(
      comp('likert-scale', {
        dataKey: 'l',
        label: 'L',
        options: [{ value: '1', label: 'Low' }],
      }),
    );
    expect(d.type).toBe('enum');
    expect(d.options).toEqual([{ value: '1', label: 'Low' }]);
  });
});

describe('conditionToText', () => {
  it('renders a simple equality with a readable operator', () => {
    expect(
      conditionToText({
        type: 'simple',
        operator: 'eq',
        dataKey: '$$welcome.kids',
        value: 'yes',
      }),
    ).toBe('$$welcome.kids = yes');
  });

  it('maps comparison operators to symbols', () => {
    expect(
      conditionToText({
        type: 'simple',
        operator: 'gte',
        dataKey: '$$age',
        value: 18,
      }),
    ).toBe('$$age ≥ 18');
  });

  it('renders contains and length operators', () => {
    expect(
      conditionToText({
        type: 'simple',
        operator: 'contains',
        dataKey: '$$picks',
        value: 'a',
      }),
    ).toBe('$$picks contains a');
    expect(
      conditionToText({
        type: 'simple',
        operator: 'length-gt',
        dataKey: '$$picks',
        value: 2,
      }),
    ).toBe('length($$picks) > 2');
  });

  it('joins and/or and negates not', () => {
    const text = conditionToText({
      type: 'and',
      conditions: [
        { type: 'simple', operator: 'eq', dataKey: '$$a', value: 1 },
        {
          type: 'not',
          condition: { type: 'simple', operator: 'eq', dataKey: '$$b', value: 2 },
        },
      ],
    });
    expect(text).toBe('($$a = 1 AND NOT ($$b = 2))');
  });
});
