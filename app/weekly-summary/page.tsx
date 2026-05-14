'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getPocketBase } from '@/lib/pocketbase';
import { Child, Attendance, Assignment, PortfolioItem } from '@/lib/types';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Select } from '@/components/ui/Input';
import { LoadingScreen } from '@/components/ui/Spinner';

// Helper to get week dates (Sunday to Saturday)
function getWeekDates(date: Date): Date[] {
  const start = new Date(date);
  const day = start.getDay();
  const diff = start.getDate() - day;
  const weekDates: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(diff + i);
    weekDates.push(d);
  }
  return weekDates;
}

// Format date as YYYY-MM-DD
function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

// Format display date
function formatDisplayDate(date: Date): string {
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface WeekAttendance {
  date: string;
  dayName: string;
  displayDate: string;
  status: Attendance['status'] | null;
}

interface WeekAssignment {
  id: string;
  title: string;
  due_date: string;
  status: string;
  childName: string;
}

export default function WeeklySummaryPage() {
  const router = useRouter();
  const pb = getPocketBase();
  
  const [kids, setKids] = useState<Child[]>([]);
  const [selectedKidId, setSelectedKidId] = useState<string>('');
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
  });
  const [attendance, setAttendance] = useState<WeekAttendance[]>([]);
  const [assignments, setAssignments] = useState<WeekAssignment[]>([]);
  const [portfolioItems, setPortfolioItems] = useState<PortfolioItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copyMessage, setCopyMessage] = useState('');

  useEffect(() => {
    if (!pb.authStore.isValid) {
      router.push('/');
      return;
    }
    loadKids();
  }, []);

  useEffect(() => {
    if (selectedKidId) {
      loadWeekData();
    }
  }, [selectedKidId, currentWeekStart]);

  const loadKids = async () => {
    try {
      const userId = pb.authStore.model?.id;
      if (!userId) return;

      const kidRecords = await pb.collection('children').getFullList({
        filter: `user = "${userId}"`,
        sort: 'name'
      });

      setKids(kidRecords as unknown as Child[]);
      if (kidRecords.length > 0) {
        setSelectedKidId(kidRecords[0].id);
      } else {
        setLoading(false);
      }
    } catch (error) {
      console.error('Load kids error:', error);
      setLoading(false);
    }
  };

  const loadWeekData = async () => {
    setLoading(true);
    try {
      const userId = pb.authStore.model?.id;
      if (!userId || !selectedKidId) return;

      const weekDates = getWeekDates(currentWeekStart);
      const startDate = formatDate(weekDates[0]);
      const endDate = formatDate(weekDates[6]);

      // Build attendance grid
      const attendanceGrid: WeekAttendance[] = weekDates.map((date) => {
        const dateStr = formatDate(date);
        return {
          date: dateStr,
          dayName: DAYS[date.getDay()],
          displayDate: formatDisplayDate(date),
          status: null
        };
      });

      // Load attendance records for this week
      const attendanceRecords = await pb.collection('attendance').getFullList({
        filter: `child = "${selectedKidId}" && date >= "${startDate}" && date <= "${endDate}"`
      });

      (attendanceRecords as unknown as Attendance[]).forEach((record) => {
        const idx = attendanceGrid.findIndex((a) => a.date === record.date);
        if (idx !== -1) {
          attendanceGrid[idx].status = record.status;
        }
      });

      setAttendance(attendanceGrid);

      // Load assignments due this week
      const assignmentRecords = await pb.collection('assignments').getFullList({
        filter: `child = "${selectedKidId}" && due_date >= "${startDate}" && due_date <= "${endDate}"`,
        sort: 'due_date'
      });

      const kid = (kids as Child[]).find(k => k.id === selectedKidId);
      setAssignments((assignmentRecords as unknown as Assignment[]).map(a => ({
        id: a.id,
        title: a.title,
        due_date: a.due_date || '',
        status: a.status,
        childName: kid?.name || ''
      })));

      // Load portfolio items from this week
      const portfolioRecords = await pb.collection('portfolio').getFullList({
        filter: `child = "${selectedKidId}" && date >= "${startDate}" && date <= "${endDate}"`,
        sort: '-date'
      });

      setPortfolioItems(portfolioRecords as unknown as PortfolioItem[]);
    } catch (error) {
      console.error('Load week data error:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateAttendance = async (date: string, status: Attendance['status'] | null) => {
    try {
      setSaving(true);
      const userId = pb.authStore.model?.id;
      if (!userId) return;

      // Find existing record
      const existing = await pb.collection('attendance').getFullList({
        filter: `child = "${selectedKidId}" && date = "${date}"`
      });

      if (existing.length > 0) {
        if (status) {
          await pb.collection('attendance').update(existing[0].id, { status });
        } else {
          await pb.collection('attendance').delete(existing[0].id);
        }
      } else if (status) {
        await pb.collection('attendance').create({
          user: userId,
          child: selectedKidId,
          date,
          status
        });
      }

      // Update local state
      setAttendance(prev => prev.map(a => 
        a.date === date ? { ...a, status } : a
      ));
    } catch (error) {
      console.error('Update attendance error:', error);
    } finally {
      setSaving(false);
    }
  };

  const goToPrevWeek = () => {
    const prev = new Date(currentWeekStart);
    prev.setDate(prev.getDate() - 7);
    setCurrentWeekStart(prev);
  };

  const goToNextWeek = () => {
    const next = new Date(currentWeekStart);
    next.setDate(next.getDate() + 7);
    setCurrentWeekStart(next);
  };

  const goToToday = () => {
    const now = new Date();
    setCurrentWeekStart(new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay()));
  };

  const getStatusColor = (status: Attendance['status'] | null): string => {
    switch (status) {
      case 'present': return 'bg-green-100 text-green-800 border-green-300';
      case 'absent': return 'bg-red-100 text-red-800 border-red-300';
      case 'half-day': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'sick': return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'holiday': return 'bg-purple-100 text-purple-800 border-purple-300';
      default: return 'bg-gray-50 text-gray-400 border-gray-200';
    }
  };

  const getStatusLabel = (status: Attendance['status'] | null): string => {
    switch (status) {
      case 'present': return '✓ Present';
      case 'absent': return '✕ Absent';
      case 'half-day': return '½ Half Day';
      case 'sick': return '🤒 Sick';
      case 'holiday': return '🎉 Holiday';
      default: return 'Mark';
    }
  };

  const formatWeekRange = (): string => {
    const dates = getWeekDates(currentWeekStart);
    const start = dates[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const end = dates[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    return `${start} - ${end}`;
  };

  const isToday = (date: string): boolean => {
    return date === formatDate(new Date());
  };

  const selectedKid = kids.find(kid => kid.id === selectedKidId);
  const attendanceCounts = attendance.reduce<Record<NonNullable<Attendance['status']>, number>>((counts, day) => {
    if (day.status) {
      counts[day.status] += 1;
    }
    return counts;
  }, {
    present: 0,
    absent: 0,
    'half-day': 0,
    sick: 0,
    holiday: 0
  });
  const markedAttendanceDays = attendance.filter(day => day.status).length;
  const presentEquivalentDays = attendanceCounts.present + (attendanceCounts['half-day'] * 0.5);
  const completedAssignments = assignments.filter(assignment =>
    assignment.status === 'completed' || assignment.status === 'Graded'
  ).length;

  const buildWeeklyRecordText = (): string => {
    const attendanceLines = attendance.map(day =>
      `- ${day.displayDate}: ${day.status ? getStatusLabel(day.status).replace(/^[^A-Za-z]+\s*/, '') : 'Unmarked'}`
    );

    const assignmentLines = assignments.length > 0
      ? assignments.map(assignment => `- ${assignment.title} (${assignment.status}; due ${assignment.due_date || 'no date'})`)
      : ['- No assignments due this week'];

    const portfolioLines = portfolioItems.length > 0
      ? portfolioItems.map(item => `- ${item.title}${item.subject ? ` — ${item.subject}` : ''}`)
      : ['- No portfolio items added this week'];

    return [
      'Village Weekly Record',
      `Student: ${selectedKid?.name || 'Selected child'}`,
      `Week: ${formatWeekRange()}`,
      '',
      'Attendance',
      `- Marked days: ${markedAttendanceDays}/7`,
      `- Present-equivalent days: ${presentEquivalentDays}/7`,
      `- Present: ${attendanceCounts.present} | Half days: ${attendanceCounts['half-day']} | Sick: ${attendanceCounts.sick} | Holidays: ${attendanceCounts.holiday} | Absent: ${attendanceCounts.absent}`,
      ...attendanceLines,
      '',
      'Assignments',
      `- Completed/graded: ${completedAssignments}/${assignments.length}`,
      ...assignmentLines,
      '',
      'Portfolio',
      `- Items captured: ${portfolioItems.length}`,
      ...portfolioLines
    ].join('\n');
  };

  const copyWeeklyRecord = async () => {
    const text = buildWeeklyRecordText();

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopyMessage('Copied weekly record summary.');
    } catch (error) {
      console.error('Copy weekly record error:', error);
      setCopyMessage('Could not copy automatically. Use Print / Save PDF instead.');
    }
  };

  if (loading && kids.length > 0) {
    return (
      <div className="min-h-screen bg-creamy">
        <Header />
        <LoadingScreen />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-creamy">
      <Header />
      <main className="max-w-4xl mx-auto p-4">
        {/* Page Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-display font-bold text-primary mb-2">
            Weekly Summary
          </h1>
          <p className="text-stone-600">
            Track attendance and view the week&apos;s assignments
          </p>
        </div>

        {/* Kid Selector */}
        {kids.length > 1 && (
          <div className="mb-4">
            <Select
              label="Select Child"
              value={selectedKidId}
              onChange={(e) => setSelectedKidId(e.target.value)}
            >
              {kids.map(k => <option key={k.id} value={k.id}>{k.name}</option>)}
            </Select>
          </div>
        )}

        {/* Week Navigation */}
        <Card className="mb-6 print:hidden">
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              onClick={goToPrevWeek}
              className="text-lg"
            >
              ‹ Prev
            </Button>
            <div className="text-center">
              <h2 className="text-xl font-semibold text-primary">
                {formatWeekRange()}
              </h2>
              <Button
                variant="ghost"
                onClick={goToToday}
                className="text-sm mt-1"
              >
                Today
              </Button>
            </div>
            <Button
              variant="ghost"
              onClick={goToNextWeek}
              className="text-lg"
            >
              Next ›
            </Button>
          </div>
        </Card>

        {/* Parent Record Export */}
        <Card className="mb-6 border-primary/20 bg-white print:border-stone-300 print:shadow-none">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-secondary mb-2">
                Parent record export
              </p>
              <h3 className="text-xl font-display font-bold text-primary mb-2">
                {selectedKid?.name || 'Student'} • {formatWeekRange()}
              </h3>
              <p className="text-sm text-stone-600 max-w-2xl">
                Copy this into a text, email, evaluator note, or print it to PDF for your homeschool records.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 print:hidden">
              <Button variant="secondary" size="sm" onClick={copyWeeklyRecord}>
                Copy summary
              </Button>
              <Button variant="outline" size="sm" onClick={() => window.print()}>
                Print / Save PDF
              </Button>
            </div>
          </div>

          {copyMessage && (
            <div className="mt-4 rounded-lg bg-primary/10 px-4 py-2 text-sm font-semibold text-primary print:hidden">
              {copyMessage}
            </div>
          )}

          <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="rounded-xl bg-stone-50 p-3">
              <p className="text-xs uppercase tracking-wide text-stone-500">Marked days</p>
              <p className="text-2xl font-bold text-primary">{markedAttendanceDays}/7</p>
            </div>
            <div className="rounded-xl bg-stone-50 p-3">
              <p className="text-xs uppercase tracking-wide text-stone-500">Present equiv.</p>
              <p className="text-2xl font-bold text-primary">{presentEquivalentDays}</p>
            </div>
            <div className="rounded-xl bg-stone-50 p-3">
              <p className="text-xs uppercase tracking-wide text-stone-500">Assignments done</p>
              <p className="text-2xl font-bold text-primary">{completedAssignments}/{assignments.length}</p>
            </div>
            <div className="rounded-xl bg-stone-50 p-3">
              <p className="text-xs uppercase tracking-wide text-stone-500">Portfolio items</p>
              <p className="text-2xl font-bold text-primary">{portfolioItems.length}</p>
            </div>
          </div>
        </Card>

        {/* Attendance Grid */}
        <Card className="mb-6 print:shadow-none">
          <h3 className="text-lg font-semibold text-primary mb-4">
            📅 Attendance
          </h3>
          <div className="grid grid-cols-7 gap-2">
            {attendance.map((day) => (
              <div
                key={day.date}
                className={`
                  flex flex-col items-center p-3 rounded-lg border-2 transition-all
                  ${getStatusColor(day.status)}
                  ${isToday(day.date) ? 'ring-2 ring-primary ring-offset-2' : ''}
                `}
              >
                <span className="text-xs font-medium mb-1">{day.dayName}</span>
                <span className="text-xs opacity-75 mb-2">{day.displayDate.split(',')[0]}</span>
                <div className="flex flex-wrap gap-1 justify-center">
                  {(['present', 'absent', 'half-day', 'sick', 'holiday'] as const).map((status) => (
                    <button
                      key={status}
                      onClick={() => updateAttendance(day.date, day.status === status ? null : status)}
                      disabled={saving}
                      className={`
                        text-xs px-2 py-1 rounded-full transition-all
                        ${day.status === status 
                          ? 'bg-primary text-white' 
                          : 'bg-white/50 hover:bg-white/80 text-stone-600'
                        }
                      `}
                    >
                      {status === 'present' ? '✓' :
                       status === 'absent' ? '✕' :
                       status === 'half-day' ? '½' :
                       status === 'sick' ? '🤒' : '🎉'}
                    </button>
                  ))}
                </div>
                <span className={`text-xs mt-2 font-medium ${day.status ? 'opacity-100' : 'opacity-50'}`}>
                  {getStatusLabel(day.status)}
                </span>
              </div>
            ))}
          </div>
        </Card>

        {/* Assignments This Week */}
        <Card className="mb-6">
          <h3 className="text-lg font-semibold text-primary mb-4">
            📚 Assignments Due This Week
          </h3>
          {assignments.length === 0 ? (
            <p className="text-stone-500 text-center py-4">
              No assignments due this week
            </p>
          ) : (
            <div className="space-y-2">
              {assignments.map((assignment) => (
                <div
                  key={assignment.id}
                  className="flex items-center justify-between p-3 bg-stone-50 rounded-lg"
                >
                  <div>
                    <span className="font-medium text-stone-700">{assignment.title}</span>
                    <span className="text-sm text-stone-500 ml-2">
                      (Due: {assignment.due_date})
                    </span>
                  </div>
                  <span className={`
                    text-sm px-2 py-1 rounded-full
                    ${assignment.status === 'completed' || assignment.status === 'Graded' 
                      ? 'bg-green-100 text-green-800' 
                      : assignment.status === 'in_progress'
                      ? 'bg-yellow-100 text-yellow-800'
                      : 'bg-gray-100 text-gray-600'
                    }
                  `}>
                    {assignment.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Portfolio Items This Week */}
        <Card>
          <h3 className="text-lg font-semibold text-primary mb-4">
            📁 Portfolio This Week
          </h3>
          {portfolioItems.length === 0 ? (
            <p className="text-stone-500 text-center py-4">
              No portfolio items this week
            </p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {portfolioItems.map((item) => (
                <div
                  key={item.id}
                  className="bg-stone-50 rounded-lg p-3"
                >
                  {item.image && (
                    <div className="aspect-square bg-stone-200 rounded-lg mb-2 overflow-hidden">
                      {Array.isArray(item.image) ? (
                        <img
                          src={item.image[0]}
                          alt={item.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <img
                          src={item.image}
                          alt={item.title}
                          className="w-full h-full object-cover"
                        />
                      )}
                    </div>
                  )}
                  <h4 className="font-medium text-stone-700 text-sm">{item.title}</h4>
                  {item.subject && (
                    <span className="text-xs text-stone-500">{item.subject}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      </main>
    </div>
  );
}