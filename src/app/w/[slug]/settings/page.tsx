'use client';

import { useEffect, useState, FormEvent, use } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/toast/ToastProvider';

export default function WallSettingsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const router = useRouter();
  const { showToast } = useToast();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [embedBgColor, setEmbedBgColor] = useState('#ffffff');
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
          setEmbedBgColor(data.wall.embed_bg_color || '#ffffff');
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
          body: JSON.stringify({ title, description, embed_bg_color: embedBgColor }),
        }
      );

      if (!res.ok) {
        const data = await res.json();
        showToast(data.error || 'Failed to save', 'error');
        setSaving(false);
        return;
      }

      showToast('Settings saved', 'success');
      setSaving(false);
      setTimeout(() => router.push(`/w/${slug}`), 1000);
    } catch {
      showToast('Failed to save', 'error');
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this wall? This cannot be undone.')) {
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
        showToast(data.error || 'Failed to delete', 'error');
        setDeleting(false);
        return;
      }

      showToast('Wall deleted', 'success');
      router.push('/');
    } catch {
      showToast('Failed to delete', 'error');
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
            You don't have edit access to this wall. If you created it, make sure you're using the same browser and haven't cleared your data.
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
            Back to wall
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
          ← Back to wall
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
          Wall Settings
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
            Saved!
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
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={100}
              placeholder="My Wall"
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
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={200}
              placeholder="A wall for sharing..."
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

          <div style={{ marginBottom: 32 }}>
            <label
              style={{
                display: 'block',
                fontSize: 18,
                color: '#775537',
                marginBottom: 8,
              }}
            >
              Embed Background Color
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <input
                type="color"
                value={embedBgColor}
                onChange={(e) => setEmbedBgColor(e.target.value)}
                defaultValue="#ffffff"
                style={{
                  width: 48,
                  height: 48,
                  border: '1px solid #c4a77d',
                  borderRadius: 8,
                  backgroundColor: '#f5f0e8',
                  cursor: 'pointer',
                  padding: 2,
                }}
              />
              <span style={{ fontSize: 16, color: '#666' }}>{embedBgColor}</span>
            </div>
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
              {saving ? 'Saving...' : 'Save'}
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
              {deleting ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
