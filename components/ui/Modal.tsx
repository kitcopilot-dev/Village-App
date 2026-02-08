'use client';

import React, { useEffect } from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}

export function Modal({ isOpen, onClose, title, subtitle, children }: ModalProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-text/60 backdrop-blur-md flex justify-center items-center z-50"
      onClick={onClose}
    >
      <div 
        className="bg-bg p-6 sm:p-10 md:p-14 rounded-[2rem] w-[95%] sm:w-[90%] max-w-[550px] shadow-[0_40px_80px_rgba(0,0,0,0.25)] border border-border animate-modal-slide max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight mb-2 sm:mb-4">{title}</h2>
        {subtitle && <p className="text-text-muted text-sm sm:text-base mb-6 sm:mb-10">{subtitle}</p>}
        {children}
      </div>
    </div>
  );
}
