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

const CORE_SUBJECTS = [
  'Language Arts',
  'Mathematics',
  'Science',
  'Social Studies'
];

const ENRICHMENT_SUBJECTS = [
  'Fine Arts',
  'Physical Education',
  'Electives'
];

const formatDate = (value?: string) => {
  if (!value) return 'Not dated';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not dated';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const getSchoolYearStart = () => {
  const now = new Date();
  const startYear = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
  return new Date(startYear, 7, 1);
};

const normalizeSubject = (subject?: string) => {
  const value = (subject || 'General').toLowerCase();
  if (value.includes('math')) return 'Mathematics';
  if (value.includes('language') || value.includes('reading') || value.includes('writing') || value.includes('english')) return 'Language Arts';
  if (value.includes('science')) return 'Science';
  if (value.includes('social') || value.includes('history') || value.includes('geography') || value.includes('civics')) return 'Social Studies';
  if (value.includes('art') || value.includes('music')) return 'Fine Arts';
  if (value.includes('physical') || value.includes('pe') || value.includes('health')) return 'Physical Education';
  return subject || 'General';
};

type SubjectCoverage = {
  subject: string;
  portfolioCount: number;
  completedAssignments: number;
  gradedAverage: number | null;
  latestEvidence?: string;
  status: 'ready' | 'thin' | 'missing';
};

export default function PortfolioPackPage() {
  const router = useRouter();
  const pb = getPocketBase();

  const [kids, setKids] = useState<Child[]>([]);
  const [selectedKidId, setSelectedKidId] = useState('');
  const [portfolioItems, setPortfolioItems] = useState<PortfolioItem[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [kidLoading, setKidLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!pb.authStore.isValid) {
      router.push('/');
      return;
    }
    loadFamily();
  }, []);

  useEffect(() => {
    if (selectedKidId) {
      loadKidPacket(selectedKidId);
    }
  }, [selectedKidId]);

  const loadFamily = async () => {
    try {
      const userId = pb.authStore.model?.id;
      if (!userId) return;

      const childRecords = await pb.collection('children').getFullList({
        filter: `user = "${userId}"`,
        sort: 'name'
      });

      setKids(childRecords as unknown as Child[]);
      if (childRecords.length > 0) {
        setSelectedKidId(childRecords[0].id);
      }
    } catch (error) {
      console.error('Portfolio pack family load error:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadKidPacket = async (kidId: string) => {
    setKidLoading(true);
    try {
      const userId = pb.authStore.model?.id;
      if (!userId) return;

      const startDate = getSchoolYearStart().toISOString();
      const [portfolioRecords, assignmentRecords, attendanceRecords, courseRecords] = await Promise.all([
        pb.collection('portfolio').getFullList({
          filter: `child = "${kidId}"`,
          sort: '-date'
        }),
        pb.collection('assignments').getFullList({
          filter: `child = "${kidId}"`,
          sort: '-due_date'
        }).catch(() => []),
        pb.collection('attendance').getFullList({
          filter: `child = "${kidId}" && date >= "${startDate}"`,
          sort: '-date'
        }).catch(() => []),
        pb.collection('courses').getFullList({
          filter: `child = "${kidId}"`,
          sort: 'name'
        }).catch(() => [])
      ]);

      setPortfolioItems(portfolioRecords as unknown as PortfolioItem[]);
      setAssignments(assignmentRecords as unknown as Assignment[]);
      setAttendance(attendanceRecords as unknown as Attendance[]);
      setCourses(courseRecords as unknown as Course[]);
    } catch (error) {
      console.error('Portfolio pack load error:', error);
    } finally {
      setKidLoading(false);
    }
  };

  const selectedKid = kids.find(kid => kid.id === selectedKidId);

  const schoolYearStart = useMemo(() => getSchoolYearStart(), []);
  const currentYearLabel = `${schoolYearStart.getFullYear()}-${schoolYearStart.getFullYear() + 1}`;

  const yearPortfolioItems = useMemo(() => {
    return portfolioItems.filter(item => {
      const itemDate = new Date(item.date || item.created);
      return !Number.isNaN(itemDate.getTime()) && itemDate >= schoolYearStart;
    });
  }, [portfolioItems, schoolYearStart]);

  const yearAssignments = useMemo(() => {
    return assignments.filter(assignment => {
      const dateValue = assignment.due_date || assignment.updated || assignment.created;
      const assignmentDate = new Date(dateValue);
      return !Number.isNaN(assignmentDate.getTime()) && assignmentDate >= schoolYearStart;
    });
  }, [assignments, schoolYearStart]);

  const completedAssignments = yearAssignments.filter(assignment => {
    const status = assignment.status?.toLowerCase();
    return status === 'completed' || status === 'graded';
  });

  const gradedAssignments = yearAssignments.filter(assignment => assignment.score !== undefined && assignment.score !== null);
  const attendanceDays = attendance.filter(day => day.status === 'present' || day.status === 'half-day').length;
  const averageScore = gradedAssignments.length > 0
    ? gradedAssignments.reduce((sum, assignment) => sum + (assignment.score || 0), 0) / gradedAssignments.length
    : null;

  const coverage: SubjectCoverage[] = [...CORE_SUBJECTS, ...ENRICHMENT_SUBJECTS].map(subject => {
    const subjectPortfolio = yearPortfolioItems.filter(item => normalizeSubject(item.subject) === subject);
    const subjectAssignments = completedAssignments.filter(assignment => normalizeSubject(assignment.subject) === subject);
    const subjectGraded = gradedAssignments.filter(assignment => normalizeSubject(assignment.subject) === subject);
    const gradedAverage = subjectGraded.length > 0
      ? subjectGraded.reduce((sum, assignment) => sum + (assignment.score || 0), 0) / subjectGraded.length
      : null;
    const latestEvidence = [...subjectPortfolio]
      .sort((a, b) => new Date(b.date || b.created).getTime() - new Date(a.date || a.created).getTime())[0]?.title;
    const evidenceCount = subjectPortfolio.length + subjectAssignments.length;

    return {
      subject,
      portfolioCount: subjectPortfolio.length,
      completedAssignments: subjectAssignments.length,
      gradedAverage,
      latestEvidence,
      status: evidenceCount >= 3 ? 'ready' : evidenceCount > 0 ? 'thin' : 'missing'
    };
  });

  const readySubjects = coverage.filter(row => row.status === 'ready').length;
  const missingSubjects = coverage.filter(row => row.status === 'missing').length;
  const packetScore = Math.round(((readySubjects * 2 + coverage.filter(row => row.status === 'thin').length) / (coverage.length * 2)) * 100);

  const recentEvidence = [...yearPortfolioItems]
    .sort((a, b) => new Date(b.date || b.created).getTime() - new Date(a.date || a.created).getTime())
    .slice(0, 8);

  const activeCourses = courses.filter(course => course.current_lesson <= course.total_lessons);
  const completedCourses = courses.filter(course => course.current_lesson > course.total_lessons);

  const checklist = [
    {
      label: 'Core subjects have evidence',
      done: CORE_SUBJECTS.every(subject => coverage.find(row => row.subject === subject)?.status !== 'missing'),
      detail: `${CORE_SUBJECTS.length - CORE_SUBJECTS.filter(subject => coverage.find(row => row.subject === subject)?.status === 'missing').length}/${CORE_SUBJECTS.length} core subjects covered`
    },
    {
      label: 'At least 20 attendance days logged',
      done: attendanceDays >= 20,
      detail: `${attendanceDays} day${attendanceDays === 1 ? '' : 's'} logged since Aug 1`
    },
    {
      label: 'Recent portfolio samples attached',
      done: recentEvidence.length >= 6,
      detail: `${recentEvidence.length} sample${recentEvidence.length === 1 ? '' : 's'} in this packet`
    },
    {
      label: 'Grades or scores available',
      done: gradedAssignments.length >= 3,
      detail: `${gradedAssignments.length} graded assignment${gradedAssignments.length === 1 ? '' : 's'}`
    }
  ];

  const getImageUrl = (item: PortfolioItem) => {
    const images = Array.isArray(item.image) ? item.image : [item.image].filter(Boolean);
    if (images.length === 0) return null;
    return pb.files.getURL(item as unknown as Record<string, unknown>, images[0]);
  };

  const copySummary = async () => {
    if (!selectedKid) return;
    const summary = [
      `Village Portfolio Pack — ${selectedKid.name}`,
      `School year: ${currentYearLabel}`,
      `Packet readiness: ${packetScore}%`,
      `Attendance days logged: ${attendanceDays}`,
      `Portfolio samples: ${yearPortfolioItems.length}`,
      `Completed assignments: ${completedAssignments.length}`,
      `Average score: ${averageScore === null ? 'Not enough graded work' : `${averageScore.toFixed(1)}%`}`,
      '',
      'Subject coverage:',
      ...coverage.map(row => `- ${row.subject}: ${row.status.toUpperCase()} (${row.portfolioCount} samples, ${row.completedAssignments} completed assignments)`)
    ].join('\n');

    await navigator.clipboard.writeText(summary);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  if (loading) return <LoadingScreen message="Preparing portfolio pack..." />;

  return (
    <>
      <Header showLogout onLogout={() => { pb.authStore.clear(); router.push('/'); }} />
      <main className="max-w-7xl mx-auto my-8 sm:my-12 px-4 sm:px-8 pb-20 animate-fade-in">
        <section className="print:hidden mb-10">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 mb-8">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.25em] text-secondary mb-3">Evaluator-ready export</p>
              <h2 className="font-display text-4xl sm:text-6xl font-extrabold tracking-tight mb-3">Portfolio Pack</h2>
              <p className="text-text-muted max-w-3xl">
                One printable packet for reviews, evaluator meetings, family records, or year-end homeschool documentation.
              </p>
            </div>
            <div className="flex gap-3 flex-wrap">
              <Button variant="outline" onClick={() => router.push('/portfolio')}>🎨 Portfolio</Button>
              <Button variant="outline" onClick={() => router.push('/transcript')}>📄 Transcript</Button>
              <Button onClick={() => window.print()} disabled={!selectedKidId || kidLoading}>🖨️ Print / Save PDF</Button>
            </div>
          </div>

          <Card className="p-6 md:p-8">
            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-6 items-end">
              <Select label="Select Student" value={selectedKidId} onChange={(event) => setSelectedKidId(event.target.value)}>
                {kids.map(kid => <option key={kid.id} value={kid.id}>{kid.name}</option>)}
              </Select>
              <Button variant="ghost" onClick={copySummary} disabled={!selectedKid || kidLoading}>
                {copied ? '✅ Copied' : 'Copy packet summary'}
              </Button>
            </div>
          </Card>
        </section>

        {!selectedKid ? (
          <Card className="text-center py-16">
            <p className="text-text-muted text-lg mb-6">Add a student first, then Village can build a packet.</p>
            <Button onClick={() => router.push('/manage-kids')}>Add Student</Button>
          </Card>
        ) : kidLoading ? (
          <LoadingScreen message="Gathering evidence..." />
        ) : (
          <article className="bg-white border-2 border-border rounded-[2rem] p-6 sm:p-10 lg:p-14 shadow-shadow print:border-0 print:rounded-none print:shadow-none print:p-0 mx-auto max-w-[8.5in]">
            <header className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-8 pb-10 mb-10 border-b-4 border-primary/10">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.25em] text-primary mb-3">Village Homeschool</p>
                <h1 className="font-display text-4xl sm:text-5xl font-extrabold tracking-tight m-0">Portfolio Pack</h1>
                <p className="font-serif italic text-lg text-text-muted mt-3">{selectedKid.name} • {currentYearLabel} school year</p>
              </div>
              <div className="text-left sm:text-right">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-secondary mb-2">Prepared</p>
                <p className="font-bold text-lg">{formatDate(new Date().toISOString())}</p>
              </div>
            </header>

            <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
              {[
                { label: 'Readiness', value: `${packetScore}%`, tone: 'text-primary' },
                { label: 'Attendance Days', value: attendanceDays, tone: 'text-secondary' },
                { label: 'Portfolio Samples', value: yearPortfolioItems.length, tone: 'text-accent' },
                { label: 'Completed Work', value: completedAssignments.length, tone: 'text-primary' }
              ].map(card => (
                <div key={card.label} className="bg-bg-alt rounded-3xl p-5 border border-border/70">
                  <p className="text-[10px] font-black uppercase tracking-widest text-text-muted mb-2">{card.label}</p>
                  <p className={`font-display text-3xl font-extrabold m-0 ${card.tone}`}>{card.value}</p>
                </div>
              ))}
            </section>

            <section className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
              <div>
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary mb-5 border-b pb-2">Student Snapshot</h3>
                <dl className="space-y-4">
                  <div className="flex justify-between gap-6">
                    <dt className="text-sm text-text-muted">Name</dt>
                    <dd className="text-sm font-bold text-right">{selectedKid.name}</dd>
                  </div>
                  <div className="flex justify-between gap-6">
                    <dt className="text-sm text-text-muted">Age</dt>
                    <dd className="text-sm font-bold text-right">{selectedKid.age} years</dd>
                  </div>
                  {selectedKid.grade && (
                    <div className="flex justify-between gap-6">
                      <dt className="text-sm text-text-muted">Grade</dt>
                      <dd className="text-sm font-bold text-right">{selectedKid.grade}</dd>
                    </div>
                  )}
                  {selectedKid.focus && (
                    <div className="flex justify-between gap-6">
                      <dt className="text-sm text-text-muted">Learning focus</dt>
                      <dd className="text-sm font-bold text-right">{selectedKid.focus}</dd>
                    </div>
                  )}
                </dl>
              </div>

              <div>
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-secondary mb-5 border-b pb-2">Evaluator Checklist</h3>
                <div className="space-y-3">
                  {checklist.map(item => (
                    <div key={item.label} className="flex items-start gap-3">
                      <span className={`mt-0.5 flex h-6 w-6 items-center justify-center rounded-full text-xs font-black ${item.done ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                        {item.done ? '✓' : '!'}
                      </span>
                      <div>
                        <p className="font-bold text-sm m-0">{item.label}</p>
                        <p className="text-xs text-text-muted m-0">{item.detail}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section className="mb-12">
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary mb-5 border-b pb-2">Subject Evidence Coverage</h3>
              <div className="overflow-hidden rounded-2xl border border-border">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="bg-bg-alt text-left">
                      <th className="px-4 py-3 text-[10px] font-black uppercase tracking-wider text-text-muted">Subject</th>
                      <th className="px-4 py-3 text-[10px] font-black uppercase tracking-wider text-text-muted text-center">Samples</th>
                      <th className="px-4 py-3 text-[10px] font-black uppercase tracking-wider text-text-muted text-center">Completed</th>
                      <th className="px-4 py-3 text-[10px] font-black uppercase tracking-wider text-text-muted text-center">Avg.</th>
                      <th className="px-4 py-3 text-[10px] font-black uppercase tracking-wider text-text-muted">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {coverage.map(row => (
                      <tr key={row.subject}>
                        <td className="px-4 py-4 font-bold">
                          {row.subject}
                          {row.latestEvidence && <p className="text-xs text-text-muted font-normal mt-1">Latest: {row.latestEvidence}</p>}
                        </td>
                        <td className="px-4 py-4 text-center">{row.portfolioCount}</td>
                        <td className="px-4 py-4 text-center">{row.completedAssignments}</td>
                        <td className="px-4 py-4 text-center">{row.gradedAverage === null ? '—' : `${row.gradedAverage.toFixed(0)}%`}</td>
                        <td className="px-4 py-4">
                          <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase ${
                            row.status === 'ready' ? 'bg-green-100 text-green-700' : row.status === 'thin' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                          }`}>
                            {row.status === 'ready' ? 'Ready' : row.status === 'thin' ? 'Needs 1-2 more' : 'Missing'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
              <div>
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary mb-5 border-b pb-2">Course Progress</h3>
                {courses.length === 0 ? (
                  <p className="text-sm text-text-muted italic">No courses recorded yet.</p>
                ) : (
                  <div className="space-y-3">
                    {courses.slice(0, 8).map(course => {
                      const completed = Math.min(Math.max(course.current_lesson - 1, 0), course.total_lessons);
                      const percent = course.total_lessons > 0 ? Math.round((completed / course.total_lessons) * 100) : 0;
                      return (
                        <div key={course.id} className="rounded-2xl bg-bg-alt p-4 border border-border/70">
                          <div className="flex justify-between gap-4 mb-2">
                            <p className="font-bold text-sm m-0">{course.name}</p>
                            <p className="text-xs font-bold text-text-muted m-0">{percent}%</p>
                          </div>
                          <div className="h-2 rounded-full bg-white overflow-hidden">
                            <div className="h-full bg-primary rounded-full" style={{ width: `${percent}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div>
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-secondary mb-5 border-b pb-2">Academic Summary</h3>
                <div className="space-y-4 text-sm">
                  <div className="flex justify-between gap-6 rounded-2xl bg-bg-alt p-4">
                    <span className="text-text-muted">Active courses</span>
                    <strong>{activeCourses.length}</strong>
                  </div>
                  <div className="flex justify-between gap-6 rounded-2xl bg-bg-alt p-4">
                    <span className="text-text-muted">Completed courses</span>
                    <strong>{completedCourses.length}</strong>
                  </div>
                  <div className="flex justify-between gap-6 rounded-2xl bg-bg-alt p-4">
                    <span className="text-text-muted">Graded work average</span>
                    <strong>{averageScore === null ? 'Not enough data' : `${averageScore.toFixed(1)}%`}</strong>
                  </div>
                  <div className="flex justify-between gap-6 rounded-2xl bg-bg-alt p-4">
                    <span className="text-text-muted">Subjects needing evidence</span>
                    <strong>{missingSubjects}</strong>
                  </div>
                </div>
              </div>
            </section>

            <section>
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary mb-5 border-b pb-2">Recent Portfolio Evidence</h3>
              {recentEvidence.length === 0 ? (
                <div className="rounded-3xl border-2 border-dashed border-border p-10 text-center">
                  <p className="font-serif italic text-text-muted">No portfolio samples from this school year yet.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  {recentEvidence.map(item => {
                    const imageUrl = getImageUrl(item);
                    return (
                      <div key={item.id} className="rounded-3xl border border-border overflow-hidden bg-bg-alt break-inside-avoid">
                        {imageUrl ? (
                          <img src={imageUrl} alt={item.title} className="h-40 w-full object-cover" />
                        ) : (
                          <div className="h-24 flex items-center justify-center bg-accent-soft text-3xl">📝</div>
                        )}
                        <div className="p-5">
                          <p className="text-[10px] font-black uppercase tracking-wider text-secondary mb-2">{normalizeSubject(item.subject)} • {formatDate(item.date)}</p>
                          <h4 className="font-display text-xl font-extrabold m-0 mb-2">{item.title}</h4>
                          {item.description && <p className="text-sm text-text-muted m-0 line-clamp-3">{item.description}</p>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </article>
        )}
      </main>
    </>
  );
}
