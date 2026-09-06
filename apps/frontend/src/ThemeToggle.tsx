'use client';

import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { twMerge } from 'tailwind-merge';

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const isLight = resolvedTheme === 'light';

  return (
    <button
      onClick={() => setTheme(isLight ? 'dark' : 'light')}
      className={twMerge(
        'text-content-secondary hover:text-content-primary relative flex size-8 items-center justify-center rounded-sm transition-[color] duration-150 ease-out',
        'hover:bg-content-primary/20 active:scale-[0.96]',
      )}
      aria-label={isLight ? 'Switch to dark mode' : 'Switch to light mode'}
    >
      <Moon
        className={twMerge(
          'absolute size-4 transition-[opacity,transform,filter] duration-150 ease-[cubic-bezier(0.2,0,0,1)]',
          isLight ? 'scale-100 opacity-100 blur-none' : 'scale-[0.25] opacity-0 blur-[4px]',
        )}
      />
      <Sun
        className={twMerge(
          'absolute size-4 transition-[opacity,transform,filter] duration-150 ease-[cubic-bezier(0.2,0,0,1)]',
          isLight ? 'scale-[0.25] opacity-0 blur-[4px]' : 'scale-100 opacity-100 blur-none',
        )}
      />
    </button>
  );
}
