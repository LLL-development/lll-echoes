'use client';

import WallViewer from '@/components/wall/WallViewer';
import { ToastProvider } from '@/components/toast/ToastProvider';
import type { Note, NoteTemplate } from '@/types';

interface WallPageClientProps {
  wall: {
    id: string;
    slug: string;
    mode: string;
    theme: string;
    title?: string | null;
    description?: string | null;
    allow_contributions?: boolean;
    created_at: string;
  };
  notes: Note[];
  templates: NoteTemplate[];
}

export default function WallPageClient({ wall, notes, templates }: WallPageClientProps) {
  return (
    <ToastProvider>
      <WallViewer
        wall={wall}
        notes={notes}
        templates={templates}
      />
    </ToastProvider>
  );
}
