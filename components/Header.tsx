'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from './ui/Button';
import { MobileNav } from './MobileNav';
import { getPocketBase } from '@/lib/pocketbase';

interface HeaderProps {
  onLogout?: () => void;
  showLogout?: boolean;
}

const ADMIN_EMAILS = ['jtown.80@gmail.com', 'jlynch8080@pm.me'];

export function Header({ onLogout, showLogout = false }: HeaderProps) {
  const pathname = usePathname();
  const pb = getPocketBase();
  const isAdmin = pb.authStore.isValid && ADMIN_EMAILS.includes(pb.authStore.model?.email);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  
  const handleLogout = () => {
    pb.authStore.clear();
    if (onLogout) onLogout();
  };
  
  return (
    <>
      <header className="bg-bg/80 backdrop-blur-md px-4 md:px-16 py-4 md:py-6 flex justify-between items-center sticky top-0 z-50 transition-all border-b border-border/50">
        {/* Left side: hamburger (mobile) + logo */}
        <div className="flex items-center gap-3">
          {/* Hamburger menu - mobile only */}
          {showLogout && (
            <button
              onClick={() => setIsMobileNavOpen(true)}
              className="md:hidden p-2 -ml-2 rounded-lg hover:bg-bg-alt transition-colors"
              aria-label="Open menu"
              aria-expanded={isMobileNavOpen}
            >
              <svg className="w-6 h-6 text-text" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          )}
          
          <Link href="/">
            <h1 className="font-display text-xl md:text-2xl font-extrabold m-0 text-primary uppercase tracking-tighter cursor-pointer hover:text-primary-light transition-colors">
              Village<span className="text-secondary">.</span>
            </h1>
          </Link>
        </div>
        
        {/* Desktop navigation */}
        <nav className="flex gap-2 md:gap-4 items-center">
          {showLogout && (
            <>
              {isAdmin && (
                <Link 
                  href="/admin" 
                  className={`hidden md:inline-block px-3 py-2 rounded-lg font-bold text-sm transition-colors text-accent hover:bg-accent/10 ${
                    pathname === '/admin' ? 'bg-accent/20' : ''
                  }`}
                >
                  🛠️ Admin
                </Link>
              )}
              <Link 
                href="/dashboard" 
                className={`hidden md:inline-block px-3 py-2 rounded-lg font-semibold text-sm transition-colors ${
                  pathname === '/dashboard' 
                    ? 'bg-primary/10 text-primary' 
                    : 'text-text-muted hover:text-text hover:bg-bg-alt'
                }`}
              >
                Dashboard
              </Link>
              <Link 
                href="/manage-kids" 
                className={`hidden md:inline-block px-3 py-2 rounded-lg font-semibold text-sm transition-colors ${
                  pathname === '/manage-kids' 
                    ? 'bg-primary/10 text-primary' 
                    : 'text-text-muted hover:text-text hover:bg-bg-alt'
                }`}
              >
                Manage
              </Link>
              <Link 
                href="/attendance" 
                className={`hidden md:inline-block px-3 py-2 rounded-lg font-semibold text-sm transition-colors ${
                  pathname === '/attendance' 
                    ? 'bg-primary/10 text-primary' 
                    : 'text-text-muted hover:text-text hover:bg-bg-alt'
                }`}
              >
                Attendance
              </Link>
              <Link 
                href="/map" 
                className={`hidden md:inline-block px-3 py-2 rounded-lg font-semibold text-sm transition-colors ${
                  pathname === '/map' 
                    ? 'bg-primary/10 text-primary' 
                    : 'text-text-muted hover:text-text hover:bg-bg-alt'
                }`}
              >
                Map
              </Link>
              <Link 
                href="/assignments" 
                className={`hidden md:inline-block px-3 py-2 rounded-lg font-semibold text-sm transition-colors ${
                  pathname === '/assignments' 
                    ? 'bg-primary/10 text-primary' 
                    : 'text-text-muted hover:text-text hover:bg-bg-alt'
                }`}
              >
                Assignments
              </Link>
              <Link 
                href="/portfolio" 
                className={`hidden md:inline-block px-3 py-2 rounded-lg font-semibold text-sm transition-colors ${
                  pathname === '/portfolio' 
                    ? 'bg-primary/10 text-primary' 
                    : 'text-text-muted hover:text-text hover:bg-bg-alt'
                }`}
              >
                Portfolio
              </Link>
              <Link 
                href="/transcript" 
                className={`hidden md:inline-block px-3 py-2 rounded-lg font-semibold text-sm transition-colors ${
                  pathname === '/transcript' 
                    ? 'bg-primary/10 text-primary' 
                    : 'text-text-muted hover:text-text hover:bg-bg-alt'
                }`}
              >
                Transcript
              </Link>
              <Link 
                href="/calendar" 
                className={`hidden md:inline-block px-3 py-2 rounded-lg font-semibold text-sm transition-colors ${
                  pathname === '/calendar' 
                    ? 'bg-primary/10 text-primary' 
                    : 'text-text-muted hover:text-text hover:bg-bg-alt'
                }`}
              >
                Calendar
              </Link>
            </>
          )}
          
          {/* Logout button - visible on both mobile and desktop */}
          {showLogout && onLogout && (
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleLogout}
              className="hover:bg-red-50 hover:text-red-500 hover:border-red-200 py-2 px-3 text-xs"
            >
              <span className="hidden sm:inline">Logout</span>
              <svg className="w-4 h-4 sm:hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </Button>
          )}
        </nav>
      </header>
      
      {/* Mobile Navigation Drawer */}
      {showLogout && (
        <MobileNav 
          isOpen={isMobileNavOpen}
          onClose={() => setIsMobileNavOpen(false)}
          isAdmin={isAdmin}
          onLogout={handleLogout}
        />
      )}
    </>
  );
}
