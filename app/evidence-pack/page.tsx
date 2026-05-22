'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getPocketBase } from '@/lib/pocketbase';
import { Assignment, Attendance, Child, Course, PortfolioItem, Profile } from '@/lib/types';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input, Select } from '@/components/ui/Input';
import { LoadingScreen } from '@/components/ui/Spinner';

type EvidenceRow = {
  childName: string;
  type: 'Attendance' | 'Assignment' | 'Portfolio' | 'Course Progress';
  date: string;
  subject: string;
  title: string;
  status: string;
  score: string;
  details: string;
};

type ChildEvidence = {
  child: Child;
  attendance: Attendance[];
  assignments: Assignment[];
  portfolio: PortfolioItem[];
  courses: Course[];
  completedAssignments: Assignment[];
  averageScore: number | null;
  portfolioSubjects: string[];
  lessonsCompleted: number;
  totalLessons: number;
};

const rangePresets = [
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
  { value: '180', label: 'Last 180 days' },
  { value: '365', label: 'Last 12 months' },
  { value: 'custom', label: 'Custom range' },
];

function toISODate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function displayDate(value?: string) {
  if (!value) return 'No date';
  const [year, month, day] = dateValue(value).split('-').map(Number);
  const date = year && month && day ? new Date(year, month - 1, day) : new Date(value);

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function dateValue(value?: string) {
  if (!value) return '';
  return value.split('T')[0];
}

function isInRange(value: string | undefined, startDate: string, endDate: string) {
  const date = dateValue(value);
  return Boolean(date && date >= startDate && date <= endDate);
}

function normalizeStatus(status?: string) {
  return (status || '').toLowerCase().replace(/[_-]/g, ' ');
}

function isAssignmentComplete(assignment: Assignment) {
  const status = normalizeStatus(assignment.status);
  return status === 'completed' || status === 'graded';
}

function csvEscape(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

function buildCsv(rows: EvidenceRow[]) {
  const headers = ['Student', 'Type', 'Date', 'Subject', 'Title', 'Status', 'Score', 'Details'];
  const body = rows.map((row) => [
    row.childName,
    row.type,
    row.date,
    row.subject,
    row.title,
    row.status,
    row.score,
    row.details,
  ].map(csvEscape).join(','));

  return [headers.map(csvEscape).join(','), ...body].join('\n');
}

function downloadCsv(filename: string, rows: EvidenceRow[]) {
  const blob = new Blob([buildCsv(rows)], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function buildEvidenceRows(childData: ChildEvidence[], endDate: string): EvidenceRow[] {
  return childData.flatMap((data) => {
    const attendanceRows: EvidenceRow[] = data.attendance.map((item) => ({
      childName: data.child.name,
      type: 'Attendance',
      date: item.date,
      subject: 'Attendance',
      title: 'Attendance record',
      status: item.status,
      score: '',
      details: item.notes || '',
    }));

    const assignmentRows: EvidenceRow[] = data.assignments.map((item) => ({
      childName: data.child.name,
      type: 'Assignment',
      date: dateValue(item.due_date || item.updated || item.created),
      subject: item.subject || 'General',
      title: item.title,
      status: item.status,
      score: item.score !== undefined && item.score !== null ? `${item.score}%` : '',
      details: item.description || item.feedback || '',
    }));

    const portfolioRows: EvidenceRow[] = data.portfolio.map((item) => ({
      childName: data.child.name,
      type: 'Portfolio',
      date: dateValue(item.date || item.created),
      subject: item.subject || 'General',
      title: item.title,
      status: 'Work sample',
      score: '',
      details: item.description || '',
    }));

    const courseRows: EvidenceRow[] = data.courses.map((course) => {
      const completed = Math.max(0, Math.min(course.current_lesson - 1, course.total_lessons));
      return {
        childName: data.child.name,
        type: 'Course Progress',
        date: endDate,
        subject: course.name,
        title: course.name,
        status: completed >= course.total_lessons ? 'Complete' : 'In progress',
        score: '',
        details: `${completed} of ${course.total_lessons} lessons completed`,
      };
    });

    return [...attendanceRows, ...assignmentRows, ...portfolioRows, ...courseRows];
  });
}

export default function EvidencePackPage() {
  const router = useRouter();
  const pb = getPocketBase();
  const today = toISODate(new Date());
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [kids, setKids] = useState<Child[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [rangePreset, setRangePreset] = useState('90');
  const [startDate, setStartDate] = useState(toISODate(addDays(new Date(), -90)));
  const [endDate, setEndDate] = useState(today);

  useEffect(() => {
    if (!pb.authStore.isValid) {
      router.push('/');
      return;
    }

    loadData();
  }, []);

  const handleRangeChange = (value: string) => {
    setRangePreset(value);
    if (value === 'custom') return;

    const days = Number(value);
    setStartDate(toISODate(addDays(new Date(), -days)));
    setEndDate(today);
  };

  const loadData = async () => {
    try {
      const userId = pb.authStore.model?.id;
      if (!userId) return;

      const [profileRecords, childRecords, attendanceRecords, assignmentRecords] = await Promise.all([
        pb.collection('profiles').getFullList({ filter: `user = "${userId}"` }).catch(() => []),
        pb.collection('children').getFullList({ filter: `user = "${userId}"`, sort: 'name' }),
        pb.collection('attendance').getFullList({ filter: `user = "${userId}"`, sort: '-date' }).catch(() => []),
        pb.collection('assignments').getFullList({ filter: `user = "${userId}"`, sort: '-due_date' }).catch(() => []),
      ]);

      const children = childRecords as unknown as Child[];
      const childFilter = children.map((child) => `child = "${child.id}"`).join(' || ');

      const [courseRecords, portfolioRecords] = childFilter
        ? await Promise.all([
            pb.collection('courses').getFullList({ filter: childFilter, sort: 'name' }).catch(() => []),
            pb.collection('portfolio').getFullList({ filter: childFilter, sort: '-date' }).catch(() => []),
          ])
        : [[], []];

      setProfile((profileRecords[0] as unknown as Profile) || null);
      setKids(children);
      setAttendance(attendanceRecords as unknown as Attendance[]);
      setAssignments(assignmentRecords as unknown as Assignment[]);
      setCourses(courseRecords as unknown as Course[]);
      setPortfolio(portfolioRecords as unknown as PortfolioItem[]);
    } catch (error) {
      console.error('Evidence pack load error:', error);
    } finally {
      setLoading(false);
    }
  };

  const childEvidence = useMemo<ChildEvidence[]>(() => {
    return kids.map((child) => {
      const childAttendance = attendance.filter((item) => item.child === child.id && isInRange(item.date, startDate, endDate));
      const childAssignments = assignments.filter((item) => {
        if (item.child !== child.id) return false;
        return isInRange(item.due_date, startDate, endDate)
          || isInRange(item.updated, startDate, endDate)
          || isInRange(item.created, startDate, endDate);
      });
      const childPortfolio = portfolio.filter((item) => {
        if (item.child !== child.id) return false;
        return isInRange(item.date, startDate, endDate) || isInRange(item.created, startDate, endDate);
      });
      const childCourses = courses.filter((course) => course.child === child.id);
      const completedAssignments = childAssignments.filter(isAssignmentComplete);
      const scoredAssignments = completedAssignments.filter((item) => item.score !== undefined && item.score !== null);
      const averageScore = scoredAssignments.length
        ? Math.round(scoredAssignments.reduce((sum, item) => sum + (item.score || 0), 0) / scoredAssignments.length)
        : null;
      const totalLessons = childCourses.reduce((sum, course) => sum + course.total_lessons, 0);
      const lessonsCompleted = childCourses.reduce((sum, course) => {
        return sum + Math.max(0, Math.min(course.current_lesson - 1, course.total_lessons));
      }, 0);

      return {
        child,
        attendance: childAttendance,
        assignments: childAssignments,
        portfolio: childPortfolio,
        courses: childCourses,
        completedAssignments,
        averageScore,
        portfolioSubjects: Array.from(new Set(childPortfolio.map((item) => item.subject || 'General'))).sort(),
        lessonsCompleted,
        totalLessons,
      };
    });
  }, [kids, attendance, assignments, portfolio, courses, startDate, endDate]);

  const evidenceRows = useMemo(() => buildEvidenceRows(childEvidence, endDate), [childEvidence, endDate]);

  const totals = useMemo(() => {
    const presentDays = childEvidence.reduce((sum, data) => {
      return sum + data.attendance.filter((item) => item.status === 'present' || item.status === 'half-day').length;
    }, 0);

    return {
      presentDays,
      completedAssignments: childEvidence.reduce((sum, data) => sum + data.completedAssignments.length, 0),
      portfolioItems: childEvidence.reduce((sum, data) => sum + data.portfolio.length, 0),
      lessonsCompleted: childEvidence.reduce((sum, data) => sum + data.lessonsCompleted, 0),
      totalLessons: childEvidence.reduce((sum, data) => sum + data.totalLessons, 0),
      rowCount: evidenceRows.length,
    };
  }, [childEvidence, evidenceRows.length]);

  const readiness = useMemo(() => {
    const hasAttendance = totals.presentDays > 0;
    const hasAcademicWork = totals.completedAssignments > 0 || totals.portfolioItems > 0;
    const hasProgress = totals.lessonsCompleted > 0;
    const score = [hasAttendance, hasAcademicWork, hasProgress].filter(Boolean).length;

    if (score === 3) return { label: 'Strong packet', tone: 'bg-green-50 text-green-800 border-green-200' };
    if (score === 2) return { label: 'Usable packet', tone: 'bg-amber-50 text-amber-800 border-amber-200' };
    return { label: 'Needs more records', tone: 'bg-red-50 text-red-800 border-red-200' };
  }, [totals]);

  const handleExport = () => {
    const familyName = profile?.family_name || 'village';
    downloadCsv(`${familyName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-evidence-${startDate}-to-${endDate}.csv`, evidenceRows);
  };

  const handleLogout = () => {
    pb.authStore.clear();
    router.push('/');
  };

  if (loading) {
    return <LoadingScreen message="Building evidence packet..." />;
  }

  return (
    <>
      <Header showLogout onLogout={handleLogout} />
      <main className="mx-auto my-8 max-w-7xl px-4 pb-20 sm:my-12 sm:px-8">
        <div className="mb-8 flex flex-col gap-5 print:hidden lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-secondary">Records export</p>
            <h2 className="m-0 font-display text-4xl font-extrabold leading-tight tracking-tight sm:text-6xl">
              Proof of Learning Pack
            </h2>
            <p className="mt-4 max-w-2xl text-sm text-text-muted sm:text-base">
              Pull attendance, completed assignments, course progress, and portfolio samples into one printable packet and CSV export.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" size="sm" onClick={() => router.push('/dashboard')}>Dashboard</Button>
            <Button variant="ghost" size="sm" onClick={() => window.print()}>Print Packet</Button>
            <Button size="sm" onClick={handleExport} disabled={evidenceRows.length === 0}>Export CSV</Button>
          </div>
        </div>

        <Card className="mb-8 p-4 sm:p-6 print:hidden">
          <div className="grid gap-4 md:grid-cols-4 md:items-end">
            <Select label="Packet Range" value={rangePreset} onChange={(event) => handleRangeChange(event.target.value)}>
              {rangePresets.map((preset) => (
                <option key={preset.value} value={preset.value}>{preset.label}</option>
              ))}
            </Select>
            <Input
              label="Start Date"
              type="date"
              value={startDate}
              onChange={(event) => {
                setRangePreset('custom');
                setStartDate(event.target.value);
              }}
            />
            <Input
              label="End Date"
              type="date"
              value={endDate}
              onChange={(event) => {
                setRangePreset('custom');
                setEndDate(event.target.value);
              }}
            />
            <div className={`rounded-2xl border px-4 py-3 text-sm font-bold ${readiness.tone}`}>
              {readiness.label}
              <span className="mt-1 block text-xs font-medium opacity-80">{totals.rowCount} exportable rows</span>
            </div>
          </div>
        </Card>

        <section className="mb-8 rounded-[2rem] border border-primary/15 bg-primary-dark p-5 text-white shadow-[0_24px_60px_-24px_rgba(45,59,41,0.55)] sm:p-8 print:rounded-none print:border-b-2 print:border-primary print:bg-white print:p-0 print:text-text print:shadow-none">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-accent print:text-primary">Village evidence packet</p>
              <h1 className="m-0 font-display text-3xl font-extrabold sm:text-5xl print:text-3xl">
                {profile?.family_name || 'Family'} Homeschool Records
              </h1>
              <p className="mt-3 text-sm text-white/75 print:text-text-muted">
                {displayDate(startDate)} to {displayDate(endDate)} - Generated {displayDate(today)}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:min-w-[520px]">
              {[
                { label: 'Present days', value: totals.presentDays },
                { label: 'Assignments', value: totals.completedAssignments },
                { label: 'Portfolio', value: totals.portfolioItems },
                { label: 'Lessons', value: totals.lessonsCompleted },
              ].map((stat) => (
                <div key={stat.label} className="rounded-2xl bg-white/10 p-4 text-center ring-1 ring-white/15 print:border print:border-border print:bg-white">
                  <div className="font-display text-3xl font-extrabold text-accent print:text-primary">{stat.value}</div>
                  <div className="mt-1 text-[11px] font-bold uppercase tracking-wide text-white/70 print:text-text-muted">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {kids.length === 0 ? (
          <Card className="py-12 text-center">
            <p className="mb-6 text-text-muted">No children are set up yet.</p>
            <Button onClick={() => router.push('/manage-kids')}>Add Children</Button>
          </Card>
        ) : (
          <div className="space-y-6">
            {childEvidence.map((data) => {
              const progress = data.totalLessons ? Math.round((data.lessonsCompleted / data.totalLessons) * 100) : 0;
              return (
                <Card key={data.child.id} className="p-5 sm:p-8 print:break-inside-avoid print:shadow-none">
                  <div className="mb-6 flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-4">
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary/10 font-display text-2xl font-extrabold text-primary">
                        {data.child.name.charAt(0)}
                      </div>
                      <div>
                        <h3 className="m-0 font-display text-2xl font-extrabold text-primary">{data.child.name}</h3>
                        <p className="m-0 text-sm text-text-muted">{data.child.grade || 'Grade not set'} - Age {data.child.age}</p>
                      </div>
                    </div>
                    <div className="rounded-2xl bg-bg-alt px-4 py-3 text-sm font-bold text-primary">
                      {progress}% course progress
                      <span className="block text-xs font-medium text-text-muted">{data.lessonsCompleted} of {data.totalLessons} lessons</span>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-4">
                    {[
                      { label: 'Attendance', value: data.attendance.length, detail: `${data.attendance.filter((item) => item.status === 'present').length} present` },
                      { label: 'Completed work', value: data.completedAssignments.length, detail: data.averageScore !== null ? `${data.averageScore}% avg` : 'No scores yet' },
                      { label: 'Portfolio samples', value: data.portfolio.length, detail: data.portfolioSubjects.length ? data.portfolioSubjects.join(', ') : 'No samples' },
                      { label: 'Courses', value: data.courses.length, detail: data.courses.map((course) => course.name).slice(0, 2).join(', ') || 'No courses' },
                    ].map((stat) => (
                      <div key={stat.label} className="rounded-2xl border border-border bg-bg-alt p-4">
                        <div className="font-display text-3xl font-extrabold text-primary">{stat.value}</div>
                        <div className="mt-1 text-xs font-bold uppercase tracking-wide text-text-muted">{stat.label}</div>
                        <div className="mt-2 line-clamp-2 text-sm text-text-muted">{stat.detail}</div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-6 grid gap-6 lg:grid-cols-3">
                    <div>
                      <h4 className="mb-3 font-display text-lg font-bold">Recent Attendance</h4>
                      <div className="space-y-2">
                        {data.attendance.slice(0, 5).map((item) => (
                          <div key={item.id} className="flex items-center justify-between rounded-xl bg-green-50 px-3 py-2 text-sm">
                            <span>{displayDate(item.date)}</span>
                            <span className="font-bold capitalize text-green-800">{item.status}</span>
                          </div>
                        ))}
                        {data.attendance.length === 0 && <p className="rounded-xl bg-bg-alt p-3 text-sm text-text-muted">No attendance in this range.</p>}
                      </div>
                    </div>
                    <div>
                      <h4 className="mb-3 font-display text-lg font-bold">Completed Assignments</h4>
                      <div className="space-y-2">
                        {data.completedAssignments.slice(0, 5).map((item) => (
                          <div key={item.id} className="rounded-xl bg-blue-50 px-3 py-2 text-sm">
                            <div className="font-bold text-blue-950">{item.title}</div>
                            <div className="text-xs text-blue-800">{item.subject || 'General'}{item.score !== undefined && item.score !== null ? ` - ${item.score}%` : ''}</div>
                          </div>
                        ))}
                        {data.completedAssignments.length === 0 && <p className="rounded-xl bg-bg-alt p-3 text-sm text-text-muted">No completed assignments in this range.</p>}
                      </div>
                    </div>
                    <div>
                      <h4 className="mb-3 font-display text-lg font-bold">Portfolio Evidence</h4>
                      <div className="space-y-2">
                        {data.portfolio.slice(0, 5).map((item) => (
                          <div key={item.id} className="rounded-xl bg-amber-50 px-3 py-2 text-sm">
                            <div className="font-bold text-amber-950">{item.title}</div>
                            <div className="text-xs text-amber-800">{item.subject || 'General'} - {displayDate(item.date || item.created)}</div>
                          </div>
                        ))}
                        {data.portfolio.length === 0 && <p className="rounded-xl bg-bg-alt p-3 text-sm text-text-muted">No portfolio samples in this range.</p>}
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </main>

      <style jsx global>{`
        @media print {
          @page {
            size: letter;
            margin: 0.5in;
          }

          body {
            background: white !important;
            color: #1A1C19 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          header,
          .print\\:hidden {
            display: none !important;
          }

          .print\\:block {
            display: block !important;
          }

          .print\\:break-inside-avoid {
            break-inside: avoid;
          }
        }
      `}</style>
    </>
  );
}
