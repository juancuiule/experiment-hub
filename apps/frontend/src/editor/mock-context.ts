import type { ScreenComponent } from '@experiment-hub/engine/components';
import { buildMessages, defaultLocaleOf } from '@experiment-hub/engine/i18n';
import type { FrameworkScreen } from '@experiment-hub/engine/screen';
import type { Context, ContextData, ExperimentFlow } from '@experiment-hub/engine/types';
import type { Option } from '@experiment-hub/engine/components/response';

// ─── Fake values ─────────────────────────────────────────────────────────────

const FAKE_ITEMS = [
  { id: 'item-1', label: 'Item 1', name: 'Sample item 1' },
  { id: 'item-2', label: 'Item 2', name: 'Sample item 2' },
  { id: 'item-3', label: 'Item 3', name: 'Sample item 3' },
];

const FAKE_OPTION_VALUES = ['option-a', 'option-b', 'option-c'];

const setNested = (obj: ContextData, path: string[], value: unknown) => {
  let cur = obj;
  for (const seg of path.slice(0, -1)) {
    cur[seg] ??= {};
    cur = cur[seg] as ContextData;
  }
  cur[path[path.length - 1]] = value;
};

/** Inline/`%`-shared options → first option's value, else a generic fake. */
function firstOptionValue(
  options: unknown,
  sharedOptions: Record<string, Option[]> | undefined,
): string {
  let list: Option[] | undefined;
  if (Array.isArray(options)) list = options as Option[];
  else if (typeof options === 'string' && options.startsWith('%'))
    list = sharedOptions?.[options.slice(1)];
  const first = list?.[0];
  return typeof first === 'string' ? first : ((first as { value?: string })?.value ?? 'option-a');
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
  const segs = ref.split('.');
  // $$slug.field or $$pathId.slug.field / $$loopId.iter.slug.field
  const slug = screensBySlug.has(segs[0]) ? segs[0] : segs.at(-2);
  const field = segs.at(-1);
  if (!slug || !field) return 'sample';
  const screen = screensBySlug.get(slug);
  if (!screen) return 'sample';

  let found: ScreenComponent | undefined;
  const walk = (c: ScreenComponent) => {
    const p = c.props as { dataKey?: string; components?: ScreenComponent[]; then?: ScreenComponent; else?: ScreenComponent; component?: ScreenComponent };
    if (p.dataKey === field) found = c;
    for (const child of p.components ?? []) walk(child);
    if (p.then) walk(p.then);
    if (p.else) walk(p.else);
    if (p.component) walk(p.component);
  };
  screen.components.forEach(walk);
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
      return [firstOptionValue(p.options, flow.options)];
    case 'radio':
    case 'dropdown':
      return firstOptionValue(p.options, flow.options);
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

  const setData = (ref: string, value: unknown) =>
    setNested(data, ref.slice(2).split('.'), value);
  const getData = (ref: string): unknown => {
    let cur: unknown = data;
    for (const seg of ref.slice(2).split('.'))
      cur = (cur as ContextData | undefined)?.[seg];
    return cur;
  };

  // Pass 1 — refs that must be arrays (for-each dataKeys, options sources).
  walkComponents(screen.components, (c) => {
    const p = c.props as WalkProps;
    if (c.template === 'for-each' && p.type === 'dynamic' && p.dataKey) {
      if (p.dataKey.startsWith('$$')) setData(p.dataKey, FAKE_ITEMS);
      if (p.dataKey.startsWith('@')) {
        loopData[p.dataKey.slice(1).split('.')[0]] = {
          value: { items: FAKE_ITEMS },
          index: 0,
        };
      }
    }
    const options = p.options;
    if (typeof options === 'string' && options.startsWith('$$'))
      setData(options, FAKE_OPTION_VALUES);
    if (typeof options === 'object' && options !== null) {
      const src = (options as { source?: string }).source;
      if (src?.startsWith('$$')) setData(src, FAKE_OPTION_VALUES);
    }
  });

  // Pass 2 — every other $$ ref gets a scalar fake derived from its producer.
  for (const m of JSON.stringify(screen.components).matchAll(/\$\$[\w-]+(?:\.[\w-]+)*/g)) {
    if (getData(m[0]) === undefined)
      setData(m[0], fakeScalarFor(flow, screensBySlug, m[0].slice(2)));
  }

  // Pass 3 — @loop refs: seed loopData; reuse the loop's dataKey array when it
  // points at $$ data we faked, so {{@id.value.label}} resolves something real.
  const nodesById = new Map(flow.nodes.map((n) => [n.id, n]));
  for (const m of JSON.stringify(screen.components).matchAll(/@[\w-]+/g)) {
    const loopId = m[0].slice(1);
    if (loopData[loopId]) continue;
    const loopNode = nodesById.get(loopId);
    let value: unknown = { id: 'item-1', label: 'Item 1', name: 'Sample item' };
    if (loopNode?.type === 'loop') {
      if (loopNode.props.type === 'static') value = loopNode.props.values[0];
      else {
        const items = getData(loopNode.props.dataKey);
        if (Array.isArray(items) && items.length) value = items[0];
      }
    }
    loopData[loopId] = { value, index: 0 };
  }

  // Pass 4 — #forEach refs: foreachData lives under screenData.
  for (const m of JSON.stringify(screen.components).matchAll(/#[\w-]+/g)) {
    const feId = m[0].slice(1);
    if (foreachData[feId]) continue;
    foreachData[feId] = { value: FAKE_ITEMS[0], index: 0 };
  }
  // If a for-each's dataKey resolved to fake items, prefer its first item.
  walkComponents(screen.components, (c) => {
    const p = c.props as WalkProps;
    if (c.template !== 'for-each' || !p.id || foreachData[p.id]) return;
    const items =
      p.type === 'static'
        ? (p as unknown as { values: unknown[] }).values
        : p.dataKey?.startsWith('$$')
          ? getData(p.dataKey)
          : undefined;
    if (Array.isArray(items) && items.length)
      foreachData[p.id] = { value: items[0], index: 0 };
  });

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
