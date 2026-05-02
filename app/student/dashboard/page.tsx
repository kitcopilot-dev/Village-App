'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { getPocketBase } from '@/lib/pocketbase';
import { Child, Course, Lesson } from '@/lib/types';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { LoadingScreen } from '@/components/ui/Spinner';

type LessonMission = {
  id: string;
  title: string;
  subject: string;
  hook: string;
  status: 'ready' | 'continue' | 'review';
  minutes: number;
  progress: number;
  kind: 'Interactive lesson' | 'AI Spark' | 'Practice quest';
  href: string;
};

const FALLBACK_MISSIONS: LessonMission[] = [
  {
    id: 'photosynthesis-preview',
    title: 'Photosynthesis: Nature’s Food Factory',
    subject: 'Science',
    hook: 'Explore how plants turn sunlight into food through a guided classroom activity.',
    status: 'ready',
    minutes: 25,
    progress: 0,
    kind: 'Interactive lesson',
    href: '/lessons-v2',
  },
  {
    id: 'division-preview',
    title: 'Division with Remainders',
    subject: 'Math',
    hook: 'Use real-life sharing problems to learn what remainders actually mean.',
    status: 'continue',
    minutes: 20,
    progress: 45,
    kind: 'Practice quest',
    href: '/lessons-v2',
  },
];

const EXPLORE_MISSIONS: LessonMission[] = [
  {
    id: 'explore-reading',
    title: 'Mystery Vocabulary Quest',
    subject: 'Reading',
    hook: 'Pick clues, unlock word meanings, and save your best sentence for your parent to review.',
    status: 'ready',
    minutes: 12,
    progress: 0,
    kind: 'Practice quest',
    href: '/lessons-v2',
  },
  {
    id: 'explore-math',
    title: 'Math Puzzle Sprint',
    subject: 'Math',
    hook: 'A short optional practice game with patterns, logic, and a few brain-teaser problems.',
    status: 'ready',
    minutes: 10,
    progress: 0,
    kind: 'Practice quest',
    href: '/lessons-v2',
  },
  {
    id: 'explore-science',
    title: 'Mini Lab: Observe and Explain',
    subject: 'Science',
    hook: 'Try a quick observation challenge and explain what changed, what stayed, and why.',
    status: 'ready',
    minutes: 15,
    progress: 0,
    kind: 'Interactive lesson',
    href: '/lessons-v2',
  },
];

const BADGES = [
  { label: 'Curious Starter', detail: 'Started today’s path', icon: '✦' },
  { label: 'Steady Streak', detail: '3 learning days in a row', icon: '🔥' },
  { label: 'Skill Builder', detail: 'Mastered 2 skills this week', icon: '◇' },
];

const subjectTone: Record<string, { bg: string; mark: string; icon: string }> = {
  Math: { bg: 'bg-primary text-white', mark: 'bg-primary/10 text-primary', icon: '∑' },
  Science: { bg: 'bg-secondary text-white', mark: 'bg-secondary/10 text-secondary-hover', icon: '✦' },
  Reading: { bg: 'bg-accent text-primary-dark', mark: 'bg-accent-soft text-primary-dark', icon: 'Aa' },
  Writing: { bg: 'bg-primary-dark text-white', mark: 'bg-primary-dark/10 text-primary-dark', icon: '✎' },
};

function getTone(subject: string) {
  return subjectTone[subject] ?? { bg: 'bg-bg-alt text-primary', mark: 'bg-bg-alt text-text-muted', icon: '◇' };
}

function missionFromLesson(lesson: Lesson, index: number): LessonMission {
  return {
    id: lesson.id,
    title: lesson.title,
    subject: lesson.subject || 'Learning',
    hook: lesson.content?.hook || 'Open this lesson and complete the guided activity.',
    status: index === 0 ? 'ready' : 'review',
    minutes: 15 + (index % 3) * 5,
    progress: index === 0 ? 0 : 100,
    kind: lesson.type === 'tailored' ? 'AI Spark' : 'Interactive lesson',
    href: `/lessons/${lesson.id}`,
  };
}

function MissionCard({ mission, primary, onOpen }: { mission: LessonMission; primary?: boolean; onOpen: (href: string) => void }) {
  const tone = getTone(mission.subject);
  const action = mission.progress > 0 && mission.progress < 100 ? 'Continue' : mission.progress === 100 ? 'Review' : 'Start';

  return (
    <Card className={`overflow-hidden border-0 p-0 ${primary ? 'bg-primary-dark text-white shadow-hover' : 'bg-white/85'}`}>
      <div className="p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <span className={`inline-flex rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] ${primary ? 'bg-white/10 text-white/75' : tone.mark}`}>
              {mission.kind}
            </span>
            <h3 className={`mt-3 font-display text-2xl font-extrabold leading-tight ${primary ? 'text-white' : 'text-text'}`}>{mission.title}</h3>
          </div>
          <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-lg font-black ${primary ? 'bg-white/10 text-white' : tone.bg}`}>
            {tone.icon}
          </span>
        </div>

        <p className={`mt-3 line-clamp-2 text-sm leading-relaxed ${primary ? 'text-white/70' : 'text-text-muted'}`}>{mission.hook}</p>

        <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
          <div className={`rounded-2xl p-3 ${primary ? 'bg-white/10' : 'bg-bg-alt'}`}>
            <p className={`text-[10px] font-black uppercase tracking-[0.16em] ${primary ? 'text-white/50' : 'text-text-muted'}`}>Time</p>
            <p className="font-black">~{mission.minutes} min</p>
          </div>
          <div className={`rounded-2xl p-3 ${primary ? 'bg-white/10' : 'bg-bg-alt'}`}>
            <p className={`text-[10px] font-black uppercase tracking-[0.16em] ${primary ? 'text-white/50' : 'text-text-muted'}`}>Status</p>
            <p className="font-black capitalize">{mission.status.replace('_', ' ')}</p>
          </div>
        </div>

        <div className="mt-5">
          <div className="mb-2 flex justify-between text-xs font-black uppercase tracking-[0.14em]">
            <span className={primary ? 'text-white/55' : 'text-text-muted'}>Progress</span>
            <span>{mission.progress}%</span>
          </div>
          <div className={`h-2 overflow-hidden rounded-full ${primary ? 'bg-white/15' : 'bg-bg-alt'}`}>
            <div className={`h-full rounded-full transition-all ${primary ? 'bg-accent' : 'bg-primary'}`} style={{ width: `${mission.progress}%` }} />
          </div>
        </div>

        <Button onClick={() => onOpen(mission.href)} className={`mt-6 w-full ${primary ? 'bg-accent text-primary-dark hover:bg-accent-soft' : ''}`} variant={primary ? 'primary' : 'secondary'}>
          {action} lesson
        </Button>
      </div>
    </Card>
  );
}

function SubjectTile({ course }: { course: Course }) {
  const percent = Math.min(100, Math.round((course.current_lesson / Math.max(course.total_lessons, 1)) * 100));
  const tone = getTone(course.name);

  return (
    <Card className="p-5 bg-white/80">
      <div className="flex items-center gap-3">
        <span className={`grid h-11 w-11 place-items-center rounded-2xl font-black ${tone.bg}`}>{tone.icon}</span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-display text-lg font-extrabold text-text">{course.name}</h3>
          <p className="text-xs font-bold text-text-muted">Lesson {course.current_lesson} of {course.total_lessons}</p>
        </div>
      </div>
      <ProgressBar percentage={percent} className="mt-4 mb-0" />
    </Card>
  );
}

export default function StudentDashboardPage() {
  const router = useRouter();
  const pb = getPocketBase();

  const [student, setStudent] = useState<Child | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const studentId = localStorage.getItem('village_student_id');
    if (!studentId) {
      router.push('/student');
      return;
    }
    void loadData(studentId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadData = async (id: string) => {
    try {
      const [kidRecord, courseRecords, lessonRecords] = await Promise.all([
        pb.collection('children').getOne(id),
        pb.collection('courses').getFullList({
          filter: `child = "${id}"`,
          sort: 'name',
        }),
        pb.collection('lessons').getFullList({
          filter: `child = "${id}"`,
          sort: '-created',
          limit: 5,
        }),
      ]);

      setStudent(kidRecord as unknown as Child);
      setCourses(courseRecords as unknown as Course[]);
      setLessons(lessonRecords as unknown as Lesson[]);
    } catch (error) {
      console.error('Failed to load student data:', error);
      router.push('/student');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('village_student_id');
    router.push('/student');
  };

  const missions = useMemo(() => {
    const realMissions = lessons.map(missionFromLesson);
    return realMissions.length > 0 ? realMissions : FALLBACK_MISSIONS;
  }, [lessons]);

  const mainMission = missions[0];
  const supportingMissions = missions.slice(1);
  const completedCount = missions.filter((mission) => mission.progress === 100).length;
  const totalMinutes = missions.reduce((sum, mission) => sum + mission.minutes, 0);
  const pointsToday = completedCount * 50 + missions.filter((mission) => mission.progress > 0 && mission.progress < 100).length * 20;
  const weeklyLevelProgress = Math.min(100, 35 + completedCount * 20 + supportingMissions.length * 8);

  if (loading) return <LoadingScreen message="Opening your learning dashboard..." />;
  if (!student) return null;

  return (
    <main className="min-h-screen bg-bg pb-24">
      <header className="sticky top-0 z-50 border-b border-border/70 bg-bg/90 px-4 py-3 backdrop-blur-xl sm:px-6">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-primary text-lg font-black text-white">V</span>
            <div>
              <p className="font-display text-xl font-extrabold uppercase leading-none tracking-tighter text-primary">Village<span className="text-secondary">.</span></p>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-text-muted">Student hub</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <p className="hidden text-sm font-black text-primary sm:block">Hi, {student.name}</p>
            <Button variant="outline" size="sm" onClick={handleLogout}>Exit</Button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <section className="overflow-hidden rounded-[2.25rem] border border-border bg-white/75 shadow-hover backdrop-blur">
          <div className="grid gap-6 p-6 lg:grid-cols-[1.25fr_.75fr] lg:p-8">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.24em] text-secondary">Today’s learning path</p>
              <h1 className="mt-2 font-display text-4xl font-extrabold leading-none text-primary sm:text-6xl">
                Ready, {student.name}?
              </h1>
              <p className="mt-4 max-w-2xl text-lg text-text-muted">
                Start with the lesson your parent assigned, finish each block, and Village will save your progress automatically.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-4 lg:grid-cols-2">
              <div className="rounded-3xl bg-bg-alt p-4"><p className="text-3xl font-black text-primary">{missions.length}</p><p className="text-sm font-bold text-text-muted">lessons today</p></div>
              <div className="rounded-3xl bg-accent-soft p-4"><p className="text-3xl font-black text-primary">{totalMinutes}</p><p className="text-sm font-bold text-text-muted">minutes planned</p></div>
              <div className="rounded-3xl bg-primary p-4 text-white"><p className="text-3xl font-black">{completedCount}</p><p className="text-sm font-bold text-white/70">completed</p></div>
              <div className="rounded-3xl bg-secondary p-4 text-white"><p className="text-3xl font-black">{pointsToday}</p><p className="text-sm font-bold text-white/75">points today</p></div>
            </div>
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[1.2fr_.8fr]">
          <section className="space-y-5">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-text-muted">Next up</p>
                <h2 className="font-display text-3xl font-extrabold text-text">Your main lesson</h2>
              </div>
              <Button variant="outline" onClick={() => router.push('/lessons-v2')} className="hidden sm:inline-flex">Preview V2</Button>
            </div>

            <MissionCard mission={mainMission} primary onOpen={(href) => router.push(href)} />

            {supportingMissions.length > 0 && (
              <div className="grid gap-4 md:grid-cols-2">
                {supportingMissions.map((mission) => (
                  <MissionCard key={mission.id} mission={mission} onOpen={(href) => router.push(href)} />
                ))}
              </div>
            )}
          </section>

          <aside className="space-y-5">
            <Card className="p-5 bg-white/85">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-text-muted">How this works</p>
              <div className="mt-4 space-y-3">
                {['Start the next lesson', 'Answer, match, draw, or explain', 'Ask the AI teacher for a hint', 'Finish the exit ticket'].map((item, index) => (
                  <div key={item} className="flex items-center gap-3 rounded-2xl bg-bg-alt p-3">
                    <span className="grid h-8 w-8 place-items-center rounded-xl bg-primary text-sm font-black text-white">{index + 1}</span>
                    <p className="text-sm font-bold text-text">{item}</p>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-5 bg-primary-dark text-white">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-white/50">Level progress</p>
                  <h2 className="font-display text-2xl font-extrabold">Explorer Level 3</h2>
                </div>
                <span className="grid h-14 w-14 place-items-center rounded-2xl bg-white/10 text-2xl">🏕️</span>
              </div>
              <div className="mt-4 h-3 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-accent" style={{ width: `${weeklyLevelProgress}%` }} />
              </div>
              <p className="mt-2 text-sm font-semibold text-white/65">Keep going to unlock the next badge. Points reward effort, not perfection.</p>
              <div className="mt-4 grid gap-2">
                {BADGES.map((badge) => (
                  <div key={badge.label} className="flex items-center gap-3 rounded-2xl bg-white/10 p-3">
                    <span className="grid h-9 w-9 place-items-center rounded-xl bg-white/10">{badge.icon}</span>
                    <div>
                      <p className="text-sm font-black">{badge.label}</p>
                      <p className="text-xs font-semibold text-white/55">{badge.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <section className="space-y-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-text-muted">Explore when you finish early</p>
                <h2 className="font-display text-2xl font-extrabold text-text">Optional quests</h2>
                <p className="text-sm font-semibold text-text-muted">Safe extra practice. Parents can see what you explored.</p>
              </div>
              <div className="grid gap-3">
                {EXPLORE_MISSIONS.map((mission) => {
                  const tone = getTone(mission.subject);
                  return (
                    <button
                      key={mission.id}
                      type="button"
                      onClick={() => router.push(mission.href)}
                      className="flex items-center gap-3 rounded-3xl border border-border bg-white/80 p-3 text-left transition-all hover:border-primary/40 hover:bg-white"
                    >
                      <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl font-black ${tone.bg}`}>{tone.icon}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-black text-text">{mission.title}</span>
                        <span className="block truncate text-xs font-semibold text-text-muted">Optional · ~{mission.minutes} min</span>
                      </span>
                      <span className="text-primary">›</span>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="space-y-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-text-muted">Subject map</p>
                <h2 className="font-display text-2xl font-extrabold text-text">Your progress</h2>
              </div>
              {courses.length === 0 ? (
                <Card className="border-dashed bg-bg-alt p-8 text-center">
                  <p className="font-bold text-text-muted">Your subjects will appear here after your parent sets them up.</p>
                </Card>
              ) : (
                <div className="grid gap-3">
                  {courses.map((course) => <SubjectTile key={course.id} course={course} />)}
                </div>
              )}
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}
