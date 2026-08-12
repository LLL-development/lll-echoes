import { supabase } from './supabase';

/**
 * Loads the data needed to render a wall without making an HTTP request back
 * to the current deployment. This works in local development and on Pages,
 * where there is no localhost Next.js server listening on port 3500.
 */
export async function getWallData(slug: string) {
  const { data: wall, error: wallError } = await supabase
    .from('walls')
    .select('id, slug, mode, theme, allow_contributions, created_at, title, description')
    .eq('slug', slug)
    .single();

  if (wallError || !wall) {
    return null;
  }

  const [notesResult, templatesResult] = await Promise.all([
    supabase
      .from('notes')
      .select('*')
      .eq('wall_id', wall.id)
      .order('created_at', { ascending: true }),
    supabase
      .from('note_templates')
      .select('*')
      .eq('wall_id', wall.id)
      .order('is_default', { ascending: false }),
  ]);

  return {
    wall,
    notes: notesResult.data ?? [],
    templates: templatesResult.data ?? [],
  };
}
