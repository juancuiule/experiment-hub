import { z } from 'zod';
import { Condition, evaluateCondition, resolveCondition } from './conditions';
import { buildFieldSchema } from './field-schema';
import {
  DynamicField,
  Field,
  isOrderMarker,
  iterateLoops,
  StaticField,
} from './fields';
import { mergeContext } from './flow';
import { resolveValuesInString } from './resolve';
import { Context } from './types';

// Zod schema for the synthetic :order field.
const orderSchema = z.array(z.string()).optional();

// Pick the per-field zod schema for a Field, given its source.
function fieldSchema(source: Field['source']): z.ZodTypeAny {
  return isOrderMarker(source) ? orderSchema : buildFieldSchema(source);
}

export function buildSchemaFromFields(fields: Field[], context: Context) {
  // Partition once. Each consumer below operates on its own bucket.
  const staticFields: StaticField[] = [];
  const dynamicFields: DynamicField[] = [];
  for (const f of fields) {
    if (f.kind === 'static') staticFields.push(f);
    else dynamicFields.push(f);
  }

  // Base shape: static fields with no gate get their real schema. Gated
  // static fields and dynamic fields get permissive placeholders; the
  // superRefine below validates them properly when their gate evaluates true.
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const f of staticFields) {
    shape[f.key] = f.gate === null ? fieldSchema(f.source) : z.any().optional();
  }

  const baseSchema = z.object(shape).passthrough();

  const gatedStatic = staticFields.filter(
    (f): f is StaticField & { gate: Condition } => f.gate !== null,
  );

  if (gatedStatic.length === 0 && dynamicFields.length === 0) {
    return baseSchema;
  }

  return baseSchema.superRefine((data: Record<string, unknown>, ctx) => {
    const fullContext = mergeContext(context, { screenData: data });

    // Gated static: gate is already resolved; just evaluate.
    for (const f of gatedStatic) {
      if (!evaluateCondition(f.gate, fullContext)) continue;
      addParseIssues(ctx, fieldSchema(f.source), data[f.key], f.key);
    }

    // Dynamic: walk the loop chain, then resolve+evaluate gate (if present)
    // per iteration before validating.
    for (const f of dynamicFields) {
      // Hoisted: same schema for every iteration of this field.
      const schema = fieldSchema(f.source);
      iterateLoops(f.loops, fullContext, (loopCtx) => {
        if (f.gate !== null) {
          const resolved = resolveCondition(f.gate, loopCtx);
          if (!evaluateCondition(resolved, loopCtx)) return;
        }
        const concreteKey = resolveValuesInString(f.keyTemplate, loopCtx);
        addParseIssues(ctx, schema, data[concreteKey], concreteKey);
      });
    }
  }) as typeof baseSchema;
}

// Helpers ────────────────────────────────────────────────────────────────────

function addParseIssues(
  ctx: z.RefinementCtx,
  schema: z.ZodTypeAny,
  value: unknown,
  keyPrefix: string,
): void {
  const result = schema.safeParse(value);
  if (result.success) return;
  for (const issue of result.error.issues) {
    ctx.addIssue({
      ...issue,
      path: [keyPrefix, ...(issue.path ?? [])],
    });
  }
}
