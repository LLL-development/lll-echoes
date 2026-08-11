import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export const size = {
  width: 1200,
  height: 630,
};

export const contentType = 'image/png';

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  let wall: { title: string | null; description: string | null; theme: string } | null = null;

  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3500'}/api/walls/${slug}`,
      { cache: 'no-store' }
    );

    if (res.ok) {
      const data = await res.json();
      wall = data?.wall ?? null;
    }
  } catch {
    // Fetch failed — fall through to fallback
  }

  const title = wall?.title || 'Untitled Wall';
  const description = wall?.description || '';
  const theme = wall?.theme || '';

  const truncatedTitle = title.length > 60 ? title.slice(0, 57) + '...' : title;
  const truncatedDesc = description.length > 120 ? description.slice(0, 117) + '...' : description;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-start',
          alignItems: 'flex-start',
          padding: '80px 80px',
          background: 'linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 50%, #16213e 100%)',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Subtle background decoration */}
        <div
          style={{
            position: 'absolute',
            top: -100,
            right: -100,
            width: 400,
            height: 400,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 70%)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: -150,
            left: -100,
            width: 500,
            height: 500,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(139,92,246,0.1) 0%, transparent 70%)',
          }}
        />

        {/* Top accent line */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 6,
            background: 'linear-gradient(90deg, #6366f1, #8b5cf6, #a78bfa)',
          }}
        />

        {/* Branding */}
        <div
          style={{
            fontSize: 22,
            fontWeight: 600,
            color: '#a78bfa',
            letterSpacing: 3,
            textTransform: 'uppercase',
            marginBottom: 40,
            position: 'relative',
            zIndex: 1,
          }}
        >
          Echoes
        </div>

        {/* Title */}
        <div
          style={{
            fontSize: 64,
            fontWeight: 700,
            color: '#f1f5f9',
            lineHeight: 1.15,
            maxWidth: 1000,
            marginBottom: 24,
            position: 'relative',
            zIndex: 1,
          }}
        >
          {truncatedTitle}
        </div>

        {/* Description */}
        {truncatedDesc && (
          <div
            style={{
              fontSize: 28,
              color: '#94a3b8',
              lineHeight: 1.5,
              maxWidth: 1000,
              marginBottom: 40,
              position: 'relative',
              zIndex: 1,
            }}
          >
            {truncatedDesc}
          </div>
        )}

        {/* Theme tag */}
        {theme && (
          <div
            style={{
              display: 'block',
              padding: '8px 20px',
              borderRadius: 8,
              background: 'rgba(99,102,241,0.15)',
              border: '1px solid rgba(99,102,241,0.3)',
              fontSize: 18,
              color: '#a78bfa',
              fontWeight: 500,
              position: 'relative',
              zIndex: 1,
            }}
          >
            {theme}
          </div>
        )}

        {/* Bottom bar */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: 4,
            background: 'linear-gradient(90deg, #a78bfa, #6366f1, #8b5cf6)',
          }}
        />
      </div>
    ),
    { ...size }
  );
}
