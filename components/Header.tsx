'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useMemo, useState } from 'react';
import { Button } from './ui/Button';
import { getPocketBase } from '@/lib/pocketbase';

interface HeaderProps {
  onLogout?: () => void;
  showLogout?: boolean;
}

type NavItem = {
  href: string;
  label: string;
  icon: string;
  description?: string;
  adminOnly?: boolean;
};

type NavGroup = {
  label: string;
  icon: string;
  items: NavItem[];
};

const ADMIN_EMAILS = ['jtown.80@gmail.com', 'jlynch8080@pm.me'];

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Home base',
    icon: '⌂',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: '⌂', description: 'Today, alerts, quick actions' },
      { href: '/calendar', label: 'Calendar', icon: '◷', description: 'Plans and schedule' },
      { href: '/events', label: 'Events', icon: '◇', description: 'Community meetups' },
      { href: '/map', label: 'Map', icon: '◎', description: 'Families and places' },
    ],
  },
  {
    label: 'Learning',
    icon: '✦',
    items: [
      { href: '/assignments', label: 'Assignments', icon: '✎', description: 'Daily work' },
      { href: '/lessons-v2', label: 'Lessons V2', icon: '✧', description: 'Curriculum prototype' },
      { href: '/lessons', label: 'Lessons', icon: '☰', description: 'Lesson library' },
      { href: '/mastery-map', label: 'Mastery Map', icon: '◈', description: 'Skill progress' },
      { href: '/weekly-summary', label: 'Weekly Summary', icon: '▦', description: 'Review the week' },
    ],
  },
  {
    label: 'Records',
    icon: '◫',
    items: [
      { href: '/attendance', label: 'Attendance', icon: '✓', description: 'Track school days' },
      { href: '/portfolio', label: 'Portfolio', icon: '▣', description: 'Work samples' },
      { href: '/transcript', label: 'Transcript', icon: '≣', description: 'Official records' },
      { href: '/reports', label: 'Reports', icon: '◬', description: 'Analytics and exports' },
    ],
  },
  {
    label: 'Family setup',
    icon: '◌',
    items: [
      { href: '/manage-kids', label: 'Manage Kids', icon: '♡', description: 'Profiles and settings' },
      { href: '/profile', label: 'Profile', icon: '◐', description: 'Account details' },
      { href: '/legal-guides', label: 'Legal Guides', icon: '§', description: 'State guidance' },
      { href: '/admin', label: 'Admin', icon: '⚙', description: 'System tools', adminOnly: true },
    ],
  },
];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function visibleGroups(isAdmin: boolean) {
  return NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => !item.adminOnly || isAdmin),
  })).filter((group) => group.items.length > 0);
}

function VillageNavLink({ item, pathname, compact = false, onNavigate }: { item: NavItem; pathname: string; compact?: boolean; onNavigate?: () => void }) {
  const active = isActive(pathname, item.href);
  return (
    <Link
      href={item.href}
      title={compact ? item.label : undefined}
      aria-current={active ? 'page' : undefined}
      onClick={onNavigate}
      className={`group flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm transition-all ${
        active
          ? 'bg-primary text-white shadow-[0_16px_34px_-22px_rgba(45,59,41,.9)]'
          : 'text-text-muted hover:bg-bg-alt hover:text-text'
      } ${compact ? 'justify-center' : ''}`}
    >
      <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl text-base ${active ? 'bg-white/15' : 'bg-white/70 group-hover:bg-white'}`}>
        {item.icon}
      </span>
      {!compact && (
        <span className="min-w-0">
          <span className="block font-bold leading-4">{item.label}</span>
          {item.description && <span className={`block truncate text-[11px] ${active ? 'text-white/70' : 'text-text-muted/75'}`}>{item.description}</span>}
        </span>
      )}
    </Link>
  );
}

function SidebarContent({
  compact = false,
  currentItem,
  flatItems,
  groups,
  onCollapse,
  onExpand,
  onLogout,
  onNavigate,
  pathname,
}: {
  compact?: boolean;
  currentItem?: NavItem;
  flatItems: NavItem[];
  groups: NavGroup[];
  onCollapse?: () => void;
  onExpand?: () => void;
  onLogout?: () => void;
  onNavigate?: () => void;
  pathname: string;
}) {
  return (
    <>
      <div className={`flex items-center ${compact ? 'justify-center' : 'justify-between'} gap-3 border-b border-border/70 p-4`}>
        <Link href="/dashboard" onClick={onNavigate} className="flex items-center gap-3 min-w-0">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-primary text-lg font-black text-white shadow-[0_18px_35px_-22px_rgba(45,59,41,.9)]">V</span>
          {!compact && (
            <span className="min-w-0">
              <span className="block font-display text-2xl font-extrabold uppercase tracking-tighter text-primary leading-none">Village<span className="text-secondary">.</span></span>
              <span className="text-xs font-semibold uppercase tracking-[0.22em] text-text-muted">Family OS</span>
            </span>
          )}
        </Link>
        {!compact && onCollapse && (
          <button
            type="button"
            onClick={onCollapse}
            className="hidden lg:grid h-9 w-9 place-items-center rounded-xl border border-border bg-white/70 text-text-muted hover:text-text"
            aria-label="Collapse sidebar"
          >
            ‹
          </button>
        )}
      </div>

      {compact ? (
        <nav className="flex flex-1 flex-col gap-2 p-3" aria-label="Primary navigation">
          {onExpand && (
            <button
              type="button"
              onClick={onExpand}
              className="mb-2 grid h-11 place-items-center rounded-2xl border border-border bg-white/80 text-text-muted hover:text-text"
              aria-label="Expand sidebar"
            >
              ›
            </button>
          )}
          {flatItems.map((item) => <VillageNavLink key={item.href} item={item} pathname={pathname} compact onNavigate={onNavigate} />)}
        </nav>
      ) : (
        <nav className="flex-1 space-y-3 overflow-y-auto p-4" aria-label="Primary navigation">
          <div className="rounded-3xl border border-border/70 bg-white/70 p-3 shadow-[0_18px_45px_-38px_rgba(45,59,41,.7)]">
            <p className="mb-2 px-2 text-[11px] font-black uppercase tracking-[0.22em] text-text-muted">Now</p>
            <Link href={currentItem?.href ?? '/dashboard'} onClick={onNavigate} className="flex items-center gap-3 rounded-2xl bg-bg-alt p-3 hover:bg-accent-soft/60 transition-colors">
              <span className="grid h-10 w-10 place-items-center rounded-2xl bg-primary text-white">{currentItem?.icon ?? '⌂'}</span>
              <span className="min-w-0">
                <span className="block text-sm font-black text-text">{currentItem?.label ?? 'Dashboard'}</span>
                <span className="block truncate text-xs text-text-muted">{currentItem?.description ?? 'Your homeschool home base'}</span>
              </span>
            </Link>
          </div>

          {groups.map((group) => {
            const groupActive = group.items.some((item) => isActive(pathname, item.href));
            return (
              <details key={group.label} open={groupActive || group.label === 'Home base'} className="group rounded-3xl border border-transparent open:border-border/70 open:bg-white/55">
                <summary className="flex cursor-pointer list-none items-center justify-between rounded-3xl px-3 py-2.5 text-sm font-black text-text hover:bg-bg-alt [&::-webkit-details-marker]:hidden">
                  <span className="flex items-center gap-3"><span className="text-base text-primary">{group.icon}</span>{group.label}</span>
                  <span className="text-text-muted transition-transform group-open:rotate-90">›</span>
                </summary>
                <div className="space-y-1 p-2 pt-0">
                  {group.items.map((item) => <VillageNavLink key={item.href} item={item} pathname={pathname} onNavigate={onNavigate} />)}
                </div>
              </details>
            );
          })}
        </nav>
      )}

      <div className="border-t border-border/70 p-4">
        {!compact && (
          <div className="mb-3 rounded-3xl bg-primary-dark p-4 text-white shadow-[0_18px_40px_-26px_rgba(45,59,41,.9)]">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-white/55">Quick thought</p>
            <p className="mt-1 text-sm font-semibold leading-snug">Everything stays. The structure just gets calmer.</p>
          </div>
        )}
        {onLogout && (
          <Button
            variant="outline"
            size="sm"
            onClick={onLogout}
            className={`${compact ? 'w-full px-0' : 'w-full'} hover:bg-red-50 hover:text-red-500 hover:border-red-200`}
          >
            {compact ? '↯' : 'Logout'}
          </Button>
        )}
      </div>
    </>
  );
}

export function Header({ onLogout, showLogout = false }: HeaderProps) {
  const pathname = usePathname();
  const pb = getPocketBase();
  const isAdmin = pb.authStore.isValid && ADMIN_EMAILS.includes(pb.authStore.model?.email);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [railCollapsed, setRailCollapsed] = useState(false);

  const groups = useMemo(() => visibleGroups(isAdmin), [isAdmin]);
  const flatItems = useMemo(() => groups.flatMap((group) => group.items), [groups]);

  if (!showLogout) {
    return (
      <header className="bg-bg/80 backdrop-blur-md px-6 md:px-16 py-4 md:py-6 flex justify-between items-center sticky top-0 z-50 transition-all border-b border-border/50">
        <Link href="/">
          <h1 className="font-display text-2xl font-extrabold m-0 text-primary uppercase tracking-tighter cursor-pointer hover:text-primary-light transition-colors">
            Village<span className="text-secondary">.</span>
          </h1>
        </Link>
      </header>
    );
  }

  const currentItem = flatItems.find((item) => isActive(pathname, item.href));
  const closeMobile = () => setMobileOpen(false);

  return (
    <>
      <div className={`village-app-shell ${railCollapsed ? 'nav-collapsed' : 'nav-expanded'}`} />
      <header className="lg:hidden sticky top-0 z-50 border-b border-border/70 bg-bg/90 px-4 py-3 backdrop-blur-xl">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="grid h-11 w-11 place-items-center rounded-2xl border border-border bg-white/80 text-xl text-primary shadow-sm"
            aria-label="Open navigation"
            aria-expanded={mobileOpen}
          >
            ☰
          </button>
          <Link href="/dashboard" className="min-w-0 text-center">
            <span className="block font-display text-xl font-extrabold uppercase tracking-tighter text-primary leading-none">Village<span className="text-secondary">.</span></span>
            <span className="block truncate text-xs font-semibold text-text-muted">{currentItem?.label ?? 'Dashboard'}</span>
          </Link>
          {onLogout ? (
            <Button variant="outline" size="sm" onClick={onLogout} className="px-3 text-xs hover:bg-red-50 hover:text-red-500 hover:border-red-200">Exit</Button>
          ) : <span className="h-11 w-11" />}
        </div>
      </header>

      <aside className={`hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-50 lg:flex lg:flex-col border-r border-border/70 bg-bg/88 backdrop-blur-2xl shadow-[24px_0_70px_-58px_rgba(45,59,41,.65)] transition-[width] duration-300 ${railCollapsed ? 'lg:w-24' : 'lg:w-80'}`}>
        <SidebarContent
          compact={railCollapsed}
          currentItem={currentItem}
          flatItems={flatItems}
          groups={groups}
          onCollapse={() => setRailCollapsed(true)}
          onExpand={() => setRailCollapsed(false)}
          onLogout={onLogout}
          pathname={pathname}
        />
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-[60] lg:hidden" role="dialog" aria-modal="true" aria-label="Village navigation">
          <button className="absolute inset-0 bg-primary-dark/45 backdrop-blur-sm" aria-label="Close navigation" onClick={closeMobile} />
          <aside className="absolute inset-y-0 left-0 flex w-[88vw] max-w-sm flex-col border-r border-border bg-bg shadow-2xl animate-fade-in">
            <div className="flex items-center justify-between border-b border-border/70 p-4">
              <Link href="/dashboard" onClick={closeMobile} className="flex items-center gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-primary text-lg font-black text-white">V</span>
                <span>
                  <span className="block font-display text-2xl font-extrabold uppercase tracking-tighter text-primary leading-none">Village<span className="text-secondary">.</span></span>
                  <span className="text-xs font-semibold uppercase tracking-[0.22em] text-text-muted">Navigate</span>
                </span>
              </Link>
              <button type="button" onClick={closeMobile} className="grid h-10 w-10 place-items-center rounded-2xl border border-border bg-white/80 text-text-muted" aria-label="Close navigation">×</button>
            </div>
            <SidebarContent
              currentItem={currentItem}
              flatItems={flatItems}
              groups={groups}
              onLogout={onLogout}
              onNavigate={closeMobile}
              pathname={pathname}
            />
          </aside>
        </div>
      )}
    </>
  );
}
