import { describe, test, expect } from 'vitest'
import { themeToVars } from '../theme'

describe('themeToVars', () => {
  test('returns empty object for undefined', () => {
    expect(themeToVars(undefined)).toEqual({})
  })

  test('returns empty object for empty theme', () => {
    expect(themeToVars({})).toEqual({})
  })

  test('maps colors.primary to --primary', () => {
    expect(themeToVars({ colors: { primary: '#e63946' } }))
      .toMatchObject({ '--primary': '#e63946' })
  })

  test('maps all color tokens to correct var names', () => {
    const result = themeToVars({
      colors: {
        primary: '#111',
        primaryForeground: '#fff',
        background: '#fdf',
        surface: '#f9f',
        surfaceHover: '#f4f',
        foreground: '#1d1',
        mutedForeground: '#aaa',
        border: '#d4d',
        error: '#f00',
      },
    })
    expect(result['--primary']).toBe('#111')
    expect(result['--primary-foreground']).toBe('#fff')
    expect(result['--background']).toBe('#fdf')
    expect(result['--surface']).toBe('#f9f')
    expect(result['--surface-hover']).toBe('#f4f')
    expect(result['--foreground']).toBe('#1d1')
    expect(result['--muted-foreground']).toBe('#aaa')
    expect(result['--border']).toBe('#d4d')
    expect(result['--error']).toBe('#f00')
  })

  test('maps radius to --radius', () => {
    expect(themeToVars({ radius: '0px' })).toMatchObject({ '--radius': '0px' })
  })

  test('maps spacing tokens', () => {
    const result = themeToVars({ spacing: { fieldGap: '1.5rem', screenPadding: '2rem' } })
    expect(result['--field-gap']).toBe('1.5rem')
    expect(result['--screen-padding']).toBe('2rem')
  })

  test('omits undefined tokens — does not write keys for missing values', () => {
    const result = themeToVars({ colors: { primary: '#111' } })
    expect('--background' in result).toBe(false)
    expect('--border' in result).toBe(false)
    expect('--radius' in result).toBe(false)
  })

  test('typography.fontFamily is not included in CSS vars (handled separately)', () => {
    const result = themeToVars({ typography: { fontFamily: 'Georgia, serif' } })
    expect(Object.keys(result)).toHaveLength(0)
  })
})
