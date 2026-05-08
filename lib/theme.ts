export type ExperimentTheme = {
  colors?: {
    primary?: string
    primaryForeground?: string
    background?: string
    surface?: string
    surfaceHover?: string
    foreground?: string
    mutedForeground?: string
    border?: string
    error?: string
  }
  typography?: {
    fontFamily?: string
  }
  radius?: string
  spacing?: {
    fieldGap?: string
    screenPadding?: string
  }
}

export function themeToVars(theme?: ExperimentTheme): Record<string, string> {
  if (!theme) return {}
  const vars: Record<string, string> = {}
  const c = theme.colors
  if (c?.primary)            vars['--primary']            = c.primary
  if (c?.primaryForeground)  vars['--primary-foreground'] = c.primaryForeground
  if (c?.background)         vars['--background']         = c.background
  if (c?.surface)            vars['--surface']            = c.surface
  if (c?.surfaceHover)       vars['--surface-hover']      = c.surfaceHover
  if (c?.foreground)         vars['--foreground']         = c.foreground
  if (c?.mutedForeground)    vars['--muted-foreground']   = c.mutedForeground
  if (c?.border)             vars['--border']             = c.border
  if (c?.error)              vars['--error']              = c.error
  if (theme.radius)          vars['--radius']             = theme.radius
  if (theme.spacing?.fieldGap)      vars['--field-gap']       = theme.spacing.fieldGap
  if (theme.spacing?.screenPadding) vars['--screen-padding']  = theme.spacing.screenPadding
  return vars
}
