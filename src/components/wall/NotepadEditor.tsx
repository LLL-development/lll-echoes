'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import html2canvas from 'html2canvas';
import { useToast } from '@/components/toast/ToastProvider';

interface NotepadEditorProps {
  imageUrl: string;
  themeName: string;
  onClose: () => void;
  onSave: (dataUrl: string, authorName: string, width: number, height: number) => void;
  initialAuthorName?: string;
}

interface PenStroke {
  points: { x: number; y: number }[];
  color: string;
  width: number;
  isEraser: boolean;
}

interface OverlayItem {
  id: string;
  type: 'text' | 'image' | 'pen';
  x: number;
  y: number;
  width: number;
  height: number;
  content: string;
  fontSize: number;
  fontFamily: string;
  color: string;
  textAlign: 'left' | 'center' | 'right';
  bold: boolean;
  italic: boolean;
  strokes?: PenStroke[];
}

const TEXT_COLORS = ['#ffffff', '#f4eebf', '#ffd0db', '#e5e5e5', '#004686', '#a20000', '#582c05', '#000000'];
const FONT_SIZES = [12, 14, 16, 18, 20, 24];
const PEN_WIDTHS = [2, 4, 6, 8];

export default function NotepadEditor({ imageUrl, themeName, onClose, onSave, initialAuthorName = '' }: NotepadEditorProps) {
  const { showToast } = useToast();
  const [overlays, setOverlays] = useState<OverlayItem[]>([]);
  const [activeOverlay, setActiveOverlay] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isTextEditing, setIsTextEditing] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [penColor, setPenColor] = useState('#000000');
  const [penWidth, setPenWidth] = useState(4);
  const [isEraser, setIsEraser] = useState(false);
  const [currentStroke, setCurrentStroke] = useState<PenStroke | null>(null);
  const [authorName, setAuthorName] = useState(initialAuthorName);
  const [imageError, setImageError] = useState<{ kind: 'format' | 'size'; message: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const isTextEditingRef = useRef(false);
  const overlaysRef = useRef<OverlayItem[]>([]);
  const updateOverlayRef = useRef<(id: string, updates: Partial<OverlayItem>) => void>(() => {});
  const previewRef = useRef<HTMLDivElement>(null);
  const textInputRef = useRef<HTMLTextAreaElement>(null);
  const drawingCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const dragRef = useRef<{ id: string | null; startX: number; startY: number; origX: number; origY: number }>({
    id: null,
    startX: 0,
    startY: 0,
    origX: 0,
    origY: 0,
  });
  const resizeRef = useRef<{ id: string | null; handle: string; startX: number; startY: number; origX: number; origY: number; origW: number; origH: number }>({
    id: null,
    handle: '',
    startX: 0,
    startY: 0,
    origX: 0,
    origY: 0,
    origW: 0,
    origH: 0,
  });

  const addText = () => {
    const id = `text-${Date.now()}`;
    setOverlays((prev) => [
      ...prev,
      {
        id,
        type: 'text',
        x: 20,
        y: 20,
        width: 150,
        height: 40,
        content: 'Type here...',
        fontSize: 16,
        fontFamily: 'inherit',
        color: '#1e293b',
        textAlign: 'left',
        bold: false,
        italic: false,
      },
    ]);
    setActiveOverlay(id);
  };

  const addImage = () => {
    const id = `image-${Date.now()}`;
    setOverlays((prev) => [
      ...prev,
      {
        id,
        type: 'image',
        x: 20,
        y: 20,
        width: 80,
        height: 80,
        content: '',
        fontSize: 0,
        fontFamily: 'inherit',
        color: '',
        textAlign: 'left',
        bold: false,
        italic: false,
      },
    ]);
    setActiveOverlay(id);
  };

  const addPen = () => {
    const id = `pen-${Date.now()}`;
    setOverlays((prev) => [
      ...prev,
      {
        id,
        type: 'pen',
        x: 20,
        y: 20,
        width: 300,
        height: 200,
        content: '',
        fontSize: 0,
        fontFamily: 'inherit',
        color: penColor,
        textAlign: 'left',
        bold: false,
        italic: false,
        strokes: [],
      },
    ]);
    setActiveOverlay(id);
    setIsDrawing(true);
  };

  const getCanvasPoint = (e: React.MouseEvent | React.TouchEvent) => {
    if (!activeOverlay) return { x: 0, y: 0 };
    const canvas = drawingCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  };

  const handleDrawingMouseDown = (e: React.MouseEvent) => {
    if (!isDrawing || !activeOverlay) return;
    const point = getCanvasPoint(e);
    const stroke: PenStroke = {
      points: [point],
      color: isEraser ? '#ffffff' : penColor,
      width: penWidth,
      isEraser,
    };
    setCurrentStroke(stroke);
    setIsDrawing(true);
  };

  const handleDrawingMouseMove = (e: React.MouseEvent) => {
    if (!isDrawing || !currentStroke || !activeOverlay) return;
    const point = getCanvasPoint(e);
    setCurrentStroke({
      ...currentStroke,
      points: [...currentStroke.points, point],
    });
  };

  const handleDrawingMouseUp = () => {
    if (!isDrawing || !currentStroke || !activeOverlay) return;
    setOverlays((prev) =>
      prev.map((o) =>
        o.id === activeOverlay
          ? { ...o, strokes: [...(o.strokes || []), currentStroke] }
          : o
      )
    );
    setCurrentStroke(null);
  };

  const clearPenStrokes = () => {
    if (!activeOverlay) return;
    setOverlays((prev) =>
      prev.map((o) =>
        o.id === activeOverlay ? { ...o, strokes: [] } : o
      )
    );
  };

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeOverlay) return;
    setImageError(null);
    const allowedTypes = ['image/webp', 'image/png', 'image/jpeg', 'image/jpg'];
    if (!allowedTypes.includes(file.type)) {
      setImageError({ kind: 'format', message: 'This image format isn\'t supported. Please use WebP, PNG, or JPG.' });
      e.target.value = '';
      return;
    }
    if (file.size > 1048576) {
      setImageError({ kind: 'size', message: 'This image is larger than 1 MB. Please resize or compress it.' });
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      setImageError(null);
      setOverlays((prev) =>
        prev.map((o) => (o.id === activeOverlay ? { ...o, content: ev.target?.result as string } : o))
      );
    };
    reader.readAsDataURL(file);
  }, [activeOverlay]);

  const updateOverlay = useCallback((id: string, updates: Partial<OverlayItem>) => {
    setOverlays((prev) => prev.map((o) => (o.id === id ? { ...o, ...updates } : o)));
  }, []);

  // Render pen strokes on canvas
  useEffect(() => {
    const canvas = drawingCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const penOverlay = overlays.find((o) => o.type === 'pen' && o.id === activeOverlay);
    if (!penOverlay) return;

    const drawStroke = (stroke: PenStroke) => {
      if (stroke.points.length < 2) return;
      ctx.beginPath();
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      if (stroke.isEraser) {
        ctx.globalCompositeOperation = 'destination-out';
      } else {
        ctx.globalCompositeOperation = 'source-over';
      }
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
      }
      ctx.stroke();
    };

    (penOverlay.strokes || []).forEach(drawStroke);

    if (currentStroke && currentStroke.points.length > 0 && activeOverlay) {
      drawStroke(currentStroke);
    }

    ctx.globalCompositeOperation = 'source-over';
  }, [overlays, activeOverlay, currentStroke]);

  // Draft restore on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(`echoes_draft_${imageUrl}`);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.overlays)) return;
      if (parsed.savedAt && Date.now() - parsed.savedAt > 7 * 24 * 60 * 60 * 1000) {
        localStorage.removeItem(`echoes_draft_${imageUrl}`);
        return;
      }
      setOverlays(parsed.overlays);
      if (parsed.authorName != null) {
        setAuthorName(parsed.authorName);
      }
    } catch {
      try {
        localStorage.removeItem(`echoes_draft_${imageUrl}`);
      } catch {
        // ignore
      }
    }
  }, []);

  // Keep refs in sync so event listeners always have fresh data
  useEffect(() => {
    overlaysRef.current = overlays;
  }, [overlays]);

  useEffect(() => {
    updateOverlayRef.current = updateOverlay;
  }, [updateOverlay]);

  const removeOverlay = useCallback((id: string) => {
    setOverlays((prev) => prev.filter((o) => o.id !== id));
    if (activeOverlay === id) setActiveOverlay(null);
  }, [activeOverlay]);

  useEffect(() => {
    setImageError(null);
  }, [activeOverlay]);

  // Autosave draft every 5 seconds while overlays/authorName change
  useEffect(() => {
    if (overlays.length === 0 && !authorName) return;
    const timer = setTimeout(() => {
      try {
        const transformed = overlays.map((o) =>
          o.type === 'image' ? { ...o, content: '' } : o
        );
        localStorage.setItem(
          `echoes_draft_${imageUrl}`,
          JSON.stringify({ overlays: transformed, authorName, savedAt: Date.now() })
        );
      } catch {
        // fail silently — don't interrupt the user
      }
    }, 5000);
    return () => {
      clearTimeout(timer);
    };
  }, [overlays, authorName, imageUrl]);

  // Keep ref in sync with isTextEditing state
  useEffect(() => {
    isTextEditingRef.current = isTextEditing;
  }, [isTextEditing]);

  // Drag logic
  const handleOverlayMouseDown = useCallback((e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    e.preventDefault();
    setActiveOverlay(id);
    setIsTextEditing(false);
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    const overlay = overlaysRef.current.find((o) => o.id === id);
    if (!overlay) return;
    dragRef.current = {
      id,
      startX: e.clientX,
      startY: e.clientY,
      origX: overlay.x,
      origY: overlay.y,
    };
  }, []);

  // Click to select overlay (when not dragging)
  const handleOverlayClick = useCallback((id: string) => {
    setActiveOverlay(id);
    setIsTextEditing(false);
  }, []);

  // Resize logic
  const handleResizeMouseDown = useCallback((e: React.MouseEvent, id: string, handle: string) => {
    e.stopPropagation();
    e.preventDefault();
    setIsTextEditing(false);
    // Blur any focused textarea so resize works immediately
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    // Clear drag ref so the mousemove handler doesn't enter the drag branch
    dragRef.current.id = null;
    setActiveOverlay(id);
    const overlay = overlaysRef.current.find((o) => o.id === id);
    if (!overlay) return;
    resizeRef.current = {
      id,
      handle,
      startX: e.clientX,
      startY: e.clientY,
      origX: overlay.x,
      origY: overlay.y,
      origW: overlay.width,
      origH: overlay.height,
    };
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      // Resize (check first — resize handle mousedown fires after parent's mousedown)
      if (resizeRef.current.id) {
        e.preventDefault();
        const { handle, startX, startY, origX, origY, origW, origH } = resizeRef.current;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        const overlay = overlaysRef.current.find((o) => o.id === resizeRef.current.id);
        if (!overlay || !previewRef.current) return;
        const bounds = previewRef.current.getBoundingClientRect();
        let newX = origX;
        let newY = origY;
        let newW = origW;
        let newH = origH;

        if (handle.includes('e')) { newW = Math.max(30, origW + dx); }
        if (handle.includes('s')) { newH = Math.max(20, origH + dy); }
        if (handle.includes('w')) {
          newW = Math.max(30, origW - dx);
          newX = origX + origW - newW;
        }
        if (handle.includes('n')) {
          newH = Math.max(20, origH - dy);
          newY = origY + origH - newH;
        }

        newX = Math.max(0, Math.min(newX, bounds.width - newW));
        newY = Math.max(0, Math.min(newY, bounds.height - newH));
        newW = Math.min(newW, bounds.width - newX);
        newH = Math.min(newH, bounds.height - newY);

        updateOverlayRef.current(resizeRef.current.id!, { x: newX, y: newY, width: newW, height: newH });
      }
      // Drag
      else if (dragRef.current.id) {
        e.preventDefault();
        const dx = e.clientX - dragRef.current.startX;
        const dy = e.clientY - dragRef.current.startY;
        const overlay = overlaysRef.current.find((o) => o.id === dragRef.current.id);
        if (!overlay || !previewRef.current) return;
        const bounds = previewRef.current.getBoundingClientRect();
        const newX = Math.max(0, Math.min(dragRef.current.origX + dx, bounds.width - overlay.width));
        const newY = Math.max(0, Math.min(dragRef.current.origY + dy, bounds.height - overlay.height));
        updateOverlayRef.current(dragRef.current.id, { x: newX, y: newY });
      }
    };

    const handleMouseUp = () => {
      dragRef.current.id = null;
      resizeRef.current.id = null;
    };

    // Always attach listeners — the handlers check refs to decide whether to act
    window.addEventListener('mousemove', handleMouseMove, { passive: false });
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  // Save
  const handleSave = async () => {
    if (!previewRef.current) return;
    setIsSaving(true);
    try {
      const notepadImg = previewRef.current.querySelector('img') as HTMLImageElement | null;
      if (!notepadImg) {
        showToast('No notepad loaded. Please try again.', 'error');
        setIsSaving(false);
        return;
      }

      // Use a reasonable display size for the note on the wall
      const displayW = 400;
      const displayH = 400;

      // Get the actual displayed size of the preview image using getBoundingClientRect
      const previewImgEl = previewRef.current?.querySelector('img') as HTMLImageElement | null;
      const rect = previewImgEl?.getBoundingClientRect();
      const displayedW = rect?.width || previewImgEl?.width || displayW;
      const displayedH = rect?.height || previewImgEl?.height || displayH;
      const scaleX = displayW / displayedW;
      const scaleY = displayH / displayedH;

      const overlayContainer = document.createElement('div');
      overlayContainer.style.position = 'fixed';
      overlayContainer.style.left = '-9999px';
      overlayContainer.style.top = '-9999px';
      overlayContainer.style.width = displayW + 'px';
      overlayContainer.style.height = displayH + 'px';
      overlayContainer.style.overflow = 'hidden';
      overlayContainer.style.display = 'block';

      // Add the notepad background image as the first child — match object-contain from preview
      const bgImg = document.createElement('img');
      bgImg.src = imageUrl;
      bgImg.style.width = displayW + 'px';
      bgImg.style.height = displayH + 'px';
      bgImg.style.objectFit = 'contain';
      bgImg.style.display = 'block';
      overlayContainer.appendChild(bgImg);

      for (const overlay of overlays) {
        const el = document.createElement('div');
        el.style.position = 'absolute';
        el.style.left = Math.round(overlay.x * scaleX) + 'px';
        el.style.top = Math.round(overlay.y * scaleY) + 'px';
        el.style.width = Math.round(overlay.width * scaleX) + 'px';
        el.style.height = Math.round(overlay.height * scaleY) + 'px';

        if (overlay.type === 'text') {
          const textEl = document.createElement('div');
          textEl.style.fontSize = Math.round(overlay.fontSize * scaleX) + 'px';
          textEl.style.fontFamily = overlay.fontFamily;
          textEl.style.color = overlay.color;
          textEl.style.width = '100%';
          textEl.style.height = '100%';
          textEl.style.overflow = 'auto';
          textEl.style.wordBreak = 'break-word';
          textEl.style.whiteSpace = 'pre-wrap';
          textEl.style.padding = '4px';
          textEl.style.textAlign = overlay.textAlign || 'left';
          textEl.style.fontWeight = overlay.bold ? 'bold' : 'normal';
          textEl.style.fontStyle = overlay.italic ? 'italic' : 'normal';
          textEl.textContent = overlay.content;
          el.appendChild(textEl);
        } else if (overlay.type === 'image' && overlay.content) {
          const imgEl = document.createElement('img');
          imgEl.src = overlay.content;
          imgEl.style.width = '100%';
          imgEl.style.height = '100%';
          imgEl.style.objectFit = 'contain';
          el.appendChild(imgEl);
        } else if (overlay.type === 'pen' && overlay.strokes && overlay.strokes.length > 0) {
          const penCanvas = document.createElement('canvas');
          penCanvas.width = overlay.width;
          penCanvas.height = overlay.height;
          const penCtx = penCanvas.getContext('2d');
          if (penCtx) {
            const penScaleX = scaleX;
            const penScaleY = scaleY;
            overlay.strokes.forEach((stroke) => {
              if (stroke.points.length < 2) return;
              penCtx.beginPath();
              penCtx.strokeStyle = stroke.isEraser ? 'rgba(0,0,0,1)' : stroke.color;
              penCtx.lineWidth = stroke.width * penScaleX;
              penCtx.lineCap = 'round';
              penCtx.lineJoin = 'round';
              if (stroke.isEraser) {
                penCtx.globalCompositeOperation = 'destination-out';
              }
              penCtx.moveTo(stroke.points[0].x * penScaleX, stroke.points[0].y * penScaleY);
              for (let i = 1; i < stroke.points.length; i++) {
                penCtx.lineTo(stroke.points[i].x * penScaleX, stroke.points[i].y * penScaleY);
              }
              penCtx.stroke();
            });
            penCtx.globalCompositeOperation = 'source-over';
            const penImg = document.createElement('img');
            penImg.src = penCanvas.toDataURL('image/png');
            penImg.style.width = '100%';
            penImg.style.height = '100%';
            penImg.style.pointerEvents = 'none';
            el.appendChild(penImg);
          }
        }

        overlayContainer.appendChild(el);
      }

      // Add author name at the bottom right of the notepad
      if (authorName) {
        const nameEl = document.createElement('div');
        nameEl.style.position = 'absolute';
        nameEl.style.bottom = Math.round(8 * scaleY) + 'px';
        nameEl.style.right = Math.round(8 * scaleX) + 'px';
        nameEl.style.textAlign = 'right';
        nameEl.style.fontSize = Math.round(18 * scaleX) + 'px';
        nameEl.style.color = '#5a6f8d';
        nameEl.style.fontFamily = 'inherit';
        nameEl.textContent = `— ${authorName}`;
        overlayContainer.appendChild(nameEl);
      }

      document.body.appendChild(overlayContainer);

      const imageOverlays = overlays.filter((o) => o.type === 'image' && o.content);
      const imagesToLoad = imageOverlays.map((o) => o.content);
      let imagesLoaded = 0;

      const loadImages = new Promise<void>((resolve) => {
        if (imagesToLoad.length === 0) {
          resolve();
          return;
        }
        let failed = false;
        imagesToLoad.forEach((src) => {
          const img = new Image();
          img.onload = () => {
            imagesLoaded++;
            if (imagesLoaded === imagesToLoad.length && !failed) resolve();
          };
          img.onerror = () => {
            failed = true;
            imagesLoaded++;
            if (imagesLoaded === imagesToLoad.length) resolve();
          };
          img.src = src;
        });
      });

      await loadImages;
      await new Promise((resolve) => setTimeout(resolve, 200));

      const canvas = await html2canvas(overlayContainer, {
        backgroundColor: null,
        scale: 1,
        logging: false,
      });

      document.body.removeChild(overlayContainer);
      onSave(canvas.toDataURL('image/webp', 0.9), authorName || 'Anonymous', displayW, displayH);
      try {
        localStorage.removeItem(`echoes_draft_${imageUrl}`);
      } catch {
        // ignore
      }
    } catch {
      showToast('Failed to save note. Please try again.', 'error');
    }
    setIsSaving(false);
  };

  const activeOverlayData = overlays.find((o) => o.id === activeOverlay);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="relative flex w-full max-w-4xl gap-6 rounded-2xl bg-white p-6 shadow-2xl mx-4">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 z-10"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Editor controls */}
        <div className="flex flex-col gap-4 w-56 shrink-0">
          <h3 className="text-sm font-semibold text-slate-700">{themeName}</h3>
          <button
            onClick={addText}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            + Add Text
          </button>
          <button
            onClick={addImage}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            + Add Image
          </button>
          <button
            onClick={addPen}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            + Pen
          </button>

          {activeOverlayData && (
            <div className="mt-2 rounded-lg border border-slate-200 p-3 space-y-3">
              {activeOverlayData.type === 'text' ? (
                <>
                  <div>
                    <label className="mb-1 block text-xs text-slate-500">Text</label>
                    <textarea
                      value={activeOverlayData.content}
                      onChange={(e) => updateOverlay(activeOverlay!, { content: e.target.value })}
                      className="w-full rounded border border-slate-300 p-2 text-sm focus:border-blue-500 focus:outline-none"
                      rows={3}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-slate-500">Font Style</label>
                    <select
                      value={activeOverlayData.fontFamily}
                      onChange={(e) => {
                        const newFamily = e.target.value;
                      const sizeMap: Record<string, number> = {
                        inherit: 16,
                        "'Caveat Brush', cursive": 24,
                      };
                        updateOverlay(activeOverlay!, {
                          fontFamily: newFamily,
                          fontSize: sizeMap[newFamily] || activeOverlayData.fontSize,
                        });
                      }}
                      className="w-full rounded border border-slate-300 p-2 text-sm focus:outline-none"
                    >
                      <option value="inherit">Default (Aa)</option>
                      <option value="'Caveat Brush', cursive">Caveat Brush (Aa)</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-slate-500">Font Size</label>
                    <select
                      value={activeOverlayData.fontSize}
                      onChange={(e) => updateOverlay(activeOverlay!, { fontSize: Number(e.target.value) })}
                      className="w-full rounded border border-slate-300 p-2 text-sm focus:outline-none"
                    >
                      {FONT_SIZES.map((s) => (
                        <option key={s} value={s}>{s}px</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-slate-500">Color</label>
                    <div className="flex gap-1 flex-wrap">
                      {TEXT_COLORS.map((c) => (
                        <button
                          key={c}
                          onClick={() => updateOverlay(activeOverlay!, { color: c })}
                          className={`w-6 h-6 rounded-full border-2 ${activeOverlayData.color === c ? 'border-slate-700' : 'border-transparent'}`}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-slate-500">Alignment</label>
                    <div className="flex gap-1">
                      {(['left', 'center', 'right'] as const).map((align) => (
                        <button
                          key={align}
                          onClick={() => updateOverlay(activeOverlay!, { textAlign: align })}
                          className={`flex-1 rounded border px-2 py-1.5 text-xs font-medium ${
                            activeOverlayData.textAlign === align
                              ? 'bg-slate-800 text-white border-slate-800'
                              : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
                          }`}
                        >
                          {align === 'left' ? (
                            <svg className="w-4 h-4 mx-auto" fill="currentColor" viewBox="0 0 16 16">
                              <path d="M14 4H2v1.5h12V4zm0 4H2v1.5h12V8zm0 4H2v1.5h12v-1.5z" />
                            </svg>
                          ) : align === 'center' ? (
                            <svg className="w-4 h-4 mx-auto" fill="currentColor" viewBox="0 0 16 16">
                              <path d="M14 4H2v1.5h12V4zm-5 4H7v1.5h2V8zm4 4H3v1.5h10v-1.5z" />
                            </svg>
                          ) : (
                            <svg className="w-4 h-4 mx-auto" fill="currentColor" viewBox="0 0 16 16">
                              <path d="M14 4H4v1.5h10V4zm0 4H6v1.5h8V8zm0 4H4v1.5h10v-1.5z" />
                            </svg>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-slate-500">Style</label>
                    <div className="flex gap-1">
                      <button
                        onClick={() => updateOverlay(activeOverlay!, { bold: !activeOverlayData.bold })}
                        className={`flex-1 rounded border px-2 py-1.5 text-xs font-bold ${
                          activeOverlayData.bold
                            ? 'bg-slate-800 text-white border-slate-800'
                            : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        B
                      </button>
                      <button
                        onClick={() => updateOverlay(activeOverlay!, { italic: !activeOverlayData.italic })}
                        className={`flex-1 rounded border px-2 py-1.5 text-xs italic ${
                          activeOverlayData.italic
                            ? 'bg-slate-800 text-white border-slate-800'
                            : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        I
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                activeOverlayData.type === 'pen' ? (
                  <>
                    <div>
                      <label className="mb-1 block text-xs text-slate-500">Pen Color</label>
                      <div className="flex gap-1 flex-wrap">
                        {TEXT_COLORS.map((c) => (
                          <button
                            key={c}
                            onClick={() => setPenColor(c)}
                            className={`w-6 h-6 rounded-full border-2 ${penColor === c ? 'border-slate-700' : 'border-transparent'}`}
                            style={{ backgroundColor: c }}
                          />
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-slate-500">Stroke Width</label>
                      <div className="flex gap-1">
                        {PEN_WIDTHS.map((w) => (
                          <button
                            key={w}
                            onClick={() => setPenWidth(w)}
                            className={`flex-1 rounded border px-2 py-1.5 text-xs font-medium ${
                              penWidth === w
                                ? 'bg-slate-800 text-white border-slate-800'
                                : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
                            }`}
                          >
                            {w}px
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-slate-500">Mode</label>
                      <div className="flex gap-1">
                        <button
                          onClick={() => setIsDrawing(true)}
                          className={`flex-1 rounded border px-2 py-1.5 text-xs font-medium flex items-center justify-center gap-1 ${
                            isDrawing
                              ? 'bg-slate-800 text-white border-slate-800'
                              : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
                          }`}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                          Draw
                        </button>
                        <button
                          onClick={() => setIsDrawing(false)}
                          className={`flex-1 rounded border px-2 py-1.5 text-xs font-medium flex items-center justify-center gap-1 ${
                            !isDrawing
                              ? 'bg-slate-800 text-white border-slate-800'
                              : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
                          }`}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                          </svg>
                          Drag
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-slate-500">Tool</label>
                      <div className="flex gap-1">
                        <button
                          onClick={() => setIsEraser(false)}
                          className={`flex-1 rounded border px-2 py-1.5 text-xs font-medium flex items-center justify-center gap-1 ${
                            !isEraser
                              ? 'bg-slate-800 text-white border-slate-800'
                              : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
                          }`}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                          Pen
                        </button>
                        <button
                          onClick={() => setIsEraser(true)}
                          className={`flex-1 rounded border px-2 py-1.5 text-xs font-medium flex items-center justify-center gap-1 ${
                            isEraser
                              ? 'bg-slate-800 text-white border-slate-800'
                              : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
                          }`}
                        >
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 16 16">
                            <path d="M8.086 2.207a2 2 0 0 1 2.828 0l3.879 3.879a2 2 0 0 1 0 2.828l-5.5 5.5A2 2 0 0 1 7.879 15H5.12a2 2 0 0 1-1.414-.586l-2.5-2.5a2 2 0 0 1 0-2.828zm2.121.707a1 1 0 0 0-1.414 0L4.16 7.547l5.293 5.293 4.633-4.633a1 1 0 0 0 0-1.414zM8.746 13.547 3.453 8.254 1.914 9.793a1 1 0 0 0 0 1.414l2.5 2.5a1 1 0 0 0 .707.293H7.88a1 1 0 0 0 .707-.293z"/>
                          </svg>
                          Eraser
                        </button>
                      </div>
                    </div>
                    <button
                      onClick={clearPenStrokes}
                      className="w-full rounded-lg border border-amber-200 px-3 py-1.5 text-xs font-medium text-amber-600 hover:bg-amber-50"
                    >
                      Clear Drawing
                    </button>
                  </>
                ) : (
                  <div>
                    <label className="mb-1 block text-xs text-slate-500">Upload Image</label>
                    {imageError && (
                      <div className="mb-2 rounded-lg border border-red-200 bg-red-50 p-2.5 space-y-2">
                        <p className="text-xs text-red-700">{imageError.message}</p>
                        <a
                          href="https://lll-image.pages.dev/"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-block w-full rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white text-center hover:bg-red-700 transition-colors"
                        >
                          Open Image Converter
                        </a>
                        <button
                          onClick={async () => {
                            try {
                              if (!navigator.clipboard) {
                                throw new Error('Clipboard unavailable');
                              }
                              await navigator.clipboard.writeText('https://lll-image.pages.dev/');
                              setCopied(true);
                              setTimeout(() => setCopied(false), 2000);
                            } catch {
                              // Clipboard failed — silently degrade (user can still click the direct link)
                            }
                          }}
                          className="inline-block w-full rounded-lg border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700 bg-white hover:bg-red-50 transition-colors"
                        >
                          {copied ? 'Copied!' : 'Copy converter link'}
                        </button>
                      </div>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileUpload}
                      className="w-full text-xs text-slate-600"
                    />
                  </div>
                )
              )}
              <button
                onClick={() => removeOverlay(activeOverlay!)}
                className="w-full rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
              >
                Remove
              </button>
            </div>
          )}

          <div className="space-y-2">
            <label className="block text-xs text-slate-500">Your name (optional)</label>
            <input
              type="text"
              value={authorName}
              onChange={(e) => setAuthorName(e.target.value)}
              placeholder="Anonymous"
              className="w-full rounded border border-slate-300 p-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div className="mt-auto">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="w-full rounded-lg bg-slate-800 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : 'Save to Wall'}
            </button>
          </div>
        </div>

        {/* Preview area */}
        <div className="flex-1 flex items-center justify-center bg-slate-50 rounded-xl p-4 overflow-auto">
          <div
            ref={previewRef}
            className="relative inline-block"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setActiveOverlay(null);
                setIsTextEditing(false);
              }
            }}
          >
            <img
              src={imageUrl}
              alt="Notepad"
              className="block max-h-[500px] max-w-full object-contain"
              draggable={false}
              style={{ pointerEvents: 'none' }}
            />
            {overlays.map((overlay) => (
              <div
                key={overlay.id}
                className={`absolute ${activeOverlay === overlay.id ? 'ring-2 ring-blue-500' : ''}`}
                style={{
                  left: overlay.x,
                  top: overlay.y,
                  width: overlay.width,
                  height: overlay.height,
                  cursor: isTextEditing ? 'default' : activeOverlay === overlay.id ? 'move' : 'default',
                  zIndex: activeOverlay === overlay.id ? 10 : 1,
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  handleOverlayClick(overlay.id);
                }}
                onMouseDown={(e) => {
                  if (overlay.type === 'pen' && activeOverlay === overlay.id && isDrawing) {
                    e.stopPropagation();
                    return;
                  }
                  handleOverlayMouseDown(e, overlay.id);
                }}
              >
                {overlay.type === 'text' ? (
                  <textarea
                    ref={isTextEditing && activeOverlay === overlay.id ? textInputRef : null}
                    value={overlay.content}
                    onChange={(e) => updateOverlay(overlay.id, { content: e.target.value })}
                    onFocus={() => {
                      setActiveOverlay(overlay.id);
                      setIsTextEditing(true);
                    }}
                    onBlur={() => setIsTextEditing(false)}
                    style={{
                      fontSize: overlay.fontSize,
                      fontFamily: overlay.fontFamily,
                      color: overlay.color,
                      width: '100%',
                      height: '100%',
                      overflow: 'auto',
                      wordBreak: 'break-word',
                      whiteSpace: 'pre-wrap',
                      padding: 4,
                      border: 'none',
                      background: 'transparent',
                      resize: 'none',
                      outline: 'none',
                      cursor: isTextEditing ? 'text' : 'default',
                      textAlign: overlay.textAlign,
                      fontWeight: overlay.bold ? 'bold' : 'normal',
                      fontStyle: overlay.italic ? 'italic' : 'normal',
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: '100%',
                      height: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden',
                    }}
                  >
                    {overlay.content ? (
                      <img
                        src={overlay.content}
                        alt=""
                        className="w-full h-full object-contain rounded"
                        draggable={false}
                      />
                    ) : (
                      <span className="text-xs text-slate-400 text-center px-1">No image</span>
                    )}
                  </div>
                )}
                {overlay.type === 'pen' && (
                  <canvas
                    ref={drawingCanvasRef}
                    className="absolute inset-0 w-full h-full"
                    width={overlay.width}
                    height={overlay.height}
                    style={{ cursor: isDrawing ? 'crosshair' : 'default', pointerEvents: 'auto' }}
                    onMouseDown={(e) => {
                      if (overlay.id === activeOverlay && isDrawing) {
                        e.stopPropagation();
                        handleDrawingMouseDown(e);
                      }
                    }}
                    onMouseMove={(e) => {
                      if (overlay.id === activeOverlay && isDrawing) {
                        e.stopPropagation();
                        handleDrawingMouseMove(e);
                      }
                    }}
                    onMouseUp={(e) => {
                      if (overlay.id === activeOverlay && isDrawing) {
                        e.stopPropagation();
                        handleDrawingMouseUp();
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (overlay.id === activeOverlay && isDrawing) {
                        e.stopPropagation();
                        handleDrawingMouseUp();
                      }
                    }}
                  />
                )}
                {activeOverlay === overlay.id && (
                  <>
                    {/* Edge resize zones */}
                    <div
                      className="absolute cursor-n-resize"
                      style={{ top: -4, left: 0, right: 0, height: 10 }}
                      onMouseDown={(e) => handleResizeMouseDown(e, overlay.id, 'n')}
                    />
                    <div
                      className="absolute cursor-s-resize"
                      style={{ bottom: -4, left: 0, right: 0, height: 10 }}
                      onMouseDown={(e) => handleResizeMouseDown(e, overlay.id, 's')}
                    />
                    <div
                      className="absolute cursor-w-resize"
                      style={{ top: 0, left: -4, bottom: 0, width: 10 }}
                      onMouseDown={(e) => handleResizeMouseDown(e, overlay.id, 'w')}
                    />
                    <div
                      className="absolute cursor-e-resize"
                      style={{ top: 0, right: -4, bottom: 0, width: 10 }}
                      onMouseDown={(e) => handleResizeMouseDown(e, overlay.id, 'e')}
                    />
                    {/* Corner resize handles */}
                    <div
                      className="absolute w-3 h-3 bg-blue-500 border-2 border-white rounded-full shadow-sm cursor-nw-resize"
                      style={{ top: -5, left: -5 }}
                      onMouseDown={(e) => handleResizeMouseDown(e, overlay.id, 'nw')}
                    />
                    <div
                      className="absolute w-3 h-3 bg-blue-500 border-2 border-white rounded-full shadow-sm cursor-ne-resize"
                      style={{ top: -5, right: -5 }}
                      onMouseDown={(e) => handleResizeMouseDown(e, overlay.id, 'ne')}
                    />
                    <div
                      className="absolute w-3 h-3 bg-blue-500 border-2 border-white rounded-full shadow-sm cursor-sw-resize"
                      style={{ bottom: -5, left: -5 }}
                      onMouseDown={(e) => handleResizeMouseDown(e, overlay.id, 'sw')}
                    />
                    <div
                      className="absolute w-3 h-3 bg-blue-500 border-2 border-white rounded-full shadow-sm cursor-se-resize"
                      style={{ bottom: -5, right: -5 }}
                      onMouseDown={(e) => handleResizeMouseDown(e, overlay.id, 'se')}
                    />
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
