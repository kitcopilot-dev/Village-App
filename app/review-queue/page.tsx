'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getPocketBase } from '@/lib/pocketbase';
import { Assignment, Attendance, Child, Course, PortfolioItem } from '@/lib/types';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { LoadingScreen } from '@/components/ui/Spinner';
import { Toast } from '@/components/ui/Toast';

type QueuePriority = 'high' | 'medium' | 'low';
type QueueCategory = 'Assignments' | 'Attendance' | 'Portfolio' | 'Courses' | 'Setup';

type QueueItem = {
  id: string;
  priority: QueuePriority;
  category: QueueCategory;
  title: string;
  detail: string;
  childName?: string;
  dueLabel?: string;
  href: string;
};

type ChildSnapshot = {
  child: Child;
  attendanceCount: number;
  missingWeekdays: string[];
  openAssignments: number;
  overdueAssignments: number;
  ungradedAssignments: number;
  portfolioCount: number;
  staleCourses: Course[];
  activeCourses: Course[];
};

const MS_PER_DAY = 1000 * 60 * 60 * 24;
const ISO_DATE_LENGTH = 10;

function todayAtMidnight() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

function isoDate(date: Date) {
  return date.toISOString().slice(0, ISO_DATE_LENGTH);
}

function daysAgo(dateValue?: string) {
  if (!dateValue) return null;
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return null;
  const today = todayAtMidnight();
  date.setHours(0, 0, 0, 0);
  return Math.floor((today.getTime() - date.getTime()) / MS_PER_DAY);
}

function formatShortDate(dateValue?: string) {
  if (!dateValue) return 'No date';
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return 'No date';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function recentWeekdays(targetCount = 5) {
  const dates: string[] = [];
  const cursor = todayAtMidnight();
  let inspectedDays = 0;

  while (dates.length < targetCount && inspectedDays < 14) {
    const day = cursor.getDay();
    if (day !== 0 && day !== 6) {
      dates.push(isoDate(cursor));
    }
    cursor.setDate(cursor.getDate() - 1);
    inspectedDays += 1;
  }

  return dates.reverse();
}

function isCompleteStatus(status?: string) {
  const normalized = (status ?? '').toLowerCase();
  return normalized === 'graded' || normalized === 'completed' || normalized === 'complete';
}

function isPendingStatus(status?: string) {
  return !isCompleteStatus(status);
}

function priorityStyles(priority: QueuePriority) {
  if (priority === 'high') return 'bg-red-50 text-red-700 border-red-200';
  if (priority === 'medium') return 'bg-accent-soft text-primary-dark border-accent/40';
  return 'bg-primary/10 text-primary border-primary/20';
}

function priorityLabel(priority: QueuePriority) {
  if (priority === 'high') return 'High';
  if (priority === 'medium') return 'Medium';
  return 'Low';
}

function buildQueue({
  assignments,
  attendance,
  courses,
  kids,
  portfolio,
}: {
  assignments: Assignment[];
  attendance: Attendance[];
  courses: Course[];
  kids: Child[];
  portfolio: PortfolioItem[];
}) {
  const childById = new Map(kids.map((child) => [child.id, child]));
  const attendanceByChild = new Map<string, Attendance[]>();
  const assignmentsByChild = new Map<string, Assignment[]>();
  const coursesByChild = new Map<string, Course[]>();
  const portfolioByChild = new Map<string, PortfolioItem[]>();

  kids.forEach((child) => {
    attendanceByChild.set(child.id, []);
    assignmentsByChild.set(child.id, []);
    coursesByChild.set(child.id, []);
    portfolioByChild.set(child.id, []);
  });

  attendance.forEach((record) => {
    const bucket = attendanceByChild.get(record.child);
    if (bucket) bucket.push(record);
  });

  assignments.forEach((assignment) => {
    if (!assignment.child) return;
    const bucket = assignmentsByChild.get(assignment.child);
    if (bucket) bucket.push(assignment);
  });

  courses.forEach((course) => {
    const bucket = coursesByChild.get(course.child);
    if (bucket) bucket.push(course);
  });

  portfolio.forEach((item) => {
    const bucket = portfolioByChild.get(item.child);
    if (bucket) bucket.push(item);
  });

  const queue: QueueItem[] = [];
  const weekdayWindow = recentWeekdays();
  const today = todayAtMidnight();

  assignments.forEach((assignment) => {
    const child = assignment.child ? childById.get(assignment.child) : undefined;
    const dueDate = assignment.due_date ? new Date(assignment.due_date) : null;
    const isPastDue = Boolean(dueDate && dueDate < today && isPendingStatus(assignment.status));
    const needsGrade = isCompleteStatus(assignment.status) && (assignment.score === undefined || assignment.score === null);
    const isDueSoon = Boolean(dueDate && dueDate >= today && dueDate.getTime() - today.getTime() <= 3 * MS_PER_DAY && isPendingStatus(assignment.status));

    if (isPastDue) {
      queue.push({
        id: `assignment-overdue-${assignment.id}`,
        priority: 'high',
        category: 'Assignments',
        title: assignment.title,
        detail: `${assignment.subject || 'General'} is overdue and still ${assignment.status || 'pending'}.`,
        childName: child?.name,
        dueLabel: `Due ${formatShortDate(assignment.due_date)}`,
        href: '/assignments',
      });
    } else if (needsGrade) {
      queue.push({
        id: `assignment-grade-${assignment.id}`,
        priority: 'medium',
        category: 'Assignments',
        title: assignment.title,
        detail: `${assignment.subject || 'General'} is complete but does not have a score yet.`,
        childName: child?.name,
        dueLabel: 'Needs score',
        href: '/assignments',
      });
    } else if (isDueSoon) {
      queue.push({
        id: `assignment-soon-${assignment.id}`,
        priority: 'medium',
        category: 'Assignments',
        title: assignment.title,
        detail: `${assignment.subject || 'General'} is coming up soon.`,
        childName: child?.name,
        dueLabel: `Due ${formatShortDate(assignment.due_date)}`,
        href: '/assignments',
      });
    }
  });

  kids.forEach((child) => {
    const childAttendance = attendanceByChild.get(child.id) ?? [];
    const loggedDates = new Set(childAttendance.map((record) => record.date.slice(0, ISO_DATE_LENGTH)));
    const missingWeekdays = weekdayWindow.filter((date) => !loggedDates.has(date));

    if (missingWeekdays.length >= 3) {
      queue.push({
        id: `attendance-gap-${child.id}`,
        priority: 'high',
        category: 'Attendance',
        title: 'Attendance gaps this week',
        detail: `${missingWeekdays.length} recent weekdays are not logged: ${missingWeekdays.map(formatShortDate).join(', ')}.`,
        childName: child.name,
        dueLabel: 'Compliance risk',
        href: '/attendance',
      });
    } else if (missingWeekdays.length > 0) {
      queue.push({
        id: `attendance-light-gap-${child.id}`,
        priority: 'low',
        category: 'Attendance',
        title: 'Check attendance log',
        detail: `${missingWeekdays.length} recent weekday${missingWeekdays.length === 1 ? '' : 's'} may need a quick mark.`,
        childName: child.name,
        dueLabel: 'Quick cleanup',
        href: '/attendance',
      });
    }

    const childCourses = coursesByChild.get(child.id) ?? [];
    if (childCourses.length === 0) {
      queue.push({
        id: `setup-courses-${child.id}`,
        priority: 'medium',
        category: 'Setup',
        title: 'No courses attached',
        detail: 'Add at least one course so progress, reports, and transcripts have something to track.',
        childName: child.name,
        dueLabel: 'Setup',
        href: '/manage-kids',
      });
    }

    childCourses.forEach((course) => {
      const staleDays = daysAgo(course.last_lesson_date);
      const completed = course.current_lesson > course.total_lessons;
      if (!completed && (staleDays === null || staleDays >= 10)) {
        queue.push({
          id: `course-stale-${course.id}`,
          priority: staleDays === null || staleDays >= 21 ? 'medium' : 'low',
          category: 'Courses',
          title: course.name,
          detail: staleDays === null
            ? 'No last lesson date is recorded yet.'
            : `No lesson activity recorded in ${staleDays} days.`,
          childName: child.name,
          dueLabel: `Lesson ${course.current_lesson} of ${course.total_lessons}`,
          href: '/dashboard',
        });
      }
    });

    const childPortfolio = portfolioByChild.get(child.id) ?? [];
    const newestPortfolio = childPortfolio
      .map((item) => item.date || item.created)
      .filter(Boolean)
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];
    const portfolioAge = daysAgo(newestPortfolio);

    if (portfolioAge === null || portfolioAge >= 21) {
      queue.push({
        id: `portfolio-drought-${child.id}`,
        priority: portfolioAge === null ? 'medium' : 'low',
        category: 'Portfolio',
        title: 'Add a portfolio sample',
        detail: portfolioAge === null
          ? 'No portfolio samples are saved yet.'
          : `Newest sample is ${portfolioAge} days old. Add one solid work sample before it becomes a scramble.`,
        childName: child.name,
        dueLabel: 'Evidence binder',
        href: '/portfolio',
      });
    }
  });

  const snapshots: ChildSnapshot[] = kids.map((child) => {
    const childAssignments = assignmentsByChild.get(child.id) ?? [];
    const childAttendance = attendanceByChild.get(child.id) ?? [];
    const childCourses = coursesByChild.get(child.id) ?? [];
    const childPortfolio = portfolioByChild.get(child.id) ?? [];
    const loggedDates = new Set(childAttendance.map((record) => record.date.slice(0, ISO_DATE_LENGTH)));
    const missingWeekdays = weekdayWindow.filter((date) => !loggedDates.has(date));

    return {
      child,
      attendanceCount: childAttendance.length,
      missingWeekdays,
      openAssignments: childAssignments.filter((assignment) => isPendingStatus(assignment.status)).length,
      overdueAssignments: childAssignments.filter((assignment) => {
        if (!assignment.due_date || !isPendingStatus(assignment.status)) return false;
        return new Date(assignment.due_date) < today;
      }).length,
      ungradedAssignments: childAssignments.filter((assignment) => isCompleteStatus(assignment.status) && (assignment.score === undefined || assignment.score === null)).length,
      portfolioCount: childPortfolio.length,
      staleCourses: childCourses.filter((course) => {
        const staleDays = daysAgo(course.last_lesson_date);
        return course.current_lesson <= course.total_lessons && (staleDays === null || staleDays >= 10);
      }),
      activeCourses: childCourses.filter((course) => course.current_lesson <= course.total_lessons),
    };
  });

  queue.sort((a, b) => {
    const priorityOrder: Record<QueuePriority, number> = { high: 0, medium: 1, low: 2 };
    return priorityOrder[a.priority] - priorityOrder[b.priority] || a.category.localeCompare(b.category);
  });

  return { queue, snapshots };
}

export default function ReviewQueuePage() {
  const router = useRouter();
  const pb = getPocketBase();

  const [kids, setKids] = useState<Child[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const loadReviewData = useCallback(async () => {
    setLoading(true);
    try {
      const userId = pb.authStore.model?.id;
      if (!userId) return;

      const childRecords = await pb.collection('children').getFullList({
        filter: `user = "${userId}"`,
        sort: 'name',
      });
      const loadedKids = childRecords as unknown as Child[];
      setKids(loadedKids);

      if (loadedKids.length === 0) {
        setAssignments([]);
        setAttendance([]);
        setCourses([]);
        setPortfolio([]);
        return;
      }

      const childFilter = loadedKids.map((child) => `child = "${child.id}"`).join(' || ');
      const [assignmentRecords, attendanceRecords, courseRecords, portfolioRecords] = await Promise.all([
        pb.collection('assignments').getFullList({
          filter: `user = "${userId}"`,
          sort: 'due_date',
        }).catch(() => []),
        pb.collection('attendance').getFullList({
          filter: `user = "${userId}"`,
          sort: '-date',
        }).catch(() => []),
        pb.collection('courses').getFullList({
          filter: childFilter,
          sort: 'name',
        }).catch(() => []),
        pb.collection('portfolio').getFullList({
          filter: `(${childFilter})`,
          sort: '-date',
        }).catch(() => []),
      ]);

      setAssignments(assignmentRecords as unknown as Assignment[]);
      setAttendance(attendanceRecords as unknown as Attendance[]);
      setCourses(courseRecords as unknown as Course[]);
      setPortfolio(portfolioRecords as unknown as PortfolioItem[]);
    } catch (error) {
      console.error('Review queue load error:', error);
      setToast({ message: 'Review queue failed to load.', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [pb]);

  useEffect(() => {
    if (!pb.authStore.isValid) {
      router.push('/');
      return;
    }
    loadReviewData();
  }, [loadReviewData, pb.authStore.isValid, router]);

  const { queue, snapshots } = useMemo(() => buildQueue({ assignments, attendance, courses, kids, portfolio }), [assignments, attendance, courses, kids, portfolio]);

  const highCount = queue.filter((item) => item.priority === 'high').length;
  const mediumCount = queue.filter((item) => item.priority === 'medium').length;
  const lowCount = queue.filter((item) => item.priority === 'low').length;
  const totalOpenAssignments = snapshots.reduce((sum, snapshot) => sum + snapshot.openAssignments, 0);
  const totalMissingAttendance = snapshots.reduce((sum, snapshot) => sum + snapshot.missingWeekdays.length, 0);
  const totalStaleCourses = snapshots.reduce((sum, snapshot) => sum + snapshot.staleCourses.length, 0);

  const summaryText = useMemo(() => {
    if (queue.length === 0) return 'Village review queue is clear. Attendance, assignments, course pacing, and portfolio evidence all look calm.';
    const topItems = queue.slice(0, 8).map((item) => `- [${priorityLabel(item.priority)}] ${item.childName ? `${item.childName}: ` : ''}${item.title} — ${item.detail}`);
    return [`Village review queue: ${highCount} high, ${mediumCount} medium, ${lowCount} low.`, ...topItems].join('\n');
  }, [highCount, lowCount, mediumCount, queue]);

  const copySummary = async () => {
    try {
      await navigator.clipboard.writeText(summaryText);
      setToast({ message: 'Review summary copied.', type: 'success' });
    } catch {
      setToast({ message: 'Could not copy summary.', type: 'error' });
    }
  };

  const handleLogout = () => {
    pb.authStore.clear();
    router.push('/');
  };

  if (loading) return <LoadingScreen message="Building parent review queue..." />;

  return (
    <>
      <Header showLogout onLogout={handleLogout} />
      <main className="max-w-7xl mx-auto my-8 sm:my-12 px-4 sm:px-8 pb-24 animate-fade-in">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 mb-8">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.24em] text-primary mb-3">Parent command center</p>
            <h2 className="font-display text-4xl sm:text-6xl font-extrabold tracking-tight mb-3">Review Queue</h2>
            <p className="max-w-2xl text-text-muted text-sm sm:text-base">
              One calm checklist for the stuff that normally gets missed: overdue work, attendance gaps, stale courses, and portfolio evidence.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" size="sm" onClick={() => router.push('/dashboard')}>← Dashboard</Button>
            <Button variant="ghost" size="sm" onClick={loadReviewData}>Refresh</Button>
            <Button variant="secondary" size="sm" onClick={copySummary}>Copy summary</Button>
            <Button variant="outline" size="sm" onClick={() => window.print()}>Print</Button>
          </div>
        </div>

        {kids.length === 0 ? (
          <Card className="text-center py-16">
            <p className="text-xl text-text-muted mb-6">No children are set up yet, so there is nothing to review.</p>
            <Button onClick={() => router.push('/manage-kids')}>Add your first child</Button>
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8">
              {[
                { label: 'High priority', value: highCount, helper: 'Fix first', tone: 'text-red-600' },
                { label: 'Open assignments', value: totalOpenAssignments, helper: `${mediumCount} medium items`, tone: 'text-secondary' },
                { label: 'Attendance gaps', value: totalMissingAttendance, helper: 'Last 5 weekdays', tone: 'text-primary' },
                { label: 'Stale courses', value: totalStaleCourses, helper: '10+ days quiet', tone: 'text-accent' },
              ].map((stat) => (
                <div key={stat.label} className="rounded-[1.5rem] border border-border bg-card p-5 sm:p-7 shadow-[0_10px_30px_-18px_rgba(75,99,68,0.25)]">
                  <div className={`font-display text-4xl sm:text-5xl font-extrabold ${stat.tone}`}>{stat.value}</div>
                  <div className="mt-2 text-sm font-black text-text">{stat.label}</div>
                  <div className="text-xs text-text-muted">{stat.helper}</div>
                </div>
              ))}
            </div>

            <div className="grid lg:grid-cols-[1.35fr_.65fr] gap-8 items-start">
              <section className="space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <h3 className="font-display text-2xl sm:text-3xl font-extrabold mb-0">Next actions</h3>
                  <span className="rounded-full bg-bg-alt px-4 py-2 text-xs font-black text-text-muted">{queue.length} item{queue.length === 1 ? '' : 's'}</span>
                </div>

                {queue.length === 0 ? (
                  <Card className="text-center py-14" accent="sage">
                    <div className="text-5xl mb-4">✓</div>
                    <h3 className="font-display text-3xl font-extrabold mb-2">Queue is clear</h3>
                    <p className="text-text-muted max-w-xl mx-auto">No overdue assignments, scary attendance gaps, stale courses, or portfolio droughts showed up.</p>
                  </Card>
                ) : (
                  queue.map((item) => (
                    <Link
                      key={item.id}
                      href={item.href}
                      className="block rounded-[1.5rem] border border-border bg-card p-5 sm:p-6 transition-all hover:-translate-y-1 hover:border-primary/40 hover:shadow-[0_18px_40px_-25px_rgba(75,99,68,0.35)]"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-3">
                            <span className={`rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em] ${priorityStyles(item.priority)}`}>{priorityLabel(item.priority)}</span>
                            <span className="rounded-full bg-bg-alt px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em] text-text-muted">{item.category}</span>
                            {item.childName && <span className="rounded-full bg-primary/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em] text-primary">{item.childName}</span>}
                          </div>
                          <h4 className="font-display text-xl sm:text-2xl font-extrabold mb-2">{item.title}</h4>
                          <p className="text-sm text-text-muted">{item.detail}</p>
                        </div>
                        <div className="shrink-0 text-left sm:text-right">
                          {item.dueLabel && <div className="text-xs font-black uppercase tracking-[0.16em] text-secondary">{item.dueLabel}</div>}
                          <div className="mt-2 text-sm font-bold text-primary">Open →</div>
                        </div>
                      </div>
                    </Link>
                  ))
                )}
              </section>

              <aside className="space-y-5">
                <Card className="p-6 sm:p-7" accent="mustard">
                  <h3 className="font-display text-2xl font-extrabold mb-4">Family snapshot</h3>
                  <div className="space-y-4">
                    {snapshots.map((snapshot) => (
                      <div key={snapshot.child.id} className="rounded-2xl border border-border bg-bg/70 p-4">
                        <div className="flex items-center justify-between gap-3 mb-3">
                          <div>
                            <h4 className="font-display text-lg font-extrabold mb-0">{snapshot.child.name}</h4>
                            <p className="text-xs text-text-muted">{snapshot.activeCourses.length} active course{snapshot.activeCourses.length === 1 ? '' : 's'} · {snapshot.portfolioCount} samples</p>
                          </div>
                          <div className={`rounded-full px-3 py-1 text-xs font-black ${snapshot.overdueAssignments > 0 || snapshot.missingWeekdays.length >= 3 ? 'bg-red-50 text-red-600' : 'bg-primary/10 text-primary'}`}>
                            {snapshot.overdueAssignments > 0 || snapshot.missingWeekdays.length >= 3 ? 'Needs eyes' : 'Steady'}
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-center">
                          <div className="rounded-xl bg-white p-3">
                            <div className="font-display text-xl font-extrabold text-secondary">{snapshot.openAssignments}</div>
                            <div className="text-[10px] font-bold text-text-muted uppercase">Open</div>
                          </div>
                          <div className="rounded-xl bg-white p-3">
                            <div className="font-display text-xl font-extrabold text-primary">{snapshot.missingWeekdays.length}</div>
                            <div className="text-[10px] font-bold text-text-muted uppercase">Gaps</div>
                          </div>
                          <div className="rounded-xl bg-white p-3">
                            <div className="font-display text-xl font-extrabold text-accent">{snapshot.staleCourses.length}</div>
                            <div className="text-[10px] font-bold text-text-muted uppercase">Stale</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>

                <Card className="p-6 sm:p-7 bg-primary-dark text-white border-primary-dark">
                  <p className="text-xs font-black uppercase tracking-[0.22em] text-white/50 mb-3">Why this exists</p>
                  <p className="font-serif italic text-xl leading-snug mb-4">Weekly review should feel like clearing a short punch list, not spelunking through four different screens.</p>
                  <p className="text-sm text-white/70">Use this before Sunday planning or state-record cleanup. If it is noisy, the data needs attention. If it is quiet, move on.</p>
                </Card>
              </aside>
            </div>
          </>
        )}
      </main>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </>
  );
}
