import type { NextRequest } from 'next/server';

// ── Value validators ────────────────────────────────────────────────

export function isValidUrl(value: unknown): value is string {
  if (typeof value !== 'string' || value.length === 0) return false;
  // Accept standard HTTP(S) URLs (max 2048 chars)
  if (value.startsWith('http://') || value.startsWith('https://')) {
    return value.length <= 2048;
  }
  // Accept data image URLs (base64-encoded images from canvas, max ~2MB)
  if (value.startsWith('data:image/')) {
    return value.length <= 2 * 1024 * 1024;
  }
  return false;
}

export function isValidAuthorName(value: unknown): value is string | null {
  if (value === null || value === undefined || value === '') return true;
  if (typeof value !== 'string') return false;
  if (value.length > 50) return false;
  return !/[^\x20-\x7E]/.test(value);
}

export function isValidPosition(value: unknown): value is number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return false;
  return value >= 0 && value <= 10000;
}

export function isValidDimension(value: unknown, min = 80, max = 4000): value is number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return false;
  return value >= min && value <= max;
}

export function isValidRotation(value: unknown): value is number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return false;
  return value >= -360 && value <= 360;
}

// ── Token verification ──────────────────────────────────────────────

export async function verifyEditToken(
  supabaseClient: any,
  slug: string,
  token: string,
): Promise<{ wall: { id: string; edit_token: string } | null; error?: string }> {
  const { data: wall } = await supabaseClient
    .from('walls')
    .select('id, edit_token')
    .eq('slug', slug)
    .single();

  if (!wall) {
    return { wall: null, error: 'Wall not found' };
  }

  const tokenHash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token)).then(buf => Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join(''));
  if (tokenHash !== wall.edit_token) {
    return { wall: null, error: 'Unauthorized' };
  }

  return { wall };
}

// ── Rate-limit helpers ──────────────────────────────────────────────

export function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const ip = forwarded.split(',')[0].trim();
    if (ip) return ip;
  }
  return 'unknown';
}
