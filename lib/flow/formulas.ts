import { evaluateCondition } from '../conditions';
import { Formula } from '../nodes';
import { getValue } from '../resolve';
import { Context, ContextData } from '../types';
import { shuffle } from '../utils';
import { mergeContext } from './context';

function getFormulaInputValue(
  input: string,
  context: Context,
  nodeOutputs: ContextData,
): any {
  if (input.startsWith('$') && !input.startsWith('$$')) {
    return nodeOutputs[input.slice(1)];
  }
  return getValue(input, context);
}

export function evaluateFormula(
  formula: Formula,
  context: Context,
  nodeOutputs: Record<string, any>,
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
    case 'count-correct': {
      const items = getFormulaInputValue(formula.itemsKey, context, nodeOutputs);
      if (!Array.isArray(items)) return 0;
      const loopIterations = context.data?.[formula.loopId] as
        | Record<string, Record<string, Record<string, unknown>>>
        | undefined;
      if (!loopIterations) return 0;
      return items.reduce((count: number, item: unknown, idx: number) => {
        const iterKey = String(idx + 1);
        const answer =
          loopIterations[iterKey]?.[formula.screenSlug]?.[formula.answerKey];
        const correct =
          item !== null && typeof item === 'object'
            ? (item as Record<string, unknown>)[formula.correctKey]
            : undefined;
        return answer === correct ? count + 1 : count;
      }, 0);
    }
  }
}
