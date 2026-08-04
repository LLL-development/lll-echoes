import { notFound } from 'next/navigation';
import PlaygroundPageClient from './PlaygroundPageClient';

export const dynamic = 'force-dynamic';

async function fetchWall(slug: string) {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3500'}/api/walls/${slug}`,
    { headers: { 'Cache-Control': 'no-cache' } }
  );

  if (!res.ok) {
    return null;
  }

  return res.json();
}

export async function generateMetadata() {
  return {
    title: 'Echoes — Testimonials Wall',
    description: 'A visual community wall for testimonials and feedback.',
    openGraph: {
      title: 'Echoes — Testimonials Wall',
      description: 'A visual community wall for testimonials and feedback.',
      type: 'website',
    },
  };
}

export default async function PlaygroundPage() {
  const data = await fetchWall('playground');

  if (!data?.wall) {
    notFound();
  }

  return (
    <PlaygroundPageClient
      wall={data.wall}
      notes={data.notes}
      templates={data.templates}
    />
  );
}
