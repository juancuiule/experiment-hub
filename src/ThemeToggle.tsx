'use client'

import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()

  return (
    <button
      onClick={() => setTheme(resolvedTheme === 'light' ? 'dark' : 'light')}
      className="flex items-center justify-center size-8 rounded-sm text-content-secondary hover:text-content-primary transition-[color] duration-150 ease-out"
      aria-label={resolvedTheme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
    >
      {resolvedTheme === 'light' ? <Moon className="size-4" /> : <Sun className="size-4" />}
    </button>
  )
}