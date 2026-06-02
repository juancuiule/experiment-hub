import { redirect } from 'next/navigation';

export const revalidate = 0; // Disable caching to ensure fresh data on each request

export default function Home() {
  redirect('/experiments/emociones');
}
