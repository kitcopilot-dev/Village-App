'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getPocketBase } from '@/lib/pocketbase';
import { Assignment, Attendance, Child, Course, PortfolioItem, SchoolBreak, SchoolYear } from '@/lib/types';
import { buildLearningGapReport, GapPriority, LearningGapAction } from '@/lib/learning-gaps';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Select } from '@/components/ui/Input';
import { LoadingScreen } from '@/components/ui/Spinner';

type CollectionOptions = {
  filter?: string;
  sort?: string;
  limit?: number;
  expand?: string;
};

const priorityStyles: Record<GapPriority, string> = {
  urgent: 'bg-red-50 text-red-700 border-red-200',
  soon: 'bg-amber-50 text-amber-700 border-amber-200',
  steady: 'bg-primary/10 text-primary border-primary/20',
};

const categoryLabels: Record<LearningGapAction['category'], string> = {
  attendance: 'Attendance',
  assignments: 'Assignments',
  portfolio: 'Portfolio',
  pace: 'Course pace',
};

const categoryIcons: Record<LearningGapAction['category'], string> = {
  attendance: 'A',
  assignments: 'W',
  portfolio: 'P',
  pace: 'C',
};

export default function LearningGapsPage() {
  const router = useRouter();
  const pb = getPocketBase();

  const [loading, setLoading] = useState(true);
  const [kids, setKids] = useState<Child[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>([]);
  const [schoolYear, setSchoolYear] = useState<SchoolYear | null>(null);
  const [breaks, setBreaks] = useState<SchoolBreak[]>([]);
  const [selectedChildId, setSelectedChildId] = useState('all');

  useEffect(() => {
    if (!pb.authStore.isValid) {
      router.push('/');
      return;
    }

    loadLearningData();
    // Match the existing page-loading pattern: run once after PocketBase auth is restored.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadCollection = async <T,>(collection: string, options: CollectionOptions): Promise<T[]> => {
    try {
      const records = await pb.collection(collection).getFullList(options);
      return records as unknown as T[];
    } catch (error) {
      console.warn(`${collection} could not be loaded for learning gaps`, error);
      return [];
    }
  };

  const loadLearningData = async () => {
    try {
      const userId = pb.authStore.model?.id;
      if (!userId) return;

      const childRecords = await loadCollection<Child>('children', {
        filter: `user = "${userId}"`,
        sort: 'name',
      });

      setKids(childRecords);

      if (childRecords.length === 0) {
        setLoading(false);
        return;
      }

      const childFilter = childRecords.map((child) => `child = "${child.id}"`).join(' || ');

      const [courseRecords, attendanceRecords, assignmentRecords, yearRecords] = await Promise.all([
        loadCollection<Course>('courses', {
          filter: childFilter,
          sort: 'name',
        }),
        loadCollection<Attendance>('attendance', {
          filter: `user = "${userId}"`,
          sort: '-date',
        }),
        loadCollection<Assignment>('assignments', {
          filter: `user = "${userId}"`,
          sort: 'due_date',
        }),
        loadCollection<SchoolYear>('school_years', {
          filter: `user = "${userId}"`,
          sort: '-start_date',
          limit: 1,
        }),
      ]);

      const portfolioRecords = await loadCollection<PortfolioItem>('portfolio', {
        filter: `user = "${userId}"`,
        sort: '-date',
      });

      const fallbackPortfolioRecords = portfolioRecords.length > 0
        ? []
        : await loadCollection<PortfolioItem>('portfolio_items', {
            filter: childFilter,
            sort: '-date',
          });

      const latestSchoolYear = yearRecords[0] ?? null;
      const breakRecords = latestSchoolYear
        ? await loadCollection<SchoolBreak>('school_breaks', {
            filter: `school_year = "${latestSchoolYear.id}"`,
            sort: 'start_date',
          })
        : [];

      setCourses(courseRecords);
      setAttendance(attendanceRecords);
      setAssignments(assignmentRecords);
      setPortfolio(portfolioRecords.length > 0 ? portfolioRecords : fallbackPortfolioRecords);
      setSchoolYear(latestSchoolYear);
      setBreaks(breakRecords);
    } catch (error) {
      console.error('Learning gaps load error:', error);
    } finally {
      setLoading(false);
    }
  };

  const report = useMemo(() => buildLearningGapReport({
    children: kids,
    courses,
    attendance,
    assignments,
    portfolio,
    schoolYear,
    breaks,
  }), [kids, courses, attendance, assignments, portfolio, schoolYear, breaks]);

  const visibleSnapshots = selectedChildId === 'all'
    ? report.snapshots
    : report.snapshots.filter((snapshot) => snapshot.child.id === selectedChildId);

  const visibleActions = visibleSnapshots.flatMap((snapshot) => snapshot.actions);
  const visibleCounts: Record<GapPriority, number> = {
    urgent: visibleActions.filter((action) => action.priority === 'urgent').length,
    soon: visibleActions.filter((action) => action.priority === 'soon').length,
    steady: visibleActions.filter((action) => action.priority === 'steady').length,
  };
  const averageReadiness = visibleSnapshots.length > 0
    ? Math.round(visibleSnapshots.reduce((sum, snapshot) => sum + snapshot.readinessScore, 0) / visibleSnapshots.length)
    : 100;

  const handleLogout = () => {
    pb.authStore.clear();
    router.push('/');
  };

  if (loading) {
    return <LoadingScreen message="Scanning learning records..." />;
  }

  return (
    <>
      <Header showLogout onLogout={handleLogout} />
      <main className="max-w-7xl mx-auto my-8 sm:my-12 px-4 sm:px-8 pb-20 animate-fade-in">
        <section className="mb-8 sm:mb-12">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
            <div className="max-w-3xl">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-secondary mb-3">Parent command list</p>
              <h2 className="font-display text-4xl sm:text-6xl font-extrabold tracking-tight mb-3">
                Learning Gaps
              </h2>
              <p className="text-text-muted text-sm sm:text-base max-w-2xl">
                A daily scan of attendance, assignments, portfolio evidence, and course pace so the next parent action is obvious.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button variant="outline" size="sm" onClick={() => router.push('/reports')}>
                Weekly Reports
              </Button>
              <Button variant="ghost" size="sm" onClick={() => router.push('/dashboard')}>
                Dashboard
              </Button>
            </div>
          </div>
        </section>

        {kids.length === 0 ? (
          <Card className="text-center py-16">
            <p className="text-text-muted text-lg mb-6">Add children before Village can scan for learning gaps.</p>
            <Button onClick={() => router.push('/manage-kids')}>Add Your First Child</Button>
          </Card>
        ) : (
          <>
            <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8">
              <div className="bg-primary text-white rounded-[1.5rem] p-5 sm:p-7 shadow-[0_16px_35px_-18px_rgba(45,59,41,0.8)]">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/70 mb-2">Readiness</p>
                <div className="font-display text-4xl sm:text-5xl font-extrabold">{averageReadiness}%</div>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-[1.5rem] p-5 sm:p-7">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-red-500 mb-2">Urgent</p>
                <div className="font-display text-4xl sm:text-5xl font-extrabold text-red-700">{visibleCounts.urgent}</div>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-[1.5rem] p-5 sm:p-7">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-600 mb-2">This Week</p>
                <div className="font-display text-4xl sm:text-5xl font-extrabold text-amber-700">{visibleCounts.soon}</div>
              </div>
              <div className="bg-card border border-border rounded-[1.5rem] p-5 sm:p-7">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-text-muted mb-2">Tune-ups</p>
                <div className="font-display text-4xl sm:text-5xl font-extrabold text-primary">{visibleCounts.steady}</div>
              </div>
            </section>

            <section className="grid lg:grid-cols-[320px_1fr] gap-6 sm:gap-8">
              <div className="space-y-6">
                <Card className="p-5 sm:p-6">
                  <Select
                    label="Student"
                    value={selectedChildId}
                    onChange={(event) => setSelectedChildId(event.target.value)}
                  >
                    <option value="all">All students</option>
                    {kids.map((kid) => (
                      <option key={kid.id} value={kid.id}>{kid.name}</option>
                    ))}
                  </Select>
                  <div className="mt-3 text-xs text-text-muted">
                    Scores subtract for urgent, weekly, and steady actions. A clear student stays at 100%.
                  </div>
                </Card>

                <div className="space-y-3">
                  {visibleSnapshots.map((snapshot) => (
                    <button
                      key={snapshot.child.id}
                      type="button"
                      onClick={() => setSelectedChildId(snapshot.child.id)}
                      className="w-full text-left bg-card border border-border rounded-[1.25rem] p-4 transition-all hover:border-primary hover:-translate-y-0.5"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="font-display font-bold text-lg text-primary">{snapshot.child.name}</div>
                          <div className="text-xs text-text-muted">{snapshot.actions.length} action{snapshot.actions.length === 1 ? '' : 's'}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-display font-extrabold text-2xl">{snapshot.readinessScore}%</div>
                          <div className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Ready</div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-5">
                {visibleActions.length === 0 ? (
                  <Card className="text-center py-16 bg-primary/5 border-primary/20">
                    <div className="font-display text-5xl font-extrabold text-primary mb-3">100%</div>
                    <p className="text-text-muted">No learning gaps found for this view.</p>
                  </Card>
                ) : (
                  visibleActions.map((action) => (
                    <div
                      key={action.id}
                      className="bg-card border border-border rounded-[1.5rem] p-5 sm:p-6 transition-all hover:border-primary/40 hover:shadow-[0_12px_30px_-18px_rgba(75,99,68,0.45)]"
                    >
                      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-5">
                        <div className="flex gap-4">
                          <div className="w-12 h-12 rounded-2xl bg-bg-alt border border-border flex items-center justify-center font-display font-extrabold text-primary shrink-0">
                            {categoryIcons[action.category]}
                          </div>
                          <div>
                            <div className="flex flex-wrap items-center gap-2 mb-2">
                              <span className={`px-3 py-1 rounded-full border text-[10px] font-bold uppercase tracking-wider ${priorityStyles[action.priority]}`}>
                                {action.priority}
                              </span>
                              <span className="text-xs font-bold uppercase tracking-wider text-text-muted">
                                {categoryLabels[action.category]} · {action.childName}
                              </span>
                            </div>
                            <h3 className="font-display text-xl sm:text-2xl font-extrabold mb-2">{action.title}</h3>
                            <p className="text-sm text-text-muted max-w-2xl">{action.detail}</p>
                          </div>
                        </div>
                        <div className="flex md:flex-col items-center md:items-end justify-between gap-3 md:min-w-36">
                          <div className="font-display text-lg font-extrabold text-primary whitespace-nowrap">{action.metric}</div>
                          <Button variant="outline" size="sm" onClick={() => router.push(action.href)}>
                            Fix
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          </>
        )}
      </main>
    </>
  );
}
