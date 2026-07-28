'use client';

import { useState, useCallback } from 'react';
import WallViewer from '@/components/wall/WallViewer';

interface PlaygroundPageClientProps {
  wall: {
    id: string;
    slug: string;
    mode: string;
    theme: string;
    created_at: string;
  };
  notes: any[];
  templates: any[];
}

export default function PlaygroundPageClient({ wall, notes: initialNotes, templates }: PlaygroundPageClientProps) {
  const [notes, setNotes] = useState(initialNotes);

  const handleDeleteNote = useCallback((noteId: string) => {
    setNotes((prev) => prev.filter((n) => n.id !== noteId));
  }, []);

  const handleNoteSaved = useCallback(() => {
    window.location.reload();
  }, []);

  return (
    <WallViewer
      wall={{ ...wall, allow_contributions: true }}
      notes={notes}
      templates={templates}
      isPlayground
      onNoteDelete={handleDeleteNote}
      onNoteSaved={handleNoteSaved}
    />
  );
}
