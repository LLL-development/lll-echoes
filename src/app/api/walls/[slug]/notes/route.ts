import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { verifyEditToken, isValidUrl, isValidAuthorName, isValidPosition, isValidDimension, isValidRotation } from '@/lib/validation';

export const runtime = 'edge';

const MAX_NOTES_PER_WALL = Number(process.env.ECHOES_MAX_NOTES_PER_WALL ?? 200);
const NOTES_PER_HOUR_LIMIT = Number(process.env.ECHOES_NOTES_PER_HOUR_LIMIT ?? 50);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const editToken = request.headers.get('X-Edit-Token') || '';

  // 1. Authenticate: allow if edit token valid OR wall allows contributions
  const wallQuery = await supabase
    .from('walls')
    .select('id, edit_token, allow_contributions')
    .eq('slug', slug)
    .single();

  if (wallQuery.error || !wallQuery.data) {
    return NextResponse.json({ error: 'Wall not found' }, { status: 404 });
  }

  const wall = wallQuery.data;
  const tokenHash = editToken ? await crypto.subtle.digest('SHA-256', new TextEncoder().encode(editToken)).then(buf => Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')) : '';
  const isOwner = tokenHash === wall.edit_token;
  const isContributor = wall.allow_contributions === true;

  if (!isOwner && !isContributor) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 2. Note count limit
  const { count: noteCount } = await supabase
    .from('notes')
    .select('id', { count: 'exact', head: true })
    .eq('wall_id', wall.id);

  if (noteCount != null && noteCount >= MAX_NOTES_PER_WALL) {
    return NextResponse.json(
      { error: 'This wall has reached its note limit. Please delete some notes before adding more.' },
      { status: 400 }
    );
  }

  // 3. Rate limit (per wall, per hour)
  const { count: recentCount } = await supabase
    .from('notes')
    .select('id', { count: 'exact', head: true })
    .eq('wall_id', wall.id)
    .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString());

  if (recentCount != null && recentCount >= NOTES_PER_HOUR_LIMIT) {
    return NextResponse.json(
      { error: 'Too many notes added recently. Please wait before adding more.' },
      { status: 429 }
    );
  }

  // 4. Validate body
  const body = await request.json();
  const { image_url, author_name, x, y, width, height, rotation, template_id, author_session_id, content } = body;

  if (image_url !== undefined && !isValidUrl(image_url)) {
    return NextResponse.json(
      { error: 'Image URL must be a valid HTTP or HTTPS URL' },
      { status: 400 }
    );
  }

  if (!isValidAuthorName(author_name)) {
    return NextResponse.json(
      { error: 'Author name must be 50 characters or fewer with no special characters' },
      { status: 400 }
    );
  }

  const posX = x !== undefined ? (isValidPosition(x) ? x : NaN) : 0;
  const posY = y !== undefined ? (isValidPosition(y) ? y : NaN) : 0;
  const posW = width !== undefined ? (isValidDimension(width) ? width : NaN) : 200;
  const posH = height !== undefined ? (isValidDimension(height) ? height : NaN) : 150;
  const posR = rotation !== undefined ? (isValidRotation(rotation) ? rotation : NaN) : 0;

  if (isNaN(posX) || isNaN(posY) || isNaN(posW) || isNaN(posH) || isNaN(posR)) {
    return NextResponse.json(
      { error: 'Invalid position, dimension, or rotation value' },
      { status: 400 }
    );
  }

  // 5. Insert
  const { data: note, error } = await supabase
    .from('notes')
    .insert({
      wall_id: wall.id,
      image_url,
      x: Math.round(posX),
      y: Math.round(posY),
      width: Math.round(posW),
      height: Math.round(posH),
      rotation: Math.round(posR),
      template_id,
      author_name: author_name || null,
      author_session_id: typeof author_session_id === 'string' && author_session_id.length <= 64
        ? author_session_id
        : null,
      content: typeof content === 'string' && content.length > 0 ? content : null,
    })
    .select()
    .single();

  if (error || !note) {
    console.error('Supabase insert error:', error);
    return NextResponse.json(
      { error: 'Failed to create note', details: error?.message },
      { status: 500 }
    );
  }

  return NextResponse.json(note, { status: 201 });
}
