'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from './ui/Button';
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
  
  return (
    <header className="bg-bg/80 backdrop-blur-md px-6 md:px-16 py-4 md:py-6 flex justify-between items-center sticky top-0 z-50 transition-all border-b border-border/50">
      <Link href="/">
        <h1 className="font-display text-2xl font-extrabold m-0 text-primary uppercase tracking-tighter cursor-pointer hover:text-primary-light transition-colors">
          Village<span className="text-secondary">.</span>
        </h1>
      </Link>
      
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
            <Link 
              href="/reports" 
              className={`hidden md:inline-block px-3 py-2 rounded-lg font-semibold text-sm transition-colors ${
                pathname === '/reports' 
                  ? 'bg-primary/10 text-primary' 
                  : 'text-text-muted hover:text-text hover:bg-bg-alt'
              }`}
            >
              📊 Reports
            </Link>
          </>
        )}
        {showLogout && onLogout && (
          <Button 
            variant="outline" 
            size="sm"
            onClick={onLogout}
            className="hover:bg-red-50 hover:text-red-500 hover:border-red-200 py-2 px-3 sm:px-4 text-xs sm:text-sm"
          >
            Logout
          </Button>
        )}
      </nav>
    </header>
  );
}
