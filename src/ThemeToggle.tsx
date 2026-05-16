'use client'

import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()

  return (<button
    onClick={() => {
      if (resolvedTheme === 'light') {
        setTheme('dark')
      } else {
        setTheme('light')
      }
    }}
  >
    {resolvedTheme === 'light' ? <Moon /> : <Sun />}
  </button>)
}