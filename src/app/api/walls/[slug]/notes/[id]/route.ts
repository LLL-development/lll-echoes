import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { createHash } from 'crypto';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  const { slug, id } = await params;
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
  const { x, y, width, height, rotation, template_id, author_name } = body;

  const { error } = await supabase
    .from('notes')
    .update({
      x: x ?? undefined,
      y: y ?? undefined,
      width: width ?? undefined,
      height: height ?? undefined,
      rotation: rotation ?? undefined,
      template_id,
      author_name,
    })
    .eq('id', id)
    .eq('wall_id', wall.id);

  if (error) {
    return NextResponse.json(
      { error: 'Failed to update note' },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  const { slug, id } = await params;
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
    .from('notes')
    .delete()
    .eq('id', id)
    .eq('wall_id', wall.id);

  if (error) {
    return NextResponse.json(
      { error: 'Failed to delete note' },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
