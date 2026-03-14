'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface NavLink {
  href: string;
  label: string;
  emoji: string;
  description: string;
}

interface MobileNavProps {
  isOpen: boolean;
  onClose: () => void;
  isAdmin?: boolean;
  onLogout?: () => void;
}

const NAV_SECTIONS = {
  daily: {
    title: 'Daily',
    links: [
      { href: '/dashboard', label: 'Dashboard', emoji: '🏠', description: 'Overview & quick actions' },
      { href: '/attendance', label: 'Attendance', emoji: '✓', description: 'Mark daily attendance' },
      { href: '/assignments', label: 'Assignments', emoji: '📝', description: 'Tasks & homework' },
    ]
  },
  learning: {
    title: 'Learning',
    links: [
      { href: '/manage-kids', label: 'Students', emoji: '👧', description: 'Manage your children' },
      { href: '/portfolio', label: 'Portfolio', emoji: '🎨', description: 'Work samples & photos' },
      { href: '/transcript', label: 'Transcript', emoji: '📜', description: 'Official academic record' },
    ]
  },
  planning: {
    title: 'Planning',
    links: [
      { href: '/calendar', label: 'Calendar', emoji: '📅', description: 'School year & breaks' },
      { href: '/events', label: 'Events', emoji: '🎉', description: 'Community gatherings' },
    ]
  },
  community: {
    title: 'Community',
    links: [
      { href: '/map', label: 'Map', emoji: '🗺️', description: 'Find local families' },
      { href: '/legal-guides', label: 'Legal Guides', emoji: '⚖️', description: 'State requirements' },
    ]
  },
  account: {
    title: 'Account',
    links: [
      { href: '/profile', label: 'Profile', emoji: '👤', description: 'Your family profile' },
    ]
  }
};

export function MobileNav({ isOpen, onClose, isAdmin = false, onLogout }: MobileNavProps) {
  const pathname = usePathname();
  
  // Close drawer on route change
  useEffect(() => {
    onClose();
  }, [pathname]);
  
  // Prevent body scroll when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleEscape);
      return () => window.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, onClose]);

  return (
    <>
      {/* Backdrop */}
      <div 
        className={`fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
        aria-hidden="true"
      />
      
      {/* Drawer */}
      <nav 
        className={`fixed top-0 left-0 h-full w-[85%] max-w-[320px] bg-bg z-[70] shadow-2xl transform transition-transform duration-300 ease-out overflow-hidden flex flex-col ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border bg-bg-alt">
          <h1 className="font-display text-2xl font-extrabold text-primary uppercase tracking-tighter">
            Village<span className="text-secondary">.</span>
          </h1>
          <button
            onClick={onClose}
            className="p-2 -mr-2 rounded-full hover:bg-border transition-colors"
            aria-label="Close menu"
          >
            <svg className="w-6 h-6 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto overscroll-contain">
          <div className="p-4 space-y-6">
            {Object.entries(NAV_SECTIONS).map(([key, section]) => (
              <div key={key}>
                <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-text-muted mb-3 px-2">
                  {section.title}
                </h2>
                <div className="space-y-1">
                  {section.links.map((link) => {
                    const isActive = pathname === link.href;
                    return (
                      <Link
                        key={link.href}
                        href={link.href}
                        className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-all ${
                          isActive 
                            ? 'bg-primary/10 text-primary' 
                            : 'text-text hover:bg-bg-alt'
                        }`}
                      >
                        <span className="text-xl w-8 text-center">{link.emoji}</span>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-sm">{link.label}</div>
                          <div className="text-[11px] text-text-muted truncate">{link.description}</div>
                        </div>
                        {isActive && (
                          <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
                        )}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
            
            {/* Admin section */}
            {isAdmin && (
              <div>
                <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-accent mb-3 px-2">
                  Admin
                </h2>
                <Link
                  href="/admin"
                  className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-all ${
                    pathname === '/admin' 
                      ? 'bg-accent/10 text-accent' 
                      : 'text-text hover:bg-bg-alt'
                  }`}
                >
                  <span className="text-xl w-8 text-center">🛠️</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm">Admin Panel</div>
                    <div className="text-[11px] text-text-muted">System management</div>
                  </div>
                </Link>
              </div>
            )}
          </div>
        </div>
        
        {/* Footer with logout */}
        {onLogout && (
          <div className="p-4 border-t border-border bg-bg-alt">
            <button
              onClick={onLogout}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-red-50 text-red-600 font-semibold text-sm hover:bg-red-100 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Sign Out
            </button>
          </div>
        )}
      </nav>
    </>
  );
}
