import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const runtime = 'edge';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  const { slug, id } = await params;

  const { data: wall } = await supabase
    .from('walls')
    .select('id, edit_token')
    .eq('slug', slug)
    .single();

  if (!wall) {
    return NextResponse.json({ error: 'Wall not found' }, { status: 404 });
  }

  if (slug === 'playground') {
    const sessionId = request.headers.get('X-Playground-Session-Id') || '';
    if (
      !sessionId ||
      sessionId.length > 64 ||
      !/^[a-zA-Z0-9_-]+$/.test(sessionId)
    ) {
      return NextResponse.json({ error: 'Invalid session_id' }, { status: 401 });
    }

    const { data: targetNote } = await supabase
      .from('notes')
      .select('id, author_session_id')
      .eq('id', id)
      .eq('wall_id', wall.id)
      .single();

    if (!targetNote) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 });
    }
    if (!targetNote.author_session_id) {
      return NextResponse.json(
        { error: 'Cannot edit seeded notes on the playground' },
        { status: 403 }
      );
    }
    if (targetNote.author_session_id !== sessionId) {
      return NextResponse.json(
        { error: 'You can only edit your own notes' },
        { status: 403 }
      );
    }
  } else {
    const editToken = request.headers.get('X-Edit-Token') || '';
    const tokenHash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(editToken)).then(buf => Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join(''));
    if (tokenHash !== wall.edit_token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const body = await request.json();
  const { x, y, width, height, rotation, template_id, author_name, content } = body;

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
      content: content !== undefined ? content : undefined,
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

  const { data: wall } = await supabase
    .from('walls')
    .select('id, edit_token, allow_contributions')
    .eq('slug', slug)
    .single();

  if (!wall) {
    return NextResponse.json({ error: 'Wall not found' }, { status: 404 });
  }

  if (slug === 'playground') {
    const sessionId = request.headers.get('X-Playground-Session-Id') || '';
    if (
      !sessionId ||
      sessionId.length > 64 ||
      !/^[a-zA-Z0-9_-]+$/.test(sessionId)
    ) {
      return NextResponse.json({ error: 'Invalid session_id' }, { status: 401 });
    }

    const { data: targetNote } = await supabase
      .from('notes')
      .select('id, author_session_id')
      .eq('id', id)
      .eq('wall_id', wall.id)
      .single();

    if (!targetNote) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 });
    }
    if (!targetNote.author_session_id || targetNote.author_session_id !== sessionId) {
      return NextResponse.json(
        { error: targetNote.author_session_id ? 'You can only delete your own notes' : 'Cannot delete seeded notes on the playground' },
        { status: 403 }
      );
    }
  } else {
    const editToken = request.headers.get('X-Edit-Token') || '';
    const tokenHash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(editToken)).then(buf => Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join(''));
    
    if (tokenHash === wall.edit_token) {
      // Owner can delete any note
    } else if (wall.allow_contributions) {
      const sessionId = request.headers.get('X-Playground-Session-Id') || '';
      const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || request.headers.get('x-real-ip') || 'unknown';
      
      const { data: note } = await supabase
        .from('notes')
        .select('author_session_id, author_ip')
        .eq('id', id)
        .single();
      
      if (!note) {
        return NextResponse.json({ error: 'Note not found' }, { status: 404 });
      }
      
      const canDelete = (note.author_session_id && note.author_session_id === sessionId) ||
                       (!note.author_session_id && note.author_ip === ip);
      
      if (!canDelete) {
        return NextResponse.json({ error: 'You can only delete your own notes' }, { status: 401 });
      }
    } else {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
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
