'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

interface QuickAction {
  id: string;
  label: string;
  emoji: string;
  href?: string;
  onClick?: () => void;
  color: string;
  description: string;
}

const QUICK_ACTIONS: QuickAction[] = [
  {
    id: 'attendance',
    label: 'Mark Attendance',
    emoji: '✓',
    href: '/attendance',
    color: 'bg-green-500',
    description: 'Log today\'s attendance'
  },
  {
    id: 'assignment',
    label: 'New Assignment',
    emoji: '📝',
    href: '/assignments?new=true',
    color: 'bg-blue-500',
    description: 'Create a task or homework'
  },
  {
    id: 'portfolio',
    label: 'Add to Portfolio',
    emoji: '📸',
    href: '/portfolio?new=true',
    color: 'bg-purple-500',
    description: 'Upload work samples'
  },
  {
    id: 'lesson',
    label: 'Complete Lesson',
    emoji: '📚',
    href: '/manage-kids',
    color: 'bg-amber-500',
    description: 'Mark lessons done'
  },
];

interface QuickActionsProps {
  className?: string;
}

export function QuickActions({ className = '' }: QuickActionsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  
  // Ensure client-side only rendering to avoid hydration issues
  useEffect(() => {
    setMounted(true);
  }, []);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Close on escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    
    if (isOpen) {
      window.addEventListener('keydown', handleEscape);
      return () => window.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen]);

  const handleAction = (action: QuickAction) => {
    setIsOpen(false);
    if (action.onClick) {
      action.onClick();
    } else if (action.href) {
      router.push(action.href);
    }
  };

  if (!mounted) return null;

  return (
    <div 
      ref={containerRef}
      className={`fixed bottom-6 right-6 z-50 ${className}`}
    >
      {/* Action buttons - appear when FAB is open */}
      <div className={`absolute bottom-full right-0 mb-4 flex flex-col-reverse items-end gap-3 transition-all duration-300 ${
        isOpen ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
      }`}>
        {QUICK_ACTIONS.map((action, index) => (
          <button
            key={action.id}
            onClick={() => handleAction(action)}
            className="group flex items-center gap-3 transition-all duration-200"
            style={{ 
              transitionDelay: isOpen ? `${index * 50}ms` : '0ms',
              transform: isOpen ? 'scale(1)' : 'scale(0.8)',
            }}
            aria-label={action.label}
          >
            {/* Label tooltip */}
            <span className="bg-text-main text-bg px-3 py-1.5 rounded-lg text-sm font-semibold shadow-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
              {action.label}
            </span>
            
            {/* Action button */}
            <div className={`w-12 h-12 rounded-full ${action.color} shadow-lg flex items-center justify-center text-white text-xl transform transition-transform group-hover:scale-110 group-active:scale-95`}>
              {action.emoji}
            </div>
          </button>
        ))}
      </div>

      {/* Main FAB */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-14 h-14 rounded-full bg-primary shadow-xl flex items-center justify-center text-white transition-all duration-300 hover:bg-primary-dark hover:shadow-2xl active:scale-95 ${
          isOpen ? 'rotate-45 bg-secondary' : ''
        }`}
        aria-label={isOpen ? 'Close quick actions' : 'Open quick actions'}
        aria-expanded={isOpen}
      >
        <svg 
          className="w-7 h-7" 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={2.5} 
            d="M12 4v16m8-8H4" 
          />
        </svg>
      </button>

      {/* Backdrop for mobile */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/20 -z-10 md:hidden"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}
    </div>
  );
}
