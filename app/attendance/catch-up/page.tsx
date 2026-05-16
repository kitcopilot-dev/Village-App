'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Select } from '@/components/ui/Input';
import { LoadingScreen } from '@/components/ui/Spinner';
import { Toast } from '@/components/ui/Toast';
import { getPocketBase } from '@/lib/pocketbase';
import { Attendance, Child } from '@/lib/types';

const RANGE_OPTIONS = [
  { value: 7, label: 'Last 7 days' },
  { value: 14, label: 'Last 14 days' },
  { value: 30, label: 'Last 30 days' }
];

function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function makeDateRange(daysBack: number): Date[] {
  const today = new Date();
  today.setHours(12, 0, 0, 0);

  return Array.from({ length: daysBack }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (daysBack - 1 - index));
    return date;
  });
}

function getShortLabel(date: Date): string {
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function isWeekday(date: Date): boolean {
  const day = date.getDay();
  return day !== 0 && day !== 6;
}

function getCellKey(childId: string, dateKey: string): string {
  return `${childId}:${dateKey}`;
}

export default function AttendanceCatchUpPage() {
  const router = useRouter();
  const pb = getPocketBase();

  const [kids, setKids] = useState<Child[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [daysBack, setDaysBack] = useState(14);
  const [loading, setLoading] = useState(true);
  const [savingAll, setSavingAll] = useState(false);
  const [savingCells, setSavingCells] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const days = useMemo(() => makeDateRange(daysBack), [daysBack]);
  const startKey = days.length > 0 ? toDateKey(days[0]) : '';
  const endKey = days.length > 0 ? toDateKey(days[days.length - 1]) : '';
  const weekdayCount = days.filter(isWeekday).length;

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const userId = pb.authStore.model?.id;
      if (!userId) return;

      const [kidRecords, attendanceRecords] = await Promise.all([
        pb.collection('children').getFullList({
          filter: `user = "${userId}"`,
          sort: 'name'
        }),
        pb.collection('attendance').getFullList({
          filter: `user = "${userId}" && date >= "${startKey}" && date <= "${endKey}"`,
          sort: 'date'
        }).catch(() => [])
      ]);

      setKids(kidRecords as unknown as Child[]);
      setAttendance(attendanceRecords as unknown as Attendance[]);
    } catch (error) {
      console.error('Attendance catch-up load error:', error);
      setToast({ message: 'Failed to load attendance catch-up data', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [endKey, pb, startKey]);

  useEffect(() => {
    if (!pb.authStore.isValid) {
      router.push('/');
      return;
    }

    loadData();
  }, [loadData, pb.authStore.isValid, router]);

  const attendanceByCell = useMemo(() => {
    const map = new Map<string, Attendance>();
    attendance.forEach((record) => {
      const dateKey = record.date.slice(0, 10);
      map.set(getCellKey(record.child, dateKey), record);
    });
    return map;
  }, [attendance]);

  const totalLogged = attendance.length;
  const expectedWeekdays = kids.length * weekdayCount;
  const loggedWeekdays = attendance.filter((record) => {
    const date = new Date(`${record.date.slice(0, 10)}T12:00:00`);
    return isWeekday(date);
  }).length;
  const missingWeekdays = Math.max(expectedWeekdays - loggedWeekdays, 0);
  const completionPercent = expectedWeekdays > 0 ? Math.round((loggedWeekdays / expectedWeekdays) * 100) : 0;

  const setCellSaving = (cellKey: string, isSaving: boolean) => {
    setSavingCells((current) => {
      const next = new Set(current);
      if (isSaving) {
        next.add(cellKey);
      } else {
        next.delete(cellKey);
      }
      return next;
    });
  };

  const toggleAttendance = async (childId: string, date: Date) => {
    const userId = pb.authStore.model?.id;
    const dateKey = toDateKey(date);
    const cellKey = getCellKey(childId, dateKey);
    const existing = attendanceByCell.get(cellKey);

    if (!userId || savingCells.has(cellKey)) return;

    try {
      setCellSaving(cellKey, true);

      if (existing) {
        await pb.collection('attendance').delete(existing.id);
        setAttendance((records) => records.filter((record) => record.id !== existing.id));
      } else {
        const record = await pb.collection('attendance').create({
          user: userId,
          child: childId,
          date: new Date(`${dateKey}T12:00:00Z`),
          status: 'present'
        });
        setAttendance((records) => [...records, record as unknown as Attendance]);
      }
    } catch (error) {
      console.error('Attendance toggle error:', error);
      setToast({ message: 'Could not update that attendance day', type: 'error' });
    } finally {
      setCellSaving(cellKey, false);
    }
  };

  const markMissingWeekdays = async (childId?: string) => {
    const userId = pb.authStore.model?.id;
    if (!userId || savingAll) return;

    const targetKids = childId ? kids.filter((kid) => kid.id === childId) : kids;
    const missingCells = targetKids.flatMap((kid) =>
      days
        .filter(isWeekday)
        .map((date) => ({ kid, dateKey: toDateKey(date) }))
        .filter(({ kid, dateKey }) => !attendanceByCell.has(getCellKey(kid.id, dateKey)))
    );

    if (missingCells.length === 0) {
      setToast({ message: 'All selected weekdays are already logged', type: 'success' });
      return;
    }

    try {
      setSavingAll(true);
      const createdRecords = await Promise.all(
        missingCells.map(({ kid, dateKey }) =>
          pb.collection('attendance').create({
            user: userId,
            child: kid.id,
            date: new Date(`${dateKey}T12:00:00Z`),
            status: 'present'
          })
        )
      );

      setAttendance((records) => [...records, ...(createdRecords as unknown as Attendance[])]);
      setToast({
        message: `Logged ${createdRecords.length} missing weekday${createdRecords.length === 1 ? '' : 's'}`,
        type: 'success'
      });
    } catch (error) {
      console.error('Bulk attendance error:', error);
      setToast({ message: 'Bulk attendance update failed', type: 'error' });
    } finally {
      setSavingAll(false);
    }
  };

  const getKidSummary = (kid: Child) => {
    const kidRecords = attendance.filter((record) => record.child === kid.id);
    const kidWeekdayRecords = kidRecords.filter((record) => {
      const date = new Date(`${record.date.slice(0, 10)}T12:00:00`);
      return isWeekday(date);
    });
    const missing = days
      .filter(isWeekday)
      .map((date) => toDateKey(date))
      .filter((dateKey) => !attendanceByCell.has(getCellKey(kid.id, dateKey)));

    return {
      logged: kidRecords.length,
      weekdayLogged: kidWeekdayRecords.length,
      missing
    };
  };

  const copySummary = async () => {
    const lines = [
      `Village attendance catch-up: ${startKey} to ${endKey}`,
      `Overall weekday coverage: ${loggedWeekdays}/${expectedWeekdays} (${completionPercent}%)`,
      '',
      ...kids.map((kid) => {
        const summary = getKidSummary(kid);
        const missing = summary.missing.length > 0 ? summary.missing.join(', ') : 'none';
        return `${kid.name}: ${summary.weekdayLogged}/${weekdayCount} weekdays logged. Missing weekdays: ${missing}.`;
      })
    ];

    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setToast({ message: 'Attendance summary copied', type: 'success' });
    } catch {
      setToast({ message: 'Could not copy summary', type: 'error' });
    }
  };

  const handleLogout = () => {
    pb.authStore.clear();
    router.push('/');
  };

  if (loading) return <LoadingScreen message="Loading attendance catch-up..." />;

  if (kids.length === 0) {
    return (
      <>
        <Header showLogout onLogout={handleLogout} />
        <main className="max-w-4xl mx-auto my-12 px-8 text-center">
          <Card className="py-20">
            <p className="text-xl text-text-muted mb-8 italic font-serif">No children found in your village.</p>
            <Button onClick={() => router.push('/manage-kids')}>Add Your First Child</Button>
          </Card>
        </main>
      </>
    );
  }

  return (
    <>
      <Header showLogout onLogout={handleLogout} />
      <main className="max-w-7xl mx-auto my-12 px-4 sm:px-8 pb-24 animate-fade-in">
        <div className="flex flex-col lg:flex-row lg:justify-between lg:items-end gap-6 mb-10">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-secondary mb-3">Attendance tools</p>
            <h2 className="font-display text-4xl sm:text-6xl font-extrabold tracking-tight mb-3">Catch-Up Grid</h2>
            <p className="text-text-muted text-sm sm:text-base font-serif italic max-w-2xl">
              Fill a whole week or month of homeschool attendance without opening each student calendar.
            </p>
          </div>
          <div className="flex gap-3 flex-wrap">
            <Button variant="ghost" onClick={() => router.push('/attendance')}>Monthly View</Button>
            <Button variant="ghost" onClick={() => router.push('/dashboard')}>Dashboard</Button>
          </div>
        </div>

        <div className="grid lg:grid-cols-[320px_1fr] gap-8 items-start">
          <div className="space-y-6">
            <Card className="p-6">
              <Select
                label="Range"
                value={String(daysBack)}
                onChange={(event) => setDaysBack(Number(event.target.value))}
              >
                {RANGE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </Select>

              <div className="grid grid-cols-2 gap-3 mt-4">
                <div className="rounded-[1.25rem] bg-bg-alt border border-border p-4">
                  <div className="text-3xl font-display font-extrabold text-primary">{completionPercent}%</div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted">Weekday coverage</p>
                </div>
                <div className="rounded-[1.25rem] bg-bg-alt border border-border p-4">
                  <div className="text-3xl font-display font-extrabold text-secondary">{missingWeekdays}</div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted">Weekdays missing</p>
                </div>
              </div>

              <div className="mt-5 text-sm text-text-muted">
                <p><strong className="text-text">{totalLogged}</strong> total attendance days in this range.</p>
                <p>{startKey} through {endKey}</p>
              </div>
            </Card>

            <Card className="p-6 bg-secondary/5 border-secondary/20">
              <h3 className="font-display text-lg font-bold mb-4">Fast Actions</h3>
              <div className="space-y-3">
                <Button
                  className="w-full"
                  onClick={() => markMissingWeekdays()}
                  disabled={savingAll}
                >
                  {savingAll ? 'Saving...' : 'Mark All Weekdays Present'}
                </Button>
                <Button variant="outline" className="w-full" onClick={copySummary}>
                  Copy Compliance Summary
                </Button>
              </div>
              <p className="text-xs text-text-muted mt-4">
                Bulk marking only creates missing weekday records. Existing records stay untouched.
              </p>
            </Card>
          </div>

          <Card className="p-4 sm:p-6 overflow-x-auto">
            <div className="min-w-[760px]">
              <div
                className="grid gap-2 mb-3"
                style={{ gridTemplateColumns: `180px repeat(${days.length}, minmax(54px, 1fr))` }}
              >
                <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-text-muted px-2 py-3">
                  Student
                </div>
                {days.map((date) => {
                  const weekday = isWeekday(date);
                  return (
                    <div
                      key={toDateKey(date)}
                      className={`rounded-2xl px-2 py-3 text-center border ${weekday ? 'bg-bg-alt border-border' : 'bg-bg/60 border-transparent opacity-60'}`}
                    >
                      <div className="text-[10px] font-bold uppercase tracking-wide text-text-muted">
                        {date.toLocaleDateString('en-US', { weekday: 'short' })}
                      </div>
                      <div className="text-sm font-display font-bold text-text">
                        {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="space-y-3">
                {kids.map((kid) => {
                  const summary = getKidSummary(kid);
                  return (
                    <div
                      key={kid.id}
                      className="grid gap-2 items-center"
                      style={{ gridTemplateColumns: `180px repeat(${days.length}, minmax(54px, 1fr))` }}
                    >
                      <div className="rounded-[1.25rem] bg-card border border-border px-4 py-3">
                        <div className="font-display font-bold text-lg leading-tight">{kid.name}</div>
                        <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted">
                          {summary.weekdayLogged}/{weekdayCount} weekdays
                        </div>
                        <button
                          type="button"
                          onClick={() => markMissingWeekdays(kid.id)}
                          disabled={savingAll}
                          className="mt-2 text-xs font-bold text-primary hover:text-primary-dark disabled:opacity-50"
                        >
                          Fill weekdays
                        </button>
                      </div>

                      {days.map((date) => {
                        const dateKey = toDateKey(date);
                        const cellKey = getCellKey(kid.id, dateKey);
                        const isLogged = attendanceByCell.has(cellKey);
                        const isSaving = savingCells.has(cellKey);
                        const weekday = isWeekday(date);

                        return (
                          <button
                            key={cellKey}
                            type="button"
                            aria-label={`${isLogged ? 'Remove' : 'Mark'} attendance for ${kid.name} on ${getShortLabel(date)}`}
                            onClick={() => toggleAttendance(kid.id, date)}
                            disabled={isSaving || savingAll}
                            className={`
                              h-14 rounded-2xl border-2 text-sm font-display font-extrabold transition-all
                              focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 disabled:cursor-wait
                              ${isLogged
                                ? 'bg-primary text-white border-primary shadow-sm hover:bg-primary-dark'
                                : 'bg-bg-alt text-text-muted border-transparent hover:border-primary hover:bg-white'
                              }
                              ${!weekday && !isLogged ? 'opacity-50' : ''}
                            `}
                          >
                            {isSaving ? '...' : isLogged ? '✓' : ''}
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </Card>
        </div>
      </main>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </>
  );
}
