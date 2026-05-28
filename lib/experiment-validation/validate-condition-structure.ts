import { Condition } from '../conditions';
import { ErrorCategory, ValidationError } from './types';

export function validateConditionStructure(
  condition: Condition,
  category: ErrorCategory,
): ValidationError[] {
  const errors: ValidationError[] = [];

  switch (condition.type) {
    case 'and':
    case 'or': {
      if (condition.conditions.length === 0) {
        errors.push({
          code: 'condition-empty',
          category,
          message: `A "${condition.type}" condition has no children, but at least one condition is required`,
        });
      }

      errors.push(
        ...condition.conditions.flatMap((child) =>
          validateConditionStructure(child, category),
        ),
      );
      break;
    }
    case 'not': {
      errors.push(...validateConditionStructure(condition.condition, category));
    }
  }

  return errors;
}
