import { ScreenNode } from '../nodes';
import { FrameworkScreen } from '../screen';
import { ExperimentFlow } from '../types';
import { ValidationError } from './types';

export function checkScreenDefinitions(flow: ExperimentFlow): ValidationError[] {
  const errors: ValidationError[] = [];
  const { screens = [], nodes } = flow;

  const screenNodes = nodes.filter((n): n is ScreenNode => n.type === 'screen');

  const screensMap = new Map<string, FrameworkScreen[]>();
  const duplicatedSlugs = new Set<string>();
  screens.forEach((screen) => {
    const existing = screensMap.get(screen.slug);
    if (existing) {
      duplicatedSlugs.add(screen.slug);
      screensMap.set(screen.slug, [...existing, screen]);
    } else {
      screensMap.set(screen.slug, [screen]);
    }
  });

  duplicatedSlugs.forEach((slug) => {
    errors.push({
      code: 'duplicate-screen',
      category: 'screen',
      message: `Duplicate screen slug "${slug}" found in screens: ${screensMap
        .get(slug)
        ?.map((s) => JSON.stringify(s))
        .join(', ')}`,
    });
  });

  screenNodes.forEach((node) => {
    if (!screensMap.has(node.props.slug)) {
      errors.push({
        code: 'missing-screen',
        category: 'screen',
        message: `Screen node "${node.id}" references slug "${node.props.slug}" with no screen definition`,
      });
    }
  });

  const referencedSlugs = new Set(screenNodes.map((node) => node.props.slug));

  screensMap.keys().forEach((slug) => {
    if (!referencedSlugs.has(slug)) {
      errors.push({
        code: 'unreferenced-screen',
        category: 'screen',
        message: `Screen definition "${slug}" is not referenced by any screen node`,
      });
    }
  });

  return errors;
}
