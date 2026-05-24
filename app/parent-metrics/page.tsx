'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getPocketBase } from '@/lib/pocketbase';
import { Assignment, Attendance, Child, Course, PortfolioItem } from '@/lib/types';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { LoadingScreen } from '@/components/ui/Spinner';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Badge } from '@/components/ui/Badge';

type StatusTone = 'success' | 'warning' | 'error';

interface ChildMetrics {
  child: Child;
  attendanceDays: number;
  attendanceRate: number;
  assignmentTotal: number;
  assignmentCompleted: number;
  assignmentCompletionRate: number;
  overdueAssignments: number;
  missingScores: number;
  averageScore: number | null;
  portfolioItems: number;
  courseProgress: number;
  coursesBehind: number;
  readinessScore: number;
  nextAction: string;
  tone: StatusTone;
}

const WINDOW_DAYS = 30;
const ATTENDANCE_TARGET = 20;
const PORTFOLIO_TARGET = 2;

function dateOnly(date: Date): string {
  return date.toISOString().split('T')[0];
}

function statusKey(status?: string): string {
  return (status || '').toLowerCase();
}

function isComplete(assignment: Assignment): boolean {
  const key = statusKey(assignment.status);
  return key === 'completed' || key === 'graded';
}

function isPending(assignment: Assignment): boolean {
  return !isComplete(assignment);
}

function getScoreTone(score: number): StatusTone {
  if (score >= 82) return 'success';
  if (score >= 65) return 'warning';
  return 'error';
}

function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows
    .map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(','))
    .join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export default function ParentMetricsPage() {
  const router = useRouter();
  const pb = getPocketBase();

  const [loading, setLoading] = useState(true);
  const [kids, setKids] = useState<Child[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  const today = useMemo(() => new Date(), []);
  const startDate = useMemo(() => {
    const start = new Date(today);
    start.setDate(start.getDate() - (WINDOW_DAYS - 1));
    start.setHours(0, 0, 0, 0);
    return start;
  }, [today]);

  const loadMetrics = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const userId = pb.authStore.model?.id;
      if (!userId) return;

      const start = dateOnly(startDate);
      const end = dateOnly(today);

      const childRecords = await pb.collection('children').getFullList({
        filter: `user = "${userId}"`,
        sort: 'name',
      });

      const childIds = childRecords.map((child) => child.id);
      const childFilter = childIds.map((id) => `child = "${id}"`).join(' || ');

      const [attendanceRecords, assignmentRecords, courseRecords, portfolioRecords] = await Promise.all([
        pb.collection('attendance').getFullList({
          filter: `user = "${userId}" && date >= "${start}" && date <= "${end}"`,
          sort: '-date',
        }).catch(() => []),
        pb.collection('assignments').getFullList({
          filter: `user = "${userId}"`,
          sort: '-due_date',
        }).catch(() => []),
        childFilter
          ? pb.collection('courses').getFullList({
              filter: childFilter,
              sort: 'name',
            }).catch(() => [])
          : Promise.resolve([]),
        childFilter
          ? pb.collection('portfolio').getFullList({
              filter: `(${childFilter}) && date >= "${start}" && date <= "${end}"`,
              sort: '-date',
            }).catch(() => [])
          : Promise.resolve([]),
      ]);

      setKids(childRecords as unknown as Child[]);
      setAttendance(attendanceRecords as unknown as Attendance[]);
      setAssignments(assignmentRecords as unknown as Assignment[]);
      setCourses(courseRecords as unknown as Course[]);
      setPortfolio(portfolioRecords as unknown as PortfolioItem[]);
    } catch (err) {
      console.error('Parent metrics load error:', err);
      setError('Metrics could not be loaded. Try refreshing the page.');
    } finally {
      setLoading(false);
    }
  }, [pb, startDate, today]);

  useEffect(() => {
    if (!pb.authStore.isValid) {
      router.push('/');
      return;
    }
    loadMetrics();
  }, [loadMetrics, pb.authStore.isValid, router]);

  const handleLogout = () => {
    pb.authStore.clear();
    router.push('/');
  };

  const metrics = useMemo<ChildMetrics[]>(() => {
    const todayKey = dateOnly(today);
    const startKey = dateOnly(startDate);

    return kids.map((child) => {
      const childAttendance = attendance.filter((item) => item.child === child.id);
      const childAssignments = assignments.filter((item) => item.child === child.id);
      const childCourses = courses.filter((item) => item.child === child.id);
      const childPortfolio = portfolio.filter((item) => item.child === child.id);

      const dueAssignments = childAssignments.filter((assignment) => (
        assignment.due_date
        && assignment.due_date <= todayKey
        && (assignment.due_date >= startKey || isPending(assignment))
      ));
      const completedAssignments = childAssignments.filter(isComplete);
      const gradedAssignments = childAssignments.filter((assignment) => assignment.score !== undefined && assignment.score !== null);
      const overdueAssignments = dueAssignments.filter((assignment) => (
        isPending(assignment) && Boolean(assignment.due_date) && assignment.due_date! < todayKey
      ));
      const missingScores = completedAssignments.filter((assignment) => assignment.score === undefined || assignment.score === null);

      const assignmentCompletionRate = dueAssignments.length > 0
        ? Math.round((completedAssignments.length / dueAssignments.length) * 100)
        : 100;

      const averageScore = gradedAssignments.length > 0
        ? Math.round(gradedAssignments.reduce((sum, assignment) => sum + (assignment.score || 0), 0) / gradedAssignments.length)
        : null;

      const attendanceRate = Math.min(100, Math.round((childAttendance.length / ATTENDANCE_TARGET) * 100));

      const courseProgress = childCourses.length > 0
        ? Math.round(
            childCourses.reduce((sum, course) => {
              const completed = Math.max(0, Math.min(course.current_lesson - 1, course.total_lessons));
              return sum + (course.total_lessons > 0 ? completed / course.total_lessons : 0);
            }, 0) / childCourses.length * 100
          )
        : 0;

      const coursesBehind = childCourses.filter((course) => {
        if (!course.last_lesson_date) return course.current_lesson <= 1;
        const lastLesson = new Date(course.last_lesson_date);
        const daysSinceLesson = Math.floor((today.getTime() - lastLesson.getTime()) / 86400000);
        return daysSinceLesson > 10 && course.current_lesson <= course.total_lessons;
      }).length;

      const portfolioRate = Math.min(100, Math.round((childPortfolio.length / PORTFOLIO_TARGET) * 100));
      const gradeScore = averageScore ?? 80;
      const penalty = Math.min(30, overdueAssignments.length * 8 + missingScores.length * 4 + coursesBehind * 6);
      const readinessScore = Math.max(
        0,
        Math.min(
          100,
          Math.round(attendanceRate * 0.25 + assignmentCompletionRate * 0.25 + gradeScore * 0.2 + portfolioRate * 0.15 + courseProgress * 0.15 - penalty)
        )
      );

      let nextAction = 'Keep logging work and portfolio evidence this week.';
      if (overdueAssignments.length > 0) {
        nextAction = `Clear ${overdueAssignments.length} overdue assignment${overdueAssignments.length === 1 ? '' : 's'}.`;
      } else if (missingScores.length > 0) {
        nextAction = `Add scores to ${missingScores.length} completed assignment${missingScores.length === 1 ? '' : 's'}.`;
      } else if (childAttendance.length < ATTENDANCE_TARGET) {
        nextAction = `Backfill ${ATTENDANCE_TARGET - childAttendance.length} attendance day${ATTENDANCE_TARGET - childAttendance.length === 1 ? '' : 's'}.`;
      } else if (childPortfolio.length < PORTFOLIO_TARGET) {
        nextAction = 'Add portfolio evidence for recent work.';
      } else if (coursesBehind > 0) {
        nextAction = `Review ${coursesBehind} course${coursesBehind === 1 ? '' : 's'} with stale progress.`;
      }

      return {
        child,
        attendanceDays: childAttendance.length,
        attendanceRate,
        assignmentTotal: dueAssignments.length,
        assignmentCompleted: completedAssignments.length,
        assignmentCompletionRate,
        overdueAssignments: overdueAssignments.length,
        missingScores: missingScores.length,
        averageScore,
        portfolioItems: childPortfolio.length,
        courseProgress,
        coursesBehind,
        readinessScore,
        nextAction,
        tone: getScoreTone(readinessScore),
      };
    });
  }, [attendance, assignments, courses, kids, portfolio, startDate, today]);

  const familySummary = useMemo(() => {
    if (metrics.length === 0) {
      return {
        readinessScore: 0,
        attendanceDays: 0,
        overdueAssignments: 0,
        missingScores: 0,
        portfolioItems: 0,
      };
    }

    return {
      readinessScore: Math.round(metrics.reduce((sum, item) => sum + item.readinessScore, 0) / metrics.length),
      attendanceDays: metrics.reduce((sum, item) => sum + item.attendanceDays, 0),
      overdueAssignments: metrics.reduce((sum, item) => sum + item.overdueAssignments, 0),
      missingScores: metrics.reduce((sum, item) => sum + item.missingScores, 0),
      portfolioItems: metrics.reduce((sum, item) => sum + item.portfolioItems, 0),
    };
  }, [metrics]);

  const exportMetrics = () => {
    downloadCsv(`village-parent-metrics-${dateOnly(today)}.csv`, [
      ['Child', 'Readiness', 'Attendance days', 'Assignment completion', 'Overdue', 'Missing scores', 'Average score', 'Portfolio items', 'Course progress', 'Next action'],
      ...metrics.map((item) => [
        item.child.name,
        String(item.readinessScore),
        String(item.attendanceDays),
        `${item.assignmentCompletionRate}%`,
        String(item.overdueAssignments),
        String(item.missingScores),
        item.averageScore === null ? 'No grades' : `${item.averageScore}%`,
        String(item.portfolioItems),
        `${item.courseProgress}%`,
        item.nextAction,
      ]),
    ]);
  };

  if (loading) {
    return <LoadingScreen message="Loading parent metrics..." />;
  }

  return (
    <>
      <Header showLogout onLogout={handleLogout} />
      <main className="max-w-7xl mx-auto my-8 sm:my-12 px-4 sm:px-8 pb-20 animate-fade-in">
        <div className="flex flex-col lg:flex-row lg:justify-between lg:items-end gap-6 mb-8">
          <div>
            <Badge variant="secondary" className="mb-4">30-day operating report</Badge>
            <h2 className="font-display text-4xl sm:text-6xl font-extrabold tracking-tight mb-2">Parent Metrics</h2>
            <p className="text-text-muted text-sm sm:text-base max-w-2xl">
              A compact command view for attendance, assignments, grades, portfolio evidence, and course pace.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" size="sm" onClick={() => router.push('/dashboard')}>Dashboard</Button>
            <Button variant="outline" size="sm" onClick={loadMetrics}>Refresh</Button>
            <Button variant="outline" size="sm" onClick={() => window.print()}>Print</Button>
            <Button size="sm" onClick={exportMetrics} disabled={metrics.length === 0}>Export CSV</Button>
          </div>
        </div>

        {error && (
          <Card className="mb-8 p-6 border-red-200 bg-red-50">
            <p className="m-0 text-sm font-semibold text-red-700">{error}</p>
          </Card>
        )}

        {kids.length === 0 ? (
          <Card className="text-center py-16">
            <p className="text-text-muted text-lg mb-6">No children found yet.</p>
            <Button onClick={() => router.push('/manage-kids')}>Add Your First Child</Button>
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 sm:gap-5 mb-8">
              {[
                { label: 'Family readiness', value: `${familySummary.readinessScore}%`, tone: getScoreTone(familySummary.readinessScore) },
                { label: 'Attendance logs', value: familySummary.attendanceDays, tone: 'success' as StatusTone },
                { label: 'Overdue work', value: familySummary.overdueAssignments, tone: familySummary.overdueAssignments > 0 ? 'error' : 'success' },
                { label: 'Missing scores', value: familySummary.missingScores, tone: familySummary.missingScores > 0 ? 'warning' : 'success' },
                { label: 'Evidence items', value: familySummary.portfolioItems, tone: familySummary.portfolioItems > 0 ? 'success' : 'warning' },
              ].map((stat) => (
                <div key={stat.label} className="bg-card border border-border rounded-[1.25rem] p-4 sm:p-6">
                  <div className={`font-display text-3xl sm:text-4xl font-extrabold ${
                    stat.tone === 'success' ? 'text-primary' : stat.tone === 'warning' ? 'text-accent' : 'text-secondary'
                  }`}>
                    {stat.value}
                  </div>
                  <div className="text-[10px] sm:text-xs mt-2 text-text-muted font-bold uppercase tracking-wide">{stat.label}</div>
                </div>
              ))}
            </div>

            <div className="grid xl:grid-cols-[1.4fr_0.8fr] gap-8 items-start">
              <div className="space-y-6">
                {metrics.map((item) => (
                  <Card key={item.child.id} className="p-5 sm:p-8">
                    <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4 mb-6">
                      <div>
                        <div className="flex items-center gap-3 flex-wrap mb-2">
                          <h3 className="font-display text-2xl sm:text-3xl font-bold m-0">{item.child.name}</h3>
                          {item.child.grade && <Badge variant="outline">{item.child.grade}</Badge>}
                          <Badge variant={item.tone}>{item.readinessScore}% ready</Badge>
                        </div>
                        <p className="text-sm text-text-muted m-0">{item.nextAction}</p>
                      </div>
                      <div className="text-left md:text-right">
                        <div className="font-display text-4xl font-extrabold text-primary">{item.readinessScore}</div>
                        <div className="text-[10px] font-bold uppercase tracking-wide text-text-muted">Readiness score</div>
                      </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-x-8 gap-y-2">
                      <ProgressBar
                        label="Attendance"
                        sublabel={`${item.attendanceDays}/${ATTENDANCE_TARGET} target days`}
                        percentage={item.attendanceRate}
                        color="primary"
                      />
                      <ProgressBar
                        label="Assignments"
                        sublabel={`${item.assignmentCompleted}/${item.assignmentTotal || 0} complete`}
                        percentage={item.assignmentCompletionRate}
                        color="secondary"
                      />
                      <ProgressBar
                        label="Course pace"
                        sublabel={`${item.coursesBehind} stale course${item.coursesBehind === 1 ? '' : 's'}`}
                        percentage={item.courseProgress}
                        color="accent"
                      />
                      <ProgressBar
                        label="Portfolio proof"
                        sublabel={`${item.portfolioItems}/${PORTFOLIO_TARGET} target items`}
                        percentage={Math.min(100, (item.portfolioItems / PORTFOLIO_TARGET) * 100)}
                        color="primary"
                      />
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-2">
                      <MetricPill label="Overdue" value={item.overdueAssignments} tone={item.overdueAssignments > 0 ? 'error' : 'success'} />
                      <MetricPill label="Missing Scores" value={item.missingScores} tone={item.missingScores > 0 ? 'warning' : 'success'} />
                      <MetricPill label="Average" value={item.averageScore === null ? 'No grades' : `${item.averageScore}%`} tone={item.averageScore === null ? 'warning' : getScoreTone(item.averageScore)} />
                      <MetricPill label="Courses" value={courses.filter((course) => course.child === item.child.id).length} tone="success" />
                    </div>
                  </Card>
                ))}
              </div>

              <Card className="p-6 sm:p-8 xl:sticky xl:top-28">
                <h3 className="font-display text-2xl font-bold mb-4">Review Queue</h3>
                <p className="text-sm text-text-muted mb-6">
                  The highest-leverage cleanup items for the next parent admin pass.
                </p>
                <div className="space-y-3">
                  {metrics
                    .flatMap((item) => [
                      item.overdueAssignments > 0 ? `${item.child.name}: clear ${item.overdueAssignments} overdue assignment${item.overdueAssignments === 1 ? '' : 's'}.` : '',
                      item.missingScores > 0 ? `${item.child.name}: add ${item.missingScores} missing score${item.missingScores === 1 ? '' : 's'}.` : '',
                      item.attendanceDays < ATTENDANCE_TARGET ? `${item.child.name}: backfill ${ATTENDANCE_TARGET - item.attendanceDays} attendance day${ATTENDANCE_TARGET - item.attendanceDays === 1 ? '' : 's'}.` : '',
                      item.portfolioItems < PORTFOLIO_TARGET ? `${item.child.name}: add portfolio proof.` : '',
                    ])
                    .filter(Boolean)
                    .slice(0, 8)
                    .map((action) => (
                      <div key={action} className="rounded-[1rem] border border-border bg-bg-alt p-4 text-sm font-semibold text-text">
                        {action}
                      </div>
                    ))}
                  {metrics.every((item) => item.readinessScore >= 82) && (
                    <div className="rounded-[1rem] border border-primary/20 bg-primary/5 p-4 text-sm font-semibold text-primary">
                      Records look steady. Keep the weekly logging rhythm.
                    </div>
                  )}
                </div>
              </Card>
            </div>
          </>
        )}
      </main>
    </>
  );
}

function MetricPill({ label, value, tone }: { label: string; value: string | number; tone: StatusTone }) {
  return (
    <div className="rounded-[1rem] border border-border bg-bg-alt p-3 sm:p-4">
      <div className={`font-display text-xl sm:text-2xl font-extrabold ${
        tone === 'success' ? 'text-primary' : tone === 'warning' ? 'text-accent' : 'text-secondary'
      }`}>
        {value}
      </div>
      <div className="text-[10px] font-bold uppercase tracking-wide text-text-muted">{label}</div>
    </div>
  );
}
