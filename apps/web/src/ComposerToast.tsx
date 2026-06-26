import { useEffect } from 'react';

export type ToastType = 'success' | 'error' | 'info';

export function ComposerToast({
  message,
  type = 'info',
  onClose,
}: {
  message: string;
  type?: ToastType;
  onClose: () => void;
}) {
  useEffect(() => {
    const t = setTimeout(onClose, 4500);
    return () => clearTimeout(t);
  }, [message, onClose]);

  const bg =
    type === 'error' ? '#fef2f2' : type === 'success' ? '#f0fdf4' : '#eff6ff';
  const color =
    type === 'error' ? '#b91c1c' : type === 'success' ? '#15803d' : '#1d4ed8';

  return (
    <div
      className="composer-toast"
      role="status"
      style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        zIndex: 9999,
        padding: '0.65rem 1rem',
        borderRadius: 8,
        boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
        background: bg,
        color,
        maxWidth: 360,
        fontSize: '0.9rem',
      }}
    >
      {message}
      <button
        type="button"
        onClick={onClose}
        style={{
          marginLeft: 12,
          border: 'none',
          background: 'transparent',
          cursor: 'pointer',
          color: 'inherit',
        }}
        aria-label="Đóng"
      >
        ×
      </button>
    </div>
  );
}
