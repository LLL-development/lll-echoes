import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { createHash } from 'crypto';
import { JSDOM } from 'jsdom';

const CACHE_KEY = 'wall-screenshot';
const CACHE_DURATION = 60; // 1 minute in seconds

function createHtml(wall: any, notes: any[], imageDimensions: Record<string, { width: number; height: number }>) {
  const notesHtml = (notes || []).map((note: any) => {
    const rotationStyle = note.rotation ? `transform: rotate(${note.rotation}deg);` : '';
    const dims = imageDimensions[note.id];
    const w = dims ? dims.width : note.width;
    const h = dims ? dims.height : note.height;
    if (note.image_url) {
      return `<div style="position:absolute;left:${note.x}px;top:${note.y}px;width:${w}px;height:${h}px;${rotationStyle}">
        <img src="${note.image_url}" style="width:100%;height:100%;object-fit:contain;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,0.1);" />
      </div>`;
    }
    return `<div style="position:absolute;left:${note.x}px;top:${note.y}px;width:${w}px;height:${h}px;${rotationStyle};background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0;display:flex;align-items:center;justify-content:center;padding:16px">
      <div style="font-size:12px;color:#94a3b8">${note.author_name ? `— ${note.author_name}` : 'Empty note'}</div>
    </div>`;
  }).join('');

  return `<!DOCTYPE html><html><body>
    <div style="position:relative;width:1200px;height:800px;background:#fffef9;font-family:system-ui,-apple-system,sans-serif;overflow:hidden">
      <div style="text-align:center;padding:20px 0 10px;font-size:24px;font-weight:bold;color:#1e293b">${wall.theme.charAt(0).toUpperCase() + wall.theme.slice(1)}</div>
      ${notesHtml || '<div style="text-align:center;padding:40px;color:#94a3b8;font-size:16px">No notes yet</div>'}
    </div>
  </body></html>`;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  // Check cache first
  const cacheKey = createHash('sha256').update(`${CACHE_KEY}-${slug}`).digest('hex').substring(0, 16);
  const { data: cached }: any = await supabase
    .from('_screenshot_cache')
    .select('data, expires_at')
    .eq('key', cacheKey)
    .single();

  if (cached && new Date(cached.expires_at) > new Date()) {
    const bytes = Buffer.from(cached.data, 'base64');
    return new NextResponse(bytes, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': `public, max-age=${CACHE_DURATION}`,
      },
    });
  }

  // Fetch wall and notes
  const { data: wall } = await supabase
    .from('walls')
    .select('id, theme')
    .eq('slug', slug)
    .single();

  if (!wall) {
    return NextResponse.json({ error: 'Wall not found' }, { status: 404 });
  }

  const { data: notes } = await supabase
    .from('notes')
    .select('*')
    .eq('wall_id', wall.id)
    .order('created_at', { ascending: true });

  const imageDimensions: Record<string, { width: number; height: number }> = {};
  for (const note of (notes || [])) {
    if (note.image_url) {
      try {
        const resp = await fetch(note.image_url);
        const buffer = await resp.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        const view = new DataView(buffer);
        let w = 0, h = 0;
        if (bytes[0] === 0xFF && bytes[1] === 0xD8) {
          const len = view.getUint16(2);
          let offset = 2;
          while (offset < len - 1) {
            if (bytes[offset] === 0xFF && bytes[offset + 1] === 0xC0 && bytes[offset + 3] === 0x01) {
              h = view.getUint16(offset + 5);
              w = view.getUint16(offset + 7);
              break;
            }
            offset += view.getUint16(offset + 2);
          }
        } else if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) {
          w = view.getUint32(16);
          h = view.getUint32(20);
        }
        if (w > 0 && h > 0) {
          imageDimensions[note.id] = { width: w, height: h };
        } else {
          imageDimensions[note.id] = { width: note.width, height: note.height };
        }
      } catch {
        imageDimensions[note.id] = { width: note.width, height: note.height };
      }
    } else {
      imageDimensions[note.id] = { width: note.width, height: note.height };
    }
  }

  const html = createHtml(wall, notes || [], imageDimensions);

  const dom = new JSDOM(html, {
    url: 'http://localhost',
    contentType: 'text/html',
  });

  const { window } = dom;
  const { document } = window;

  const canvas = await import('html2canvas');
  const element = document.body;

  const renderedCanvas = await canvas.default(element, {
    backgroundColor: '#fffef9',
    scale: 2,
    logging: false,
  });

  const dataUrl = renderedCanvas.toDataURL('image/png');
  const base64 = dataUrl.replace(/^data:image\/png;base64,/, '');

  // Cache the result
  try {
    await supabase.from('_screenshot_cache').upsert({
      key: cacheKey,
      data: base64,
      expires_at: new Date(Date.now() + CACHE_DURATION * 1000).toISOString(),
    } as any);
  } catch {
    // Cache table may not exist yet — that's fine
  }

  window.close();

  const bytes = Buffer.from(base64, 'base64');
  return new NextResponse(bytes, {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': `public, max-age=${CACHE_DURATION}`,
    },
  });
}
