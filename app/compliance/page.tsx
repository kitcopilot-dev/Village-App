'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { getPocketBase } from '@/lib/pocketbase';
import { Child, Attendance, Assignment } from '@/lib/types';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { LoadingScreen } from '@/components/ui/Spinner';
import { Toast } from '@/components/ui/Toast';
import { ProgressBar } from '@/components/ui/ProgressBar';

const TEXAS_REQUIRED_DAYS = 180;

interface GapDay {
  date: string;
  reason: string;
  assignmentCount: number;
}

export default function CompliancePage() {
  const router = useRouter();
  const pb = getPocketBase();

  const [kids, setKids] = useState<Child[]>([]);
  const [selectedKidId, setSelectedKidId] = useState('');
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [backfilling, setBackfilling] = useState<string | null>(null);

  useEffect(() => {
    if (!pb.authStore.isValid) {
      router.push('/');
      return;
    }
    loadInitialData();
  }, []);

  useEffect(() => {
    if (selectedKidId) {
      loadKidData(selectedKidId);
    }
  }, [selectedKidId]);

  const loadInitialData = async () => {
    try {
      const userId = pb.authStore.model?.id;
      if (!userId) return;

      const kidRecords = await pb.collection('children').getFullList({
        filter: `user = "${userId}"`,
        sort: 'name',
      });

      setKids(kidRecords as unknown as Child[]);
      if (kidRecords.length > 0) {
        setSelectedKidId(kidRecords[0].id);
      } else {
        setLoading(false);
      }
    } catch (error) {
      console.error('Initial load error:', error);
      setLoading(false);
    }
  };

  const loadKidData = async (kidId: string) => {
    try {
      const userId = pb.authStore.model?.id;

      const [attendanceRecords, assignmentRecords] = await Promise.all([
        pb.collection('attendance').getFullList({
          filter: `child = "${kidId}"`,
        }),
        pb.collection('assignments').getFullList({
          filter: `child = "${kidId}"`,
        }),
      ]);

      setAttendance(attendanceRecords as unknown as Attendance[]);
      setAssignments(assignmentRecords as unknown as Assignment[]);
    } catch (error) {
      console.error('Kid data load error:', error);
    } finally {
      setLoading(false);
    }
  };

  // Calculate school year bounds (Aug 1 - Jul 31)
  const schoolYearBounds = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    // If we're in Aug-Dec, school year started this year
    // If we're in Jan-Jul, school year started last year
    const startYear = currentMonth >= 7 ? currentYear : currentYear - 1;

    return {
      start: new Date(startYear, 7, 1), // Aug 1
      end: new Date(startYear + 1, 6, 31), // Jul 31
      label: `${startYear}-${startYear + 1}`,
    };
  }, []);

  // Get attendance dates as set for quick lookup
  const attendanceDatesSet = useMemo(() => {
    const set = new Set<string>();
    attendance.forEach((a) => {
      const dateStr = a.date.split('T')[0];
      set.add(dateStr);
    });
    return set;
  }, [attendance]);

  // Find gap days - days with assignment activity but no attendance logged
  const gapDays = useMemo((): GapDay[] => {
    const gaps: Map<string, GapDay> = new Map();
    const { start, end } = schoolYearBounds;

    assignments.forEach((a) => {
      if (!a.due_date) return;

      const dueDate = new Date(a.due_date);
      if (dueDate < start || dueDate > end) return;

      const dateStr = a.due_date.split('T')[0];

      // Skip if we already have attendance for this day
      if (attendanceDatesSet.has(dateStr)) return;

      // Skip weekends
      const dayOfWeek = dueDate.getDay();
      if (dayOfWeek === 0 || dayOfWeek === 6) return;

      if (gaps.has(dateStr)) {
        const existing = gaps.get(dateStr)!;
        existing.assignmentCount++;
        existing.reason = `${existing.assignmentCount} assignments due`;
      } else {
        gaps.set(dateStr, {
          date: dateStr,
          reason: '1 assignment due',
          assignmentCount: 1,
        });
      }
    });

    return Array.from(gaps.values()).sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }, [assignments, attendanceDatesSet, schoolYearBounds]);

  // Stats calculations
  const stats = useMemo(() => {
    const daysLogged = attendance.filter((a) => {
      const date = new Date(a.date);
      return date >= schoolYearBounds.start && date <= schoolYearBounds.end;
    }).length;

    const daysRemaining = Math.max(0, TEXAS_REQUIRED_DAYS - daysLogged);
    const percentComplete = Math.round((daysLogged / TEXAS_REQUIRED_DAYS) * 100);

    // Calculate pace
    const today = new Date();
    const daysSinceStart = Math.ceil(
      (today.getTime() - schoolYearBounds.start.getTime()) / (1000 * 60 * 60 * 24)
    );
    const weeksSinceStart = Math.max(1, daysSinceStart / 7);
    const avgDaysPerWeek = daysLogged / weeksSinceStart;

    // Projection
    let projectedCompletionDate: Date | null = null;
    if (avgDaysPerWeek > 0 && daysRemaining > 0) {
      const weeksNeeded = daysRemaining / avgDaysPerWeek;
      projectedCompletionDate = new Date(
        today.getTime() + weeksNeeded * 7 * 24 * 60 * 60 * 1000
      );
    }

    // Status determination
    let status: 'on-track' | 'behind' | 'ahead' | 'complete';
    if (daysLogged >= TEXAS_REQUIRED_DAYS) {
      status = 'complete';
    } else {
      // Expected days by now (assuming even distribution over 36 weeks)
      const schoolWeeksPassed = Math.min(36, weeksSinceStart);
      const expectedDays = (schoolWeeksPassed / 36) * TEXAS_REQUIRED_DAYS;

      if (daysLogged >= expectedDays * 1.1) {
        status = 'ahead';
      } else if (daysLogged >= expectedDays * 0.9) {
        status = 'on-track';
      } else {
        status = 'behind';
      }
    }

    return {
      daysLogged,
      daysRemaining,
      percentComplete,
      avgDaysPerWeek: avgDaysPerWeek.toFixed(1),
      projectedCompletionDate,
      status,
      gapCount: gapDays.length,
    };
  }, [attendance, schoolYearBounds, gapDays]);

  const handleBackfillDay = async (dateStr: string) => {
    setBackfilling(dateStr);
    try {
      const userId = pb.authStore.model?.id;
      await pb.collection('attendance').create({
        user: userId,
        child: selectedKidId,
        date: new Date(dateStr + 'T12:00:00Z'),
        status: 'present',
      });

      setToast({ message: `Logged attendance for ${new Date(dateStr).toLocaleDateString()}`, type: 'success' });
      await loadKidData(selectedKidId);
    } catch (error) {
      console.error('Backfill error:', error);
      setToast({ message: 'Failed to log attendance', type: 'error' });
    } finally {
      setBackfilling(null);
    }
  };

  const handleBackfillAll = async () => {
    if (!confirm(`Log attendance for ${gapDays.length} days?`)) return;

    setBackfilling('all');
    try {
      const userId = pb.authStore.model?.id;

      for (const gap of gapDays) {
        await pb.collection('attendance').create({
          user: userId,
          child: selectedKidId,
          date: new Date(gap.date + 'T12:00:00Z'),
          status: 'present',
        });
      }

      setToast({ message: `Logged ${gapDays.length} days!`, type: 'success' });
      await loadKidData(selectedKidId);
    } catch (error) {
      console.error('Bulk backfill error:', error);
      setToast({ message: 'Failed to log some days', type: 'error' });
    } finally {
      setBackfilling(null);
    }
  };

  const statusConfig = {
    complete: { label: 'Complete! 🎉', color: 'bg-green-100 text-green-700 border-green-200' },
    ahead: { label: 'Ahead of Schedule', color: 'bg-blue-100 text-blue-700 border-blue-200' },
    'on-track': { label: 'On Track', color: 'bg-primary/10 text-primary border-primary/20' },
    behind: { label: 'Needs Attention', color: 'bg-secondary/10 text-secondary border-secondary/20' },
  };

  const selectedKid = kids.find((k) => k.id === selectedKidId);

  if (loading) return <LoadingScreen message="Analyzing compliance data..." />;

  if (kids.length === 0) {
    return (
      <>
        <Header showLogout onLogout={() => { pb.authStore.clear(); router.push('/'); }} />
        <main className="max-w-4xl mx-auto my-12 px-8 text-center">
          <Card className="py-20">
            <p className="text-xl text-text-muted mb-8 italic font-serif">
              No children found in your village.
            </p>
            <Button onClick={() => router.push('/manage-kids')}>Add Your First Child</Button>
          </Card>
        </main>
      </>
    );
  }

  return (
    <>
      <Header showLogout onLogout={() => { pb.authStore.clear(); router.push('/'); }} />
      <main className="max-w-5xl mx-auto my-8 sm:my-12 px-4 sm:px-8 pb-24 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-6 mb-8 sm:mb-12">
          <div>
            <h2 className="font-display text-4xl sm:text-6xl font-extrabold tracking-tight mb-2">
              Compliance
            </h2>
            <p className="text-text-muted text-sm sm:text-base">
              Track Texas 180-day requirement • {schoolYearBounds.label} School Year
            </p>
          </div>
          <div className="flex gap-3">
            <Button variant="ghost" size="sm" onClick={() => router.push('/attendance')}>
              📅 Attendance
            </Button>
            <Button variant="ghost" size="sm" onClick={() => router.push('/dashboard')}>
              ← Dashboard
            </Button>
          </div>
        </div>

        {/* Child Selector */}
        <Card className="p-6 mb-8">
          <Select
            label="Select Student"
            value={selectedKidId}
            onChange={(e) => setSelectedKidId(e.target.value)}
          >
            {kids.map((k) => (
              <option key={k.id} value={k.id}>
                {k.name}
              </option>
            ))}
          </Select>
        </Card>

        {/* Main Stats Grid */}
        <div className="grid md:grid-cols-4 gap-4 mb-8">
          {/* Days Logged */}
          <Card className="p-6 text-center">
            <div className="text-5xl font-display font-extrabold text-primary mb-1">
              {stats.daysLogged}
            </div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-text-muted">
              Days Logged
            </p>
          </Card>

          {/* Days Remaining */}
          <Card className="p-6 text-center">
            <div className="text-5xl font-display font-extrabold text-secondary mb-1">
              {stats.daysRemaining}
            </div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-text-muted">
              Days Remaining
            </p>
          </Card>

          {/* Avg Per Week */}
          <Card className="p-6 text-center">
            <div className="text-5xl font-display font-extrabold text-accent mb-1">
              {stats.avgDaysPerWeek}
            </div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-text-muted">
              Days/Week Avg
            </p>
          </Card>

          {/* Status */}
          <Card className={`p-6 text-center border-2 ${statusConfig[stats.status].color}`}>
            <div className="text-lg font-display font-bold mb-1">
              {statusConfig[stats.status].label}
            </div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-70">
              {stats.percentComplete}% Complete
            </p>
          </Card>
        </div>

        {/* Progress Bar */}
        <Card className="p-6 mb-8">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-display font-bold text-lg">Progress to 180 Days</h3>
            {stats.projectedCompletionDate && stats.status !== 'complete' && (
              <span className="text-sm text-text-muted">
                On pace to finish by{' '}
                <span className="font-bold text-primary">
                  {stats.projectedCompletionDate.toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  })}
                </span>
              </span>
            )}
          </div>
          <ProgressBar
            percentage={stats.percentComplete}
            label={`${stats.daysLogged} / ${TEXAS_REQUIRED_DAYS} days`}
            sublabel={`${stats.percentComplete}% complete`}
            showPercentage={false}
          />
        </Card>

        {/* Gap Detection Section */}
        {gapDays.length > 0 && (
          <Card className="p-6 border-2 border-accent/30 bg-accent/5">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
              <div>
                <h3 className="font-display font-bold text-xl mb-1 flex items-center gap-2">
                  <span className="text-accent">⚠️</span> Missing Attendance Days
                </h3>
                <p className="text-sm text-text-muted">
                  We found {gapDays.length} days with assignments due but no attendance logged.
                </p>
              </div>
              <Button
                onClick={handleBackfillAll}
                disabled={backfilling === 'all'}
                className="whitespace-nowrap"
              >
                {backfilling === 'all' ? 'Logging...' : `Log All ${gapDays.length} Days`}
              </Button>
            </div>

            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {gapDays.slice(0, 20).map((gap) => (
                <div
                  key={gap.date}
                  className="flex items-center justify-between p-4 bg-white rounded-xl border border-border"
                >
                  <div>
                    <span className="font-bold text-sm">
                      {new Date(gap.date).toLocaleDateString('en-US', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                    <span className="text-xs text-text-muted ml-3">{gap.reason}</span>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleBackfillDay(gap.date)}
                    disabled={backfilling === gap.date}
                  >
                    {backfilling === gap.date ? '...' : '+ Log'}
                  </Button>
                </div>
              ))}
              {gapDays.length > 20 && (
                <p className="text-center text-sm text-text-muted pt-4">
                  ...and {gapDays.length - 20} more days
                </p>
              )}
            </div>
          </Card>
        )}

        {/* All Good State */}
        {gapDays.length === 0 && stats.daysLogged > 0 && (
          <Card className="p-8 text-center bg-green-50 border-2 border-green-200">
            <div className="text-4xl mb-4">✅</div>
            <h3 className="font-display font-bold text-xl text-green-700 mb-2">
              No Missing Days Detected
            </h3>
            <p className="text-sm text-green-600">
              All assignment days have matching attendance records. Great job!
            </p>
          </Card>
        )}

        {/* Tips Card */}
        <Card className="p-6 mt-8 bg-bg-alt">
          <h4 className="font-display font-bold text-sm uppercase tracking-wider text-primary mb-4">
            📚 Texas Homeschool Requirements
          </h4>
          <ul className="text-sm text-text-muted space-y-2">
            <li>
              • <strong>180 days</strong> of instruction (state recommendation, not law)
            </li>
            <li>
              • Must teach <strong>reading, spelling, grammar, math, citizenship</strong>
            </li>
            <li>
              • Curriculum must be <strong>bona fide</strong> (real, not a sham)
            </li>
            <li>
              • Keep records of <strong>attendance and grades</strong> for your protection
            </li>
          </ul>
        </Card>
      </main>

      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </>
  );
}
