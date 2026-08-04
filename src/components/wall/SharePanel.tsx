'use client';

import { useState, useCallback, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import html2canvas from 'html2canvas';

interface SharePanelProps {
  wallSlug: string;
  wallTheme: string;
  wallTitle: string;
  allowContributions: boolean;
  onClose: () => void;
  onToggleContributions: (allowed: boolean) => void;
  notes: Array<{
    id: string;
    image_url: string | null;
    x: number;
    y: number;
    width: number;
    height: number;
    rotation?: number;
    author_name?: string | null;
    created_at?: string | null;
  }>;
}

type Tab = 'link' | 'embed' | 'image';

function formatTimestamp(date: string | null | undefined): string {
  if (!date) return '';
  const ts = new Date(date);
  const diff = Date.now() - ts.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  return `${weeks}w ago`;
}

export default function SharePanel({
  wallSlug,
  wallTheme,
  wallTitle,
  allowContributions,
  onClose,
  onToggleContributions,
  notes,
}: SharePanelProps) {
  const t = useTranslations('sharePanel');
  const [activeTab, setActiveTab] = useState<Tab>('link');
  const [embedWidth, setEmbedWidth] = useState(1200);
  const [embedHeight, setEmbedHeight] = useState(800);
  const [copied, setCopied] = useState<string | null>(null);
  const [screenshotDataUrl, setScreenshotDataUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [embedContributions, setEmbedContributions] = useState(allowContributions);

  useEffect(() => {
    setEmbedContributions(allowContributions);
  }, [allowContributions]);

  const baseUrl = typeof window !== 'undefined'
    ? window.location.origin
    : 'https://echoes.ai';

  const contributeUrl = `${baseUrl}/w/${wallSlug}?contribute=1`;
  const shareUrl = allowContributions ? contributeUrl : `${baseUrl}/w/${wallSlug}`;

  const copyToClipboard = useCallback(async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      setCopied(null);
    }
  }, []);

  const generateScreenshot = useCallback(async () => {
    setIsGenerating(true);
    setError(null);

    try {
      const notesHtml = notes.map(note => {
        const rotationStyle = note.rotation ? `transform: rotate(${note.rotation}deg);` : '';
        const metaHtml = (note.author_name || note.created_at) ? `
    <div style="position:absolute;bottom:2px;right:8px;text-align:right;font-size:10px;color:#5a6f8d;pointer-events:none;">
      ${note.author_name ? `<div style="font-style:italic;line-height:1.2;">— ${note.author_name}</div>` : ''}
      ${note.created_at ? `<div style="line-height:1.2;">${formatTimestamp(note.created_at)}</div>` : ''}
    </div>
  ` : '';
        if (note.image_url) {
          return `<div style="position:absolute;left:${note.x}px;top:${note.y}px;width:${note.width}px;height:${note.height}px;${rotationStyle}">
            <img src="${note.image_url}" style="width:100%;height:100%;object-fit:contain;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,0.1);" crossorigin="anonymous" />
            ${metaHtml}
          </div>`;
        }
        return `<div style="position:absolute;left:${note.x}px;top:${note.y}px;width:${note.width}px;height:${note.height}px;${rotationStyle};background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0;display:flex;align-items:center;justify-content:center;padding:16px">
          <div style="font-size:12px;color:#94a3b8">${note.author_name ? `— ${note.author_name}` : 'Empty note'}</div>
          ${metaHtml}
        </div>`;
      }).join('');

      const html = `<!DOCTYPE html><html><body>
        <div style="position:relative;width:1200px;height:800px;background:#fffef9;font-family:system-ui,-apple-system,sans-serif;overflow:hidden">
          <div style="text-align:center;padding:20px 0 10px;font-size:24px;font-weight:bold;color:#1e293b">${wallTitle}</div>
          ${notesHtml || '<div style="text-align:center;padding:40px;color:#94a3b8;font-size:16px">No notes yet</div>'}
        </div>
      </body></html>`;

      const container = document.createElement('div');
      container.style.position = 'absolute';
      container.style.left = '-9999px';
      container.style.top = '-9999px';
      container.innerHTML = html;
      document.body.appendChild(container);

      const bodyDiv = container.querySelector('div[style*="position:relative"]') as HTMLElement;

      const canvas = await html2canvas(bodyDiv, {
        backgroundColor: '#fffef9',
        scale: 2,
        useCORS: true,
        allowTaint: false,
        logging: false,
      });

      document.body.removeChild(container);

      const dataUrl = canvas.toDataURL('image/png');
      setScreenshotDataUrl(dataUrl);
    } catch (err) {
      setError('Failed to generate screenshot. Please try again.');
      console.error('Screenshot generation failed:', err);
    } finally {
      setIsGenerating(false);
    }
  }, [notes, wallTheme, wallTitle]);

  const aspectRatio = (embedHeight / embedWidth * 100).toFixed(2);
  const embedUrl = embedContributions ? contributeUrl : `${baseUrl}/w/${wallSlug}`;
  const previewEmbedUrl = `${embedUrl}${embedUrl.includes('?') ? '&' : '?'}embed=1`;
  const embedCode = `<div style="position: relative; width: 100%; padding-bottom: ${aspectRatio}%;">
  <iframe 
    src="${embedUrl}" 
    style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: none;" 
    allowfullscreen
  ></iframe>
</div>`;

  const tabs: { key: Tab; label: string }[] = [
    { key: 'link', label: t('linkTab') },
    { key: 'embed', label: t('embedTab') },
    { key: 'image', label: t('imageTab') },
  ];

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30" />
      <div
        className="relative w-full max-w-sm bg-white shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">{t('title')}</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div
            className="mb-4 rounded-lg px-3 py-2 text-xs"
            style={{
              backgroundColor: '#f5f0e8',
              border: '1px solid #c4a77d',
              color: '#775537',
            }}
            >
              {t('customizeHint')}
            <a
              href={`/w/${wallSlug}/settings`}
              className="ml-1 underline hover:opacity-70"
              style={{ color: '#775537', fontWeight: 600 }}
            >
              {t('editTitlePreview')}
            </a>
          </div>
          {activeTab === 'link' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">{t('wallUrlLabel')}</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={shareUrl}
                    className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600 bg-slate-50"
                  />
                  <button
                    onClick={() => copyToClipboard(shareUrl, 'link')}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors whitespace-nowrap"
                  >
                    {copied === 'link' ? t('copied') : t('copy')}
                  </button>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-700">{t('allowContributions')}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{t('allowContributionsDesc')}</p>
                  </div>
                  <button
                    onClick={() => {
                      onToggleContributions(!allowContributions);
                    }}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      allowContributions ? 'bg-blue-600' : 'bg-slate-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        allowContributions ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'embed' && (
            <div className="space-y-4">
              <div className="pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-700">{t('allowContributionsEmbed')}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{t('allowContributionsEmbedDesc')}</p>
                  </div>
                  <button
                    onClick={() => setEmbedContributions(!embedContributions)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      embedContributions ? 'bg-blue-600' : 'bg-slate-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        embedContributions ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">{t('embedCodeLabel')}</label>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <pre className="text-xs text-slate-600 whitespace-pre-wrap break-all font-mono">{embedCode}</pre>
                </div>
                <button
                  onClick={() => copyToClipboard(embedCode, 'embed')}
                  className="mt-2 w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
                >
                  {copied === 'embed' ? t('copied') : t('copyCode')}
                </button>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">{t('sizeLabel')}</label>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="block text-xs text-slate-400 mb-1">{t('widthLabel')}</label>
                    <input
                      type="number"
                      value={embedWidth}
                      onChange={(e) => setEmbedWidth(Number(e.target.value))}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs text-slate-400 mb-1">{t('heightLabel')}</label>
                    <input
                      type="number"
                      value={embedHeight}
                      onChange={(e) => setEmbedHeight(Number(e.target.value))}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">{t('previewLabel')}</label>
                <div
                  className="rounded-lg border border-slate-200 overflow-hidden bg-slate-100 relative"
                  style={{ width: '100%', paddingBottom: `${aspectRatio}%` }}
                >
                  <iframe
                    src={previewEmbedUrl}
                    style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }}
                    title={t('embedPreview')}
                  />
                </div>
                <p className="mt-2 text-xs text-slate-500 italic">
                  ℹ️ {t('previewScaleNote')}
                </p>
              </div>
            </div>
          )}

          {activeTab === 'image' && (
            <div className="space-y-4">
              <div>
                <p className="text-sm text-slate-600 mb-3">
                  {t('imageDesc')}
                </p>
              </div>

              {!screenshotDataUrl && !isGenerating && (
                <button
                  onClick={generateScreenshot}
                  className="w-full rounded-lg bg-blue-600 px-4 py-3 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
                >
                  {t('generateScreenshot')}
                </button>
              )}

              {isGenerating && (
                <div className="rounded-lg border border-slate-200 overflow-hidden bg-slate-100 flex items-center justify-center" style={{ minHeight: 200 }}>
                  <div className="text-center">
                    <svg className="animate-spin h-8 w-8 mx-auto text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <p className="text-sm text-slate-500 mt-2">{t('generatingScreenshot')}</p>
                  </div>
                </div>
              )}

              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}

              {screenshotDataUrl && (
                <>
                  <div className="rounded-lg border border-slate-200 overflow-hidden bg-slate-100">
                    <img
                      src={screenshotDataUrl}
                      alt={t('wallPreview')}
                      className="w-full h-auto"
                    />
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => generateScreenshot()}
                      className="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                      {t('regenerate')}
                    </button>
                    <a
                      href={screenshotDataUrl}
                      download={`${wallSlug}-wall.png`}
                      className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors text-center"
                    >
                      {t('download')}
                    </a>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
