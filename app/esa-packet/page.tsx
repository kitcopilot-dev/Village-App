'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getPocketBase } from '@/lib/pocketbase';
import { Assignment, Attendance, Child, Course, PortfolioItem } from '@/lib/types';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { Toast } from '@/components/ui/Toast';
import { LoadingScreen } from '@/components/ui/Spinner';

type PeriodOption = '30' | '60' | '90' | '180' | '365';
type ExpenseCategory = 'educational-software' | 'curriculum' | 'online-course' | 'tutoring' | 'co-op' | 'supplies' | 'other';

interface ExpenseLine {
  id: string;
  date: string;
  vendor: string;
  category: ExpenseCategory;
  description: string;
  amount: string;
}

interface ChildPacket {
  child: Child;
  attendance: Attendance[];
  assignments: Assignment[];
  courses: Course[];
  portfolio: PortfolioItem[];
}

interface PacketTotals {
  activeDays: number;
  completedAssignments: number;
  gradedAssignments: number;
  averageScore: number | null;
  portfolioItems: number;
  subjects: string[];
  expenses: number;
}

const PERIOD_LABELS: Record<PeriodOption, string> = {
  '30': 'Last 30 days',
  '60': 'Last 60 days',
  '90': 'Last 90 days',
  '180': 'Last 180 days',
  '365': 'Last 12 months',
};

const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  'educational-software': 'Educational software',
  curriculum: 'Curriculum',
  'online-course': 'Online course',
  tutoring: 'Tutoring',
  'co-op': 'Co-op or microschool',
  supplies: 'Learning supplies',
  other: 'Other educational expense',
};

function toDateInputValue(date: Date): string {
  return date.toISOString().split('T')[0];
}

function formatDate(value: string | Date): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return 'Not dated';

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatCurrency(value: string | number): string {
  const amount = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(amount)) return '$0.00';

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

function normalizeStatus(status?: string): string {
  return (status || '').toLowerCase();
}

function isAssignmentComplete(assignment: Assignment): boolean {
  const status = normalizeStatus(assignment.status);
  return status === 'completed' || status === 'graded';
}

function isActiveAttendance(day: Attendance): boolean {
  return day.status === 'present' || day.status === 'half-day';
}

function getAssignmentDate(assignment: Assignment): Date {
  return new Date(assignment.due_date || assignment.updated || assignment.created);
}

function getPortfolioDate(item: PortfolioItem): Date {
  return new Date(item.date || item.created);
}

function newExpenseLine(): ExpenseLine {
  return {
    id: crypto.randomUUID(),
    date: toDateInputValue(new Date()),
    vendor: 'Village',
    category: 'educational-software',
    description: 'Homeschool recordkeeping, portfolio, attendance, and reporting workspace',
    amount: '',
  };
}

function summarizeSubjects(records: ChildPacket[]): string[] {
  const subjects = new Set<string>();

  records.forEach((record) => {
    record.assignments.forEach((assignment) => {
      subjects.add(assignment.subject?.trim() || 'General studies');
    });
    record.portfolio.forEach((item) => {
      subjects.add(item.subject?.trim() || 'Portfolio evidence');
    });
    record.courses.forEach((course) => {
      subjects.add(course.name);
    });
  });

  return Array.from(subjects).filter(Boolean).sort((a, b) => a.localeCompare(b));
}

function buildTotals(records: ChildPacket[], expenses: ExpenseLine[]): PacketTotals {
  const gradedAssignments = records.flatMap((record) => record.assignments).filter((assignment) => typeof assignment.score === 'number');
  const subjects = summarizeSubjects(records);

  return {
    activeDays: records.reduce((sum, record) => sum + record.attendance.filter(isActiveAttendance).length, 0),
    completedAssignments: records.reduce((sum, record) => sum + record.assignments.filter(isAssignmentComplete).length, 0),
    gradedAssignments: gradedAssignments.length,
    averageScore: gradedAssignments.length > 0
      ? Math.round(gradedAssignments.reduce((sum, assignment) => sum + (assignment.score || 0), 0) / gradedAssignments.length)
      : null,
    portfolioItems: records.reduce((sum, record) => sum + record.portfolio.length, 0),
    subjects,
    expenses: expenses.reduce((sum, expense) => sum + (Number(expense.amount) || 0), 0),
  };
}

function buildCopyText(
  records: ChildPacket[],
  expenses: ExpenseLine[],
  totals: PacketTotals,
  startDate: Date,
  endDate: Date,
  purposeStatement: string,
): string {
  const childSections = records.map((record) => {
    const completed = record.assignments.filter(isAssignmentComplete);
    const activeDays = record.attendance.filter(isActiveAttendance).length;
    const portfolioTitles = record.portfolio.slice(0, 6).map((item) => item.title).join(', ') || 'No portfolio evidence attached';
    const courseProgress = record.courses.length > 0
      ? record.courses.map((course) => `${course.name}: lesson ${Math.min(course.current_lesson, course.total_lessons)} of ${course.total_lessons}`).join('; ')
      : 'No courses listed';

    return [
      `${record.child.name}${record.child.grade ? `, ${record.child.grade}` : ''}`,
      `Active homeschool days: ${activeDays}`,
      `Completed assignments: ${completed.length}`,
      `Course progress: ${courseProgress}`,
      `Portfolio evidence: ${portfolioTitles}`,
    ].join('\n');
  });

  const expenseLines = expenses.length > 0
    ? expenses.map((expense) => `${formatDate(expense.date)} | ${expense.vendor || 'Vendor'} | ${CATEGORY_LABELS[expense.category]} | ${formatCurrency(expense.amount)} | ${expense.description}`).join('\n')
    : 'No expenses entered.';

  return [
    'Village ESA Documentation Packet',
    `Period: ${formatDate(startDate)} to ${formatDate(endDate)}`,
    '',
    'Summary',
    `Active homeschool days: ${totals.activeDays}`,
    `Completed assignments: ${totals.completedAssignments}`,
    `Portfolio evidence items: ${totals.portfolioItems}`,
    `Subjects covered: ${totals.subjects.join(', ') || 'None recorded'}`,
    `Entered expenses: ${formatCurrency(totals.expenses)}`,
    '',
    'Educational purpose',
    purposeStatement,
    '',
    'Student records',
    childSections.join('\n\n'),
    '',
    'Expense log',
    expenseLines,
    '',
    'Note: This packet organizes Village records for parent-choice and reimbursement workflows. It does not claim approval by any ESA program and is not legal, tax, or reimbursement advice.',
  ].join('\n');
}

export default function EsaPacketPage() {
  const router = useRouter();
  const pb = getPocketBase();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [period, setPeriod] = useState<PeriodOption>('90');
  const [records, setRecords] = useState<ChildPacket[]>([]);
  const [expenses, setExpenses] = useState<ExpenseLine[]>([newExpenseLine()]);
  const [purposeStatement, setPurposeStatement] = useState(
    'Village was used to organize homeschool planning, attendance, assignments, portfolio evidence, and parent-facing reports for educational recordkeeping.',
  );
  const [copied, setCopied] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

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

      const childPackets = await Promise.all(
        (childRecords as unknown as Child[]).map(async (child) => {
          const [attendance, assignments, courses, portfolio] = await Promise.all([
            pb.collection('attendance').getFullList({
              filter: `child = "${child.id}" && date >= "${startStr}" && date <= "${endStr}"`,
              sort: '-date',
            }).catch(() => []),
            pb.collection('assignments').getFullList({
              filter: `child = "${child.id}" && (due_date >= "${startStr}" && due_date <= "${endStr}" || updated >= "${startStr}")`,
              sort: '-due_date',
            }).catch(() => []),
            pb.collection('courses').getFullList({
              filter: `child = "${child.id}"`,
              sort: 'name',
            }).catch(() => []),
            loadPortfolio(child.id, startStr, endStr),
          ]);

          return {
            child,
            attendance: attendance as unknown as Attendance[],
            assignments: assignments as unknown as Assignment[],
            courses: courses as unknown as Course[],
            portfolio,
          };
        }),
      );

      setRecords(childPackets);
    } catch (error) {
      console.error('ESA packet load error:', error);
      setToast({ message: 'Could not load ESA packet records.', type: 'error' });
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

  const totals = useMemo(() => buildTotals(records, expenses), [records, expenses]);

  const updateExpense = (id: string, field: keyof ExpenseLine, value: string) => {
    setExpenses((current) => current.map((expense) => (
      expense.id === id ? { ...expense, [field]: value } : expense
    )));
  };

  const removeExpense = (id: string) => {
    setExpenses((current) => current.filter((expense) => expense.id !== id));
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(buildCopyText(records, expenses, totals, dateRange.start, dateRange.end, purposeStatement));
      setCopied(true);
      setToast({ message: 'Packet summary copied.', type: 'success' });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Copy failed:', error);
      setToast({ message: 'Copy failed. Use print instead.', type: 'error' });
    }
  };

  const handleLogout = () => {
    pb.authStore.clear();
    router.push('/');
  };

  if (loading) {
    return <LoadingScreen message="Loading ESA packet..." />;
  }

  return (
    <>
      <Header showLogout onLogout={handleLogout} />
      <main className="max-w-7xl mx-auto my-8 sm:my-12 px-4 sm:px-8 pb-20 animate-fade-in">
        <div className="print:hidden mb-8 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-secondary mb-3">Records and reimbursement</p>
            <h2 className="font-display text-4xl sm:text-5xl font-extrabold tracking-tight mb-2">ESA Documentation Packet</h2>
            <p className="text-text-muted max-w-3xl">
              Assemble a parent-ready packet with attendance, completed work, portfolio evidence, course progress, and itemized expenses.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" size="sm" onClick={() => router.push('/dashboard')}>Dashboard</Button>
            <Button variant="ghost" size="sm" onClick={loadRecords} disabled={refreshing}>
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </Button>
            <Button variant="outline" size="sm" onClick={handleCopy}>{copied ? 'Copied' : 'Copy Summary'}</Button>
            <Button size="sm" onClick={() => window.print()}>Print / Save PDF</Button>
          </div>
        </div>

        <div className="grid lg:grid-cols-[minmax(0,360px)_1fr] gap-8 print:block">
          <aside className="print:hidden space-y-6">
            <Card className="p-6 md:p-7">
              <h3 className="font-display text-xl font-bold text-primary mb-5">Packet controls</h3>
              <Select label="Date Range" value={period} onChange={(event) => setPeriod(event.target.value as PeriodOption)}>
                {Object.entries(PERIOD_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </Select>
              <Textarea
                label="Educational Purpose"
                value={purposeStatement}
                onChange={(event) => setPurposeStatement(event.target.value)}
                className="min-h-40"
              />
              <div className="rounded-2xl bg-bg-alt border border-border p-4 text-sm text-text-muted">
                Keep claims boring and specific: what was purchased, what learning need it supported, and which records prove activity.
              </div>
            </Card>

            <Card className="p-6 md:p-7">
              <div className="flex items-center justify-between gap-4 mb-5">
                <h3 className="font-display text-xl font-bold text-primary">Expense log</h3>
                <Button size="sm" variant="outline" onClick={() => setExpenses((current) => [...current, newExpenseLine()])}>Add</Button>
              </div>

              <div className="space-y-5">
                {expenses.map((expense, index) => (
                  <div key={expense.id} className="rounded-2xl border border-border bg-bg p-4">
                    <div className="flex justify-between items-center mb-3">
                      <p className="text-xs font-bold uppercase tracking-wide text-text-muted">Expense {index + 1}</p>
                      {expenses.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeExpense(expense.id)}
                          className="text-xs font-bold text-red-600 hover:text-red-700"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                    <Input label="Date" type="date" value={expense.date} onChange={(event) => updateExpense(expense.id, 'date', event.target.value)} />
                    <Input label="Vendor" value={expense.vendor} onChange={(event) => updateExpense(expense.id, 'vendor', event.target.value)} />
                    <Select label="Category" value={expense.category} onChange={(event) => updateExpense(expense.id, 'category', event.target.value)}>
                      {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </Select>
                    <Input label="Amount" inputMode="decimal" placeholder="0.00" value={expense.amount} onChange={(event) => updateExpense(expense.id, 'amount', event.target.value)} />
                    <Textarea label="Description" value={expense.description} onChange={(event) => updateExpense(expense.id, 'description', event.target.value)} />
                  </div>
                ))}
              </div>
            </Card>
          </aside>

          <section className="bg-white border-2 border-border rounded-[2rem] p-6 sm:p-10 lg:p-12 shadow-shadow print:shadow-none print:border-0 print:p-0 print:rounded-none">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6 border-b-4 border-primary/10 pb-8 mb-8">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary mb-3">Village Homeschool</p>
                <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-primary m-0">ESA Documentation Packet</h1>
                <p className="text-text-muted mt-2">
                  {formatDate(dateRange.start)} to {formatDate(dateRange.end)}
                </p>
              </div>
              <div className="md:text-right">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-text-muted mb-2">Generated</p>
                <p className="font-bold">{formatDate(new Date())}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-8">
              <div className="rounded-2xl bg-bg-alt border border-border p-4">
                <p className="text-xs font-bold uppercase text-text-muted">Active days</p>
                <p className="font-display text-3xl font-extrabold text-primary">{totals.activeDays}</p>
              </div>
              <div className="rounded-2xl bg-bg-alt border border-border p-4">
                <p className="text-xs font-bold uppercase text-text-muted">Completed</p>
                <p className="font-display text-3xl font-extrabold text-secondary">{totals.completedAssignments}</p>
              </div>
              <div className="rounded-2xl bg-bg-alt border border-border p-4">
                <p className="text-xs font-bold uppercase text-text-muted">Evidence</p>
                <p className="font-display text-3xl font-extrabold text-accent">{totals.portfolioItems}</p>
              </div>
              <div className="rounded-2xl bg-bg-alt border border-border p-4">
                <p className="text-xs font-bold uppercase text-text-muted">Avg score</p>
                <p className="font-display text-3xl font-extrabold text-primary">{totals.averageScore ?? 'N/A'}{totals.averageScore !== null ? '%' : ''}</p>
              </div>
              <div className="rounded-2xl bg-bg-alt border border-border p-4">
                <p className="text-xs font-bold uppercase text-text-muted">Expenses</p>
                <p className="font-display text-2xl font-extrabold text-secondary">{formatCurrency(totals.expenses)}</p>
              </div>
            </div>

            <div className="mb-8">
              <h3 className="font-display text-xl font-bold text-primary mb-3">Educational purpose</h3>
              <p className="rounded-2xl border border-border bg-bg-alt p-4 text-sm leading-7 text-text-main">{purposeStatement}</p>
            </div>

            <div className="mb-10">
              <h3 className="font-display text-xl font-bold text-primary mb-3">Subjects covered</h3>
              {totals.subjects.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {totals.subjects.map((subject) => (
                    <span key={subject} className="rounded-full bg-primary/10 text-primary px-3 py-1 text-xs font-bold">{subject}</span>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-text-muted">No subjects were found in the selected date range.</p>
              )}
            </div>

            <div className="space-y-8 mb-10">
              {records.length === 0 ? (
                <div className="rounded-2xl border-2 border-dashed border-border bg-bg-alt p-8 text-center">
                  <p className="font-bold text-primary mb-2">No student records yet</p>
                  <p className="text-sm text-text-muted">Add children, assignments, attendance, or portfolio samples before generating a packet.</p>
                </div>
              ) : (
                records.map((record) => {
                  const completed = record.assignments.filter(isAssignmentComplete);
                  const graded = record.assignments.filter((assignment) => typeof assignment.score === 'number');
                  const activeDays = record.attendance.filter(isActiveAttendance).length;

                  return (
                    <article key={record.child.id} className="print:break-inside-avoid rounded-2xl border border-border overflow-hidden">
                      <div className="bg-bg-alt px-5 py-4 border-b border-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <div>
                          <h3 className="font-display text-2xl font-bold text-primary m-0">{record.child.name}</h3>
                          <p className="text-sm text-text-muted">{record.child.grade || 'Grade not set'}{record.child.focus ? ` | ${record.child.focus}` : ''}</p>
                        </div>
                        <p className="text-sm font-bold text-secondary">{activeDays} active days</p>
                      </div>
                      <div className="p-5 grid lg:grid-cols-2 gap-6">
                        <div>
                          <h4 className="font-bold text-primary mb-3">Course progress</h4>
                          {record.courses.length > 0 ? (
                            <div className="space-y-2">
                              {record.courses.map((course) => {
                                const completedLessons = Math.max(0, Math.min(course.current_lesson - 1, course.total_lessons));
                                const percent = course.total_lessons > 0 ? Math.round((completedLessons / course.total_lessons) * 100) : 0;

                                return (
                                  <div key={course.id} className="rounded-xl bg-bg-alt p-3">
                                    <div className="flex justify-between gap-3 text-sm font-bold">
                                      <span>{course.name}</span>
                                      <span>{percent}%</span>
                                    </div>
                                    <p className="text-xs text-text-muted mt-1">{completedLessons} of {course.total_lessons} lessons complete</p>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <p className="text-sm text-text-muted">No courses listed.</p>
                          )}
                        </div>

                        <div>
                          <h4 className="font-bold text-primary mb-3">Completed work</h4>
                          {completed.length > 0 ? (
                            <div className="space-y-2">
                              {completed.slice(0, 6).map((assignment) => (
                                <div key={assignment.id} className="rounded-xl bg-bg-alt p-3">
                                  <div className="flex justify-between gap-3 text-sm font-bold">
                                    <span>{assignment.title}</span>
                                    {typeof assignment.score === 'number' && <span>{assignment.score}%</span>}
                                  </div>
                                  <p className="text-xs text-text-muted mt-1">
                                    {(assignment.subject || 'General studies')} | {formatDate(getAssignmentDate(assignment))}
                                  </p>
                                </div>
                              ))}
                              {completed.length > 6 && <p className="text-xs text-text-muted">Plus {completed.length - 6} more completed assignments.</p>}
                            </div>
                          ) : (
                            <p className="text-sm text-text-muted">No completed assignments in this period.</p>
                          )}
                        </div>

                        <div>
                          <h4 className="font-bold text-primary mb-3">Portfolio evidence</h4>
                          {record.portfolio.length > 0 ? (
                            <div className="space-y-2">
                              {record.portfolio.slice(0, 6).map((item) => (
                                <div key={item.id} className="rounded-xl bg-bg-alt p-3">
                                  <p className="text-sm font-bold">{item.title}</p>
                                  <p className="text-xs text-text-muted">
                                    {(item.subject || 'Portfolio evidence')} | {formatDate(getPortfolioDate(item))}
                                  </p>
                                  {item.description && <p className="text-xs text-text-muted mt-2">{item.description}</p>}
                                </div>
                              ))}
                              {record.portfolio.length > 6 && <p className="text-xs text-text-muted">Plus {record.portfolio.length - 6} more portfolio items.</p>}
                            </div>
                          ) : (
                            <p className="text-sm text-text-muted">No portfolio evidence in this period.</p>
                          )}
                        </div>

                        <div>
                          <h4 className="font-bold text-primary mb-3">Record checks</h4>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between rounded-xl bg-bg-alt p-3">
                              <span>Attendance records</span>
                              <strong>{record.attendance.length}</strong>
                            </div>
                            <div className="flex justify-between rounded-xl bg-bg-alt p-3">
                              <span>Completed assignments</span>
                              <strong>{completed.length}</strong>
                            </div>
                            <div className="flex justify-between rounded-xl bg-bg-alt p-3">
                              <span>Graded assignments</span>
                              <strong>{graded.length}</strong>
                            </div>
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                })
              )}
            </div>

            <div className="mb-10 print:break-inside-avoid">
              <h3 className="font-display text-xl font-bold text-primary mb-3">Itemized expense log</h3>
              <div className="overflow-x-auto rounded-2xl border border-border">
                <table className="w-full border-collapse text-sm">
                  <thead className="bg-bg-alt text-left">
                    <tr>
                      <th className="px-4 py-3 font-bold text-text-muted">Date</th>
                      <th className="px-4 py-3 font-bold text-text-muted">Vendor</th>
                      <th className="px-4 py-3 font-bold text-text-muted">Category</th>
                      <th className="px-4 py-3 font-bold text-text-muted">Description</th>
                      <th className="px-4 py-3 font-bold text-text-muted text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {expenses.map((expense) => (
                      <tr key={expense.id}>
                        <td className="px-4 py-3 whitespace-nowrap">{formatDate(expense.date)}</td>
                        <td className="px-4 py-3 font-bold">{expense.vendor || 'Vendor'}</td>
                        <td className="px-4 py-3">{CATEGORY_LABELS[expense.category]}</td>
                        <td className="px-4 py-3 min-w-[220px]">{expense.description}</td>
                        <td className="px-4 py-3 text-right font-bold">{formatCurrency(expense.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-bg-alt">
                    <tr>
                      <td colSpan={4} className="px-4 py-3 text-right font-bold">Total</td>
                      <td className="px-4 py-3 text-right font-bold">{formatCurrency(totals.expenses)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-bg-alt p-5 text-sm text-text-muted">
              <strong className="text-primary">Parent review note:</strong> This packet organizes Village records for parent-choice and reimbursement workflows. It does not claim approval by any ESA program and is not legal, tax, or reimbursement advice.
            </div>
          </section>
        </div>
      </main>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </>
  );
}
