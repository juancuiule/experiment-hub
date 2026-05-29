import { ScreenComponent } from './components';
import { defaultPerTemplate } from './components/response';
import {
  Field,
  collectFields,
  isButtonPayload,
  isOrderMarker,
  iterateLoops,
} from './fields';
import { resolveValuesInString } from './resolve';
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
  const orders = Object.fromEntries(
    Object.entries(shuffledOptions)
      .filter(([key]) => key in data)
      .map(([key, opts]) => [`${key}:order`, opts.map((o) => o.value)]),
  );
  return { ...data, ...orders };
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
      entries.push([field.key, defaultPerTemplate(source)]);
    } else {
      iterateLoops(field.loops, context, (loopCtx) => {
        const key = resolveValuesInString(field.keyTemplate, loopCtx);
        entries.push([key, defaultPerTemplate(source)]);
      });
    }
  }
  return Object.fromEntries(entries);
}
