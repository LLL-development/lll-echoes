export interface Wall {
  id: string;
  slug: string;
  mode: 'ORGANIZATION' | 'PUBLIC' | 'PLAYGROUND';
  theme: string;
  title: string | null;
  description: string | null;
  allow_contributions: boolean;
  created_at: string;
}

export interface NoteTemplate {
  id: string;
  wall_id: string;
  name: string;
  style: Record<string, unknown>;
  is_default: boolean;
}

export interface Note {
  id: string;
  wall_id: string;
  image_url: string | null;
  content: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  template_id: string | null;
  author_session_id: string | null;
  author_name: string | null;
  created_at: string;
}

export interface EditorContent {
  textBlocks: TextBlock[];
  imageUrl: string | null;
  templateStyle: Record<string, unknown>;
}

export interface TextBlock {
  x: number;
  y: number;
  text: string;
  fontSize: number;
  color: string;
}
