'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getPocketBase } from '@/lib/pocketbase';
import { getExpectedLesson } from '@/lib/calendar-utils';
import { Child, Course, SchoolBreak, SchoolYear } from '@/lib/types';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { LoadingScreen } from '@/components/ui/Spinner';

const DAY_MAP: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

const DEFAULT_ACTIVE_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

type CoursePace = {
  child: Child;
  course: Course;
  expectedLesson: number;
  status: 'ahead' | 'behind' | 'on-track';
  lessonGap: number;
  completedLessons: number;
  remainingLessons: number;
  remainingMeetings: number;
  targetPerWeek: number;
  risk: 'complete' | 'safe' | 'watch' | 'critical';
  activeDaysLabel: string;
  finishDateLabel: string;
};

function toDateOnly(value: string): Date {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function formatShortDate(value: Date): string {
  return value.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function parseActiveDays(activeDays?: string): string[] {
  if (!activeDays) return DEFAULT_ACTIVE_DAYS;

  const cleaned = activeDays.trim();
  if (!cleaned) return DEFAULT_ACTIVE_DAYS;

  if (cleaned.startsWith('[') && cleaned.endsWith(']')) {
    try {
      const parsed = JSON.parse(cleaned) as unknown;
      if (Array.isArray(parsed)) {
        const days = parsed.filter((day): day is string => typeof day === 'string' && day.trim().length > 0);
        return days.length > 0 ? days : DEFAULT_ACTIVE_DAYS;
      }
    } catch {
      // Fall back to comma parsing below.
    }
  }

  const days = cleaned.split(',').map(day => day.trim()).filter(Boolean);
  return days.length > 0 ? days : DEFAULT_ACTIVE_DAYS;
}

function isDuringBreak(date: Date, breaks: SchoolBreak[]): boolean {
  return breaks.some(schoolBreak => {
    const start = toDateOnly(schoolBreak.start_date);
    const end = toDateOnly(schoolBreak.end_date);
    return date >= start && date <= end;
  });
}

function countMeetingsBetween(start: Date, end: Date, activeDays: string[], breaks: SchoolBreak[]): number {
  if (end < start) return 0;

  const activeDayIndexes = activeDays
    .map(day => DAY_MAP[day])
    .filter((dayIndex): dayIndex is number => dayIndex !== undefined);

  if (activeDayIndexes.length === 0) return 0;

  let meetings = 0;
  for (const cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
    if (activeDayIndexes.includes(cursor.getDay()) && !isDuringBreak(cursor, breaks)) {
      meetings += 1;
    }
  }

  return meetings;
}

function estimateFinishDate(start: Date, activeDays: string[], breaks: SchoolBreak[], lessonsNeeded: number): string {
  if (lessonsNeeded <= 0) return 'Done';

  const activeDayIndexes = activeDays
    .map(day => DAY_MAP[day])
    .filter((dayIndex): dayIndex is number => dayIndex !== undefined);

  if (activeDayIndexes.length === 0) return 'No active days';

  let completedMeetings = 0;
  const cursor = new Date(start);

  for (let safety = 0; safety < 730; safety += 1) {
    if (activeDayIndexes.includes(cursor.getDay()) && !isDuringBreak(cursor, breaks)) {
      completedMeetings += 1;
      if (completedMeetings >= lessonsNeeded) return formatShortDate(cursor);
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return '2+ years out';
}

function buildClipboardSummary(rows: CoursePace[], schoolYear: SchoolYear | null): string {
  const headline = schoolYear
    ? `Pace check for ${schoolYear.name} (${formatShortDate(toDateOnly(schoolYear.start_date))}–${formatShortDate(toDateOnly(schoolYear.end_date))})`
    : 'Pace check';

  const actionRows = rows
    .filter(row => row.risk === 'critical' || row.risk === 'watch' || row.status === 'behind')
    .sort((a, b) => b.lessonGap - a.lessonGap)
    .slice(0, 8);

  if (actionRows.length === 0) {
    return `${headline}\n\nAll active courses are on pace or completed. Keep logging lessons and portfolio evidence.`;
  }

  return [
    headline,
    '',
    'Courses needing attention:',
    ...actionRows.map(row => (
      `- ${row.child.name}: ${row.course.name} — ${row.lessonGap} lesson${row.lessonGap === 1 ? '' : 's'} behind; ` +
      `${row.remainingLessons} left; needs ${row.targetPerWeek.toFixed(1)}/week through ${row.finishDateLabel}.`
    )),
  ].join('\n');
}

export default function PacePage() {
  const router = useRouter();
  const pb = getPocketBase();

  const [loading, setLoading] = useState(true);
  const [kids, setKids] = useState<Child[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [schoolYear, setSchoolYear] = useState<SchoolYear | null>(null);
  const [breaks, setBreaks] = useState<SchoolBreak[]>([]);
  const [copied, setCopied] = useState(false);

  const loadPaceData = useCallback(async () => {
    try {
      const userId = pb.authStore.model?.id;
      if (!userId) return;

      const childRecords = await pb.collection('children').getFullList({
        filter: `user = "${userId}"`,
        sort: 'name',
      });
      const typedKids = childRecords as unknown as Child[];
      setKids(typedKids);

      const courseFilter = typedKids.map(kid => `child = "${kid.id}"`).join(' || ');
      const courseRecords = courseFilter
        ? await pb.collection('courses').getFullList({ filter: courseFilter, sort: 'name' }).catch(() => [])
        : [];
      setCourses(courseRecords as unknown as Course[]);

      const yearRecords = await pb.collection('school_years').getFullList({
        filter: `user = "${userId}"`,
        sort: '-start_date',
        limit: 1,
      }).catch(() => []);

      if (yearRecords.length > 0) {
        const currentSchoolYear = yearRecords[0] as unknown as SchoolYear;
        setSchoolYear(currentSchoolYear);

        const breakRecords = await pb.collection('school_breaks').getFullList({
          filter: `school_year = "${currentSchoolYear.id}"`,
          sort: 'start_date',
        }).catch(() => []);
        setBreaks(breakRecords as unknown as SchoolBreak[]);
      }
    } catch (error) {
      console.error('Pace data load error:', error);
    } finally {
      setLoading(false);
    }
  }, [pb]);

  useEffect(() => {
    if (!pb.authStore.isValid) {
      router.push('/');
      return;
    }

    loadPaceData();
  }, [loadPaceData, pb.authStore.isValid, router]);

  const paceRows = useMemo<CoursePace[]>(() => {
    if (!schoolYear) return [];

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const schoolEnd = toDateOnly(schoolYear.end_date);
    const planningStart = today > schoolEnd ? schoolEnd : today;

    return courses.map(course => {
      const child = kids.find(kid => kid.id === course.child);
      const activeDays = parseActiveDays(course.active_days);
      const expected = getExpectedLesson(course, schoolYear, breaks);
      const completedLessons = Math.min(Math.max(course.current_lesson - 1, 0), course.total_lessons);
      const remainingLessons = Math.max(course.total_lessons - completedLessons, 0);
      const remainingMeetings = countMeetingsBetween(planningStart, schoolEnd, activeDays, breaks);
      const targetPerWeek = remainingMeetings > 0 ? (remainingLessons / remainingMeetings) * activeDays.length : remainingLessons;
      const finishDateLabel = estimateFinishDate(planningStart, activeDays, breaks, remainingLessons);
      const lessonGap = expected.status === 'behind' ? expected.diff : 0;

      let risk: CoursePace['risk'] = 'safe';
      if (remainingLessons === 0) risk = 'complete';
      else if (remainingMeetings === 0 || targetPerWeek > activeDays.length) risk = 'critical';
      else if (lessonGap >= 5 || targetPerWeek > Math.max(1, activeDays.length * 0.85)) risk = 'critical';
      else if (lessonGap >= 2 || targetPerWeek > Math.max(1, activeDays.length * 0.65)) risk = 'watch';

      return {
        child: child ?? { id: course.child, user: '', name: 'Unknown student', age: 0, created: '', updated: '' },
        course,
        expectedLesson: expected.expectedLesson,
        status: expected.status,
        lessonGap,
        completedLessons,
        remainingLessons,
        remainingMeetings,
        targetPerWeek,
        risk,
        activeDaysLabel: activeDays.join(', '),
        finishDateLabel,
      };
    }).sort((a, b) => {
      const riskWeight = { critical: 0, watch: 1, safe: 2, complete: 3 } as const;
      return riskWeight[a.risk] - riskWeight[b.risk] || b.lessonGap - a.lessonGap || a.child.name.localeCompare(b.child.name);
    });
  }, [breaks, courses, kids, schoolYear]);

  const totals = useMemo(() => {
    const active = paceRows.filter(row => row.risk !== 'complete');
    return {
      courses: paceRows.length,
      behind: paceRows.filter(row => row.status === 'behind').length,
      watch: paceRows.filter(row => row.risk === 'watch').length,
      critical: paceRows.filter(row => row.risk === 'critical').length,
      remainingLessons: active.reduce((sum, row) => sum + row.remainingLessons, 0),
    };
  }, [paceRows]);

  const copySummary = async () => {
    const text = buildClipboardSummary(paceRows, schoolYear);
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleLogout = () => {
    pb.authStore.clear();
    router.push('/');
  };

  if (loading) return <LoadingScreen message="Checking course pace..." />;

  return (
    <>
      <Header showLogout onLogout={handleLogout} />
      <main className="max-w-7xl mx-auto my-12 px-4 sm:px-8 pb-20 animate-fade-in">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 mb-10">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.3em] text-secondary mb-3">Finish-line planning</p>
            <h2 className="font-display text-4xl sm:text-6xl font-extrabold tracking-tight mb-3">Course Pace Coach</h2>
            <p className="text-text-muted max-w-2xl">
              See which courses are drifting, how many lessons are left, and the weekly pace needed to finish before your school year ends.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" onClick={() => router.push('/dashboard')}>← Dashboard</Button>
            <Button onClick={copySummary} disabled={paceRows.length === 0 || !schoolYear}>
              {copied ? '✓ Copied' : 'Copy action summary'}
            </Button>
          </div>
        </div>

        {!schoolYear ? (
          <Card className="text-center py-16">
            <div className="text-5xl mb-4">🗓️</div>
            <h3 className="font-display text-3xl font-bold mb-3">Set up a school year first</h3>
            <p className="text-text-muted max-w-xl mx-auto mb-8">
              The pace coach needs a start date, end date, and breaks so it can compare today&apos;s course progress against the finish line.
            </p>
            <Button onClick={() => router.push('/calendar')}>Open Calendar Setup</Button>
          </Card>
        ) : kids.length === 0 ? (
          <Card className="text-center py-16">
            <div className="text-5xl mb-4">🌱</div>
            <h3 className="font-display text-3xl font-bold mb-3">Add students to start planning</h3>
            <p className="text-text-muted mb-8">Once students and courses exist, this page becomes the weekly pace check.</p>
            <Button onClick={() => router.push('/manage-kids')}>Add Students</Button>
          </Card>
        ) : courses.length === 0 ? (
          <Card className="text-center py-16">
            <div className="text-5xl mb-4">📚</div>
            <h3 className="font-display text-3xl font-bold mb-3">No courses found yet</h3>
            <p className="text-text-muted mb-8">Add courses with total lessons and active days so Village can calculate your plan.</p>
            <Button onClick={() => router.push('/manage-kids')}>Manage Courses</Button>
          </Card>
        ) : (
          <>
            <Card className="mb-8 p-6 md:p-8 border-primary/20 bg-primary/5">
              <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
                <div>
                  <div className="text-xs uppercase tracking-widest text-text-muted font-bold">School year</div>
                  <div className="font-display text-xl font-bold text-primary">{schoolYear.name}</div>
                  <div className="text-sm text-text-muted">
                    {formatShortDate(toDateOnly(schoolYear.start_date))} – {formatShortDate(toDateOnly(schoolYear.end_date))}
                  </div>
                </div>
                <div className="bg-white rounded-2xl border border-border p-4">
                  <div className="text-3xl font-display font-bold text-primary">{totals.courses}</div>
                  <div className="text-xs font-bold text-text-muted uppercase tracking-wider">Tracked courses</div>
                </div>
                <div className="bg-white rounded-2xl border border-border p-4">
                  <div className="text-3xl font-display font-bold text-secondary">{totals.remainingLessons}</div>
                  <div className="text-xs font-bold text-text-muted uppercase tracking-wider">Lessons left</div>
                </div>
                <div className="bg-white rounded-2xl border border-border p-4">
                  <div className="text-3xl font-display font-bold text-amber-700">{totals.watch}</div>
                  <div className="text-xs font-bold text-text-muted uppercase tracking-wider">Watch list</div>
                </div>
                <div className="bg-white rounded-2xl border border-border p-4">
                  <div className="text-3xl font-display font-bold text-red-700">{totals.critical}</div>
                  <div className="text-xs font-bold text-text-muted uppercase tracking-wider">Critical</div>
                </div>
              </div>
            </Card>

            <div className="grid gap-5">
              {paceRows.map(row => {
                const percent = row.course.total_lessons > 0
                  ? Math.min(100, Math.round((row.completedLessons / row.course.total_lessons) * 100))
                  : 0;
                const statusStyles = {
                  complete: 'bg-green-50 text-green-800 border-green-200',
                  safe: 'bg-primary/10 text-primary border-primary/20',
                  watch: 'bg-amber-50 text-amber-800 border-amber-200',
                  critical: 'bg-red-50 text-red-800 border-red-200',
                };
                const statusLabel = row.risk === 'complete'
                  ? 'Complete'
                  : row.risk === 'critical'
                    ? 'Needs attention'
                    : row.risk === 'watch'
                      ? 'Watch pace'
                      : 'On pace';

                return (
                  <Card key={row.course.id} className="p-5 md:p-7">
                    <div className="flex flex-col lg:flex-row lg:items-center gap-6">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-3 mb-3">
                          <span className="text-sm font-bold text-text-muted">{row.child.name}</span>
                          <span className={`px-3 py-1 rounded-full border text-xs font-bold uppercase tracking-wider ${statusStyles[row.risk]}`}>
                            {statusLabel}
                          </span>
                          {row.status === 'behind' && (
                            <span className="px-3 py-1 rounded-full bg-red-50 text-red-700 text-xs font-bold">
                              {row.lessonGap} lesson{row.lessonGap === 1 ? '' : 's'} behind
                            </span>
                          )}
                        </div>
                        <h3 className="font-display text-2xl font-bold text-primary mb-3">{row.course.name}</h3>
                        <div className="h-3 bg-bg-alt rounded-full overflow-hidden border border-border">
                          <div className="h-full bg-primary rounded-full" style={{ width: `${percent}%` }} />
                        </div>
                        <div className="mt-2 text-sm text-text-muted">
                          Lesson {Math.min(row.course.current_lesson, row.course.total_lessons)} of {row.course.total_lessons} • expected lesson {row.expectedLesson}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 lg:w-[560px] gap-3">
                        <div className="bg-bg-alt rounded-2xl p-4 border border-border">
                          <div className="text-2xl font-display font-bold text-primary">{row.remainingLessons}</div>
                          <div className="text-xs text-text-muted font-bold uppercase">Lessons left</div>
                        </div>
                        <div className="bg-bg-alt rounded-2xl p-4 border border-border">
                          <div className="text-2xl font-display font-bold text-primary">{row.targetPerWeek.toFixed(1)}</div>
                          <div className="text-xs text-text-muted font-bold uppercase">Per week</div>
                        </div>
                        <div className="bg-bg-alt rounded-2xl p-4 border border-border">
                          <div className="text-lg font-display font-bold text-primary">{row.finishDateLabel}</div>
                          <div className="text-xs text-text-muted font-bold uppercase">Est. finish</div>
                        </div>
                        <div className="bg-bg-alt rounded-2xl p-4 border border-border">
                          <div className="text-sm font-bold text-primary">{row.activeDaysLabel}</div>
                          <div className="text-xs text-text-muted font-bold uppercase">Active days</div>
                        </div>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </>
        )}
      </main>
    </>
  );
}
