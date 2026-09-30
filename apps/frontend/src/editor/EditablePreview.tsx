'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import { evaluateCondition } from '@experiment-hub/engine/conditions';
import type { ScreenComponent } from '@experiment-hub/engine/components';
import { deepMerge, mergeContext } from '@experiment-hub/engine/flow';
import { getValue } from '@experiment-hub/engine/resolve';
import { buildScreenBindings } from '@experiment-hub/engine/screen-bindings';
import type { FrameworkScreen } from '@experiment-hub/engine/screen';
import type {
  Context,
  ContextData,
  ExperimentFlow,
} from '@experiment-hub/engine/types';
import { useEffect, useMemo, useRef } from 'react';
import { useForm, type UseFormReturn } from 'react-hook-form';
import type { Option } from '@experiment-hub/engine/components/response';
import { RenderComponent } from '@/src/components/RenderComponent';
import { buildMockContext } from './mock-context';
import type { CompPath } from './screen-mutations';

export type EditHandlers = {
  /** path of the selected component (JSON). */
  selectedKey: string | null;
  /** path of the hovered component (JSON) — mirrors the outline highlight. */
  hoveredKey: string | null;
  /** path being inline-edited (JSON), if any. */
  editingKey: string | null;
  onSelect: (path: CompPath) => void;
  onHover: (path: CompPath | null) => void;
  onEdit: (path: CompPath | null) => void;
  /** Commit an inline text edit to a prop. */
  onPatch: (path: CompPath, props: Record<string, unknown>) => void;
  /** Move a member within an array container. */
  onMove: (arrPath: CompPath, from: number, to: number) => void;
  /** Current drag path (JSON) while dragging a component. */
  dragKey: string | null;
  onDragChange: (path: CompPath | null) => void;
  /** Report live form values upward. */
  onData?: (data: ContextData) => void;
  /** Seed values merged into the form defaults. */
  seedData?: ContextData;
  /** Overrides for `$$` resolution (answers captured in other screens). */
  overrides?: Record<string, ContextData>;
};

const pathKey = (p: CompPath | null) => (p ? JSON.stringify(p) : null);

/** Which prop holds the component's primary editable text. */
const INLINE_TEXT_PROP: Record<string, string> = {
  'rich-text': 'content',
  accordion: 'title',
  button: 'text',
  'single-checkbox': 'text',
  group: 'name',
  slider: 'label',
  'range-slider': 'label',
  'numeric-input': 'label',
  'text-input': 'label',
  'text-area': 'label',
  'date-input': 'label',
  'time-input': 'label',
  dropdown: 'label',
  radio: 'label',
  checkboxes: 'label',
  'likert-scale': 'label',
};

type InnerProps = {
  component: ScreenComponent;
  path: CompPath;
  inArray: boolean;
  arrPath: CompPath | null;
  index: number;
  siblingCount: number;
  form: UseFormReturn<ContextData>;
  context: Context;
  sharedOptions: Record<string, Option[]> | undefined;
  h: EditHandlers;
};

/** Per-component wrapper: hover outline + click-select + drag + inline edit. */
function EditableComponent(props: InnerProps) {
  const { component, path, inArray, arrPath, index, form, context, sharedOptions, h } = props;
  const key = JSON.stringify(path);
  const selected = key === h.selectedKey;
  const hovered = key === h.hoveredKey;
  const editing = key === h.editingKey;
  const inlineProp = INLINE_TEXT_PROP[component.template];

  const wrapCls = `relative rounded transition-shadow ${
    selected
      ? 'outline-accent outline-2 -outline-offset-1 outline'
      : hovered
        ? 'outline-accent/60 outline-dashed outline-1 -outline-offset-1 outline'
        : ''
  }`;

  const inner = (() => {
    // ── Container replication — children go through EditableComponent ──
    if (component.template === 'group') {
      const children = (component.props as { components?: ScreenComponent[] })
        .components ?? [];
      return (
        <div className="my-2 flex flex-col gap-4">
          {children.map((c, i) => (
            <EditableComponent
              key={i}
              {...props}
              component={c}
              path={[...path, 'components', i]}
              inArray
              arrPath={[...path, 'components']}
              index={i}
              siblingCount={children.length}
            />
          ))}
        </div>
      );
    }
    if (component.template === 'conditional') {
      const p = component.props as {
        if?: Parameters<typeof evaluateCondition>[0];
        then?: ScreenComponent;
        else?: ScreenComponent;
      };
      const show = p.if ? evaluateCondition(p.if, context) : true;
      const slot = show ? 'then' : 'else';
      const child = p[slot] as ScreenComponent | undefined;
      if (!child)
        return (
          <span className="text-content-secondary font-mono text-xxs">
            conditional · {show ? 'then' : 'else'} (empty)
          </span>
        );
      return (
        <EditableComponent
          {...props}
          component={child}
          path={[...path, slot]}
          inArray={false}
          arrPath={null}
          index={0}
          siblingCount={0}
        />
      );
    }
    if (component.template === 'for-each') {
      const p = component.props as {
        type: 'static' | 'dynamic';
        values?: string[];
        dataKey?: string;
        id: string;
        component: ScreenComponent;
      };
      const items =
        (context.screenData?.shuffledForeachOrders?.[p.id] as
          | string[]
          | undefined) ??
        (p.type === 'static'
          ? (p.values ?? [])
          : ((getValue(p.dataKey ?? '', context) as string[] | null) ?? []));
      return (
        <>
          {items.length === 0 && (
            <span className="text-content-secondary font-mono text-xxs">
              for-each · {p.id} · 0 items (
              {p.type === 'static' ? 'values' : p.dataKey})
            </span>
          )}
          {items.map((item, i) => {
            const itemContext = mergeContext(context, {
              screenData: {
                foreachData: { [p.id]: { value: item, index: i } },
              },
            });
            return (
              <EditableComponent
                key={i}
                {...props}
                component={p.component}
                path={[...path, 'component']}
                inArray={false}
                arrPath={null}
                index={0}
                siblingCount={0}
                context={itemContext}
              />
            );
          })}
        </>
      );
    }
    // ── Leaf: the real component, or its inline text editor ──
    if (editing && inlineProp) {
      const p = component.props as Record<string, unknown>;
      const v = (p[inlineProp] as string) ?? '';
      const commit = (value: string) => {
        h.onPatch(path, { ...p, [inlineProp]: value });
        h.onEdit(null);
      };
      return inlineProp === 'content' ? (
        <textarea
          autoFocus
          defaultValue={v}
          rows={4}
          className="border-accent bg-background text-content-primary w-full rounded border px-1.5 py-1 font-mono text-xs"
          onBlur={(e) => commit(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') h.onEdit(null);
          }}
        />
      ) : (
        <input
          autoFocus
          defaultValue={v}
          className="border-accent bg-background text-content-primary w-full rounded border px-1.5 py-1 text-sm"
          onBlur={(e) => commit(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit(e.currentTarget.value);
            if (e.key === 'Escape') h.onEdit(null);
          }}
        />
      );
    }
    return (
      <RenderComponent
        component={component}
        form={form}
        context={context}
        isLoading={false}
        sharedOptions={sharedOptions}
      />
    );
  })();

  const dropTarget =
    inArray &&
    h.dragKey &&
    pathKey(path) !== h.dragKey &&
    arrPathKey(arrPath) === arrPathKeyOfDrag(h.dragKey);

  return (
    <div
      data-comp-path={key}
      className={wrapCls}
      // Select on mousedown — click events get swallowed when the
      // hover/select re-render commits between mousedown and mouseup.
      onMouseDown={(e) => {
        e.stopPropagation();
        h.onSelect(path);
      }}
      // A true double-press (detail >= 2) on a text component enters inline
      // edit — mouseup (not mousedown) so the mounted editor's autofocus
      // isn't stolen by the browser's own mousedown focus handling. Single
      // presses keep the form controls interactive.
      onMouseUp={(e) => {
        e.stopPropagation();
        if (e.detail >= 2 && inlineProp) h.onEdit(path);
      }}
      onMouseOver={(e) => {
        e.stopPropagation();
        h.onHover(path);
      }}
      onMouseOut={(e) => {
        e.stopPropagation();
        h.onHover(null);
      }}
      onDragOver={(e) => {
        if (!dropTarget) return;
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = 'move';
      }}
      onDrop={(e) => {
        if (!dropTarget || !h.dragKey || !arrPath) return;
        e.preventDefault();
        e.stopPropagation();
        const from = Number(JSON.parse(h.dragKey).at(-1));
        const rect = e.currentTarget.getBoundingClientRect();
        const after = e.clientY > rect.top + rect.height / 2;
        const to = after ? index + 1 : index;
        h.onMove(arrPath, from, to > from ? to - 1 : to);
        h.onDragChange(null);
      }}
    >
      {dropTarget && h.dragKey && (
        <div className="bg-accent pointer-events-none absolute inset-x-0 -top-0.5 z-10 h-0.5" />
      )}
      {/* drag handle — shown on hover; a draggable wrapper would eat clicks.
          Ancestor handles also show when a descendant is hovered (a container's
          own surface is fully covered by its children). */}
      {inArray &&
        !editing &&
        (hovered ||
          selected ||
          key === h.dragKey ||
          (h.hoveredKey !== null &&
            h.hoveredKey.startsWith(key.slice(0, -1) + ','))) && (
        <div
          draggable
          data-drag-handle
          title="drag to reorder"
          className="border-border-default bg-background text-content-secondary absolute -top-2 right-1 z-10 flex h-4 w-5 cursor-grab items-center justify-center rounded border"
          onMouseDown={(e) => e.stopPropagation()}
          onDragStart={(e) => {
            e.stopPropagation();
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', key);
            h.onDragChange(path);
          }}
          onDragEnd={() => h.onDragChange(null)}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
            <circle cx="3" cy="2.5" r="1" />
            <circle cx="7" cy="2.5" r="1" />
            <circle cx="3" cy="5" r="1" />
            <circle cx="7" cy="5" r="1" />
            <circle cx="3" cy="7.5" r="1" />
            <circle cx="7" cy="7.5" r="1" />
          </svg>
        </div>
      )}
      {inner}
    </div>
  );
}

const arrPathKey = (p: CompPath | null) => (p ? JSON.stringify(p) : '');
const arrPathKeyOfDrag = (dragKey: string) => {
  const p = JSON.parse(dragKey) as CompPath;
  return JSON.stringify(p.slice(0, -1));
};

export default function EditablePreview({
  flow,
  screen,
  h,
}: {
  flow: ExperimentFlow;
  screen: FrameworkScreen;
  h: EditHandlers;
}) {
  const context = useMemo(
    () => buildMockContext(flow, screen, h.overrides),
    [flow, screen, h.overrides],
  );
  const { schema, defaultValues } = useMemo(
    () => buildScreenBindings(screen.components, context),
    [screen, context],
  );
  const form = useForm<ContextData>({
    resolver: zodResolver(schema),
    defaultValues: h.seedData
      ? (deepMerge(defaultValues, h.seedData) as ContextData)
      : defaultValues,
    shouldUnregister: true,
  });
  const screenData = form.watch();
  // h is rebuilt each render — keep the latest in a ref so the effect
  // only refires when the watched data actually changes.
  const hRef = useRef(h);
  hRef.current = h;
  useEffect(() => {
    hRef.current.onData?.(screenData);
  }, [screenData]);
  const liveContext = useMemo<Context>(
    () => deepMerge(context, { screenData }),
    [context, screenData],
  );

  return (
    <form
      onSubmit={(e) => e.preventDefault()}
      className="flex flex-col gap-4"
      onMouseDown={() => h.onSelect([])}
    >
      {screen.components.map((component, i) => (
        <EditableComponent
          key={
            component.componentFamily === 'response'
              ? (component.props as { dataKey?: string }).dataKey
              : i
          }
          component={component}
          path={[i]}
          inArray
          arrPath={[]}
          index={i}
          siblingCount={screen.components.length}
          form={form}
          context={liveContext}
          sharedOptions={flow.options}
          h={h}
        />
      ))}
    </form>
  );
}
