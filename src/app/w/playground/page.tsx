import { notFound } from 'next/navigation';
export const runtime = 'edge';
import PlaygroundPageClient from './PlaygroundPageClient';
import { getWallData } from '@/lib/walls';

export const dynamic = 'force-dynamic';

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
  const data = await getWallData('playground');

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
