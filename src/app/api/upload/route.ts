import { NextRequest, NextResponse } from 'next/server';
import { uploadImage } from '@/lib/storage';
import { supabase } from '@/lib/supabase';
import { createHash } from 'crypto';

const MAX_FILE_SIZE = 1 * 1024 * 1024;
const ALLOWED_TYPES = ['image/webp', 'image/png', 'image/jpeg', 'image/jpg'];

// Magic-byte signatures for defense-in-depth image validation
const MAGIC_WEBP = Buffer.from([0x57, 0x45, 0x42, 0x50]); // "WEBP"
const MAGIC_PNG  = Buffer.from([0x89, 0x50, 0x4E, 0x47]); // "\x89PNG"
const MAGIC_JPEG = Buffer.from([0xFF, 0xD8, 0xFF]);

function checkMagicBytes(buffer: Buffer): boolean {
  // WebP: RIFF....WEBP  (bytes 0-3 = "RIFF", bytes 8-11 = "WEBP")
  if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46) {
    if (buffer.subarray(8, 12).equals(MAGIC_WEBP)) return true;
  }
  // PNG: \x89PNG
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) return true;
  // JPEG: \xFF\xD8\xFF
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) return true;
  return false;
}

export async function POST(request: NextRequest) {
  const editToken = request.headers.get('X-Edit-Token') || '';
  const slug = request.nextUrl.searchParams.get('slug');

  if (!slug) {
    return NextResponse.json({ error: 'Slug is required' }, { status: 400 });
  }

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

  const formData = await request.formData();
  const file = formData.get('file') as File;

  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  // MIME type check (client-provided, easily spoofed)
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      {
        error: 'Only WebP, PNG, and JPG images are allowed',
        converterUrl: 'https://lll-image.pages.dev/convert',
      },
      { status: 400 }
    );
  }

  // Server-side size check
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      {
        error: 'File size must be under 1MB',
        converterUrl: 'https://lll-image.pages.dev/convert',
      },
      { status: 400 }
    );
  }

  // Magic-byte check (defense in depth — reads actual file content)
  // Note: file.arrayBuffer() does not consume/invalidates the File object —
  // the original `file` reference remains fully readable for uploadImage below.
  const arrayBuffer = await file.arrayBuffer();
  const fileBuffer = Buffer.from(arrayBuffer);
  if (fileBuffer.length < 12 || !checkMagicBytes(fileBuffer)) {
    return NextResponse.json(
      {
        error: 'File does not appear to be a valid image',
        converterUrl: 'https://lll-image.pages.dev/convert',
      },
      { status: 400 }
    );
  }

  try {
    const url = await uploadImage(file, editToken);
    return NextResponse.json({ url });
  } catch {
    return NextResponse.json(
      { error: 'Failed to upload image' },
      { status: 500 }
    );
  }
}
