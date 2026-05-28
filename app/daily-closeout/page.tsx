'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getPocketBase } from '@/lib/pocketbase';
import { Assignment, Attendance, Child, Course, PortfolioItem } from '@/lib/types';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { LoadingScreen } from '@/components/ui/Spinner';

interface ChildRecord extends Child {
  courses: Course[];
}

interface CloseoutRow {
  child: ChildRecord;
  attendance: Attendance | null;
  assignmentsDue: Assignment[];
  overdueAssignments: Assignment[];
  portfolioItems: PortfolioItem[];
  nextCourses: Course[];
  score: number;
}

const OPEN_STATUSES = new Set(['pending', 'Pending', 'in_progress']);

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function dateLabel(value?: string): string {
  if (!value) return 'No date';
  return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function isOpenAssignment(assignment: Assignment): boolean {
  return OPEN_STATUSES.has(assignment.status);
}

function getCompletionScore(row: Omit<CloseoutRow, 'score'>): number {
  let score = 0;
  if (row.attendance) score += 30;
  if (row.overdueAssignments.length === 0) score += 25;
  if (row.assignmentsDue.length === 0) score += 15;
  if (row.portfolioItems.length > 0) score += 20;
  if (row.nextCourses.length > 0) score += 10;
  return score;
}

function scoreTone(score: number): string {
  if (score >= 80) return 'bg-green-100 text-green-800 border-green-200';
  if (score >= 55) return 'bg-yellow-100 text-yellow-800 border-yellow-200';
  return 'bg-red-100 text-red-800 border-red-200';
}

function buildSummary(rows: CloseoutRow[], date: Date): string {
  const lines = [
    `Village daily closeout - ${date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    })}`,
    ''
  ];

  rows.forEach((row) => {
    lines.push(`${row.child.name}: ${row.score}% ready`);
    lines.push(`- Attendance: ${row.attendance ? row.attendance.status : 'not logged'}`);

    if (row.overdueAssignments.length > 0) {
      lines.push(`- Overdue: ${row.overdueAssignments.map((assignment) => assignment.title).join(', ')}`);
    }

    if (row.assignmentsDue.length > 0) {
      lines.push(`- Due this week: ${row.assignmentsDue.map((assignment) => assignment.title).join(', ')}`);
    } else {
      lines.push('- Due this week: clear');
    }

    if (row.portfolioItems.length > 0) {
      lines.push(`- Portfolio proof: ${row.portfolioItems.length} recent item${row.portfolioItems.length === 1 ? '' : 's'}`);
    } else {
      lines.push('- Portfolio proof: none captured this week');
    }

    if (row.nextCourses.length > 0) {
      lines.push(`- Tomorrow: ${row.nextCourses.map((course) => `${course.name} lesson ${course.current_lesson}`).join('; ')}`);
    }

    lines.push('');
  });

  return lines.join('\n').trim();
}

export default function DailyCloseoutPage() {
  const router = useRouter();
  const pb = getPocketBase();

  const [kids, setKids] = useState<ChildRecord[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [portfolioItems, setPortfolioItems] = useState<PortfolioItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copyStatus, setCopyStatus] = useState('');
  const [today] = useState(() => new Date());

  const loadCloseout = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const userId = pb.authStore.model?.id;
      if (!userId) return;

      const todayKey = formatDate(today);
      const nextWeekKey = formatDate(addDays(today, 7));
      const lastWeekKey = formatDate(addDays(today, -7));

      const childRecords = await pb.collection('children').getFullList({
        filter: `user = "${userId}"`,
        sort: 'name'
      });

      const childrenWithCourses = await Promise.all(
        childRecords.map(async (kid) => {
          try {
            const courseRecords = await pb.collection('courses').getFullList({
              filter: `child = "${kid.id}"`,
              sort: 'name'
            });
            return { ...kid, courses: courseRecords } as unknown as ChildRecord;
          } catch {
            return { ...kid, courses: [] } as unknown as ChildRecord;
          }
        })
      );

      const [attendanceRecords, assignmentRecords, portfolioRecords] = await Promise.all([
        pb.collection('attendance').getFullList({
          filter: `user = "${userId}" && date >= "${todayKey}" && date <= "${todayKey} 23:59:59"`
        }),
        pb.collection('assignments').getFullList({
          filter: `user = "${userId}" && due_date <= "${nextWeekKey}"`,
          sort: 'due_date'
        }),
        pb.collection('portfolio').getFullList({
          filter: `user = "${userId}" && date >= "${lastWeekKey}"`,
          sort: '-date'
        })
      ]);

      setKids(childrenWithCourses);
      setAttendance(attendanceRecords as unknown as Attendance[]);
      setAssignments(assignmentRecords as unknown as Assignment[]);
      setPortfolioItems(portfolioRecords as unknown as PortfolioItem[]);
    } catch (loadError) {
      console.error('Daily closeout load error:', loadError);
      setError('Daily closeout could not load. Try refreshing after checking your connection.');
    } finally {
      setLoading(false);
    }
  }, [pb, today]);

  useEffect(() => {
    if (!pb.authStore.isValid) {
      router.push('/');
      return;
    }
    loadCloseout();
  }, [loadCloseout, pb.authStore.isValid, router]);

  const rows = useMemo<CloseoutRow[]>(() => {
    const todayKey = formatDate(today);
    const nextWeekKey = formatDate(addDays(today, 7));

    return kids.map((child) => {
      const childAttendance = attendance.find((record) => record.child === child.id && record.date.startsWith(todayKey)) || null;
      const childAssignments = assignments.filter((assignment) => assignment.child === child.id && isOpenAssignment(assignment));
      const overdueAssignments = childAssignments.filter((assignment) => assignment.due_date && assignment.due_date < todayKey);
      const assignmentsDue = childAssignments.filter((assignment) => {
        if (!assignment.due_date) return false;
        return assignment.due_date >= todayKey && assignment.due_date <= nextWeekKey;
      });
      const childPortfolio = portfolioItems.filter((item) => item.child === child.id);
      const nextCourses = child.courses
        .filter((course) => course.current_lesson <= course.total_lessons)
        .sort((a, b) => a.name.localeCompare(b.name))
        .slice(0, 3);

      const rowWithoutScore = {
        child,
        attendance: childAttendance,
        assignmentsDue,
        overdueAssignments,
        portfolioItems: childPortfolio,
        nextCourses
      };

      return {
        ...rowWithoutScore,
        score: getCompletionScore(rowWithoutScore)
      };
    });
  }, [assignments, attendance, kids, portfolioItems, today]);

  const household = useMemo(() => {
    const attendanceDone = rows.filter((row) => row.attendance).length;
    const overdueCount = rows.reduce((sum, row) => sum + row.overdueAssignments.length, 0);
    const dueCount = rows.reduce((sum, row) => sum + row.assignmentsDue.length, 0);
    const evidenceCount = rows.reduce((sum, row) => sum + row.portfolioItems.length, 0);
    const averageScore = rows.length > 0
      ? Math.round(rows.reduce((sum, row) => sum + row.score, 0) / rows.length)
      : 0;

    return { attendanceDone, overdueCount, dueCount, evidenceCount, averageScore };
  }, [rows]);

  const summaryText = useMemo(() => buildSummary(rows, today), [rows, today]);

  const handleCopySummary = async () => {
    try {
      await navigator.clipboard.writeText(summaryText);
      setCopyStatus('Copied');
      window.setTimeout(() => setCopyStatus(''), 1800);
    } catch {
      setCopyStatus('Copy failed');
      window.setTimeout(() => setCopyStatus(''), 1800);
    }
  };

  const handleLogout = () => {
    pb.authStore.clear();
    router.push('/');
  };

  if (loading) return <LoadingScreen message="Building daily closeout..." />;

  return (
    <>
      <Header showLogout onLogout={handleLogout} />
      <main className="max-w-7xl mx-auto my-10 px-4 sm:px-8 pb-20 animate-fade-in">
        <section className="mb-10">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-secondary mb-3">
                {today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              </p>
              <h2 className="font-display text-4xl sm:text-6xl font-extrabold tracking-tight mb-3">
                Daily Closeout
              </h2>
              <p className="max-w-2xl text-text-muted">
                One evening pass for attendance, due work, portfolio proof, and tomorrow&apos;s lesson handoff.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button variant="outline" onClick={loadCloseout}>Refresh</Button>
              <Button variant="outline" onClick={handleCopySummary}>Copy Summary</Button>
              <Button variant="outline" onClick={() => window.print()}>Print</Button>
              <Button variant="ghost" onClick={() => router.push('/dashboard')}>Dashboard</Button>
            </div>
          </div>
          {copyStatus && (
            <p className="mt-4 text-sm font-bold text-primary">{copyStatus}</p>
          )}
        </section>

        {error && (
          <Card className="mb-8 p-6 border-red-200 bg-red-50">
            <p className="font-bold text-red-700">{error}</p>
          </Card>
        )}

        {kids.length === 0 ? (
          <Card className="text-center py-16">
            <p className="text-text-muted text-lg mb-6">No children are set up yet.</p>
            <Button onClick={() => router.push('/manage-kids')}>Add Your First Child</Button>
          </Card>
        ) : (
          <>
            <section className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
              {[
                { label: 'Closeout Score', value: `${household.averageScore}%` },
                { label: 'Attendance Logged', value: `${household.attendanceDone}/${kids.length}` },
                { label: 'Overdue Work', value: household.overdueCount },
                { label: 'Due This Week', value: household.dueCount },
                { label: 'Evidence Captured', value: household.evidenceCount }
              ].map((stat) => (
                <div key={stat.label} className="bg-card border border-border rounded-[1.25rem] p-5 shadow-sm">
                  <div className="font-display text-3xl font-extrabold text-primary">{stat.value}</div>
                  <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-text-muted mt-2">
                    {stat.label}
                  </div>
                </div>
              ))}
            </section>

            <section className="grid xl:grid-cols-[1fr_360px] gap-8 items-start">
              <div className="space-y-6">
                {rows.map((row) => (
                  <Card key={row.child.id} className="p-5 sm:p-8">
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-5 mb-6">
                      <div>
                        <div className="flex items-center gap-3 flex-wrap mb-2">
                          <h3 className="font-display text-2xl sm:text-3xl font-extrabold m-0">{row.child.name}</h3>
                          {row.child.grade && (
                            <span className="px-3 py-1 rounded-full bg-bg-alt text-xs font-bold text-primary">
                              {row.child.grade}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-text-muted m-0">
                          {row.nextCourses.length} active course{row.nextCourses.length === 1 ? '' : 's'} ready for tomorrow
                        </p>
                      </div>
                      <span className={`inline-flex w-fit items-center rounded-full border px-4 py-2 text-sm font-bold ${scoreTone(row.score)}`}>
                        {row.score}% ready
                      </span>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="rounded-[1rem] border border-border bg-bg-alt/50 p-4">
                        <div className="flex items-center justify-between gap-4 mb-3">
                          <h4 className="font-display font-bold text-base m-0">Attendance</h4>
                          <Button variant="ghost" size="sm" onClick={() => router.push('/attendance')}>Open</Button>
                        </div>
                        {row.attendance ? (
                          <p className="text-sm font-semibold text-primary m-0">
                            Logged as {row.attendance.status}
                          </p>
                        ) : (
                          <p className="text-sm text-text-muted m-0">
                            No attendance logged for today.
                          </p>
                        )}
                      </div>

                      <div className="rounded-[1rem] border border-border bg-bg-alt/50 p-4">
                        <div className="flex items-center justify-between gap-4 mb-3">
                          <h4 className="font-display font-bold text-base m-0">Portfolio Proof</h4>
                          <Button variant="ghost" size="sm" onClick={() => router.push('/portfolio')}>Open</Button>
                        </div>
                        {row.portfolioItems.length > 0 ? (
                          <p className="text-sm font-semibold text-primary m-0">
                            {row.portfolioItems.length} sample{row.portfolioItems.length === 1 ? '' : 's'} added in the last 7 days
                          </p>
                        ) : (
                          <p className="text-sm text-text-muted m-0">
                            Capture one photo, worksheet, or narration before Friday.
                          </p>
                        )}
                      </div>

                      <div className="rounded-[1rem] border border-border bg-bg-alt/50 p-4">
                        <div className="flex items-center justify-between gap-4 mb-3">
                          <h4 className="font-display font-bold text-base m-0">Assignments</h4>
                          <Button variant="ghost" size="sm" onClick={() => router.push('/assignments')}>Open</Button>
                        </div>
                        {row.overdueAssignments.length > 0 && (
                          <div className="mb-3">
                            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-red-700 mb-2">
                              Overdue
                            </p>
                            <div className="space-y-2">
                              {row.overdueAssignments.slice(0, 3).map((assignment) => (
                                <div key={assignment.id} className="text-sm">
                                  <span className="font-semibold">{assignment.title}</span>
                                  <span className="text-text-muted"> - {dateLabel(assignment.due_date)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {row.assignmentsDue.length > 0 ? (
                          <div className="space-y-2">
                            {row.assignmentsDue.slice(0, 4).map((assignment) => (
                              <div key={assignment.id} className="text-sm">
                                <span className="font-semibold">{assignment.title}</span>
                                <span className="text-text-muted"> - due {dateLabel(assignment.due_date)}</span>
                              </div>
                            ))}
                          </div>
                        ) : row.overdueAssignments.length === 0 ? (
                          <p className="text-sm text-text-muted m-0">No open assignments due in the next 7 days.</p>
                        ) : null}
                      </div>

                      <div className="rounded-[1rem] border border-border bg-bg-alt/50 p-4">
                        <h4 className="font-display font-bold text-base m-0 mb-3">Tomorrow Handoff</h4>
                        {row.nextCourses.length > 0 ? (
                          <div className="space-y-2">
                            {row.nextCourses.map((course) => (
                              <div key={course.id} className="flex items-center justify-between gap-3 text-sm">
                                <span className="font-semibold truncate">{course.name}</span>
                                <span className="shrink-0 rounded-full bg-white px-3 py-1 text-xs font-bold text-primary border border-border">
                                  Lesson {course.current_lesson}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-text-muted m-0">No active courses found. Add or update courses from Manage Kids.</p>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>

              <aside className="xl:sticky xl:top-28">
                <Card className="p-6 bg-primary text-white border-primary">
                  <h3 className="font-display text-2xl font-extrabold mb-4">Tonight&apos;s Pass</h3>
                  <div className="space-y-4 text-sm">
                    <div className="flex gap-3">
                      <span className="font-display text-xl">1</span>
                      <p className="m-0">Log every missing attendance day while the day is still fresh.</p>
                    </div>
                    <div className="flex gap-3">
                      <span className="font-display text-xl">2</span>
                      <p className="m-0">Clear overdue assignments or decide what gets moved.</p>
                    </div>
                    <div className="flex gap-3">
                      <span className="font-display text-xl">3</span>
                      <p className="m-0">Add one portfolio artifact for any student with no evidence this week.</p>
                    </div>
                    <div className="flex gap-3">
                      <span className="font-display text-xl">4</span>
                      <p className="m-0">Copy the summary for a parent handoff or print this page for a binder note.</p>
                    </div>
                  </div>
                </Card>

                <Card className="p-6 mt-6">
                  <h3 className="font-display text-xl font-extrabold mb-3">Copy Preview</h3>
                  <pre className="whitespace-pre-wrap text-xs leading-5 text-text-muted bg-bg-alt rounded-[1rem] p-4 max-h-72 overflow-auto">
                    {summaryText}
                  </pre>
                </Card>
              </aside>
            </section>
          </>
        )}
      </main>
    </>
  );
}
