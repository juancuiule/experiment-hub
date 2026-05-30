import { evaluateCondition, resolveCondition } from '../conditions';
import { Formula } from '../nodes';
import { getValue } from '../resolve';
import { PREFIX, parseRef } from '../tokens';
import { Context, ContextData } from '../types';
import { shuffle } from '../utils';
import { mergeContext } from './context';

function getFormulaInputValue(
  input: string,
  context: Context,
  nodeOutputs: ContextData,
): any {
  const ref = parseRef(input);
  if (ref?.prefix === PREFIX.SCREEN) return nodeOutputs[ref.path];
  return getValue(input, context);
}

export function evaluateFormula(
  formula: Formula,
  context: Context,
  nodeOutputs: Record<string, any>,
  dataPath?: string[],
): any {
  switch (formula.type) {
    case 'sum':
      return formula.inputs.reduce(
        (acc, inp) =>
          acc + (Number(getFormulaInputValue(inp, context, nodeOutputs)) || 0),
        0,
      );
    case 'mean': {
      const vals = formula.inputs.map(
        (inp) => Number(getFormulaInputValue(inp, context, nodeOutputs)) || 0,
      );
      return vals.length === 0
        ? 0
        : vals.reduce((a, b) => a + b, 0) / vals.length;
    }
    case 'min': {
      const vals = formula.inputs.map(
        (inp) => Number(getFormulaInputValue(inp, context, nodeOutputs)) || 0,
      );
      return vals.length === 0 ? 0 : Math.min(...vals);
    }
    case 'max': {
      const vals = formula.inputs.map(
        (inp) => Number(getFormulaInputValue(inp, context, nodeOutputs)) || 0,
      );
      return vals.length === 0 ? 0 : Math.max(...vals);
    }
    case 'count':
      return formula.inputs.filter((inp) => {
        const val = getFormulaInputValue(inp, context, nodeOutputs);
        if (val == null || val === '') return false;
        if (!formula.where) return true;
        const evalCtx = mergeContext(context, {
          screenData: nodeOutputs,
          loopData: { current: val },
        });
        return evaluateCondition(formula.where, evalCtx);
      }).length;
    case 'conditional': {
      const ctxWithOutputs = mergeContext(context, { screenData: nodeOutputs });
      return evaluateCondition(formula.condition, ctxWithOutputs)
        ? formula.then
        : formula.else;
    }
    case 'lookup': {
      const val = getFormulaInputValue(formula.input, context, nodeOutputs);
      const sorted = [...formula.table].sort(
        (a, b) => Number(b.when) - Number(a.when),
      );
      const match = sorted.find((entry) => Number(val) >= Number(entry.when));
      return match ? match.then : formula.default;
    }
    case 'sample': {
      const pool = Array.isArray(formula.input)
        ? formula.input
        : getFormulaInputValue(formula.input, context, nodeOutputs);
      if (!Array.isArray(pool)) return [];
      return shuffle(pool).slice(0, formula.n);
    }
    case 'loop-aggregate': {
      // Iterate the loop's own published keys rather than reconstructing them,
      // so static/dynamic loops, plain-string and object items, and itemKey'd
      // loops all behave identically.
      const loopCtx = context.loops?.[formula.loopId];
      const order = loopCtx?.order ?? [];
      const items = loopCtx?.values ?? [];
      // context.loops is keyed absolutely, but the loop's *iteration data* nests
      // under the compute node's dataPath (e.g. data[pathId][loopId] when both
      // are inside a path). Walk dataPath before indexing by loopId.
      const loopDataRoot = (dataPath ?? []).reduce<any>(
        (obj, key) => (obj == null ? undefined : obj[key]),
        context.data ?? {},
      );
      const iterations = loopDataRoot?.[formula.loopId] as
        | Record<string, Record<string, Record<string, unknown>>>
        | undefined;

      const collected: number[] = [];
      let count = 0;

      order.forEach((iterKey, i) => {
        const iterationData = iterations?.[iterKey] ?? {};
        // Expose the aggregated loop's current iteration under @<loopId>:
        //   @<loopId>.value[.prop]         → the item
        //   @<loopId>.index                → the iteration index
        //   @<loopId>.<screenSlug>.<field> → a collected response
        // `value`/`index` are reserved; screen slugs sit alongside them. $ keeps
        // resolving to this node's prior outputs (merged as screenData).
        const evalCtx = mergeContext(context, {
          screenData: nodeOutputs,
          loopData: {
            [formula.loopId]: { ...iterationData, value: items[i], index: i },
          } as any,
        });

        if (formula.where) {
          const resolved = resolveCondition(formula.where, evalCtx);
          if (!evaluateCondition(resolved, evalCtx)) return;
        }

        if (formula.op === 'count') {
          count += 1;
        } else if (formula.field != null) {
          collected.push(Number(getValue(formula.field, evalCtx)) || 0);
        }
      });

      switch (formula.op) {
        case 'count':
          return count;
        case 'sum':
          return collected.reduce((a, b) => a + b, 0);
        case 'mean':
          return collected.length === 0
            ? 0
            : collected.reduce((a, b) => a + b, 0) / collected.length;
        case 'min':
          return collected.length === 0 ? 0 : Math.min(...collected);
        case 'max':
          return collected.length === 0 ? 0 : Math.max(...collected);
      }
    }
  }
}
