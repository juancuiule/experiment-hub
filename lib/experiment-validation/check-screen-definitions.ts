import { ScreenNode } from '../nodes';
import { FrameworkScreen } from '../screen';
import { ExperimentFlow } from '../types';
import { ValidationError } from './types';

export function checkScreenDefinitions(
  flow: ExperimentFlow,
): ValidationError[] {
  const errors: ValidationError[] = [];
  const { screens = [], nodes } = flow;

  const screenNodes = nodes.filter((n): n is ScreenNode => n.type === 'screen');

  const screensBySlug = new Map<string, FrameworkScreen[]>();
  screens.forEach((screen) => {
    const existing = screensBySlug.get(screen.slug) ?? [];
    screensBySlug.set(screen.slug, [...existing, screen]);
  });

  // 1. Check for duplicate screen slugs
  screensBySlug.forEach((group, slug) => {
    if (group.length > 1) {
      errors.push({
        code: 'duplicate-screen',
        category: 'screen',
        message: `Duplicate screen slug "${slug}" found in screens: ${group
          .map((s) => JSON.stringify(s))
          .join(', ')}`,
      });
    }
  });

  // 2. Check that every screen node references a defined screen slug
  screenNodes.forEach((node) => {
    if (!screensBySlug.has(node.props.slug)) {
      errors.push({
        code: 'missing-screen',
        category: 'screen',
        message: `Screen node "${node.id}" references slug "${node.props.slug}" with no screen definition`,
      });
    }
  });

  // 3. Check for unreferenced screen definitions
  const referencedSlugs = new Set(screenNodes.map((node) => node.props.slug));
  screensBySlug.forEach((_, slug) => {
    if (!referencedSlugs.has(slug)) {
      errors.push({
        code: 'unreferenced-screen',
        category: 'screen',
        severity: 'warning',
        message: `Screen definition "${slug}" is not referenced by any screen node`,
      });
    }
  });

  return errors;
}
