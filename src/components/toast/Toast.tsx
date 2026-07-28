'use client';

import { useEffect, useState } from 'react';

type ToastType = 'success' | 'error' | 'info';

interface ToastProps {
  message: string;
  type: ToastType;
  onClose: () => void;
}

const typeConfig: Record<ToastType, { bg: string; border: string; text: string; icon: string }> = {
  success: { bg: '#f0fdf4', border: '#86efac', text: '#166534', icon: '✓' },
  error: { bg: '#fef2f2', border: '#fca5a5', text: '#991b1b', icon: '⚠' },
  info: { bg: '#eff6ff', border: '#93c5fd', text: '#1e40af', icon: 'ℹ' },
};

export default function Toast({ message, type, onClose }: ToastProps) {
  const [visible, setVisible] = useState(false);
  const config = typeConfig[type];

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div
      role="alert"
      style={{
        width: 320,
        padding: 16,
        borderRadius: 8,
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        backgroundColor: config.bg,
        border: `1px solid ${config.border}`,
        color: config.text,
        fontSize: 14,
        fontFamily: 'inherit',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(10px)',
        transition: 'opacity 200ms ease, transform 200ms ease',
        position: 'relative',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontWeight: 600 }}>{config.icon}</span>
        <button
          onClick={onClose}
          aria-label="Close notification"
          style={{
            background: 'none',
            border: 'none',
            fontSize: 18,
            cursor: 'pointer',
            color: config.text,
            padding: '0 4px',
            lineHeight: 1,
          }}
        >
          ×
        </button>
      </div>
      <div>{message}</div>
    </div>
  );
}
