'use client';

import { useEffect, useState, FormEvent, use } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/toast/ToastProvider';
import { useTranslations } from 'next-intl';

export default function WallSettingsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const router = useRouter();
  const { showToast } = useToast();
  const t = useTranslations();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [saved, setSaved] = useState(false);
  const [noAccess, setNoAccess] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem(`echoes_edit_token_${slug}`);
    if (!token) {
      setNoAccess(true);
      setLoading(false);
      return;
    }

    fetch(
      `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3500'}/api/walls/${slug}`,
      { headers: { 'Cache-Control': 'no-cache' } }
    )
      .then((res) => res.json())
      .then((data) => {
        if (data?.wall) {
          setTitle(data.wall.title || '');
          setDescription(data.wall.description || '');
        }
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, [slug]);

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaved(false);

    const token = localStorage.getItem(`echoes_edit_token_${slug}`);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3500'}/api/walls/${slug}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'X-Edit-Token': token || '',
          },
          body: JSON.stringify({ title, description }),
        }
      );

      if (!res.ok) {
        const data = await res.json();
        showToast(data.error || t('toast.saveFailed'), 'error');
        setSaving(false);
        return;
      }

      showToast(t('toast.settingsSaved'), 'success');
      setSaving(false);
      setTimeout(() => { window.location.href = `/w/${slug}`; }, 1000);
    } catch {
      showToast(t('toast.saveFailed'), 'error');
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(t('confirm.deleteWall'))) {
      return;
    }

    setDeleting(true);

    const token = localStorage.getItem(`echoes_edit_token_${slug}`);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3500'}/api/walls/${slug}`,
        {
          method: 'DELETE',
          headers: {
            'X-Edit-Token': token || '',
          },
        }
      );

      if (!res.ok) {
        const data = await res.json();
        showToast(data.error || t('toast.deleteFailed'), 'error');
        setDeleting(false);
        return;
      }

      showToast(t('toast.wallDeleted'), 'success');
      router.push('/w/playground');
    } catch {
      showToast(t('toast.deleteFailed'), 'error');
      setDeleting(false);
    }
  };

  if (loading) {
    return null;
  }

  if (noAccess) {
    return (
      <div
        style={{
          minHeight: '100vh',
          backgroundColor: '#fffef9',
          fontFamily: "'Patrick Hand', cursive",
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
        }}
      >
        <div style={{ maxWidth: 480, textAlign: 'center' }}>
          <p style={{ fontSize: 20, marginBottom: 24, color: '#333' }}>
            {t('settings.noAccessTitle')}
          </p>
          <a
            href={`/w/${slug}`}
            style={{
              color: '#775537',
              fontSize: 18,
              textDecoration: 'underline',
              cursor: 'pointer',
            }}
          >
            {t('settings.noAccessBack')}
          </a>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#fffef9',
        fontFamily: "'Patrick Hand', cursive",
        padding: 32,
      }}
    >
      <div style={{ maxWidth: 560, margin: '0 auto' }}>
        <a
          href={`/w/${slug}`}
          style={{
            color: '#775537',
            fontSize: 18,
            textDecoration: 'none',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            marginBottom: 32,
          }}
        >
          {t('settings.backToWall')}
        </a>

        <h1
          style={{
            fontSize: 32,
            fontWeight: 700,
            color: '#775537',
            marginBottom: 32,
            fontFamily: "'Patrick Hand', cursive",
          }}
        >
          {t('settings.pageTitle')}
        </h1>

        {saved && (
          <div
            style={{
              backgroundColor: '#e6f9e6',
              color: '#276749',
              padding: 12,
              borderRadius: 8,
              marginBottom: 20,
              fontSize: 18,
            }}
          >
            {t('settings.saved')}
          </div>
        )}

        <form onSubmit={handleSave}>
          <div style={{ marginBottom: 24 }}>
            <label
              style={{
                display: 'block',
                fontSize: 18,
                color: '#775537',
                marginBottom: 8,
              }}
            >
              {t('settings.titleLabel')}
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={100}
              placeholder={t('settings.titlePlaceholder')}
              style={{
                width: '100%',
                padding: '10px 14px',
                fontSize: 18,
                fontFamily: "'Patrick Hand', cursive",
                border: '1px solid #c4a77d',
                borderRadius: 8,
                backgroundColor: '#f5f0e8',
                boxSizing: 'border-box',
                outline: 'none',
              }}
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label
              style={{
                display: 'block',
                fontSize: 18,
                color: '#775537',
                marginBottom: 8,
              }}
            >
              {t('settings.descriptionLabel')}
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={200}
              placeholder={t('settings.descriptionPlaceholder')}
              rows={4}
              style={{
                width: '100%',
                padding: '10px 14px',
                fontSize: 18,
                fontFamily: "'Patrick Hand', cursive",
                border: '1px solid #c4a77d',
                borderRadius: 8,
                backgroundColor: '#f5f0e8',
                boxSizing: 'border-box',
                outline: 'none',
                resize: 'vertical',
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <button
              type="submit"
              disabled={saving}
              style={{
                padding: '12px 32px',
                fontSize: 20,
                fontFamily: "'Patrick Hand', cursive",
                backgroundColor: '#775537',
                color: '#fffef9',
                border: 'none',
                borderRadius: 8,
                cursor: saving ? 'not-allowed' : 'pointer',
                opacity: saving ? 0.6 : 1,
              }}
            >
              {saving ? t('settings.saving') : t('settings.save')}
            </button>

            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              style={{
                padding: '12px 32px',
                fontSize: 20,
                fontFamily: "'Patrick Hand', cursive",
                backgroundColor: 'transparent',
                color: '#c53030',
                border: '1px solid #c53030',
                borderRadius: 8,
                cursor: deleting ? 'not-allowed' : 'pointer',
                opacity: deleting ? 0.6 : 1,
              }}
            >
              {deleting ? t('settings.deleting') : t('settings.delete')}
            </button>
          </div>
        </form>

        {/* Copy Edit Link Section */}
        <div style={{ marginTop: 32, paddingTop: 24, borderTop: '1px solid #c4a77d' }}>
          <h2
            style={{
              fontSize: 22,
              fontWeight: 700,
              color: '#775537',
              marginBottom: 12,
              fontFamily: "'Patrick Hand', cursive",
            }}
          >
            {t('settings.editLinkTitle')}
          </h2>
          <p style={{ fontSize: 14, color: '#775537', opacity: 0.7, marginBottom: 16 }}>
            {t('settings.editLinkDesc')}
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="text"
              readOnly
              value={typeof window !== 'undefined' ? `${window.location.origin}/w/${slug}?edit_token=${localStorage.getItem(`echoes_edit_token_${slug}`) || ''}` : ''}
              style={{
                flex: 1,
                padding: '10px 14px',
                fontSize: 14,
                fontFamily: 'monospace',
                border: '1px solid #c4a77d',
                borderRadius: 8,
                backgroundColor: '#f5f0e8',
                color: '#775537',
                boxSizing: 'border-box',
                outline: 'none',
              }}
            />
            <button
              type="button"
              onClick={async () => {
                try {
                  const token = localStorage.getItem(`echoes_edit_token_${slug}`);
                  if (!token) return;
                  await navigator.clipboard.writeText(
                    `${window.location.origin}/w/${slug}?edit_token=${token}`
                  );
                  showToast(t('settings.editLinkCopied'), 'success');
                } catch {
                  showToast(t('settings.copyFailed'), 'error');
                }
              }}
              style={{
                padding: '10px 20px',
                fontSize: 16,
                fontFamily: "'Patrick Hand', cursive",
                backgroundColor: '#775537',
                color: '#FBE29D',
                border: 'none',
                borderRadius: 8,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {t('settings.copyEditLink')}
            </button>
          </div>
          <div
            style={{
              marginTop: 12,
              padding: '8px 12px',
              backgroundColor: '#FFF5F5',
              border: '1px solid #FCA5A5',
              borderRadius: 8,
            }}
          >
            <p style={{ fontSize: 12, color: '#991B1B', margin: 0 }}>
              {t('settings.editLinkWarning')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
