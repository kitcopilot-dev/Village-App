'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getPocketBase } from '@/lib/pocketbase';
import { Attendance, Assignment, Child, Course, PortfolioItem, SchoolYear } from '@/lib/types';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Select } from '@/components/ui/Input';
import { LoadingScreen } from '@/components/ui/Spinner';

type ComplianceStatus = 'ready' | 'watch' | 'needs-work';

interface ChildCompliancePack {
  child: Child;
  attendance: Attendance[];
  assignments: Assignment[];
  portfolio: PortfolioItem[];
  courses: Course[];
  instructionalDays: number;
  statusCounts: Record<Attendance['status'], number>;
  gradedAverage: number | null;
  completedAssignments: number;
  openAssignments: number;
  overdueAssignments: number;
  lessonsCompleted: number;
  lessonsTotal: number;
  readinessScore: number;
  readinessStatus: ComplianceStatus;
}

const ATTENDANCE_GOAL = 180;

const statusLabels: Record<Attendance['status'], string> = {
  present: 'Present',
  absent: 'Absent',
  'half-day': 'Half Day',
  sick: 'Sick',
  holiday: 'Holiday'
};

function toDateInputValue(date: Date): string {
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60 * 1000).toISOString().split('T')[0];
}

function formatDate(dateValue?: string): string {
  if (!dateValue) return 'Not set';
  return new Date(dateValue).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

function formatRange(start?: string, end?: string): string {
  if (!start || !end) return 'Custom range';
  return `${formatDate(start)} – ${formatDate(end)}`;
}

function getDefaultRange(): { start: string; end: string } {
  const today = new Date();
  const start = new Date(today.getFullYear(), 7, 1); // Aug 1
  const end = new Date(today.getFullYear() + 1, 4, 31); // May 31

  if (today < start) {
    start.setFullYear(today.getFullYear() - 1);
    end.setFullYear(today.getFullYear());
  }

  return {
    start: toDateInputValue(start),
    end: toDateInputValue(end)
  };
}

function countInstructionalDays(records: Attendance[]): number {
  return records.reduce((total, record) => {
    if (record.status === 'present' || record.status === 'holiday') return total + 1;
    if (record.status === 'half-day') return total + 0.5;
    return total;
  }, 0);
}

function scoreToStatus(score: number): ComplianceStatus {
  if (score >= 75) return 'ready';
  if (score >= 45) return 'watch';
  return 'needs-work';
}

function statusStyle(status: ComplianceStatus): string {
  if (status === 'ready') return 'bg-green-50 text-green-700 border-green-200';
  if (status === 'watch') return 'bg-yellow-50 text-yellow-700 border-yellow-200';
  return 'bg-red-50 text-red-700 border-red-200';
}

function statusText(status: ComplianceStatus): string {
  if (status === 'ready') return 'Audit Ready';
  if (status === 'watch') return 'Needs Review';
  return 'Gaps Found';
}

export default function CompliancePackPage() {
  const router = useRouter();
  const pb = getPocketBase();
  const defaults = useMemo(() => getDefaultRange(), []);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [kids, setKids] = useState<Child[]>([]);
  const [schoolYears, setSchoolYears] = useState<SchoolYear[]>([]);
  const [selectedYearId, setSelectedYearId] = useState('custom');
  const [startDate, setStartDate] = useState(defaults.start);
  const [endDate, setEndDate] = useState(defaults.end);
  const [packs, setPacks] = useState<ChildCompliancePack[]>([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!pb.authStore.isValid) {
      router.push('/');
      return;
    }
    loadInitialData();
  }, []);

  useEffect(() => {
    const year = schoolYears.find(y => y.id === selectedYearId);
    if (year) {
      setStartDate(year.start_date.split(' ')[0]);
      setEndDate(year.end_date.split(' ')[0]);
    }
  }, [selectedYearId, schoolYears]);

  useEffect(() => {
    if (kids.length > 0 && startDate && endDate) {
      loadComplianceData();
    }
  }, [kids, startDate, endDate]);

  const loadInitialData = async () => {
    try {
      const userId = pb.authStore.model?.id;
      if (!userId) return;

      const [childRecords, yearRecords] = await Promise.all([
        pb.collection('children').getFullList({
          filter: `user = "${userId}"`,
          sort: 'name'
        }),
        pb.collection('school_years').getFullList({
          filter: `user = "${userId}"`,
          sort: '-start_date'
        }).catch(() => [])
      ]);

      setKids(childRecords as unknown as Child[]);
      const years = yearRecords as unknown as SchoolYear[];
      setSchoolYears(years);

      if (years.length > 0) {
        setSelectedYearId(years[0].id);
      }
    } catch (error) {
      console.error('Compliance pack load error:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadPortfolioRecords = async (childFilter: string, start: string, end: string): Promise<PortfolioItem[]> => {
    const filters = `${childFilter} && date >= "${start}" && date <= "${end}"`;
    const createdFilters = `${childFilter} && created >= "${start}" && created <= "${end}"`;

    const records = await pb.collection('portfolio').getFullList({
      filter: filters,
      sort: '-date'
    }).catch(async () => pb.collection('portfolio_items').getFullList({
      filter: createdFilters,
      sort: '-created'
    }).catch(() => []));

    return records as unknown as PortfolioItem[];
  };

  const loadComplianceData = async () => {
    if (kids.length === 0) return;

    setRefreshing(true);
    try {
      const userId = pb.authStore.model?.id;
      if (!userId) return;

      const childFilter = kids.map(k => `child = "${k.id}"`).join(' || ');
      const attendanceFilter = `user = "${userId}" && date >= "${startDate}" && date <= "${endDate}"`;
      const assignmentFilter = `user = "${userId}" && (due_date >= "${startDate}" && due_date <= "${endDate}" || updated >= "${startDate}" && updated <= "${endDate}")`;

      const [attendanceRecords, assignmentRecords, courseRecords, portfolioRecords] = await Promise.all([
        pb.collection('attendance').getFullList({
          filter: attendanceFilter,
          sort: 'date'
        }).catch(() => []),
        pb.collection('assignments').getFullList({
          filter: assignmentFilter,
          sort: '-due_date'
        }).catch(() => []),
        pb.collection('courses').getFullList({
          filter: childFilter,
          sort: 'name'
        }).catch(() => []),
        loadPortfolioRecords(childFilter, startDate, endDate)
      ]);

      const today = new Date();
      const nextPacks = kids.map((child) => {
        const childAttendance = (attendanceRecords as unknown as Attendance[]).filter(a => a.child === child.id);
        const childAssignments = (assignmentRecords as unknown as Assignment[]).filter(a => a.child === child.id);
        const childCourses = (courseRecords as unknown as Course[]).filter(c => c.child === child.id);
        const childPortfolio = portfolioRecords.filter(p => p.child === child.id);
        const graded = childAssignments.filter(a => typeof a.score === 'number');
        const completed = childAssignments.filter(a => a.status === 'completed' || a.status === 'Graded');
        const open = childAssignments.filter(a => a.status === 'pending' || a.status === 'in_progress');
        const overdue = open.filter(a => a.due_date && new Date(a.due_date) < today);
        const lessonsCompleted = childCourses.reduce((sum, course) => sum + Math.max(0, Math.min(course.current_lesson - 1, course.total_lessons)), 0);
        const lessonsTotal = childCourses.reduce((sum, course) => sum + course.total_lessons, 0);
        const instructionalDays = countInstructionalDays(childAttendance);
        const statusCounts = childAttendance.reduce<Record<Attendance['status'], number>>((counts, record) => {
          counts[record.status] += 1;
          return counts;
        }, { present: 0, absent: 0, 'half-day': 0, sick: 0, holiday: 0 });
        const gradedAverage = graded.length > 0
          ? Math.round(graded.reduce((sum, a) => sum + (a.score ?? 0), 0) / graded.length)
          : null;

        const attendanceScore = Math.min(40, (instructionalDays / ATTENDANCE_GOAL) * 40);
        const portfolioScore = Math.min(20, childPortfolio.length * 5);
        const assignmentScore = Math.min(20, completed.length * 4);
        const courseScore = lessonsTotal > 0 ? Math.min(20, (lessonsCompleted / lessonsTotal) * 20) : 0;
        const readinessScore = Math.round(attendanceScore + portfolioScore + assignmentScore + courseScore);

        return {
          child,
          attendance: childAttendance,
          assignments: childAssignments,
          portfolio: childPortfolio,
          courses: childCourses,
          instructionalDays,
          statusCounts,
          gradedAverage,
          completedAssignments: completed.length,
          openAssignments: open.length,
          overdueAssignments: overdue.length,
          lessonsCompleted,
          lessonsTotal,
          readinessScore,
          readinessStatus: scoreToStatus(readinessScore)
        };
      });

      setPacks(nextPacks);
    } catch (error) {
      console.error('Compliance data load error:', error);
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  };

  const totals = useMemo(() => {
    return packs.reduce((acc, pack) => ({
      instructionalDays: acc.instructionalDays + pack.instructionalDays,
      assignments: acc.assignments + pack.assignments.length,
      portfolio: acc.portfolio + pack.portfolio.length,
      courses: acc.courses + pack.courses.length,
      overdue: acc.overdue + pack.overdueAssignments
    }), { instructionalDays: 0, assignments: 0, portfolio: 0, courses: 0, overdue: 0 });
  }, [packs]);

  const reportSummary = useMemo(() => {
    const lines = [
      `Village Compliance Pack — ${formatRange(startDate, endDate)}`,
      `Generated ${formatDate(new Date().toISOString())}`,
      '',
      ...packs.map(pack => [
        `${pack.child.name}: ${pack.instructionalDays}/${ATTENDANCE_GOAL} days, ${pack.completedAssignments} completed assignments, ${pack.portfolio.length} portfolio samples, ${pack.readinessScore}% readiness (${statusText(pack.readinessStatus)}).`,
        pack.overdueAssignments > 0 ? `  Attention: ${pack.overdueAssignments} overdue assignment(s).` : ''
      ].filter(Boolean).join('\n'))
    ];

    return lines.join('\n');
  }, [packs, startDate, endDate]);

  const copySummary = async () => {
    try {
      await navigator.clipboard.writeText(reportSummary);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy summary:', error);
    }
  };

  if (loading) return <LoadingScreen message="Building compliance pack..." />;

  if (kids.length === 0) {
    return (
      <>
        <Header showLogout onLogout={() => { pb.authStore.clear(); router.push('/'); }} />
        <main className="max-w-4xl mx-auto my-12 px-8 text-center">
          <Card className="py-20">
            <p className="text-xl text-text-muted mb-8 italic font-serif">Add students first, then Village can assemble compliance records.</p>
            <Button onClick={() => router.push('/manage-kids')}>Add Your First Student</Button>
          </Card>
        </main>
      </>
    );
  }

  return (
    <>
      <div className="print:hidden">
        <Header showLogout onLogout={() => { pb.authStore.clear(); router.push('/'); }} />
      </div>
      <main className="max-w-7xl mx-auto my-8 sm:my-12 px-4 sm:px-8 pb-20 animate-fade-in print:my-0 print:px-0 print:pb-0">
        <section className="print:hidden mb-10">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 mb-8">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-secondary mb-3">Record prep</p>
              <h2 className="font-display text-4xl sm:text-6xl font-extrabold tracking-tight mb-3">Compliance Pack</h2>
              <p className="text-text-muted max-w-2xl">
                One printable packet for attendance days, coursework, assignments, and portfolio evidence — built for homeschool audits, annual reviews, and peace of mind.
              </p>
            </div>
            <div className="flex gap-3 flex-wrap">
              <Button variant="ghost" onClick={() => router.push('/dashboard')}>← Dashboard</Button>
              <Button variant="outline" onClick={copySummary}>{copied ? 'Copied!' : 'Copy Summary'}</Button>
              <Button onClick={() => window.print()}>Print / Save PDF</Button>
            </div>
          </div>

          <Card className="p-5 sm:p-8">
            <div className="grid md:grid-cols-4 gap-4 sm:gap-6 items-end">
              <Select
                label="School Year"
                value={selectedYearId}
                onChange={(event) => setSelectedYearId(event.target.value)}
              >
                <option value="custom">Custom dates</option>
                {schoolYears.map(year => (
                  <option key={year.id} value={year.id}>{year.name}</option>
                ))}
              </Select>
              <label className="block">
                <span className="block text-[10px] sm:text-xs font-bold mb-1.5 sm:mb-2 uppercase tracking-wide text-primary">Start Date</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(event) => { setSelectedYearId('custom'); setStartDate(event.target.value); }}
                  className="w-full px-4 sm:px-5 py-3 sm:py-4 border-2 border-border rounded-[1rem] sm:rounded-[1.25rem] bg-bg text-sm sm:text-base focus:outline-none focus:border-primary focus:bg-white"
                />
              </label>
              <label className="block">
                <span className="block text-[10px] sm:text-xs font-bold mb-1.5 sm:mb-2 uppercase tracking-wide text-primary">End Date</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(event) => { setSelectedYearId('custom'); setEndDate(event.target.value); }}
                  className="w-full px-4 sm:px-5 py-3 sm:py-4 border-2 border-border rounded-[1rem] sm:rounded-[1.25rem] bg-bg text-sm sm:text-base focus:outline-none focus:border-primary focus:bg-white"
                />
              </label>
              <Button variant="outline" onClick={loadComplianceData} disabled={refreshing}>
                {refreshing ? 'Refreshing...' : 'Refresh Pack'}
              </Button>
            </div>
          </Card>
        </section>

        <section className="bg-white border border-border rounded-[2rem] shadow-shadow overflow-hidden print:shadow-none print:border-0 print:rounded-none">
          <div className="bg-primary text-white p-8 sm:p-12 print:bg-white print:text-black print:border-b print:border-black">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-8">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.3em] opacity-80 mb-4 print:text-gray-600">Village Homeschool Records</p>
                <h1 className="font-display text-3xl sm:text-5xl font-extrabold tracking-tight mb-4">Compliance Pack</h1>
                <p className="text-white/80 print:text-gray-700">{formatRange(startDate, endDate)}</p>
              </div>
              <div className="text-left md:text-right">
                <p className="text-xs font-bold uppercase tracking-widest opacity-80 mb-2 print:text-gray-600">Generated</p>
                <p className="font-bold text-lg">{formatDate(new Date().toISOString())}</p>
              </div>
            </div>
          </div>

          <div className="p-6 sm:p-10 print:p-6">
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-10 print:grid-cols-5 print:gap-2">
              {[
                { label: 'Students', value: kids.length },
                { label: 'Instructional Days', value: totals.instructionalDays },
                { label: 'Assignments', value: totals.assignments },
                { label: 'Portfolio Samples', value: totals.portfolio },
                { label: 'Courses', value: totals.courses }
              ].map(item => (
                <div key={item.label} className="rounded-2xl bg-bg-alt border border-border p-4 text-center print:bg-white print:rounded-none">
                  <div className="font-display text-2xl sm:text-3xl font-extrabold text-primary print:text-black">{item.value}</div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-text-muted">{item.label}</div>
                </div>
              ))}
            </div>

            {totals.overdue > 0 && (
              <div className="mb-8 rounded-2xl border-2 border-red-200 bg-red-50 p-5 print:border-black print:bg-white">
                <p className="font-bold text-red-700 print:text-black mb-1">Review needed: {totals.overdue} overdue assignment{totals.overdue === 1 ? '' : 's'} across this packet.</p>
                <p className="text-sm text-red-600 print:text-gray-700">Clear or grade these before exporting final records.</p>
              </div>
            )}

            <div className="space-y-8">
              {packs.map(pack => {
                const progressPercent = Math.min(100, Math.round((pack.instructionalDays / ATTENDANCE_GOAL) * 100));
                const lessonPercent = pack.lessonsTotal > 0 ? Math.round((pack.lessonsCompleted / pack.lessonsTotal) * 100) : 0;

                return (
                  <article key={pack.child.id} className="break-inside-avoid rounded-[2rem] border border-border p-6 sm:p-8 print:rounded-none print:border-black print:p-4">
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-6">
                      <div>
                        <h2 className="font-display text-3xl font-extrabold mb-1">{pack.child.name}</h2>
                        <p className="text-sm text-text-muted">
                          {pack.child.grade ? `${pack.child.grade} • ` : ''}{pack.child.age ? `${pack.child.age} years old` : 'Student record'}
                          {pack.child.focus ? ` • ${pack.child.focus}` : ''}
                        </p>
                      </div>
                      <div className={`inline-flex self-start rounded-full border px-4 py-2 text-xs font-bold uppercase tracking-wider ${statusStyle(pack.readinessStatus)} print:border-black print:bg-white print:text-black`}>
                        {pack.readinessScore}% · {statusText(pack.readinessStatus)}
                      </div>
                    </div>

                    <div className="grid md:grid-cols-4 gap-4 mb-6 print:grid-cols-4 print:gap-2">
                      <div className="bg-primary/5 rounded-2xl p-4 border border-primary/10 print:bg-white print:rounded-none print:border-gray-300">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted mb-1">Attendance</p>
                        <p className="font-display text-2xl font-extrabold text-primary print:text-black">{pack.instructionalDays}/{ATTENDANCE_GOAL}</p>
                        <p className="text-xs text-text-muted">{progressPercent}% of 180-day benchmark</p>
                      </div>
                      <div className="bg-secondary/5 rounded-2xl p-4 border border-secondary/10 print:bg-white print:rounded-none print:border-gray-300">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted mb-1">Assignments</p>
                        <p className="font-display text-2xl font-extrabold text-secondary print:text-black">{pack.completedAssignments}</p>
                        <p className="text-xs text-text-muted">{pack.openAssignments} open · {pack.overdueAssignments} overdue</p>
                      </div>
                      <div className="bg-accent/10 rounded-2xl p-4 border border-accent/20 print:bg-white print:rounded-none print:border-gray-300">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted mb-1">Portfolio</p>
                        <p className="font-display text-2xl font-extrabold text-accent print:text-black">{pack.portfolio.length}</p>
                        <p className="text-xs text-text-muted">work samples saved</p>
                      </div>
                      <div className="bg-bg-alt rounded-2xl p-4 border border-border print:bg-white print:rounded-none print:border-gray-300">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted mb-1">Coursework</p>
                        <p className="font-display text-2xl font-extrabold text-primary print:text-black">{lessonPercent}%</p>
                        <p className="text-xs text-text-muted">{pack.lessonsCompleted}/{pack.lessonsTotal || 0} lessons</p>
                      </div>
                    </div>

                    <div className="grid lg:grid-cols-3 gap-6">
                      <section>
                        <h3 className="font-bold text-sm uppercase tracking-wider text-primary mb-3">Attendance Breakdown</h3>
                        <div className="space-y-2 text-sm">
                          {(Object.keys(statusLabels) as Attendance['status'][]).map(status => (
                            <div key={status} className="flex justify-between border-b border-border/70 pb-1">
                              <span className="text-text-muted">{statusLabels[status]}</span>
                              <span className="font-bold">{pack.statusCounts[status]}</span>
                            </div>
                          ))}
                        </div>
                      </section>

                      <section>
                        <h3 className="font-bold text-sm uppercase tracking-wider text-secondary mb-3">Academic Evidence</h3>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between border-b border-border/70 pb-1">
                            <span className="text-text-muted">Total assignments</span>
                            <span className="font-bold">{pack.assignments.length}</span>
                          </div>
                          <div className="flex justify-between border-b border-border/70 pb-1">
                            <span className="text-text-muted">Grade average</span>
                            <span className="font-bold">{pack.gradedAverage !== null ? `${pack.gradedAverage}%` : 'No grades yet'}</span>
                          </div>
                          <div className="flex justify-between border-b border-border/70 pb-1">
                            <span className="text-text-muted">Portfolio subjects</span>
                            <span className="font-bold">{new Set(pack.portfolio.map(item => item.subject || 'General')).size}</span>
                          </div>
                        </div>
                      </section>

                      <section>
                        <h3 className="font-bold text-sm uppercase tracking-wider text-accent mb-3">Checklist</h3>
                        <ul className="space-y-2 text-sm text-text-muted list-none p-0 m-0">
                          <li>{pack.instructionalDays >= ATTENDANCE_GOAL ? '✓' : '○'} 180-day attendance benchmark</li>
                          <li>{pack.courses.length > 0 ? '✓' : '○'} Course plan recorded</li>
                          <li>{pack.completedAssignments > 0 ? '✓' : '○'} Assignment evidence logged</li>
                          <li>{pack.portfolio.length > 0 ? '✓' : '○'} Portfolio samples attached</li>
                          <li>{pack.overdueAssignments === 0 ? '✓' : '○'} No overdue assignments</li>
                        </ul>
                      </section>
                    </div>

                    {pack.courses.length > 0 && (
                      <section className="mt-6 pt-6 border-t border-border">
                        <h3 className="font-bold text-sm uppercase tracking-wider text-primary mb-3">Courses</h3>
                        <div className="grid md:grid-cols-2 gap-3 print:grid-cols-2">
                          {pack.courses.slice(0, 8).map(course => {
                            const completed = Math.max(0, Math.min(course.current_lesson - 1, course.total_lessons));
                            return (
                              <div key={course.id} className="rounded-xl bg-bg-alt p-3 text-sm print:bg-white print:border print:border-gray-300 print:rounded-none">
                                <div className="font-bold">{course.name}</div>
                                <div className="text-text-muted text-xs">Lesson {course.current_lesson} of {course.total_lessons} · {completed} completed</div>
                              </div>
                            );
                          })}
                        </div>
                      </section>
                    )}
                  </article>
                );
              })}
            </div>

            <section className="mt-10 pt-8 border-t border-border print:mt-6 print:pt-4">
              <h2 className="font-display text-2xl font-extrabold mb-3">Parent Review Notes</h2>
              <div className="min-h-32 rounded-2xl border-2 border-dashed border-border bg-bg-alt/50 p-4 print:bg-white print:rounded-none print:border-black">
                <p className="text-sm text-text-muted">Use this space for evaluator notes, annual review comments, or follow-up records to attach before filing.</p>
              </div>
            </section>
          </div>
        </section>
      </main>
    </>
  );
}
