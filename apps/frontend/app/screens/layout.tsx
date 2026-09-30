import { ThemeToggle } from '@/src/ThemeToggle';
import Image from 'next/image';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <main className="relative mx-auto flex min-h-screen w-full flex-col items-center justify-start p-6">
      <nav className="flex w-full flex-row items-center justify-between gap-3 pb-6">
        <Image
          width="48"
          height="48"
          src="/experiment-hub-logo.png"
          className="h-12 w-auto"
          alt="Experiment Hub logo with text"
        />
        <ThemeToggle />
      </nav>
      <div className="flex w-full flex-1 flex-col">{children}</div>
    </main>
  );
}
