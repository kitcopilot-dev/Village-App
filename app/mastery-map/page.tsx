'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getPocketBase } from '@/lib/pocketbase';
import { Assignment, Child } from '@/lib/types';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Select } from '@/components/ui/Input';
import { LoadingScreen } from '@/components/ui/Spinner';

const MASTERY_TARGET = 85;
const REVIEW_TARGET = 70;
const RECENT_WINDOW_DAYS = 21;

interface SubjectMastery {
  childId: string;
  childName: string;
  subject: string;
  average: number | null;
  gradedCount: number;
  pendingCount: number;
  missingCount: number;
  lastActivity: string | null;
  status: 'mastered' | 'progressing' | 'review' | 'unmeasured';
  recommendation: string;
}

function normalizeSubject(subject?: string): string {
  const clean = subject?.trim();
  return clean || 'General';
}

function formatDate(date?: string | null): string {
  if (!date) return 'No graded work yet';

  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return 'No graded work yet';

  return parsed.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

function daysSince(date?: string | null): number | null {
  if (!date) return null;

  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return null;

  const diff = Date.now() - parsed.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function getStatusStyles(status: SubjectMastery['status']): string {
  switch (status) {
    case 'mastered':
      return 'bg-green-100 text-green-800 border-green-200';
    case 'progressing':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'review':
      return 'bg-red-100 text-red-800 border-red-200';
    default:
      return 'bg-bg-alt text-text-muted border-border';
  }
}

function getStatusLabel(status: SubjectMastery['status']): string {
  switch (status) {
    case 'mastered':
      return 'Mastered';
    case 'progressing':
      return 'Progressing';
    case 'review':
      return 'Needs review';
    default:
      return 'Unmeasured';
  }
}

function buildRecommendation(row: Omit<SubjectMastery, 'recommendation'>): string {
  if (row.pendingCount > 0) {
    return `Grade ${row.pendingCount} pending ${row.pendingCount === 1 ? 'assignment' : 'assignments'} first so the map reflects reality.`;
  }

  if (row.average === null) {
    return 'Add one quick check-in assignment this week to establish a baseline.';
  }

  const staleDays = daysSince(row.lastActivity);
  if (staleDays !== null && staleDays > RECENT_WINDOW_DAYS) {
    return `Run a short spiral review — last graded evidence is ${staleDays} days old.`;
  }

  if (row.average < REVIEW_TARGET) {
    return 'Reteach the core concept, then assign two short practice checks before moving on.';
  }

  if (row.average < MASTERY_TARGET) {
    return 'Keep this in active practice and add one targeted problem set this week.';
  }

  return 'Ready to advance. Capture a portfolio artifact or raise the difficulty.';
}

function calculateMastery(kids: Child[], assignments: Assignment[]): SubjectMastery[] {
  const rows: SubjectMastery[] = [];
  const subjectsByChild = new Map<string, Set<string>>();

  kids.forEach((kid) => subjectsByChild.set(kid.id, new Set()));

  assignments.forEach((assignment) => {
    if (!assignment.child || !subjectsByChild.has(assignment.child)) return;
    subjectsByChild.get(assignment.child)?.add(normalizeSubject(assignment.subject));
  });

  kids.forEach((kid) => {
    const subjects = subjectsByChild.get(kid.id) ?? new Set<string>();

    if (subjects.size === 0) {
      subjects.add('General');
    }

    subjects.forEach((subject) => {
      const childSubjectAssignments = assignments.filter((assignment) => (
        assignment.child === kid.id && normalizeSubject(assignment.subject) === subject
      ));

      const graded = childSubjectAssignments.filter((assignment) => typeof assignment.score === 'number');
      const pendingCount = childSubjectAssignments.filter((assignment) => typeof assignment.score !== 'number').length;
      const totalScore = graded.reduce((sum, assignment) => sum + (assignment.score ?? 0), 0);
      const average = graded.length > 0 ? Math.round(totalScore / graded.length) : null;
      const lastActivity = childSubjectAssignments
        .map((assignment) => assignment.due_date || assignment.updated || assignment.created)
        .filter(Boolean)
        .sort()
        .at(-1) ?? null;

      const status: SubjectMastery['status'] = average === null
        ? 'unmeasured'
        : average >= MASTERY_TARGET
          ? 'mastered'
          : average >= REVIEW_TARGET
            ? 'progressing'
            : 'review';

      const baseRow = {
        childId: kid.id,
        childName: kid.name,
        subject,
        average,
        gradedCount: graded.length,
        pendingCount,
        missingCount: childSubjectAssignments.length === 0 ? 1 : 0,
        lastActivity,
        status
      };

      rows.push({
        ...baseRow,
        recommendation: buildRecommendation(baseRow)
      });
    });
  });

  return rows.sort((a, b) => {
    const statusOrder = { review: 0, progressing: 1, unmeasured: 2, mastered: 3 };
    return statusOrder[a.status] - statusOrder[b.status]
      || a.childName.localeCompare(b.childName)
      || a.subject.localeCompare(b.subject);
  });
}

export default function MasteryMapPage() {
  const router = useRouter();
  const pb = getPocketBase();

  const [kids, setKids] = useState<Child[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [selectedChild, setSelectedChild] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [loading, setLoading] = useState(true);

  const loadMasteryData = useCallback(async () => {
    try {
      const userId = pb.authStore.model?.id;
      if (!userId) return;

      const [kidRecords, assignmentRecords] = await Promise.all([
        pb.collection('children').getFullList({
          filter: `user = "${userId}"`,
          sort: 'name'
        }),
        pb.collection('assignments').getFullList({
          filter: `user = "${userId}"`,
          sort: '-due_date'
        })
      ]);

      setKids(kidRecords as unknown as Child[]);
      setAssignments(assignmentRecords as unknown as Assignment[]);
    } catch (error) {
      console.error('Mastery map load error:', error);
    } finally {
      setLoading(false);
    }
  }, [pb]);

  useEffect(() => {
    if (!pb.authStore.isValid) {
      router.push('/');
      return;
    }

    loadMasteryData();
  }, [loadMasteryData, pb.authStore.isValid, router]);

  const masteryRows = useMemo(() => calculateMastery(kids, assignments), [kids, assignments]);

  const filteredRows = masteryRows.filter((row) => {
    if (selectedChild !== 'all' && row.childId !== selectedChild) return false;
    if (selectedStatus !== 'all' && row.status !== selectedStatus) return false;
    return true;
  });

  const summary = masteryRows.reduce((acc, row) => {
    acc[row.status] += 1;
    return acc;
  }, { mastered: 0, progressing: 0, review: 0, unmeasured: 0 });

  const overallAverage = (() => {
    const scoredRows = masteryRows.filter((row) => row.average !== null);
    if (scoredRows.length === 0) return null;
    return Math.round(scoredRows.reduce((sum, row) => sum + (row.average ?? 0), 0) / scoredRows.length);
  })();

  const nextActions = masteryRows
    .filter((row) => row.status === 'review' || row.pendingCount > 0 || row.status === 'unmeasured')
    .slice(0, 5);

  if (loading) {
    return <LoadingScreen message="Building mastery map..." />;
  }

  return (
    <>
      <Header showLogout onLogout={() => { pb.authStore.clear(); router.push('/'); }} />
      <main className="max-w-7xl mx-auto my-8 sm:my-12 px-4 sm:px-8 pb-24 animate-fade-in">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 mb-10">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-secondary mb-3">Mastery-based planning</p>
            <h2 className="font-display text-4xl sm:text-6xl font-extrabold tracking-tight mb-3">Mastery Map</h2>
            <p className="text-text-muted max-w-2xl">
              Turns assignment scores into a parent-friendly skill map: what is mastered, what needs review, and what to do next.
            </p>
          </div>
          <div className="flex gap-3 flex-wrap">
            <Button variant="outline" size="sm" onClick={() => router.push('/assignments')}>📝 Add work</Button>
            <Button variant="ghost" size="sm" onClick={() => router.push('/dashboard')}>← Dashboard</Button>
          </div>
        </div>

        {kids.length === 0 ? (
          <Card className="text-center py-16">
            <p className="text-text-muted text-lg mb-6">Add children first, then the mastery map can track progress by student and subject.</p>
            <Button onClick={() => router.push('/manage-kids')}>Add Your First Child</Button>
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 sm:gap-6 mb-8">
              <Card className="p-5 sm:p-6 text-center">
                <div className="text-3xl font-display font-extrabold text-primary">{overallAverage !== null ? `${overallAverage}%` : '—'}</div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-text-muted mt-2">Avg mastery</div>
              </Card>
              <Card className="p-5 sm:p-6 text-center border-green-200 bg-green-50/60">
                <div className="text-3xl font-display font-extrabold text-green-700">{summary.mastered}</div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-green-700 mt-2">Mastered</div>
              </Card>
              <Card className="p-5 sm:p-6 text-center border-yellow-200 bg-yellow-50/60">
                <div className="text-3xl font-display font-extrabold text-yellow-700">{summary.progressing}</div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-yellow-700 mt-2">Progressing</div>
              </Card>
              <Card className="p-5 sm:p-6 text-center border-red-200 bg-red-50/60">
                <div className="text-3xl font-display font-extrabold text-red-700">{summary.review}</div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-red-700 mt-2">Review</div>
              </Card>
              <Card className="p-5 sm:p-6 text-center">
                <div className="text-3xl font-display font-extrabold text-text-muted">{summary.unmeasured}</div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-text-muted mt-2">Unmeasured</div>
              </Card>
            </div>

            <div className="grid lg:grid-cols-[1fr_360px] gap-8 items-start">
              <div className="space-y-6">
                <Card className="p-4 sm:p-6">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <Select label="Student" value={selectedChild} onChange={(e) => setSelectedChild(e.target.value)}>
                      <option value="all">All students</option>
                      {kids.map((kid) => <option key={kid.id} value={kid.id}>{kid.name}</option>)}
                    </Select>
                    <Select label="Status" value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value)}>
                      <option value="all">All statuses</option>
                      <option value="review">Needs review</option>
                      <option value="progressing">Progressing</option>
                      <option value="mastered">Mastered</option>
                      <option value="unmeasured">Unmeasured</option>
                    </Select>
                  </div>
                </Card>

                <div className="space-y-4">
                  {filteredRows.map((row) => (
                    <div key={`${row.childId}-${row.subject}`} className="bg-card border border-border rounded-[1.5rem] p-5 sm:p-7 transition-all hover:border-primary/30 hover:shadow-sm">
                      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-5">
                        <div>
                          <div className="flex flex-wrap items-center gap-3 mb-2">
                            <h3 className="font-display text-xl sm:text-2xl font-bold m-0">{row.subject}</h3>
                            <span className={`px-3 py-1 rounded-full text-xs font-bold border ${getStatusStyles(row.status)}`}>
                              {getStatusLabel(row.status)}
                            </span>
                          </div>
                          <p className="text-sm text-text-muted m-0">{row.childName} • Last evidence: {formatDate(row.lastActivity)}</p>
                        </div>
                        <div className="text-left md:text-right">
                          <div className="font-display text-4xl font-extrabold text-primary">{row.average !== null ? `${row.average}%` : '—'}</div>
                          <div className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Mastery score</div>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-3 mb-5">
                        <div className="rounded-2xl bg-bg-alt p-3 text-center">
                          <div className="font-display text-2xl font-bold text-primary">{row.gradedCount}</div>
                          <div className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Graded</div>
                        </div>
                        <div className="rounded-2xl bg-bg-alt p-3 text-center">
                          <div className="font-display text-2xl font-bold text-secondary">{row.pendingCount}</div>
                          <div className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Pending</div>
                        </div>
                        <div className="rounded-2xl bg-bg-alt p-3 text-center">
                          <div className="font-display text-2xl font-bold text-accent">{row.missingCount}</div>
                          <div className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Baseline</div>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-primary/10 bg-primary/5 p-4">
                        <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary mb-2">Recommended next step</p>
                        <p className="text-sm text-text m-0">{row.recommendation}</p>
                      </div>
                    </div>
                  ))}

                  {filteredRows.length === 0 && (
                    <div className="text-center py-16 bg-bg-alt rounded-[2rem] border-2 border-dashed border-border">
                      <p className="text-text-muted text-lg">No mastery rows match those filters.</p>
                    </div>
                  )}
                </div>
              </div>

              <aside className="space-y-6 lg:sticky lg:top-28">
                <Card className="p-6 bg-secondary/5 border-secondary/20">
                  <h3 className="font-display text-xl font-bold mb-3 text-secondary">This week&apos;s parent checklist</h3>
                  {nextActions.length > 0 ? (
                    <ol className="space-y-4 list-decimal list-inside text-sm text-text-muted">
                      {nextActions.map((row) => (
                        <li key={`${row.childId}-${row.subject}-action`}>
                          <span className="font-bold text-text">{row.childName}: {row.subject}</span>
                          <p className="ml-5 mt-1 text-xs leading-relaxed">{row.recommendation}</p>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className="text-sm text-text-muted">Nothing urgent. Pick one mastered subject and add a portfolio artifact.</p>
                  )}
                </Card>

                <Card className="p-6">
                  <h3 className="font-display text-xl font-bold mb-3">How it works</h3>
                  <div className="space-y-3 text-sm text-text-muted">
                    <p><span className="font-bold text-green-700">Mastered:</span> average score is {MASTERY_TARGET}% or higher.</p>
                    <p><span className="font-bold text-yellow-700">Progressing:</span> average is {REVIEW_TARGET}–{MASTERY_TARGET - 1}%.</p>
                    <p><span className="font-bold text-red-700">Review:</span> average is below {REVIEW_TARGET}%.</p>
                    <p><span className="font-bold text-text">Unmeasured:</span> no graded assignment exists yet.</p>
                  </div>
                </Card>
              </aside>
            </div>
          </>
        )}
      </main>
    </>
  );
}
