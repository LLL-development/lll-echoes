import { notFound } from 'next/navigation';
import WallPageClient from './WallPageClient';

export const dynamic = 'force-dynamic';

async function fetchWall(slug: string) {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3500'}/api/walls/${slug}`,
    { headers: { 'Cache-Control': 'no-cache' }, cache: 'no-store' }
  );

  if (!res.ok) {
    return null;
  }

  return res.json();
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await fetchWall(slug);
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
      images: [{ url: `/api/walls/${slug}/screenshot` }],
    },
  };
}

export default async function WallPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await fetchWall(slug);

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
