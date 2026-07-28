'use client';

import WallViewer from './WallViewer';

interface PlaygroundWallProps {
  wall: {
    id: string;
    slug: string;
    mode: string;
    theme: string;
    created_at: string;
  };
  notes: import('@/types').Note[];
  templates: import('@/types').NoteTemplate[];
}

export default function PlaygroundWall({
  wall,
  notes,
  templates,
}: PlaygroundWallProps) {
  return (
    <WallViewer
      wall={wall}
      notes={notes}
      templates={templates}
      isPlayground
    />
  );
}
