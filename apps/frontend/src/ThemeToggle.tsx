'use client';

import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { twMerge } from 'tailwind-merge';

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <button
      onClick={() => setTheme(resolvedTheme === 'light' ? 'dark' : 'light')}
      className={twMerge(
        'text-content-secondary hover:text-content-primary flex size-8 items-center justify-center rounded-sm transition-[color,transform] duration-150 ease-out',
        'hover:bg-content-primary/20 active:scale-90',
      )}
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
