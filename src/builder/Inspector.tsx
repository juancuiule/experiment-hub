'use client';

import { ScreenComponent } from '@/lib/components';
import {
  BranchNode,
  CheckpointNode,
  ComputeNode,
  ForkNode,
  FrameworkNode,
  LoopNode,
  PathNode,
  ScreenNode,
  StartNode,
} from '@/lib/nodes';
import { ExperimentFlow } from '@/lib/types';
import { Trash2 } from 'lucide-react';
import { useState } from 'react';
import {
  NumberField,
  SelectField,
  TextareaField,
  TextField,
  ToggleField,
} from './Field';
import { NODE_META } from './node-meta';
import { ScreenEditor } from './ScreenEditor';

interface EditorProps<T extends FrameworkNode> {
  node: T;
  onChange: (next: FrameworkNode) => void;
}

function StartEditor({ node, onChange }: EditorProps<StartNode>) {
  const props = node.props;
  return (
    <div className="flex flex-col gap-3">
      <TextField
        label="Name"
        value={props?.name ?? ''}
        onChange={(name) =>
          onChange({
            ...node,
            props: { name, param: props?.param ?? { key: '', value: '' } },
          })
        }
      />
      <div className="grid grid-cols-2 gap-2">
        <TextField
          label="Param key"
          mono
          value={props?.param?.key ?? ''}
          onChange={(key) =>
            onChange({
              ...node,
              props: {
                name: props?.name ?? '',
                param: { key, value: props?.param?.value ?? '' },
              },
            })
          }
        />
        <TextField
          label="Param value"
          mono
          value={props?.param?.value ?? ''}
          onChange={(value) =>
            onChange({
              ...node,
              props: {
                name: props?.name ?? '',
                param: { key: props?.param?.key ?? '', value },
              },
            })
          }
        />
      </div>
      <p className="text-xxs text-content-secondary/70">
        A start node matches <code>?{props?.param?.key || 'key'}=
        {props?.param?.value || 'value'}</code> for condition assignment.
      </p>
    </div>
  );
}

function ScreenEditorPanel({
  node,
  onChange,
  flow,
  onChangeScreen,
}: EditorProps<ScreenNode> & {
  flow: ExperimentFlow;
  onChangeScreen: (slug: string, components: ScreenComponent[]) => void;
}) {
  const screen = flow.screens?.find((s) => s.slug === node.props.slug);
  return (
    <div className="flex flex-col gap-3">
      <TextField
        label="Slug"
        mono
        hint="Links this node to a screen definition."
        value={node.props.slug}
        onChange={(slug) => {
          // Keep the linked screen's slug in sync with the node.
          if (screen) onChangeScreen(node.props.slug, screen.components);
          onChange({ ...node, props: { slug } });
        }}
      />
      <ScreenEditor
        slug={node.props.slug}
        components={screen?.components ?? []}
        onChange={(components) => onChangeScreen(node.props.slug, components)}
      />
    </div>
  );
}

function BranchEditor({ node, onChange }: EditorProps<BranchNode>) {
  const { branches } = node.props;
  return (
    <div className="flex flex-col gap-3">
      <TextField
        label="Name"
        value={node.props.name}
        onChange={(name) => onChange({ ...node, props: { ...node.props, name } })}
      />
      <TextareaField
        label="Description"
        rows={2}
        value={node.props.description ?? ''}
        onChange={(description) =>
          onChange({ ...node, props: { ...node.props, description } })
        }
      />
      <div className="flex flex-col gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-content-secondary">
          Branches
        </span>
        {branches.map((b, i) => (
          <div
            key={b.id}
            className="flex flex-col gap-1.5 rounded-md border border-border-default bg-background p-2"
          >
            <div className="flex items-center gap-2">
              <span className="flex-1 font-mono text-xxs text-content-secondary">
                {b.id}
              </span>
              <button
                type="button"
                className="text-error/80 hover:text-error"
                onClick={() =>
                  onChange({
                    ...node,
                    props: {
                      ...node.props,
                      branches: branches.filter((_, j) => j !== i),
                    },
                  })
                }
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
            <TextField
              label="Label"
              value={b.name}
              onChange={(name) =>
                onChange({
                  ...node,
                  props: {
                    ...node.props,
                    branches: branches.map((x, j) =>
                      j === i ? { ...x, name } : x,
                    ),
                  },
                })
              }
            />
          </div>
        ))}
        <button
          type="button"
          className="rounded-md border border-dashed border-border-default py-1.5 text-xs text-content-secondary hover:border-content-active"
          onClick={() => {
            const id = `branch-${branches.length + 1}`;
            onChange({
              ...node,
              props: {
                ...node.props,
                branches: [
                  ...branches,
                  {
                    id,
                    name: 'New branch',
                    config: {
                      type: 'simple',
                      operator: 'eq',
                      dataKey: '$$field',
                      value: '',
                    },
                  },
                ],
              },
            });
          }}
        >
          + Add branch
        </button>
      </div>
    </div>
  );
}

function ForkEditor({ node, onChange }: EditorProps<ForkNode>) {
  const { forks } = node.props;
  return (
    <div className="flex flex-col gap-3">
      <TextField
        label="Name"
        value={node.props.name}
        onChange={(name) => onChange({ ...node, props: { ...node.props, name } })}
      />
      <div className="flex flex-col gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-content-secondary">
          Groups
        </span>
        {forks.map((f, i) => (
          <div
            key={f.id}
            className="flex items-end gap-2 rounded-md border border-border-default bg-background p-2"
          >
            <div className="flex-1">
              <TextField
                label={`Group (${f.id})`}
                value={f.name}
                onChange={(name) =>
                  onChange({
                    ...node,
                    props: {
                      ...node.props,
                      forks: forks.map((x, j) => (j === i ? { ...x, name } : x)),
                    },
                  })
                }
              />
            </div>
            <div className="w-16">
              <NumberField
                label="Weight"
                value={f.weight}
                onChange={(weight) =>
                  onChange({
                    ...node,
                    props: {
                      ...node.props,
                      forks: forks.map((x, j) =>
                        j === i ? { ...x, weight } : x,
                      ),
                    },
                  })
                }
              />
            </div>
          </div>
        ))}
        <button
          type="button"
          className="rounded-md border border-dashed border-border-default py-1.5 text-xs text-content-secondary hover:border-content-active"
          onClick={() =>
            onChange({
              ...node,
              props: {
                ...node.props,
                forks: [
                  ...forks,
                  { id: `group-${forks.length + 1}`, name: 'New group', weight: 1 },
                ],
              },
            })
          }
        >
          + Add group
        </button>
      </div>
    </div>
  );
}

function PathEditor({ node, onChange }: EditorProps<PathNode>) {
  return (
    <div className="flex flex-col gap-3">
      <TextField
        label="Name"
        value={node.props.name}
        onChange={(name) => onChange({ ...node, props: { ...node.props, name } })}
      />
      <ToggleField
        label="Randomized"
        checked={Boolean(node.props.randomized)}
        onChange={(randomized) =>
          onChange({ ...node, props: { ...node.props, randomized } })
        }
      />
    </div>
  );
}

function LoopEditor({ node, onChange }: EditorProps<LoopNode>) {
  const props = node.props;
  return (
    <div className="flex flex-col gap-3">
      <SelectField
        label="Source"
        value={props.type}
        options={[
          { value: 'static', label: 'Static values' },
          { value: 'dynamic', label: 'Dynamic dataKey' },
        ]}
        onChange={(type) => {
          if (type === props.type) return;
          onChange(
            type === 'static'
              ? { ...node, props: { ...props, type: 'static', values: [] } }
              : {
                  ...node,
                  props: { ...props, type: 'dynamic', dataKey: '$$items' },
                },
          );
        }}
      />
      {props.type === 'static' ? (
        <TextareaField
          label="Values (one per line)"
          mono
          rows={5}
          value={props.values
            .map((v) => (typeof v === 'string' ? v : JSON.stringify(v)))
            .join('\n')}
          onChange={(text) =>
            onChange({
              ...node,
              props: {
                ...props,
                type: 'static',
                values: text
                  .split('\n')
                  .filter((l) => l.trim() !== '')
                  .map((l) => {
                    try {
                      return JSON.parse(l);
                    } catch {
                      return l;
                    }
                  }),
              },
            })
          }
        />
      ) : (
        <TextField
          label="dataKey"
          mono
          value={props.dataKey}
          onChange={(v) =>
            onChange({
              ...node,
              props: { ...props, type: 'dynamic', dataKey: `$$${v.replace(/^\$+/, '')}` },
            })
          }
        />
      )}
      <ToggleField
        label="Randomized"
        checked={Boolean(props.randomized)}
        onChange={(randomized) =>
          onChange({ ...node, props: { ...props, randomized } })
        }
      />
    </div>
  );
}

function CheckpointEditor({ node, onChange }: EditorProps<CheckpointNode>) {
  return (
    <TextField
      label="Name"
      value={node.props.name}
      onChange={(name) => onChange({ ...node, props: { name } })}
    />
  );
}

function ComputeEditor({ node }: EditorProps<ComputeNode>) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-semibold uppercase tracking-wide text-content-secondary">
        Computations
      </span>
      {node.props.computations.map((c, i) => (
        <div
          key={i}
          className="rounded-md border border-border-default bg-background p-2"
        >
          <div className="font-mono text-xs text-content-primary">
            {c.outputKey}
          </div>
          <div className="text-xxs text-content-secondary">
            {c.formula.type}
          </div>
        </div>
      ))}
      <p className="text-xxs text-content-secondary/70">
        Formula editing is available via Raw JSON below.
      </p>
    </div>
  );
}

function RawJsonEditor({
  node,
  onChange,
}: {
  node: FrameworkNode;
  onChange: (next: FrameworkNode) => void;
}) {
  // Keyed by node.id at the call site, so selecting a different node remounts
  // this component and the initializer re-reads the fresh node.
  const [text, setText] = useState(() => JSON.stringify(node, null, 2));
  const [error, setError] = useState<string | null>(null);

  return (
    <details className="rounded-md border border-border-default">
      <summary className="cursor-pointer px-2 py-1.5 text-xs font-semibold text-content-secondary">
        Raw JSON
      </summary>
      <div className="flex flex-col gap-2 border-t border-border-default p-2">
        <textarea
          className="h-48 w-full rounded-md border border-border-default bg-background p-2 font-mono text-xxs text-content-primary"
          value={text}
          onChange={(e) => setText(e.target.value)}
          spellCheck={false}
        />
        {error ? <p className="text-xxs text-error">{error}</p> : null}
        <button
          type="button"
          className="self-start rounded-md bg-content-active px-3 py-1 text-xs font-medium text-content-inverted"
          onClick={() => {
            try {
              const parsed = JSON.parse(text) as FrameworkNode;
              if (parsed.id !== node.id || parsed.type !== node.type) {
                setError('id and type must not change here.');
                return;
              }
              setError(null);
              onChange(parsed);
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          Apply JSON
        </button>
      </div>
    </details>
  );
}

export function Inspector({
  node,
  flow,
  onChange,
  onChangeScreen,
  onDelete,
}: {
  node: FrameworkNode | undefined;
  flow: ExperimentFlow;
  onChange: (next: FrameworkNode) => void;
  onChangeScreen: (slug: string, components: ScreenComponent[]) => void;
  onDelete: (id: string) => void;
}) {
  if (!node) {
    return (
      <aside className="flex w-80 shrink-0 flex-col border-l border-border-default bg-background-surface p-4">
        <p className="text-sm text-content-secondary">
          Select a node to edit its configuration, or add one from the palette.
        </p>
      </aside>
    );
  }

  const meta = NODE_META[node.type];
  const Icon = meta.icon;

  return (
    <aside className="flex w-80 shrink-0 flex-col overflow-y-auto border-l border-border-default bg-background-surface">
      <header className="flex items-center gap-2 border-b border-border-default p-3">
        <span
          className={`flex size-8 items-center justify-center rounded-md ${meta.accent}`}
        >
          <Icon className="size-4" />
        </span>
        <div className="flex flex-1 flex-col">
          <span className="text-sm font-semibold text-content-primary">
            {meta.label}
          </span>
          <span className="font-mono text-xxs text-content-secondary">
            {node.id}
          </span>
        </div>
        <button
          type="button"
          onClick={() => onDelete(node.id)}
          className="text-error/80 hover:text-error"
          aria-label="Delete node"
        >
          <Trash2 className="size-4" />
        </button>
      </header>

      <div className="flex flex-col gap-4 p-3">
        {node.type === 'start' && (
          <StartEditor node={node} onChange={onChange} />
        )}
        {node.type === 'screen' && (
          <ScreenEditorPanel
            node={node}
            onChange={onChange}
            flow={flow}
            onChangeScreen={onChangeScreen}
          />
        )}
        {node.type === 'branch' && (
          <BranchEditor node={node} onChange={onChange} />
        )}
        {node.type === 'fork' && <ForkEditor node={node} onChange={onChange} />}
        {node.type === 'path' && <PathEditor node={node} onChange={onChange} />}
        {node.type === 'loop' && <LoopEditor node={node} onChange={onChange} />}
        {node.type === 'checkpoint' && (
          <CheckpointEditor node={node} onChange={onChange} />
        )}
        {node.type === 'compute' && <ComputeEditor node={node} onChange={onChange} />}
        {node.type === 'end' && (
          <p className="text-sm text-content-secondary">
            Terminal node — no configuration.
          </p>
        )}

        <RawJsonEditor key={node.id} node={node} onChange={onChange} />
      </div>
    </aside>
  );
}
