function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isPrimitiveArray(v: unknown[]): boolean {
  return v.every((item) => typeof item !== 'object' || item === null);
}

function Leaf({ value }: { value: unknown }) {
  if (value === null || value === undefined)
    return <span className="text-content-secondary">{'null'}</span>;
  if (typeof value === 'boolean')
    return (
      <span className="text-purple-600 dark:text-purple-400">
        {value.toString()}
      </span>
    );
  if (typeof value === 'number')
    return <span className="text-blue-600 dark:text-blue-400">{value}</span>;
  if (typeof value === 'string')
    return (
      <span className="text-green-700 dark:text-green-300">
        &quot;{value}&quot;
      </span>
    );
  if (Array.isArray(value)) {
    return (
      <span className="text-content-secondary">
        [
        {(value as unknown[]).map((item, i) => (
          <span key={i}>
            {i > 0 && <span className="text-content-secondary">, </span>}
            <Leaf value={item} />
          </span>
        ))}
        ]
      </span>
    );
  }
  return null;
}

function DataTree({
  data,
  depth = 0,
}: {
  data: Record<string, unknown>;
  depth?: number;
}) {
  return (
    <div
      className={`text-xxs flex flex-col gap-0.5 font-mono ${depth > 0 ? 'border-border-default ml-1 border-l pl-2' : ''}`}
    >
      {Object.entries(data).map(([key, value]) => {
        const isComplex =
          isPlainObject(value) ||
          (Array.isArray(value) && !isPrimitiveArray(value as unknown[]));
        if (isComplex) {
          const children = isPlainObject(value)
            ? value
            : (value as unknown[]).reduce<Record<string, unknown>>(
              (acc, v, i) => {
                acc[i] = v;
                return acc;
              },
              {},
            );
          return (
            <div key={key} className="flex flex-col gap-0.5">
              <span className="text-content-secondary">{key}</span>
              <DataTree data={children} depth={depth + 1} />
            </div>
          );
        }
        return (
          <div key={key} className="flex items-baseline gap-1.5">
            <span className="text-content-secondary shrink-0">{key}:</span>
            <Leaf value={value} />
          </div>
        );
      })}
    </div>
  );
}

export function DataSection({
  title,
  data,
}: {
  title: string;
  data: Record<string, unknown>;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-content-secondary font-mono text-[9px] tracking-wider uppercase">
        {title}
      </span>
      <div className="rounded border p-2">
        <DataTree data={data} />
      </div>
    </div>
  );
}
