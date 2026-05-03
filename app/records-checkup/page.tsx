'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getPocketBase } from '@/lib/pocketbase';
import { Assignment, Attendance, Child, Course, PortfolioItem, SchoolYear } from '@/lib/types';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { LoadingScreen } from '@/components/ui/Spinner';

type LoadState = 'idle' | 'loading' | 'ready' | 'error';

type ChildRecordHealth = {
  child: Child;
  attendanceDays: number;
  gradedAssignments: number;
  completedAssignments: number;
  portfolioItems: number;
  activeCourses: number;
  courseCompletion: number;
  missing: string[];
};

type CheckupData = {
  kids: Child[];
  attendance: Attendance[];
  assignments: Assignment[];
  portfolio: PortfolioItem[];
  courses: Course[];
  schoolYear: SchoolYear | null;
};

const ATTENDANCE_TARGET_DAYS = 180;
const PORTFOLIO_TARGET_PER_CHILD = 6;
const GRADED_ASSIGNMENT_TARGET_PER_CHILD = 12;

function todayIso() {
  return new Date().toISOString().split('T')[0];
}

function defaultSchoolYearWindow() {
  const now = new Date();
  const year = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
  return {
    start: `${year}-08-01`,
    end: `${year + 1}-07-31`,
    label: `${year}-${year + 1}`,
  };
}

function dateOnly(value?: string) {
  return value?.split(' ')[0]?.split('T')[0] ?? '';
}

function attendanceCredit(record: Attendance) {
  if (record.status === 'present') return 1;
  if (record.status === 'half-day') return 0.5;
  return 0;
}

function percent(value: number, target: number) {
  if (target <= 0) return 0;
  return Math.min(100, Math.round((value / target) * 100));
}

function readinessLabel(score: number) {
  if (score >= 85) return { text: 'Review-ready', tone: 'text-green-700 bg-green-50 border-green-100' };
  if (score >= 65) return { text: 'On track', tone: 'text-primary bg-primary/10 border-primary/15' };
  if (score >= 40) return { text: 'Needs cleanup', tone: 'text-amber-700 bg-amber-50 border-amber-100' };
  return { text: 'Needs records', tone: 'text-red-700 bg-red-50 border-red-100' };
}

function buildSummaryLines(children: ChildRecordHealth[], score: number, yearLabel: string) {
  const topActions = children.flatMap((child) => child.missing.map((item) => `${child.child.name}: ${item}`)).slice(0, 8);
  return [
    `Village Records Checkup — ${yearLabel}`,
    `Readiness score: ${score}/100`,
    '',
    ...children.map((child) => (
      `${child.child.name}: ${child.attendanceDays} attendance day${child.attendanceDays === 1 ? '' : 's'}, ${child.gradedAssignments} graded assignment${child.gradedAssignments === 1 ? '' : 's'}, ${child.portfolioItems} portfolio item${child.portfolioItems === 1 ? '' : 's'}, ${child.courseCompletion}% course progress`
    )),
    '',
    'Next actions:',
    ...(topActions.length > 0 ? topActions.map((action) => `- ${action}`) : ['- Records look clean. Print or export for your year-end folder.']),
  ].join('\n');
}

export default function RecordsCheckupPage() {
  const router = useRouter();
  const pb = getPocketBase();

  const [state, setState] = useState<LoadState>('idle');
  const [data, setData] = useState<CheckupData>({
    kids: [],
    attendance: [],
    assignments: [],
    portfolio: [],
    courses: [],
    schoolYear: null,
  });
  const [copied, setCopied] = useState(false);

  const loadCheckup = useCallback(async () => {
    setState('loading');

    try {
      const userId = pb.authStore.model?.id;
      if (!userId) return;

      const schoolYears = await pb.collection('school_years').getFullList({
        filter: `user = "${userId}"`,
        sort: '-start_date',
        limit: 1,
      }).catch(() => []);

      const schoolYear = schoolYears[0] as unknown as SchoolYear | undefined;
      const fallbackYear = defaultSchoolYearWindow();
      const start = schoolYear?.start_date ?? fallbackYear.start;
      const end = schoolYear?.end_date ?? fallbackYear.end;

      const kids = await pb.collection('children').getFullList({
        filter: `user = "${userId}"`,
        sort: 'name',
      }).catch(() => []) as unknown as Child[];

      const childFilter = kids.length > 0 ? kids.map((kid) => `child = "${kid.id}"`).join(' || ') : '';

      const [attendance, assignments, portfolio, courses] = await Promise.all([
        pb.collection('attendance').getFullList({
          filter: `user = "${userId}" && date >= "${start}" && date <= "${end}"`,
          sort: 'date',
        }).catch(() => []),
        pb.collection('assignments').getFullList({
          filter: `user = "${userId}" && (due_date = "" || due_date <= "${todayIso()}" || status = "completed" || status = "Graded")`,
          sort: '-due_date',
        }).catch(() => []),
        childFilter
          ? pb.collection('portfolio_items').getFullList({
              filter: `(${childFilter}) && created >= "${start}" && created <= "${end}"`,
              sort: '-created',
            }).catch(() => [])
          : Promise.resolve([]),
        childFilter
          ? pb.collection('courses').getFullList({
              filter: childFilter,
              sort: 'name',
            }).catch(() => [])
          : Promise.resolve([]),
      ]);

      setData({
        kids,
        attendance: attendance as unknown as Attendance[],
        assignments: assignments as unknown as Assignment[],
        portfolio: portfolio as unknown as PortfolioItem[],
        courses: courses as unknown as Course[],
        schoolYear: schoolYear ?? null,
      });
      setState('ready');
    } catch (error) {
      console.error('Records checkup load error:', error);
      setState('error');
    }
  }, [pb]);

  useEffect(() => {
    if (!pb.authStore.isValid) {
      router.push('/');
      return;
    }

    const timer = window.setTimeout(() => {
      void loadCheckup();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadCheckup, pb.authStore.isValid, router]);

  const yearWindow = useMemo(() => {
    const fallback = defaultSchoolYearWindow();
    return {
      start: data.schoolYear?.start_date ?? fallback.start,
      end: data.schoolYear?.end_date ?? fallback.end,
      label: data.schoolYear?.name ?? fallback.label,
    };
  }, [data.schoolYear]);

  const childHealth = useMemo<ChildRecordHealth[]>(() => {
    return data.kids.map((child) => {
      const childAttendance = data.attendance.filter((record) => record.child === child.id);
      const childAssignments = data.assignments.filter((assignment) => !assignment.child || assignment.child === child.id);
      const childPortfolio = data.portfolio.filter((item) => item.child === child.id);
      const childCourses = data.courses.filter((course) => course.child === child.id);

      const attendanceDays = childAttendance.reduce((total, record) => total + attendanceCredit(record), 0);
      const gradedAssignments = childAssignments.filter((assignment) => assignment.score !== undefined && assignment.score !== null).length;
      const completedAssignments = childAssignments.filter((assignment) => assignment.status === 'completed' || assignment.status === 'Graded').length;
      const courseCompletion = childCourses.length > 0
        ? Math.round(childCourses.reduce((sum, course) => {
            const complete = Math.max(0, Math.min(course.current_lesson - 1, course.total_lessons));
            return sum + percent(complete, course.total_lessons);
          }, 0) / childCourses.length)
        : 0;

      const missing: string[] = [];
      if (attendanceDays < 30) missing.push('log more attendance history for the active year');
      if (gradedAssignments < 4) missing.push('grade a few representative assignments');
      if (childPortfolio.length < 2) missing.push('add portfolio samples for evaluator-ready evidence');
      if (childCourses.length === 0) missing.push('add active courses so progress is trackable');
      if (childCourses.length > 0 && courseCompletion < 25) missing.push('update lesson progress on current courses');

      return {
        child,
        attendanceDays,
        gradedAssignments,
        completedAssignments,
        portfolioItems: childPortfolio.length,
        activeCourses: childCourses.length,
        courseCompletion,
        missing,
      };
    });
  }, [data]);

  const totals = useMemo(() => {
    const childCount = Math.max(data.kids.length, 1);
    const attendanceDays = childHealth.reduce((sum, child) => sum + child.attendanceDays, 0);
    const gradedAssignments = childHealth.reduce((sum, child) => sum + child.gradedAssignments, 0);
    const portfolioItems = childHealth.reduce((sum, child) => sum + child.portfolioItems, 0);
    const courseAverage = childHealth.length > 0
      ? Math.round(childHealth.reduce((sum, child) => sum + child.courseCompletion, 0) / childHealth.length)
      : 0;

    const attendanceScore = percent(attendanceDays, ATTENDANCE_TARGET_DAYS * childCount) * 0.35;
    const assignmentScore = percent(gradedAssignments, GRADED_ASSIGNMENT_TARGET_PER_CHILD * childCount) * 0.2;
    const portfolioScore = percent(portfolioItems, PORTFOLIO_TARGET_PER_CHILD * childCount) * 0.25;
    const courseScore = courseAverage * 0.2;
    const readinessScore = Math.round(attendanceScore + assignmentScore + portfolioScore + courseScore);

    return {
      attendanceDays,
      gradedAssignments,
      portfolioItems,
      courseAverage,
      readinessScore,
    };
  }, [childHealth, data.kids.length]);

  const nextActions = useMemo(() => {
    const actions = childHealth.flatMap((child) => child.missing.map((missing) => ({ child: child.child.name, missing })));
    if (actions.length > 0) return actions.slice(0, 6);

    return [
      { child: 'All students', missing: 'print this checkup for the parent binder' },
      { child: 'All students', missing: 'export transcripts and weekly summaries before evaluation season' },
    ];
  }, [childHealth]);

  const summary = useMemo(() => buildSummaryLines(childHealth, totals.readinessScore, yearWindow.label), [childHealth, totals.readinessScore, yearWindow.label]);
  const label = readinessLabel(totals.readinessScore);

  const handleLogout = () => {
    pb.authStore.clear();
    router.push('/');
  };

  const copySummary = async () => {
    try {
      await navigator.clipboard.writeText(summary);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Copy failed:', error);
    }
  };

  if (state === 'loading' || state === 'idle') return <LoadingScreen message="Checking your records..." />;

  if (state === 'error') {
    return (
      <>
        <Header showLogout onLogout={handleLogout} />
        <main className="max-w-4xl mx-auto my-12 px-8 text-center">
          <Card className="py-16">
            <p className="text-xl text-text-muted mb-6">The records checkup could not load.</p>
            <Button onClick={loadCheckup}>Try Again</Button>
          </Card>
        </main>
      </>
    );
  }

  return (
    <>
      <Header showLogout onLogout={handleLogout} />
      <main className="max-w-7xl mx-auto my-12 px-4 sm:px-8 pb-24 animate-fade-in">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 mb-10">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/10 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-primary mb-5">
              Records command center
            </div>
            <h2 className="font-display text-4xl sm:text-6xl font-extrabold tracking-tight mb-3">Records Checkup</h2>
            <p className="max-w-2xl text-text-muted font-serif italic text-lg">
              One calm page that tells parents what is ready, what is missing, and what to clean up before reviews, portfolios, or year-end paperwork.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" onClick={() => router.push('/reports')}>📊 Weekly Reports</Button>
            <Button variant="outline" onClick={() => router.push('/transcript')}>📄 Transcript</Button>
            <Button variant="ghost" onClick={() => window.print()}>Print</Button>
          </div>
        </div>

        {data.kids.length === 0 ? (
          <Card className="text-center py-20">
            <p className="text-xl text-text-muted mb-8 italic font-serif">No children found yet. Add students first, then Village can audit the records.</p>
            <Button onClick={() => router.push('/manage-kids')}>Add Your First Child</Button>
          </Card>
        ) : (
          <>
            <section className="grid lg:grid-cols-[1.1fr_.9fr] gap-8 mb-10">
              <Card className="bg-primary-dark text-white border-primary-dark overflow-hidden">
                <div className="absolute -right-20 -top-24 h-72 w-72 rounded-full bg-white/10 blur-2xl" />
                <div className="relative">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-6 mb-8">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.22em] text-white/55 mb-3">{yearWindow.label} · {dateOnly(yearWindow.start)} to {dateOnly(yearWindow.end)}</p>
                      <h3 className="font-display text-5xl sm:text-7xl font-extrabold tracking-tight mb-2">{totals.readinessScore}/100</h3>
                      <p className="text-white/75 font-serif italic text-xl">Records readiness score</p>
                    </div>
                    <span className={`self-start rounded-full border px-4 py-2 text-sm font-black ${label.tone}`}>{label.text}</span>
                  </div>
                  <ProgressBar percentage={totals.readinessScore} showPercentage={false} />
                  <div className="grid sm:grid-cols-4 gap-3 mt-8">
                    {[
                      { label: 'Attendance days', value: totals.attendanceDays.toLocaleString(), hint: `${ATTENDANCE_TARGET_DAYS}/student planning target` },
                      { label: 'Graded work', value: totals.gradedAssignments, hint: 'transcript evidence' },
                      { label: 'Portfolio samples', value: totals.portfolioItems, hint: 'review-ready proof' },
                      { label: 'Course progress', value: `${totals.courseAverage}%`, hint: 'average completion' },
                    ].map((metric) => (
                      <div key={metric.label} className="rounded-3xl bg-white/10 p-4 backdrop-blur-sm">
                        <div className="font-display text-3xl font-extrabold">{metric.value}</div>
                        <div className="text-sm font-bold text-white/85">{metric.label}</div>
                        <div className="text-xs text-white/55 mt-1">{metric.hint}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>

              <Card>
                <div className="flex items-start justify-between gap-4 mb-6">
                  <div>
                    <h3 className="font-serif italic text-2xl text-primary mb-1">Next best actions</h3>
                    <p className="text-sm text-text-muted">Generated from existing Village records. No new database fields needed.</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={copySummary}>{copied ? 'Copied' : 'Copy'}</Button>
                </div>
                <div className="space-y-3">
                  {nextActions.map((action, index) => (
                    <div key={`${action.child}-${action.missing}`} className="flex gap-3 rounded-2xl border border-border bg-bg-alt/70 p-4">
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-primary text-sm font-black text-white">{index + 1}</span>
                      <div>
                        <p className="font-bold text-text mb-1">{action.child}</p>
                        <p className="text-sm text-text-muted">{action.missing}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </section>

            <section className="grid md:grid-cols-2 xl:grid-cols-3 gap-6 mb-10">
              {childHealth.map((child) => {
                const childLabel = readinessLabel(Math.round(
                  percent(child.attendanceDays, ATTENDANCE_TARGET_DAYS) * 0.35 +
                  percent(child.gradedAssignments, GRADED_ASSIGNMENT_TARGET_PER_CHILD) * 0.2 +
                  percent(child.portfolioItems, PORTFOLIO_TARGET_PER_CHILD) * 0.25 +
                  child.courseCompletion * 0.2
                ));

                return (
                  <Card key={child.child.id} className="p-6 md:p-8">
                    <div className="flex items-start justify-between gap-3 mb-6">
                      <div>
                        <h3 className="font-display text-3xl font-extrabold mb-1">{child.child.name}</h3>
                        <p className="text-sm text-text-muted">{child.child.grade || 'Grade not set'} · {child.activeCourses} active course{child.activeCourses === 1 ? '' : 's'}</p>
                      </div>
                      <span className={`rounded-full border px-3 py-1 text-xs font-black ${childLabel.tone}`}>{childLabel.text}</span>
                    </div>

                    <div className="space-y-4 mb-6">
                      <ProgressBar label="Attendance" sublabel={`${child.attendanceDays} credited day${child.attendanceDays === 1 ? '' : 's'}`} percentage={percent(child.attendanceDays, ATTENDANCE_TARGET_DAYS)} />
                      <ProgressBar label="Graded work" sublabel={`${child.gradedAssignments} graded · ${child.completedAssignments} completed`} percentage={percent(child.gradedAssignments, GRADED_ASSIGNMENT_TARGET_PER_CHILD)} />
                      <ProgressBar label="Portfolio" sublabel={`${child.portfolioItems} sample${child.portfolioItems === 1 ? '' : 's'}`} percentage={percent(child.portfolioItems, PORTFOLIO_TARGET_PER_CHILD)} />
                      <ProgressBar label="Course progress" sublabel={`${child.courseCompletion}% average`} percentage={child.courseCompletion} />
                    </div>

                    <div className="rounded-2xl bg-bg-alt p-4">
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-text-muted mb-3">Cleanup list</p>
                      {child.missing.length > 0 ? (
                        <ul className="space-y-2 text-sm text-text-muted">
                          {child.missing.map((missing) => <li key={missing}>• {missing}</li>)}
                        </ul>
                      ) : (
                        <p className="text-sm font-semibold text-primary">Looks clean. This student is ready for review.</p>
                      )}
                    </div>
                  </Card>
                );
              })}
            </section>

            <Card className="p-6 md:p-8">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <h3 className="font-serif italic text-2xl text-primary mb-1">Parent binder summary</h3>
                  <p className="text-sm text-text-muted">Copy this into an email, journal note, or printed year-end folder.</p>
                </div>
                <Button variant="outline" onClick={copySummary}>{copied ? 'Copied to clipboard' : 'Copy summary'}</Button>
              </div>
              <pre className="mt-6 whitespace-pre-wrap rounded-3xl border border-border bg-bg-alt p-5 text-sm leading-7 text-text-muted">{summary}</pre>
            </Card>
          </>
        )}
      </main>
    </>
  );
}
