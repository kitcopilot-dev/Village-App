'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getPocketBase } from '@/lib/pocketbase';
import { Assignment, Attendance, Child, Course, PortfolioItem, SchoolYear } from '@/lib/types';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { LoadingScreen } from '@/components/ui/Spinner';

const CORE_SUBJECTS = ['Language Arts', 'Mathematics', 'Science', 'Social Studies'];
const ELECTIVE_SUBJECTS = ['Fine Arts', 'Physical Education', 'Electives'];
const ALL_SUBJECTS = [...CORE_SUBJECTS, ...ELECTIVE_SUBJECTS];
const RECORD_GOAL_DAYS = 180;

type AuditWindow = '30' | '90' | 'year';
type CopyState = 'idle' | 'copied' | 'failed';

interface ChildAudit {
  child: Child;
  attendanceRecords: Attendance[];
  loggedInstructionDays: number;
  expectedSchoolDays: number;
  recentMissingDays: string[];
  assignments: Assignment[];
  overdueAssignments: Assignment[];
  dueSoonAssignments: Assignment[];
  ungradedCompletedAssignments: Assignment[];
  portfolioItems: PortfolioItem[];
  portfolioBySubject: Record<string, number>;
  missingCoreSubjects: string[];
  courses: Course[];
  averageCourseProgress: number;
  readinessScore: number;
  nextActions: string[];
}

function formatDateOnly(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function normalizeDateOnly(value?: string): string {
  if (!value) return '';
  return value.slice(0, 10);
}

function formatPrettyDate(value: string): string {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric'
  });
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function isWeekday(date: Date): boolean {
  const day = date.getDay();
  return day !== 0 && day !== 6;
}

function countWeekdays(start: Date, end: Date): number {
  let count = 0;
  const cursor = new Date(start);
  cursor.setHours(0, 0, 0, 0);
  const last = new Date(end);
  last.setHours(0, 0, 0, 0);

  while (cursor <= last) {
    if (isWeekday(cursor)) count += 1;
    cursor.setDate(cursor.getDate() + 1);
  }

  return count;
}

function getRecentSchoolDays(count: number, today = new Date()): string[] {
  const days: string[] = [];
  const cursor = new Date(today);
  cursor.setHours(0, 0, 0, 0);

  while (days.length < count) {
    if (isWeekday(cursor)) {
      days.push(formatDateOnly(cursor));
    }
    cursor.setDate(cursor.getDate() - 1);
  }

  return days;
}

function isAssignmentOpen(assignment: Assignment): boolean {
  return assignment.status === 'pending' || assignment.status === 'in_progress';
}

function scoreLabel(score: number): { label: string; tone: string } {
  if (score >= 85) return { label: 'Ready', tone: 'text-green-700 bg-green-50 border-green-200' };
  if (score >= 65) return { label: 'Needs touch-up', tone: 'text-amber-700 bg-amber-50 border-amber-200' };
  return { label: 'Gaps found', tone: 'text-red-700 bg-red-50 border-red-200' };
}

function buildAuditText(audits: ChildAudit[], windowLabel: string): string {
  const lines = [`Village Record Audit — ${windowLabel}`, ''];

  audits.forEach((audit) => {
    lines.push(`${audit.child.name}: ${audit.readinessScore}% record-ready`);
    lines.push(`- Attendance: ${audit.loggedInstructionDays}/${audit.expectedSchoolDays} expected school days in window`);
    lines.push(`- Overdue assignments: ${audit.overdueAssignments.length}`);
    lines.push(`- Portfolio samples: ${audit.portfolioItems.length}`);
    if (audit.missingCoreSubjects.length > 0) {
      lines.push(`- Missing core evidence: ${audit.missingCoreSubjects.join(', ')}`);
    }
    audit.nextActions.slice(0, 3).forEach((action) => lines.push(`  • ${action}`));
    lines.push('');
  });

  return lines.join('\n');
}

export default function RecordAuditPage() {
  const router = useRouter();
  const pb = getPocketBase();

  const [loading, setLoading] = useState(true);
  const [kids, setKids] = useState<Child[]>([]);
  const [schoolYear, setSchoolYear] = useState<SchoolYear | null>(null);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [portfolioItems, setPortfolioItems] = useState<PortfolioItem[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [auditWindow, setAuditWindow] = useState<AuditWindow>('30');
  const [copyState, setCopyState] = useState<CopyState>('idle');

  useEffect(() => {
    if (!pb.authStore.isValid) {
      router.push('/');
      return;
    }

    loadAuditData();
  }, []);

  const today = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return now;
  }, []);

  const auditStart = useMemo(() => {
    if (auditWindow === 'year' && schoolYear?.start_date) {
      const [year, month, day] = normalizeDateOnly(schoolYear.start_date).split('-').map(Number);
      return new Date(year, month - 1, day);
    }

    return addDays(today, auditWindow === '90' ? -89 : -29);
  }, [auditWindow, schoolYear, today]);

  const windowLabel = useMemo(() => {
    if (auditWindow === 'year') return 'school year to date';
    return `last ${auditWindow} days`;
  }, [auditWindow]);

  const loadAuditData = async () => {
    setLoading(true);

    try {
      const userId = pb.authStore.model?.id;
      if (!userId) return;

      const childRecords = await pb.collection('children').getFullList({
        filter: `user = "${userId}"`,
        sort: 'name'
      });
      const loadedKids = childRecords as unknown as Child[];
      setKids(loadedKids);

      const [yearRecords, attendanceRecords, assignmentRecords, portfolioRecords, courseRecords] = await Promise.all([
        pb.collection('school_years').getFullList({
          filter: `user = "${userId}"`,
          sort: '-start_date',
          limit: 1
        }).catch(() => []),
        pb.collection('attendance').getFullList({
          filter: `user = "${userId}"`,
          sort: '-date'
        }).catch(() => []),
        pb.collection('assignments').getFullList({
          filter: `user = "${userId}"`,
          sort: 'due_date'
        }).catch(() => []),
        pb.collection('portfolio').getFullList({
          filter: `user = "${userId}"`,
          sort: '-date'
        }).catch(() => []),
        loadedKids.length > 0
          ? pb.collection('courses').getFullList({
              filter: loadedKids.map((kid) => `child = "${kid.id}"`).join(' || '),
              sort: 'name'
            }).catch(() => [])
          : Promise.resolve([])
      ]);

      setSchoolYear(yearRecords.length > 0 ? yearRecords[0] as unknown as SchoolYear : null);
      setAttendance(attendanceRecords as unknown as Attendance[]);
      setAssignments(assignmentRecords as unknown as Assignment[]);
      setPortfolioItems(portfolioRecords as unknown as PortfolioItem[]);
      setCourses(courseRecords as unknown as Course[]);
    } catch (error) {
      console.error('Record audit load error:', error);
    } finally {
      setLoading(false);
    }
  };

  const audits = useMemo<ChildAudit[]>(() => {
    const startStr = formatDateOnly(auditStart);
    const todayStr = formatDateOnly(today);
    const expectedSchoolDays = countWeekdays(auditStart, today);
    const recentSchoolDays = getRecentSchoolDays(10, today);

    return kids.map((child) => {
      const childAttendance = attendance.filter((record) => {
        const date = normalizeDateOnly(record.date);
        return record.child === child.id && date >= startStr && date <= todayStr;
      });

      const attendedDateSet = new Set(childAttendance.map((record) => normalizeDateOnly(record.date)));
      const recentMissingDays = recentSchoolDays.filter((date) => !attendedDateSet.has(date));
      const loggedInstructionDays = childAttendance.reduce((total, record) => {
        if (record.status === 'present') return total + 1;
        if (record.status === 'half-day') return total + 0.5;
        return total;
      }, 0);

      const childAssignments = assignments.filter((assignment) => assignment.child === child.id);
      const windowAssignments = childAssignments.filter((assignment) => {
        const dueDate = normalizeDateOnly(assignment.due_date);
        const updatedDate = normalizeDateOnly(assignment.updated);
        return (dueDate >= startStr && dueDate <= todayStr) || (updatedDate >= startStr && updatedDate <= todayStr);
      });
      const overdueAssignments = childAssignments.filter((assignment) => {
        const dueDate = normalizeDateOnly(assignment.due_date);
        return isAssignmentOpen(assignment) && dueDate !== '' && dueDate < todayStr;
      });
      const dueSoonAssignments = childAssignments.filter((assignment) => {
        const dueDate = normalizeDateOnly(assignment.due_date);
        const sevenDaysOut = formatDateOnly(addDays(today, 7));
        return isAssignmentOpen(assignment) && dueDate >= todayStr && dueDate <= sevenDaysOut;
      });
      const ungradedCompletedAssignments = childAssignments.filter((assignment) => {
        const isComplete = assignment.status === 'completed' || assignment.status === 'Graded';
        return isComplete && (assignment.score === undefined || assignment.score === null);
      });

      const childPortfolio = portfolioItems.filter((item) => {
        const date = normalizeDateOnly(item.date || item.created);
        return item.child === child.id && date >= startStr && date <= todayStr;
      });
      const portfolioBySubject = ALL_SUBJECTS.reduce<Record<string, number>>((summary, subject) => {
        summary[subject] = childPortfolio.filter((item) => item.subject === subject).length;
        return summary;
      }, {});
      const missingCoreSubjects = CORE_SUBJECTS.filter((subject) => (portfolioBySubject[subject] || 0) === 0);

      const childCourses = courses.filter((course) => course.child === child.id);
      const averageCourseProgress = childCourses.length > 0
        ? Math.round(
            childCourses.reduce((sum, course) => {
              const completed = Math.max(0, Math.min(course.current_lesson - 1, course.total_lessons));
              return sum + (course.total_lessons > 0 ? (completed / course.total_lessons) * 100 : 0);
            }, 0) / childCourses.length
          )
        : 0;

      const attendanceScore = expectedSchoolDays > 0
        ? Math.min(40, Math.round((loggedInstructionDays / expectedSchoolDays) * 40))
        : 40;
      const portfolioScore = Math.round(((CORE_SUBJECTS.length - missingCoreSubjects.length) / CORE_SUBJECTS.length) * 25);
      const assignmentPenalty = Math.min(25, overdueAssignments.length * 5 + ungradedCompletedAssignments.length * 2);
      const assignmentScore = Math.max(0, 25 - assignmentPenalty);
      const courseScore = childCourses.length > 0 ? Math.min(10, Math.round(averageCourseProgress / 10)) : 8;
      const readinessScore = Math.max(0, Math.min(100, attendanceScore + portfolioScore + assignmentScore + courseScore));

      const nextActions: string[] = [];
      if (recentMissingDays.length > 0) {
        nextActions.push(`Mark attendance for ${recentMissingDays.slice(0, 3).map(formatPrettyDate).join(', ')}.`);
      }
      if (overdueAssignments.length > 0) {
        nextActions.push(`Clear ${overdueAssignments.length} overdue assignment${overdueAssignments.length === 1 ? '' : 's'}.`);
      }
      if (missingCoreSubjects.length > 0) {
        nextActions.push(`Add portfolio evidence for ${missingCoreSubjects.slice(0, 2).join(' and ')}.`);
      }
      if (ungradedCompletedAssignments.length > 0) {
        nextActions.push(`Add scores or feedback to ${ungradedCompletedAssignments.length} completed assignment${ungradedCompletedAssignments.length === 1 ? '' : 's'}.`);
      }
      if (nextActions.length === 0) {
        nextActions.push('Records look tidy. Print or copy this audit for the family binder.');
      }

      return {
        child,
        attendanceRecords: childAttendance,
        loggedInstructionDays,
        expectedSchoolDays,
        recentMissingDays,
        assignments: windowAssignments,
        overdueAssignments,
        dueSoonAssignments,
        ungradedCompletedAssignments,
        portfolioItems: childPortfolio,
        portfolioBySubject,
        missingCoreSubjects,
        courses: childCourses,
        averageCourseProgress,
        readinessScore,
        nextActions
      };
    });
  }, [auditStart, attendance, assignments, courses, kids, portfolioItems, today]);

  const familyStats = useMemo(() => {
    const childCount = Math.max(1, audits.length);
    return {
      averageReadiness: Math.round(audits.reduce((sum, audit) => sum + audit.readinessScore, 0) / childCount),
      totalOverdue: audits.reduce((sum, audit) => sum + audit.overdueAssignments.length, 0),
      totalMissingAttendance: audits.reduce((sum, audit) => sum + audit.recentMissingDays.length, 0),
      totalPortfolioItems: audits.reduce((sum, audit) => sum + audit.portfolioItems.length, 0),
      projectedYearDays: audits.length > 0
        ? Math.round(audits.reduce((sum, audit) => sum + audit.loggedInstructionDays, 0) / childCount)
        : 0
    };
  }, [audits]);

  const copyAudit = async () => {
    setCopyState('idle');
    try {
      await navigator.clipboard.writeText(buildAuditText(audits, windowLabel));
      setCopyState('copied');
      setTimeout(() => setCopyState('idle'), 2500);
    } catch (error) {
      console.error('Copy audit failed:', error);
      setCopyState('failed');
    }
  };

  const handleLogout = () => {
    pb.authStore.clear();
    router.push('/');
  };

  if (loading) return <LoadingScreen message="Auditing your homeschool records..." />;

  if (kids.length === 0) {
    return (
      <>
        <Header showLogout onLogout={handleLogout} />
        <main className="max-w-5xl mx-auto my-12 px-6 pb-20 animate-fade-in">
          <Card className="text-center py-20">
            <p className="text-5xl mb-4">🧾</p>
            <h2 className="font-display text-4xl font-extrabold mb-3">Record Audit</h2>
            <p className="text-text-muted mb-8">Add your children first, then Village can spot record gaps automatically.</p>
            <Button onClick={() => router.push('/manage-kids')}>Add Your First Child</Button>
          </Card>
        </main>
      </>
    );
  }

  return (
    <>
      <Header showLogout onLogout={handleLogout} />
      <main className="max-w-7xl mx-auto my-10 px-4 sm:px-8 pb-24 animate-fade-in print:my-0 print:px-0">
        <section className="relative overflow-hidden rounded-[2.5rem] border border-primary/15 bg-primary-dark text-white px-6 py-8 sm:px-10 sm:py-12 mb-8 shadow-[0_30px_80px_-45px_rgba(45,59,41,0.7)] print:bg-white print:text-text print:shadow-none">
          <div className="absolute inset-0 opacity-30 print:hidden" aria-hidden="true">
            <div className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-accent blur-3xl" />
            <div className="absolute left-1/3 bottom-0 h-56 w-56 rounded-full bg-secondary blur-3xl" />
          </div>
          <div className="relative grid lg:grid-cols-[1.2fr_0.8fr] gap-8 items-end">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.35em] text-accent-soft mb-4">Parent command ledger</p>
              <h2 className="font-display text-4xl sm:text-6xl font-extrabold leading-none tracking-tight mb-5">Record Audit</h2>
              <p className="text-white/80 max-w-2xl text-lg font-serif italic print:text-text-muted">
                A quick, read-only gap finder for attendance, overdue assignments, portfolio evidence, and course pacing before records become a Saturday problem.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              <div className="rounded-[1.5rem] border border-white/15 bg-white/10 p-4 backdrop-blur print:border-border print:bg-bg-alt">
                <p className="text-3xl font-display font-extrabold">{familyStats.averageReadiness}%</p>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/60 print:text-text-muted">Avg ready</p>
              </div>
              <div className="rounded-[1.5rem] border border-white/15 bg-white/10 p-4 backdrop-blur print:border-border print:bg-bg-alt">
                <p className="text-3xl font-display font-extrabold">{familyStats.totalOverdue}</p>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/60 print:text-text-muted">Overdue</p>
              </div>
              <div className="rounded-[1.5rem] border border-white/15 bg-white/10 p-4 backdrop-blur print:border-border print:bg-bg-alt">
                <p className="text-3xl font-display font-extrabold">{familyStats.totalMissingAttendance}</p>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/60 print:text-text-muted">Recent gaps</p>
              </div>
              <div className="rounded-[1.5rem] border border-white/15 bg-white/10 p-4 backdrop-blur print:border-border print:bg-bg-alt">
                <p className="text-3xl font-display font-extrabold">{familyStats.totalPortfolioItems}</p>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/60 print:text-text-muted">Samples</p>
              </div>
            </div>
          </div>
        </section>

        <section className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-8 print:hidden">
          <div className="flex flex-wrap gap-2 rounded-full bg-bg-alt p-2 border border-border w-fit">
            {([
              ['30', '30 days'],
              ['90', '90 days'],
              ['year', 'School year']
            ] as [AuditWindow, string][]).map(([value, label]) => (
              <button
                key={value}
                onClick={() => setAuditWindow(value)}
                className={`px-4 py-2 rounded-full text-sm font-bold transition-all ${auditWindow === value ? 'bg-primary text-white shadow' : 'text-text-muted hover:bg-white hover:text-text'}`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" size="sm" onClick={() => router.push('/attendance')}>Fix attendance</Button>
            <Button variant="outline" size="sm" onClick={() => router.push('/portfolio')}>Add evidence</Button>
            <Button variant="outline" size="sm" onClick={() => router.push('/assignments')}>Review assignments</Button>
            <Button variant="ghost" size="sm" onClick={copyAudit}>{copyState === 'copied' ? 'Copied ✓' : copyState === 'failed' ? 'Copy failed' : 'Copy checklist'}</Button>
            <Button size="sm" onClick={() => window.print()}>Print audit</Button>
          </div>
        </section>

        <section className="grid lg:grid-cols-[0.8fr_1.2fr] gap-6 mb-8">
          <Card className="p-6 md:p-8 bg-accent-soft/35 border-accent/30">
            <p className="text-xs font-black uppercase tracking-[0.25em] text-secondary mb-3">What Kitt would fix first</p>
            <div className="space-y-4">
              {audits.flatMap((audit) => audit.nextActions.slice(0, 2).map((action) => ({ childName: audit.child.name, action }))).slice(0, 6).map((item, index) => (
                <div key={`${item.childName}-${item.action}`} className="flex gap-3 items-start">
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-xs font-black text-primary shadow">{index + 1}</span>
                  <p className="text-sm text-text-muted"><span className="font-bold text-text">{item.childName}:</span> {item.action}</p>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-6 md:p-8">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.25em] text-primary mb-2">Attendance trajectory</p>
                <h3 className="font-display text-3xl font-extrabold mb-1">{familyStats.projectedYearDays} days logged per student</h3>
                <p className="text-sm text-text-muted">Goal is {RECORD_GOAL_DAYS} instruction days. This card uses the selected audit window, not a legal judgment.</p>
              </div>
              <div className="text-right">
                <p className="text-4xl font-display font-extrabold text-primary">{Math.min(100, Math.round((familyStats.projectedYearDays / RECORD_GOAL_DAYS) * 100))}%</p>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-text-muted">of annual goal</p>
              </div>
            </div>
            <div className="h-3 rounded-full bg-bg-alt overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-primary via-primary-light to-accent transition-all"
                style={{ width: `${Math.min(100, Math.round((familyStats.projectedYearDays / RECORD_GOAL_DAYS) * 100))}%` }}
              />
            </div>
          </Card>
        </section>

        <section className="space-y-6">
          {audits.map((audit) => {
            const label = scoreLabel(audit.readinessScore);

            return (
              <Card key={audit.child.id} className="p-0 overflow-hidden print:break-inside-avoid">
                <div className="grid xl:grid-cols-[280px_1fr]">
                  <div className="bg-bg-alt p-6 md:p-8 border-b xl:border-b-0 xl:border-r border-border">
                    <div className="flex items-start justify-between gap-4 xl:block">
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.25em] text-text-muted mb-2">Student</p>
                        <h3 className="font-display text-3xl font-extrabold leading-none mb-3">{audit.child.name}</h3>
                        <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-black uppercase tracking-wide ${label.tone}`}>{label.label}</span>
                      </div>
                      <div className="xl:mt-8 text-right xl:text-left">
                        <p className="font-display text-5xl font-extrabold text-primary">{audit.readinessScore}%</p>
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-text-muted">record ready</p>
                      </div>
                    </div>

                    <div className="mt-8 space-y-3">
                      {audit.nextActions.map((action) => (
                        <div key={action} className="rounded-2xl bg-white border border-border p-3 text-sm text-text-muted">
                          {action}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="p-6 md:p-8">
                    <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
                      <div className="rounded-[1.25rem] border border-border bg-bg p-4">
                        <p className="text-2xl font-display font-extrabold">{audit.loggedInstructionDays}/{audit.expectedSchoolDays}</p>
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-text-muted">instruction days</p>
                      </div>
                      <div className="rounded-[1.25rem] border border-border bg-bg p-4">
                        <p className="text-2xl font-display font-extrabold">{audit.overdueAssignments.length}</p>
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-text-muted">overdue tasks</p>
                      </div>
                      <div className="rounded-[1.25rem] border border-border bg-bg p-4">
                        <p className="text-2xl font-display font-extrabold">{audit.portfolioItems.length}</p>
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-text-muted">samples filed</p>
                      </div>
                      <div className="rounded-[1.25rem] border border-border bg-bg p-4">
                        <p className="text-2xl font-display font-extrabold">{audit.averageCourseProgress}%</p>
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-text-muted">course pace</p>
                      </div>
                    </div>

                    <div className="grid lg:grid-cols-3 gap-5">
                      <div>
                        <h4 className="font-display text-xl font-extrabold mb-3">Recent attendance gaps</h4>
                        {audit.recentMissingDays.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {audit.recentMissingDays.map((day) => (
                              <span key={day} className="rounded-full bg-red-50 border border-red-100 px-3 py-1 text-xs font-bold text-red-700">{formatPrettyDate(day)}</span>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-green-700 font-semibold">No weekday gaps in the last 10 school days.</p>
                        )}
                      </div>

                      <div>
                        <h4 className="font-display text-xl font-extrabold mb-3">Portfolio coverage</h4>
                        <div className="grid grid-cols-2 gap-2">
                          {CORE_SUBJECTS.map((subject) => (
                            <div key={subject} className={`rounded-2xl border px-3 py-2 text-xs font-bold ${audit.missingCoreSubjects.includes(subject) ? 'bg-amber-50 text-amber-800 border-amber-200' : 'bg-green-50 text-green-800 border-green-200'}`}>
                              {subject}: {audit.portfolioBySubject[subject] || 0}
                            </div>
                          ))}
                        </div>
                      </div>

                      <div>
                        <h4 className="font-display text-xl font-extrabold mb-3">Assignment pressure</h4>
                        <div className="space-y-2 text-sm">
                          <p className="flex justify-between border-b border-border pb-2"><span className="text-text-muted">Due next 7 days</span><strong>{audit.dueSoonAssignments.length}</strong></p>
                          <p className="flex justify-between border-b border-border pb-2"><span className="text-text-muted">Completed, ungraded</span><strong>{audit.ungradedCompletedAssignments.length}</strong></p>
                          <p className="flex justify-between"><span className="text-text-muted">In audit window</span><strong>{audit.assignments.length}</strong></p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </section>
      </main>
    </>
  );
}
