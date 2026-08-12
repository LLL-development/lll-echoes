import { notFound } from 'next/navigation';
export const runtime = 'edge';
import WallPageClient from './WallPageClient';
import { getWallData } from '@/lib/walls';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await getWallData(slug);
  const wall = data?.wall;

  const title = wall?.title || wall?.theme || 'Untitled Wall';
  const description = wall?.description || `View notes on the ${title} wall.`;

  return {
    title: `${title} — Echoes`,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
    },
  };
}

export default async function WallPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await getWallData(slug);

  if (!data?.wall) {
    notFound();
  }

  return (
    <WallPageClient
      wall={data.wall}
      notes={data.notes}
      templates={data.templates}
    />
  );
}
