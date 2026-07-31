'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useToast } from '@/components/toast/ToastProvider';

const DISMISS_KEY = 'echoes_playground_info_dismissed';

export default function PlaygroundInfoCard() {
  const [dismissed, setDismissed] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const { showToast } = useToast();

  // Hydrate dismissal state from localStorage after mount
  useEffect(() => {
    setDismissed(localStorage.getItem(DISMISS_KEY) === 'true');
    setHydrated(true);
  }, []);

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, 'true');
    setDismissed(true);
  };

  // Don't render anything until hydration is complete (prevents flash)
  if (!hydrated || dismissed) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 16,
        left: 16,
        right: 16,
        width: 'auto',
        maxWidth: 320,
        padding: 16,
        backgroundColor: '#eff6ff',
        border: '1px solid #93c5fd',
        borderRadius: 8,
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        zIndex: 50,
        color: '#1e40af',
        fontSize: 14,
        fontFamily: "'Patrick Hand', cursive",
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <strong style={{ fontSize: 15 }}>🎮 Playground Mode</strong>
        <button
          onClick={handleDismiss}
          aria-label="Dismiss"
          style={{
            background: 'transparent',
            border: 'none',
            fontSize: 20,
            cursor: 'pointer',
            color: '#1e40af',
            padding: '0 0 0 8px',
            lineHeight: 1,
          }}
        >
          ×
        </button>
      </div>
      <p style={{ marginTop: 8, marginBottom: 12, lineHeight: 1.4 }}>
        Your notes are temporary and will be cleaned up after 24 hours.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Link
          href="/create"
          style={{
            display: 'block',
            padding: '8px 12px',
            backgroundColor: '#1e40af',
            color: '#ffffff',
            borderRadius: 6,
            textDecoration: 'none',
            textAlign: 'center',
            fontWeight: 600,
            transition: 'background-color 0.1s ease',
          }}
        >
          Create a permanent wall
        </Link>
        <button
          onClick={() => {
            // Migration UI — fires a custom DOM event the parent listens for
            window.dispatchEvent(new CustomEvent('echoes:migrate-playground'));
          }}
          style={{
            padding: '8px 12px',
            backgroundColor: 'transparent',
            border: '1px solid #1e40af',
            color: '#1e40af',
            borderRadius: 6,
            cursor: 'pointer',
            fontWeight: 600,
          }}
        >
          Keep my notes →
        </button>
      </div>
    </div>
  );
}
