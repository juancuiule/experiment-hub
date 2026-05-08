import { describe, test, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ComponentRegistryProvider, useComponentRegistry } from '@/lib/registry'

function RegistrySpy() {
  const registry = useComponentRegistry()
  return <div data-testid="keys">{Object.keys(registry).sort().join(',')}</div>
}

describe('ComponentRegistryProvider', () => {
  test('provides empty registry when none given', () => {
    render(
      <ComponentRegistryProvider registry={{}}>
        <RegistrySpy />
      </ComponentRegistryProvider>
    )
    expect(screen.getByTestId('keys').textContent).toBe('')
  })

  test('provides registry to consumers', () => {
    const MockButton = () => <button>mock</button>
    const MockRadio = () => <div>mock radio</div>
    render(
      <ComponentRegistryProvider registry={{ button: MockButton, radio: MockRadio }}>
        <RegistrySpy />
      </ComponentRegistryProvider>
    )
    expect(screen.getByTestId('keys').textContent).toBe('button,radio')
  })

  test('useComponentRegistry returns empty object when used outside provider', () => {
    render(<RegistrySpy />)
    expect(screen.getByTestId('keys').textContent).toBe('')
  })
})
