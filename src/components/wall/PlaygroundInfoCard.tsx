'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';

const DISMISS_KEY = 'echoes_playground_info_dismissed';

export default function PlaygroundInfoCard() {
  const t = useTranslations();
  const [dismissed, setDismissed] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setDismissed(localStorage.getItem(DISMISS_KEY) === 'true');
    setHydrated(true);
  }, []);

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, 'true');
    setDismissed(true);
  };

  if (!hydrated || dismissed) return null;

  return (
    <div
      style={{
        position: 'fixed', top: 16, left: 16, right: 16, width: 'auto', maxWidth: 320,
        padding: 16, backgroundColor: '#eff6ff', border: '1px solid #93c5fd', borderRadius: 8,
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)', zIndex: 50, color: '#1e40af', fontSize: 14,
        fontFamily: "'Patrick Hand', cursive",
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <strong style={{ fontSize: 15 }}>{t('playgroundInfo.title')}</strong>
        <button
          onClick={handleDismiss}
          aria-label={t('playgroundInfo.dismiss')}
          style={{
            background: 'transparent', border: 'none', fontSize: 20, cursor: 'pointer', color: '#1e40af',
            padding: '0 0 0 8px', lineHeight: 1,
          }}
        >
          ×
        </button>
      </div>
      <p style={{ marginTop: 8, marginBottom: 12, lineHeight: 1.4 }}>
        {t('playgroundInfo.description')}
      </p>
      <Link
        href="/create"
        style={{
          display: 'block', padding: '8px 12px', backgroundColor: '#1e40af', color: '#ffffff',
          borderRadius: 6, textDecoration: 'none', textAlign: 'center', fontWeight: 600,
          transition: 'background-color 0.1s ease',
        }}
      >
        {t('playgroundInfo.createPermanent')}
      </Link>
    </div>
  );
}
