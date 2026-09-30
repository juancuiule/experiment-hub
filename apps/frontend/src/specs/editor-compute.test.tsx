import { render, screen } from '@testing-library/react';
import type { Computation } from '@experiment-hub/engine/nodes';
import { describe, expect, it } from 'vitest';
import ComputeEditor from '../editor/ComputeEditor';

const renderEditor = (computations: Computation[]) =>
  render(
    <ComputeEditor
      computations={computations}
      refs={[]}
      loopIds={[]}
      screenSlugs={[]}
      onChange={() => {}}
    />,
  );

describe('ComputeEditor', () => {
  it('summarizes an inline array input instead of "[object Object]"', () => {
    renderEditor([
      {
        outputKey: 'selected-items',
        formula: {
          type: 'sample',
          input: [
            { id: 'a', img: '1' },
            { id: 'b', img: '2' },
            { id: 'c', img: '3' },
          ],
          n: 2,
        },
      },
    ]);
    expect(screen.getByText('3 items')).toBeTruthy();
    expect(screen.queryByText(/object Object/)).toBeNull();
  });

  it('renders a ref input for string inputs', () => {
    renderEditor([
      {
        outputKey: 'picked',
        formula: {
          type: 'sample',
          input: '$$config.items' as `$$${string}`,
          n: 3,
        },
      },
    ]);
    expect(
      (screen.getByDisplayValue('$$config.items') as HTMLInputElement).value,
    ).toBe('$$config.items');
  });
});
