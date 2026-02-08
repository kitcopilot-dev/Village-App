'use client';

import { useEffect } from 'react';

interface ToastProps {
  message: string;
  type?: 'success' | 'error' | 'info';
  onClose: () => void;
  duration?: number;
}

export function Toast({ message, type = 'success', onClose, duration = 3000 }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
  }, [onClose, duration]);

  const styles = {
    success: 'bg-primary text-white',
    error: 'bg-red-500 text-white',
    info: 'bg-secondary text-white'
  };

  const icons = {
    success: '✓',
    error: '✗',
    info: 'ℹ'
  };

  return (
    <div
      className={`fixed bottom-8 right-8 ${styles[type]} px-6 py-4 rounded-2xl shadow-xl flex items-center gap-3 animate-fade-in z-50`}
      role="alert"
    >
      <span className="text-2xl">{icons[type]}</span>
      <span className="font-semibold">{message}</span>
      <button
        onClick={onClose}
        className="ml-4 text-xl opacity-75 hover:opacity-100"
        aria-label="Close"
      >
        ×
      </button>
    </div>
  );
}
