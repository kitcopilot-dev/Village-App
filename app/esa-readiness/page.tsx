'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getPocketBase } from '@/lib/pocketbase';
import { Assignment, Attendance, Child, Course, PortfolioItem, SchoolYear } from '@/lib/types';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { LoadingScreen } from '@/components/ui/Spinner';

type ExpenseStatus = 'planned' | 'receipt_ready' | 'submitted' | 'reimbursed';

interface EsaExpense {
  id: string;
  date: string;
  vendor: string;
  category: string;
  amount: number;
  studentId: string;
  status: ExpenseStatus;
  notes?: string;
}

interface ReadinessItem {
  label: string;
  detail: string;
  complete: boolean;
  actionHref?: string;
  actionLabel?: string;
}

const STORAGE_KEY = 'village_esa_expenses_v1';

const EXPENSE_CATEGORIES = [
  'Curriculum',
  'Tutoring',
  'Books',
  'Supplies',
  'Online course',
  'Testing',
  'Therapy/support',
  'Field trip',
  'Other',
];

const STATUS_LABELS: Record<ExpenseStatus, string> = {
  planned: 'Planned',
  receipt_ready: 'Receipt ready',
  submitted: 'Submitted',
  reimbursed: 'Reimbursed',
};

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

function startOfSchoolYearFallback() {
  const now = new Date();
  const year = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
  return `${year}-08-01`;
}

function formatDate(value?: string) {
  if (!value) return 'Not set';

  const date = new Date(value.includes('T') ? value : `${value}T12:00:00`);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatMoney(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(value);
}

function isAssignmentComplete(assignment: Assignment) {
  return assignment.status === 'completed' || assignment.status === 'Graded';
}

function getSubjectCounts(items: Array<{ subject?: string }>) {
  return items.reduce<Record<string, number>>((acc, item) => {
    const subject = item.subject?.trim() || 'General';
    acc[subject] = (acc[subject] || 0) + 1;
    return acc;
  }, {});
}

function loadStoredExpenses(): EsaExpense[] {
  if (typeof window === 'undefined') return [];

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw) as EsaExpense[];
    return parsed.filter((expense) => expense.id && expense.vendor && Number.isFinite(expense.amount));
  } catch {
    return [];
  }
}

function buildChildFilter(kids: Child[]) {
  return kids.map((kid) => `child = "${kid.id}"`).join(' || ');
}

export default function EsaReadinessPage() {
  const router = useRouter();
  const pb = getPocketBase();

  const [loading, setLoading] = useState(true);
  const [kids, setKids] = useState<Child[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>([]);
  const [schoolYear, setSchoolYear] = useState<SchoolYear | null>(null);
  const [expenses, setExpenses] = useState<EsaExpense[]>([]);
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const [form, setForm] = useState({
    date: todayInputValue(),
    vendor: '',
    category: EXPENSE_CATEGORIES[0],
    amount: '',
    studentId: 'family',
    status: 'planned' as ExpenseStatus,
    notes: '',
  });

  const loadReadinessData = useCallback(async () => {
    setLoading(true);

    try {
      const userId = pb.authStore.model?.id;
      if (!userId) return;

      const childRecords = await pb.collection('children').getFullList({
        filter: `user = "${userId}"`,
        sort: 'name',
      });

      const loadedKids = childRecords as unknown as Child[];
      setKids(loadedKids);

      if (loadedKids.length === 0) {
        setCourses([]);
        setAttendance([]);
        setAssignments([]);
        setPortfolio([]);
        return;
      }

      const childFilter = buildChildFilter(loadedKids);
      const schoolYearStart = startOfSchoolYearFallback();

      const [courseRecords, attendanceRecords, assignmentRecords, portfolioRecords, yearRecords] = await Promise.all([
        pb.collection('courses').getFullList({
          filter: childFilter,
          sort: 'name',
        }).catch(() => []),
        pb.collection('attendance').getFullList({
          filter: `user = "${userId}" && date >= "${schoolYearStart}"`,
          sort: '-date',
        }).catch(() => []),
        pb.collection('assignments').getFullList({
          filter: `user = "${userId}"`,
          sort: '-updated',
        }).catch(() => []),
        pb.collection('portfolio').getFullList({
          filter: `(${childFilter})`,
          sort: '-date',
        }).catch(() => pb.collection('portfolio_items').getFullList({
          filter: `(${childFilter})`,
          sort: '-date',
        }).catch(() => [])),
        pb.collection('school_years').getFullList({
          filter: `user = "${userId}"`,
          sort: '-start_date',
          limit: 1,
        }).catch(() => []),
      ]);

      setCourses(courseRecords as unknown as Course[]);
      setAttendance(attendanceRecords as unknown as Attendance[]);
      setAssignments(assignmentRecords as unknown as Assignment[]);
      setPortfolio(portfolioRecords as unknown as PortfolioItem[]);
      setSchoolYear((yearRecords[0] as unknown as SchoolYear) || null);
    } catch (error) {
      console.error('ESA readiness load error:', error);
    } finally {
      setLoading(false);
    }
  }, [pb]);

  useEffect(() => {
    if (!pb.authStore.isValid) {
      router.push('/');
      return;
    }

    setExpenses(loadStoredExpenses());
    loadReadinessData();
  }, [loadReadinessData, pb.authStore.isValid, router]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(expenses));
    }
  }, [expenses]);

  const handleLogout = () => {
    pb.authStore.clear();
    router.push('/');
  };

  const addExpense = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const amount = Number(form.amount);
    if (!form.vendor.trim() || !Number.isFinite(amount) || amount <= 0) return;

    setExpenses((current) => [
      {
        id: crypto.randomUUID(),
        date: form.date,
        vendor: form.vendor.trim(),
        category: form.category,
        amount,
        studentId: form.studentId,
        status: form.status,
        notes: form.notes.trim() || undefined,
      },
      ...current,
    ]);

    setForm({
      date: todayInputValue(),
      vendor: '',
      category: EXPENSE_CATEGORIES[0],
      amount: '',
      studentId: form.studentId,
      status: 'planned',
      notes: '',
    });
  };

  const updateExpenseStatus = (expenseId: string, status: ExpenseStatus) => {
    setExpenses((current) => current.map((expense) => (
      expense.id === expenseId ? { ...expense, status } : expense
    )));
  };

  const deleteExpense = (expenseId: string) => {
    setExpenses((current) => current.filter((expense) => expense.id !== expenseId));
  };

  const completedAssignments = assignments.filter(isAssignmentComplete);
  const scoredAssignments = assignments.filter((assignment) => assignment.score !== undefined && assignment.score !== null);
  const portfolioSubjects = getSubjectCounts(portfolio);
  const assignmentSubjects = getSubjectCounts(completedAssignments);
  const activeCourses = courses.filter((course) => course.current_lesson <= course.total_lessons);
  const presentDays = attendance.reduce((total, record) => {
    if (record.status === 'present') return total + 1;
    if (record.status === 'half-day') return total + 0.5;
    return total;
  }, 0);
  const receiptReadyExpenses = expenses.filter((expense) => expense.status !== 'planned');
  const totalExpenseAmount = expenses.reduce((total, expense) => total + expense.amount, 0);
  const receiptReadyAmount = receiptReadyExpenses.reduce((total, expense) => total + expense.amount, 0);

  const readinessItems: ReadinessItem[] = [
    {
      label: 'Student roster',
      detail: kids.length > 0 ? `${kids.length} student${kids.length === 1 ? '' : 's'} in Village` : 'Add children before building an ESA packet',
      complete: kids.length > 0,
      actionHref: '/manage-kids',
      actionLabel: 'Manage kids',
    },
    {
      label: 'School year calendar',
      detail: schoolYear ? `${schoolYear.name}: ${formatDate(schoolYear.start_date)} - ${formatDate(schoolYear.end_date)}` : 'Define a school year for date-bounded records',
      complete: Boolean(schoolYear),
      actionHref: '/calendar',
      actionLabel: 'Open calendar',
    },
    {
      label: 'Attendance evidence',
      detail: `${presentDays} instructional day${presentDays === 1 ? '' : 's'} logged this year`,
      complete: presentDays >= 20,
      actionHref: '/attendance',
      actionLabel: 'Log attendance',
    },
    {
      label: 'Course plan',
      detail: `${activeCourses.length} active course${activeCourses.length === 1 ? '' : 's'} across ${kids.length || 0} student${kids.length === 1 ? '' : 's'}`,
      complete: activeCourses.length >= Math.max(1, kids.length),
      actionHref: '/manage-kids',
      actionLabel: 'Edit courses',
    },
    {
      label: 'Assignment trail',
      detail: `${completedAssignments.length} completed, ${scoredAssignments.length} scored`,
      complete: completedAssignments.length >= 5 && scoredAssignments.length >= 3,
      actionHref: '/assignments',
      actionLabel: 'Open assignments',
    },
    {
      label: 'Portfolio proof',
      detail: `${portfolio.length} work sample${portfolio.length === 1 ? '' : 's'} in ${Object.keys(portfolioSubjects).length} subject${Object.keys(portfolioSubjects).length === 1 ? '' : 's'}`,
      complete: portfolio.length >= Math.max(3, kids.length * 2),
      actionHref: '/portfolio',
      actionLabel: 'Add samples',
    },
    {
      label: 'Receipt packet',
      detail: `${receiptReadyExpenses.length} of ${expenses.length} expense${expenses.length === 1 ? '' : 's'} have receipt/submission status`,
      complete: expenses.length > 0 && receiptReadyExpenses.length === expenses.length,
    },
  ];

  const readinessScore = Math.round((readinessItems.filter((item) => item.complete).length / readinessItems.length) * 100);
  const nextItems = readinessItems.filter((item) => !item.complete).slice(0, 3);

  const exportText = useMemo(() => {
    const subjectLine = Object.entries({ ...assignmentSubjects, ...portfolioSubjects })
      .map(([subject]) => subject)
      .sort((a, b) => a.localeCompare(b))
      .join(', ') || 'No subject evidence yet';

    const expenseLines = expenses.map((expense) => {
      const student = kids.find((kid) => kid.id === expense.studentId)?.name || 'Family';
      return `- ${formatDate(expense.date)} | ${expense.vendor} | ${expense.category} | ${student} | ${formatMoney(expense.amount)} | ${STATUS_LABELS[expense.status]}`;
    }).join('\n') || '- No expenses logged yet';

    return [
      'Village ESA readiness summary',
      `Generated: ${formatDate(todayInputValue())}`,
      `Readiness score: ${readinessScore}%`,
      `Students: ${kids.map((kid) => kid.name).join(', ') || 'None'}`,
      `School year: ${schoolYear ? `${schoolYear.name} (${formatDate(schoolYear.start_date)} - ${formatDate(schoolYear.end_date)})` : 'Not configured'}`,
      `Instructional days logged: ${presentDays}`,
      `Active courses: ${activeCourses.length}`,
      `Completed assignments: ${completedAssignments.length}`,
      `Scored assignments: ${scoredAssignments.length}`,
      `Portfolio samples: ${portfolio.length}`,
      `Subjects represented: ${subjectLine}`,
      `Planned ESA expenses: ${formatMoney(totalExpenseAmount)}`,
      `Receipt-ready amount: ${formatMoney(receiptReadyAmount)}`,
      '',
      'Open readiness items:',
      ...(nextItems.length > 0 ? nextItems.map((item) => `- ${item.label}: ${item.detail}`) : ['- None']),
      '',
      'Expense ledger:',
      expenseLines,
    ].join('\n');
  }, [
    activeCourses.length,
    assignmentSubjects,
    completedAssignments.length,
    expenses,
    kids,
    nextItems,
    portfolio.length,
    portfolioSubjects,
    presentDays,
    readinessScore,
    receiptReadyAmount,
    schoolYear,
    scoredAssignments.length,
    totalExpenseAmount,
  ]);

  const copySummary = async () => {
    try {
      await navigator.clipboard.writeText(exportText);
      setCopyState('copied');
      setTimeout(() => setCopyState('idle'), 2200);
    } catch {
      setCopyState('failed');
      setTimeout(() => setCopyState('idle'), 2200);
    }
  };

  if (loading) {
    return <LoadingScreen message="Preparing ESA readiness workspace..." />;
  }

  return (
    <>
      <Header showLogout onLogout={handleLogout} />
      <main className="max-w-7xl mx-auto my-10 px-6 md:px-8 pb-24 animate-fade-in">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 mb-8">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-secondary mb-3">ESA Operations</p>
            <h2 className="font-display text-4xl sm:text-5xl font-extrabold tracking-tight mb-3">
              Readiness & Receipts
            </h2>
            <p className="text-text-muted text-base sm:text-lg max-w-3xl">
              See whether the family records are reimbursement-ready, then keep planned education expenses tied to receipts before submission season gets messy.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" size="sm" onClick={copySummary}>
              {copyState === 'copied' ? 'Copied' : copyState === 'failed' ? 'Copy failed' : 'Copy summary'}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => window.print()}>
              Print packet
            </Button>
          </div>
        </div>

        <section className="grid md:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)] gap-6 mb-8">
          <Card className="p-6 md:p-8" accent={readinessScore >= 80 ? 'sage' : readinessScore >= 50 ? 'mustard' : 'terracotta'}>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
              <div>
                <p className="text-sm font-bold uppercase tracking-wide text-text-muted mb-2">Readiness score</p>
                <div className="flex items-end gap-3">
                  <span className="font-display text-6xl font-extrabold leading-none text-primary">{readinessScore}</span>
                  <span className="text-2xl font-bold text-text-muted mb-1">%</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:min-w-80">
                <div className="rounded-2xl bg-bg-alt p-4">
                  <p className="text-2xl font-extrabold text-primary mb-1">{kids.length}</p>
                  <p className="text-xs uppercase tracking-wide text-text-muted font-bold">Students</p>
                </div>
                <div className="rounded-2xl bg-bg-alt p-4">
                  <p className="text-2xl font-extrabold text-primary mb-1">{presentDays}</p>
                  <p className="text-xs uppercase tracking-wide text-text-muted font-bold">Days logged</p>
                </div>
                <div className="rounded-2xl bg-bg-alt p-4">
                  <p className="text-2xl font-extrabold text-primary mb-1">{completedAssignments.length}</p>
                  <p className="text-xs uppercase tracking-wide text-text-muted font-bold">Completed</p>
                </div>
                <div className="rounded-2xl bg-bg-alt p-4">
                  <p className="text-2xl font-extrabold text-primary mb-1">{portfolio.length}</p>
                  <p className="text-xs uppercase tracking-wide text-text-muted font-bold">Samples</p>
                </div>
              </div>
            </div>

            <div className="mt-8 h-3 rounded-full bg-bg-alt overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${readinessScore}%` }}
              />
            </div>

            <div className="mt-8 grid gap-3">
              {readinessItems.map((item) => (
                <div key={item.label} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-2xl border border-border bg-bg/70 px-4 py-3">
                  <div className="flex items-start gap-3">
                    <span className={`mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-extrabold ${item.complete ? 'bg-primary text-white' : 'bg-accent-soft text-primary'}`}>
                      {item.complete ? '✓' : '!'}
                    </span>
                    <div>
                      <p className="font-bold text-text mb-0.5">{item.label}</p>
                      <p className="text-sm text-text-muted">{item.detail}</p>
                    </div>
                  </div>
                  {item.actionHref && (
                    <Button variant="ghost" size="sm" onClick={() => router.push(item.actionHref!)}>
                      {item.actionLabel}
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-6 md:p-8" accent="terracotta">
            <p className="text-sm font-bold uppercase tracking-wide text-text-muted mb-3">Next best actions</p>
            <div className="space-y-4">
              {nextItems.length === 0 ? (
                <div className="rounded-2xl bg-primary/10 border border-primary/20 p-5">
                  <p className="font-bold text-primary mb-1">Packet looks ready.</p>
                  <p className="text-sm text-text-muted">Print or copy the summary before submitting receipts.</p>
                </div>
              ) : nextItems.map((item, index) => (
                <div key={item.label} className="rounded-2xl bg-bg-alt border border-border p-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-secondary mb-2">Step {index + 1}</p>
                  <p className="font-bold mb-1">{item.label}</p>
                  <p className="text-sm text-text-muted mb-3">{item.detail}</p>
                  {item.actionHref && (
                    <Button variant="outline" size="sm" onClick={() => router.push(item.actionHref!)}>
                      {item.actionLabel}
                    </Button>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-6 rounded-2xl bg-bg-alt border border-border p-5">
              <p className="text-sm font-bold uppercase tracking-wide text-text-muted mb-3">Expense snapshot</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-2xl font-extrabold text-primary">{formatMoney(totalExpenseAmount)}</p>
                  <p className="text-xs uppercase tracking-wide text-text-muted font-bold">Planned</p>
                </div>
                <div>
                  <p className="text-2xl font-extrabold text-primary">{formatMoney(receiptReadyAmount)}</p>
                  <p className="text-xs uppercase tracking-wide text-text-muted font-bold">Receipt ready</p>
                </div>
              </div>
            </div>
          </Card>
        </section>

        <section className="grid lg:grid-cols-[420px_minmax(0,1fr)] gap-6">
          <Card className="p-6 md:p-8" accent="mustard">
            <h3 className="font-display text-2xl font-extrabold mb-5">Add ESA Expense</h3>
            <form onSubmit={addExpense}>
              <Input
                label="Date"
                type="date"
                value={form.date}
                onChange={(event) => setForm({ ...form, date: event.target.value })}
                required
              />
              <Input
                label="Vendor"
                value={form.vendor}
                onChange={(event) => setForm({ ...form, vendor: event.target.value })}
                placeholder="Math curriculum, tutor, bookstore"
                required
              />
              <div className="grid sm:grid-cols-2 gap-3">
                <Select
                  label="Category"
                  value={form.category}
                  onChange={(event) => setForm({ ...form, category: event.target.value })}
                >
                  {EXPENSE_CATEGORIES.map((category) => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </Select>
                <Input
                  label="Amount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.amount}
                  onChange={(event) => setForm({ ...form, amount: event.target.value })}
                  placeholder="0.00"
                  required
                />
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <Select
                  label="Student"
                  value={form.studentId}
                  onChange={(event) => setForm({ ...form, studentId: event.target.value })}
                >
                  <option value="family">Family/shared</option>
                  {kids.map((kid) => (
                    <option key={kid.id} value={kid.id}>{kid.name}</option>
                  ))}
                </Select>
                <Select
                  label="Status"
                  value={form.status}
                  onChange={(event) => setForm({ ...form, status: event.target.value as ExpenseStatus })}
                >
                  {Object.entries(STATUS_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </Select>
              </div>
              <Textarea
                label="Notes"
                value={form.notes}
                onChange={(event) => setForm({ ...form, notes: event.target.value })}
                placeholder="Receipt location, reimbursement rule, purchase reason"
              />
              <Button type="submit" className="w-full">Add to ledger</Button>
            </form>
          </Card>

          <Card className="p-6 md:p-8" accent="sage">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-5">
              <div>
                <h3 className="font-display text-2xl font-extrabold mb-1">Expense Ledger</h3>
                <p className="text-sm text-text-muted">Stored locally in this browser until a backend collection is added.</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => setExpenses([])} disabled={expenses.length === 0}>
                Clear ledger
              </Button>
            </div>

            {expenses.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-bg-alt p-8 text-center">
                <p className="font-bold mb-2">No expenses tracked yet.</p>
                <p className="text-sm text-text-muted">Add curriculum, tutoring, books, supplies, and testing costs as purchases happen.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {expenses.map((expense) => {
                  const student = kids.find((kid) => kid.id === expense.studentId)?.name || 'Family';

                  return (
                    <div key={expense.id} className="rounded-2xl border border-border bg-bg/70 p-4">
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                        <div>
                          <p className="font-bold text-lg">{expense.vendor}</p>
                          <p className="text-sm text-text-muted">
                            {formatDate(expense.date)} • {expense.category} • {student}
                          </p>
                          {expense.notes && <p className="text-sm text-text-muted mt-2">{expense.notes}</p>}
                        </div>
                        <p className="font-display text-2xl font-extrabold text-primary">{formatMoney(expense.amount)}</p>
                      </div>
                      <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <Select
                          value={expense.status}
                          onChange={(event) => updateExpenseStatus(expense.id, event.target.value as ExpenseStatus)}
                          className="py-2 sm:py-2 text-sm"
                          aria-label="Expense status"
                        >
                          {Object.entries(STATUS_LABELS).map(([value, label]) => (
                            <option key={value} value={value}>{label}</option>
                          ))}
                        </Select>
                        <Button variant="ghost" size="sm" onClick={() => deleteExpense(expense.id)}>
                          Remove
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </section>
      </main>
    </>
  );
}
