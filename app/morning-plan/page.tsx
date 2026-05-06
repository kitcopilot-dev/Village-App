'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getPocketBase } from '@/lib/pocketbase';
import { Assignment, Attendance, Child, Course, PortfolioItem, SchoolBreak, SchoolYear } from '@/lib/types';
import { getExpectedLesson } from '@/lib/calendar-utils';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { LoadingScreen } from '@/components/ui/Spinner';
import { Toast } from '@/components/ui/Toast';

type DevotionalPrompt = {
  reference: string;
  theme: string;
  opener: string;
  question: string;
  action: string;
};

type ChildPlan = {
  child: Child;
  attendanceLogged: boolean;
  overdueAssignments: Assignment[];
  todayAssignments: Assignment[];
  upcomingAssignments: Assignment[];
  lessonFocus: CourseFocus[];
  evidenceCount: number;
  blockers: string[];
};

type CourseFocus = {
  course: Course;
  label: string;
  status: 'active' | 'behind' | 'next';
};

const MS_PER_DAY = 1000 * 60 * 60 * 24;
const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const DEVOTIONAL_PROMPTS: DevotionalPrompt[] = [
  {
    reference: 'Alma 37:6–7',
    theme: 'Small things matter',
    opener: 'Read the verses, then name one tiny act of diligence that would make today easier.',
    question: 'Where can we be faithful in something small before lunch?',
    action: 'Pick one 10-minute task and finish it with no complaining.',
  },
  {
    reference: 'Doctrine & Covenants 88:118',
    theme: 'Seek learning by study and faith',
    opener: 'Talk about why study and faith belong together instead of competing.',
    question: 'Which subject needs more patience from us today?',
    action: 'Start that subject with a short prayer and a clear first step.',
  },
  {
    reference: 'Mosiah 4:27',
    theme: 'Wisdom and order',
    opener: 'Read the verse and talk about avoiding burnout while still moving forward.',
    question: 'What should we simplify so the important work actually gets done?',
    action: 'Remove or postpone one nonessential task from the day.',
  },
  {
    reference: '2 Nephi 2:25',
    theme: 'Joy has a place in school',
    opener: 'Name one thing each child is looking forward to learning or creating.',
    question: 'How can we make the hardest assignment a little more joyful?',
    action: 'Add music, movement, drawing, or a short outside break after focused work.',
  },
  {
    reference: 'Moroni 10:32',
    theme: 'Come unto Christ',
    opener: 'Connect today’s work to becoming more capable, kind, and useful.',
    question: 'Who can we serve better because we learned something today?',
    action: 'End the day by sharing one thing learned and one person helped.',
  },
  {
    reference: 'Articles of Faith 1:13',
    theme: 'Seek after good things',
    opener: 'Choose one true, lovely, or praiseworthy thing to notice during school.',
    question: 'What good thing can we add to the house today?',
    action: 'Make one portfolio-worthy artifact: a paragraph, photo, diagram, or recording.',
  },
  {
    reference: 'Joshua 24:15',
    theme: 'Our house chooses the Lord',
    opener: 'Set the tone for the week by naming what kind of home school should feel like.',
    question: 'What choice would make our home more peaceful today?',
    action: 'Let each child choose one helpful classroom job before lessons begin.',
  },
];

function todayLocalDate() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function dateOnly(value?: string) {
  return value?.slice(0, 10) ?? '';
}

function parseLocalDate(value?: string) {
  if (!value) return null;
  const date = new Date(`${dateOnly(value)}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(value?: string) {
  const date = parseLocalDate(value);
  if (!date) return 'No date';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function isCompleted(status?: string) {
  const normalized = (status ?? '').toLowerCase();
  return normalized === 'graded' || normalized === 'completed' || normalized === 'complete';
}

function assignmentBucket(assignment: Assignment, todayIso: string) {
  if (isCompleted(assignment.status)) return 'done';
  const due = dateOnly(assignment.due_date);
  if (!due) return 'upcoming';
  if (due < todayIso) return 'overdue';
  if (due === todayIso) return 'today';

  const dueDate = parseLocalDate(due);
  const todayDate = parseLocalDate(todayIso);
  if (!dueDate || !todayDate) return 'upcoming';
  const daysAway = Math.round((dueDate.getTime() - todayDate.getTime()) / MS_PER_DAY);
  return daysAway <= 3 ? 'upcoming' : 'later';
}

function courseActiveToday(course: Course) {
  const todayLabel = WEEKDAY_LABELS[new Date().getDay()];
  if (!course.active_days) return !['Sun', 'Sat'].includes(todayLabel);

  const raw = course.active_days.trim();
  let activeDays: string[] = [];
  if (raw.startsWith('[') && raw.endsWith(']')) {
    try {
      activeDays = JSON.parse(raw) as string[];
    } catch {
      activeDays = raw.split(',');
    }
  } else {
    activeDays = raw.split(',');
  }

  return activeDays.map((day) => day.trim()).includes(todayLabel);
}

function devotionalForToday() {
  const start = new Date(new Date().getFullYear(), 0, 1);
  const dayOfYear = Math.floor((Date.now() - start.getTime()) / MS_PER_DAY);
  return DEVOTIONAL_PROMPTS[dayOfYear % DEVOTIONAL_PROMPTS.length];
}

function buildCopyText(plans: ChildPlan[], devotional: DevotionalPrompt, todayIso: string) {
  const lines = [
    `Village Morning Plan — ${formatDate(todayIso)}`,
    '',
    `Devotional: ${devotional.reference} — ${devotional.theme}`,
    devotional.question,
    `Action: ${devotional.action}`,
    '',
  ];

  plans.forEach((plan) => {
    lines.push(`${plan.child.name}`);
    lines.push(`- Attendance: ${plan.attendanceLogged ? 'already logged' : 'log today'}`);

    const assignments = [...plan.overdueAssignments, ...plan.todayAssignments, ...plan.upcomingAssignments]
      .slice(0, 5)
      .map((assignment) => `${assignment.title}${assignment.due_date ? ` (${formatDate(assignment.due_date)})` : ''}`);
    lines.push(`- Assignments: ${assignments.length ? assignments.join('; ') : 'no urgent assignments'}`);

    const lessons = plan.lessonFocus.slice(0, 4).map(({ course, label }) => `${course.name} ${label}`);
    lines.push(`- Lessons: ${lessons.length ? lessons.join('; ') : 'choose a light review or reading block'}`);

    if (plan.blockers.length > 0) lines.push(`- Watch: ${plan.blockers.join('; ')}`);
    lines.push('');
  });

  return lines.join('\n');
}

export default function MorningPlanPage() {
  const router = useRouter();
  const pb = getPocketBase();
  const [kids, setKids] = useState<Child[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>([]);
  const [schoolYear, setSchoolYear] = useState<SchoolYear | null>(null);
  const [breaks, setBreaks] = useState<SchoolBreak[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const todayIso = todayLocalDate();
  const devotional = useMemo(() => devotionalForToday(), []);

  const loadData = useCallback(async () => {
    try {
      const userId = pb.authStore.model?.id;
      if (!userId) return;

      const childRecords = await pb.collection('children').getFullList({
        filter: `user = "${userId}"`,
        sort: 'name',
      });
      const children = childRecords as unknown as Child[];
      setKids(children);

      const childIds = children.map((child) => child.id);
      const childFilter = childIds.length ? childIds.map((id) => `child = "${id}"`).join(' || ') : '';
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const sevenDaysAgoIso = sevenDaysAgo.toISOString().slice(0, 10);

      const [assignmentRecords, attendanceRecords, courseRecords, portfolioRecords, schoolYearRecords] = await Promise.all([
        pb.collection('assignments').getFullList({
          filter: `user = "${userId}"`,
          sort: 'due_date',
        }).catch(() => []),
        pb.collection('attendance').getFullList({
          filter: `user = "${userId}" && date >= "${sevenDaysAgoIso}"`,
          sort: '-date',
        }).catch(() => []),
        childFilter
          ? pb.collection('courses').getFullList({ filter: childFilter, sort: 'name' }).catch(() => [])
          : Promise.resolve([]),
        childFilter
          ? pb.collection('portfolio').getFullList({ filter: childFilter, sort: '-date' })
              .catch(() => pb.collection('portfolio_items').getFullList({ filter: childFilter, sort: '-date' }))
              .catch(() => [])
          : Promise.resolve([]),
        pb.collection('school_years').getFullList({
          filter: `user = "${userId}"`,
          sort: '-start_date',
          limit: 1,
        }).catch(() => []),
      ]);

      setAssignments(assignmentRecords as unknown as Assignment[]);
      setAttendance(attendanceRecords as unknown as Attendance[]);
      setCourses(courseRecords as unknown as Course[]);
      setPortfolio(portfolioRecords as unknown as PortfolioItem[]);

      const years = schoolYearRecords as unknown as SchoolYear[];
      if (years[0]) {
        setSchoolYear(years[0]);
        const breakRecords = await pb.collection('school_breaks').getFullList({
          filter: `school_year = "${years[0].id}"`,
        }).catch(() => []);
        setBreaks(breakRecords as unknown as SchoolBreak[]);
      }
    } catch (error) {
      console.error('Morning plan load error:', error);
      setToast({ message: 'Could not load the morning plan.', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [pb]);

  useEffect(() => {
    if (!pb.authStore.isValid) {
      router.push('/');
      return;
    }
    loadData();
  }, [loadData, pb.authStore.isValid, router]);

  const plans = useMemo<ChildPlan[]>(() => {
    const todayAssignments = assignments.filter((assignment) => assignmentBucket(assignment, todayIso) === 'today');
    const overdueAssignments = assignments.filter((assignment) => assignmentBucket(assignment, todayIso) === 'overdue');
    const upcomingAssignments = assignments.filter((assignment) => assignmentBucket(assignment, todayIso) === 'upcoming');

    return kids.map((child) => {
      const childAssignments = (items: Assignment[]) => items.filter((assignment) => assignment.child === child.id);
      const childCourses = courses.filter((course) => course.child === child.id);
      const attendanceLogged = attendance.some((record) => record.child === child.id && dateOnly(record.date) === todayIso);
      const recentEvidence = portfolio.filter((item) => item.child === child.id && dateOnly(item.date) >= dateOnly(new Date(Date.now() - 14 * MS_PER_DAY).toISOString())).length;

      const courseFocus = childCourses
        .map<CourseFocus>((course) => {
          if (schoolYear) {
            const mapping = getExpectedLesson(course, schoolYear, breaks);
            if (mapping.status === 'behind') {
              return { course, label: `lesson ${course.current_lesson} · ${mapping.diff} behind`, status: 'behind' };
            }
          }

          if (courseActiveToday(course)) {
            return { course, label: `lesson ${course.current_lesson}`, status: 'active' };
          }

          return { course, label: `next: lesson ${course.current_lesson}`, status: 'next' };
        })
        .sort((a, b) => {
          const priority = { behind: 0, active: 1, next: 2 };
          return priority[a.status] - priority[b.status];
        })
        .slice(0, 4);

      const childOverdue = childAssignments(overdueAssignments);
      const childToday = childAssignments(todayAssignments);
      const childUpcoming = childAssignments(upcomingAssignments).slice(0, 3);
      const blockers: string[] = [];

      if (!attendanceLogged) blockers.push('attendance not logged');
      if (childOverdue.length > 0) blockers.push(`${childOverdue.length} overdue assignment${childOverdue.length === 1 ? '' : 's'}`);
      if (recentEvidence === 0) blockers.push('no portfolio evidence in the last 14 days');
      if (courseFocus.some((focus) => focus.status === 'behind')) blockers.push('course pacing needs attention');

      return {
        child,
        attendanceLogged,
        overdueAssignments: childOverdue,
        todayAssignments: childToday,
        upcomingAssignments: childUpcoming,
        lessonFocus: courseFocus,
        evidenceCount: recentEvidence,
        blockers,
      };
    });
  }, [assignments, attendance, breaks, courses, kids, portfolio, schoolYear, todayIso]);

  const totals = useMemo(() => {
    const overdue = plans.reduce((sum, plan) => sum + plan.overdueAssignments.length, 0);
    const today = plans.reduce((sum, plan) => sum + plan.todayAssignments.length, 0);
    const missingAttendance = plans.filter((plan) => !plan.attendanceLogged).length;
    const evidenceGaps = plans.filter((plan) => plan.evidenceCount === 0).length;
    return { overdue, today, missingAttendance, evidenceGaps };
  }, [plans]);

  const copyPlan = async () => {
    try {
      await navigator.clipboard.writeText(buildCopyText(plans, devotional, todayIso));
      setToast({ message: 'Morning plan copied.', type: 'success' });
    } catch {
      setToast({ message: 'Copy failed. Try print instead.', type: 'error' });
    }
  };

  const handleLogout = () => {
    pb.authStore.clear();
    router.push('/');
  };

  if (loading) {
    return <LoadingScreen message="Building the morning plan..." />;
  }

  return (
    <>
      <Header showLogout onLogout={handleLogout} />
      <main className="max-w-7xl mx-auto my-8 sm:my-12 px-4 sm:px-8 pb-20 animate-fade-in">
        <section className="mb-8 overflow-hidden rounded-[2rem] border border-border bg-primary-dark text-white shadow-[0_30px_70px_-45px_rgba(45,59,41,.9)]">
          <div className="grid gap-8 p-6 sm:p-10 lg:grid-cols-[1.2fr_.8fr] lg:p-12">
            <div>
              <p className="mb-3 text-xs font-black uppercase tracking-[0.28em] text-white/55">Morning command sheet</p>
              <h2 className="font-display text-4xl font-extrabold tracking-tight sm:text-6xl">Start school without digging.</h2>
              <p className="mt-4 max-w-2xl text-base font-medium leading-7 text-white/72">
                One printable plan for devotional, attendance, urgent assignments, course pacing, and portfolio evidence.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Button onClick={copyPlan} className="bg-white text-primary-dark hover:bg-accent-soft">Copy family plan</Button>
                <Button variant="outline" onClick={() => window.print()} className="border-white/30 bg-white/10 text-white hover:bg-white/20">Print</Button>
                <Button variant="outline" onClick={loadData} className="border-white/30 bg-white/10 text-white hover:bg-white/20">Refresh</Button>
              </div>
            </div>
            <Card className="bg-white/10 p-6 text-white border-white/15 shadow-none backdrop-blur" accent="mustard">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-white/50">LDS devotional</p>
              <h3 className="mt-3 text-2xl font-black">{devotional.theme}</h3>
              <p className="mt-1 text-sm font-bold text-accent-soft">{devotional.reference}</p>
              <p className="mt-4 text-sm leading-6 text-white/75">{devotional.opener}</p>
              <div className="mt-5 rounded-2xl bg-white/10 p-4">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-white/45">Ask</p>
                <p className="mt-1 text-sm font-semibold text-white">{devotional.question}</p>
              </div>
              <p className="mt-4 text-sm text-white/70"><span className="font-black text-white">Action:</span> {devotional.action}</p>
            </Card>
          </div>
        </section>

        <section className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="p-5" accent={totals.overdue ? 'terracotta' : 'sage'}>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-text-muted">Overdue</p>
            <p className="mt-2 text-4xl font-black text-text">{totals.overdue}</p>
            <p className="text-sm text-text-muted">Assignments needing rescue</p>
          </Card>
          <Card className="p-5" accent="mustard">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-text-muted">Due today</p>
            <p className="mt-2 text-4xl font-black text-text">{totals.today}</p>
            <p className="text-sm text-text-muted">Work to protect first</p>
          </Card>
          <Card className="p-5" accent={totals.missingAttendance ? 'terracotta' : 'sage'}>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-text-muted">Attendance</p>
            <p className="mt-2 text-4xl font-black text-text">{plans.length - totals.missingAttendance}/{plans.length}</p>
            <p className="text-sm text-text-muted">Children logged today</p>
          </Card>
          <Card className="p-5" accent={totals.evidenceGaps ? 'terracotta' : 'sage'}>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-text-muted">Evidence gaps</p>
            <p className="mt-2 text-4xl font-black text-text">{totals.evidenceGaps}</p>
            <p className="text-sm text-text-muted">Need a portfolio artifact</p>
          </Card>
        </section>

        {plans.length === 0 ? (
          <Card className="text-center" accent="sage">
            <h3 className="text-2xl font-black">No kids are set up yet.</h3>
            <p className="mt-2 text-text-muted">Add children first, then this page becomes the daily launch sheet.</p>
            <Link href="/manage-kids" className="mt-6 inline-flex rounded-2xl bg-primary px-5 py-3 text-sm font-black text-white hover:bg-primary-light">
              Add kids
            </Link>
          </Card>
        ) : (
          <section className="grid gap-6 lg:grid-cols-2">
            {plans.map((plan) => (
              <Card key={plan.child.id} className="p-6 sm:p-8" accent={plan.blockers.length ? 'terracotta' : 'sage'} hoverable>
                <div className="mb-5 flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-text-muted">Today for</p>
                    <h3 className="font-display text-3xl font-extrabold tracking-tight">{plan.child.name}</h3>
                    <p className="text-sm text-text-muted">Grade {plan.child.grade || 'not set'} · age {plan.child.age || '—'}</p>
                  </div>
                  <span className={`rounded-full border px-3 py-1 text-xs font-black ${plan.attendanceLogged ? 'border-primary/20 bg-primary/10 text-primary' : 'border-red-200 bg-red-50 text-red-700'}`}>
                    {plan.attendanceLogged ? 'Attendance logged' : 'Log attendance'}
                  </span>
                </div>

                <div className="space-y-5">
                  <div>
                    <h4 className="mb-2 text-sm font-black uppercase tracking-[0.16em] text-text-muted">Assignments</h4>
                    {[...plan.overdueAssignments, ...plan.todayAssignments, ...plan.upcomingAssignments].length > 0 ? (
                      <div className="space-y-2">
                        {[...plan.overdueAssignments, ...plan.todayAssignments, ...plan.upcomingAssignments].slice(0, 5).map((assignment) => {
                          const bucket = assignmentBucket(assignment, todayIso);
                          return (
                            <Link key={assignment.id} href="/assignments" className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-bg-alt/60 p-3 hover:border-primary-light hover:bg-white">
                              <span className="min-w-0">
                                <span className="block truncate text-sm font-black text-text">{assignment.title}</span>
                                <span className="block text-xs text-text-muted">{assignment.subject || 'General'} · {formatDate(assignment.due_date)}</span>
                              </span>
                              <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-black ${bucket === 'overdue' ? 'bg-red-100 text-red-700' : bucket === 'today' ? 'bg-accent-soft text-primary-dark' : 'bg-primary/10 text-primary'}`}>
                                {bucket === 'overdue' ? 'Overdue' : bucket === 'today' ? 'Today' : 'Soon'}
                              </span>
                            </Link>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="rounded-2xl bg-primary/10 p-3 text-sm font-semibold text-primary">No urgent assignments. Protect a focused lesson block.</p>
                    )}
                  </div>

                  <div>
                    <h4 className="mb-2 text-sm font-black uppercase tracking-[0.16em] text-text-muted">Lesson focus</h4>
                    {plan.lessonFocus.length > 0 ? (
                      <div className="grid gap-2 sm:grid-cols-2">
                        {plan.lessonFocus.map(({ course, label, status }) => (
                          <div key={course.id} className="rounded-2xl border border-border bg-white p-3">
                            <p className="truncate text-sm font-black text-text">{course.name}</p>
                            <p className={`text-xs font-bold ${status === 'behind' ? 'text-red-700' : 'text-text-muted'}`}>{label}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="rounded-2xl bg-bg-alt p-3 text-sm text-text-muted">No courses found. Use assignments or reading as the anchor.</p>
                    )}
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <Link href="/attendance" className="rounded-2xl border border-border bg-white p-4 hover:border-primary-light">
                      <p className="text-xs font-black uppercase tracking-[0.16em] text-text-muted">Record</p>
                      <p className="mt-1 text-sm font-black text-text">{plan.attendanceLogged ? 'Attendance is handled' : 'Log attendance now'}</p>
                    </Link>
                    <Link href="/portfolio" className="rounded-2xl border border-border bg-white p-4 hover:border-primary-light">
                      <p className="text-xs font-black uppercase tracking-[0.16em] text-text-muted">Portfolio</p>
                      <p className="mt-1 text-sm font-black text-text">{plan.evidenceCount ? `${plan.evidenceCount} recent artifact${plan.evidenceCount === 1 ? '' : 's'}` : 'Capture one artifact today'}</p>
                    </Link>
                  </div>

                  {plan.blockers.length > 0 && (
                    <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                      <p className="font-black">Watch before the day gets away:</p>
                      <ul className="mt-2 list-disc space-y-1 pl-5">
                        {plan.blockers.map((blocker) => <li key={blocker}>{blocker}</li>)}
                      </ul>
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </section>
        )}
      </main>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </>
  );
}
