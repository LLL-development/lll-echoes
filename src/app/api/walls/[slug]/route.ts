import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { supabase } from '@/lib/supabase';
import { createHash } from 'crypto';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  const { data: wall, error: wallError } = await supabase
    .from('walls')
    .select('id, slug, mode, theme, allow_contributions, created_at, title, description')
    .eq('slug', slug)
    .single();

  if (wallError || !wall) {
    return NextResponse.json({ error: 'Wall not found' }, { status: 404 });
  }

  // Lazy cleanup for playground — drop session-tagged notes older than 24 hours
  if (slug === 'playground') {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    await supabase
      .from('notes')
      .delete()
      .eq('wall_id', wall.id)
      .not('author_session_id', 'is', null)
      .lt('created_at', cutoff);
  }

  const { data: notes } = await supabase
    .from('notes')
    .select('*')
    .eq('wall_id', wall.id)
    .order('created_at', { ascending: true });

  const { data: templates } = await supabase
    .from('note_templates')
    .select('*')
    .eq('wall_id', wall.id)
    .order('is_default', { ascending: false });

  return NextResponse.json({
    wall,
    notes: notes || [],
    templates: templates || [],
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const editToken = request.headers.get('X-Edit-Token') || '';

  const { data: wall } = await supabase
    .from('walls')
    .select('id, edit_token')
    .eq('slug', slug)
    .single();

  if (!wall) {
    return NextResponse.json({ error: 'Wall not found' }, { status: 404 });
  }

  const tokenHash = createHash('sha256').update(editToken).digest('hex');
  if (tokenHash !== wall.edit_token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { allow_contributions, theme, title, description } = body;

  const updates: Record<string, any> = {};
  if (allow_contributions !== undefined) updates.allow_contributions = allow_contributions;
  if (theme !== undefined) updates.theme = theme;
  if (title !== undefined) updates.title = title || null;
  if (description !== undefined) updates.description = description || null;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  const { error } = await supabase
    .from('walls')
    .update(updates)
    .eq('id', wall.id);

  if (error) {
    return NextResponse.json(
      { error: 'Failed to update wall' },
      { status: 500 }
    );
  }

  if (title !== undefined || description !== undefined) {
    const cacheKey = createHash('sha256').update(`wall-screenshot-${slug}`).digest('hex').substring(0, 16);
    await supabase.from('_screenshot_cache').delete().eq('key', cacheKey);
  }

  // Invalidate the wall page cache so it fetches fresh data
  revalidatePath(`/w/${slug}`);

  return NextResponse.json({ success: true });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const editToken = request.headers.get('X-Edit-Token') || '';

  const { data: wall } = await supabase
    .from('walls')
    .select('id, edit_token')
    .eq('slug', slug)
    .single();

  if (!wall) {
    return NextResponse.json({ error: 'Wall not found' }, { status: 404 });
  }

  const tokenHash = createHash('sha256').update(editToken).digest('hex');
  if (tokenHash !== wall.edit_token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { error } = await supabase
    .from('walls')
    .delete()
    .eq('id', wall.id);

  if (error) {
    return NextResponse.json(
      { error: 'Failed to delete wall' },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
