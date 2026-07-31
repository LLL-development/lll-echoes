'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useToast } from '@/components/toast/ToastProvider';

type CreatedWall = { slug: string; editToken: string; editLink: string };

const THEMES = [
  { id: 'testimonials', label: 'Testimonials', icon: '/icons/testimony.webp', description: 'Gather reviews, stories, and appreciation from the people your community' },
  { id: 'feedback', label: 'Feedback', icon: '/icons/feedback.webp', description: 'Gather input, suggestions, or reactions from your audience' },
  { id: 'ideas', label: 'Ideas', icon: '/icons/ideas.webp', description: 'Brainstorm and share concepts' },
  { id: 'memory', label: 'Memory', icon: '/icons/memory.webp', description: 'moments, messages, or memories' },
  { id: 'others', label: 'Others', icon: '/icons/others.webp', description: 'Customize for any purpose' },
];

export default function CreateWallPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const [selectedTheme, setSelectedTheme] = useState(THEMES[0].id);
  const [isCreating, setIsCreating] = useState(false);
  const [createdWall, setCreatedWall] = useState<CreatedWall | null>(null);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [titleMissing, setTitleMissing] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);

  const handleCreate = useCallback(async () => {
    if (!title.trim()) {
      setTitleMissing(true);
      return;
    }
    setIsCreating(true);

    try {
      const response = await fetch('/api/walls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          theme: selectedTheme,
          mode: 'PUBLIC',
          title,
          description: description || undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        showToast(errorData.error || 'Failed to create wall', 'error');
        setIsCreating(false);
        return;
      }

      const data = await response.json();
      localStorage.setItem(`echoes_edit_token_${data.slug}`, data.editToken);
      setCreatedWall({ slug: data.slug, editToken: data.editToken, editLink: data.editLink });
    } catch (err) {
      showToast('Network error. Please try again.', 'error');
      setIsCreating(false);
    }
  }, [selectedTheme, title, description, showToast]);

  useEffect(() => {
    setCopied(false);
    setCopyError(false);
  }, [createdWall]);

  return (
    <div
      className="relative min-h-screen overflow-hidden px-4 py-8"
      style={{ backgroundColor: '#fffef9' }}
    >
      {createdWall ? (
        <div className="relative min-h-screen flex items-center justify-center">
          <div className="max-w-lg w-full mx-4 p-8 rounded-2xl shadow-lg" style={{ backgroundColor: '#ffffff', border: '2px solid #775537' }}>
            <h1 className="text-3xl font-bold mb-2" style={{ color: '#775537', fontFamily: "'Patrick Hand', cursive" }}>
              Your wall is ready!
            </h1>
            <p className="text-sm mb-6" style={{ color: '#775537', opacity: 0.7 }}>
              Save the link below. You&rsquo;ll need it to manage your wall.
            </p>

            {/* Edit Link */}
            <div className="mb-4">
              <label className="block text-xs font-semibold mb-1.5" style={{ color: '#775537' }}>Edit Link</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={`${typeof window !== 'undefined' ? window.location.origin : ''}/w/${createdWall.slug}`}
                  className="flex-1 rounded-lg border px-3 py-2 text-sm bg-slate-50"
                  style={{ borderColor: '#c4a77d', color: '#775537' }}
                />
                <button
                  onClick={async () => {
                    try {
                      setCopyError(false);
                      if (!navigator.clipboard) {
                        throw new Error('Clipboard unavailable');
                      }
                      await navigator.clipboard.writeText(
                        `${window.location.origin}/w/${createdWall.slug}`
                      );
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    } catch {
                      setCopyError(true);
                    }
                  }}
                  className="rounded-lg px-4 py-2 text-sm font-medium"
                  style={{ backgroundColor: '#775537', color: '#FBE29D' }}
                >
                  {copied ? 'Copied!' : copyError ? 'Copy failed — select the link manually' : 'Copy'}
                </button>
                {copyError && (
                  <p className="text-xs mt-1" style={{ color: '#991B1B' }}>
                    Could not copy. Select the link above and copy it manually.
                  </p>
                )}
              </div>
            </div>

            {/* Warning */}
            <div className="mb-6 px-4 py-3 rounded-lg" style={{ backgroundColor: '#FFF5F5', border: '1px solid #FCA5A5' }}>
              <p className="text-xs font-medium" style={{ color: '#991B1B' }}>
                ⚠️ This link is your only way to manage the wall. If you switch browsers or clear your data, you&rsquo;ll lose edit access.
              </p>
            </div>

            {/* Go to wall button */}
            <button
              disabled={isNavigating}
              onClick={async () => {
                setIsNavigating(true);
                await router.push(`/w/${createdWall.slug}`);
              }}
              onMouseDown={(e) => {
                if (!isNavigating) {
                  e.currentTarget.style.transform = 'translateY(2px)';
                  e.currentTarget.style.boxShadow = '0 3px 0 #775537, 0 4px 8px rgba(119,85,55,0.2)';
                }
              }}
              onMouseUp={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 5px 0 #775537, 0 6px 12px rgba(119,85,55,0.2)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 5px 0 #775537, 0 6px 12px rgba(119,85,55,0.2)';
              }}
              className="w-full rounded-xl px-6 py-3 text-base font-bold tracking-wider transition-all duration-150 select-none"
              style={{
                backgroundColor: isNavigating ? '#f5d988' : '#fbe29d',
                color: '#775537',
                fontFamily: "'Patrick Hand', cursive",
                boxShadow: '0 5px 0 #775537, 0 6px 12px rgba(119,85,55,0.2)',
                cursor: isNavigating ? 'not-allowed' : 'pointer',
                opacity: isNavigating ? 0.8 : 1,
                transform: 'translateY(0)',
              }}
            >
              {isNavigating ? (
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  <svg
                    className="animate-spin"
                    style={{ width: '20px', height: '20px' }}
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Loading...
                </span>
              ) : (
                'Go to Wall'
              )}
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Logo */}
          <Image
            src="/logo.webp"
            alt="Logo"
            className="absolute top-6 left-6 z-20"
            width={100}
            height={100}
          />

          {/* Title & Subtitle */}
          <div
            className="absolute z-10 text-center"
            style={{ top: '80px', left: '50%', transform: 'translateX(-50%)' }}
          >
            <h1
              className="text-3xl font-bold"
              style={{ color: '#775537', fontFamily: "'Patrick Hand', 'Caveat', cursive, sans-serif" }}
            >
              Build Your Board
            </h1>
            <p className="text-base mt-1 italic" style={{ color: '#775537', opacity: 0.7 }}>
              A shared space for notes, stories, and memories
            </p>
          </div>

          {/* Board background container */}
          <div
            className="absolute top-12 right-12 bottom-12 left-4 z-10"
            style={{
              backgroundImage: "url('/createbg.webp')",
              backgroundSize: 'contain',
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'center',
            }}
          >
            {/* Inner padding to place content on the board */}
            <div className="h-full">
              {/* Theme Column */}
              <div
                  className="absolute top-[22vh] left-1/2 w-full max-w-[520px] -translate-x-1/2 px-4"
                >
                  {/* Sentence line: "Create a [select] wall called [input]" */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ color: '#775537', fontSize: 17, fontFamily: "'Patrick Hand', cursive", whiteSpace: 'nowrap' }}>
                      Create a
                    </span>
                    <select
                      value={selectedTheme}
                      onChange={(e) => setSelectedTheme(e.target.value)}
                      style={{
                        padding: '12px 16px',
                        fontSize: 17,
                        fontFamily: "'Patrick Hand', cursive",
                        border: '2px solid #c4a77d',
                        borderRadius: 10,
                        backgroundColor: '#f5f0e8',
                        color: '#775537',
                        outline: 'none',
                        cursor: 'pointer',
                        minWidth: '160px',
                      }}
                    >
                      {THEMES.map((theme) => (
                        <option key={theme.id} value={theme.id}>
                          {theme.label}
                        </option>
                      ))}
                    </select>
                    <span style={{ color: '#775537', fontSize: 17, fontFamily: "'Patrick Hand', cursive", whiteSpace: 'nowrap' }}>
                      wall called <span style={{ color: '#dc2626' }}>*</span>
                    </span>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => {
                        setTitle(e.target.value);
                        if (e.target.value.trim()) setTitleMissing(false);
                      }}
                      maxLength={100}
                      required
                      placeholder="e.g. Café Luna Guestbook"
                      style={{
                        flex: '1 1 180px',
                        minWidth: 0,
                        padding: '12px 16px',
                        fontSize: 17,
                        fontFamily: "'Patrick Hand', cursive",
                        border: `2px solid ${titleMissing ? '#dc2626' : '#c4a77d'}`,
                        borderRadius: 10,
                        backgroundColor: '#ffffff',
                        boxSizing: 'border-box',
                        outline: 'none',
                        color: '#775537',
                      }}
                    />
                    {titleMissing && (
                      <p style={{ 
                        color: '#dc2626', 
                        fontSize: 14, 
                        margin: '4px 0 0 0',
                        fontStyle: 'italic'
                      }}>
                        Please give your wall a name.
                      </p>
                    )}
                  </div>

                  {/* Selected theme description as helper text */}
                  <p style={{ color: '#775537', opacity: 0.6, fontSize: 14, margin: '8px 0 0 0', fontStyle: 'italic' }}>
                    {THEMES.find((t) => t.id === selectedTheme)?.description}
                  </p>

                  {/* Description input */}
                  <div style={{ marginTop: 20 }}>
                    <label
                      className="block text-base font-bold tracking-wide mb-2"
                      style={{ color: '#775537' }}
                    >
                      Description (optional)
                    </label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      maxLength={200}
                      placeholder="Share a message or story"
                      rows={3}
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        fontSize: 17,
                        fontFamily: "'Patrick Hand', cursive",
                        border: '2px solid #c4a77d',
                        borderRadius: 10,
                        backgroundColor: '#ffffff',
                        boxSizing: 'border-box',
                        outline: 'none',
                        color: '#775537',
                        resize: 'vertical',
                        minHeight: '250px',
                      }}
                    />
            </div>
          </div>
          </div>
        </div>

        {/* Create Board Button */}
          <div
            className="absolute z-10"
            style={{ top: '810px', left: '50%', transform: 'translateX(-50%)' }}
          >
            <button
              onClick={handleCreate}
              disabled={isCreating}
              className="rounded-xl px-12 py-3.5 text-base font-bold tracking-wider transition-all duration-150 select-none"
              style={{
                backgroundColor: '#FBE29D',
                color: '#775537',
                border: '2px solid #775537',
                boxShadow: '0 5px 0 #775537, 0 6px 12px rgba(119,85,55,0.2)',
                textDecoration: 'none',
                transition: 'transform 0.1s ease, boxShadow 0.1s ease',
              }}
              onMouseEnter={(e) => {
                if (!isCreating) {
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = '0 6px 0 #775537, 0 8px 16px rgba(119,85,55,0.25)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isCreating) {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 5px 0 #775537, 0 6px 12px rgba(119,85,55,0.2)';
                }
              }}
              onMouseDown={(e) => {
                if (!isCreating) {
                  e.currentTarget.style.transform = 'translateY(3px)';
                  e.currentTarget.style.boxShadow = '0 2px 0 #775537, 0 2px 4px rgba(119,85,55,0.2)';
                }
              }}
              onMouseUp={(e) => {
                if (!isCreating) {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 5px 0 #775537, 0 6px 12px rgba(119,85,55,0.2)';
                }
              }}
            >
              {isCreating ? (
                <div className="flex items-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Creating...
                </div>
              ) : (
                'Create Board'
              )}
            </button>
          </div>

          {/* Back Home */}
          <div
            className="absolute z-10"
            style={{ top: '880px', left: '50%', transform: 'translateX(-50%)' }}
          >
            <button
              onClick={() => router.push('/w/playground')}
              className="inline-flex items-center gap-1.5 text-sm transition-all duration-200"
              style={{ color: '#775537' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.opacity = '0.7';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = '1';
              }}
            >
              ← Back Home
            </button>
          </div>
        </>
      )}
    </div>
  );
}
