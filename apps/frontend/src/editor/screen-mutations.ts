import type { ScreenComponent } from '@experiment-hub/engine/components';
import type { ExperimentFlow } from '@experiment-hub/engine/types';

/**
 * Address of a component inside a screen's `components` tree.
 * Numbers index into component arrays; strings enter a named slot:
 * 'components' (group children), 'then'/'else' (conditional), 'component'
 * (for-each body). E.g. `[2, 'components', 0]` = root[2].props.components[0].
 */
export type CompPath = readonly (number | string)[];

// ─── Tree navigation ─────────────────────────────────────────────────────────

/** The component at `path`, or undefined if the path doesn't resolve. */
export function getAt(
  components: ScreenComponent[],
  path: CompPath,
): ScreenComponent | undefined {
  if (path.length === 0) return undefined;
  const [head, ...rest] = path;
  const next =
    typeof head === 'number' ? components[head] : undefined;
  if (!next) return undefined;
  if (rest.length === 0) return next;
  const p = next.props as Record<string, unknown>;
  const slot = rest[0];
  if (slot === 'components')
    return getAt(p.components as ScreenComponent[], rest.slice(1));
  if (slot === 'then' || slot === 'else' || slot === 'component') {
    const child = p[slot] as ScreenComponent | undefined;
    return child ? getAt([child], [0, ...rest.slice(1)]) : undefined;
  }
  return undefined;
}

/** Rebuild the tree with `fn` applied to the component at `path`. */
export function updateAt(
  components: ScreenComponent[],
  path: CompPath,
  fn: (c: ScreenComponent) => ScreenComponent,
): ScreenComponent[] {
  if (path.length === 0) return components;
  const [head, ...rest] = path;
  if (typeof head !== 'number') return components;
  return components.map((c, i) => {
    if (i !== head) return c;
    if (rest.length === 0) return fn(c);
    const p = c.props as Record<string, unknown>;
    const slot = rest[0] as string;
    if (slot === 'components')
      return {
        ...c,
        props: {
          ...p,
          components: updateAt(
            (p.components as ScreenComponent[]) ?? [],
            rest.slice(1),
            fn,
          ),
        },
      } as ScreenComponent;
    if (slot === 'then' || slot === 'else' || slot === 'component') {
      const child = p[slot] as ScreenComponent | undefined;
      if (!child) return c;
      return {
        ...c,
        props: {
          ...p,
          [slot]: updateAt([child], [0, ...rest.slice(1)], fn)[0],
        },
      } as ScreenComponent;
    }
    return c;
  });
}

/**
 * Remove the component at `path`. Legal when the path ends in an array index
 * (root/group children) or in 'else' (optional slot → cleared). `then` and
 * `component` slots are required — use replace instead.
 */
export function removeAt(
  components: ScreenComponent[],
  path: CompPath,
): ScreenComponent[] {
  const last = path[path.length - 1];
  if (last === 'else') {
    // Clear the optional else on the conditional at path minus 'else'.
    return updateAt(components, path.slice(0, -1), (c) => {
      const { else: _drop, ...rest } = c.props as Record<string, unknown>;
      return { ...c, props: rest } as ScreenComponent;
    });
  }
  if (typeof last !== 'number') return components;
  const parentArr = path.slice(0, -1);
  if (parentArr.length === 0)
    return components.filter((_, i) => i !== last);
  // The array lives under <parentPath>/components.
  const groupPath = parentArr.slice(0, -1); // strip trailing 'components'
  return updateAt(components, groupPath, (c) => {
    const p = c.props as Record<string, unknown>;
    const arr = (p.components as ScreenComponent[]) ?? [];
    return {
      ...c,
      props: { ...p, components: arr.filter((_, i) => i !== last) },
    } as ScreenComponent;
  });
}

/**
 * Insert `comp` at `index` inside the array addressed by `arrPath` —
 * `[]` = root `screen.components`, `[i, 'components']` = group i's children.
 */
export function insertAt(
  components: ScreenComponent[],
  arrPath: CompPath,
  index: number,
  comp: ScreenComponent,
): ScreenComponent[] {
  const splice = (arr: ScreenComponent[]) => [
    ...arr.slice(0, index),
    comp,
    ...arr.slice(index),
  ];
  if (arrPath.length === 0) return splice(components);
  const groupPath = arrPath.slice(0, -1); // strip trailing 'components'
  return updateAt(components, groupPath, (c) => {
    const p = c.props as Record<string, unknown>;
    const arr = (p.components as ScreenComponent[]) ?? [];
    return { ...c, props: { ...p, components: splice(arr) } } as ScreenComponent;
  });
}

/** Move an element within the array addressed by `arrPath`. */
export function moveInArray(
  components: ScreenComponent[],
  arrPath: CompPath,
  from: number,
  to: number,
): ScreenComponent[] {
  const move = (arr: ScreenComponent[]) => {
    if (from === to || from < 0 || to < 0 || from >= arr.length || to >= arr.length)
      return arr;
    const next = [...arr];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    return next;
  };
  if (arrPath.length === 0) return move(components);
  const groupPath = arrPath.slice(0, -1);
  return updateAt(components, groupPath, (c) => {
    const p = c.props as Record<string, unknown>;
    const arr = (p.components as ScreenComponent[]) ?? [];
    return { ...c, props: { ...p, components: move(arr) } } as ScreenComponent;
  });
}

// ─── Enumeration ─────────────────────────────────────────────────────────────

export type ComponentRow = {
  path: CompPath;
  component: ScreenComponent;
  /** Whether this component sits in an array (vs a single-child slot). */
  inArray: boolean;
  depth: number;
};

/** Flatten the tree into outline rows (depth-first, slots included). */
export function listComponents(components: ScreenComponent[]): ComponentRow[] {
  const rows: ComponentRow[] = [];
  /** Emit the subtrees of `c` (its children slots) under `base`/`depth`. */
  const children = (c: ScreenComponent, base: CompPath, depth: number) => {
    const p = c.props as Record<string, unknown>;
    if (Array.isArray(p.components))
      walk(p.components as ScreenComponent[], [...base, 'components'], depth, true);
    for (const slot of ['then', 'else', 'component'] as const) {
      const child = p[slot] as ScreenComponent | undefined;
      if (child) {
        const sp = [...base, slot];
        rows.push({ path: sp, component: child, inArray: false, depth });
        children(child, sp, depth + 1);
      }
    }
  };
  function walk(
    comps: ScreenComponent[],
    base: CompPath,
    depth: number,
    inArray: boolean,
  ) {
    comps.forEach((c, i) => {
      const path = [...base, i];
      rows.push({ path, component: c, inArray, depth });
      children(c, path, depth + 1);
    });
  }
  walk(components, [], 0, true);
  return rows;
}

/** dataKeys present in a screen's component tree. */
export function collectDataKeys(components: ScreenComponent[]): Set<string> {
  const keys = new Set<string>();
  const walk = (c: ScreenComponent) => {
    const p = c.props as Record<string, unknown>;
    if (typeof p.dataKey === 'string' && p.dataKey) keys.add(p.dataKey);
    const payload = p.payload as { dataKey?: string } | undefined;
    if (payload?.dataKey) keys.add(payload.dataKey);
    for (const child of (p.components as ScreenComponent[]) ?? []) walk(child);
    for (const slot of ['then', 'else', 'component'] as const)
      if (p[slot]) walk(p[slot] as ScreenComponent);
  };
  components.forEach(walk);
  return keys;
}

/** dataKey → occurrence count (response keys + button payloads). */
export function countDataKeys(
  components: ScreenComponent[],
): Map<string, number> {
  const counts = new Map<string, number>();
  const walk = (c: ScreenComponent) => {
    const p = c.props as Record<string, unknown>;
    for (const k of [
      p.dataKey,
      (p.payload as { dataKey?: string })?.dataKey,
    ])
      if (typeof k === 'string' && k) counts.set(k, (counts.get(k) ?? 0) + 1);
    for (const child of (p.components as ScreenComponent[]) ?? []) walk(child);
    for (const slot of ['then', 'else', 'component'] as const)
      if (p[slot]) walk(p[slot] as ScreenComponent);
  };
  components.forEach(walk);
  return counts;
}

/** Slugify a label → dataKey seed; append -2/-3… until unique. */
export function uniqueDataKey(
  components: ScreenComponent[],
  seed: string,
): string {
  const used = collectDataKeys(components);
  const base =
    seed
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'field';
  let key = base;
  for (let i = 2; used.has(key); i++) key = `${base}-${i}`;
  return key;
}

// ─── Skeletons ───────────────────────────────────────────────────────────────

const RT = (): ScreenComponent =>
  ({
    componentFamily: 'content',
    template: 'rich-text',
    props: { content: 'Text…' },
  }) as ScreenComponent;

/** Minimal valid component for a template. `dataKey` is required only for
 *  response templates. */
export function skeletonComponent(
  template: string,
  dataKey?: string,
): ScreenComponent {
  const resp = (props: Record<string, unknown>): ScreenComponent =>
    ({
      componentFamily: 'response',
      template,
      props: { dataKey: dataKey ?? 'field', label: 'Label', ...props },
    }) as ScreenComponent;
  const content = (props: Record<string, unknown>): ScreenComponent =>
    ({ componentFamily: 'content', template, props }) as ScreenComponent;

  switch (template) {
    case 'rich-text':
      return RT();
    case 'image':
      return content({ url: '', alt: '' });
    case 'video':
      return content({ url: '' });
    case 'audio':
      return content({ url: '' });
    case 'accordion':
      return content({ title: 'Title', body: 'Body' });
    case 'button':
      return {
        componentFamily: 'layout',
        template: 'button',
        props: { text: 'Continue' },
      } as ScreenComponent;
    case 'group':
      return {
        componentFamily: 'layout',
        template: 'group',
        props: { name: 'group', components: [RT()] },
      } as ScreenComponent;
    case 'conditional':
      return {
        componentFamily: 'control',
        template: 'conditional',
        props: {
          if: {
            type: 'simple',
            dataKey: '$$',
            operator: 'eq',
            value: '',
          },
          then: RT(),
        },
      } as ScreenComponent;
    case 'for-each':
      return {
        componentFamily: 'control',
        template: 'for-each',
        props: {
          type: 'static',
          values: ['item-a', 'item-b'],
          id: 'fe',
          component: RT(),
        },
      } as ScreenComponent;
    case 'slider':
      return resp({ min: 0, max: 100 });
    case 'range-slider':
      return resp({ min: 0, max: 100 });
    case 'numeric-input':
      return resp({});
    case 'single-checkbox':
      return resp({ text: 'Check me' });
    case 'text-input':
    case 'text-area':
      return resp({ placeholder: '' });
    case 'date-input':
    case 'time-input':
      return resp({});
    case 'dropdown':
    case 'radio':
      return resp({
        options: [
          { label: 'A', value: 'a' },
          { label: 'B', value: 'b' },
        ],
      });
    case 'checkboxes':
      return resp({
        options: [
          { label: 'A', value: 'a' },
          { label: 'B', value: 'b' },
        ],
        min: 0,
      });
    case 'likert-scale':
      return resp({
        options: [
          { value: '1' },
          { value: '2' },
          { value: '3' },
          { value: '4' },
          { value: '5' },
        ],
      });
    default:
      return RT();
  }
}

// ─── dataKey rename + ref propagation ────────────────────────────────────────

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Rename `old` → `new` for a dataKey produced by screen `slug`, propagating
 * to every dependent ref in the flow:
 * - the component's own `dataKey`/`payload.dataKey` props (in that screen)
 * - `$$…slug.old` refs anywhere in the flow (screens, conditions, computes,
 *   loop dataKeys) — the field segment follows the screen slug
 * - `$old` live-form refs inside the same screen's components
 */
export function renameDataKey(
  flow: ExperimentFlow,
  slug: string,
  old: string,
  next: string,
): ExperimentFlow {
  if (old === next) return flow;
  const screens = (flow.screens ?? []).map((s) => {
    if (s.slug !== slug) return s;
    let json = JSON.stringify(s.components);
    // Component props: "dataKey":"old" → "dataKey":"new" (exact value only).
    json = json.split(`"dataKey":"${old}"`).join(`"dataKey":"${next}"`);
    // Live-form refs inside this screen: $old → $new (never $$).
    json = json.replace(
      new RegExp(`(?<!\\$)\\$${escapeRe(old)}(?![\\w-])`, 'g'),
      `$${next}`,
    );
    return { ...s, components: JSON.parse(json) as ScreenComponent[] };
  });

  // $$…slug.old → $$…slug.new across the whole flow JSON.
  const refRe = new RegExp(
    `(\\$\\$(?:[\\w-]+\\.)*${escapeRe(slug)})\\.${escapeRe(old)}(?![\\w-])`,
    'g',
  );
  const body = JSON.stringify({ ...flow, screens }).replace(
    refRe,
    `$1.${next}`,
  );
  return { ...JSON.parse(body) as ExperimentFlow };
}
