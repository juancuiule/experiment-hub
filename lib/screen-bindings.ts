import { ScreenComponent } from './components';
import { defaultPerTemplate } from './components/response';
import { Field, collectFields, isOrderMarker, iterateLoops } from './fields';
import { resolveValuesInString } from './resolve';
import { buildSchemaFromFields } from './screen-schema';
import { Context } from './types';

export function buildScreenBindings(components: ScreenComponent[], context: Context) {
  const fields = collectFields(components, context);
  return {
    schema: buildSchemaFromFields(fields, context),
    defaultValues: defaultsFromFields(fields, context),
  };
}

function defaultsFromFields(fields: Field[], context: Context): Record<string, unknown> {
  const entries: [string, unknown][] = [];
  for (const field of fields) {
    const { source } = field;
    if (isOrderMarker(source)) continue;
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
