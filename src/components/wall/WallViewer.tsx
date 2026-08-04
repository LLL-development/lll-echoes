'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import type { Note, NoteTemplate } from '@/types';
import { THEME_IMAGES } from '@/lib/themes';
import SharePanel from './SharePanel';
import NotepadEditor from './NotepadEditor';
import PlaygroundInfoCard from './PlaygroundInfoCard';
import { useToast } from '@/components/toast/ToastProvider';
import NextImage from 'next/image';
import LocaleSwitcher from '@/components/common/LocaleSwitcher';

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

function TimestampDisplay({ date }: { date: string | null | undefined }) {
  if (!date) return null;
  const ts = new Date(date);
  const diff = Date.now() - ts.getTime();
  const mins = Math.floor(diff / 60000);
  let label = 'just now';
  if (mins >= 1 && mins < 60) label = `${mins}m ago`;
  else if (mins >= 60 && mins < 1440) label = `${Math.floor(mins / 60)}h ago`;
  else if (mins >= 1440 && mins < 10080) label = `${Math.floor(mins / 1440)}d ago`;
  else if (mins >= 10080 && mins < 20160) label = '1w ago';
  else if (mins >= 20160) label = `${Math.floor(mins / 10080)}w ago`;
  return <div className="mt-0.5 text-[10px] text-slate-400">{label}</div>;
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
  const t = useTranslations();
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
  const hasShownSeededNoteHintRef = useRef(false);

  // Mobile detection
  const [isMobile, setIsMobile] = useState(false);
  const [isPortrait, setIsPortrait] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      setIsPortrait(mobile && window.innerHeight > window.innerWidth);
    };
    checkMobile();
    const onResize = () => checkMobile();
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  }, []);

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
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture?.(e.pointerId);

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
    const changes = [];
    for (const noteId of Object.keys(notePositions)) {
      const note = notes.find((n) => n.id === noteId);
      if (!note) continue;

      if (isPlayground && !note.author_session_id) {
        if (!hasShownSeededNoteHintRef.current) {
          hasShownSeededNoteHintRef.current = true;
          showToast(
            t('toast.seededNotesInfo'),
            'info'
          );
        }
        continue;
      }

      const pos = notePositions[noteId];
      const rotation = noteRotations[noteId] || 0;
      const origX = note.x;
      const origY = note.y;
      const origW = note.width;
      const origH = note.height;
      const origRotation = note.rotation || 0;

      if (
        pos.x !== origX ||
        pos.y !== origY ||
        pos.width !== origW ||
        pos.height !== origH ||
        rotation !== origRotation
      ) {
        changes.push({
          id: noteId,
          x: Math.round(pos.x),
          y: Math.round(pos.y),
          width: Math.round(pos.width ?? origW),
          height: Math.round(pos.height ?? origH),
          rotation: Math.round(rotation),
        });
      }
    }

    if (changes.length === 0) return;

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (isPlayground) {
      if (!playgroundSessionId) return;
      headers['X-Playground-Session-Id'] = playgroundSessionId;
    } else {
      const token = typeof window !== 'undefined' ? localStorage.getItem(`echoes_edit_token_${wall.slug}`) : '';
      if (!token) return;
      headers['X-Edit-Token'] = token;
    }

    try {
      const results = await Promise.all(
        changes.map((change) =>
          fetch(`/api/walls/${wall.slug}/notes/${change.id}`, {
            method: 'PATCH',
            headers,
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

      for (const res of results) {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          showToast(data.error || t('toast.saveChangesFailed'), 'error');
          break;
        }
      }
    } catch {
      showToast(t('toast.saveChangesFailed'), 'error');
    }
  }, [isPlayground, notePositions, noteRotations, notes, wall.slug, playgroundSessionId, showToast]);

  const handlePointerUp = useCallback((e?: React.PointerEvent | React.MouseEvent) => {
    if (draggingId) {
      const noteEl = canvasRef.current?.querySelector(`[data-note-id="${draggingId}"]`) as HTMLElement;
      if (e && 'pointerId' in e) {
        noteEl?.releasePointerCapture?.(e.pointerId);
      }
    }
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
    e.stopPropagation();
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

  const handleDeleteNote = useCallback(async (noteId: string) => {
    try {
      let headers: Record<string, string> = {};
      if (isPlayground) {
        if (!playgroundSessionId) {
          showToast(t('toast.noDeleteAccess'), 'error');
          return;
        }
        headers['X-Playground-Session-Id'] = playgroundSessionId;
      } else {
        const token = typeof window !== 'undefined' ? localStorage.getItem(`echoes_edit_token_${wall.slug}`) : '';
        if (!token) {
          showToast(t('toast.noEditAccess'), 'error');
          return;
        }
        headers['X-Edit-Token'] = token;
      }

      const response = await fetch(`/api/walls/${wall.slug}/notes/${noteId}`, {
        method: 'DELETE',
        headers,
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        showToast(data.error || t('toast.deleteNoteFailed'), 'error');
        return;
      }

      if (onNoteDelete) {
        onNoteDelete(noteId);
      } else {
        window.location.reload();
      }
    } catch {
      showToast(t('toast.deleteNoteFailed'), 'error');
    }
  }, [isPlayground, wall.slug, onNoteDelete, playgroundSessionId, showToast]);

  const handleOpenEditor = useCallback((imageUrl: string, themeName: string) => {
    setEditorImage(imageUrl);
    setEditorThemeName(themeName);
    setSidePanelOpen(false);
    setEditorOpen(true);
  }, []);

  const handleSaveNote = useCallback(async (dataUrl: string, authorName: string, noteWidth: number, noteHeight: number) => {
    if (isPlayground && !playgroundSessionId) {
      showToast(t('toast.playgroundRefreshing'), 'error');
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

  return (
    <>
      {/* Rotation notification - top level for proper fixed positioning */}
      {isPortrait === true && (
        <div className="fixed inset-0 z-[9999] pointer-events-none flex items-center justify-center">
          <div 
            className="pointer-events-auto animate-bounce"
            style={{
              backgroundColor: 'rgba(30, 30, 30, 0.95)',
              color: '#fff',
              padding: '1rem 2rem',
              borderRadius: '2rem',
              fontSize: '1rem',
              fontWeight: 600,
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
            }}
          >
            <span style={{ fontSize: '1.5rem' }}>📱</span>
            <span>{t('hint.rotateDevice')}</span>
          </div>
        </div>
      )}
      <div className="relative min-h-screen">
      {/* Background */}
      <div className="fixed inset-0" style={{ backgroundColor: '#fffef9' }} />
      
      {isPlayground && (
        <>
          <NextImage
            src="/logo.webp"
            alt="Logo"
            className="absolute z-20"
            width={100}
            height={100}
            style={{
              top: '24px',
              left: '24px',
              width: '100px',
              height: 'auto'
            }}
          />
          <div className="absolute z-20" style={{ top: '24px', right: '24px' }}>
            <LocaleSwitcher />
          </div>
          <PlaygroundInfoCard />
        </>
      )}

      <div className="relative z-10 flex min-h-screen flex-col">
        {/* Top bar */}
        {!isEmbedded && (
          <div className="flex items-center justify-between px-4 md:px-6 py-3 md:py-4">
            {!isPlayground && (
                <Link href="/" className="text-sm font-medium hover:opacity-70" style={{ color: '#775537' }}>
                {t('nav.backToHome')}
              </Link>
            )}
            {!isPlayground && (
              <div className="flex items-center gap-2 md:gap-4">
                <LocaleSwitcher />
                {hasEditToken && (
                  <Link
                    href={`/w/${wall.slug}/settings`}
                    className="text-sm font-medium hover:opacity-70"
                    style={{ color: '#775537' }}
                    >
                    {t('nav.settings')}
                  </Link>
                )}
                <button
                  onClick={async () => {
                    if (!window.confirm(t('confirm.deleteWall'))) return;
                    try {
                      const token = typeof window !== 'undefined' ? localStorage.getItem(`echoes_edit_token_${wall.slug}`) : '';
                      if (!token) {
            showToast(t('toast.noEditAccess'), 'error');
                        return;
                      }
                      const res = await fetch(`/api/walls/${wall.slug}`, {
                        method: 'DELETE',
                        headers: { 'X-Edit-Token': token },
                      });
                      if (res.ok) {
                        showToast(t('toast.wallDeleted'), 'success');
                        router.push('/');
                      } else {
                        const data = await res.json();
                        showToast(data.error || t('toast.deleteWallFailed'), 'error');
                      }
                    } catch {
                      showToast(t('toast.deleteWallFailed'), 'error');
                    }
                  }}
                  className="text-sm font-medium hover:opacity-70"
                  style={{ color: '#dc2626' }}
                >
                  {t('nav.deleteWall')}
                </button>
              </div>
            )}
          </div>
        )}

        <div className="flex-1 flex flex-col items-center justify-start px-4 pt-16 pb-8 overflow-x-hidden">
          <div className="mb-8 text-center">
            <h1 className="text-4xl font-bold text-slate-900">
              {wallTitle}
            </h1>
            {isPlayground && (
              <p className="mt-2 text-sm text-slate-400 italic" style={{ color: '#c0ddda' }}>
                {editMode ? t('canvas.editModeHint') : t('canvas.subtitleDefault')}
              </p>
            )}
          </div>

          <div className="relative w-full max-w-7xl overflow-x-auto">
            {/* Top right controls - desktop only */}
            {(isPlayground || notes.length > 0) && (
              <>
                {/* Desktop: right side positioning */}
                <div
                  className="hidden md:flex fixed z-30 flex-col gap-2"
                  style={{ left: 'calc(50% + 656px)', top: '12rem' }}
                >
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
                      title={editMode ? t('note.resizeDone') : t('note.resize')}
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
                    title={isPlayground ? t('share.playgroundButton') : t('share.button')}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                    </svg>
                  </button>
                </div>
              </>
            )}

            <div
              ref={canvasRef}
              className="relative flex-1 w-full rounded-2xl backdrop-blur-sm touch-none select-none"
              style={{
                backgroundColor: effectiveBgColor,
                backgroundImage: 'radial-gradient(circle, rgba(139, 106, 74, 0.15) 1px, transparent 1px)',
                backgroundSize: '20px 20px',
                border: '1px solid rgba(119,85,55,0.15)',
                boxShadow: '0 0 0 1px rgba(119,85,55,0.08), 0 8px 32px rgba(119,85,55,0.12)',
                height: isMobile ? 'calc(100vh - 200px)' : 'min(600px, calc(100dvh - 12rem))',
                minWidth: isMobile ? '800px' : undefined,
                overflow: isMobile ? 'auto' : 'hidden',
              }}
              onClick={handleCanvasClick}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerLeave={handlePointerUp}
            >
              {notes.length === 0 ? (
                <div className="flex absolute inset-0 items-center justify-center">
                  <div className="text-center">
                    <p className="text-lg text-slate-400">
                      {t('canvas.empty')}
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
                        {t('canvas.addFirst')}
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
                      data-note-id={note.id}
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
                        e.stopPropagation();
                        handleNotePointerDown(note.id, e);
                      }}
                    >
                      <div className={`h-full w-full ${editMode && selectedNoteId === note.id ? 'ring-2 ring-blue-500 rounded-lg' : ''}`}>
                        {note.image_url ? (
                          <>
                            <img
                              src={note.image_url}
                              alt="Note"
                              className="absolute inset-0 h-full w-full pointer-events-none"
                              draggable={false}
                            />
                            {note.content && (
                              <div className="relative flex h-full flex-col items-center justify-center p-4">
                                <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap break-words text-center">
                                  {note.content}
                                </p>
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="flex h-full items-center justify-center p-4">
                            {isPlayground ? (
                              <div className="text-center">
                                <p className="text-sm text-slate-400 font-medium">
                                  {t('note.tapToWrite')}
                                </p>
                              </div>
                            ) : (
                              <p className="text-sm text-slate-600">{t('note.empty')}</p>
                            )}
                          </div>
                        )}
                      </div>
                      {/* Rotate handle (edit mode only) */}
                      {editMode && (!isPlayground || note.author_session_id === playgroundSessionId) && (
                        <div
                          className={`absolute z-20 flex items-center justify-center cursor-grab ${
                            isMobile ? 'top-[-36px]' : 'top-[-28px]'
                          }`}
                          style={{
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
                      {editMode && (!isPlayground || note.author_session_id === playgroundSessionId) && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (window.confirm(t('note.confirmDelete'))) {
                              handleDeleteNote(note.id);
                            }
                          }}
                          className={`absolute z-20 rounded-full transition-colors hover:bg-red-100 ${
                            isMobile ? 'p-2' : 'p-1'
                          }`}
                          style={{
                            top: isMobile ? -16 : -12,
                            right: isMobile ? -16 : -12,
                          }}
                          title={t('note.delete')}
                        >
                          <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )}
                      {/* Resize handles (edit mode only, selected note only) */}
                      {editMode && (!isPlayground || note.author_session_id === playgroundSessionId) && selectedNoteId === note.id && RESIZE_HANDLES.map((handle) => {
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
                            className={`absolute bg-white border-2 border-blue-500 rounded-full ${
                              isMobile ? 'w-5 h-5' : 'w-4 h-4'
                            } ${handleStyles[handle]}`}
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
                      {/* Author + timestamp overlay at bottom-right of the note */}
                      {(note.author_name || note.created_at) && (
                        <div className="absolute bottom-0.4 right-2 text-right z-10 pointer-events-none">
                          {note.author_name && (
                            <p className="text-xs italic leading-tight" style={{ color: '#5a6f8d' }}>
                              — {note.author_name}
                            </p>
                          )}
                          {note.created_at && <TimestampDisplay date={note.created_at} />}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Mobile: Share & Resize buttons below canvas */}
            {(isPlayground || notes.length > 0) && (
              <div className="flex md:hidden justify-center gap-3 mt-4">
                {notes.length > 0 && (
                  <button
                    onClick={() => {
                      setEditMode(!editMode);
                      setSelectedNoteId(null);
                    }}
                    className="rounded-lg px-4 py-2.5 text-white flex items-center gap-2"
                    style={{
                      backgroundColor: editMode ? '#4b5563' : '#775537',
                      boxShadow: '0 3px 0 #5a3f2a, 0 4px 8px rgba(119,85,55,0.2)',
                    }}
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
                    <span className="text-sm font-medium">
                      {editMode ? t('note.resizeDone') : t('note.resize')}
                    </span>
                  </button>
                )}
                <button
                  disabled={isPlayground}
                  onClick={() => {
                    if (!isPlayground) setSharePanelOpen(true);
                  }}
                  className="rounded-lg px-4 py-2.5 text-white flex items-center gap-2"
                  style={{
                    backgroundColor: '#775537',
                    opacity: isPlayground ? 0.45 : 1,
                    cursor: isPlayground ? 'not-allowed' : 'pointer',
                  }}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                  </svg>
                  <span className="text-sm font-medium">{t('share.button')}</span>
                </button>
              </div>
            )}

            {/* Create My Board button */}
            {isPlayground && (
              <div className="flex justify-center mt-6">
                <Link
                  href="/create"
                  className="rounded-xl px-12 py-3.5 font-bold text-lg rounded-lg border-2 inline-block"
                  style={{
                    backgroundColor: '#FBE29D',
                    color: '#775537',
                    border: '2px solid #775537',
                    boxShadow: '0 5px 0 #775537, 0 6px 12px rgba(119,85,55,0.2)',
                    textDecoration: 'none',
                    transition: 'transform 0.1s ease, boxShadow 0.1s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.boxShadow = '0 6px 0 #775537';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 5px 0 #775537';
                  }}
                  onMouseDown={(e) => {
                    e.currentTarget.style.transform = 'translateY(2px)';
                    e.currentTarget.style.boxShadow = '0 3px 0 #775537';
                  }}
                  onMouseUp={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 5px 0 #775537';
                  }}
                >
                  {t('playground.cta')}
                </Link>
              </div>
            )}

            {/* Playground hint text */}
            {isPlayground && notes.length > 0 && !editMode && (
              <div className="text-center mt-2 text-xs text-slate-400">
                {t('canvas.editModeHint')}
              </div>
            )}
          </div>
        </div>

        {/* Side panel toggle button - only show when in contribute mode */}
        {allowContributions && (
          <button
            onClick={() => setSidePanelOpen(!sidePanelOpen)}
            className={`fixed right-0 top-1/2 -translate-y-1/2 z-40 rounded-l-lg text-white shadow-lg ${
              isMobile ? 'p-4' : 'p-3'
            }`}
            style={{
              backgroundColor: '#775537',
              boxShadow: '-3px 0 0 #5a3f2a, 0 4px 8px rgba(119,85,55,0.2)',
            }}
            title={sidePanelOpen ? t('toolbar.close') : t('toolbar.open')}
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
            width: isMobile ? '100%' : '280px',
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
          wallTitle={wall.title || wall.theme.charAt(0).toUpperCase() + wall.theme.slice(1)}
          allowContributions={allowContributions}
          onClose={() => setSharePanelOpen(false)}
          onToggleContributions={handleToggleContributions}
          notes={notes}
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
          onSave={async (dataUrl: string, authorName: string, noteWidth: number, noteHeight: number) => {
            await handleSaveNote(dataUrl, authorName, noteWidth, noteHeight);
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
            {t('migrate.title')}
          </h3>
            <p style={{ color: '#475569', fontSize: 14, marginBottom: 16 }}>
              {t('migrate.description')}
            </p>
            <label style={{ display: 'block', color: '#775537', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
              {t('migrate.wallTitle')} <span style={{ color: '#dc2626' }}>*</span>
            </label>
            <input
              type="text"
              value={migrateTitle}
              onChange={(e) => setMigrateTitle(e.target.value)}
              maxLength={100}
              placeholder={t('migrate.placeholder')}
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
                {t('migrate.cancel')}
              </button>
              <button
                disabled={migrating || !migrateTitle.trim()}
                onClick={async () => {
                  if (!playgroundSessionId) {
                    showToast(t('toast.noSessionFound'), 'error');
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
                      showToast(data.error || t('toast.migrateFailed'), 'error');
                    } else {
                      localStorage.setItem(`echoes_edit_token_${data.slug}`, data.editToken);
                      showToast(t('toast.wallCreated', { count: data.notesCount }), 'success');
                      setTimeout(() => {
                        window.location.href = `/w/${data.slug}`;
                      }, 1200);
                      setMigrateOpen(false);
                    }
                  } catch {
                    showToast(t('toast.networkError'), 'error');
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
                {migrating ? t('migrate.creating') : t('migrate.createWall')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  );
}