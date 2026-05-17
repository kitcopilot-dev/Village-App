'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getPocketBase } from '@/lib/pocketbase';
import { Assignment, Attendance, Child, Course, PortfolioItem } from '@/lib/types';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Select } from '@/components/ui/Input';
import { LoadingScreen } from '@/components/ui/Spinner';

type DateRangeKey = '30' | '90' | '180' | '365' | 'all';

interface ChildRecordPacket {
  child: Child;
  attendance: Attendance[];
  courses: Course[];
  assignments: Assignment[];
  portfolio: PortfolioItem[];
}

const RANGE_OPTIONS: { value: DateRangeKey; label: string }[] = [
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
  { value: '180', label: 'Last 180 days' },
  { value: '365', label: 'Last 12 months' },
  { value: 'all', label: 'All available records' },
];

const STATUS_LABELS: Record<Attendance['status'], string> = {
  present: 'Present',
  absent: 'Absent',
  sick: 'Sick',
  'half-day': 'Half day',
  holiday: 'Holiday',
};

function toDateInputValue(date: Date): string {
  return date.toISOString().split('T')[0];
}

function getRangeStart(range: DateRangeKey): string {
  if (range === 'all') return '1970-01-01';

  const date = new Date();
  date.setDate(date.getDate() - Number(range));
  return toDateInputValue(date);
}

function formatLongDate(value?: string): string {
  if (!value) return 'Not recorded';

  const date = new Date(value.includes('T') ? value : `${value}T12:00:00`);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function getAssignmentDate(assignment: Assignment): string {
  return assignment.due_date || assignment.updated || assignment.created;
}

function assignmentIsComplete(assignment: Assignment): boolean {
  return assignment.status === 'completed' || assignment.status === 'Graded';
}

function scoreToLetterGrade(score: number): string {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

function buildChildFilter(kids: Child[]): string {
  return kids.map((kid) => `child = "${kid.id}"`).join(' || ');
}

function filterByDate<T>(items: T[], getDate: (item: T) => string | undefined, startDate: string, endDate: string): T[] {
  return items.filter((item) => {
    const value = getDate(item);
    if (!value) return false;

    const normalized = value.slice(0, 10);
    return normalized >= startDate && normalized <= endDate;
  });
}

function getInstructionalDays(attendance: Attendance[]): number {
  return attendance.reduce((total, record) => {
    if (record.status === 'present') return total + 1;
    if (record.status === 'half-day') return total + 0.5;
    return total;
  }, 0);
}

function getAverageScore(assignments: Assignment[]): number | null {
  const scored = assignments.filter((assignment) => assignment.score !== undefined && assignment.score !== null);
  if (scored.length === 0) return null;

  return scored.reduce((total, assignment) => total + (assignment.score || 0), 0) / scored.length;
}

function getSubjectCounts(items: Array<{ subject?: string }>): [string, number][] {
  const counts = items.reduce<Record<string, number>>((acc, item) => {
    const subject = item.subject || 'General';
    acc[subject] = (acc[subject] || 0) + 1;
    return acc;
  }, {});

  return Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

export default function RecordsPage() {
  const router = useRouter();
  const pb = getPocketBase();

  const [kids, setKids] = useState<Child[]>([]);
  const [packets, setPackets] = useState<ChildRecordPacket[]>([]);
  const [selectedKidId, setSelectedKidId] = useState('all');
  const [range, setRange] = useState<DateRangeKey>('180');
  const [loading, setLoading] = useState(true);
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');

  const endDate = useMemo(() => toDateInputValue(new Date()), []);
  const startDate = useMemo(() => getRangeStart(range), [range]);

  useEffect(() => {
    if (!pb.authStore.isValid) {
      router.push('/');
      return;
    }

    loadRecords();
  }, [range]);

  const loadRecords = async () => {
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
        setPackets([]);
        return;
      }

      const childFilter = buildChildFilter(loadedKids);

      const [courseRecords, attendanceRecords, assignmentRecords, portfolioRecords] = await Promise.all([
        pb.collection('courses').getFullList({
          filter: childFilter,
          sort: 'name',
        }).catch(() => []),
        pb.collection('attendance').getFullList({
          filter: `user = "${userId}" && date >= "${startDate}" && date <= "${endDate}"`,
          sort: '-date',
        }).catch(() => []),
        pb.collection('assignments').getFullList({
          filter: `user = "${userId}"`,
          sort: '-due_date',
        }).catch(() => []),
        pb.collection('portfolio').getFullList({
          filter: `(${childFilter})`,
          sort: '-date',
        }).catch(() => pb.collection('portfolio_items').getFullList({
          filter: `(${childFilter})`,
          sort: '-date',
        }).catch(() => [])),
      ]);

      const allCourses = courseRecords as unknown as Course[];
      const allAttendance = attendanceRecords as unknown as Attendance[];
      const allAssignments = filterByDate(
        assignmentRecords as unknown as Assignment[],
        getAssignmentDate,
        startDate,
        endDate
      );
      const allPortfolio = filterByDate(
        portfolioRecords as unknown as PortfolioItem[],
        (item) => item.date || item.created,
        startDate,
        endDate
      );

      setPackets(loadedKids.map((child) => ({
        child,
        attendance: allAttendance.filter((record) => record.child === child.id),
        courses: allCourses.filter((course) => course.child === child.id),
        assignments: allAssignments.filter((assignment) => assignment.child === child.id),
        portfolio: allPortfolio.filter((item) => item.child === child.id),
      })));
    } catch (error) {
      console.error('Records packet load error:', error);
    } finally {
      setLoading(false);
    }
  };

  const visiblePackets = packets.filter((packet) => selectedKidId === 'all' || packet.child.id === selectedKidId);

  const totals = visiblePackets.reduce((acc, packet) => {
    acc.students += 1;
    acc.instructionalDays += getInstructionalDays(packet.attendance);
    acc.completedAssignments += packet.assignments.filter(assignmentIsComplete).length;
    acc.workSamples += packet.portfolio.length;
    acc.activeCourses += packet.courses.filter((course) => course.current_lesson <= course.total_lessons).length;
    return acc;
  }, {
    students: 0,
    instructionalDays: 0,
    completedAssignments: 0,
    workSamples: 0,
    activeCourses: 0,
  });

  const summaryText = visiblePackets.map((packet) => {
    const average = getAverageScore(packet.assignments);
    return [
      `${packet.child.name} records packet`,
      `Range: ${range === 'all' ? 'All available records' : `${formatLongDate(startDate)} - ${formatLongDate(endDate)}`}`,
      `Instructional days: ${getInstructionalDays(packet.attendance)}`,
      `Courses: ${packet.courses.length}`,
      `Completed assignments: ${packet.assignments.filter(assignmentIsComplete).length}`,
      `Portfolio samples: ${packet.portfolio.length}`,
      `Average score: ${average === null ? 'Not enough graded work' : `${Math.round(average)}% (${scoreToLetterGrade(average)})`}`,
    ].join('\n');
  }).join('\n\n');

  const copySummary = async () => {
    try {
      await navigator.clipboard.writeText(summaryText);
      setCopyState('copied');
      setTimeout(() => setCopyState('idle'), 2200);
    } catch {
      setCopyState('failed');
      setTimeout(() => setCopyState('idle'), 2200);
    }
  };

  if (loading) {
    return <LoadingScreen message="Building records packet..." />;
  }

  if (kids.length === 0) {
    return (
      <>
        <Header showLogout onLogout={() => { pb.authStore.clear(); router.push('/'); }} />
        <main className="max-w-4xl mx-auto my-12 px-8 text-center">
          <Card className="py-20">
            <p className="text-xl text-text-muted mb-8 font-serif italic">Add students before generating a records packet.</p>
            <Button onClick={() => router.push('/manage-kids')}>Add Your First Child</Button>
          </Card>
        </main>
      </>
    );
  }

  return (
    <>
      <Header showLogout onLogout={() => { pb.authStore.clear(); router.push('/'); }} />
      <main className="max-w-7xl mx-auto my-8 sm:my-12 px-4 sm:px-8 pb-24 animate-fade-in">
        <section className="print:hidden mb-10">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 mb-8">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-secondary mb-3">Records</p>
              <h2 className="font-display text-4xl sm:text-6xl font-extrabold tracking-tight mb-3">Family Records Packet</h2>
              <p className="text-text-muted max-w-2xl">
                One printable packet for compliance reviews, ESA reimbursement prep, evaluator check-ins, or year-end record keeping.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button variant="outline" onClick={copySummary}>
                {copyState === 'copied' ? 'Copied' : copyState === 'failed' ? 'Copy Failed' : 'Copy Summary'}
              </Button>
              <Button onClick={() => window.print()}>Print / Save PDF</Button>
              <Button variant="ghost" onClick={() => router.push('/dashboard')}>Dashboard</Button>
            </div>
          </div>

          <Card className="p-5 sm:p-6 md:p-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <Select label="Student" value={selectedKidId} onChange={(event) => setSelectedKidId(event.target.value)}>
                <option value="all">All Students</option>
                {kids.map((kid) => <option key={kid.id} value={kid.id}>{kid.name}</option>)}
              </Select>
              <Select label="Date Range" value={range} onChange={(event) => setRange(event.target.value as DateRangeKey)}>
                {RANGE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </Select>
            </div>
          </Card>
        </section>

        <section className="bg-white border-2 border-border rounded-[2rem] p-6 sm:p-10 md:p-14 shadow-shadow print:border-0 print:shadow-none print:p-0 print:rounded-none">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-8 pb-8 mb-8 border-b-4 border-primary/10">
            <div>
              <h1 className="font-display text-primary text-3xl sm:text-4xl font-extrabold uppercase tracking-tighter m-0 mb-1">
                Village<span className="text-secondary">.</span> Records Packet
              </h1>
              <p className="font-serif italic text-text-muted m-0">
                {range === 'all' ? 'All available records' : `${formatLongDate(startDate)} - ${formatLongDate(endDate)}`}
              </p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
              {[
                { label: 'Students', value: totals.students },
                { label: 'Days', value: totals.instructionalDays },
                { label: 'Courses', value: totals.activeCourses },
                { label: 'Assignments', value: totals.completedAssignments },
                { label: 'Samples', value: totals.workSamples },
              ].map((stat) => (
                <div key={stat.label} className="bg-bg-alt rounded-2xl px-4 py-3">
                  <p className="font-display text-2xl font-extrabold text-primary m-0">{stat.value}</p>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted m-0">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-12">
            {visiblePackets.map((packet) => {
              const average = getAverageScore(packet.assignments);
              const completedAssignments = packet.assignments.filter(assignmentIsComplete);
              const attendanceCounts = packet.attendance.reduce<Record<string, number>>((acc, record) => {
                acc[record.status] = (acc[record.status] || 0) + 1;
                return acc;
              }, {});
              const subjectCounts = getSubjectCounts([...packet.assignments, ...packet.portfolio]);

              return (
                <article key={packet.child.id} className="break-inside-avoid">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
                    <div>
                      <h2 className="font-display text-3xl font-extrabold text-text m-0">{packet.child.name}</h2>
                      <p className="text-sm text-text-muted m-0">
                        {packet.child.grade || 'Grade not set'} - Age {packet.child.age}
                        {packet.child.focus ? ` - ${packet.child.focus}` : ''}
                      </p>
                    </div>
                    <div className="text-left md:text-right">
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary m-0">Academic Snapshot</p>
                      <p className="font-bold text-lg m-0">
                        {average === null ? 'No graded average yet' : `${Math.round(average)}% - ${scoreToLetterGrade(average)}`}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
                    {[
                      { label: 'Instructional Days', value: getInstructionalDays(packet.attendance) },
                      { label: 'Logged Attendance', value: packet.attendance.length },
                      { label: 'Completed Work', value: completedAssignments.length },
                      { label: 'Portfolio Evidence', value: packet.portfolio.length },
                    ].map((stat) => (
                      <div key={stat.label} className="rounded-2xl border border-border p-4">
                        <p className="font-display text-2xl font-extrabold text-secondary m-0">{stat.value}</p>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted m-0">{stat.label}</p>
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div>
                      <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary mb-4 border-b pb-2">Courses</h3>
                      {packet.courses.length === 0 ? (
                        <p className="text-sm text-text-muted">No courses recorded.</p>
                      ) : (
                        <div className="space-y-3">
                          {packet.courses.map((course) => {
                            const completed = Math.max(0, Math.min(course.current_lesson - 1, course.total_lessons));
                            const percentage = course.total_lessons > 0 ? Math.round((completed / course.total_lessons) * 100) : 0;

                            return (
                              <div key={course.id} className="rounded-2xl bg-bg-alt p-4">
                                <p className="font-bold text-sm m-0">{course.name}</p>
                                <p className="text-xs text-text-muted m-0">
                                  {completed} of {course.total_lessons} lessons - {percentage}% complete
                                </p>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    <div>
                      <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-secondary mb-4 border-b pb-2">Attendance</h3>
                      {packet.attendance.length === 0 ? (
                        <p className="text-sm text-text-muted">No attendance in this range.</p>
                      ) : (
                        <div className="grid grid-cols-2 gap-3">
                          {Object.entries(STATUS_LABELS).map(([status, label]) => (
                            <div key={status} className="rounded-2xl bg-bg-alt p-4">
                              <p className="font-display text-xl font-extrabold text-primary m-0">{attendanceCounts[status] || 0}</p>
                              <p className="text-[10px] font-bold uppercase text-text-muted m-0">{label}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div>
                      <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-accent mb-4 border-b pb-2">Evidence</h3>
                      {subjectCounts.length === 0 ? (
                        <p className="text-sm text-text-muted">No assignments or work samples in this range.</p>
                      ) : (
                        <div className="space-y-3">
                          {subjectCounts.slice(0, 6).map(([subject, count]) => (
                            <div key={subject} className="flex items-center justify-between gap-3 rounded-2xl bg-bg-alt p-4">
                              <span className="font-bold text-sm">{subject}</span>
                              <span className="text-xs font-bold text-text-muted">{count} item{count === 1 ? '' : 's'}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-8 overflow-hidden rounded-2xl border border-border">
                    <table className="w-full border-collapse text-sm">
                      <thead className="bg-bg-alt">
                        <tr>
                          <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-text-muted">Recent Evidence</th>
                          <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-text-muted">Subject</th>
                          <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-text-muted">Date</th>
                          <th className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-text-muted">Result</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {packet.assignments.slice(0, 5).map((assignment) => (
                          <tr key={assignment.id}>
                            <td className="px-4 py-3 font-bold">{assignment.title}</td>
                            <td className="px-4 py-3 text-text-muted">{assignment.subject || 'General'}</td>
                            <td className="px-4 py-3 text-text-muted">{formatLongDate(getAssignmentDate(assignment))}</td>
                            <td className="px-4 py-3 text-right font-bold">
                              {assignment.score !== undefined && assignment.score !== null ? `${assignment.score}%` : assignment.status}
                            </td>
                          </tr>
                        ))}
                        {packet.portfolio.slice(0, 5).map((item) => (
                          <tr key={item.id}>
                            <td className="px-4 py-3 font-bold">{item.title}</td>
                            <td className="px-4 py-3 text-text-muted">{item.subject || 'Portfolio'}</td>
                            <td className="px-4 py-3 text-text-muted">{formatLongDate(item.date || item.created)}</td>
                            <td className="px-4 py-3 text-right font-bold">Work sample</td>
                          </tr>
                        ))}
                        {packet.assignments.length === 0 && packet.portfolio.length === 0 && (
                          <tr>
                            <td className="px-4 py-6 text-center text-text-muted" colSpan={4}>No evidence rows for this range.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </main>
    </>
  );
}
