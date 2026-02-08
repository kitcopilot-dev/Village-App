'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from './ui/Button';

interface HeaderProps {
  onLogout?: () => void;
  showLogout?: boolean;
}

export function Header({ onLogout, showLogout = false }: HeaderProps) {
  const pathname = usePathname();
  
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
        {showLogout && onLogout && (
          <Button 
            variant="outline" 
            size="sm"
            onClick={onLogout}
            className="hover:bg-red-50 hover:text-red-500 hover:border-red-200"
          >
            Logout
          </Button>
        )}
      </nav>
    </header>
  );
}
