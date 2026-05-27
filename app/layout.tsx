import type { Metadata } from 'next';
import { Montserrat, Overpass_Mono } from 'next/font/google';
import { twMerge } from 'tailwind-merge';
import './globals.css';
import { ThemeProvider } from '@/src/theme-provider';
import { ThemeToggle } from '@/src/ThemeToggle';

const montserrat = Montserrat({
  variable: '--font-sans',
  subsets: ['latin'],
});

const overpassMono = Overpass_Mono({
  variable: '--font-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Experiment Hub',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={twMerge(
          montserrat.variable,
          overpassMono.variable,
          'bg-background text-content-primary h-svh antialiased',
        )}
      >
        <ThemeProvider
          attribute={'class'}
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <main className="relative mx-auto flex min-h-screen w-full max-w-lg flex-col items-center justify-start p-6">
            <nav className="flex w-full flex-row items-center justify-between gap-3">
              <img
                src="/experiment-hub-logo.png"
                className="h-12 w-auto"
                alt="Experiment Hub logo with text"
              />
              <ThemeToggle />
            </nav>
            <div className="flex w-full flex-1 flex-col">{children}</div>
          </main>
        </ThemeProvider>
      </body>
    </html>
  );
}
