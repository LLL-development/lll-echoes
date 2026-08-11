import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const runtime = 'edge';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  // Only allow migration FROM the playground wall — never from any other wall
  if (slug !== 'playground') {
    return NextResponse.json({ error: 'Migration is only supported from the playground wall' }, { status: 400 });
  }

  const body = await request.json();
  const { title, session_id } = body ?? {};

  if (!title || typeof title !== 'string' || title.trim().length === 0) {
    return NextResponse.json({ error: 'Title is required' }, { status: 400 });
  }
  if (title.length > 100) {
    return NextResponse.json({ error: 'Title too long (max 100 characters)' }, { status: 400 });
  }
  if (!session_id || typeof session_id !== 'string' || session_id.length > 64) {
    return NextResponse.json({ error: 'Invalid session_id' }, { status: 400 });
  }

  // Create a new permanent wall (empty — playground notes are cleaned up
  // via a separate beacon when the client navigates away).
  const newSlug = crypto.randomUUID().substring(0, 8);
  const newEditToken = crypto.randomUUID();
  const newEditTokenHash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(newEditToken)).then(buf => Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join(''));

  const { data: newWall, error: wallError } = await supabase
    .from('walls')
    .insert({
      slug: newSlug,
      edit_token: newEditTokenHash,
      mode: 'PUBLIC',
      theme: 'others',
      allow_contributions: true,
      title: title.trim(),
      description: null,
    })
    .select()
    .single();

  if (wallError || !newWall) {
    console.error('[POST /api/walls/playground/migrate] Wall creation error:', wallError);
    return NextResponse.json({ error: 'Failed to create new wall' }, { status: 500 });
  }

  return NextResponse.json({
    slug: newSlug,
    editToken: newEditToken,
    editLink: `/w/${newSlug}/edit`,
    notesCount: 0,
  });
}
