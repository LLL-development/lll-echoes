'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Note, NoteTemplate } from '@/types';
import { THEME_IMAGES } from '@/lib/themes';
import SharePanel from './SharePanel';
import NotepadEditor from './NotepadEditor';
import PlaygroundInfoCard from './PlaygroundInfoCard';
import { useToast } from '@/components/toast/ToastProvider';

interface WallViewerProps {
  wall: {
    id: string;
    slug: string;
    mode: string;
    theme: string;
    title?: string | null;
    description?: string | null;
    embed_bg_color?: string;
    allow_contributions?: boolean;
    created_at: string;
  };
  notes: Note[];
  templates: NoteTemplate[];
  isPlayground?: boolean;
  onNotepadClick?: (imageUrl: string, themeName: string) => void;
  onNoteDelete?: (noteId: string) => void;
  onNoteSaved?: () => void;
}

const RESIZE_HANDLES = ['nw', 'n', 'ne', 'w', 'e', 'sw', 's', 'se'];

export default function WallViewer({
  wall,
  notes,
  templates,
  isPlayground = false,
  onNotepadClick,
  onNoteDelete,
  onNoteSaved,
}: WallViewerProps) {
  const router = useRouter();
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [notePositions, setNotePositions] = useState<Record<string, { x: number; y: number; width?: number; height?: number }>>(() => {
    const positions: Record<string, { x: number; y: number; width?: number; height?: number }> = {};
    notes.forEach((note) => {
      positions[note.id] = { x: note.x, y: note.y, width: note.width, height: note.height };
    });
    return positions;
  });
  const [selectedTemplate, setSelectedTemplate] = useState(0);
  const [showTemplateDropdown, setShowTemplateDropdown] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [hasEditToken, setHasEditToken] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const token = localStorage.getItem(`echoes_edit_token_${wall.slug}`);
    setHasEditToken(!!token);
  }, [wall.slug]);

  const [wallTitle, setWallTitle] = useState(wall.title || wall.theme.charAt(0).toUpperCase() + wall.theme.slice(1));
  const [editMode, setEditMode] = useState(false);
  const [resizingId, setResizingId] = useState<string | null>(null);
  const [resizeData, setResizeData] = useState({ origX: 0, origY: 0, origW: 0, origH: 0, startX: 0, startY: 0, handle: '' });
  const [rotatingId, setRotatingId] = useState<string | null>(null);
  const [rotateStartAngle, setRotateStartAngle] = useState(0);
  const [rotateStartRotation, setRotateStartRotation] = useState(0);
  const [noteRotations, setNoteRotations] = useState<Record<string, number>>(() => {
    const rotations: Record<string, number> = {};
    notes.forEach((note) => {
      rotations[note.id] = note.rotation || 0;
    });
    return rotations;
  });
  const [sidePanelOpen, setSidePanelOpen] = useState(false);
  const [sharePanelOpen, setSharePanelOpen] = useState(false);
  const [allowContributions, setAllowContributions] = useState(wall.allow_contributions ?? false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorImage, setEditorImage] = useState('');
  const [editorThemeName, setEditorThemeName] = useState('');
  const [editorAuthorName, setEditorAuthorName] = useState('');
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [imageDimensions, setImageDimensions] = useState<Record<string, { width: number; height: number }>>({});
  const [isEmbedded, setIsEmbedded] = useState(false);
  const [bgColorOverride, setBgColorOverride] = useState<string | null>(null);
  const { showToast } = useToast();
  const canvasRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Read ?contribute=1 from URL on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('contribute') === '1') {
      setAllowContributions(true);
    }
  }, []);

  // Detect embed and read ?bg= URL param
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsEmbedded(window.self !== window.top);
    }
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const bg = params.get('bg');
      if (bg && /^#[0-9a-fA-F]{6}$/.test(bg)) {
        setBgColorOverride(bg);
      }
    }
  }, []);

  // Track a session ID for playground users so we can migrate their notes later
  const LOCAL_SESSION_KEY = 'echoes_playground_session';
  const [playgroundSessionId, setPlaygroundSessionId] = useState<string | null>(null);

  useEffect(() => {
    if (!isPlayground || typeof window === 'undefined') return;
    let sid = localStorage.getItem(LOCAL_SESSION_KEY);
    if (!sid) {
      sid = randomUUID();
      localStorage.setItem(LOCAL_SESSION_KEY, sid);
    }
    setPlaygroundSessionId(sid);
  }, [isPlayground]);

  function randomUUID(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  // Handle migration request from PlaygroundInfoCard
  const [migrateOpen, setMigrateOpen] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!migrateOpen) return;
    
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMigrateOpen(false);
        setMigrateTitle('');
      }
    };
    
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [migrateOpen]);

  useEffect(() => {
    if (!isPlayground) return;
    const handler = () => {
      setMigrateOpen(true);
      setTimeout(() => modalRef.current?.focus(), 100);
    };
    window.addEventListener('echoes:migrate-playground', handler);
    return () => window.removeEventListener('echoes:migrate-playground', handler);
  }, [isPlayground]);

  const [migrateTitle, setMigrateTitle] = useState('');
  const [migrating, setMigrating] = useState(false);

  // Load original image dimensions for each note
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const dims: Record<string, { width: number; height: number }> = {};
    notes.forEach((note) => {
      if (note.image_url) {
        const img = new Image();
        img.onload = () => {
          dims[note.id] = { width: img.naturalWidth, height: img.naturalHeight };
          setImageDimensions({ ...dims });
        };
        img.src = note.image_url;
      }
    });
  }, [notes]);

  const handlePointerDown = useCallback((noteId: string, e: React.PointerEvent) => {
    if (editMode) return;
    if (!canvasRef.current) return;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);

    const note = notes.find((n) => n.id === noteId);
    if (!note) return;

    const canvas = canvasRef.current.getBoundingClientRect();
    const pos = notePositions[noteId] || { x: note.x, y: note.y };
    setDragOffset({
      x: e.clientX - (canvas.left + pos.x),
      y: e.clientY - (canvas.top + pos.y),
    });
    setDraggingId(noteId);
  }, [editMode, notes, notePositions]);

  const handlePointerMove = useCallback((e: React.MouseEvent | React.PointerEvent) => {
    if (draggingId && !editMode && canvasRef.current) {
      const canvas = canvasRef.current.getBoundingClientRect();
      const x = e.clientX - canvas.left - dragOffset.x;
      const y = e.clientY - canvas.top - dragOffset.y;
      const note = notes.find((n) => n.id === draggingId);
      const origW = note?.width || 200;
      const origH = note?.height || 150;
      setNotePositions((prev) => {
        const existing = prev[draggingId] || {};
        const sizeW = existing.width ?? origW;
        const sizeH = existing.height ?? origH;
        const maxX = Math.max(0, canvas.width - sizeW);
        const maxY = Math.max(0, canvas.height - sizeH);
        return {
          ...prev,
          [draggingId]: {
            x: Math.max(0, Math.min(x, maxX)),
            y: Math.max(0, Math.min(y, maxY)),
            width: sizeW,
            height: sizeH,
          },
        };
      });
    }
    if (rotatingId && canvasRef.current) {
      const canvas = canvasRef.current.getBoundingClientRect();
      const pos = notePositions[rotatingId];
      if (!pos) return;
      const centerX = canvas.left + pos.x + (pos.width || 200) / 2;
      const centerY = canvas.top + pos.y + (pos.height || 150) / 2;
      const angle = Math.atan2(e.clientX - centerX, -(e.clientY - centerY)) * (180 / Math.PI);
      const newRotation = rotateStartRotation + (angle - rotateStartAngle);
      setNoteRotations((prev) => ({
        ...prev,
        [rotatingId]: Math.round(newRotation * 10) / 10,
      }));
    }
    if (resizingId && canvasRef.current) {
      const dx = e.clientX - resizeData.startX;
      const dy = e.clientY - resizeData.startY;
      const { handle, origX, origY, origW, origH } = resizeData;
      const canvas = canvasRef.current.getBoundingClientRect();
      let newX = origX;
      let newY = origY;
      let newW = origW;
      let newH = origH;

      if (handle.includes('e')) { newW = Math.max(100, origW + dx); }
      if (handle.includes('s')) { newH = Math.max(80, origH + dy); }
      if (handle.includes('w')) {
        newW = Math.max(100, origW - dx);
        newX = origX + origW - newW;
      }
      if (handle.includes('n')) {
        newH = Math.max(80, origH - dy);
        newY = origY + origH - newH;
      }

      newX = Math.max(0, Math.min(newX, canvas.width - newW));
      newY = Math.max(0, Math.min(newY, canvas.height - newH));
      newW = Math.min(newW, canvas.width - newX);
      newH = Math.min(newH, canvas.height - newY);

      setNotePositions((prev) => ({
        ...prev,
        [resizingId]: { x: newX, y: newY, width: newW, height: newH },
      }));
    }
  }, [draggingId, editMode, resizingId, resizeData, dragOffset, rotatingId, rotateStartAngle, rotateStartRotation, notePositions, notes]);

  const persistNoteChanges = useCallback(async () => {
    if (isPlayground) return;

    const changes: Array<{ id: string; x: number; y: number; width: number; height: number; rotation: number }> = [];

    for (const noteId of Object.keys(notePositions)) {
      const note = notes.find((n) => n.id === noteId);
      if (!note) continue;
      const pos = notePositions[noteId];
      const rotation = noteRotations[noteId] || 0;
      const origX = note.x;
      const origY = note.y;
      const origW = note.width;
      const origH = note.height;
      const origRotation = note.rotation || 0;

      if (pos.x !== origX || pos.y !== origY || pos.width !== origW || pos.height !== origH || rotation !== origRotation) {
        changes.push({
          id: noteId,
          x: Math.round(pos.x),
          y: Math.round(pos.y),
          width: Math.round(pos.width || origW),
          height: Math.round(pos.height || origH),
          rotation: Math.round(rotation),
        });
      }
    }

    if (changes.length === 0) return;

    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem(`echoes_edit_token_${wall.slug}`) : '';
      if (!token) return;
      await Promise.all(
        changes.map((change) =>
          fetch(`/api/walls/${wall.slug}/notes/${change.id}`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              'X-Edit-Token': token,
            },
            body: JSON.stringify({
              x: change.x,
              y: change.y,
              width: change.width,
              height: change.height,
              rotation: change.rotation,
            }),
          })
        )
      );
    } catch {
      // Failed to persist — that's ok in edit mode
    }
  }, [isPlayground, notePositions, noteRotations, notes, wall.slug]);

  const handlePointerUp = useCallback(() => {
    if (draggingId || resizingId || rotatingId) {
      persistNoteChanges();
    }
    setDraggingId(null);
    setResizingId(null);
    setRotatingId(null);
  }, [draggingId, resizingId, rotatingId, persistNoteChanges]);

  const handleNotePointerDown = useCallback((noteId: string, e: React.PointerEvent) => {
    if (editMode) {
      e.stopPropagation();
      return;
    }
    handlePointerDown(noteId, e);
  }, [editMode, handlePointerDown]);

  const handleResizeHandleDown = useCallback((noteId: string, handle: string, e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    const pos = notePositions[noteId];
    setResizingId(noteId);
    setResizeData({
      origX: pos.x,
      origY: pos.y,
      origW: pos.width || 200,
      origH: pos.height || 150,
      startX: e.clientX,
      startY: e.clientY,
      handle,
    });
  }, [notePositions]);

  const handleNoteSelect = useCallback((noteId: string, e: React.MouseEvent | React.PointerEvent) => {
    if (editMode) {
      e.stopPropagation();
      setSelectedNoteId(noteId);
    }
  }, [editMode]);

  const handleCanvasClick = useCallback(() => {
    if (editMode) {
      setSelectedNoteId(null);
    }
  }, [editMode]);

  const handleRotateMouseDown = useCallback((noteId: string, e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    if (!canvasRef.current) return;
    const canvas = canvasRef.current.getBoundingClientRect();
    const pos = notePositions[noteId];
    if (!pos) return;
    const centerX = canvas.left + pos.x + (pos.width || 200) / 2;
    const centerY = canvas.top + pos.y + (pos.height || 150) / 2;
    const angle = Math.atan2(e.clientX - centerX, -(e.clientY - centerY)) * (180 / Math.PI);
    setRotatingId(noteId);
    setRotateStartAngle(angle);
    setRotateStartRotation(noteRotations[noteId] || 0);
  }, [notePositions, noteRotations]);

  const handleTitleSave = useCallback(async () => {
    if (isEditingTitle && wallTitle !== (wall.title || wall.theme.charAt(0).toUpperCase() + wall.theme.slice(1))) {
      if (!isPlayground) {
        try {
          const token = typeof window !== 'undefined' ? localStorage.getItem(`echoes_edit_token_${wall.slug}`) : '';
          if (token) {
            await fetch(`/api/walls/${wall.slug}`, {
              method: 'PATCH',
              headers: {
                'Content-Type': 'application/json',
                'X-Edit-Token': token,
              },
              body: JSON.stringify({ title: wallTitle }),
            });
          }
        } catch {
          // Failed to persist title
        }
      }
    }
    setIsEditingTitle(false);
  }, [isEditingTitle, wallTitle, wall.theme, wall.slug, isPlayground]);

  const handleDeleteNote = useCallback(async (noteId: string) => {
    if (isPlayground) return;
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem(`echoes_edit_token_${wall.slug}`) : '';
      if (!token) return;
      await fetch(`/api/walls/${wall.slug}/notes/${noteId}`, {
        method: 'DELETE',
        headers: {
          'X-Edit-Token': token,
        },
      });
      onNoteDelete?.(noteId);
    } catch {
      // Failed to delete
    }
  }, [isPlayground, wall.slug, onNoteDelete]);

  const handleOpenEditor = useCallback((imageUrl: string, themeName: string) => {
    setEditorImage(imageUrl);
    setEditorThemeName(themeName);
    setSidePanelOpen(false);
    setEditorOpen(true);
  }, []);

  const handleSaveNote = useCallback(async (dataUrl: string, authorName: string, noteWidth: number, noteHeight: number) => {
    if (isPlayground && !playgroundSessionId) {
      showToast('Preparing your playground session. Please try again.', 'error');
      return;
    }

    try {
      const token = isPlayground ? 'playground' : (typeof window !== 'undefined' ? localStorage.getItem(`echoes_edit_token_${wall.slug}`) : '');
      const response = await fetch(`/api/walls/${wall.slug}/notes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Edit-Token': token || '',
        },
        body: JSON.stringify({
          image_url: dataUrl,
          x: 50 + Math.random() * 200,
          y: 50 + Math.random() * 150,
          width: noteWidth,
          height: noteHeight,
          rotation: (Math.random() - 0.5) * 6,
          template_id: null,
          author_name: authorName || null,
          author_session_id: isPlayground ? playgroundSessionId : undefined,
        }),
      });

      if (response.ok) {
        setEditorOpen(false);
        setEditorImage('');
        onNoteSaved?.();
        if (!onNoteSaved) {
          window.location.reload();
        }
      }
    } catch {
      // Failed to save
    }
  }, [wall.slug, isPlayground, playgroundSessionId, onNoteSaved, showToast]);

  const handleToggleContributions = useCallback(async (allowed: boolean) => {
    setAllowContributions(allowed);
    if (isPlayground) return;

    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem(`echoes_edit_token_${wall.slug}`) : '';
      if (!token) return;
      await fetch(`/api/walls/${wall.slug}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-Edit-Token': token,
        },
        body: JSON.stringify({ allow_contributions: allowed }),
      });
    } catch {
      // Failed to persist
    }

    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      if (allowed) {
        url.searchParams.set('contribute', '1');
      } else {
        url.searchParams.delete('contribute');
      }
      window.history.replaceState({}, '', url.toString());
    }
  }, [isPlayground, wall.slug]);

  const templateNames = templates.length > 0
    ? templates.map(t => t.name)
    : ['Sticky Note', 'Note Style', 'Heart', 'Polaroid'];

  const getNoteSize = (note: Note, id: string) => {
    const pos = notePositions[id];
    const origDims = imageDimensions[id];
    return {
      width: pos?.width || origDims?.width || note.width || 200,
      height: pos?.height || origDims?.height || note.height || 150,
    };
  };

  const effectiveBgColor = isEmbedded
    ? (bgColorOverride || wall.embed_bg_color || '#ffffff')
    : (wall.embed_bg_color || '#fffef9');

  // Compute canvas height so notes aren't clipped and the wall doesn't overflow the screen unnecessarily
  const canvasMinHeight = Math.max(
    400,
    ...notes.map((note) => {
      const pos = notePositions[note.id];
      const h = pos?.height ?? note.height ?? 150;
      return (pos?.y ?? note.y) + h + 60; // padding
    })
  );

  return (
    <div className="relative min-h-screen">
      {/* Background */}
      <div className="fixed inset-0" style={{ backgroundColor: '#fffef9' }} />
      {isPlayground && <PlaygroundInfoCard />}

      <div className="relative z-10 flex min-h-screen flex-col">
        {/* Top bar */}
        <div className="flex items-center justify-between px-6 py-4">
          <Link href="/" className="text-sm font-medium hover:opacity-70" style={{ color: '#775537' }}>
            ← Back to home
          </Link>
          {!isPlayground && (
            <div className="flex items-center gap-4">
              <Link href="/create" className="text-sm font-medium hover:opacity-70" style={{ color: '#775537' }}>
                + Create Wall
              </Link>
              {hasEditToken && (
                <Link
                  href={`/w/${wall.slug}/settings`}
                  className="text-sm font-medium hover:opacity-70"
                  style={{ color: '#775537' }}
                >
                  ⚙ Settings
                </Link>
              )}
              <button
                onClick={async () => {
                  if (!window.confirm('Are you sure you want to delete this wall? This cannot be undone.')) return;
                  try {
                    const token = typeof window !== 'undefined' ? localStorage.getItem(`echoes_edit_token_${wall.slug}`) : '';
                    if (!token) {
                      showToast('No edit access. You can only view this wall.', 'error');
                      return;
                    }
                    const res = await fetch(`/api/walls/${wall.slug}`, {
                      method: 'DELETE',
                      headers: { 'X-Edit-Token': token },
                    });
                    if (res.ok) {
                      showToast('Wall deleted', 'success');
                      router.push('/');
                    } else {
                      const data = await res.json();
                      showToast(data.error || 'Failed to delete wall', 'error');
                    }
                  } catch {
                    showToast('Failed to delete wall', 'error');
                  }
                }}
                className="text-sm font-medium hover:opacity-70"
                style={{ color: '#dc2626' }}
              >
                Delete Wall
              </button>
            </div>
          )}
        </div>

        <div className="flex-1 flex flex-col items-center justify-center px-4 pt-16 pb-8">
          <div className="mb-8 text-center">
            {isEditingTitle ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={wallTitle}
                  onChange={(e) => setWallTitle(e.target.value)}
                  onBlur={handleTitleSave}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleTitleSave();
                  }}
                  className="text-4xl font-bold text-center border-b-2 bg-transparent outline-none border-slate-300 text-slate-900"
                  autoFocus
                />
              </div>
            ) : (
              <div className="flex items-center justify-center gap-2">
                <h1
                  className="text-4xl font-bold cursor-pointer hover:opacity-70 text-slate-900"
                  onClick={() => setIsEditingTitle(true)}
                >
                  {wallTitle}
                </h1>
                <button
                  onClick={() => setIsEditingTitle(true)}
                  className="transition-colors text-slate-500 hover:text-slate-800"
                  title="Edit title"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                  </svg>
                </button>
              </div>
            )}
            {isPlayground && (
              <p className="mt-2 text-sm text-slate-400 italic" style={{ color: '#c0ddda' }}>
                {editMode ? 'Drag the blue handles to resize notes' : 'A space for your thoughts'}
              </p>
            )}
          </div>

          <div className="relative w-full max-w-7xl">
            {/* Top right controls */}
            {(isPlayground || notes.length > 0) && (
              <div className="absolute right-0 z-30 flex flex-col gap-2" style={{ transform: 'translateX(calc(100% + 12px))', top: 0 }}>
                {notes.length > 0 && (
                  <button
                    onClick={() => {
                      setEditMode(!editMode);
                      setSelectedNoteId(null);
                    }}
                    className="rounded-lg p-2 text-white"
                    style={{
                      backgroundColor: editMode ? '#4b5563' : '#775537',
                      boxShadow: '0 3px 0 #5a3f2a, 0 4px 8px rgba(119,85,55,0.2)',
                    }}
                    title={editMode ? 'Done Resizing' : 'Resize Notes'}
                  >
                    {editMode ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                      </svg>
                    )}
                  </button>
                )}
                <button
                  disabled={isPlayground}
                  onClick={() => {
                    if (!isPlayground) setSharePanelOpen(true);
                  }}
                  className="rounded-lg p-2 text-white"
                  style={{
                    backgroundColor: '#775537',
                    boxShadow: isPlayground
                      ? '0 3px 0 #5a3f2a'
                      : '0 3px 0 #5a3f2a, 0 4px 8px rgba(119,85,55,0.2)',
                    opacity: isPlayground ? 0.45 : 1,
                    cursor: isPlayground ? 'not-allowed' : 'pointer',
                  }}
                  title={isPlayground ? 'Create your own wall to share' : 'Share'}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                  </svg>
                </button>
                {isPlayground && (
                  <Link
                    href="/create"
                    className="rounded-lg p-2 text-white"
                    style={{
                      backgroundColor: '#775537',
                      boxShadow: '0 3px 0 #5a3f2a, 0 4px 8px rgba(119,85,55,0.2)',
                      textDecoration: 'none',
                    }}
                    title="Create My Wall"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </Link>
                )}
              </div>
            )}

            <div
              ref={canvasRef}
              className="relative flex-1 w-full rounded-2xl backdrop-blur-sm"
              style={{
                backgroundColor: effectiveBgColor,
                backgroundImage: 'radial-gradient(circle, rgba(139, 106, 74, 0.15) 1px, transparent 1px)',
                backgroundSize: '20px 20px',
                border: '1px solid rgba(119,85,55,0.15)',
                boxShadow: '0 0 0 1px rgba(119,85,55,0.08), 0 8px 32px rgba(119,85,55,0.12)',
                minHeight: `${canvasMinHeight}px`,
              }}
              onClick={handleCanvasClick}
              onMouseMove={handlePointerMove}
              onMouseUp={handlePointerUp}
              onMouseLeave={handlePointerUp}
              onTouchMove={(e) => {
                if (e.touches.length === 1) {
                  const touch = e.touches[0];
                  handlePointerMove({ clientX: touch.clientX, clientY: touch.clientY } as React.MouseEvent);
                }
              }}
              onTouchEnd={handlePointerUp}
            >
              {notes.length === 0 ? (
                <div className="flex absolute inset-0 items-center justify-center">
                  <div className="text-center">
                    <p className="text-lg text-slate-400">
                      No notes yet on this wall.
                    </p>
                    {!isPlayground && (
                      <button
                        onClick={() => setSidePanelOpen(true)}
                        className="mt-4 inline-block rounded-lg px-4 py-2 text-sm font-medium select-none transition-all duration-150"
                        style={{
                          backgroundColor: '#fbe29d',
                          color: '#775537',
                          boxShadow: '0 5px 0 #775537, 0 6px 12px rgba(119,85,55,0.2)',
                          transform: 'translateY(0)',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = 'translateY(-1px)';
                          e.currentTarget.style.boxShadow = '0 6px 0 #775537, 0 8px 16px rgba(119,85,55,0.25)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = 'translateY(0)';
                          e.currentTarget.style.boxShadow = '0 5px 0 #775537, 0 6px 12px rgba(119,85,55,0.2)';
                        }}
                        onMouseDown={(e) => {
                          e.currentTarget.style.transform = 'translateY(3px)';
                          e.currentTarget.style.boxShadow = '0 2px 0 #775537, 0 2px 4px rgba(119,85,55,0.2)';
                        }}
                        onMouseUp={(e) => {
                          e.currentTarget.style.transform = 'translateY(0)';
                          e.currentTarget.style.boxShadow = '0 5px 0 #775537, 0 6px 12px rgba(119,85,55,0.2)';
                        }}
                      >
                        Add the first note
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                [...notes].sort((a, b) => {
                  if (selectedNoteId === b.id) return 1;
                  if (selectedNoteId === a.id) return -1;
                  return 0;
                }).map((note) => {
                  const pos = notePositions[note.id] || { x: note.x, y: note.y };
                  const size = getNoteSize(note, note.id);
                  return (
                    <div
                      key={note.id}
                      className={`absolute ${
                        editMode ? 'cursor-move' : 'cursor-grab active:cursor-grabbing'
                      }`}
                      style={{
                        left: pos.x,
                        top: pos.y,
                        width: size.width,
                        height: size.height,
                        transform: `rotate(${noteRotations[note.id] || note.rotation || 0}deg)`,
                        zIndex: draggingId === note.id ? 50 : (editMode && selectedNoteId === note.id) ? 50 : 1,
                        opacity: draggingId && draggingId !== note.id ? 0.7 : 1,
                        pointerEvents: editMode ? 'auto' : undefined,
                      }}
                      onClick={(e) => {
                        if (editMode) {
                          handleNoteSelect(note.id, e);
                        }
                      }}
                      onPointerDown={(e) => {
                        if (editMode) {
                          e.stopPropagation();
                          return;
                        }
                        handleNotePointerDown(note.id, e as unknown as React.PointerEvent);
                      }}
                    >
                      <div className={`h-full w-full ${editMode && selectedNoteId === note.id ? 'ring-2 ring-blue-500 rounded-lg' : ''}`}>
                        {note.image_url ? (
                          <img
                            src={note.image_url}
                            alt="Note"
                            className="h-full w-full pointer-events-none"
                            draggable={false}
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center p-4">
                            {isPlayground ? (
                              <div className="text-center">
                                <p className="text-sm text-slate-400 font-medium">
                                  Tap to write...
                                </p>
                              </div>
                            ) : (
                              <p className="text-sm text-slate-600">Empty note</p>
                            )}
                          </div>
                        )}
                      </div>
                      {/* Rotate handle (edit mode only) */}
                      {editMode && (
                        <div
                          className="absolute z-20 flex items-center justify-center cursor-grab"
                          style={{
                            top: -28,
                            left: '50%',
                            transform: 'translateX(-50%)',
                          }}
                          onPointerDown={(e) => handleRotateMouseDown(note.id, e)}
                        >
                          <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                          <div className="absolute top-1/2 left-1/2 w-0.5 h-6 bg-blue-400" style={{ transform: 'translate(-50%, -50%)' }} />
                        </div>
                      )}
                      {/* Delete button (edit mode only, not in playground) */}
                      {editMode && !isPlayground && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (window.confirm('Delete this note?')) {
                              handleDeleteNote(note.id);
                            }
                          }}
                          className="absolute z-20 p-1 rounded-full transition-colors hover:bg-red-100"
                          style={{
                            top: -12,
                            right: -12,
                          }}
                          title="Delete note"
                        >
                          <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )}
                      {/* Resize handles (edit mode only, selected note only) */}
                      {editMode && selectedNoteId === note.id && RESIZE_HANDLES.map((handle) => {
                        const handleStyles: Record<string, string> = {
                          nw: 'top-0 left-0 cursor-nw-resize',
                          n: 'top-0 left-1/2 -translate-x-1/2 cursor-n-resize',
                          ne: 'top-0 right-0 cursor-ne-resize',
                          w: 'top-1/2 left-0 -translate-y-1/2 cursor-w-resize',
                          e: 'top-1/2 right-0 -translate-y-1/2 cursor-e-resize',
                          sw: 'bottom-0 left-0 cursor-sw-resize',
                          s: 'bottom-0 left-1/2 -translate-x-1/2 cursor-s-resize',
                          se: 'bottom-0 right-0 cursor-se-resize',
                        };
                        return (
                          <div
                            key={handle}
                            className={`absolute w-4 h-4 bg-white border-2 border-blue-500 rounded-full ${handleStyles[handle]}`}
                            style={{
                              transform: handle.includes('n') && handle.includes('w') ? 'translate(-50%, -50%)' :
                                        handle.includes('n') && handle.includes('e') ? 'translate(50%, -50%)' :
                                        handle.includes('s') && handle.includes('w') ? 'translate(-50%, 50%)' :
                                        handle.includes('s') && handle.includes('e') ? 'translate(50%, 50%)' :
                                        handle.includes('n') || handle.includes('s') ? 'translate(-50%, 0)' :
                                        'translate(0, -50%)',
                            }}
                            onPointerDown={(e) => handleResizeHandleDown(note.id, handle, e)}
                          />
                        );
                      })}
                    </div>
                  );
                })
              )}
            </div>

            {/* Playground hint text */}
            {isPlayground && notes.length > 0 && !editMode && (
              <div className="text-center mt-2 text-xs text-slate-400">
                Drag notes around to arrange them
              </div>
            )}
          </div>
        </div>

        {/* Side panel toggle button - only show when in contribute mode */}
        {allowContributions && (
          <button
            onClick={() => setSidePanelOpen(!sidePanelOpen)}
            className="fixed right-0 top-1/2 -translate-y-1/2 z-40 rounded-l-lg p-3 text-white shadow-lg"
            style={{
              backgroundColor: '#775537',
              boxShadow: '-3px 0 0 #5a3f2a, 0 4px 8px rgba(119,85,55,0.2)',
            }}
            title={sidePanelOpen ? 'Close toolbar' : 'Open toolbar'}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {sidePanelOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              )}
            </svg>
          </button>
        )}

        {/* Side panel */}
        <div
          className="fixed right-0 top-0 h-full z-30 transition-transform duration-300 ease-in-out shadow-2xl"
          style={{
            transform: sidePanelOpen ? 'translateX(0)' : 'translateX(100%)',
            width: '280px',
            backgroundColor: '#8b6a4a',
            borderLeft: '1px solid rgba(119,85,55,0.3)',
          }}
        >
          <div className="flex flex-col h-full p-4 pt-20">
            <h3 className="text-sm font-semibold text-white/90 mb-4">Notepad Styles</h3>

            {/* Theme dropdown */}
            <div className="relative mb-4" ref={dropdownRef}>
              <button
                onClick={() => setShowTemplateDropdown(!showTemplateDropdown)}
                className="w-full rounded-lg px-4 py-2.5 text-sm font-semibold text-left select-none transition-all"
                style={{
                  backgroundColor: '#FBE29D',
                  color: '#775537',
                  boxShadow: '0 3px 0 #5a3f2a',
                }}
              >
                <span className="flex items-center justify-between">
                  <span>{templateNames[selectedTemplate]}</span>
                  <span className="text-xs">▾</span>
                </span>
              </button>
              {showTemplateDropdown && (
                <div className="absolute top-full left-0 right-0 mt-2 rounded-lg border-2 border-amber-200 shadow-xl bg-white max-h-60 overflow-y-auto z-50">
                  {templateNames.map((name, index) => (
                    <button
                      key={name}
                      onClick={() => {
                        setSelectedTemplate(templateNames.indexOf(name));
                        setShowTemplateDropdown(false);
                      }}
                      className={`block w-full px-4 py-2.5 text-left text-sm font-medium transition-colors ${
                        index === selectedTemplate
                          ? 'bg-amber-50 text-amber-900'
                          : 'text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Scrollable notepad thumbnails */}
            <div className="flex flex-col gap-3 overflow-y-auto flex-1 pr-1 custom-scrollbar">
              {(THEME_IMAGES[templateNames[selectedTemplate]] || []).map((img, index) => (
                <img
                  key={index}
                  src={img}
                  alt={`Pad ${index + 1}`}
                  className="w-full cursor-pointer transition-all duration-200 hover:scale-105 rounded-lg shadow-sm hover:shadow-md"
                  style={{ maxHeight: '180px', objectFit: 'contain' }}
                  onClick={() => handleOpenEditor(img, templateNames[selectedTemplate])}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Share Panel */}
      {sharePanelOpen && (
        <SharePanel
          wallSlug={wall.slug}
          wallTheme={wall.theme}
          allowContributions={allowContributions}
          onClose={() => setSharePanelOpen(false)}
          onToggleContributions={handleToggleContributions}
        />
      )}

      {/* Editor Modal */}
      {editorOpen && (
        <NotepadEditor
          imageUrl={editorImage}
          themeName={editorThemeName}
          onClose={() => {
            setEditorOpen(false);
            setSidePanelOpen(false);
          }}
          onSave={(dataUrl: string, authorName: string, noteWidth: number, noteHeight: number) => {
            handleSaveNote(dataUrl, authorName, noteWidth, noteHeight);
          }}
        />
      )}

      {/* Migration Modal */}
      {isPlayground && migrateOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="migration-dialog-title"
          style={{
            position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60
          }}
        >
        <div
          ref={modalRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="migration-dialog-title"
          tabIndex={-1}
          style={{
            backgroundColor: '#ffffff', padding: 24, borderRadius: 12,
            width: 400, maxWidth: '90vw', boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
            outline: 'none',
          }}
        >
          <h3 id="migration-dialog-title" style={{ color: '#775537', fontFamily: "'Patrick Hand', cursive", fontSize: 22, marginTop: 0, marginBottom: 8 }}>
            Keep your notes
          </h3>
            <p style={{ color: '#475569', fontSize: 14, marginBottom: 16 }}>
              We'll create a permanent wall for you with the same notes. You'll get an edit link to manage it.
            </p>
            <label style={{ display: 'block', color: '#775537', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
              Wall title <span style={{ color: '#dc2626' }}>*</span>
            </label>
            <input
              type="text"
              value={migrateTitle}
              onChange={(e) => setMigrateTitle(e.target.value)}
              maxLength={100}
              placeholder="e.g. My Community Wall"
              autoFocus
              style={{
                width: '100%', padding: '8px 12px', fontSize: 14,
                border: '2px solid #c4a77d', borderRadius: 8, boxSizing: 'border-box',
                outline: 'none', color: '#775537',
                fontFamily: "'Patrick Hand', cursive",
              }}
            />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
              <button
                disabled={migrating}
                onClick={() => { setMigrateOpen(false); setMigrateTitle(''); }}
                style={{
                  padding: '8px 16px', backgroundColor: 'transparent',
                  border: '1px solid #c4a77d', color: '#775537',
                  borderRadius: 8, cursor: migrating ? 'not-allowed' : 'pointer',
                  fontFamily: "'Patrick Hand', cursive",
                }}
              >
                Cancel
              </button>
              <button
                disabled={migrating || !migrateTitle.trim()}
                onClick={async () => {
                  if (!playgroundSessionId) {
                    showToast('No session found. Please refresh and try again.', 'error');
                    return;
                  }
                  setMigrating(true);
                  try {
                    const res = await fetch('/api/walls/playground/migrate', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ title: migrateTitle, session_id: playgroundSessionId }),
                    });
                    const data = await res.json();
                    if (!res.ok) {
                      showToast(data.error || 'Failed to migrate notes', 'error');
                    } else {
                      localStorage.setItem(`echoes_edit_token_${data.slug}`, data.editToken);
                      showToast(`Wall created with ${data.notesCount} note(s)! Redirecting...`, 'success');
                      setTimeout(() => {
                        window.location.href = `/w/${data.slug}`;
                      }, 1200);
                      setMigrateOpen(false);
                    }
                  } catch {
                    showToast('Network error. Please try again.', 'error');
                  } finally {
                    setMigrating(false);
                  }
                }}
                style={{
                  padding: '8px 16px', backgroundColor: '#775537', color: '#FBE29D',
                  border: 'none', borderRadius: 8, fontWeight: 600,
                  cursor: migrating || !migrateTitle.trim() ? 'not-allowed' : 'pointer',
                  opacity: migrating ? 0.7 : 1,
                  fontFamily: "'Patrick Hand', cursive",
                }}
              >
                {migrating ? 'Creating...' : 'Create permanent wall'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}