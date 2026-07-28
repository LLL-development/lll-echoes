'use client';

import { useState, useCallback } from 'react';

interface SharePanelProps {
  wallSlug: string;
  wallTheme: string;
  allowContributions: boolean;
  onClose: () => void;
  onToggleContributions: (allowed: boolean) => void;
}

type Tab = 'link' | 'embed' | 'image';

export default function SharePanel({
  wallSlug,
  wallTheme,
  allowContributions,
  onClose,
  onToggleContributions,
}: SharePanelProps) {
  const [activeTab, setActiveTab] = useState<Tab>('link');
  const [embedWidth, setEmbedWidth] = useState(800);
  const [embedHeight, setEmbedHeight] = useState(600);
  const [copied, setCopied] = useState<string | null>(null);

  const baseUrl = typeof window !== 'undefined'
    ? window.location.origin
    : 'https://echoes.ai';

  const shareUrl = `${baseUrl}/w/${wallSlug}`;
  const contributeUrl = `${baseUrl}/w/${wallSlug}?contribute=1`;
  const screenshotUrl = `${baseUrl}/api/walls/${wallSlug}/screenshot`;

  const copyToClipboard = useCallback(async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      setCopied(null);
    }
  }, []);

  const embedCode = `<iframe src="${contributeUrl}" width="${embedWidth}" height="${embedHeight}" frameborder="0" allowfullscreen></iframe>`;

  const tabs: { key: Tab; label: string }[] = [
    { key: 'link', label: 'Link' },
    { key: 'embed', label: 'Embed' },
    { key: 'image', label: 'Image' },
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
          <h2 className="text-lg font-semibold text-slate-900">Share Wall</h2>
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
            Want to customize how this wall looks when shared?
            <a
              href={`/w/${wallSlug}/settings`}
              className="ml-1 underline hover:opacity-70"
              style={{ color: '#775537', fontWeight: 600 }}
            >
              Edit title & preview →
            </a>
          </div>
          {activeTab === 'link' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">Wall URL</label>
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
                    {copied === 'link' ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-700">Allow visitors to add notes</p>
                    <p className="text-xs text-slate-500 mt-0.5">When enabled, visitors can contribute notes to this wall</p>
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
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">Embed Code</label>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <pre className="text-xs text-slate-600 whitespace-pre-wrap break-all font-mono">{embedCode}</pre>
                </div>
                <button
                  onClick={() => copyToClipboard(embedCode, 'embed')}
                  className="mt-2 w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
                >
                  {copied === 'embed' ? 'Copied!' : 'Copy Code'}
                </button>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">Size</label>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="block text-xs text-slate-400 mb-1">Width</label>
                    <input
                      type="number"
                      value={embedWidth}
                      onChange={(e) => setEmbedWidth(Number(e.target.value))}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs text-slate-400 mb-1">Height</label>
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
                <label className="block text-xs font-medium text-slate-500 mb-1.5">Preview</label>
                <div
                  className="rounded-lg border border-slate-200 overflow-hidden bg-slate-100"
                  style={{ width: Math.min(embedWidth, 360), height: Math.min(embedHeight, 270), margin: '0 auto' }}
                >
                  <iframe
                    src={shareUrl}
                    className="w-full h-full border-0"
                    title="Embed preview"
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'image' && (
            <div className="space-y-4">
              <div>
                <p className="text-sm text-slate-600 mb-3">
                  Share a preview image of your wall. This is automatically used for link previews on Discord, Slack, and social media.
                </p>
              </div>

              <div className="rounded-lg border border-slate-200 overflow-hidden bg-slate-100">
                <img
                  src={screenshotUrl}
                  alt="Wall preview"
                  className="w-full h-auto"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'data:image/svg+xml,' + encodeURIComponent(
                      '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" fill="%23f1f5f9"><rect width="400" height="300"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="%2394a3b8" font-size="14">Wall screenshot will appear here</text></svg>'
                    );
                  }}
                />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => copyToClipboard(screenshotUrl, 'image-url')}
                  className="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  {copied === 'image-url' ? 'Copied!' : 'Copy URL'}
                </button>
                <a
                  href={screenshotUrl}
                  download={`${wallSlug}-wall.png`}
                  className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors text-center"
                >
                  Download
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
