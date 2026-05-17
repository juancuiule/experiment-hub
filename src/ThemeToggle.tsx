'use client';

import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <button
      onClick={() => setTheme(resolvedTheme === 'light' ? 'dark' : 'light')}
      className="text-content-secondary hover:text-content-primary flex size-8 items-center justify-center rounded-sm transition-[color] duration-150 ease-out"
      aria-label={
        resolvedTheme === 'light'
          ? 'Switch to dark mode'
          : 'Switch to light mode'
      }
    >
      {resolvedTheme === 'light' ? (
        <Moon className="size-4" />
      ) : (
        <Sun className="size-4" />
      )}
    </button>
  );
}
