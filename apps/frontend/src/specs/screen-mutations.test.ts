import type { ScreenComponent } from '@experiment-hub/engine/components';
import type { ExperimentFlow } from '@experiment-hub/engine/types';
import { describe, expect, it } from 'vitest';
import {
  collectDataKeys,
  getAt,
  insertAt,
  listComponents,
  moveInArray,
  removeAt,
  renameDataKey,
  skeletonComponent,
  uniqueDataKey,
  updateAt,
} from '../editor/screen-mutations';

const rt = (content: string): ScreenComponent =>
  ({
    componentFamily: 'content',
    template: 'rich-text',
    props: { content },
  }) as ScreenComponent;

const radio = (dataKey: string): ScreenComponent =>
  ({
    componentFamily: 'response',
    template: 'radio',
    props: {
      dataKey,
      label: 'Pick',
      options: [{ label: 'A', value: 'a' }],
    },
  }) as ScreenComponent;

const group = (...components: ScreenComponent[]): ScreenComponent =>
  ({
    componentFamily: 'layout',
    template: 'group',
    props: { name: 'g', components },
  }) as ScreenComponent;

const conditional = (
  then: ScreenComponent,
  else_?: ScreenComponent,
): ScreenComponent =>
  ({
    componentFamily: 'control',
    template: 'conditional',
    props: {
      if: { type: 'simple', dataKey: '$$x.y', operator: 'eq', value: 1 },
      then,
      ...(else_ ? { else: else_ } : {}),
    },
  }) as ScreenComponent;

const forEach = (component: ScreenComponent): ScreenComponent =>
  ({
    componentFamily: 'control',
    template: 'for-each',
    props: { type: 'static', values: [1], id: 'fe', component },
  }) as ScreenComponent;

const tree = [
  rt('intro'),
  group(rt('inner-0'), radio('q1')),
  conditional(radio('q2'), rt('fallback')),
  forEach(radio('q3')),
  rt('end'),
];

describe('component tree ops', () => {
  it('getAt resolves nested paths', () => {
    expect(getAt(tree, [0])).toBe(tree[0]);
    expect(getAt(tree, [1, 'components', 1])).toBe(
      (tree[1].props as { components: ScreenComponent[] }).components[1],
    );
    expect(getAt(tree, [2, 'then'])).toBe(
      (tree[2].props as { then: ScreenComponent }).then,
    );
    expect(getAt(tree, [3, 'component'])).toBe(
      (tree[3].props as { component: ScreenComponent }).component,
    );
    expect(getAt(tree, [9])).toBeUndefined();
    expect(getAt(tree, [2, 'missing'])).toBeUndefined();
  });

  it('updateAt patches a nested component without touching siblings', () => {
    const next = updateAt(
      tree,
      [1, 'components', 1],
      (c) => ({ ...c, props: { ...c.props, label: 'Edited' } }) as ScreenComponent,
    );
    const inner = getAt(next, [1, 'components', 1])!;
    expect((inner.props as { label: string }).label).toBe('Edited');
    // Original untouched
    expect(getAt(tree, [1, 'components', 1])).toBe(
      (tree[1].props as { components: ScreenComponent[] }).components[1],
    );
  });

  it('removeAt drops array members and clears else', () => {
    const a = removeAt(tree, [4]);
    expect(a).toHaveLength(4);
    expect(getAt(a, [3])).toBe(tree[3]); // forEach shifted to index 3
    const b = removeAt(tree, [2, 'else']);
    const cond = getAt(b, [2])!;
    expect('else' in (cond.props as object)).toBe(false);
    // Removing a required slot is a no-op
    expect(removeAt(tree, [2, 'then'])).toBe(tree);
  });

  it('insertAt adds into root and into a group array', () => {
    const a = insertAt(tree, [], 0, rt('new-first'));
    expect(getAt(a, [0])).toEqual(expect.objectContaining({ template: 'rich-text' }));
    const b = insertAt(tree, [1, 'components'], 1, rt('mid'));
    expect(
      ((getAt(b, [1])!.props as { components: ScreenComponent[] }).components)
        .map((c) => (c.props as { content?: string }).content),
    ).toEqual(['inner-0', 'mid', undefined]);
  });

  it('moveInArray reorders within the array', () => {
    const a = moveInArray(tree, [], 0, 2);
    expect((getAt(a, [2])!.props as { content: string }).content).toBe('intro');
    // group-internal move
    const b = moveInArray(tree, [1, 'components'], 0, 1);
    const arr = (getAt(b, [1])!.props as { components: ScreenComponent[] })
      .components;
    expect((arr[0].props as { dataKey?: string }).dataKey).toBe('q1');
    expect((arr[1].props as { content?: string }).content).toBe('inner-0');
  });
});

describe('outline + dataKeys', () => {
  it('listComponents flattens with paths + depth', () => {
    const rows = listComponents(tree);
    expect(rows.map((r) => r.component.template)).toEqual([
      'rich-text',
      'group',
      'rich-text',
      'radio',
      'conditional',
      'radio',
      'rich-text',
      'for-each',
      'radio',
      'rich-text',
    ]);
    const q2 = rows.find(
      (r) =>
        (r.component.props as { dataKey?: string }).dataKey === 'q2',
    )!;
    expect(q2.path).toEqual([2, 'then']);
    expect(q2.inArray).toBe(false);
    expect(q2.depth).toBe(1);
  });

  it('collectDataKeys finds response keys + button payloads', () => {
    const withPayload = [
      ...tree,
      {
        componentFamily: 'layout',
        template: 'button',
        props: { text: 'Go', payload: { dataKey: 'clicked', value: 1 } },
      } as ScreenComponent,
    ];
    const keys = collectDataKeys(withPayload);
    expect(keys).toContain('q1');
    expect(keys).toContain('q3');
    expect(keys).toContain('clicked');
  });

  it('uniqueDataKey slugifies and de-dupes', () => {
    expect(uniqueDataKey(tree, 'How old are you?')).toBe('how-old-are-you');
    expect(uniqueDataKey(tree, 'q1')).toBe('q1-2');
    expect(uniqueDataKey(tree, '!!!')).toBe('field');
  });

  it('skeletonComponent builds response + control shells', () => {
    const s = skeletonComponent('slider', 'pain');
    expect(s.template).toBe('slider');
    expect((s.props as { dataKey: string }).dataKey).toBe('pain');
    const fe = skeletonComponent('for-each');
    expect((fe.props as { type: string }).type).toBe('static');
  });
});

describe('renameDataKey', () => {
  const flow: ExperimentFlow = {
    nodes: [
      { id: 'start', type: 'start' },
      { id: 'screen-s1', type: 'screen', props: { slug: 's1' } },
      {
        id: 'b1',
        type: 'branch',
        props: {
          name: 'branch-1',
          branches: [
            {
              id: 'yes',
              name: 'yes',
              config: {
                type: 'simple',
                dataKey: '$$s1.q1',
                operator: 'eq',
                value: 'a',
              },
            },
          ],
        },
      },
      {
        id: 'c1',
        type: 'compute',
        props: {
          name: 'c',
          computations: [
            {
              outputKey: 'total',
              formula: {
                type: 'lookup',
                input: '$$s1.q1',
                table: [],
                default: 0,
              },
            },
          ],
        },
      },
    ],
    edges: [
      { type: 'sequential', from: 'start', to: 'screen-s1' },
      { type: 'sequential', from: 'screen-s1', to: 'b1' },
    ],
    screens: [
      {
        slug: 's1',
        components: [
          radio('q1'),
          {
            componentFamily: 'content',
            template: 'rich-text',
            props: {
              content: 'You said {{$$s1.q1}} / live: {{$q1}}',
            },
          } as ScreenComponent,
          {
            componentFamily: 'layout',
            template: 'button',
            props: { text: 'Go', payload: { dataKey: 'q1', value: 'x' } },
          } as ScreenComponent,
        ],
      },
      {
        slug: 's2',
        components: [
          {
            componentFamily: 'content',
            template: 'rich-text',
            props: { content: 'Other screen: {{$$s1.q1}}' },
          } as ScreenComponent,
        ],
      },
    ],
  };

  it('renames the key + propagates to $$ refs, live refs, and payloads', () => {
    const next = renameDataKey(flow, 's1', 'q1', 'answer');
    const s1 = next.screens!.find((s) => s.slug === 's1')!;
    const s2 = next.screens!.find((s) => s.slug === 's2')!;
    const json = JSON.stringify(s1.components);

    // own dataKey + payload.dataKey renamed
    expect(json).toContain('"dataKey":"answer"');
    expect(json).not.toContain('"dataKey":"q1"');
    // interpolation + live refs renamed
    expect(json).toContain('{{$$s1.answer}}');
    expect(json).toContain('{{$answer}}');
    // cross-screen refs renamed
    expect(JSON.stringify(s2.components)).toContain('{{$$s1.answer}}');
    // branch condition + compute input renamed
    const branch = next.nodes.find((n) => n.id === 'b1')!;
    expect(JSON.stringify('props' in branch ? branch.props : {})).toContain(
      '$$s1.answer',
    );
    const comp = next.nodes.find((n) => n.id === 'c1')!;
    expect(JSON.stringify('props' in comp ? comp.props : {})).toContain(
      '$$s1.answer',
    );
    // original untouched
    expect(JSON.stringify(flow)).toContain('$$s1.q1');
  });

  it('does not touch refs in other screens that merely share the key', () => {
    const other: ExperimentFlow = {
      ...flow,
      screens: [
        ...flow.screens!,
        {
          slug: 's3',
          components: [
            {
              componentFamily: 'content',
              template: 'rich-text',
              props: { content: 's3 field: {{$$s3.q1}}' },
            } as ScreenComponent,
          ],
        },
      ],
    };
    const next = renameDataKey(other, 's1', 'q1', 'answer');
    const s3 = next.screens!.find((s) => s.slug === 's3')!;
    expect(JSON.stringify(s3.components)).toContain('{{$$s3.q1}}');
  });
});
