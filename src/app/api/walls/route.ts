import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { supabase } from '@/lib/supabase';
import { createHash } from 'crypto';
import { getClientIp } from '@/lib/validation';

// Coarse flood guard: counts ALL walls created globally in the last hour.
// Not per-IP (that would require a new table), but sufficient to throttle
// bulk flooding on a self-hosted instance.
const WALLS_PER_HOUR_LIMIT = Number(process.env.ECHOES_WALLS_PER_HOUR_LIMIT ?? 20);

export async function POST(request: NextRequest) {
  try {
    // Flood guard (production only)
    if (process.env.NODE_ENV !== 'development') {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { count: recentWallCount } = await supabase
        .from('walls')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', oneHourAgo);

      if (recentWallCount != null && recentWallCount >= WALLS_PER_HOUR_LIMIT) {
        return NextResponse.json(
          { error: 'Too many walls created recently. Please try again later.' },
          { status: 429 }
        );
      }
    }

    const body = await request.json();
    const { theme, mode = 'PUBLIC', title, description } = body;

    if (!theme) {
      return NextResponse.json(
        { error: 'Theme is required' },
        { status: 400 }
      );
    }

    if (!['ORGANIZATION', 'PUBLIC'].includes(mode)) {
      return NextResponse.json(
        { error: 'Invalid mode' },
        { status: 400 }
      );
    }

    const slug = randomUUID().substring(0, 8);
    const editToken = randomUUID();
    const editTokenHash = createHash('sha256').update(editToken).digest('hex');

    const { data: wall, error } = await supabase
      .from('walls')
      .insert({
        slug,
        edit_token: editTokenHash,
        mode,
        theme,
        allow_contributions: true,
        title: title || null,
        description: description || null,
      })
      .select()
      .single();

    if (error || !wall) {
      console.error('[POST /api/walls] Supabase error:', error);
      return NextResponse.json(
        { error: error?.message || 'Failed to create wall' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      wallId: wall.id,
      slug,
      editToken,
      editLink: `/w/${slug}/edit`,
    });
  } catch (err) {
    console.error('[POST /api/walls] Unexpected error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
