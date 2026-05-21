'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from './ui/Button';
import { getPocketBase } from '@/lib/pocketbase';

interface HeaderProps {
  onLogout?: () => void;
  showLogout?: boolean;
}

const ADMIN_EMAILS = ['jtown.80@gmail.com', 'jlynch8080@pm.me'];

const NAV_LINKS = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/manage-kids', label: 'Manage' },
  { href: '/attendance', label: 'Attendance' },
  { href: '/assignments', label: 'Assignments' },
  { href: '/portfolio', label: 'Portfolio' },
  { href: '/weekly-summary', label: 'Weekly' },
  { href: '/reports', label: 'Reports' },
  { href: '/transcript', label: 'Transcript' },
  { href: '/calendar', label: 'Calendar' },
  { href: '/lessons', label: 'Lessons' },
  { href: '/events', label: 'Events' },
  { href: '/map', label: 'Map' },
];

export function Header({ onLogout, showLogout = false }: HeaderProps) {
  const pathname = usePathname();
  const pb = getPocketBase();
  const isAdmin = pb.authStore.isValid && ADMIN_EMAILS.includes(pb.authStore.model?.email);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [menuOpen]);

  const linkClassName = (href: string) => {
    const isActive = pathname === href || pathname.startsWith(`${href}/`);

    return `rounded-md px-3 py-2 text-sm font-semibold transition-colors ${isActive
      ? 'bg-primary/10 text-primary'
      : 'text-text-muted hover:bg-bg-alt hover:text-text'
    }`;
  };
  
  return (
    <header className="sticky top-0 z-50 border-b border-border/50 bg-bg/90 px-4 py-3 shadow-sm backdrop-blur-md transition-all md:px-8 lg:px-12">
      <div className="flex items-center justify-between gap-4">
        <Link href="/" className="shrink-0" aria-label="Village home">
          <h1 className="m-0 cursor-pointer font-display text-2xl font-extrabold uppercase tracking-tighter text-primary transition-colors hover:text-primary-light">
            Village<span className="text-secondary">.</span>
          </h1>
        </Link>

        {showLogout && (
          <>
            <nav className="hidden min-w-0 flex-1 items-center justify-end gap-1 overflow-x-auto px-2 lg:flex" aria-label="Primary navigation">
              {isAdmin && (
                <Link
                  href="/admin"
                  onClick={() => setMenuOpen(false)}
                  className={`rounded-md px-3 py-2 text-sm font-bold text-accent transition-colors hover:bg-accent/10 ${
                    pathname === '/admin' ? 'bg-accent/20' : ''
                  }`}
                >
                  Admin
                </Link>
              )}
              {NAV_LINKS.map((link) => (
                <Link key={link.href} href={link.href} onClick={() => setMenuOpen(false)} className={linkClassName(link.href)}>
                  {link.label}
                </Link>
              ))}
            </nav>

            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => setMenuOpen((open) => !open)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-border bg-card text-text shadow-sm transition-colors hover:border-primary/40 hover:bg-bg-alt lg:hidden"
                aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
                aria-expanded={menuOpen}
                aria-controls="mobile-nav"
              >
                <span className="sr-only">{menuOpen ? 'Close menu' : 'Open menu'}</span>
                <span className="flex w-4 flex-col gap-1.5" aria-hidden="true">
                  <span className={`h-0.5 rounded-full bg-current transition-transform ${menuOpen ? 'translate-y-2 rotate-45' : ''}`} />
                  <span className={`h-0.5 rounded-full bg-current transition-opacity ${menuOpen ? 'opacity-0' : 'opacity-100'}`} />
                  <span className={`h-0.5 rounded-full bg-current transition-transform ${menuOpen ? '-translate-y-2 -rotate-45' : ''}`} />
                </span>
              </button>

              {onLogout && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onLogout}
                  className="px-3 py-2 text-xs hover:border-red-200 hover:bg-red-50 hover:text-red-500 sm:px-4 sm:text-sm"
                >
                  Logout
                </Button>
              )}
            </div>
          </>
        )}
      </div>

      {showLogout && menuOpen && (
        <nav
          id="mobile-nav"
          className="mt-3 grid max-h-[calc(100vh-5rem)] grid-cols-2 gap-2 overflow-y-auto rounded-lg border border-border bg-card p-3 shadow-lg sm:grid-cols-3 lg:hidden"
          aria-label="Mobile navigation"
        >
          {isAdmin && (
            <Link href="/admin" onClick={() => setMenuOpen(false)} className={`col-span-2 sm:col-span-1 ${linkClassName('/admin')}`}>
              Admin
            </Link>
          )}
          {NAV_LINKS.map((link) => (
            <Link key={link.href} href={link.href} onClick={() => setMenuOpen(false)} className={linkClassName(link.href)}>
              {link.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
