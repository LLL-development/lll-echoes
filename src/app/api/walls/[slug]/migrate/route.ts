import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { randomUUID, createHash } from 'crypto';

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

  // Fetch the playground wall (defensive)
  const { data: playgroundWall } = await supabase
    .from('walls')
    .select('id')
    .eq('slug', 'playground')
    .single();

  if (!playgroundWall) {
    return NextResponse.json({ error: 'Playground wall not found' }, { status: 404 });
  }

  // Fetch all of this user's notes from the playground
  const { data: sourceNotes, error: notesError } = await supabase
    .from('notes')
    .select('*')
    .eq('wall_id', playgroundWall.id)
    .eq('author_session_id', session_id);

  if (notesError) {
    console.error('[POST /api/walls/playground/migrate] Fetch notes error:', notesError);
    return NextResponse.json({ error: 'Failed to read playground notes' }, { status: 500 });
  }

  // Create a new permanent wall
  const newSlug = randomUUID().substring(0, 8);
  const newEditToken = randomUUID();
  const newEditTokenHash = createHash('sha256').update(newEditToken).digest('hex');

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
      embed_bg_color: '#ffffff',
    })
    .select()
    .single();

  if (wallError || !newWall) {
    console.error('[POST /api/walls/playground/migrate] Wall creation error:', wallError);
    return NextResponse.json({ error: 'Failed to create new wall' }, { status: 500 });
  }

  // Copy notes to the new wall (new IDs, same positions/content)
  if (sourceNotes && sourceNotes.length > 0) {
    const newNotes = sourceNotes.map((note) => ({
      wall_id: newWall.id,
      image_url: note.image_url,
      x: note.x,
      y: note.y,
      width: note.width,
      height: note.height,
      rotation: note.rotation,
      template_id: note.template_id,
      author_name: note.author_name,
      author_session_id: null, // clear session on migrated notes
    }));

    const { error: copyError } = await supabase.from('notes').insert(newNotes);
    if (copyError) {
      console.error('[POST /api/walls/playground/migrate] Note copy error:', copyError);
      // Don't roll back the wall — it's created, just let user know it went partial
      return NextResponse.json({
        error: 'Wall created but failed to copy notes',
        slug: newSlug,
        editToken: newEditToken,
      }, { status: 500 });
    }
  }

  return NextResponse.json({
    slug: newSlug,
    editToken: newEditToken,
    editLink: `/w/${newSlug}/edit`,
    notesCount: sourceNotes?.length ?? 0,
  });
}
