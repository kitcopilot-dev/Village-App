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
      className="fixed inset-0 bg-text/60 backdrop-blur-md flex justify-center items-start sm:items-center z-[100] p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div 
        className="bg-bg p-5 sm:p-10 md:p-14 rounded-[1.5rem] sm:rounded-[2rem] w-full max-w-[550px] shadow-[0_40px_80px_rgba(0,0,0,0.25)] border border-border animate-modal-slide my-auto relative"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-display text-2xl sm:text-4xl font-extrabold tracking-tight mb-1 sm:mb-4 leading-tight">{title}</h2>
        {subtitle && <p className="text-text-muted text-[10px] sm:text-base mb-4 sm:mb-10 leading-relaxed">{subtitle}</p>}
        <div className="modal-content-container pb-6">
          {children}
        </div>
      </div>
    </div>
  );
}
