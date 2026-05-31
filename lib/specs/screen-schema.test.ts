import { ScreenComponent } from '@/lib/components';
import { Condition } from '@/lib/conditions';
import {
  collectFields as _collectFields,
  DynamicField,
  StaticField,
} from '@/lib/fields';
import { FrameworkScreen } from '@/lib/screen';
import { buildScreenBindings } from '@/lib/screen-bindings';
import { buildSchemaFromFields } from '@/lib/screen-schema';
import { describe, expect, it } from 'vitest';

function collectFields(
  components: ScreenComponent[],
  enclosingCondition: Condition | null,
) {
  return _collectFields(components, { data: {} }, enclosingCondition);
}

function screen(components: FrameworkScreen['components']): FrameworkScreen {
  return { slug: 'test', components };
}

function buildSchema(s: FrameworkScreen) {
  return buildScreenBindings(s.components, { data: {} }).schema;
}

describe('collectFields — response', () => {
  it('emits one descriptor with correct key and no condition', () => {
    const c: ScreenComponent = {
      componentFamily: 'response',
      template: 'text-input',
      props: { dataKey: 'name', label: 'Name' },
    };
    const result = collectFields([c], null);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      kind: 'static',
      key: 'name',
      gate: null,
      source: c,
    } as StaticField);
  });

  it('carries enclosingCondition on the descriptor', () => {
    const cond: Condition = {
      type: 'simple',
      operator: 'eq',
      dataKey: '$q',
      value: 'yes',
    };
    const c: ScreenComponent = {
      componentFamily: 'response',
      template: 'text-input',
      props: { dataKey: 'name', label: 'Name' },
    };
    const result = collectFields([c], cond);
    expect(result[0].gate).toEqual(cond);
  });

  it('emits synthetic :order descriptor for randomized radio', () => {
    const c: ScreenComponent = {
      componentFamily: 'response',
      template: 'radio',
      props: {
        dataKey: 'choice',
        label: 'Choice',
        options: [{ label: 'A', value: 'a' }],
        randomize: true,
      },
    };
    const result = collectFields([c], null);
    expect(result).toHaveLength(2);
    expect(result[1]).toMatchObject({
      kind: 'static',
      key: 'choice:order',
      gate: null,
      source: { kind: 'order', ref: c },
    } as StaticField);
  });

  it('synthetic :order inherits enclosingCondition', () => {
    const cond: Condition = {
      type: 'simple',
      operator: 'eq',
      dataKey: '$x',
      value: '1',
    };
    const c: ScreenComponent = {
      componentFamily: 'response',
      template: 'radio',
      props: {
        dataKey: 'choice',
        label: 'Choice',
        options: [],
        randomize: true,
      },
    };
    const result = collectFields([c], cond);
    expect(result[1].gate).toEqual(cond);
  });
});

describe('collectFields — group', () => {
  it('flattens children into descriptors', () => {
    const c: ScreenComponent = {
      componentFamily: 'layout',
      template: 'group',
      props: {
        name: 'g',
        components: [
          {
            componentFamily: 'response',
            template: 'text-input',
            props: { dataKey: 'x', label: 'X' },
          },
          {
            componentFamily: 'response',
            template: 'text-input',
            props: { dataKey: 'y', label: 'Y' },
          },
        ],
      },
    };
    const result = collectFields([c], null) as StaticField[];
    expect(result.map((d) => d.key)).toEqual(['x', 'y']);
  });

  it('threads enclosingCondition through group children', () => {
    const cond: Condition = {
      type: 'simple',
      operator: 'eq',
      dataKey: '$a',
      value: '1',
    };
    const c: ScreenComponent = {
      componentFamily: 'layout',
      template: 'group',
      props: {
        name: 'g',
        components: [
          {
            componentFamily: 'response',
            template: 'text-input',
            props: { dataKey: 'x', label: 'X' },
          },
        ],
      },
    };
    const result = collectFields([c], cond);
    expect(result[0].gate).toEqual(cond);
  });
});

describe('collectFields — content', () => {
  it('returns empty for rich-text content', () => {
    const c: ScreenComponent = {
      componentFamily: 'content',
      template: 'rich-text',
      props: { content: 'Hello' },
    };
    expect(collectFields([c], null)).toHaveLength(0);
  });
});

describe('collectFields — button', () => {
  it('returns empty for a button without payload', () => {
    const c: ScreenComponent = {
      componentFamily: 'layout',
      template: 'button',
      props: { text: 'Continue' },
    };
    expect(collectFields([c], null)).toHaveLength(0);
  });

  it('emits one static field for a button with payload', () => {
    const c: ScreenComponent = {
      componentFamily: 'layout',
      template: 'button',
      props: { text: 'Yes', payload: { dataKey: 'answer', value: 'yes' } },
    };
    const result = collectFields([c], null);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      kind: 'static',
      key: 'answer',
      gate: null,
      source: { kind: 'button-payload' },
    } as StaticField);
  });

  it('carries enclosingCondition as gate on the emitted field', () => {
    const cond: Condition = {
      type: 'simple',
      operator: 'eq',
      dataKey: '$q',
      value: 'yes',
    };
    const c: ScreenComponent = {
      componentFamily: 'layout',
      template: 'button',
      props: { text: 'Yes', payload: { dataKey: 'answer', value: 'yes' } },
    };
    const result = collectFields([c], cond);
    expect(result[0].gate).toEqual(cond);
  });

  it('emits one field per button that has a payload', () => {
    const yes: ScreenComponent = {
      componentFamily: 'layout',
      template: 'button',
      props: { text: 'Yes', payload: { dataKey: 'answer', value: 'yes' } },
    };
    const no: ScreenComponent = {
      componentFamily: 'layout',
      template: 'button',
      props: { text: 'No', payload: { dataKey: 'answer', value: 'no' } },
    };
    const plain: ScreenComponent = {
      componentFamily: 'layout',
      template: 'button',
      props: { text: 'Skip' },
    };
    const result = collectFields([yes, no, plain], null);
    expect(result).toHaveLength(2);
    expect((result[0] as StaticField).key).toBe('answer');
    expect((result[1] as StaticField).key).toBe('answer');
  });
});

describe('collectFields — conditional', () => {
  it('if-branch descriptor gets the conditional condition', () => {
    const cond: Condition = {
      type: 'simple',
      operator: 'eq',
      dataKey: '$answer',
      value: 'yes',
    };
    const c: ScreenComponent = {
      componentFamily: 'control',
      template: 'conditional',
      props: {
        if: cond,
        then: {
          componentFamily: 'response',
          template: 'text-input',
          props: { dataKey: 'detail', label: 'Detail' },
        },
      },
    };
    const result = collectFields([c], null);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ key: 'detail', gate: cond });
  });

  it('else-branch descriptor gets NOT condition', () => {
    const cond: Condition = {
      type: 'simple',
      operator: 'eq',
      dataKey: '$answer',
      value: 'yes',
    };
    const c: ScreenComponent = {
      componentFamily: 'control',
      template: 'conditional',
      props: {
        if: cond,
        then: {
          componentFamily: 'response',
          template: 'text-input',
          props: { dataKey: 'if-field', label: 'If' },
        },
        else: {
          componentFamily: 'response',
          template: 'text-input',
          props: { dataKey: 'else-field', label: 'Else' },
        },
      },
    };
    const result = collectFields([c], null) as StaticField[];
    expect(result).toHaveLength(2);
    expect(result[0].key).toBe('if-field');
    expect(result[1].key).toBe('else-field');
    expect(result[1].gate).toEqual({ type: 'not', condition: cond });
  });

  it('threads enclosingCondition with AND when nesting conditionals', () => {
    const outer: Condition = {
      type: 'simple',
      operator: 'eq',
      dataKey: '$p',
      value: 'a',
    };
    const inner: Condition = {
      type: 'simple',
      operator: 'eq',
      dataKey: '$q',
      value: 'b',
    };
    const c: ScreenComponent = {
      componentFamily: 'control',
      template: 'conditional',
      props: {
        if: inner,
        then: {
          componentFamily: 'response',
          template: 'text-input',
          props: { dataKey: 'nested', label: 'N' },
        },
      },
    };
    const result = collectFields([c], outer);
    expect(result[0].gate).toEqual({
      type: 'and',
      conditions: [outer, inner],
    });
  });

  it('same-key if/else emits two descriptors with complementary conditions', () => {
    const cond: Condition = {
      type: 'simple',
      operator: 'eq',
      dataKey: '$mode',
      value: 'advanced',
    };
    const c: ScreenComponent = {
      componentFamily: 'control',
      template: 'conditional',
      props: {
        if: cond,
        then: {
          componentFamily: 'response',
          template: 'slider',
          props: { dataKey: 'score', label: 'Score', min: 0, max: 100 },
        },
        else: {
          componentFamily: 'response',
          template: 'text-input',
          props: { dataKey: 'score', label: 'Score' },
        },
      },
    };
    const result = collectFields([c], null);
    expect(result).toHaveLength(2);
    expect(result[0].gate).toEqual(cond);
    expect(result[1].gate).toEqual({ type: 'not', condition: cond });
  });
});

describe('collectFields — static for-each', () => {
  it('resolves {{#id.index}} in key for each value', () => {
    const c: ScreenComponent = {
      componentFamily: 'control',
      template: 'for-each',
      props: {
        type: 'static',
        id: 'sports',
        values: ['football', 'tennis'],
        component: {
          componentFamily: 'response',
          template: 'text-input',
          props: { dataKey: 'sport_{{#sports.index}}', label: 'Sport' },
        },
      },
    };
    const result = collectFields([c], null) as StaticField[];
    expect(result.map((d) => d.key)).toEqual(['sport_0', 'sport_1']);
    expect(result.every((d) => d.kind === 'static')).toBe(true);
  });

  it('resolves {{#id.value}} in key for each value', () => {
    const c: ScreenComponent = {
      componentFamily: 'control',
      template: 'for-each',
      props: {
        type: 'static',
        id: 'fruits',
        values: ['apple', 'banana'],
        component: {
          componentFamily: 'response',
          template: 'text-input',
          props: { dataKey: 'like-{{#fruits.value}}', label: 'Like' },
        },
      },
    };
    const result = collectFields([c], null) as StaticField[];
    expect(result.map((d) => d.key)).toEqual(['like-apple', 'like-banana']);
  });

  it('resolves {{#id.index}} inside condition dataKey', () => {
    const c: ScreenComponent = {
      componentFamily: 'control',
      template: 'for-each',
      props: {
        type: 'static',
        id: 'items',
        values: ['x', 'y'],
        component: {
          componentFamily: 'control',
          template: 'conditional',
          props: {
            if: {
              type: 'simple',
              operator: 'eq',
              dataKey: '$resp_{{#items.index}}',
              value: 'yes',
            },
            then: {
              componentFamily: 'response',
              template: 'text-input',
              props: { dataKey: 'detail_{{#items.index}}', label: 'D' },
            },
          },
        },
      },
    };
    const result = collectFields([c], null) as StaticField[];
    expect(result[0].key).toBe('detail_0');
    expect(result[0].gate).toEqual({
      type: 'simple',
      operator: 'eq',
      dataKey: '$resp_0',
      value: 'yes',
    });
    expect(result[1].key).toBe('detail_1');
    expect(result[1].gate).toEqual({
      type: 'simple',
      operator: 'eq',
      dataKey: '$resp_1',
      value: 'yes',
    });
  });

  it('threads enclosingCondition into unrolled descriptors', () => {
    const outer: Condition = {
      type: 'simple',
      operator: 'eq',
      dataKey: '$gate',
      value: '1',
    };
    const c: ScreenComponent = {
      componentFamily: 'control',
      template: 'for-each',
      props: {
        type: 'static',
        id: 'items',
        values: ['a'],
        component: {
          componentFamily: 'response',
          template: 'text-input',
          props: { dataKey: 'item_{{#items.index}}', label: 'I' },
        },
      },
    };
    const result = collectFields([c], outer);
    expect(result[0].gate).toEqual(outer);
  });

  it('synthetic :order inherits dynamic:false from static for-each', () => {
    const c: ScreenComponent = {
      componentFamily: 'control',
      template: 'for-each',
      props: {
        type: 'static',
        id: 'items',
        values: ['a'],
        component: {
          componentFamily: 'response',
          template: 'radio',
          props: {
            dataKey: 'pick_{{#items.index}}',
            label: 'Pick',
            options: [],
            randomize: true,
          },
        },
      },
    };
    const result = collectFields([c], null);
    expect(result).toHaveLength(2);
    expect(result[1]).toMatchObject({
      kind: 'static',
      key: 'pick_0:order',
      gate: null,
      source: { kind: 'order', ref: c.props.component },
    } as StaticField);
  });
});

describe('collectFields — dynamic for-each', () => {
  it('marks descriptors as dynamic and keeps template key unresolved', () => {
    const c: ScreenComponent = {
      componentFamily: 'control',
      template: 'for-each',
      props: {
        type: 'dynamic',
        id: 'countries',
        dataKey: '$countryList',
        component: {
          componentFamily: 'response',
          template: 'slider',
          props: {
            dataKey: 'slider-{{#countries.value}}',
            label: 'S',
            min: 0,
            max: 10,
          },
        },
      },
    };
    const result = collectFields([c], null) as DynamicField[];
    expect(result).toHaveLength(1);
    expect(result[0].kind).toBe('dynamic');
    expect(result[0].keyTemplate).toBe('slider-{{#countries.value}}');
  });

  it('attaches foreach metadata with id and dataKey', () => {
    const c: ScreenComponent = {
      componentFamily: 'control',
      template: 'for-each',
      props: {
        type: 'dynamic',
        id: 'countries',
        dataKey: '$countryList',
        component: {
          componentFamily: 'response',
          template: 'slider',
          props: {
            dataKey: 'slider-{{#countries.value}}',
            label: 'S',
            min: 0,
            max: 10,
          },
        },
      },
    };
    const result = collectFields([c], null) as DynamicField[];
    const d = result[0];
    expect(d.loops).toEqual([{ id: 'countries', dataKey: '$countryList' }]);
  });

  it('threads enclosingCondition into dynamic descriptors', () => {
    const cond: Condition = {
      type: 'simple',
      operator: 'eq',
      dataKey: '$enabled',
      value: 'yes',
    };
    const c: ScreenComponent = {
      componentFamily: 'control',
      template: 'for-each',
      props: {
        type: 'dynamic',
        id: 'items',
        dataKey: '$items',
        component: {
          componentFamily: 'response',
          template: 'text-input',
          props: { dataKey: 'item-{{#items.value}}', label: 'I' },
        },
      },
    };
    const result = collectFields([c], cond);
    expect(result[0].gate).toEqual(cond);
  });

  it('synthetic :order from dynamic for-each is also dynamic', () => {
    const c: ScreenComponent = {
      componentFamily: 'control',
      template: 'for-each',
      props: {
        type: 'dynamic',
        id: 'items',
        dataKey: '$items',
        component: {
          componentFamily: 'response',
          template: 'radio',
          props: {
            dataKey: 'pick-{{#items.value}}',
            label: 'Pick',
            options: [],
            randomize: true,
          },
        },
      },
    };
    const result = collectFields([c], null);
    expect(result).toHaveLength(2);
    expect(result[1]).toMatchObject({
      kind: 'dynamic',
      keyTemplate: 'pick-{{#items.value}}:order',
      gate: null,
      source: { kind: 'order', ref: c.props.component },
      loops: [{ id: 'items', dataKey: '$items' }],
    } as DynamicField);
  });
});

describe('buildSchemaFromFields — base shape', () => {
  it('unconditional required text-input validates normally', () => {
    const c: ScreenComponent = {
      componentFamily: 'response',
      template: 'text-input',
      props: { dataKey: 'name', label: 'Name', required: true },
    };
    const descriptors = collectFields([c], null);
    const schema = buildSchemaFromFields(descriptors, { data: {} });
    expect(schema.safeParse({ name: 'Alice' }).success).toBe(true);
    expect(schema.safeParse({ name: '' }).success).toBe(false);
  });

  it('synthetic :order field accepts array of strings', () => {
    const c: ScreenComponent = {
      componentFamily: 'response',
      template: 'radio',
      props: { dataKey: 'choice', label: 'C', options: [], randomize: true },
    };
    const descriptors = collectFields([c], null);
    const schema = buildSchemaFromFields(descriptors, { data: {} });
    expect(
      schema.safeParse({ choice: 'a', 'choice:order': ['b', 'a'] }).success,
    ).toBe(true);
  });

  it('conditional field is z.any().optional() in base shape — accepts any value', () => {
    const cond: Condition = {
      type: 'simple',
      operator: 'eq',
      dataKey: '$q',
      value: 'yes',
    };
    const c: ScreenComponent = {
      componentFamily: 'response',
      template: 'text-input',
      props: { dataKey: 'detail', label: 'D', required: true },
    };
    const descriptors = collectFields([c], cond);
    const schema = buildSchemaFromFields(descriptors, { data: {} });
    expect(schema.safeParse({ detail: '' }).success).toBe(true);
  });

  it('dynamic descriptor does not appear in shape but passthrough allows it', () => {
    const c: ScreenComponent = {
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
            dataKey: 'field-{{#items.value}}',
            label: 'F',
            required: true,
          },
        },
      },
    };
    const descriptors = collectFields([c], null);
    const schema = buildSchemaFromFields(descriptors, { data: {} });
    expect(schema.safeParse({ 'field-argentina': 'hello' }).success).toBe(true);
    expect(schema.safeParse({}).success).toBe(true);
  });
});

describe('buildSchemaFromFields — button payload', () => {
  it('accepts any value for a button payload field', () => {
    const c: ScreenComponent = {
      componentFamily: 'layout',
      template: 'button',
      props: { text: 'Yes', payload: { dataKey: 'answer', value: 'yes' } },
    };
    const descriptors = collectFields([c], null);
    const schema = buildSchemaFromFields(descriptors, { data: {} });
    expect(schema.safeParse({ answer: 'yes' }).success).toBe(true);
    expect(schema.safeParse({ answer: 42 }).success).toBe(true);
    expect(schema.safeParse({ answer: false }).success).toBe(true);
  });

  it('passes when button payload field is absent (optional)', () => {
    const c: ScreenComponent = {
      componentFamily: 'layout',
      template: 'button',
      props: { text: 'Yes', payload: { dataKey: 'answer', value: 'yes' } },
    };
    const descriptors = collectFields([c], null);
    const schema = buildSchemaFromFields(descriptors, { data: {} });
    expect(schema.safeParse({}).success).toBe(true);
  });

  it('button payload field does not interfere with required response field validation', () => {
    const button: ScreenComponent = {
      componentFamily: 'layout',
      template: 'button',
      props: { text: 'Yes', payload: { dataKey: 'choice', value: 'yes' } },
    };
    const input: ScreenComponent = {
      componentFamily: 'response',
      template: 'text-input',
      props: { dataKey: 'name', label: 'Name', required: true },
    };
    const descriptors = collectFields([button, input], null);
    const schema = buildSchemaFromFields(descriptors, { data: {} });
    expect(schema.safeParse({ choice: 'yes', name: 'Alice' }).success).toBe(
      true,
    );
    expect(schema.safeParse({ choice: 'yes', name: '' }).success).toBe(false);
  });

  it('button without payload contributes no field to the schema', () => {
    const c: ScreenComponent = {
      componentFamily: 'layout',
      template: 'button',
      props: { text: 'Continue' },
    };
    const descriptors = collectFields([c], null);
    const schema = buildSchemaFromFields(descriptors, { data: {} });
    expect(schema.safeParse({}).success).toBe(true);
  });
});

describe('buildSchemaFromFields — superRefine, static conditional', () => {
  it('enforces required on conditional field when condition is met', () => {
    const cond: Condition = {
      type: 'simple',
      operator: 'eq',
      dataKey: '$answer',
      value: 'yes',
    };
    const field: ScreenComponent = {
      componentFamily: 'response',
      template: 'text-input',
      props: { dataKey: 'detail', label: 'Detail', required: true },
    };
    const gate: ScreenComponent = {
      componentFamily: 'response',
      template: 'radio',
      props: { dataKey: 'answer', label: 'A', options: [], required: true },
    };
    const conditional: ScreenComponent = {
      componentFamily: 'control',
      template: 'conditional',
      props: { if: cond, then: field },
    };
    const descriptors = collectFields([gate, conditional], null);
    const schema = buildSchemaFromFields(descriptors, { data: {} });
    expect(schema.safeParse({ answer: 'yes', detail: '' }).success).toBe(false);
    expect(
      schema.safeParse({ answer: 'yes', detail: 'some text' }).success,
    ).toBe(true);
    expect(schema.safeParse({ answer: 'no' }).success).toBe(true);
  });

  it('enforces minLength on conditional field when condition is met', () => {
    const cond: Condition = {
      type: 'simple',
      operator: 'eq',
      dataKey: '$show',
      value: 'yes',
    };
    const field: ScreenComponent = {
      componentFamily: 'response',
      template: 'text-input',
      props: {
        dataKey: 'bio',
        label: 'Bio',
        required: false,
        minLength: { value: 10 },
      },
    };
    const descriptors = collectFields([field], cond);
    const schema = buildSchemaFromFields(descriptors, { data: {} });
    expect(schema.safeParse({ show: 'yes', bio: 'short' }).success).toBe(false);
    expect(
      schema.safeParse({ show: 'yes', bio: 'long enough bio' }).success,
    ).toBe(true);
    expect(schema.safeParse({ show: 'no', bio: 'short' }).success).toBe(true);
  });

  it('enforces maxLength on conditional field when condition is met', () => {
    const cond: Condition = {
      type: 'simple',
      operator: 'eq',
      dataKey: '$show',
      value: 'yes',
    };
    const field: ScreenComponent = {
      componentFamily: 'response',
      template: 'text-input',
      props: { dataKey: 'code', label: 'Code', maxLength: { value: 5 } },
    };
    const descriptors = collectFields([field], cond);
    const schema = buildSchemaFromFields(descriptors, { data: {} });
    expect(schema.safeParse({ show: 'yes', code: 'toolong' }).success).toBe(
      false,
    );
    expect(schema.safeParse({ show: 'yes', code: 'ok' }).success).toBe(true);
  });

  it('enforces slider range on conditional field when condition is met', () => {
    const cond: Condition = {
      type: 'simple',
      operator: 'eq',
      dataKey: '$show',
      value: 'yes',
    };
    const field: ScreenComponent = {
      componentFamily: 'response',
      template: 'slider',
      props: { dataKey: 'vol', label: 'Volume', min: 0, max: 100 },
    };
    const descriptors = collectFields([field], cond);
    const schema = buildSchemaFromFields(descriptors, { data: {} });
    expect(schema.safeParse({ show: 'yes', vol: 150 }).success).toBe(false);
    expect(schema.safeParse({ show: 'yes', vol: 50 }).success).toBe(true);
  });

  it('does not run validation on conditional field when condition is not met', () => {
    const cond: Condition = {
      type: 'simple',
      operator: 'eq',
      dataKey: '$show',
      value: 'yes',
    };
    const field: ScreenComponent = {
      componentFamily: 'response',
      template: 'text-input',
      props: {
        dataKey: 'detail',
        label: 'Detail',
        required: true,
        minLength: { value: 20 },
      },
    };
    const descriptors = collectFields([field], cond);
    const schema = buildSchemaFromFields(descriptors, { data: {} });
    expect(schema.safeParse({ show: 'no', detail: '' }).success).toBe(true);
  });

  it('propagates issues with correct field path', () => {
    const cond: Condition = {
      type: 'simple',
      operator: 'eq',
      dataKey: '$show',
      value: 'yes',
    };
    const field: ScreenComponent = {
      componentFamily: 'response',
      template: 'text-input',
      props: { dataKey: 'detail', label: 'Detail', required: true },
    };
    const descriptors = collectFields([field], cond);
    const schema = buildSchemaFromFields(descriptors, { data: {} });
    const result = schema.safeParse({ show: 'yes', detail: '' });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path[0]);
      expect(paths).toContain('detail');
    }
  });

  it('same-key if/else: only the active branch validates', () => {
    const cond: Condition = {
      type: 'simple',
      operator: 'eq',
      dataKey: '$mode',
      value: 'num',
    };
    const numField: ScreenComponent = {
      componentFamily: 'response',
      template: 'numeric-input',
      props: { dataKey: 'value', label: 'V', min: 1, max: 10, required: true },
    };
    const textField: ScreenComponent = {
      componentFamily: 'response',
      template: 'text-input',
      props: { dataKey: 'value', label: 'V', required: true },
    };
    const conditional: ScreenComponent = {
      componentFamily: 'control',
      template: 'conditional',
      props: { if: cond, then: numField, else: textField },
    };
    const descriptors = collectFields([conditional], null);
    const schema = buildSchemaFromFields(descriptors, { data: {} });

    expect(schema.safeParse({ mode: 'num', value: 5 }).success).toBe(true);
    expect(schema.safeParse({ mode: 'num', value: '' }).success).toBe(false);
    expect(schema.safeParse({ mode: 'text', value: 'hello' }).success).toBe(
      true,
    );
    expect(schema.safeParse({ mode: 'text', value: '' }).success).toBe(false);
  });

  it('nested: conditional inside conditional composes conditions with AND', () => {
    const outerCond: Condition = {
      type: 'simple',
      operator: 'eq',
      dataKey: '$a',
      value: '1',
    };
    const innerCond: Condition = {
      type: 'simple',
      operator: 'eq',
      dataKey: '$b',
      value: '2',
    };
    const outerComp: ScreenComponent = {
      componentFamily: 'control',
      template: 'conditional',
      props: {
        if: outerCond,
        then: {
          componentFamily: 'control',
          template: 'conditional',
          props: {
            if: innerCond,
            then: {
              componentFamily: 'response',
              template: 'text-input',
              props: { dataKey: 'deep', label: 'D', required: true },
            },
          },
        },
      },
    };
    const descriptors = collectFields([outerComp], null);
    const schema = buildSchemaFromFields(descriptors, { data: {} });

    expect(schema.safeParse({ a: '1', b: '2', deep: '' }).success).toBe(false);
    expect(schema.safeParse({ a: '1', b: '2', deep: 'filled' }).success).toBe(
      true,
    );
    expect(schema.safeParse({ a: '1', b: '3', deep: '' }).success).toBe(true);
    expect(schema.safeParse({ a: '2', b: '2', deep: '' }).success).toBe(true);
  });

  it('static for-each + conditional: each entry enforces its resolved condition', () => {
    const forEachComp: ScreenComponent = {
      componentFamily: 'control',
      template: 'for-each',
      props: {
        type: 'static',
        id: 'items',
        values: ['alpha', 'beta'],
        component: {
          componentFamily: 'control',
          template: 'conditional',
          props: {
            if: {
              type: 'simple',
              operator: 'eq',
              dataKey: '$gate_{{#items.index}}',
              value: 'show',
            },
            then: {
              componentFamily: 'response',
              template: 'text-input',
              props: {
                dataKey: 'resp_{{#items.index}}',
                label: 'R',
                required: true,
              },
            },
          },
        },
      },
    };
    const descriptors = collectFields([forEachComp], null);
    const schema = buildSchemaFromFields(descriptors, { data: {} });

    expect(
      schema.safeParse({
        gate_0: 'show',
        resp_0: '',
        gate_1: 'hide',
        resp_1: '',
      }).success,
    ).toBe(false);
    expect(
      schema.safeParse({
        gate_0: 'hide',
        resp_0: '',
        gate_1: 'hide',
        resp_1: '',
      }).success,
    ).toBe(true);
    expect(
      schema.safeParse({
        gate_0: 'show',
        resp_0: 'a',
        gate_1: 'show',
        resp_1: 'b',
      }).success,
    ).toBe(true);
  });
});

describe('buildSchemaFromFields — superRefine, dynamic for-each', () => {
  it('does not validate synthetic :order when its condition is false', () => {
    // randomized radio inside a conditional inside a dynamic for-each
    // when the condition is false, neither the field nor its :order key should be enforced
    const c: ScreenComponent = {
      componentFamily: 'control',
      template: 'for-each',
      props: {
        type: 'dynamic',
        id: 'items',
        dataKey: '$items',
        component: {
          componentFamily: 'control',
          template: 'conditional',
          props: {
            if: {
              type: 'simple',
              dataKey: '$showRadio',
              operator: 'eq',
              value: 'yes',
            },
            then: {
              componentFamily: 'response',
              template: 'radio',
              props: {
                dataKey: 'choice-{{#items.value}}',
                label: 'Choice',
                options: [{ label: 'A', value: 'a' }],
                randomize: true,
              },
            },
          },
        },
      },
    };
    const descriptors = collectFields([c], null);
    const schema = buildSchemaFromFields(descriptors, {
      data: { showRadio: 'no' },
    });

    // condition is false — neither choice-x nor choice-x:order should be required
    expect(schema.safeParse({ items: ['x', 'y'] }).success).toBe(true);
  });

  it('validates dynamic fields resolved from $-prefixed screen data', () => {
    const c: ScreenComponent = {
      componentFamily: 'control',
      template: 'for-each',
      props: {
        type: 'dynamic',
        id: 'countries',
        dataKey: '$selectedCountries',
        component: {
          componentFamily: 'response',
          template: 'slider',
          props: {
            dataKey: 'slider-{{#countries.value}}',
            label: 'S',
            min: 0,
            max: 10,
            required: true,
          },
        },
      },
    };
    const descriptors = collectFields([c], null);
    const schema = buildSchemaFromFields(descriptors, { data: {} });

    expect(
      schema.safeParse({
        selectedCountries: ['argentina', 'brazil'],
        'slider-argentina': 5,
        'slider-brazil': 8,
      }).success,
    ).toBe(true);

    expect(
      schema.safeParse({
        selectedCountries: ['argentina', 'brazil'],
        'slider-argentina': null,
        'slider-brazil': 8,
      }).success,
    ).toBe(false);
  });

  it('passes when selectedCountries is empty — no dynamic keys to validate', () => {
    const c: ScreenComponent = {
      componentFamily: 'control',
      template: 'for-each',
      props: {
        type: 'dynamic',
        id: 'countries',
        dataKey: '$selectedCountries',
        component: {
          componentFamily: 'response',
          template: 'slider',
          props: {
            dataKey: 'slider-{{#countries.value}}',
            label: 'S',
            min: 0,
            max: 10,
            required: true,
          },
        },
      },
    };
    const descriptors = collectFields([c], null);
    const schema = buildSchemaFromFields(descriptors, { data: {} });
    expect(schema.safeParse({ selectedCountries: [] }).success).toBe(true);
  });

  it('passes when dynamic for-each dataKey is absent from submitted data', () => {
    const c: ScreenComponent = {
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
            dataKey: 'field-{{#items.value}}',
            label: 'F',
            required: true,
          },
        },
      },
    };
    const descriptors = collectFields([c], null);
    const schema = buildSchemaFromFields(descriptors, { data: {} });
    expect(schema.safeParse({}).success).toBe(true);
  });

  it('validates conditional field inside dynamic for-each', () => {
    const c: ScreenComponent = {
      componentFamily: 'control',
      template: 'for-each',
      props: {
        type: 'dynamic',
        id: 'countries',
        dataKey: '$selectedCountries',
        component: {
          componentFamily: 'control',
          template: 'conditional',
          props: {
            if: {
              type: 'simple',
              operator: 'eq',
              dataKey: '$mode_{{#countries.value}}',
              value: 'detail',
            },
            then: {
              componentFamily: 'response',
              template: 'text-input',
              props: {
                dataKey: 'detail-{{#countries.value}}',
                label: 'D',
                required: true,
              },
            },
          },
        },
      },
    };
    const descriptors = collectFields([c], null);
    const schema = buildSchemaFromFields(descriptors, { data: {} });

    expect(
      schema.safeParse({
        selectedCountries: ['argentina'],
        mode_argentina: 'detail',
        'detail-argentina': '',
      }).success,
    ).toBe(false);

    expect(
      schema.safeParse({
        selectedCountries: ['argentina'],
        mode_argentina: 'detail',
        'detail-argentina': 'Buenos Aires',
      }).success,
    ).toBe(true);

    expect(
      schema.safeParse({
        selectedCountries: ['argentina'],
        mode_argentina: 'summary',
        'detail-argentina': '',
      }).success,
    ).toBe(true);
  });

  it('enforces full slider range for dynamic for-each entry', () => {
    const c: ScreenComponent = {
      componentFamily: 'control',
      template: 'for-each',
      props: {
        type: 'dynamic',
        id: 'items',
        dataKey: '$items',
        component: {
          componentFamily: 'response',
          template: 'slider',
          props: {
            dataKey: 'rating-{{#items.value}}',
            label: 'R',
            min: 1,
            max: 5,
          },
        },
      },
    };
    const descriptors = collectFields([c], null);
    const schema = buildSchemaFromFields(descriptors, { data: {} });

    expect(schema.safeParse({ items: ['a'], 'rating-a': 10 }).success).toBe(
      false,
    );
    expect(schema.safeParse({ items: ['a'], 'rating-a': 3 }).success).toBe(
      true,
    );
  });

  it('validates nested dynamic for-each — outer × inner produces correct concrete keys', () => {
    // outer: for-each over $groups (id=groups)
    // inner: for-each over $items   (id=items)
    // field key: answer-{{#groups.value}}-{{#items.value}}
    const inner: ScreenComponent = {
      componentFamily: 'control',
      template: 'for-each',
      props: {
        type: 'dynamic',
        id: 'items',
        dataKey: '$items',
        component: {
          componentFamily: 'response',
          template: 'slider',
          props: {
            dataKey: 'answer-{{#groups.value}}-{{#items.value}}',
            label: 'A',
            min: 0,
            max: 10,
            required: true,
          },
        },
      },
    };
    const outer: ScreenComponent = {
      componentFamily: 'control',
      template: 'for-each',
      props: {
        type: 'dynamic',
        id: 'groups',
        dataKey: '$groups',
        component: inner,
      },
    };

    const descriptors = collectFields([outer], null);
    const schema = buildSchemaFromFields(descriptors, {
      screenData: { groups: ['g1', 'g2'], items: ['i1', 'i2'] },
    });

    // all four cells filled → valid
    expect(
      schema.safeParse({
        groups: ['g1', 'g2'],
        items: ['i1', 'i2'],
        'answer-g1-i1': 1,
        'answer-g1-i2': 2,
        'answer-g2-i1': 3,
        'answer-g2-i2': 4,
      }).success,
    ).toBe(true);

    // one cell missing → invalid
    expect(
      schema.safeParse({
        groups: ['g1', 'g2'],
        items: ['i1', 'i2'],
        'answer-g1-i1': 1,
        'answer-g1-i2': 2,
        'answer-g2-i1': null,
        'answer-g2-i2': 4,
      }).success,
    ).toBe(false);
  });
});

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
            then: {
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
            then: {
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
            then: {
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
            then: {
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

describe('static for-each — generates N schema entries', () => {
  it('creates one entry per static value with @index resolved', () => {
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

  it('creates one entry per static value with value token resolved', () => {
    const schema = buildSchema(
      screen([
        {
          componentFamily: 'control',
          template: 'for-each',
          props: {
            type: 'static',
            id: 'fruits',
            values: ['apple', 'banana'],
            component: {
              componentFamily: 'response',
              template: 'text-input',
              props: {
                dataKey: 'like-{{#fruits.value}}',
                label: 'Like',
                required: true,
              },
            },
          },
        },
      ]),
    );
    expect(
      schema.safeParse({ 'like-apple': 'yes', 'like-banana': 'yes' }).success,
    ).toBe(true);
    expect(
      schema.safeParse({ 'like-apple': '', 'like-banana': 'yes' }).success,
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
    // only 2 values → keys item_0 and item_1
    expect(schema.safeParse({ item_0: 'x', item_1: 'y' }).success).toBe(true);
    // extra key item_2 is irrelevant (zod strips or passes unknowns)
    expect(schema.safeParse({ item_0: '', item_1: 'y' }).success).toBe(false);
  });
});

describe('dynamic for-each with randomized component — :order key validated', () => {
  it('accepts a string array for the :order key', () => {
    const { schema } = buildScreenBindings(
      [
        {
          componentFamily: 'control',
          template: 'for-each',
          props: {
            type: 'dynamic',
            id: 'items',
            dataKey: '$$items',
            component: {
              componentFamily: 'response',
              template: 'radio',
              props: {
                dataKey: 'pick_{{#items.index}}',
                label: 'Pick',
                options: [
                  { label: 'A', value: 'a' },
                  { label: 'B', value: 'b' },
                ],
                randomize: true,
              },
            },
          },
        },
      ],
      { data: { items: ['x'] } },
    );
    expect(
      schema.safeParse({ pick_0: 'a', 'pick_0:order': ['b', 'a'] }).success,
    ).toBe(true);
  });

  it('accepts a missing :order key (appended by onSubmit, not a form field)', () => {
    const { schema } = buildScreenBindings(
      [
        {
          componentFamily: 'control',
          template: 'for-each',
          props: {
            type: 'dynamic',
            id: 'items',
            dataKey: '$$items',
            component: {
              componentFamily: 'response',
              template: 'radio',
              props: {
                dataKey: 'pick_{{#items.index}}',
                label: 'Pick',
                options: [{ label: 'A', value: 'a' }],
                randomize: true,
              },
            },
          },
        },
      ],
      { data: { items: ['x'] } },
    );
    expect(schema.safeParse({ pick_0: 'a' }).success).toBe(true);
  });

  it('rejects a non-array :order value', () => {
    const { schema } = buildScreenBindings(
      [
        {
          componentFamily: 'control',
          template: 'for-each',
          props: {
            type: 'dynamic',
            id: 'items',
            dataKey: '$$items',
            component: {
              componentFamily: 'response',
              template: 'radio',
              props: {
                dataKey: 'pick_{{#items.index}}',
                label: 'Pick',
                options: [{ label: 'A', value: 'a' }],
                randomize: true,
              },
            },
          },
        },
      ],
      { data: { items: ['x'] } },
    );
    expect(
      schema.safeParse({ pick_0: 'a', 'pick_0:order': 'not-an-array' }).success,
    ).toBe(false);
  });
});

describe('dynamic for-each — gracefully skipped', () => {
  it('produces no entries for dynamic for-each', () => {
    const schema = buildSchema(
      screen([
        {
          componentFamily: 'control',
          template: 'for-each',
          props: {
            type: 'dynamic',
            id: 'items',
            dataKey: '$$items',
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
    // No fields registered — empty object passes
    expect(schema.safeParse({}).success).toBe(true);
  });
});

describe('dynamic for-each nested inside static for-each', () => {
  it('validates dynamic fields with outer static key resolved and inner dynamic key resolved at runtime', () => {
    const { schema } = buildScreenBindings(
      [
        {
          componentFamily: 'control',
          template: 'for-each',
          props: {
            type: 'static',
            id: 'outer',
            values: ['a', 'b'],
            component: {
              componentFamily: 'control',
              template: 'for-each',
              props: {
                type: 'dynamic',
                id: 'inner',
                dataKey: '$$items',
                component: {
                  componentFamily: 'response',
                  template: 'text-input',
                  props: {
                    dataKey: '{{#outer.value}}_{{#inner.index}}',
                    label: 'Item',
                    required: true,
                  },
                },
              },
            },
          },
        },
      ],
      { data: { items: ['x', 'y'] } },
    );
    // outer values ['a','b'] × inner dynamic ['x','y'] → a_0, a_1, b_0, b_1
    expect(
      schema.safeParse({ a_0: 'v', a_1: 'v', b_0: 'v', b_1: 'v' }).success,
    ).toBe(true);
    expect(
      schema.safeParse({ a_0: '', a_1: 'v', b_0: 'v', b_1: 'v' }).success,
    ).toBe(false);
  });
});

describe('randomize :order key', () => {
  it('does not strip :order from validated data for randomize:true radio', () => {
    const s: FrameworkScreen = {
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
    const { schema } = buildScreenBindings(s.components, { data: {} });
    const result = schema.safeParse({
      choice: 'a',
      'choice:order': ['b', 'a'],
    });
    expect(result.success).toBe(true);
    expect(result.data?.['choice:order']).toEqual(['b', 'a']);
  });

  it('does not strip :order from validated data for randomize:true checkboxes', () => {
    const s: FrameworkScreen = {
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
    const { schema } = buildScreenBindings(s.components, { data: {} });
    const result = schema.safeParse({
      picks: ['a'],
      'picks:order': ['b', 'a'],
    });
    expect(result.success).toBe(true);
    expect(result.data?.['picks:order']).toEqual(['b', 'a']);
  });

  it('does not strip :order from validated data for randomize:true dropdown', () => {
    const s: FrameworkScreen = {
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
    const { schema } = buildScreenBindings(s.components, { data: {} });
    const result = schema.safeParse({
      selected: 'a',
      'selected:order': ['b', 'a'],
    });
    expect(result.success).toBe(true);
    expect(result.data?.['selected:order']).toEqual(['b', 'a']);
  });

  // Note: unknown keys including :order for non-randomized fields are not stripped
  // because the schema uses .passthrough() — required so dynamic for-each keys survive Zod.
});
