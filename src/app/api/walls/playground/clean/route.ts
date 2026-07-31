import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

const SESSION_ID_RE = /^[a-zA-Z0-9_-]+$/;

export async function DELETE(request: NextRequest) {
  const sessionUuid = request.nextUrl.searchParams.get('session_uuid');

  if (
    !sessionUuid ||
    sessionUuid.length > 64 ||
    !SESSION_ID_RE.test(sessionUuid)
  ) {
    return NextResponse.json({ error: 'Invalid session_uuid' }, { status: 400 });
  }

  const { data: wall } = await supabase
    .from('walls')
    .select('id')
    .eq('slug', 'playground')
    .single();

  if (!wall) {
    return NextResponse.json({ ok: true });
  }

  await supabase
    .from('notes')
    .delete()
    .eq('wall_id', wall.id)
    .eq('author_session_id', sessionUuid);

  return NextResponse.json({ ok: true });
}
