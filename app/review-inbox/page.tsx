'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getPocketBase } from '@/lib/pocketbase';
import { Assignment, Attendance, Child, PortfolioItem } from '@/lib/types';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { LoadingScreen } from '@/components/ui/Spinner';

type ReviewCategory = 'grade' | 'attendance' | 'portfolio' | 'planning';
type ReviewPriority = 'high' | 'medium' | 'low';

interface ReviewItem {
  id: string;
  childId: string;
  childName: string;
  title: string;
  detail: string;
  action: string;
  category: ReviewCategory;
  priority: ReviewPriority;
  href: string;
  date?: string;
}

const DISMISSED_STORAGE_KEY = 'village_review_inbox_dismissed_v1';
const CATEGORY_LABELS: Record<ReviewCategory, string> = {
  grade: 'Grade',
  attendance: 'Attendance',
  portfolio: 'Portfolio',
  planning: 'Plan',
};

const CATEGORY_STYLES: Record<ReviewCategory, string> = {
  grade: 'bg-secondary/10 text-secondary border-secondary/20',
  attendance: 'bg-primary/10 text-primary border-primary/20',
  portfolio: 'bg-accent/15 text-primary-dark border-accent/30',
  planning: 'bg-bg-alt text-text-muted border-border',
};

const PRIORITY_STYLES: Record<ReviewPriority, string> = {
  high: 'bg-red-100 text-red-700 border-red-200',
  medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  low: 'bg-green-100 text-green-700 border-green-200',
};

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

function displayDate(value?: string): string {
  if (!value) return 'No date';
  return new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function daysBetween(start: Date, end: Date): number {
  const startDate = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const endDate = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  return Math.round((endDate.getTime() - startDate.getTime()) / 86400000);
}

function getRecentWeekdays(today: Date, count: number): string[] {
  const days: string[] = [];
  const cursor = new Date(today);

  while (days.length < count) {
    const day = cursor.getDay();
    if (day !== 0 && day !== 6) {
      days.push(formatDate(cursor));
    }
    cursor.setDate(cursor.getDate() - 1);
  }

  return days;
}

function isAssignmentFinished(status?: string): boolean {
  const normalized = (status || '').toLowerCase();
  return normalized === 'graded' || normalized === 'completed';
}

function priorityRank(priority: ReviewPriority): number {
  return priority === 'high' ? 0 : priority === 'medium' ? 1 : 2;
}

function buildReviewItems(
  kids: Child[],
  assignments: Assignment[],
  attendance: Attendance[],
  portfolioItems: PortfolioItem[],
): ReviewItem[] {
  const today = new Date();
  const todayKey = formatDate(today);
  const recentWeekdays = getRecentWeekdays(today, 5);
  const attendanceByChild = new Map<string, Set<string>>();
  const assignmentsByChild = new Map<string, Assignment[]>();
  const portfolioByChild = new Map<string, PortfolioItem[]>();
  const items: ReviewItem[] = [];

  attendance.forEach((record) => {
    if (!attendanceByChild.has(record.child)) {
      attendanceByChild.set(record.child, new Set());
    }
    attendanceByChild.get(record.child)?.add(record.date);
  });

  assignments.forEach((assignment) => {
    if (!assignment.child) return;
    if (!assignmentsByChild.has(assignment.child)) {
      assignmentsByChild.set(assignment.child, []);
    }
    assignmentsByChild.get(assignment.child)?.push(assignment);
  });

  portfolioItems.forEach((item) => {
    if (!portfolioByChild.has(item.child)) {
      portfolioByChild.set(item.child, []);
    }
    portfolioByChild.get(item.child)?.push(item);
  });

  assignments.forEach((assignment) => {
    if (!assignment.child || isAssignmentFinished(assignment.status)) return;

    const child = kids.find((kid) => kid.id === assignment.child);
    if (!child) return;

    const dueDate = assignment.due_date ? new Date(assignment.due_date) : null;
    const dayDelta = dueDate ? daysBetween(dueDate, today) : 0;
    const overdue = dueDate && assignment.due_date! < todayKey;
    const dueSoon = dueDate && !overdue && daysBetween(today, dueDate) <= 2;

    if (!overdue && !dueSoon) return;

    items.push({
      id: `assignment-${assignment.id}`,
      childId: child.id,
      childName: child.name,
      title: overdue ? `Grade overdue work: ${assignment.title}` : `Review upcoming work: ${assignment.title}`,
      detail: overdue
        ? `${assignment.subject || 'General'} was due ${Math.abs(dayDelta)} day${Math.abs(dayDelta) === 1 ? '' : 's'} ago.`
        : `${assignment.subject || 'General'} is due ${displayDate(assignment.due_date)}.`,
      action: overdue ? 'Open assignments and enter a score or mark it complete.' : 'Check instructions before the due date.',
      category: 'grade',
      priority: overdue ? 'high' : 'medium',
      href: '/assignments',
      date: assignment.due_date,
    });
  });

  kids.forEach((kid) => {
    const kidAttendance = attendanceByChild.get(kid.id) || new Set<string>();
    const missingWeekdays = recentWeekdays.filter((date) => !kidAttendance.has(date));
    if (missingWeekdays.length >= 2) {
      items.push({
        id: `attendance-${kid.id}-${recentWeekdays[0]}`,
        childId: kid.id,
        childName: kid.name,
        title: `Fill attendance for ${kid.name}`,
        detail: `${missingWeekdays.length} of the last ${recentWeekdays.length} school days have no attendance record.`,
        action: 'Log present, half-day, sick, holiday, or absent while it is still fresh.',
        category: 'attendance',
        priority: missingWeekdays.length >= 4 ? 'high' : 'medium',
        href: '/attendance',
      });
    }

    const kidPortfolio = [...(portfolioByChild.get(kid.id) || [])].sort((a, b) => {
      return new Date(b.date || b.created).getTime() - new Date(a.date || a.created).getTime();
    });
    const latestPortfolio = kidPortfolio[0];
    const daysSincePortfolio = latestPortfolio
      ? daysBetween(new Date(latestPortfolio.date || latestPortfolio.created), today)
      : null;

    if (daysSincePortfolio === null || daysSincePortfolio >= 14) {
      items.push({
        id: `portfolio-${kid.id}`,
        childId: kid.id,
        childName: kid.name,
        title: `Add portfolio proof for ${kid.name}`,
        detail: daysSincePortfolio === null
          ? 'No portfolio samples are attached yet.'
          : `Last sample was added ${daysSincePortfolio} days ago.`,
        action: 'Capture one photo, worksheet, narration, or project note for records.',
        category: 'portfolio',
        priority: daysSincePortfolio === null || daysSincePortfolio >= 30 ? 'high' : 'medium',
        href: '/portfolio',
      });
    }

    const kidAssignments = assignmentsByChild.get(kid.id) || [];
    const upcomingAssignments = kidAssignments.filter((assignment) => {
      if (!assignment.due_date || isAssignmentFinished(assignment.status)) return false;
      const dueDate = new Date(assignment.due_date);
      return daysBetween(today, dueDate) >= 0 && daysBetween(today, dueDate) <= 7;
    });

    if (upcomingAssignments.length === 0) {
      items.push({
        id: `planning-${kid.id}-${todayKey}`,
        childId: kid.id,
        childName: kid.name,
        title: `Plan next assignment for ${kid.name}`,
        detail: 'No open assignments are due in the next seven days.',
        action: 'Create one clear task so the week has a visible target.',
        category: 'planning',
        priority: 'low',
        href: '/assignments',
      });
    }
  });

  return items.sort((a, b) => {
    const priorityDiff = priorityRank(a.priority) - priorityRank(b.priority);
    if (priorityDiff !== 0) return priorityDiff;
    return a.childName.localeCompare(b.childName) || a.title.localeCompare(b.title);
  });
}

export default function ReviewInboxPage() {
  const router = useRouter();
  const pb = getPocketBase();
  const [kids, setKids] = useState<Child[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [portfolioItems, setPortfolioItems] = useState<PortfolioItem[]>([]);
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);
  const [selectedChild, setSelectedChild] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState<'all' | ReviewCategory>('all');
  const [loading, setLoading] = useState(true);
  const [copyLabel, setCopyLabel] = useState('Copy brief');

  const loadData = useCallback(async () => {
    try {
      const userId = pb.authStore.model?.id;
      if (!userId) return;

      const since = new Date();
      since.setDate(since.getDate() - 45);
      const sinceKey = formatDate(since);

      const [kidRecords, assignmentRecords, attendanceRecords, portfolioRecords] = await Promise.all([
        pb.collection('children').getFullList({
          filter: `user = "${userId}"`,
          sort: 'name',
        }),
        pb.collection('assignments').getFullList({
          filter: `user = "${userId}"`,
          sort: 'due_date',
        }),
        pb.collection('attendance').getFullList({
          filter: `user = "${userId}" && date >= "${sinceKey}"`,
          sort: '-date',
        }),
        pb.collection('portfolio').getFullList({
          filter: `user = "${userId}"`,
          sort: '-date',
        }),
      ]);

      setKids(kidRecords as unknown as Child[]);
      setAssignments(assignmentRecords as unknown as Assignment[]);
      setAttendance(attendanceRecords as unknown as Attendance[]);
      setPortfolioItems(portfolioRecords as unknown as PortfolioItem[]);
    } catch (error) {
      console.error('Review inbox load error:', error);
    } finally {
      setLoading(false);
    }
  }, [pb]);

  useEffect(() => {
    if (!pb.authStore.isValid) {
      router.push('/');
      return;
    }

    try {
      const stored = localStorage.getItem(DISMISSED_STORAGE_KEY);
      if (stored) setDismissedIds(JSON.parse(stored));
    } catch {
      localStorage.removeItem(DISMISSED_STORAGE_KEY);
    }

    loadData();
  }, [loadData, pb.authStore.isValid, router]);

  const reviewItems = useMemo(() => {
    return buildReviewItems(kids, assignments, attendance, portfolioItems);
  }, [kids, assignments, attendance, portfolioItems]);

  const visibleItems = reviewItems.filter((item) => {
    if (dismissedIds.includes(item.id)) return false;
    if (selectedChild !== 'all' && item.childId !== selectedChild) return false;
    if (selectedCategory !== 'all' && item.category !== selectedCategory) return false;
    return true;
  });

  const counts = reviewItems.reduce(
    (acc, item) => {
      acc[item.priority] += dismissedIds.includes(item.id) ? 0 : 1;
      return acc;
    },
    { high: 0, medium: 0, low: 0 },
  );

  const handleDismiss = (id: string) => {
    const next = [...new Set([...dismissedIds, id])];
    setDismissedIds(next);
    localStorage.setItem(DISMISSED_STORAGE_KEY, JSON.stringify(next));
  };

  const restoreDismissed = () => {
    setDismissedIds([]);
    localStorage.removeItem(DISMISSED_STORAGE_KEY);
  };

  const copyBrief = async () => {
    const lines = visibleItems.slice(0, 8).map((item) => {
      return `- [${item.priority.toUpperCase()}] ${item.childName}: ${item.title}. ${item.action}`;
    });
    const brief = [
      `Village Review Inbox - ${new Date().toLocaleDateString()}`,
      `${counts.high} high, ${counts.medium} medium, ${counts.low} low open items`,
      '',
      ...(lines.length > 0 ? lines : ['No open review items.']),
    ].join('\n');

    try {
      await navigator.clipboard.writeText(brief);
      setCopyLabel('Copied');
      setTimeout(() => setCopyLabel('Copy brief'), 1500);
    } catch {
      setCopyLabel('Copy failed');
      setTimeout(() => setCopyLabel('Copy brief'), 1500);
    }
  };

  const handleLogout = () => {
    pb.authStore.clear();
    router.push('/');
  };

  if (loading) {
    return <LoadingScreen message="Building review queue..." />;
  }

  return (
    <>
      <Header showLogout onLogout={handleLogout} />
      <main className="max-w-7xl mx-auto my-8 sm:my-12 px-4 sm:px-8 pb-24 animate-fade-in">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 mb-10">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-secondary mb-3">Parent review queue</p>
            <h2 className="font-display text-4xl sm:text-6xl font-extrabold tracking-tight mb-3">
              Review Inbox
            </h2>
            <p className="text-text-muted max-w-2xl">
              One pass across assignments, attendance, and portfolio proof so records do not drift across the week.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" size="sm" onClick={() => router.push('/dashboard')}>
              Dashboard
            </Button>
            <Button variant="ghost" size="sm" onClick={copyBrief}>
              {copyLabel}
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              Print
            </Button>
          </div>
        </div>

        <section className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 mb-8">
          {[
            { label: 'High priority', value: counts.high, className: 'text-red-600' },
            { label: 'Medium priority', value: counts.medium, className: 'text-yellow-700' },
            { label: 'Low priority', value: counts.low, className: 'text-primary' },
          ].map((stat) => (
            <div key={stat.label} className="bg-card border border-border rounded-[1.25rem] p-5 sm:p-7">
              <div className={`font-display text-4xl sm:text-5xl font-extrabold ${stat.className}`}>
                {stat.value}
              </div>
              <div className="text-xs font-bold uppercase tracking-widest text-text-muted mt-2">{stat.label}</div>
            </div>
          ))}
        </section>

        <Card className="mb-8 p-5 sm:p-7 md:p-8">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-4 items-end">
            <label className="block">
              <span className="block text-xs font-bold uppercase tracking-widest text-text-muted mb-2">Student</span>
              <select
                className="w-full rounded-xl border-2 border-border bg-white px-4 py-3 font-semibold text-text"
                value={selectedChild}
                onChange={(event) => setSelectedChild(event.target.value)}
              >
                <option value="all">All students</option>
                {kids.map((kid) => (
                  <option key={kid.id} value={kid.id}>{kid.name}</option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="block text-xs font-bold uppercase tracking-widest text-text-muted mb-2">Category</span>
              <select
                className="w-full rounded-xl border-2 border-border bg-white px-4 py-3 font-semibold text-text"
                value={selectedCategory}
                onChange={(event) => setSelectedCategory(event.target.value as 'all' | ReviewCategory)}
              >
                <option value="all">All categories</option>
                <option value="grade">Grade</option>
                <option value="attendance">Attendance</option>
                <option value="portfolio">Portfolio</option>
                <option value="planning">Plan</option>
              </select>
            </label>

            <Button variant="outline" size="sm" onClick={restoreDismissed} disabled={dismissedIds.length === 0}>
              Restore dismissed
            </Button>
          </div>
        </Card>

        {kids.length === 0 ? (
          <div className="text-center py-20 bg-bg-alt rounded-[2rem] border-2 border-dashed border-border">
            <p className="text-text-muted text-lg mb-6">No students are set up yet.</p>
            <Button onClick={() => router.push('/manage-kids')}>Add a student</Button>
          </div>
        ) : visibleItems.length === 0 ? (
          <div className="text-center py-20 bg-bg-alt rounded-[2rem] border-2 border-dashed border-border">
            <p className="font-serif italic text-2xl text-primary mb-3">Review queue is clear.</p>
            <p className="text-text-muted">Everything visible from assignments, attendance, and portfolio records looks current.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {visibleItems.map((item) => (
              <div
                key={item.id}
                className="bg-card border border-border rounded-[1.5rem] p-5 sm:p-7 flex flex-col lg:flex-row lg:items-center justify-between gap-5 transition-all hover:border-primary/30"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    <span className={`px-3 py-1 rounded-full text-[11px] font-bold uppercase border ${PRIORITY_STYLES[item.priority]}`}>
                      {item.priority}
                    </span>
                    <span className={`px-3 py-1 rounded-full text-[11px] font-bold uppercase border ${CATEGORY_STYLES[item.category]}`}>
                      {CATEGORY_LABELS[item.category]}
                    </span>
                    <span className="text-xs font-bold uppercase tracking-widest text-text-muted">
                      {item.childName}
                    </span>
                  </div>
                  <h3 className="font-display text-xl sm:text-2xl font-bold mb-2 leading-tight">{item.title}</h3>
                  <p className="text-sm text-text-muted mb-2">{item.detail}</p>
                  <p className="text-sm font-semibold text-text">{item.action}</p>
                  {item.date && (
                    <p className="text-[11px] font-bold uppercase tracking-widest text-text-muted mt-3">
                      Due {displayDate(item.date)}
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap lg:flex-col gap-3 lg:min-w-[180px]">
                  <Button variant="primary" size="sm" onClick={() => router.push(item.href)}>
                    Open
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleDismiss(item.id)}>
                    Dismiss
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
