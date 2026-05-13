'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getPocketBase } from '@/lib/pocketbase';
import { clearLegacyAuth, getCurrentProfileId } from '@/lib/auth';
import { Assignment, Attendance, Child, Course, SchoolBreak, SchoolYear } from '@/lib/types';
import { getExpectedLesson, LessonMapping } from '@/lib/calendar-utils';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { LoadingScreen } from '@/components/ui/Spinner';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DONE_STATUSES = new Set(['completed', 'graded']);

interface CoursePlan extends Course {
  childName: string;
  expected?: LessonMapping;
  scheduledToday: boolean;
}

interface AssignmentPlan extends Assignment {
  childName: string;
  isOverdue: boolean;
}

function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDisplayDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });
}

function parseActiveDays(activeDays?: string): string[] {
  if (!activeDays) return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

  const cleaned = activeDays.trim();
  if (!cleaned) return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

  if (cleaned.startsWith('[') && cleaned.endsWith(']')) {
    try {
      const parsed = JSON.parse(cleaned);
      if (Array.isArray(parsed)) {
        return parsed.map(String).map(day => day.trim()).filter(Boolean);
      }
    } catch {
      // Fall through to comma parsing.
    }
  }

  return cleaned.split(',').map(day => day.trim()).filter(Boolean);
}

function isDoneStatus(status?: string): boolean {
  return DONE_STATUSES.has((status || '').toLowerCase());
}

function statusBadgeClasses(status: LessonMapping['status']): string {
  if (status === 'ahead') return 'bg-green-100 text-green-700 border-green-200';
  if (status === 'behind') return 'bg-red-100 text-red-700 border-red-200';
  return 'bg-primary/10 text-primary border-primary/20';
}

export default function TodayPage() {
  const router = useRouter();
  const pb = getPocketBase();
  const today = useMemo(() => new Date(), []);
  const todayKey = useMemo(() => formatLocalDate(today), [today]);
  const dayName = DAY_NAMES[today.getDay()];

  const [kids, setKids] = useState<Child[]>([]);
  const [courses, setCourses] = useState<CoursePlan[]>([]);
  const [assignments, setAssignments] = useState<AssignmentPlan[]>([]);
  const [attendanceByChildId, setAttendanceByChildId] = useState<Record<string, Attendance>>({});
  const [loading, setLoading] = useState(true);
  const [savingAttendance, setSavingAttendance] = useState(false);
  const [message, setMessage] = useState('');

  const loadToday = useCallback(async () => {
    setLoading(true);
    setMessage('');

    try {
      const userId = getCurrentProfileId(pb);
      if (!userId) {
        clearLegacyAuth(pb);
        router.push('/');
        return;
      }

      const [childRecords, assignmentRecords, attendanceRecords, yearRecords] = await Promise.all([
        pb.collection('children').getFullList({
          filter: `user = "${userId}"`,
          sort: 'name'
        }),
        pb.collection('assignments').getFullList({
          filter: `user = "${userId}" && due_date <= "${todayKey}"`,
          sort: 'due_date'
        }),
        pb.collection('attendance').getFullList({
          filter: `user = "${userId}" && date = "${todayKey}"`
        }),
        pb.collection('school_years').getFullList({
          filter: `user = "${userId}"`,
          sort: '-start_date',
          limit: 1
        })
      ]);

      const childList = childRecords as unknown as Child[];
      setKids(childList);

      let schoolYear: SchoolYear | null = null;
      let breaks: SchoolBreak[] = [];

      if (yearRecords.length > 0) {
        schoolYear = yearRecords[0] as unknown as SchoolYear;
        try {
          const breakRecords = await pb.collection('school_breaks').getFullList({
            filter: `school_year = "${schoolYear.id}"`
          });
          breaks = breakRecords as unknown as SchoolBreak[];
        } catch (error) {
          console.warn('Could not load school breaks for Today view:', error);
        }
      }

      const courseRecords = await Promise.all(
        childList.map(async (kid) => {
          try {
            const records = await pb.collection('courses').getFullList({
              filter: `child = "${kid.id}"`,
              sort: 'name'
            });

            return (records as unknown as Course[]).map((course) => {
              const activeDays = parseActiveDays(course.active_days);
              const scheduledToday = activeDays.includes(dayName);
              return {
                ...course,
                childName: kid.name,
                scheduledToday,
                expected: schoolYear ? getExpectedLesson(course, schoolYear, breaks) : undefined
              } satisfies CoursePlan;
            });
          } catch (error) {
            console.warn(`Could not load courses for ${kid.name}:`, error);
            return [];
          }
        })
      );

      setCourses(courseRecords.flat());

      const childNameById = new Map(childList.map(kid => [kid.id, kid.name]));
      const openAssignments = (assignmentRecords as unknown as Assignment[])
        .filter(assignment => !isDoneStatus(assignment.status))
        .map(assignment => ({
          ...assignment,
          childName: assignment.child ? childNameById.get(assignment.child) || 'Family' : 'Family',
          isOverdue: Boolean(assignment.due_date && assignment.due_date < todayKey)
        }));

      setAssignments(openAssignments);

      const attendanceMap: Record<string, Attendance> = {};
      (attendanceRecords as unknown as Attendance[]).forEach(record => {
        attendanceMap[record.child] = record;
      });
      setAttendanceByChildId(attendanceMap);
    } catch (error) {
      console.error('Today view load error:', error);
      setMessage('Could not load today’s plan. Try refreshing in a minute.');
    } finally {
      setLoading(false);
    }
  }, [dayName, pb, router, todayKey]);

  useEffect(() => {
    if (!pb.authStore.isValid || !getCurrentProfileId(pb)) {
      clearLegacyAuth(pb);
      router.push('/');
      return;
    }

    loadToday();
  }, [loadToday, pb.authStore.isValid, router]);

  const markEveryonePresent = async () => {
    try {
      setSavingAttendance(true);
      setMessage('');
      const userId = getCurrentProfileId(pb);
      if (!userId) {
        clearLegacyAuth(pb);
        router.push('/');
        return;
      }

      const updates = await Promise.all(kids.map(async (kid) => {
        const existing = attendanceByChildId[kid.id];
        if (existing) {
          return pb.collection('attendance').update(existing.id, { status: 'present' });
        }

        return pb.collection('attendance').create({
          user: userId,
          child: kid.id,
          date: todayKey,
          status: 'present'
        });
      }));

      const nextMap: Record<string, Attendance> = {};
      (updates as unknown as Attendance[]).forEach(record => {
        nextMap[record.child] = record;
      });
      setAttendanceByChildId(nextMap);
      setMessage('Attendance marked present for today.');
    } catch (error) {
      console.error('Attendance update error:', error);
      setMessage('Could not mark attendance. Please try again.');
    } finally {
      setSavingAttendance(false);
    }
  };

  const scheduledCourses = courses.filter(course => (
    course.scheduledToday && course.current_lesson <= course.total_lessons
  ));

  const behindCourses = courses.filter(course => course.expected?.status === 'behind');
  const attendanceComplete = kids.length > 0 && kids.every(kid => attendanceByChildId[kid.id]);
  const overdueAssignments = assignments.filter(assignment => assignment.isOverdue);
  const todaysAssignments = assignments.filter(assignment => !assignment.isOverdue);

  if (loading) {
    return <LoadingScreen message="Building today’s plan..." />;
  }

  return (
    <>
      <Header showLogout onLogout={() => { pb.authStore.clear(); router.push('/'); }} />
      <main className="max-w-7xl mx-auto my-8 sm:my-12 px-4 sm:px-8 pb-20 animate-fade-in print-pack">
        <section className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6 mb-8 sm:mb-12 no-print">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.24em] text-secondary mb-3">Today Pack</p>
            <h2 className="font-display text-4xl sm:text-6xl font-extrabold tracking-tight mb-3">Daily homeschool command sheet</h2>
            <p className="text-text-muted text-base sm:text-lg max-w-2xl">
              One printable page for lessons, due work, attendance, and the parent handoff notes that usually get scattered across tabs.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <Button variant="outline" size="sm" onClick={() => router.push('/dashboard')}>← Dashboard</Button>
            <Button variant="ghost" size="sm" onClick={loadToday}>Refresh</Button>
            <Button size="sm" onClick={() => window.print()}>🖨️ Print Pack</Button>
          </div>
        </section>

        {message && (
          <div className="no-print mb-6 rounded-2xl border border-primary/20 bg-primary/10 px-5 py-3 text-sm font-semibold text-primary">
            {message}
          </div>
        )}

        <section className="print-sheet bg-card border border-border rounded-[2rem] shadow-[0_10px_30px_-10px_rgba(75,99,68,0.12)] p-5 sm:p-8 lg:p-10">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-border pb-6 mb-8">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.24em] text-primary mb-2">Village Today Pack</p>
              <h1 className="font-display text-3xl sm:text-5xl font-extrabold tracking-tight mb-1">{formatDisplayDate(today)}</h1>
              <p className="text-text-muted">Prepared for {kids.length || 'your'} learner{kids.length === 1 ? '' : 's'}.</p>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-2xl bg-bg-alt px-4 py-3">
                <div className="font-display text-2xl font-extrabold text-primary">{scheduledCourses.length}</div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Lessons</div>
              </div>
              <div className="rounded-2xl bg-bg-alt px-4 py-3">
                <div className="font-display text-2xl font-extrabold text-secondary">{assignments.length}</div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Due/Open</div>
              </div>
              <div className="rounded-2xl bg-bg-alt px-4 py-3">
                <div className="font-display text-2xl font-extrabold text-accent">{behindCourses.length}</div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Behind</div>
              </div>
            </div>
          </div>

          {kids.length === 0 ? (
            <Card className="text-center py-12">
              <p className="text-text-muted text-lg mb-6">No children are set up yet.</p>
              <Button onClick={() => router.push('/manage-kids')}>Add Children</Button>
            </Card>
          ) : (
            <div className="grid lg:grid-cols-[1.45fr_0.85fr] gap-8">
              <div className="space-y-8">
                <section>
                  <div className="flex items-center justify-between gap-4 mb-4">
                    <h3 className="font-serif italic text-2xl text-primary mb-0">Lesson run list</h3>
                    <span className="text-xs font-bold uppercase tracking-wider text-text-muted">Check off as you go</span>
                  </div>
                  <div className="space-y-3">
                    {scheduledCourses.length > 0 ? scheduledCourses.map(course => {
                      const nextLesson = Math.min(course.current_lesson, course.total_lessons);
                      return (
                        <div key={course.id} className="rounded-2xl border border-border p-4 sm:p-5 break-inside-avoid">
                          <div className="flex gap-4 items-start">
                            <div className="mt-1 h-5 w-5 rounded-md border-2 border-primary/50 shrink-0" aria-hidden />
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-2 mb-1">
                                <h4 className="font-display text-lg font-bold m-0">{course.name}</h4>
                                <span className="text-xs font-bold text-text-muted">{course.childName}</span>
                                {course.expected && (
                                  <span className={`px-2.5 py-1 rounded-full border text-[10px] font-bold uppercase tracking-wider ${statusBadgeClasses(course.expected.status)}`}>
                                    {course.expected.status === 'on-track' ? 'on track' : `${course.expected.diff} ${course.expected.status}`}
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-text-muted mb-3">
                                Start with lesson <strong className="text-text">{nextLesson}</strong> of {course.total_lessons}
                                {course.expected && course.expected.expectedLesson > nextLesson ? (
                                  <> · target today: <strong className="text-secondary">{course.expected.expectedLesson}</strong></>
                                ) : null}
                              </p>
                              <div className="grid sm:grid-cols-3 gap-3 text-xs text-text-muted">
                                <div className="rounded-xl bg-bg-alt px-3 py-2"><strong>Done:</strong> ________</div>
                                <div className="rounded-xl bg-bg-alt px-3 py-2"><strong>Score:</strong> ________</div>
                                <div className="rounded-xl bg-bg-alt px-3 py-2"><strong>Notes:</strong> ________</div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    }) : (
                      <div className="rounded-2xl border-2 border-dashed border-border p-8 text-center text-text-muted">
                        No scheduled course lessons for {dayName}. Use the notes section for field trips, reading, or makeup work.
                      </div>
                    )}
                  </div>
                </section>

                <section>
                  <h3 className="font-serif italic text-2xl text-primary mb-4">Assignments due</h3>
                  <div className="space-y-3">
                    {[...overdueAssignments, ...todaysAssignments].length > 0 ? [...overdueAssignments, ...todaysAssignments].map(assignment => (
                      <div key={assignment.id} className={`rounded-2xl border p-4 sm:p-5 break-inside-avoid ${assignment.isOverdue ? 'border-red-200 bg-red-50/60' : 'border-border'}`}>
                        <div className="flex gap-4 items-start">
                          <div className="mt-1 h-5 w-5 rounded-md border-2 border-secondary/60 shrink-0" aria-hidden />
                          <div className="flex-1">
                            <div className="flex flex-wrap items-center gap-2 mb-1">
                              <h4 className="font-display text-lg font-bold m-0">{assignment.title}</h4>
                              <span className="text-xs font-bold text-text-muted">{assignment.childName}</span>
                              {assignment.isOverdue && <span className="px-2.5 py-1 rounded-full bg-red-100 text-red-700 text-[10px] font-bold uppercase tracking-wider">Overdue</span>}
                            </div>
                            <p className="text-sm text-text-muted">
                              {assignment.subject || 'General'} · Due {assignment.due_date ? new Date(`${assignment.due_date}T00:00:00`).toLocaleDateString() : 'today'}
                            </p>
                            {assignment.description && <p className="mt-2 text-sm text-text-muted line-clamp-2">{assignment.description}</p>}
                          </div>
                        </div>
                      </div>
                    )) : (
                      <div className="rounded-2xl border-2 border-dashed border-border p-8 text-center text-text-muted">
                        No open assignments due today. Nice.
                      </div>
                    )}
                  </div>
                </section>
              </div>

              <aside className="space-y-6">
                <section className="rounded-2xl border border-border p-5 break-inside-avoid">
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div>
                      <h3 className="font-serif italic text-2xl text-primary mb-1">Attendance</h3>
                      <p className="text-sm text-text-muted">Capture the legal record before the day gets busy.</p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${attendanceComplete ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                      {attendanceComplete ? 'Complete' : 'Open'}
                    </span>
                  </div>
                  <div className="space-y-3 mb-5">
                    {kids.map(kid => {
                      const record = attendanceByChildId[kid.id];
                      return (
                        <div key={kid.id} className="flex items-center justify-between gap-3 rounded-xl bg-bg-alt px-4 py-3">
                          <span className="font-bold">{kid.name}</span>
                          <span className="text-sm text-text-muted capitalize">{record?.status || 'not marked'}</span>
                        </div>
                      );
                    })}
                  </div>
                  <Button className="w-full no-print" variant="secondary" size="sm" onClick={markEveryonePresent} disabled={savingAttendance}>
                    {savingAttendance ? 'Saving...' : 'Mark everyone present'}
                  </Button>
                </section>

                <section className="rounded-2xl border border-border p-5 break-inside-avoid">
                  <h3 className="font-serif italic text-2xl text-primary mb-4">Parent handoff</h3>
                  <div className="space-y-4 text-sm">
                    <div>
                      <p className="font-bold mb-2">Wins / lightbulb moments</p>
                      <div className="h-20 rounded-xl bg-bg-alt border border-border" />
                    </div>
                    <div>
                      <p className="font-bold mb-2">Needs follow-up</p>
                      <div className="h-20 rounded-xl bg-bg-alt border border-border" />
                    </div>
                    <div>
                      <p className="font-bold mb-2">Portfolio-worthy work</p>
                      <div className="h-16 rounded-xl bg-bg-alt border border-border" />
                    </div>
                  </div>
                </section>

                <section className="rounded-2xl border border-border p-5 break-inside-avoid">
                  <h3 className="font-serif italic text-2xl text-primary mb-4">Quick links</h3>
                  <div className="grid grid-cols-2 gap-3 no-print">
                    <Button variant="outline" size="sm" onClick={() => router.push('/assignments')}>Assignments</Button>
                    <Button variant="outline" size="sm" onClick={() => router.push('/attendance')}>Attendance</Button>
                    <Button variant="outline" size="sm" onClick={() => router.push('/portfolio')}>Portfolio</Button>
                    <Button variant="outline" size="sm" onClick={() => router.push('/weekly-summary')}>Weekly</Button>
                  </div>
                  <div className="hidden print:block text-sm text-text-muted">
                    Open Village to update assignments, attendance, portfolio, and weekly summary after lessons.
                  </div>
                </section>
              </aside>
            </div>
          )}
        </section>
      </main>
    </>
  );
}
