import type { ScreenComponent } from '@experiment-hub/engine/components';
import { buildMessages, defaultLocaleOf } from '@experiment-hub/engine/i18n';
import type { FrameworkScreen } from '@experiment-hub/engine/screen';
import type { Context, ContextData, ExperimentFlow } from '@experiment-hub/engine/types';
import type { Option } from '@experiment-hub/engine/components/response';

// ─── Fake values ─────────────────────────────────────────────────────────────

const FAKE_OPTION_VALUES = ['option-a', 'option-b', 'option-c'];

/** Fake item list shaped by how refs are used: bare `.value` → strings;
 *  `.value.X` → objects carrying X (plus id/label/name). */
function fakeItems(propsUsed: Set<string>, bareValue: boolean): unknown[] {
  if (bareValue && propsUsed.size === 0) return ['item-a', 'item-b', 'item-c'];
  return [1, 2, 3].map((i) =>
    Object.fromEntries([
      ['id', `item-${i}`],
      ['label', `Item ${i}`],
      ['name', `Item ${i}`],
      ...[...propsUsed]
        .filter((p) => !['id', 'label', 'name'].includes(p))
        .map((p) => [p, `${p} ${i}`] as [string, string]),
    ]),
  );
}

/** Props accessed via `<prefix><id>.value.<prop>` inside a JSON blob. */
function usedItemProps(json: string, prefix: '#' | '@', id: string): {
  props: Set<string>;
  bare: boolean;
} {
  const props = new Set<string>();
  const re = new RegExp(`${prefix === '#' ? '#' : '@'}${id}\\.value\\.(\\w+)`, 'g');
  for (const m of json.matchAll(re)) props.add(m[1]);
  const bare = new RegExp(`${prefix === '#' ? '#' : '@'}${id}\\.value(?![.\\w])`).test(json);
  return { props, bare };
}

const setNested = (obj: ContextData, path: string[], value: unknown) => {
  let cur = obj;
  for (const seg of path.slice(0, -1)) {
    cur[seg] ??= {};
    cur = cur[seg] as ContextData;
  }
  cur[path[path.length - 1]] = value;
};

/** Inline/`%`-shared/`$$` options → option values (up to `n`). */
function optionValues(
  options: unknown,
  sharedOptions: Record<string, Option[]> | undefined,
  n: number,
): string[] {
  let list: Option[] | undefined;
  if (Array.isArray(options)) list = options as Option[];
  else if (typeof options === 'string' && options.startsWith('%'))
    list = sharedOptions?.[options.slice(1)];
  return (list ?? [])
    .slice(0, n)
    .map((o) => (typeof o === 'string' ? o : String((o as { value?: unknown }).value ?? o)))
    .filter(Boolean);
}

/** Find the component that produces `$$…field` — screen slug is the segment
 *  that names a known screen (`$$slug.field`, `$$pathId.slug.field`,
 *  `$$loopId.iter.slug.field`). */
function producerField(
  screensBySlug: Map<string, FrameworkScreen>,
  ref: string,
): ScreenComponent | undefined {
  const segs = ref.split('.');
  const slugSegs = segs.filter((s) => screensBySlug.has(s));
  const slug = slugSegs[0];
  const field = segs.at(-1);
  if (!slug || !field) return undefined;
  let found: ScreenComponent | undefined;
  const walk = (c: ScreenComponent) => {
    const p = c.props as WalkProps;
    if (p.dataKey === field) found = c;
    for (const child of p.components ?? []) walk(child);
    if (p.then) walk(p.then);
    if (p.else) walk(p.else);
    if (p.component) walk(p.component);
  };
  screensBySlug.get(slug)?.components.forEach(walk);
  return found;
}

/**
 * Pick a plausible fake for `$$slug.field` by looking at the producer
 * component's template (slider → mid, radio → first option, …).
 */
function fakeScalarFor(
  flow: ExperimentFlow,
  screensBySlug: Map<string, FrameworkScreen>,
  ref: string,
): unknown {
  const found = producerField(screensBySlug, ref);
  if (!found) return 'sample';

  const p = found.props as {
    min?: number; max?: number; options?: unknown; type?: string;
  };
  switch (found.template) {
    case 'slider':
      return Math.round(((p.min ?? 0) + (p.max ?? 100)) / 2);
    case 'range-slider': {
      const lo = p.min ?? 0;
      const hi = p.max ?? 100;
      return [Math.round(lo + (hi - lo) / 3), Math.round(hi - (hi - lo) / 3)];
    }
    case 'numeric-input':
      return 42;
    case 'single-checkbox':
      return true;
    case 'checkboxes':
      return optionValues(p.options, flow.options, 3);
    case 'radio':
    case 'dropdown':
      return optionValues(p.options, flow.options, 1)[0] ?? 'option-a';
    case 'likert-scale': {
      const opts = Array.isArray(p.options)
        ? (p.options as { value: unknown }[])
        : [];
      return opts[Math.floor(opts.length / 2)]?.value ?? '3';
    }
    case 'text-area':
    case 'text-input':
      return 'sample text';
    case 'date-input':
      return '1990-01-01';
    case 'time-input':
      return '12:00';
    default:
      return 'sample';
  }
}

// ─── Context builder ─────────────────────────────────────────────────────────

type WalkProps = {
  dataKey?: string;
  type?: string;
  id?: string;
  options?: unknown;
  components?: ScreenComponent[];
  then?: ScreenComponent;
  else?: ScreenComponent;
  component?: ScreenComponent;
};

const walkComponents = (
  components: ScreenComponent[],
  visit: (c: ScreenComponent) => void,
) => {
  const walk = (c: ScreenComponent) => {
    visit(c);
    const p = c.props as WalkProps;
    for (const child of p.components ?? []) walk(child);
    if (p.then) walk(p.then);
    if (p.else) walk(p.else);
    if (p.component) walk(p.component);
  };
  components.forEach(walk);
};

/**
 * Build a Context that lets a screen render standalone in the editor: `$$` refs
 * get type-appropriate fakes (arrays where a for-each/options source needs
 * them), `@`/`#` refs get IterativeItem-shaped fakes whose `value` comes from
 * the resolved array when possible.
 */
export function buildMockContext(
  flow: ExperimentFlow,
  screen: FrameworkScreen,
): Context {
  const data: ContextData = {};
  const loopData: Record<string, { value: unknown; index: number }> = {};
  const foreachData: Record<string, { value: unknown; index: number }> = {};
  const screensBySlug = new Map((flow.screens ?? []).map((s) => [s.slug, s]));
  const nodesById = new Map(flow.nodes.map((n) => [n.id, n]));
  const json = JSON.stringify(screen.components);

  const setData = (ref: string, value: unknown) =>
    setNested(data, ref.slice(2).split('.'), value);
  const getData = (ref: string): unknown => {
    let cur: unknown = data;
    for (const seg of ref.slice(2).split('.'))
      cur = (cur as ContextData | undefined)?.[seg];
    return cur;
  };

  /** `$$dataNodeId.key…` → the real authored value when the producer is a data node. */
  const dataNodeValue = (ref: string): unknown => {
    const segs = ref.slice(2).split('.');
    const node = nodesById.get(segs[0]);
    if (node?.type !== 'data') return undefined;
    let cur: unknown = node.props.data;
    for (const seg of segs.slice(1)) cur = (cur as ContextData | undefined)?.[seg];
    return cur;
  };

  const feItems = new Map<string, unknown[]>();
  const loopItems = new Map<string, unknown[]>();

  // Pass 1 — refs that must be arrays: for-each dataKeys, options sources,
  // loop dataKeys. Real data-node values win; otherwise infer the item shape
  // from how the refs access `.value`.
  walkComponents(screen.components, (c) => {
    const p = c.props as WalkProps;
    if (c.template === 'for-each' && p.type === 'dynamic' && p.dataKey && p.id) {
      const { props, bare } = usedItemProps(
        JSON.stringify(p.component),
        '#',
        p.id,
      );
      if (p.dataKey.startsWith('$$')) {
        const real = dataNodeValue(p.dataKey);
        // Producer is a checkboxes/multi-select field → its real option values.
        const producer = producerField(screensBySlug, p.dataKey.slice(2));
        const fromProducer =
          producer?.template === 'checkboxes'
            ? optionValues(
                (producer.props as { options?: unknown }).options,
                flow.options,
                3,
              )
            : [];
        const items = Array.isArray(real)
          ? real
          : fromProducer.length
            ? fromProducer
            : fakeItems(props, bare);
        setData(p.dataKey, items);
        feItems.set(p.id, items);
      }
      if (p.dataKey.startsWith('@')) {
        // `@loopId.rest` resolves into loopData[loopId].rest — seed an array there.
        const [loopId, ...rest] = p.dataKey.slice(1).split('.');
        const items = fakeItems(props, bare);
        const entry = (loopData[loopId] ??= {
          value: { id: 'item-1', label: 'Item 1', name: 'Sample item' },
          index: 0,
        }) as unknown as ContextData;
        setNested(entry, rest, items);
        feItems.set(p.id, items);
      }
    }
    const options = p.options;
    if (typeof options === 'string' && options.startsWith('$$'))
      setData(options, dataNodeValue(options) ?? FAKE_OPTION_VALUES);
    if (typeof options === 'object' && options !== null) {
      const src = (options as { source?: string }).source;
      if (src?.startsWith('$$')) setData(src, dataNodeValue(src) ?? FAKE_OPTION_VALUES);
    }
  });

  // Loop dataKeys need arrays too — a screen inside the loop may ref @loop.
  for (const node of flow.nodes) {
    if (node.type !== 'loop' || node.props.type !== 'dynamic') continue;
    const key = node.props.dataKey;
    if (!key.startsWith('$$')) continue;
    const real = dataNodeValue(key);
    const { props, bare } = usedItemProps(json, '@', node.id);
    const items = Array.isArray(real) ? real : fakeItems(props, bare);
    if (getData(key) === undefined) setData(key, items);
    loopItems.set(node.id, items);
  }

  // Pass 2 — every other $$ ref: real data-node value, else a scalar fake
  // derived from the producing screen's field type.
  for (const m of json.matchAll(/\$\$[\w-]+(?:\.[\w-]+)*/g)) {
    if (getData(m[0]) !== undefined) continue;
    const real = dataNodeValue(m[0]);
    setData(m[0], real ?? fakeScalarFor(flow, screensBySlug, m[0].slice(2)));
  }

  // Pass 3 — @loop refs: value is the first resolved item when we know the
  // loop's items, else a generic object so `.value.X` resolves something.
  for (const m of json.matchAll(/@[\w-]+/g)) {
    const loopId = m[0].slice(1);
    if (loopData[loopId]) continue;
    const loopNode = nodesById.get(loopId);
    let value: unknown = { id: 'item-1', label: 'Item 1', name: 'Sample item' };
    const items =
      loopItems.get(loopId) ??
      (loopNode?.type === 'loop' && loopNode.props.type === 'static'
        ? loopNode.props.values
        : undefined);
    if (Array.isArray(items) && items.length) value = items[0];
    loopData[loopId] = { value, index: 0 };
  }

  // Pass 4 — #forEach refs: foreachData lives under screenData; value is the
  // first item of the resolved list (static or the fake/real array).
  walkComponents(screen.components, (c) => {
    const p = c.props as WalkProps;
    if (c.template !== 'for-each' || !p.id) return;
    const items =
      p.type === 'static'
        ? (p as unknown as { values: unknown[] }).values
        : p.dataKey?.startsWith('$$')
          ? feItems.get(p.id) ?? getData(p.dataKey)
          : undefined;
    foreachData[p.id] = {
      value: Array.isArray(items) && items.length ? items[0] : 'item-a',
      index: 0,
    };
  });
  for (const m of json.matchAll(/#[\w-]+/g)) {
    const feId = m[0].slice(1);
    if (!foreachData[feId]) foreachData[feId] = { value: 'item-a', index: 0 };
  }

  const locale = defaultLocaleOf(flow);
  return {
    data,
    loopData,
    screenData: { foreachData },
    paths: {},
    loops: {},
    branches: {},
    forks: {},
    timings: {},
    checkpoints: {},
    ...(locale ? { locale } : {}),
    messages: buildMessages(flow, locale),
  };
}
