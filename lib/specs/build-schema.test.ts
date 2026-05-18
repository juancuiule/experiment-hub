import { Condition } from '@/lib/conditions';
import { ScreenComponent } from '@/lib/components';
import { collectDescriptors, buildSchemaFromDescriptors } from '@/lib/screen-validation';
import { describe, expect, it } from 'vitest';

describe('collectDescriptors — response', () => {
  it('emits one descriptor with correct key and no condition', () => {
    const c: ScreenComponent = {
      componentFamily: 'response',
      template: 'text-input',
      props: { dataKey: 'name', label: 'Name' },
    };
    const result = collectDescriptors([c], null);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      key: 'name',
      synthetic: false,
      dynamic: false,
      condition: null,
    });
  });

  it('carries enclosingCondition on the descriptor', () => {
    const cond: Condition = { type: 'simple', operator: 'eq', dataKey: '$q', value: 'yes' };
    const c: ScreenComponent = {
      componentFamily: 'response',
      template: 'text-input',
      props: { dataKey: 'name', label: 'Name' },
    };
    const result = collectDescriptors([c], cond);
    expect(result[0].condition).toEqual(cond);
  });

  it('emits synthetic __order descriptor for randomized radio', () => {
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
    const result = collectDescriptors([c], null);
    expect(result).toHaveLength(2);
    expect(result[1]).toMatchObject({
      key: 'choice__order',
      synthetic: true,
      dynamic: false,
      condition: null,
    });
  });

  it('synthetic __order inherits enclosingCondition', () => {
    const cond: Condition = { type: 'simple', operator: 'eq', dataKey: '$x', value: '1' };
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
    const result = collectDescriptors([c], cond);
    expect(result[1].condition).toEqual(cond);
  });
});

describe('collectDescriptors — group', () => {
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
    const result = collectDescriptors([c], null);
    expect(result.map((d) => d.key)).toEqual(['x', 'y']);
  });

  it('threads enclosingCondition through group children', () => {
    const cond: Condition = { type: 'simple', operator: 'eq', dataKey: '$a', value: '1' };
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
    const result = collectDescriptors([c], cond);
    expect(result[0].condition).toEqual(cond);
  });
});

describe('collectDescriptors — content', () => {
  it('returns empty for rich-text content', () => {
    const c: ScreenComponent = {
      componentFamily: 'content',
      template: 'rich-text',
      props: { content: 'Hello' },
    };
    expect(collectDescriptors([c], null)).toHaveLength(0);
  });
});

describe('collectDescriptors — conditional', () => {
  it('if-branch descriptor gets the conditional condition', () => {
    const cond: Condition = { type: 'simple', operator: 'eq', dataKey: '$answer', value: 'yes' };
    const c: ScreenComponent = {
      componentFamily: 'control',
      template: 'conditional',
      props: {
        if: cond,
        component: {
          componentFamily: 'response',
          template: 'text-input',
          props: { dataKey: 'detail', label: 'Detail' },
        },
      },
    };
    const result = collectDescriptors([c], null);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ key: 'detail', condition: cond });
  });

  it('else-branch descriptor gets NOT condition', () => {
    const cond: Condition = { type: 'simple', operator: 'eq', dataKey: '$answer', value: 'yes' };
    const c: ScreenComponent = {
      componentFamily: 'control',
      template: 'conditional',
      props: {
        if: cond,
        component: {
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
    const result = collectDescriptors([c], null);
    expect(result).toHaveLength(2);
    expect(result[0].key).toBe('if-field');
    expect(result[1].key).toBe('else-field');
    expect(result[1].condition).toEqual({ type: 'not', condition: cond });
  });

  it('threads enclosingCondition with AND when nesting conditionals', () => {
    const outer: Condition = { type: 'simple', operator: 'eq', dataKey: '$p', value: 'a' };
    const inner: Condition = { type: 'simple', operator: 'eq', dataKey: '$q', value: 'b' };
    const c: ScreenComponent = {
      componentFamily: 'control',
      template: 'conditional',
      props: {
        if: inner,
        component: {
          componentFamily: 'response',
          template: 'text-input',
          props: { dataKey: 'nested', label: 'N' },
        },
      },
    };
    const result = collectDescriptors([c], outer);
    expect(result[0].condition).toEqual({ type: 'and', conditions: [outer, inner] });
  });

  it('same-key if/else emits two descriptors with complementary conditions', () => {
    const cond: Condition = { type: 'simple', operator: 'eq', dataKey: '$mode', value: 'advanced' };
    const c: ScreenComponent = {
      componentFamily: 'control',
      template: 'conditional',
      props: {
        if: cond,
        component: {
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
    const result = collectDescriptors([c], null);
    expect(result).toHaveLength(2);
    expect(result[0].condition).toEqual(cond);
    expect(result[1].condition).toEqual({ type: 'not', condition: cond });
  });
});

describe('collectDescriptors — static for-each', () => {
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
    const result = collectDescriptors([c], null);
    expect(result.map((d) => d.key)).toEqual(['sport_0', 'sport_1']);
    expect(result.every((d) => d.dynamic === false)).toBe(true);
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
    const result = collectDescriptors([c], null);
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
            if: { type: 'simple', operator: 'eq', dataKey: '$resp_{{#items.index}}', value: 'yes' },
            component: {
              componentFamily: 'response',
              template: 'text-input',
              props: { dataKey: 'detail_{{#items.index}}', label: 'D' },
            },
          },
        },
      },
    };
    const result = collectDescriptors([c], null);
    expect(result[0].key).toBe('detail_0');
    expect(result[0].condition).toEqual({
      type: 'simple',
      operator: 'eq',
      dataKey: '$resp_0',
      value: 'yes',
    });
    expect(result[1].key).toBe('detail_1');
    expect(result[1].condition).toEqual({
      type: 'simple',
      operator: 'eq',
      dataKey: '$resp_1',
      value: 'yes',
    });
  });

  it('threads enclosingCondition into unrolled descriptors', () => {
    const outer: Condition = { type: 'simple', operator: 'eq', dataKey: '$gate', value: '1' };
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
    const result = collectDescriptors([c], outer);
    expect(result[0].condition).toEqual(outer);
  });

  it('synthetic __order inherits dynamic:false from static for-each', () => {
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
    const result = collectDescriptors([c], null);
    expect(result).toHaveLength(2);
    expect(result[1]).toMatchObject({ key: 'pick_0__order', synthetic: true, dynamic: false });
  });
});

describe('collectDescriptors — dynamic for-each', () => {
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
          props: { dataKey: 'slider-{{#countries.value}}', label: 'S', min: 0, max: 10 },
        },
      },
    };
    const result = collectDescriptors([c], null);
    expect(result).toHaveLength(1);
    expect(result[0].dynamic).toBe(true);
    expect(result[0].key).toBe('slider-{{#countries.value}}');
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
          props: { dataKey: 'slider-{{#countries.value}}', label: 'S', min: 0, max: 10 },
        },
      },
    };
    const result = collectDescriptors([c], null);
    const d = result[0] as Extract<(typeof result)[0], { dynamic: true }>;
    expect(d.foreach).toEqual({ id: 'countries', dataKey: '$countryList' });
  });

  it('threads enclosingCondition into dynamic descriptors', () => {
    const cond: Condition = { type: 'simple', operator: 'eq', dataKey: '$enabled', value: 'yes' };
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
    const result = collectDescriptors([c], cond);
    expect(result[0].condition).toEqual(cond);
  });

  it('synthetic __order from dynamic for-each is also dynamic', () => {
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
    const result = collectDescriptors([c], null);
    expect(result).toHaveLength(2);
    expect(result[1]).toMatchObject({ synthetic: true, dynamic: true, key: 'pick-{{#items.value}}__order' });
  });
});

describe('buildSchemaFromDescriptors — base shape', () => {
  it('unconditional required text-input validates normally', () => {
    const c: ScreenComponent = {
      componentFamily: 'response',
      template: 'text-input',
      props: { dataKey: 'name', label: 'Name', required: true },
    };
    const descriptors = collectDescriptors([c], null);
    const schema = buildSchemaFromDescriptors(descriptors, { data: {} });
    expect(schema.safeParse({ name: 'Alice' }).success).toBe(true);
    expect(schema.safeParse({ name: '' }).success).toBe(false);
  });

  it('synthetic __order field accepts array of strings', () => {
    const c: ScreenComponent = {
      componentFamily: 'response',
      template: 'radio',
      props: { dataKey: 'choice', label: 'C', options: [], randomize: true },
    };
    const descriptors = collectDescriptors([c], null);
    const schema = buildSchemaFromDescriptors(descriptors, { data: {} });
    expect(schema.safeParse({ choice: 'a', choice__order: ['b', 'a'] }).success).toBe(true);
  });

  it('conditional field is z.any().optional() in base shape — accepts any value', () => {
    const cond: Condition = { type: 'simple', operator: 'eq', dataKey: '$q', value: 'yes' };
    const c: ScreenComponent = {
      componentFamily: 'response',
      template: 'text-input',
      props: { dataKey: 'detail', label: 'D', required: true },
    };
    const descriptors = collectDescriptors([c], cond);
    const schema = buildSchemaFromDescriptors(descriptors, { data: {} });
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
          props: { dataKey: 'field-{{#items.value}}', label: 'F', required: true },
        },
      },
    };
    const descriptors = collectDescriptors([c], null);
    const schema = buildSchemaFromDescriptors(descriptors, { data: {} });
    expect(schema.safeParse({ 'field-argentina': 'hello' }).success).toBe(true);
    expect(schema.safeParse({}).success).toBe(true);
  });
});

describe('buildSchemaFromDescriptors — superRefine, static conditional', () => {
  it('enforces required on conditional field when condition is met', () => {
    const cond: Condition = { type: 'simple', operator: 'eq', dataKey: '$answer', value: 'yes' };
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
      props: { if: cond, component: field },
    };
    const descriptors = collectDescriptors([gate, conditional], null);
    const schema = buildSchemaFromDescriptors(descriptors, { data: {} });
    expect(schema.safeParse({ answer: 'yes', detail: '' }).success).toBe(false);
    expect(schema.safeParse({ answer: 'yes', detail: 'some text' }).success).toBe(true);
    expect(schema.safeParse({ answer: 'no' }).success).toBe(true);
  });

  it('enforces minLength on conditional field when condition is met', () => {
    const cond: Condition = { type: 'simple', operator: 'eq', dataKey: '$show', value: 'yes' };
    const field: ScreenComponent = {
      componentFamily: 'response',
      template: 'text-input',
      props: { dataKey: 'bio', label: 'Bio', required: false, minLength: { value: 10 } },
    };
    const descriptors = collectDescriptors([field], cond);
    const schema = buildSchemaFromDescriptors(descriptors, { data: {} });
    expect(schema.safeParse({ show: 'yes', bio: 'short' }).success).toBe(false);
    expect(schema.safeParse({ show: 'yes', bio: 'long enough bio' }).success).toBe(true);
    expect(schema.safeParse({ show: 'no', bio: 'short' }).success).toBe(true);
  });

  it('enforces maxLength on conditional field when condition is met', () => {
    const cond: Condition = { type: 'simple', operator: 'eq', dataKey: '$show', value: 'yes' };
    const field: ScreenComponent = {
      componentFamily: 'response',
      template: 'text-input',
      props: { dataKey: 'code', label: 'Code', maxLength: { value: 5 } },
    };
    const descriptors = collectDescriptors([field], cond);
    const schema = buildSchemaFromDescriptors(descriptors, { data: {} });
    expect(schema.safeParse({ show: 'yes', code: 'toolong' }).success).toBe(false);
    expect(schema.safeParse({ show: 'yes', code: 'ok' }).success).toBe(true);
  });

  it('enforces slider range on conditional field when condition is met', () => {
    const cond: Condition = { type: 'simple', operator: 'eq', dataKey: '$show', value: 'yes' };
    const field: ScreenComponent = {
      componentFamily: 'response',
      template: 'slider',
      props: { dataKey: 'vol', label: 'Volume', min: 0, max: 100 },
    };
    const descriptors = collectDescriptors([field], cond);
    const schema = buildSchemaFromDescriptors(descriptors, { data: {} });
    expect(schema.safeParse({ show: 'yes', vol: 150 }).success).toBe(false);
    expect(schema.safeParse({ show: 'yes', vol: 50 }).success).toBe(true);
  });

  it('does not run validation on conditional field when condition is not met', () => {
    const cond: Condition = { type: 'simple', operator: 'eq', dataKey: '$show', value: 'yes' };
    const field: ScreenComponent = {
      componentFamily: 'response',
      template: 'text-input',
      props: { dataKey: 'detail', label: 'Detail', required: true, minLength: { value: 20 } },
    };
    const descriptors = collectDescriptors([field], cond);
    const schema = buildSchemaFromDescriptors(descriptors, { data: {} });
    expect(schema.safeParse({ show: 'no', detail: '' }).success).toBe(true);
  });

  it('propagates issues with correct field path', () => {
    const cond: Condition = { type: 'simple', operator: 'eq', dataKey: '$show', value: 'yes' };
    const field: ScreenComponent = {
      componentFamily: 'response',
      template: 'text-input',
      props: { dataKey: 'detail', label: 'Detail', required: true },
    };
    const descriptors = collectDescriptors([field], cond);
    const schema = buildSchemaFromDescriptors(descriptors, { data: {} });
    const result = schema.safeParse({ show: 'yes', detail: '' });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path[0]);
      expect(paths).toContain('detail');
    }
  });

  it('same-key if/else: only the active branch validates', () => {
    const cond: Condition = { type: 'simple', operator: 'eq', dataKey: '$mode', value: 'num' };
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
      props: { if: cond, component: numField, else: textField },
    };
    const descriptors = collectDescriptors([conditional], null);
    const schema = buildSchemaFromDescriptors(descriptors, { data: {} });

    expect(schema.safeParse({ mode: 'num', value: 5 }).success).toBe(true);
    expect(schema.safeParse({ mode: 'num', value: '' }).success).toBe(false);
    expect(schema.safeParse({ mode: 'text', value: 'hello' }).success).toBe(true);
    expect(schema.safeParse({ mode: 'text', value: '' }).success).toBe(false);
  });

  it('nested: conditional inside conditional composes conditions with AND', () => {
    const outerCond: Condition = { type: 'simple', operator: 'eq', dataKey: '$a', value: '1' };
    const innerCond: Condition = { type: 'simple', operator: 'eq', dataKey: '$b', value: '2' };
    const outerComp: ScreenComponent = {
      componentFamily: 'control',
      template: 'conditional',
      props: {
        if: outerCond,
        component: {
          componentFamily: 'control',
          template: 'conditional',
          props: {
            if: innerCond,
            component: {
              componentFamily: 'response',
              template: 'text-input',
              props: { dataKey: 'deep', label: 'D', required: true },
            },
          },
        },
      },
    };
    const descriptors = collectDescriptors([outerComp], null);
    const schema = buildSchemaFromDescriptors(descriptors, { data: {} });

    expect(schema.safeParse({ a: '1', b: '2', deep: '' }).success).toBe(false);
    expect(schema.safeParse({ a: '1', b: '2', deep: 'filled' }).success).toBe(true);
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
            if: { type: 'simple', operator: 'eq', dataKey: '$gate_{{#items.index}}', value: 'show' },
            component: {
              componentFamily: 'response',
              template: 'text-input',
              props: { dataKey: 'resp_{{#items.index}}', label: 'R', required: true },
            },
          },
        },
      },
    };
    const descriptors = collectDescriptors([forEachComp], null);
    const schema = buildSchemaFromDescriptors(descriptors, { data: {} });

    expect(schema.safeParse({ gate_0: 'show', resp_0: '', gate_1: 'hide', resp_1: '' }).success).toBe(false);
    expect(schema.safeParse({ gate_0: 'hide', resp_0: '', gate_1: 'hide', resp_1: '' }).success).toBe(true);
    expect(schema.safeParse({ gate_0: 'show', resp_0: 'a', gate_1: 'show', resp_1: 'b' }).success).toBe(true);
  });
});

describe('buildSchemaFromDescriptors — superRefine, dynamic for-each', () => {
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
          props: { dataKey: 'slider-{{#countries.value}}', label: 'S', min: 0, max: 10, required: true },
        },
      },
    };
    const descriptors = collectDescriptors([c], null);
    const schema = buildSchemaFromDescriptors(descriptors, { data: {} });

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
          props: { dataKey: 'slider-{{#countries.value}}', label: 'S', min: 0, max: 10, required: true },
        },
      },
    };
    const descriptors = collectDescriptors([c], null);
    const schema = buildSchemaFromDescriptors(descriptors, { data: {} });
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
          props: { dataKey: 'field-{{#items.value}}', label: 'F', required: true },
        },
      },
    };
    const descriptors = collectDescriptors([c], null);
    const schema = buildSchemaFromDescriptors(descriptors, { data: {} });
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
            component: {
              componentFamily: 'response',
              template: 'text-input',
              props: { dataKey: 'detail-{{#countries.value}}', label: 'D', required: true },
            },
          },
        },
      },
    };
    const descriptors = collectDescriptors([c], null);
    const schema = buildSchemaFromDescriptors(descriptors, { data: {} });

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
          props: { dataKey: 'rating-{{#items.value}}', label: 'R', min: 1, max: 5 },
        },
      },
    };
    const descriptors = collectDescriptors([c], null);
    const schema = buildSchemaFromDescriptors(descriptors, { data: {} });

    expect(schema.safeParse({ items: ['a'], 'rating-a': 10 }).success).toBe(false);
    expect(schema.safeParse({ items: ['a'], 'rating-a': 3 }).success).toBe(true);
  });
});
