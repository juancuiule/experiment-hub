import { ScreenComponent } from './components';
import { defaultPerTemplate, ResponseComponent } from './components/response';
import {
  Field,
  collectFields,
  isButtonPayload,
  isOrderMarker,
  iterateLoops,
} from './fields';
import { getValue, resolveValuesInString } from './resolve';
import { buildSchemaFromFields } from './screen-schema';
import { Context, ContextData } from './types';

export function buildScreenBindings(
  components: ScreenComponent[],
  context: Context,
) {
  const fields = collectFields(components, context);
  return {
    schema: buildSchemaFromFields(fields, context),
    defaultValues: defaultsFromFields(fields, context),
  };
}

type Augmenter = (data: ContextData, context: Context) => ContextData;

const augmenters: Augmenter[] = [appendShuffledOrders];

export function augmentSubmitData(
  data: ContextData,
  context: Context,
): ContextData {
  return augmenters.reduce((acc, augment) => augment(acc, context), data);
}

function appendShuffledOrders(
  data: ContextData,
  context: Context,
): ContextData {
  const shuffledOptions = context.screenData?.shuffledOptions ?? {};
  const optionOrders = Object.fromEntries(
    Object.entries(shuffledOptions)
      .filter(([key]) => key in data)
      .map(([key, opts]) => [`${key}:order`, opts.map((o) => o.value)]),
  );
  // A for-each id is the id of a control component, not a data key, so its
  // presentation order is always recorded (no `key in data` guard).
  const shuffledForeachOrders = context.screenData?.shuffledForeachOrders ?? {};
  const foreachOrders = Object.fromEntries(
    Object.entries(shuffledForeachOrders).map(([id, values]) => [
      `${id}:order`,
      values,
    ]),
  );
  return { ...data, ...optionOrders, ...foreachOrders };
}

function resolveDefault(source: ResponseComponent, context: Context): unknown {
  const { initialValue } = source.props;
  if (initialValue !== undefined) {
    try {
      const resolved = getValue(initialValue, context);
      if (resolved !== undefined && resolved !== null) return resolved;
    } catch {
      // invalid key format or unresolvable reference — fall through
    }
  }
  return defaultPerTemplate(source);
}

function defaultsFromFields(
  fields: Field[],
  context: Context,
): Record<string, unknown> {
  const entries: [string, unknown][] = [];
  for (const field of fields) {
    const { source } = field;
    if (isOrderMarker(source)) continue;
    if (isButtonPayload(source)) continue;
    if (field.kind === 'static') {
      entries.push([field.key, resolveDefault(source, context)]);
    } else {
      iterateLoops(field.loops, context, (loopCtx) => {
        const key = resolveValuesInString(field.keyTemplate, loopCtx);
        entries.push([key, resolveDefault(source, loopCtx)]);
      });
    }
  }
  return Object.fromEntries(entries);
}
