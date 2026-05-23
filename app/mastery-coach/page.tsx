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

type WindowKey = '7' | '14' | '30' | '90';

interface ChildLearningData {
  child: Child;
  courses: Course[];
  assignments: Assignment[];
  attendance: Attendance[];
  portfolio: PortfolioItem[];
}

interface CoachSignal {
  label: string;
  value: string;
  tone: 'strong' | 'steady' | 'watch' | 'risk';
}

interface CoachCard {
  child: Child;
  priority: 'Ready' | 'Watch' | 'Intervene';
  score: number;
  summary: string;
  signals: CoachSignal[];
  strengths: string[];
  focusAreas: string[];
  nextActions: string[];
  evidencePrompts: string[];
}

const WINDOW_OPTIONS: { value: WindowKey; label: string }[] = [
  { value: '7', label: 'Last 7 days' },
  { value: '14', label: 'Last 14 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' }
];

const toneClasses = {
  strong: 'bg-green-100 text-green-800 border-green-200',
  steady: 'bg-blue-100 text-blue-800 border-blue-200',
  watch: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  risk: 'bg-red-100 text-red-800 border-red-200'
};

const priorityClasses = {
  Ready: 'bg-green-100 text-green-800 border-green-200',
  Watch: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  Intervene: 'bg-red-100 text-red-800 border-red-200'
};

function dateOnly(date: Date): string {
  return date.toISOString().split('T')[0];
}

function daysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return dateOnly(date);
}

function parseDate(value?: string): number {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function isComplete(assignment: Assignment): boolean {
  return assignment.status === 'completed' || assignment.status === 'Graded';
}

function isPending(assignment: Assignment): boolean {
  return assignment.status === 'pending' || assignment.status === 'in_progress' || (assignment.status as string) === 'Pending';
}

function subjectName(value?: string): string {
  return value?.trim() || 'General';
}

function uniqueList(items: string[], fallback: string): string[] {
  const unique = Array.from(new Set(items.filter(Boolean)));
  return unique.length > 0 ? unique.slice(0, 3) : [fallback];
}

function buildCoachCard(data: ChildLearningData): CoachCard {
  const completedAssignments = data.assignments.filter(isComplete);
  const pendingAssignments = data.assignments.filter(isPending);
  const overdueAssignments = pendingAssignments.filter((assignment) => (
    assignment.due_date ? parseDate(assignment.due_date) < Date.now() : false
  ));
  const gradedAssignments = data.assignments.filter((assignment) => typeof assignment.score === 'number');
  const averageScore = gradedAssignments.length > 0
    ? Math.round(gradedAssignments.reduce((sum, assignment) => sum + (assignment.score || 0), 0) / gradedAssignments.length)
    : null;
  const attendanceDays = data.attendance.length;
  const presentDays = data.attendance.filter((record) => record.status === 'present' || record.status === 'half-day').length;
  const attendanceRate = attendanceDays > 0 ? Math.round((presentDays / attendanceDays) * 100) : null;
  const portfolioCount = data.portfolio.length;
  const activeCourses = data.courses.filter((course) => course.current_lesson <= course.total_lessons);
  const courseProgress = data.courses.length > 0
    ? Math.round(data.courses.reduce((sum, course) => {
        const completed = Math.max(0, Math.min(course.current_lesson - 1, course.total_lessons));
        return sum + (course.total_lessons > 0 ? (completed / course.total_lessons) * 100 : 0);
      }, 0) / data.courses.length)
    : null;

  let score = 100;
  score -= overdueAssignments.length * 15;
  if (averageScore !== null && averageScore < 80) score -= 18;
  if (attendanceRate !== null && attendanceRate < 85) score -= 14;
  if (portfolioCount === 0) score -= 10;
  if (pendingAssignments.length > completedAssignments.length && pendingAssignments.length > 2) score -= 8;
  if (activeCourses.length === 0 && data.courses.length > 0) score += 6;
  score = Math.max(0, Math.min(100, score));

  const priority: CoachCard['priority'] = score < 68 || overdueAssignments.length >= 2
    ? 'Intervene'
    : score < 84 || overdueAssignments.length > 0
      ? 'Watch'
      : 'Ready';

  const weakestSubjects = uniqueList(
    gradedAssignments
      .filter((assignment) => (assignment.score || 0) < 80)
      .sort((a, b) => (a.score || 0) - (b.score || 0))
      .map((assignment) => subjectName(assignment.subject)),
    'Pick one recent lesson and ask for a short explanation.'
  );

  const strongestSubjects = uniqueList(
    gradedAssignments
      .filter((assignment) => (assignment.score || 0) >= 90)
      .sort((a, b) => (b.score || 0) - (a.score || 0))
      .map((assignment) => subjectName(assignment.subject)),
    completedAssignments.length > 0 ? 'Finishing assigned work' : 'Showing up to the learning routine'
  );

  const focusAreas = [
    ...overdueAssignments.slice(0, 2).map((assignment) => 'Finish ' + assignment.title),
    ...(averageScore !== null && averageScore < 80 ? weakestSubjects.map((subject) => 'Review ' + subject) : []),
    ...(portfolioCount === 0 ? ['Capture one portfolio artifact'] : [])
  ];

  const nextActions = uniqueList([
    overdueAssignments[0] ? 'Start with ' + overdueAssignments[0].title + ' and decide: finish, reschedule, or replace it.' : '',
    averageScore !== null && averageScore < 80 ? 'Run a 10-minute oral check in ' + weakestSubjects[0] + ' before assigning more work.' : '',
    attendanceRate !== null && attendanceRate < 85 ? 'Mark the missing attendance days while the week is still fresh.' : '',
    portfolioCount === 0 ? 'Add one photo, worksheet, or narration sample to the portfolio today.' : '',
    pendingAssignments.length > 3 ? 'Trim the open assignment list to the three tasks that matter this week.' : '',
    activeCourses.length > 0 ? 'Advance one lesson in ' + activeCourses[0].name + ' and log the outcome.' : ''
  ], 'Ask for a teach-back: "Show me what you learned and where you got stuck."');

  const evidencePrompts = uniqueList([
    strongestSubjects[0] ? 'Record a 60-second explanation of the strongest recent topic: ' + strongestSubjects[0] + '.' : '',
    weakestSubjects[0] && !weakestSubjects[0].startsWith('Pick one') ? 'Save before/after work for ' + weakestSubjects[0] + ' so progress is visible.' : '',
    completedAssignments[0] ? 'Attach the finished ' + completedAssignments[0].title + ' work sample to the portfolio.' : '',
    'Take one photo of hands-on work, reading notes, or a corrected mistake.'
  ], 'Save one artifact that proves the learning happened.');

  const signals: CoachSignal[] = [
    {
      label: 'Average score',
      value: averageScore === null ? 'No grades' : averageScore + '%',
      tone: averageScore === null ? 'watch' : averageScore >= 88 ? 'strong' : averageScore >= 78 ? 'steady' : 'risk'
    },
    {
      label: 'Open work',
      value: pendingAssignments.length + ' pending',
      tone: pendingAssignments.length === 0 ? 'strong' : pendingAssignments.length <= 3 ? 'steady' : 'watch'
    },
    {
      label: 'Overdue',
      value: String(overdueAssignments.length),
      tone: overdueAssignments.length === 0 ? 'strong' : overdueAssignments.length === 1 ? 'watch' : 'risk'
    },
    {
      label: 'Attendance',
      value: attendanceRate === null ? 'No marks' : attendanceRate + '%',
      tone: attendanceRate === null ? 'watch' : attendanceRate >= 90 ? 'strong' : attendanceRate >= 80 ? 'steady' : 'risk'
    },
    {
      label: 'Evidence',
      value: portfolioCount + ' sample' + (portfolioCount === 1 ? '' : 's'),
      tone: portfolioCount >= 2 ? 'strong' : portfolioCount === 1 ? 'steady' : 'watch'
    },
    {
      label: 'Course pace',
      value: courseProgress === null ? 'No courses' : courseProgress + '%',
      tone: courseProgress === null ? 'watch' : courseProgress >= 70 ? 'strong' : courseProgress >= 35 ? 'steady' : 'watch'
    }
  ];

  const summary = priority === 'Intervene'
    ? data.child.name + ' needs a narrowed plan before more work is added.'
    : priority === 'Watch'
      ? data.child.name + ' is close, but one or two signals need parent attention.'
      : data.child.name + ' has enough momentum for enrichment or a deeper project.';

  return {
    child: data.child,
    priority,
    score,
    summary,
    signals,
    strengths: strongestSubjects,
    focusAreas: uniqueList(focusAreas, 'Choose one skill to verify with a short teach-back.'),
    nextActions,
    evidencePrompts
  };
}

export default function MasteryCoachPage() {
  const router = useRouter();
  const pb = getPocketBase();

  const [loading, setLoading] = useState(true);
  const [windowDays, setWindowDays] = useState<WindowKey>('14');
  const [kids, setKids] = useState<Child[]>([]);
  const [learningData, setLearningData] = useState<ChildLearningData[]>([]);
  const [selectedChildId, setSelectedChildId] = useState('all');
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    if (!pb.authStore.isValid) {
      router.push('/');
      return;
    }

    loadData();
  }, [windowDays]);

  const loadData = async () => {
    setLoading(true);
    setLoadError('');

    try {
      const userId = pb.authStore.model?.id;
      if (!userId) return;

      const start = daysAgo(Number(windowDays));
      const childRecords = await pb.collection('children').getFullList({ filter: 'user = "' + userId + '"', sort: 'name' });
      const typedKids = childRecords as unknown as Child[];

      if (typedKids.length === 0) {
        setKids([]);
        setLearningData([]);
        return;
      }

      const childFilter = typedKids.map((child) => 'child = "' + child.id + '"').join(' || ');
      const [courseRecords, assignmentRecords, attendanceRecords, portfolioRecords] = await Promise.all([
        pb.collection('courses').getFullList({ filter: childFilter, sort: 'name' }).catch(() => []),
        pb.collection('assignments').getFullList({
          filter: 'user = "' + userId + '" && (created >= "' + start + '" || updated >= "' + start + '" || due_date >= "' + start + '")',
          sort: '-updated'
        }).catch(() => []),
        pb.collection('attendance').getFullList({
          filter: 'user = "' + userId + '" && date >= "' + start + '"',
          sort: '-date'
        }).catch(() => []),
        pb.collection('portfolio').getFullList({
          filter: 'user = "' + userId + '" && (date >= "' + start + '" || created >= "' + start + '")',
          sort: '-date'
        }).catch(() => [])
      ]);

      const typedCourses = courseRecords as unknown as Course[];
      const typedAssignments = assignmentRecords as unknown as Assignment[];
      const typedAttendance = attendanceRecords as unknown as Attendance[];
      const typedPortfolio = portfolioRecords as unknown as PortfolioItem[];

      setKids(typedKids);
      setLearningData(typedKids.map((child) => ({
        child,
        courses: typedCourses.filter((course) => course.child === child.id),
        assignments: typedAssignments.filter((assignment) => assignment.child === child.id),
        attendance: typedAttendance.filter((record) => record.child === child.id),
        portfolio: typedPortfolio.filter((item) => item.child === child.id)
      })));
    } catch (error) {
      console.error('Mastery coach load error:', error);
      setLoadError('The coaching queue could not load. Try again in a minute.');
    } finally {
      setLoading(false);
    }
  };

  const coachCards = useMemo(() => {
    return learningData
      .map(buildCoachCard)
      .filter((card) => selectedChildId === 'all' || card.child.id === selectedChildId)
      .sort((a, b) => a.score - b.score);
  }, [learningData, selectedChildId]);

  const familyStats = useMemo(() => {
    const intervene = coachCards.filter((card) => card.priority === 'Intervene').length;
    const watch = coachCards.filter((card) => card.priority === 'Watch').length;
    const ready = coachCards.filter((card) => card.priority === 'Ready').length;
    const average = coachCards.length > 0
      ? Math.round(coachCards.reduce((sum, card) => sum + card.score, 0) / coachCards.length)
      : 0;

    return { intervene, watch, ready, average };
  }, [coachCards]);

  const handleLogout = () => {
    pb.authStore.clear();
    router.push('/');
  };

  if (loading) {
    return <LoadingScreen message="Building mastery coach..." />;
  }

  return (
    <>
      <Header showLogout onLogout={handleLogout} />
      <main className="max-w-7xl mx-auto my-8 sm:my-12 px-4 sm:px-8 pb-20 animate-fade-in">
        <section className="mb-8 sm:mb-12">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-secondary mb-3">Parent command center</p>
              <h2 className="font-display text-4xl sm:text-6xl font-extrabold tracking-tight mb-3">
                Mastery Coach
              </h2>
              <p className="text-text-muted max-w-2xl">
                A weekly coaching queue that turns grades, open work, attendance, course pace, and portfolio evidence into the next parent action.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
              <Select
                label="Time window"
                value={windowDays}
                onChange={(event) => setWindowDays(event.target.value as WindowKey)}
                className="min-w-44"
              >
                {WINDOW_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </Select>
              <Select
                label="Student"
                value={selectedChildId}
                onChange={(event) => setSelectedChildId(event.target.value)}
                className="min-w-44"
              >
                <option value="all">All students</option>
                {kids.map((kid) => (
                  <option key={kid.id} value={kid.id}>{kid.name}</option>
                ))}
              </Select>
              <Button variant="ghost" onClick={() => window.print()} className="mb-3 sm:mb-5">
                Print Queue
              </Button>
            </div>
          </div>
        </section>

        {loadError && (
          <div className="mb-8 rounded-[1.25rem] border border-red-200 bg-red-50 px-5 py-4 text-sm font-semibold text-red-700">
            {loadError}
          </div>
        )}

        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8 sm:mb-12">
          {[
            { label: 'Family score', value: familyStats.average || '--', detail: 'coach index' },
            { label: 'Intervene', value: familyStats.intervene, detail: 'needs narrowing' },
            { label: 'Watch', value: familyStats.watch, detail: 'needs attention' },
            { label: 'Ready', value: familyStats.ready, detail: 'extend learning' }
          ].map((stat) => (
            <div key={stat.label} className="bg-card border border-border rounded-[1.5rem] p-5 sm:p-6 shadow-[0_10px_30px_-10px_rgba(75,99,68,0.12)]">
              <div className="text-xs font-bold uppercase tracking-widest text-text-muted">{stat.label}</div>
              <div className="font-display text-4xl sm:text-5xl font-extrabold text-primary mt-3">{stat.value}</div>
              <div className="text-xs sm:text-sm text-text-muted mt-1">{stat.detail}</div>
            </div>
          ))}
        </section>

        {coachCards.length === 0 ? (
          <Card className="text-center py-16">
            <h3 className="font-display text-3xl font-extrabold mb-3">No coaching data yet</h3>
            <p className="text-text-muted max-w-xl mx-auto mb-8">
              Add children, assignments, attendance, or portfolio samples and the coach will turn them into a weekly action queue.
            </p>
            <Button onClick={() => router.push('/assignments')}>Add Assignments</Button>
          </Card>
        ) : (
          <section className="space-y-6">
            {coachCards.map((card) => (
              <Card key={card.child.id} className="p-5 sm:p-8 md:p-10" accent={card.priority === 'Intervene' ? 'terracotta' : card.priority === 'Watch' ? 'mustard' : 'sage'}>
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6 mb-8">
                  <div>
                    <div className="flex flex-wrap items-center gap-3 mb-3">
                      <h3 className="font-display text-3xl sm:text-4xl font-extrabold m-0">{card.child.name}</h3>
                      <span className={'px-3 py-1 rounded-full border text-xs font-bold uppercase tracking-wide ' + priorityClasses[card.priority]}>
                        {card.priority}
                      </span>
                      {card.child.grade && (
                        <span className="px-3 py-1 rounded-full bg-bg-alt text-primary-dark text-xs font-bold uppercase tracking-wide">
                          {card.child.grade}
                        </span>
                      )}
                    </div>
                    <p className="text-text-muted max-w-2xl">{card.summary}</p>
                  </div>
                  <div className="bg-bg-alt rounded-[1.25rem] px-6 py-5 min-w-36 text-center">
                    <div className="font-display text-5xl font-extrabold text-primary">{card.score}</div>
                    <div className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Coach score</div>
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 mb-8">
                  {card.signals.map((signal) => (
                    <div key={signal.label} className={'rounded-[1rem] border px-4 py-3 ' + toneClasses[signal.tone]}>
                      <div className="text-[10px] font-bold uppercase tracking-widest opacity-80">{signal.label}</div>
                      <div className="font-display text-xl font-extrabold mt-1">{signal.value}</div>
                    </div>
                  ))}
                </div>

                <div className="grid lg:grid-cols-3 gap-6">
                  <div className="bg-bg rounded-[1.25rem] border border-border p-5">
                    <h4 className="font-display text-lg font-extrabold mb-4">Strengths to build on</h4>
                    <ul className="space-y-3 text-sm text-text-muted">
                      {card.strengths.map((item) => (
                        <li key={item} className="flex gap-3">
                          <span className="text-primary font-bold">+</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="bg-bg rounded-[1.25rem] border border-border p-5">
                    <h4 className="font-display text-lg font-extrabold mb-4">Focus this week</h4>
                    <ul className="space-y-3 text-sm text-text-muted">
                      {card.focusAreas.map((item) => (
                        <li key={item} className="flex gap-3">
                          <span className="text-secondary font-bold">!</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="bg-bg rounded-[1.25rem] border border-border p-5">
                    <h4 className="font-display text-lg font-extrabold mb-4">Proof to capture</h4>
                    <ul className="space-y-3 text-sm text-text-muted">
                      {card.evidencePrompts.map((item) => (
                        <li key={item} className="flex gap-3">
                          <span className="text-accent font-bold">#</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="mt-6 rounded-[1.25rem] bg-primary-dark text-white p-5 sm:p-6">
                  <h4 className="font-display text-xl font-extrabold mb-4">Next parent moves</h4>
                  <ol className="grid md:grid-cols-3 gap-4">
                    {card.nextActions.map((action, index) => (
                      <li key={action} className="flex gap-3 text-sm leading-relaxed">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/15 font-bold">{index + 1}</span>
                        <span>{action}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              </Card>
            ))}
          </section>
        )}
      </main>
    </>
  );
}
