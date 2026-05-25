'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getPocketBase } from '@/lib/pocketbase';
import { Attendance, Assignment, Child, PortfolioItem } from '@/lib/types';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Select } from '@/components/ui/Input';
import { LoadingScreen } from '@/components/ui/Spinner';

type PeriodOption = '30' | '60' | '90';
type AudienceOption = 'parent' | 'evaluator' | 'family';

interface ChildRecordSet {
  child: Child;
  attendance: Attendance[];
  assignments: Assignment[];
  portfolio: PortfolioItem[];
}

interface LetterStats {
  presentDays: number;
  loggedDays: number;
  completedAssignments: Assignment[];
  pendingAssignments: Assignment[];
  overdueAssignments: Assignment[];
  gradedAssignments: Assignment[];
  averageScore: number | null;
  subjectHighlights: string[];
  portfolioHighlights: PortfolioItem[];
}

const PERIOD_LABELS: Record<PeriodOption, string> = {
  '30': 'Last 30 days',
  '60': 'Last 60 days',
  '90': 'Last 90 days',
};

const AUDIENCE_LABELS: Record<AudienceOption, string> = {
  parent: 'Parent update',
  evaluator: 'Evaluator letter',
  family: 'Family share',
};

function toDateInputValue(date: Date): string {
  return date.toISOString().split('T')[0];
}

function formatLongDate(value: string | Date): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return 'Not dated';
  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function normalizeStatus(status?: string): string {
  return (status || '').toLowerCase();
}

function isComplete(assignment: Assignment): boolean {
  const status = normalizeStatus(assignment.status);
  return status === 'graded' || status === 'completed';
}

function isPending(assignment: Assignment): boolean {
  const status = normalizeStatus(assignment.status);
  return status === 'pending' || status === 'in_progress';
}

function getDueDate(assignment: Assignment): Date | null {
  if (!assignment.due_date) return null;
  const date = new Date(assignment.due_date);
  return Number.isNaN(date.getTime()) ? null : date;
}

function summarizeSubjects(assignments: Assignment[]): string[] {
  const subjects = new Map<string, { total: number; count: number; completed: number }>();

  assignments.forEach((assignment) => {
    const subject = assignment.subject?.trim() || 'General studies';
    const current = subjects.get(subject) || { total: 0, count: 0, completed: 0 };
    if (typeof assignment.score === 'number') {
      current.total += assignment.score;
      current.count += 1;
    }
    if (isComplete(assignment)) {
      current.completed += 1;
    }
    subjects.set(subject, current);
  });

  return Array.from(subjects.entries())
    .sort((a, b) => b[1].completed - a[1].completed || b[1].count - a[1].count)
    .slice(0, 4)
    .map(([subject, stats]) => {
      const grade = stats.count > 0 ? `, average score ${Math.round(stats.total / stats.count)}%` : '';
      return `${subject}: ${stats.completed} completed${grade}`;
    });
}

function buildStats(records: ChildRecordSet, endDate: Date): LetterStats {
  const completedAssignments = records.assignments.filter(isComplete);
  const pendingAssignments = records.assignments.filter((assignment) => isPending(assignment) && !isOverdue(assignment, endDate));
  const overdueAssignments = records.assignments.filter((assignment) => isPending(assignment) && isOverdue(assignment, endDate));
  const gradedAssignments = records.assignments.filter((assignment) => typeof assignment.score === 'number');
  const averageScore = gradedAssignments.length > 0
    ? Math.round(gradedAssignments.reduce((sum, assignment) => sum + (assignment.score || 0), 0) / gradedAssignments.length)
    : null;

  return {
    presentDays: records.attendance.filter((day) => day.status === 'present' || day.status === 'half-day').length,
    loggedDays: records.attendance.length,
    completedAssignments,
    pendingAssignments,
    overdueAssignments,
    gradedAssignments,
    averageScore,
    subjectHighlights: summarizeSubjects(records.assignments),
    portfolioHighlights: records.portfolio.slice(0, 5),
  };
}

function isOverdue(assignment: Assignment, endDate: Date): boolean {
  const dueDate = getDueDate(assignment);
  if (!dueDate) return false;
  return dueDate < endDate;
}

function buildLetter(records: ChildRecordSet, stats: LetterStats, startDate: Date, endDate: Date, audience: AudienceOption): string {
  const child = records.child;
  const grade = child.grade ? ` in ${child.grade}` : '';
  const focus = child.focus ? ` Current focus: ${child.focus}.` : '';
  const period = `${formatLongDate(startDate)} through ${formatLongDate(endDate)}`;
  const recipient = audience === 'evaluator' ? 'Homeschool Evaluator' : audience === 'family' ? 'Family' : 'Parent';
  const attendanceLine = stats.loggedDays > 0
    ? `${child.name} logged ${stats.presentDays} active homeschool days across ${stats.loggedDays} attendance records.`
    : `${child.name} does not have attendance logged for this period yet.`;
  const scoreLine = stats.averageScore !== null
    ? `Graded work averaged ${stats.averageScore}% across ${stats.gradedAssignments.length} scored assignment${stats.gradedAssignments.length === 1 ? '' : 's'}.`
    : 'No scored assignments were recorded during this period.';
  const subjectLine = stats.subjectHighlights.length > 0
    ? `Academic activity covered ${stats.subjectHighlights.join('; ')}.`
    : 'No subject-specific assignment activity was recorded yet.';
  const portfolioLine = stats.portfolioHighlights.length > 0
    ? `Portfolio evidence includes ${stats.portfolioHighlights.map((item) => item.title).join(', ')}.`
    : 'No portfolio evidence was added during this period.';
  const nextSteps = [
    stats.overdueAssignments.length > 0 ? `clear ${stats.overdueAssignments.length} overdue assignment${stats.overdueAssignments.length === 1 ? '' : 's'}` : null,
    stats.pendingAssignments.length > 0 ? `review ${stats.pendingAssignments.length} pending assignment${stats.pendingAssignments.length === 1 ? '' : 's'}` : null,
    stats.portfolioHighlights.length === 0 ? 'add one portfolio sample for evaluator-ready records' : null,
  ].filter(Boolean).join(', ');

  return [
    `Dear ${recipient},`,
    '',
    `This progress letter summarizes ${child.name}'s homeschool activity${grade} for ${period}.${focus}`,
    '',
    attendanceLine,
    `${child.name} completed ${stats.completedAssignments.length} assignment${stats.completedAssignments.length === 1 ? '' : 's'} during this window. ${scoreLine}`,
    subjectLine,
    portfolioLine,
    '',
    nextSteps
      ? `Recommended next steps: ${nextSteps}.`
      : 'Recommended next steps: continue the current rhythm and add another portfolio sample when a strong piece of work is ready.',
    '',
    'Generated from Village records.',
  ].join('\n');
}

export default function ProgressLetterPage() {
  const router = useRouter();
  const pb = getPocketBase();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [period, setPeriod] = useState<PeriodOption>('30');
  const [audience, setAudience] = useState<AudienceOption>('parent');
  const [records, setRecords] = useState<ChildRecordSet[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const dateRange = useMemo(() => {
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    const start = new Date(end);
    start.setDate(start.getDate() - Number(period) + 1);
    start.setHours(0, 0, 0, 0);
    return { start, end };
  }, [period]);

  const loadPortfolio = useCallback(async (childId: string, startStr: string, endStr: string): Promise<PortfolioItem[]> => {
    const filter = `child = "${childId}" && date >= "${startStr}" && date <= "${endStr}"`;

    const primary = await pb.collection('portfolio').getFullList({
      filter,
      sort: '-date',
    }).catch(() => []);

    if (primary.length > 0) {
      return primary as unknown as PortfolioItem[];
    }

    const fallback = await pb.collection('portfolio_items').getFullList({
      filter,
      sort: '-date',
    }).catch(() => []);

    return fallback as unknown as PortfolioItem[];
  }, [pb]);

  const loadRecords = useCallback(async () => {
    setRefreshing(true);
    try {
      const userId = pb.authStore.model?.id;
      if (!userId) return;

      const startStr = toDateInputValue(dateRange.start);
      const endStr = toDateInputValue(dateRange.end);
      const childRecords = await pb.collection('children').getFullList({
        filter: `user = "${userId}"`,
        sort: 'name',
      });

      const childSets = await Promise.all(
        (childRecords as unknown as Child[]).map(async (child) => {
          const [attendance, assignments, portfolio] = await Promise.all([
            pb.collection('attendance').getFullList({
              filter: `child = "${child.id}" && date >= "${startStr}" && date <= "${endStr}"`,
              sort: '-date',
            }).catch(() => []),
            pb.collection('assignments').getFullList({
              filter: `child = "${child.id}" && (due_date >= "${startStr}" && due_date <= "${endStr}" || updated >= "${startStr}")`,
              sort: '-due_date',
            }).catch(() => []),
            loadPortfolio(child.id, startStr, endStr),
          ]);

          return {
            child,
            attendance: attendance as unknown as Attendance[],
            assignments: assignments as unknown as Assignment[],
            portfolio,
          };
        })
      );

      setRecords(childSets);
    } catch (error) {
      console.error('Progress letter load error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [dateRange.end, dateRange.start, loadPortfolio, pb]);

  useEffect(() => {
    if (!pb.authStore.isValid) {
      router.push('/');
      return;
    }

    loadRecords();
  }, [loadRecords, pb, router]);

  const handleLogout = () => {
    pb.authStore.clear();
    router.push('/');
  };

  const handlePrint = () => {
    window.print();
  };

  const copyLetter = async (childId: string, letter: string) => {
    await navigator.clipboard.writeText(letter);
    setCopiedId(childId);
    window.setTimeout(() => setCopiedId(null), 1800);
  };

  if (loading) {
    return (
      <>
        <Header showLogout onLogout={handleLogout} />
        <main className="max-w-7xl mx-auto my-12 px-8">
          <LoadingScreen message="Preparing progress letters..." />
        </main>
      </>
    );
  }

  return (
    <>
      <Header showLogout onLogout={handleLogout} />
      <main className="max-w-7xl mx-auto my-12 px-4 sm:px-8 pb-24 animate-fade-in">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 mb-8 print:hidden">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-secondary mb-3">Records workspace</p>
            <h2 className="font-display text-4xl sm:text-6xl font-extrabold tracking-tight mb-3">Progress Letters</h2>
            <p className="text-text-muted max-w-2xl">
              Turn the last stretch of homeschool activity into polished notes for parents, evaluators, and family updates.
            </p>
          </div>
          <div className="flex gap-3 flex-wrap">
            <Button variant="outline" size="sm" onClick={() => router.push('/dashboard')}>
              Dashboard
            </Button>
            <Button variant="primary" size="sm" onClick={handlePrint}>
              Print Letters
            </Button>
          </div>
        </div>

        <Card className="mb-8 print:hidden">
          <div className="grid md:grid-cols-[1fr_1fr_auto] gap-4 md:items-end">
            <Select label="Period" value={period} onChange={(event) => setPeriod(event.target.value as PeriodOption)}>
              <option value="30">Last 30 days</option>
              <option value="60">Last 60 days</option>
              <option value="90">Last 90 days</option>
            </Select>
            <Select label="Audience" value={audience} onChange={(event) => setAudience(event.target.value as AudienceOption)}>
              <option value="parent">Parent update</option>
              <option value="evaluator">Evaluator letter</option>
              <option value="family">Family share</option>
            </Select>
            <Button variant="ghost" onClick={loadRecords} disabled={refreshing}>
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </Button>
          </div>
          <p className="text-xs text-text-muted mt-2 mb-0">
            Using records from {formatLongDate(dateRange.start)} to {formatLongDate(dateRange.end)}.
          </p>
        </Card>

        <div className="hidden print:block text-center border-b-2 border-primary pb-4 mb-8">
          <h1 className="font-display text-3xl font-bold text-primary mb-2">Village Progress Letters</h1>
          <p className="font-semibold">{PERIOD_LABELS[period]} - {AUDIENCE_LABELS[audience]}</p>
          <p className="text-sm text-text-muted">Generated {formatLongDate(new Date())}</p>
        </div>

        {records.length === 0 ? (
          <Card className="text-center py-16">
            <p className="text-text-muted text-lg mb-6">No children found yet.</p>
            <Button onClick={() => router.push('/manage-kids')}>Add a Child</Button>
          </Card>
        ) : (
          <div className="space-y-8">
            {records.map((record) => {
              const stats = buildStats(record, dateRange.end);
              const letter = buildLetter(record, stats, dateRange.start, dateRange.end, audience);

              return (
                <Card key={record.child.id} className="print:shadow-none print:border print:border-gray-300 print:break-inside-avoid">
                  <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6 mb-8">
                    <div>
                      <div className="flex items-center gap-4 mb-4">
                        <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-display text-3xl font-extrabold">
                          {record.child.name.charAt(0)}
                        </div>
                        <div>
                          <h3 className="font-display text-3xl font-extrabold text-primary m-0">{record.child.name}</h3>
                          <p className="text-sm text-text-muted m-0">
                            {record.child.grade || 'Grade not set'} {record.child.age ? `- Age ${record.child.age}` : ''}
                          </p>
                        </div>
                      </div>
                      <p className="text-sm text-text-muted max-w-2xl">
                        {stats.completedAssignments.length} completed assignments, {stats.presentDays} active attendance days,
                        {' '}{stats.portfolioHighlights.length} portfolio samples in this period.
                      </p>
                    </div>

                    <div className="flex gap-3 print:hidden">
                      <Button variant="outline" size="sm" onClick={() => copyLetter(record.child.id, letter)}>
                        {copiedId === record.child.id ? 'Copied' : 'Copy'}
                      </Button>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-4 gap-3 mb-8">
                    <div className="rounded-2xl border border-border bg-green-50 p-4">
                      <p className="text-[10px] uppercase tracking-[0.18em] font-bold text-green-700 mb-2">Attendance</p>
                      <p className="font-display text-3xl font-extrabold text-green-800">{stats.presentDays}</p>
                      <p className="text-xs text-green-700">active days</p>
                    </div>
                    <div className="rounded-2xl border border-border bg-blue-50 p-4">
                      <p className="text-[10px] uppercase tracking-[0.18em] font-bold text-blue-700 mb-2">Completed</p>
                      <p className="font-display text-3xl font-extrabold text-blue-800">{stats.completedAssignments.length}</p>
                      <p className="text-xs text-blue-700">assignments</p>
                    </div>
                    <div className="rounded-2xl border border-border bg-amber-50 p-4">
                      <p className="text-[10px] uppercase tracking-[0.18em] font-bold text-amber-700 mb-2">Average</p>
                      <p className="font-display text-3xl font-extrabold text-amber-800">{stats.averageScore ?? '--'}{stats.averageScore !== null ? '%' : ''}</p>
                      <p className="text-xs text-amber-700">graded work</p>
                    </div>
                    <div className="rounded-2xl border border-border bg-purple-50 p-4">
                      <p className="text-[10px] uppercase tracking-[0.18em] font-bold text-purple-700 mb-2">Evidence</p>
                      <p className="font-display text-3xl font-extrabold text-purple-800">{stats.portfolioHighlights.length}</p>
                      <p className="text-xs text-purple-700">portfolio items</p>
                    </div>
                  </div>

                  <div className="grid lg:grid-cols-[minmax(0,1fr)_18rem] gap-8">
                    <article className="rounded-[1.5rem] border border-border bg-bg p-6 sm:p-8 whitespace-pre-wrap leading-8 text-[15px] sm:text-base print:border-0 print:p-0">
                      {letter}
                    </article>

                    <aside className="space-y-5 print:hidden">
                      <div>
                        <h4 className="font-display font-bold text-lg mb-3">Subject Signals</h4>
                        {stats.subjectHighlights.length > 0 ? (
                          <ul className="space-y-2">
                            {stats.subjectHighlights.map((subject) => (
                              <li key={subject} className="text-sm bg-bg-alt border border-border rounded-xl px-3 py-2">
                                {subject}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-sm text-text-muted">No assignment subjects recorded.</p>
                        )}
                      </div>

                      <div>
                        <h4 className="font-display font-bold text-lg mb-3">Portfolio Evidence</h4>
                        {stats.portfolioHighlights.length > 0 ? (
                          <ul className="space-y-2">
                            {stats.portfolioHighlights.map((item) => (
                              <li key={item.id} className="text-sm bg-bg-alt border border-border rounded-xl px-3 py-2">
                                <span className="font-bold block">{item.title}</span>
                                <span className="text-xs text-text-muted">{item.subject || 'General'} - {formatLongDate(item.date || item.created)}</span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-sm text-text-muted">No portfolio samples in this period.</p>
                        )}
                      </div>
                    </aside>
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
            margin: 0.55in;
          }

          body {
            background: white !important;
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
