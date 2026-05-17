import { FrameworkScreen } from '@/lib/screen';
import { buildSchema } from '@/lib/validation';
import { describe, expect, it } from 'vitest';

function screen(components: FrameworkScreen['components']): FrameworkScreen {
  return { slug: 'test', components };
}

describe('text-input', () => {
  it('passes a non-empty string when required', () => {
    const schema = buildSchema(
      screen([
        {
          componentFamily: 'response',
          template: 'text-input',
          props: { dataKey: 'name', label: 'Name', required: true },
        },
      ]),
    );
    expect(schema.safeParse({ name: 'Alice' }).success).toBe(true);
  });

  it('fails an empty string when required', () => {
    const schema = buildSchema(
      screen([
        {
          componentFamily: 'response',
          template: 'text-input',
          props: { dataKey: 'name', label: 'Name', required: true },
        },
      ]),
    );
    expect(schema.safeParse({ name: '' }).success).toBe(false);
  });

  it('passes an empty string when not required', () => {
    const schema = buildSchema(
      screen([
        {
          componentFamily: 'response',
          template: 'text-input',
          props: { dataKey: 'name', label: 'Name', required: false },
        },
      ]),
    );
    expect(schema.safeParse({ name: '' }).success).toBe(true);
  });

  it('uses custom errorMessage', () => {
    const schema = buildSchema(
      screen([
        {
          componentFamily: 'response',
          template: 'text-input',
          props: {
            dataKey: 'name',
            label: 'Name',
            required: true,
            errorMessage: 'Please enter your name',
          },
        },
      ]),
    );
    const result = schema.safeParse({ name: '' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.name).toContain(
        'Please enter your name',
      );
    }
  });
});

describe('dropdown', () => {
  it('passes a selected option when required', () => {
    const schema = buildSchema(
      screen([
        {
          componentFamily: 'response',
          template: 'dropdown',
          props: {
            dataKey: 'color',
            label: 'Color',
            options: [{ label: 'Red', value: 'red' }],
            required: true,
          },
        },
      ]),
    );
    expect(schema.safeParse({ color: 'red' }).success).toBe(true);
  });

  it('fails an empty string when required', () => {
    const schema = buildSchema(
      screen([
        {
          componentFamily: 'response',
          template: 'dropdown',
          props: {
            dataKey: 'color',
            label: 'Color',
            options: [],
            required: true,
          },
        },
      ]),
    );
    expect(schema.safeParse({ color: '' }).success).toBe(false);
  });
});

describe('radio', () => {
  it('passes when optional and empty', () => {
    const schema = buildSchema(
      screen([
        {
          componentFamily: 'response',
          template: 'radio',
          props: {
            dataKey: 'choice',
            label: 'Pick',
            options: [],
            required: false,
          },
        },
      ]),
    );
    expect(schema.safeParse({ choice: '' }).success).toBe(true);
  });
});

describe('checkboxes', () => {
  it('passes when at least one selected and required', () => {
    const schema = buildSchema(
      screen([
        {
          componentFamily: 'response',
          template: 'checkboxes',
          props: {
            dataKey: 'hobbies',
            label: 'Hobbies',
            options: [],
            required: true,
          },
        },
      ]),
    );
    expect(schema.safeParse({ hobbies: ['reading'] }).success).toBe(true);
  });

  it('fails an empty array when required', () => {
    const schema = buildSchema(
      screen([
        {
          componentFamily: 'response',
          template: 'checkboxes',
          props: {
            dataKey: 'hobbies',
            label: 'Hobbies',
            options: [],
            required: true,
          },
        },
      ]),
    );
    expect(schema.safeParse({ hobbies: [] }).success).toBe(false);
  });

  it('enforces min selection count', () => {
    const schema = buildSchema(
      screen([
        {
          componentFamily: 'response',
          template: 'checkboxes',
          props: { dataKey: 'hobbies', label: 'Hobbies', options: [], min: 2 },
        },
      ]),
    );
    expect(schema.safeParse({ hobbies: ['a'] }).success).toBe(false);
    expect(schema.safeParse({ hobbies: ['a', 'b'] }).success).toBe(true);
  });

  it('enforces max selection count', () => {
    const schema = buildSchema(
      screen([
        {
          componentFamily: 'response',
          template: 'checkboxes',
          props: { dataKey: 'hobbies', label: 'Hobbies', options: [], max: 2 },
        },
      ]),
    );
    expect(schema.safeParse({ hobbies: ['a', 'b', 'c'] }).success).toBe(false);
    expect(schema.safeParse({ hobbies: ['a', 'b'] }).success).toBe(true);
  });
});

const likertOptions = [
  { label: 'Strongly disagree', value: '1' },
  { label: 'Disagree', value: '2' },
  { label: 'Neutral', value: '3' },
  { label: 'Agree', value: '4' },
  { label: 'Strongly agree', value: '5' },
];

describe('likert-scale', () => {
  it('passes when an option is selected and required', () => {
    const schema = buildSchema(
      screen([
        {
          componentFamily: 'response',
          template: 'likert-scale',
          props: {
            dataKey: 'score',
            label: 'Rate',
            options: likertOptions,
            required: true,
          },
        },
      ]),
    );
    expect(schema.safeParse({ score: '3' }).success).toBe(true);
  });

  it('fails when empty and required', () => {
    const schema = buildSchema(
      screen([
        {
          componentFamily: 'response',
          template: 'likert-scale',
          props: {
            dataKey: 'score',
            label: 'Rate',
            options: likertOptions,
            required: true,
          },
        },
      ]),
    );
    expect(schema.safeParse({ score: '' }).success).toBe(false);
  });

  it('passes when empty and not required', () => {
    const schema = buildSchema(
      screen([
        {
          componentFamily: 'response',
          template: 'likert-scale',
          props: {
            dataKey: 'score',
            label: 'Rate',
            options: likertOptions,
            required: false,
          },
        },
      ]),
    );
    expect(schema.safeParse({}).success).toBe(true);
  });
});

describe('slider', () => {
  it('passes a value within range', () => {
    const schema = buildSchema(
      screen([
        {
          componentFamily: 'response',
          template: 'slider',
          props: { dataKey: 'vol', label: 'Volume', min: 0, max: 100 },
        },
      ]),
    );
    expect(schema.safeParse({ vol: 50 }).success).toBe(true);
  });

  it('fails a value above max', () => {
    const schema = buildSchema(
      screen([
        {
          componentFamily: 'response',
          template: 'slider',
          props: { dataKey: 'vol', label: 'Volume', min: 0, max: 100 },
        },
      ]),
    );
    expect(schema.safeParse({ vol: 101 }).success).toBe(false);
  });

  it('fails a value below min', () => {
    const schema = buildSchema(
      screen([
        {
          componentFamily: 'response',
          template: 'slider',
          props: { dataKey: 'vol', label: 'Volume', min: 0, max: 100 },
        },
      ]),
    );
    expect(schema.safeParse({ vol: -1 }).success).toBe(false);
  });

  it('passes value exactly at min boundary', () => {
    const schema = buildSchema(
      screen([
        {
          componentFamily: 'response',
          template: 'slider',
          props: { dataKey: 'vol', label: 'Volume', min: 0, max: 100 },
        },
      ]),
    );
    expect(schema.safeParse({ vol: 0 }).success).toBe(true);
  });

  it('passes value exactly at max boundary', () => {
    const schema = buildSchema(
      screen([
        {
          componentFamily: 'response',
          template: 'slider',
          props: { dataKey: 'vol', label: 'Volume', min: 0, max: 100 },
        },
      ]),
    );
    expect(schema.safeParse({ vol: 100 }).success).toBe(true);
  });

  it('coerces string to number', () => {
    const schema = buildSchema(
      screen([
        {
          componentFamily: 'response',
          template: 'slider',
          props: { dataKey: 'vol', label: 'Volume', min: 0, max: 100 },
        },
      ]),
    );
    expect(schema.safeParse({ vol: '75' }).success).toBe(true);
  });

  it('fails when required is true and value is absent', () => {
    const schema = buildSchema(
      screen([
        {
          componentFamily: 'response',
          template: 'slider',
          props: { dataKey: 'vol', label: 'Volume', required: true },
        },
      ]),
    );
    expect(schema.safeParse({}).success).toBe(false);
  });

  it('passes when required is true and a value is provided', () => {
    const schema = buildSchema(
      screen([
        {
          componentFamily: 'response',
          template: 'slider',
          props: { dataKey: 'vol', label: 'Volume', required: true },
        },
      ]),
    );
    expect(schema.safeParse({ vol: 50 }).success).toBe(true);
  });

  it('passes when required is true and value is 0', () => {
    const schema = buildSchema(
      screen([
        {
          componentFamily: 'response',
          template: 'slider',
          props: { dataKey: 'vol', label: 'Volume', required: true },
        },
      ]),
    );
    expect(schema.safeParse({ vol: 0 }).success).toBe(true);
  });

  it('fails when required is true and form value is null (slider not touched)', () => {
    const schema = buildSchema(
      screen([
        {
          componentFamily: 'response',
          template: 'slider',
          props: { dataKey: 'vol', label: 'Volume', required: true },
        },
      ]),
    );
    expect(schema.safeParse({ vol: null }).success).toBe(false);
  });

  it('uses custom errorMessage when required fails', () => {
    const schema = buildSchema(
      screen([
        {
          componentFamily: 'response',
          template: 'slider',
          props: {
            dataKey: 'vol',
            label: 'Volume',
            required: true,
            errorMessage: 'Please move the slider',
          },
        },
      ]),
    );
    const result = schema.safeParse({});
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.vol).toContain(
        'Please move the slider',
      );
    }
  });

  it('accepts null when required is false (slider not touched)', () => {
    const schema = buildSchema(
      screen([
        {
          componentFamily: 'response',
          template: 'slider',
          props: { dataKey: 'vol', label: 'Volume', required: false },
        },
      ]),
    );
    expect(schema.safeParse({ vol: null }).success).toBe(true);
  });

  it('enforces minValue constraint', () => {
    const schema = buildSchema(
      screen([
        {
          componentFamily: 'response',
          template: 'slider',
          props: {
            dataKey: 'vol',
            label: 'Volume',
            min: 0,
            max: 100,
            minValue: { value: 20 },
          },
        },
      ]),
    );
    expect(schema.safeParse({ vol: 10 }).success).toBe(false);
    expect(schema.safeParse({ vol: 20 }).success).toBe(true);
  });

  it('enforces maxValue constraint', () => {
    const schema = buildSchema(
      screen([
        {
          componentFamily: 'response',
          template: 'slider',
          props: {
            dataKey: 'vol',
            label: 'Volume',
            min: 0,
            max: 100,
            maxValue: { value: 80 },
          },
        },
      ]),
    );
    expect(schema.safeParse({ vol: 81 }).success).toBe(false);
    expect(schema.safeParse({ vol: 80 }).success).toBe(true);
  });
});

describe('single-checkbox', () => {
  it('passes true when required', () => {
    const schema = buildSchema(
      screen([
        {
          componentFamily: 'response',
          template: 'single-checkbox',
          props: {
            dataKey: 'agree',
            label: 'Agree',
            defaultValue: false,
            required: true,
          },
        },
      ]),
    );
    expect(schema.safeParse({ agree: true }).success).toBe(true);
  });

  it('fails false when required', () => {
    const schema = buildSchema(
      screen([
        {
          componentFamily: 'response',
          template: 'single-checkbox',
          props: {
            dataKey: 'agree',
            label: 'Agree',
            defaultValue: false,
            required: true,
          },
        },
      ]),
    );
    expect(schema.safeParse({ agree: false }).success).toBe(false);
  });

  it('passes false when not required', () => {
    const schema = buildSchema(
      screen([
        {
          componentFamily: 'response',
          template: 'single-checkbox',
          props: {
            dataKey: 'agree',
            label: 'Agree',
            defaultValue: false,
            required: false,
          },
        },
      ]),
    );
    expect(schema.safeParse({ agree: false }).success).toBe(true);
  });

  it('enforces shouldBe: true constraint', () => {
    const schema = buildSchema(
      screen([
        {
          componentFamily: 'response',
          template: 'single-checkbox',
          props: {
            dataKey: 'tos',
            label: 'Accept',
            defaultValue: false,
            shouldBe: true,
          },
        },
      ]),
    );
    expect(schema.safeParse({ tos: false }).success).toBe(false);
    expect(schema.safeParse({ tos: true }).success).toBe(true);
  });

  it('enforces shouldBe: false constraint', () => {
    const schema = buildSchema(
      screen([
        {
          componentFamily: 'response',
          template: 'single-checkbox',
          props: {
            dataKey: 'opt-out',
            label: 'Opt out',
            defaultValue: true,
            shouldBe: false,
          },
        },
      ]),
    );
    expect(schema.safeParse({ 'opt-out': true }).success).toBe(false);
    expect(schema.safeParse({ 'opt-out': false }).success).toBe(true);
  });
});

describe('multi-field screen', () => {
  it('validates all fields together', () => {
    const schema = buildSchema(
      screen([
        {
          componentFamily: 'response',
          template: 'text-input',
          props: { dataKey: 'name', label: 'Name', required: true },
        },
        {
          componentFamily: 'response',
          template: 'likert-scale',
          props: {
            dataKey: 'score',
            label: 'Rate',
            options: likertOptions,
            required: true,
          },
        },
        {
          componentFamily: 'layout',
          template: 'button',
          props: { text: 'Next' },
        },
      ]),
    );
    expect(schema.safeParse({ name: 'Alice', score: '3' }).success).toBe(true);
    expect(schema.safeParse({ name: '', score: '3' }).success).toBe(false);
  });

  it('ignores non-response components', () => {
    const schema = buildSchema(
      screen([
        {
          componentFamily: 'content',
          template: 'rich-text',
          props: { content: '## Hello' },
        },
        {
          componentFamily: 'layout',
          template: 'button',
          props: { text: 'Go' },
        },
      ]),
    );
    // No fields — any object passes
    expect(schema.safeParse({}).success).toBe(true);
  });
});

describe('text-input advanced constraints', () => {
  it('enforces minLength', () => {
    const schema = buildSchema(
      screen([
        {
          componentFamily: 'response',
          template: 'text-input',
          props: { dataKey: 'bio', label: 'Bio', minLength: { value: 10 } },
        },
      ]),
    );
    expect(schema.safeParse({ bio: 'short' }).success).toBe(false);
    expect(schema.safeParse({ bio: 'long enough bio' }).success).toBe(true);
  });

  it('enforces maxLength', () => {
    const schema = buildSchema(
      screen([
        {
          componentFamily: 'response',
          template: 'text-input',
          props: { dataKey: 'code', label: 'Code', maxLength: { value: 5 } },
        },
      ]),
    );
    expect(schema.safeParse({ code: 'toolong' }).success).toBe(false);
    expect(schema.safeParse({ code: 'ok' }).success).toBe(true);
  });

  it('enforces regex pattern', () => {
    const schema = buildSchema(
      screen([
        {
          componentFamily: 'response',
          template: 'text-input',
          props: {
            dataKey: 'zip',
            label: 'ZIP',
            pattern: { value: '^\\d{5}$' },
          },
        },
      ]),
    );
    expect(schema.safeParse({ zip: 'abc' }).success).toBe(false);
    expect(schema.safeParse({ zip: '12345' }).success).toBe(true);
  });

  it('uses custom minLength errorMessage', () => {
    const schema = buildSchema(
      screen([
        {
          componentFamily: 'response',
          template: 'text-input',
          props: {
            dataKey: 'bio',
            label: 'Bio',
            minLength: { value: 10, errorMessage: 'Too short' },
          },
        },
      ]),
    );
    const result = schema.safeParse({ bio: 'hi' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.bio).toContain('Too short');
    }
  });
});

describe('date-input', () => {
  it('fails empty string when required', () => {
    const schema = buildSchema(
      screen([
        {
          componentFamily: 'response',
          template: 'date-input',
          props: { dataKey: 'dob', label: 'DOB', required: true },
        },
      ]),
    );
    expect(schema.safeParse({ dob: '' }).success).toBe(false);
  });

  it('passes a non-empty string when required', () => {
    const schema = buildSchema(
      screen([
        {
          componentFamily: 'response',
          template: 'date-input',
          props: { dataKey: 'dob', label: 'DOB', required: true },
        },
      ]),
    );
    expect(schema.safeParse({ dob: '2024-01-15' }).success).toBe(true);
  });

  it('passes empty when not required', () => {
    const schema = buildSchema(
      screen([
        {
          componentFamily: 'response',
          template: 'date-input',
          props: { dataKey: 'dob', label: 'DOB', required: false },
        },
      ]),
    );
    expect(schema.safeParse({}).success).toBe(true);
  });
});

describe('time-input', () => {
  it('fails empty string when required', () => {
    const schema = buildSchema(
      screen([
        {
          componentFamily: 'response',
          template: 'time-input',
          props: { dataKey: 'alarm', label: 'Alarm', required: true },
        },
      ]),
    );
    expect(schema.safeParse({ alarm: '' }).success).toBe(false);
  });

  it('passes a non-empty string when required', () => {
    const schema = buildSchema(
      screen([
        {
          componentFamily: 'response',
          template: 'time-input',
          props: { dataKey: 'alarm', label: 'Alarm', required: true },
        },
      ]),
    );
    expect(schema.safeParse({ alarm: '08:30' }).success).toBe(true);
  });
});

describe('numeric-input', () => {
  it('passes a number within range', () => {
    const schema = buildSchema(
      screen([
        {
          componentFamily: 'response',
          template: 'numeric-input',
          props: { dataKey: 'age', label: 'Age', min: 0, max: 120 },
        },
      ]),
    );
    expect(schema.safeParse({ age: 30 }).success).toBe(true);
  });

  it('fails below min', () => {
    const schema = buildSchema(
      screen([
        {
          componentFamily: 'response',
          template: 'numeric-input',
          props: { dataKey: 'age', label: 'Age', min: 0, max: 120 },
        },
      ]),
    );
    expect(schema.safeParse({ age: -1 }).success).toBe(false);
  });

  it('fails above max', () => {
    const schema = buildSchema(
      screen([
        {
          componentFamily: 'response',
          template: 'numeric-input',
          props: { dataKey: 'age', label: 'Age', min: 0, max: 120 },
        },
      ]),
    );
    expect(schema.safeParse({ age: 121 }).success).toBe(false);
  });

  it('coerces string to number', () => {
    const schema = buildSchema(
      screen([
        {
          componentFamily: 'response',
          template: 'numeric-input',
          props: { dataKey: 'age', label: 'Age', min: 0, max: 120 },
        },
      ]),
    );
    expect(schema.safeParse({ age: '42' }).success).toBe(true);
  });

  it('passes when optional and absent', () => {
    const schema = buildSchema(
      screen([
        {
          componentFamily: 'response',
          template: 'numeric-input',
          props: { dataKey: 'age', label: 'Age', required: false },
        },
      ]),
    );
    expect(schema.safeParse({}).success).toBe(true);
  });
});

describe('group — nested fields included in schema', () => {
  it('includes a required text-input nested inside a group', () => {
    const schema = buildSchema(
      screen([
        {
          componentFamily: 'layout',
          template: 'group',
          props: {
            name: 'personal',
            components: [
              {
                componentFamily: 'response',
                template: 'text-input',
                props: {
                  dataKey: 'fname',
                  label: 'First name',
                  required: true,
                },
              },
            ],
          },
        },
      ]),
    );
    expect(schema.safeParse({ fname: 'Alice' }).success).toBe(true);
    expect(schema.safeParse({ fname: '' }).success).toBe(false);
  });

  it('includes multiple response fields from a group', () => {
    const schema = buildSchema(
      screen([
        {
          componentFamily: 'layout',
          template: 'group',
          props: {
            name: 'survey',
            components: [
              {
                componentFamily: 'response',
                template: 'text-input',
                props: { dataKey: 'q1', label: 'Q1', required: true },
              },
              {
                componentFamily: 'response',
                template: 'text-input',
                props: { dataKey: 'q2', label: 'Q2', required: true },
              },
            ],
          },
        },
      ]),
    );
    expect(schema.safeParse({ q1: 'a', q2: 'b' }).success).toBe(true);
    expect(schema.safeParse({ q1: '', q2: 'b' }).success).toBe(false);
  });
});

describe('conditional — nested field included as optional in base schema', () => {
  it('conditional field is optional in the base schema (missing value passes)', () => {
    const schema = buildSchema(
      screen([
        {
          componentFamily: 'response',
          template: 'radio',
          props: {
            dataKey: 'answer',
            label: 'Answer',
            options: [],
            required: true,
          },
        },
        {
          componentFamily: 'control',
          template: 'conditional',
          props: {
            if: {
              type: 'simple',
              operator: 'eq',
              dataKey: '$answer',
              value: 'yes',
            },
            component: {
              componentFamily: 'response',
              template: 'text-input',
              props: { dataKey: 'details', label: 'Details', required: true },
            },
          },
        },
      ]),
    );
    // The conditional field is absent — base schema is optional, so it passes
    expect(schema.safeParse({ answer: 'no' }).success).toBe(true);
  });

  it('superRefine enforces required on conditional field when condition is true', () => {
    const schema = buildSchema(
      screen([
        {
          componentFamily: 'response',
          template: 'radio',
          props: {
            dataKey: 'answer',
            label: 'Answer',
            options: [],
            required: true,
          },
        },
        {
          componentFamily: 'control',
          template: 'conditional',
          props: {
            if: {
              type: 'simple',
              operator: 'eq',
              dataKey: '$answer',
              value: 'yes',
            },
            component: {
              componentFamily: 'response',
              template: 'text-input',
              props: { dataKey: 'details', label: 'Details', required: true },
            },
          },
        },
      ]),
    );
    // condition is true, details is empty — should fail
    expect(schema.safeParse({ answer: 'yes', details: '' }).success).toBe(
      false,
    );
  });

  it('superRefine passes when condition is true and required conditional field is filled', () => {
    const schema = buildSchema(
      screen([
        {
          componentFamily: 'response',
          template: 'radio',
          props: {
            dataKey: 'answer',
            label: 'Answer',
            options: [],
            required: true,
          },
        },
        {
          componentFamily: 'control',
          template: 'conditional',
          props: {
            if: {
              type: 'simple',
              operator: 'eq',
              dataKey: '$answer',
              value: 'yes',
            },
            component: {
              componentFamily: 'response',
              template: 'text-input',
              props: { dataKey: 'details', label: 'Details', required: true },
            },
          },
        },
      ]),
    );
    expect(
      schema.safeParse({ answer: 'yes', details: 'some detail' }).success,
    ).toBe(true);
  });

  it('superRefine skips required check when conditional field is not required', () => {
    const schema = buildSchema(
      screen([
        {
          componentFamily: 'response',
          template: 'radio',
          props: {
            dataKey: 'answer',
            label: 'Answer',
            options: [],
            required: true,
          },
        },
        {
          componentFamily: 'control',
          template: 'conditional',
          props: {
            if: {
              type: 'simple',
              operator: 'eq',
              dataKey: '$answer',
              value: 'yes',
            },
            component: {
              componentFamily: 'response',
              template: 'text-input',
              props: { dataKey: 'details', label: 'Details', required: false },
            },
          },
        },
      ]),
    );
    // condition true but not required — should pass even when empty
    expect(schema.safeParse({ answer: 'yes', details: '' }).success).toBe(true);
  });
});

describe('conditional — group inside conditional', () => {
  it('marks fields inside a conditional-wrapped group as optional (no error when condition is false)', () => {
    const schema = buildSchema(
      screen([
        {
          componentFamily: 'response',
          template: 'radio',
          props: {
            dataKey: 'trigger',
            label: 'Q',
            options: [],
            required: true,
          },
        },
        {
          componentFamily: 'control',
          template: 'conditional',
          props: {
            if: {
              type: 'simple',
              operator: 'eq',
              dataKey: '$trigger',
              value: 'yes',
            },
            component: {
              componentFamily: 'layout',
              template: 'group',
              props: {
                name: 'details',
                components: [
                  {
                    componentFamily: 'response',
                    template: 'text-input',
                    props: {
                      dataKey: 'detail',
                      label: 'Detail',
                      required: true,
                    },
                  },
                ],
              },
            },
          },
        },
      ]),
    );
    expect(schema.safeParse({ trigger: 'no' }).success).toBe(true);
  });

  it('superRefine enforces required on fields inside a conditional-wrapped group when condition is true', () => {
    const schema = buildSchema(
      screen([
        {
          componentFamily: 'response',
          template: 'radio',
          props: {
            dataKey: 'trigger',
            label: 'Q',
            options: [],
            required: true,
          },
        },
        {
          componentFamily: 'control',
          template: 'conditional',
          props: {
            if: {
              type: 'simple',
              operator: 'eq',
              dataKey: '$trigger',
              value: 'yes',
            },
            component: {
              componentFamily: 'layout',
              template: 'group',
              props: {
                name: 'details',
                components: [
                  {
                    componentFamily: 'response',
                    template: 'text-input',
                    props: {
                      dataKey: 'detail',
                      label: 'Detail',
                      required: true,
                    },
                  },
                ],
              },
            },
          },
        },
      ]),
    );
    expect(schema.safeParse({ trigger: 'yes', detail: '' }).success).toBe(
      false,
    );
    expect(schema.safeParse({ trigger: 'yes', detail: 'hello' }).success).toBe(
      true,
    );
  });
});

describe('static for-each — generates N schema entries', () => {
  it('creates one entry per static value with {{#id.index}} resolved', () => {
    const schema = buildSchema(
      screen([
        {
          componentFamily: 'control',
          template: 'for-each',
          props: {
            type: 'static',
            id: 'sports',
            values: ['football', 'tennis', 'swimming'],
            component: {
              componentFamily: 'response',
              template: 'text-input',
              props: {
                dataKey: 'sport_{{#sports.index}}',
                label: 'Sport',
                required: true,
              },
            },
          },
        },
      ]),
    );
    expect(
      schema.safeParse({ sport_0: 'a', sport_1: 'b', sport_2: 'c' }).success,
    ).toBe(true);
    expect(
      schema.safeParse({ sport_0: '', sport_1: 'b', sport_2: 'c' }).success,
    ).toBe(false);
  });

  it('generates exactly N keys matching values length', () => {
    const schema = buildSchema(
      screen([
        {
          componentFamily: 'control',
          template: 'for-each',
          props: {
            type: 'static',
            id: 'items',
            values: ['a', 'b'],
            component: {
              componentFamily: 'response',
              template: 'text-input',
              props: {
                dataKey: 'item_{{#items.index}}',
                label: 'Item',
                required: true,
              },
            },
          },
        },
      ]),
    );
    expect(schema.safeParse({ item_0: 'x', item_1: 'y' }).success).toBe(true);
    expect(schema.safeParse({ item_0: '', item_1: 'y' }).success).toBe(false);
  });
});

describe('static for-each — {{#id.value}} resolved in dataKey', () => {
  it('resolves {{#id.value}} placeholder using the string value at each index', () => {
    const schema = buildSchema(
      screen([
        {
          componentFamily: 'control',
          template: 'for-each',
          props: {
            type: 'static',
            id: 'foods',
            values: ['pizza', 'sushi'],
            component: {
              componentFamily: 'response',
              template: 'text-input',
              props: {
                dataKey: 'rating_{{#foods.value}}',
                label: 'Rate it',
                required: true,
              },
            },
          },
        },
      ]),
    );
    expect(
      schema.safeParse({ rating_pizza: 'good', rating_sushi: 'great' }).success,
    ).toBe(true);
    expect(
      schema.safeParse({ rating_pizza: '', rating_sushi: 'great' }).success,
    ).toBe(false);
  });

  it('resolves both {{#id.index}} and {{#id.value}} when combined in dataKey', () => {
    const schema = buildSchema(
      screen([
        {
          componentFamily: 'control',
          template: 'for-each',
          props: {
            type: 'static',
            id: 'items',
            values: ['a', 'b'],
            component: {
              componentFamily: 'response',
              template: 'text-input',
              props: {
                dataKey: 'item_{{#items.index}}_{{#items.value}}',
                label: 'Item',
                required: true,
              },
            },
          },
        },
      ]),
    );
    expect(schema.safeParse({ item_0_a: 'x', item_1_b: 'y' }).success).toBe(
      true,
    );
    expect(schema.safeParse({ item_0_a: '', item_1_b: 'y' }).success).toBe(
      false,
    );
  });
});

describe('dynamic for-each — no static schema entries', () => {
  it('produces no static schema entries (source absent → no validation)', () => {
    const schema = buildSchema(
      screen([
        {
          componentFamily: 'control',
          template: 'for-each',
          props: {
            type: 'dynamic',
            id: 'items',
            dataKey: '$items',
            component: {
              componentFamily: 'response',
              template: 'text-input',
              props: {
                dataKey: 'item-{{#items.value}}',
                label: 'Item',
                required: true,
              },
            },
          },
        },
      ]),
    );
    // source key absent from data → getValue returns undefined → no iteration → passes
    expect(schema.safeParse({}).success).toBe(true);
  });
});

describe('dynamic for-each — validates resolved fields at submit time', () => {
  function forEachScreen(
    sourceKey: `$${string}` | `$$${string}`,
    id: string,
    dataKey: string,
    required = true,
  ) {
    return screen([
      {
        componentFamily: 'control',
        template: 'for-each',
        props: {
          type: 'dynamic',
          id,
          dataKey: sourceKey,
          component: {
            componentFamily: 'response',
            template: 'radio',
            props: { dataKey, label: 'Pick', options: [], required },
          },
        },
      },
    ]);
  }

  it('passes when all resolved required fields are filled', () => {
    const schema = buildSchema(
      forEachScreen('$fruits', 'fe', 'like-{{#fe.value}}'),
    );
    expect(
      schema.safeParse({
        fruits: ['apple', 'banana'],
        'like-apple': 'yes',
        'like-banana': 'yes',
      }).success,
    ).toBe(true);
  });

  it('fails when a resolved required field is absent', () => {
    const schema = buildSchema(
      forEachScreen('$fruits', 'fe', 'like-{{#fe.value}}'),
    );
    // like-banana is missing
    expect(
      schema.safeParse({ fruits: ['apple', 'banana'], 'like-apple': 'yes' })
        .success,
    ).toBe(false);
  });

  it('fails when a resolved required field is empty string', () => {
    const schema = buildSchema(
      forEachScreen('$fruits', 'fe', 'like-{{#fe.value}}'),
    );
    expect(
      schema.safeParse({ fruits: ['apple'], 'like-apple': '' }).success,
    ).toBe(false);
  });

  it('reports error on the resolved key path', () => {
    const schema = buildSchema(
      forEachScreen('$fruits', 'fe', 'like-{{#fe.value}}'),
    );
    const result = schema.safeParse({ fruits: ['apple'], 'like-apple': '' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors).toHaveProperty('like-apple');
    }
  });

  it('uses custom errorMessage from the template component', () => {
    const schema = buildSchema(
      screen([
        {
          componentFamily: 'control',
          template: 'for-each',
          props: {
            type: 'dynamic',
            id: 'fe',
            dataKey: '$fruits',
            component: {
              componentFamily: 'response',
              template: 'radio',
              props: {
                dataKey: 'like-{{#fe.value}}',
                label: 'Pick',
                options: [],
                required: true,
                errorMessage: 'Please pick one',
              },
            },
          },
        },
      ]),
    );
    const result = schema.safeParse({ fruits: ['apple'], 'like-apple': '' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors['like-apple']).toContain(
        'Please pick one',
      );
    }
  });

  it('produces no errors when source array is empty', () => {
    const schema = buildSchema(
      forEachScreen('$fruits', 'fe', 'like-{{#fe.value}}'),
    );
    expect(schema.safeParse({ fruits: [] }).success).toBe(true);
  });

  it('produces no errors when source key is absent', () => {
    const schema = buildSchema(
      forEachScreen('$fruits', 'fe', 'like-{{#fe.value}}'),
    );
    expect(schema.safeParse({}).success).toBe(true);
  });

  it('skips validation when template field is not required', () => {
    const schema = buildSchema(
      forEachScreen('$fruits', 'fe', 'like-{{#fe.value}}', false),
    );
    expect(schema.safeParse({ fruits: ['apple', 'banana'] }).success).toBe(
      true,
    );
  });

  it('resolves {{#id.index}} in template dataKey', () => {
    const schema = buildSchema(
      forEachScreen('$fruits', 'fe', 'like-{{#fe.index}}'),
    );
    expect(
      schema.safeParse({
        fruits: ['apple', 'banana'],
        'like-0': 'yes',
        'like-1': 'yes',
      }).success,
    ).toBe(true);
    expect(
      schema.safeParse({
        fruits: ['apple', 'banana'],
        'like-0': 'yes',
        'like-1': '',
      }).success,
    ).toBe(false);
  });

  it('resolves both {{#id.value}} and {{#id.index}} in the same dataKey', () => {
    const schema = buildSchema(
      forEachScreen('$fruits', 'fe', 'like-{{#fe.index}}-{{#fe.value}}'),
    );
    expect(
      schema.safeParse({
        fruits: ['apple', 'banana'],
        'like-0-apple': 'yes',
        'like-1-banana': 'yes',
      }).success,
    ).toBe(true);
    expect(
      schema.safeParse({
        fruits: ['apple', 'banana'],
        'like-0-apple': 'yes',
        'like-1-banana': '',
      }).success,
    ).toBe(false);
  });

  it('validates each iteration independently — only the missing one fails', () => {
    const schema = buildSchema(
      forEachScreen('$fruits', 'fe', 'like-{{#fe.value}}'),
    );
    const result = schema.safeParse({
      fruits: ['apple', 'banana', 'kiwi'],
      'like-apple': 'yes',
      'like-banana': '',
      'like-kiwi': 'yes',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = result.error.flatten().fieldErrors;
      expect(errors).toHaveProperty('like-banana');
      expect(errors).not.toHaveProperty('like-apple');
      expect(errors).not.toHaveProperty('like-kiwi');
    }
  });
});

describe('dynamic for-each — template nested inside a group', () => {
  it('finds and validates a dynamic for-each whose template is wrapped in a group', () => {
    const schema = buildSchema(
      screen([
        {
          componentFamily: 'control',
          template: 'for-each',
          props: {
            type: 'dynamic',
            id: 'fe',
            dataKey: '$fruits',
            component: {
              componentFamily: 'layout',
              template: 'group',
              props: {
                name: 'group-{{#fe.index}}',
                components: [
                  {
                    componentFamily: 'response',
                    template: 'radio',
                    props: {
                      dataKey: 'like-{{#fe.value}}',
                      label: 'Like?',
                      options: [],
                      required: true,
                    },
                  },
                ],
              },
            },
          },
        },
      ]),
    );
    expect(
      schema.safeParse({ fruits: ['apple'], 'like-apple': 'yes' }).success,
    ).toBe(true);
    expect(
      schema.safeParse({ fruits: ['apple'], 'like-apple': '' }).success,
    ).toBe(false);
  });
});

describe('dynamic for-each — nested inside conditional else branch', () => {
  // Pattern from experiment: conditional (slider >= 70 → checkbox, else → dynamic for-each of countries)
  // Known limitation: the dynamic for-each is validated independently of the enclosing conditional,
  // so its required fields are validated even when the else branch is not active.
  // In practice this is safe because: (a) required defaults to true but single-checkbox
  // superRefine only checks isEmpty (undefined/null/''/[]), not boolean false,
  // so a registered false value passes; (b) with shouldUnregister:true, fields from
  // inactive branches are removed from form data and won't appear in submitted data.
  it('validates dynamic for-each fields when the else branch is active (condition is false)', () => {
    const schema = buildSchema(
      screen([
        {
          componentFamily: 'response',
          template: 'slider',
          props: { dataKey: 'score', label: 'Score' },
        },
        {
          componentFamily: 'control',
          template: 'conditional',
          props: {
            if: {
              type: 'simple',
              dataKey: '$score',
              operator: 'gte',
              value: 70,
            },
            component: {
              componentFamily: 'response',
              template: 'single-checkbox',
              props: {
                dataKey: 'high-score',
                label: 'High',
                defaultValue: true,
                required: false,
              },
            },
            else: {
              componentFamily: 'control',
              template: 'for-each',
              props: {
                type: 'dynamic',
                id: 'fe',
                dataKey: '$countries',
                component: {
                  componentFamily: 'response',
                  template: 'radio',
                  props: {
                    dataKey: 'visited-{{#fe.value}}',
                    label: 'Visited?',
                    options: [],
                    required: true,
                  },
                },
              },
            },
          },
        },
      ]),
    );
    // score < 70 → else branch active; countries resolved; visited-france filled
    expect(
      schema.safeParse({
        score: 50,
        countries: ['france'],
        'visited-france': 'yes',
      }).success,
    ).toBe(true);
    expect(
      schema.safeParse({
        score: 50,
        countries: ['france'],
        'visited-france': '',
      }).success,
    ).toBe(false);
  });
});

describe('randomize __order key', () => {
  it('does not strip __order from validated data for randomize:true radio', () => {
    const screen: FrameworkScreen = {
      slug: 'test',
      components: [
        {
          componentFamily: 'response',
          template: 'radio',
          props: {
            dataKey: 'choice',
            label: 'Choice',
            options: [
              { label: 'A', value: 'a' },
              { label: 'B', value: 'b' },
            ],
            randomize: true,
          },
        },
      ],
    };
    const schema = buildSchema(screen);
    const result = schema.safeParse({ choice: 'a', choice__order: ['b', 'a'] });
    expect(result.success).toBe(true);
    expect(result.data?.choice__order).toEqual(['b', 'a']);
  });

  it('does not strip __order from validated data for randomize:true checkboxes', () => {
    const screen: FrameworkScreen = {
      slug: 'test',
      components: [
        {
          componentFamily: 'response',
          template: 'checkboxes',
          props: {
            dataKey: 'picks',
            label: 'Picks',
            options: [
              { label: 'A', value: 'a' },
              { label: 'B', value: 'b' },
            ],
            randomize: true,
          },
        },
      ],
    };
    const schema = buildSchema(screen);
    const result = schema.safeParse({ picks: ['a'], picks__order: ['b', 'a'] });
    expect(result.success).toBe(true);
    expect(result.data?.picks__order).toEqual(['b', 'a']);
  });

  it('does not strip __order from validated data for randomize:true dropdown', () => {
    const screen: FrameworkScreen = {
      slug: 'test',
      components: [
        {
          componentFamily: 'response',
          template: 'dropdown',
          props: {
            dataKey: 'selected',
            label: 'Selected',
            options: [
              { label: 'A', value: 'a' },
              { label: 'B', value: 'b' },
            ],
            randomize: true,
          },
        },
      ],
    };
    const schema = buildSchema(screen);
    const result = schema.safeParse({
      selected: 'a',
      selected__order: ['b', 'a'],
    });
    expect(result.success).toBe(true);
    expect(result.data?.selected__order).toEqual(['b', 'a']);
  });

  // TODO: fix this test, it's not beignt stripped becuase
  // we need to keep that .passthrough() in zod schema for dynamic for-each
  // it("strips __order for non-randomized fields (Zod default strip behaviour)", () => {
  //   const screen: FrameworkScreen = {
  //     slug: "test",
  //     components: [
  //       {
  //         componentFamily: "response",
  //         template: "radio",
  //         props: {
  //           dataKey: "choice",
  //           label: "Choice",
  //           options: [{ label: "A", value: "a" }],
  //         },
  //       },
  //     ],
  //   };
  //   const schema = buildSchema(screen);
  //   const result = schema.safeParse({ choice: "a", choice__order: ["a"] });
  //   expect(result.success).toBe(true);
  //   expect(result.data).not.toHaveProperty("choice__order");
  // });
});

// --- Previously-limited cases, now fully supported ---

describe('conditional inside static for-each', () => {
  // Pattern from experiment: static for-each over fruits, each iteration has a
  // conditional that checks "do you like {{#id.value}}?" and shows a follow-up if so.
  const likesThenEatsScreen = screen([
    {
      componentFamily: 'control',
      template: 'for-each',
      props: {
        type: 'static',
        id: 'fe',
        values: ['apple', 'banana'],
        component: {
          componentFamily: 'layout',
          template: 'group',
          props: {
            name: 'g',
            components: [
              {
                componentFamily: 'response',
                template: 'single-checkbox',
                props: {
                  dataKey: 'likes-{{#fe.value}}',
                  label: 'Like?',
                  defaultValue: false,
                  required: false,
                },
              },
              {
                componentFamily: 'control',
                template: 'conditional',
                props: {
                  if: {
                    type: 'simple',
                    dataKey: '$likes-{{#fe.value}}',
                    operator: 'eq',
                    value: true,
                  },
                  component: {
                    componentFamily: 'response',
                    template: 'radio',
                    props: {
                      dataKey: 'eats-{{#fe.value}}',
                      label: 'Eat regularly?',
                      options: [],
                      required: true,
                    },
                  },
                },
              },
            ],
          },
        },
      },
    },
  ]);

  it('skips the follow-up when the condition is false for that iteration', () => {
    const schema = buildSchema(likesThenEatsScreen);
    // likes-apple=false → condition false → eats-apple not required
    expect(
      schema.safeParse({ 'likes-apple': false, 'likes-banana': false }).success,
    ).toBe(true);
  });

  it('enforces the follow-up only for iterations where the condition is true', () => {
    const schema = buildSchema(likesThenEatsScreen);
    // likes-apple=true → eats-apple required; likes-banana=false → eats-banana not required
    expect(
      schema.safeParse({
        'likes-apple': true,
        'likes-banana': false,
        'eats-apple': 'yes',
      }).success,
    ).toBe(true);
    expect(
      schema.safeParse({ 'likes-apple': true, 'likes-banana': false }).success,
    ).toBe(false);
  });

  it('enforces follow-ups independently per iteration', () => {
    const schema = buildSchema(likesThenEatsScreen);
    // both likes = true → both eats required
    expect(
      schema.safeParse({
        'likes-apple': true,
        'likes-banana': true,
        'eats-apple': 'yes',
        'eats-banana': 'yes',
      }).success,
    ).toBe(true);
    expect(
      schema.safeParse({
        'likes-apple': true,
        'likes-banana': true,
        'eats-apple': 'yes',
      }).success,
    ).toBe(false);
  });
});

describe('nested conditionals — hierarchical evaluation', () => {
  // B is only validated when A is true; B's own condition further gates its field.
  const nestedScreen = screen([
    {
      componentFamily: 'control',
      template: 'conditional',
      props: {
        if: { type: 'simple', dataKey: '$outer', operator: 'eq', value: 'yes' },
        component: {
          componentFamily: 'control',
          template: 'conditional',
          props: {
            if: {
              type: 'simple',
              dataKey: '$inner',
              operator: 'eq',
              value: 'yes',
            },
            component: {
              componentFamily: 'response',
              template: 'text-input',
              props: { dataKey: 'deep', label: 'Deep', required: true },
            },
          },
        },
      },
    },
  ]);

  it('does not validate the inner field when the outer condition is false', () => {
    const schema = buildSchema(nestedScreen);
    expect(schema.safeParse({ outer: 'no', inner: 'yes' }).success).toBe(true);
  });

  it('does not validate the inner field when the outer is true but inner is false', () => {
    const schema = buildSchema(nestedScreen);
    expect(schema.safeParse({ outer: 'yes', inner: 'no' }).success).toBe(true);
  });

  it('enforces the inner field only when both conditions are true', () => {
    const schema = buildSchema(nestedScreen);
    expect(
      schema.safeParse({ outer: 'yes', inner: 'yes', deep: '' }).success,
    ).toBe(false);
    expect(
      schema.safeParse({ outer: 'yes', inner: 'yes', deep: 'filled' }).success,
    ).toBe(true);
  });
});

describe('dynamic for-each inside conditional — only validated when branch is active', () => {
  const conditionalForEachScreen = screen([
    {
      componentFamily: 'control',
      template: 'conditional',
      props: {
        if: { type: 'simple', dataKey: '$show', operator: 'eq', value: 'yes' },
        component: {
          componentFamily: 'control',
          template: 'for-each',
          props: {
            type: 'dynamic',
            id: 'fe',
            dataKey: '$items',
            component: {
              componentFamily: 'response',
              template: 'radio',
              props: {
                dataKey: 'pick-{{#fe.value}}',
                label: 'Pick',
                options: [],
                required: true,
              },
            },
          },
        },
      },
    },
  ]);

  it('does not validate dynamic for-each fields when the condition is false', () => {
    const schema = buildSchema(conditionalForEachScreen);
    // show=no → branch inactive → pick-apple not required even though items has values
    expect(
      schema.safeParse({ show: 'no', items: ['apple'], 'pick-apple': '' })
        .success,
    ).toBe(true);
  });

  it('validates dynamic for-each fields when the condition is true', () => {
    const schema = buildSchema(conditionalForEachScreen);
    expect(
      schema.safeParse({ show: 'yes', items: ['apple'], 'pick-apple': 'x' })
        .success,
    ).toBe(true);
    expect(
      schema.safeParse({ show: 'yes', items: ['apple'], 'pick-apple': '' })
        .success,
    ).toBe(false);
  });
});

describe('nested dynamic for-each — outer for-each context resolved in inner template keys', () => {
  // Pattern from experiment: static for-each over fruits, each iteration contains a
  // dynamic for-each over countries, template key references both loops.
  const nestedForEachScreen = screen([
    {
      componentFamily: 'control',
      template: 'for-each',
      props: {
        type: 'static',
        id: 'fruit',
        values: ['apple', 'banana'],
        component: {
          componentFamily: 'control',
          template: 'for-each',
          props: {
            type: 'dynamic',
            id: 'country',
            dataKey: '$countries',
            component: {
              componentFamily: 'response',
              template: 'single-checkbox',
              props: {
                dataKey: 'ate-{{#fruit.value}}-in-{{#country.value}}',
                label: 'Ate?',
                defaultValue: false,
                required: true,
              },
            },
          },
        },
      },
    },
  ]);

  it('resolves both outer and inner placeholders in the template key', () => {
    const schema = buildSchema(nestedForEachScreen);
    expect(
      schema.safeParse({
        countries: ['france'],
        'ate-apple-in-france': true,
        'ate-banana-in-france': true,
      }).success,
    ).toBe(true);
  });

  it('fails when a resolved key from either loop combination is missing', () => {
    const schema = buildSchema(nestedForEachScreen);
    // ate-banana-in-france is absent
    expect(
      schema.safeParse({
        countries: ['france'],
        'ate-apple-in-france': true,
      }).success,
    ).toBe(false);
  });

  it('produces no errors when the inner source array is empty', () => {
    const schema = buildSchema(nestedForEachScreen);
    expect(schema.safeParse({ countries: [] }).success).toBe(true);
  });
});

// ── Phase 2 constraint validation for conditional fields ──────────────────────

describe('conditional field — full constraint validation in Phase 2', () => {
  const constraintConditionalScreen = screen([
    {
      componentFamily: 'control',
      template: 'conditional',
      props: {
        if: { type: 'simple', dataKey: '$show', operator: 'eq', value: 'yes' },
        component: {
          componentFamily: 'response',
          template: 'text-input',
          props: {
            dataKey: 'email',
            label: 'Email',
            required: true,
            pattern: { value: '^[^@]+@[^@]+$', errorMessage: 'Invalid email' },
          },
        },
      },
    },
  ]);

  it('passes when condition is false and field is absent', () => {
    const schema = buildSchema(constraintConditionalScreen);
    expect(schema.safeParse({ show: 'no' }).success).toBe(true);
  });

  it('passes when condition is true and field satisfies the pattern', () => {
    const schema = buildSchema(constraintConditionalScreen);
    expect(schema.safeParse({ show: 'yes', email: 'a@b.com' }).success).toBe(
      true,
    );
  });

  it('fails when condition is true and field is empty', () => {
    const schema = buildSchema(constraintConditionalScreen);
    expect(schema.safeParse({ show: 'yes', email: '' }).success).toBe(false);
  });

  it('fails when condition is true and field violates the pattern', () => {
    const schema = buildSchema(constraintConditionalScreen);
    const result = schema.safeParse({ show: 'yes', email: 'not-an-email' });
    expect(result.success).toBe(false);
    const messages = result.error!.issues.map((i) => i.message);
    expect(messages).toContain('Invalid email');
  });

  it('fails when condition is true and required field is completely absent (Phase 2 specific)', () => {
    const schema = buildSchema(constraintConditionalScreen);
    // show='yes' → condition should be true → superRefine must enforce email required
    // No 'email' key at all → undefined → Phase 1 lets it pass (optional), Phase 2 must catch it
    expect(schema.safeParse({ show: 'yes' }).success).toBe(false);
  });
});

describe('static for-each — all occurrences of placeholder replaced in dataKey', () => {
  it('replaces all occurrences of {{#id.value}} in a static for-each dataKey', () => {
    const schema = buildSchema(
      screen([
        {
          componentFamily: 'control',
          template: 'for-each',
          props: {
            type: 'static',
            id: 'fe',
            values: ['apple'],
            component: {
              componentFamily: 'response',
              template: 'text-input',
              props: {
                dataKey: '{{#fe.value}}-{{#fe.value}}',
                label: 'Test',
                required: true,
              },
            },
          },
        },
      ]),
    );
    // Both occurrences must resolve: 'apple-apple', not 'apple-{{#fe.value}}'
    expect(schema.safeParse({ 'apple-apple': 'x' }).success).toBe(true);
  });

  it('replaces all occurrences of {{#id.index}} in a static for-each dataKey', () => {
    const schema = buildSchema(
      screen([
        {
          componentFamily: 'control',
          template: 'for-each',
          props: {
            type: 'static',
            id: 'fe',
            values: ['apple'],
            component: {
              componentFamily: 'response',
              template: 'text-input',
              props: {
                dataKey: '{{#fe.index}}-{{#fe.index}}',
                label: 'Test',
                required: true,
              },
            },
          },
        },
      ]),
    );
    // Both occurrences must resolve: '0-0', not '0-{{#fe.index}}'
    expect(schema.safeParse({ '0-0': 'x' }).success).toBe(true);
  });
});

describe('dynamic for-each — all occurrences of placeholder replaced in template key', () => {
  it('replaces all occurrences of {{#id.value}} in a dynamic for-each template dataKey', () => {
    const schema = buildSchema(
      screen([
        {
          componentFamily: 'control',
          template: 'for-each',
          props: {
            type: 'dynamic',
            id: 'fe',
            dataKey: '$fruits',
            component: {
              componentFamily: 'response',
              template: 'radio',
              props: {
                dataKey: '{{#fe.value}}-{{#fe.value}}',
                label: 'Pick',
                options: [],
                required: true,
              },
            },
          },
        },
      ]),
    );
    // resolveTemplateKey must replace both occurrences: 'apple-apple', not 'apple-{{#fe.value}}'
    expect(
      schema.safeParse({ fruits: ['apple'], 'apple-apple': 'yes' }).success,
    ).toBe(true);
  });

  it('replaces all occurrences of {{#id.index}} in a dynamic for-each template dataKey', () => {
    const schema = buildSchema(
      screen([
        {
          componentFamily: 'control',
          template: 'for-each',
          props: {
            type: 'dynamic',
            id: 'fe',
            dataKey: '$fruits',
            component: {
              componentFamily: 'response',
              template: 'radio',
              props: {
                dataKey: '{{#fe.index}}-{{#fe.index}}',
                label: 'Pick',
                options: [],
                required: true,
              },
            },
          },
        },
      ]),
    );
    expect(schema.safeParse({ fruits: ['apple'], '0-0': 'yes' }).success).toBe(
      true,
    );
  });
});

describe('dynamic for-each field — full constraint validation in Phase 2', () => {
  const constraintDynamicScreen = screen([
    {
      componentFamily: 'control',
      template: 'for-each',
      props: {
        type: 'dynamic',
        id: 'item',
        dataKey: '$items',
        component: {
          componentFamily: 'response',
          template: 'text-input',
          props: {
            dataKey: 'note-{{#item.value}}',
            label: 'Note',
            required: true,
            minLength: { value: 3, errorMessage: 'Too short' },
          },
        },
      },
    },
  ]);

  it('passes when all dynamic fields satisfy minLength', () => {
    const schema = buildSchema(constraintDynamicScreen);
    expect(
      schema.safeParse({ items: ['a', 'b'], 'note-a': 'hey', 'note-b': 'foo' })
        .success,
    ).toBe(true);
  });

  it('fails when a dynamic field violates minLength', () => {
    const schema = buildSchema(constraintDynamicScreen);
    const result = schema.safeParse({ items: ['a'], 'note-a': 'hi' });
    expect(result.success).toBe(false);
    const messages = result.error!.issues.map((i) => i.message);
    expect(messages).toContain('Too short');
  });

  it('fails when a dynamic field is missing', () => {
    const schema = buildSchema(constraintDynamicScreen);
    expect(schema.safeParse({ items: ['a'] }).success).toBe(false);
  });
});
