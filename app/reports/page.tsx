'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { getPocketBase } from '@/lib/pocketbase';
import { Child, Assignment } from '@/lib/types';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Select } from '@/components/ui/Input';
import { LoadingScreen } from '@/components/ui/Spinner';
import { Toast } from '@/components/ui/Toast';

interface StudySession {
  id: string;
  child: string;
  subject: string;
  duration_minutes: number;
  date: string;
}

interface ReadingEntry {
  id: string;
  child: string;
  date: string;
  minutes: number;
  book_title?: string;
}

interface Achievement {
  id: string;
  child: string;
  achievement_id: string;
  earned_at: string;
}

interface WeeklyStats {
  child: Child;
  attendance: { present: number; absent: number; excused: number };
  assignments: { completed: number; pending: number; avgScore: number; total: number };
  lessons: { completed: number };
  studyTime: { minutes: number; sessions: number };
  readingTime: { minutes: number; entries: number };
  achievements: { count: number; names: string[] };
}

// Achievement definitions (matching achievements page)
const ACHIEVEMENT_DEFS: Record<string, { name: string; emoji: string }> = {
  'first-steps': { name: 'First Steps', emoji: '👣' },
  'week-warrior': { name: 'Week Warrior', emoji: '⚔️' },
  'bookworm': { name: 'Bookworm', emoji: '📖' },
  'focus-master': { name: 'Focus Master', emoji: '🎯' },
  'perfect-score': { name: 'Perfect Score', emoji: '💯' },
  'course-champion': { name: 'Course Champion', emoji: '🏆' },
  'explorer': { name: 'Explorer', emoji: '🗺️' },
  'early-bird': { name: 'Early Bird', emoji: '🐦' },
  'night-owl': { name: 'Night Owl', emoji: '🦉' },
  'streak-starter': { name: 'Streak Starter', emoji: '🔥' },
};

export default function ReportsPage() {
  const router = useRouter();
  const pb = getPocketBase();
  const reportRef = useRef<HTMLDivElement>(null);
  
  const [kids, setKids] = useState<Child[]>([]);
  const [weeklyStats, setWeeklyStats] = useState<WeeklyStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [selectedWeek, setSelectedWeek] = useState(() => {
    // Default to current week (Monday start)
    const now = new Date();
    const monday = new Date(now);
    monday.setDate(now.getDate() - now.getDay() + 1);
    return monday.toISOString().split('T')[0];
  });
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);

  const weekStart = new Date(selectedWeek);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);

  useEffect(() => {
    if (!pb.authStore.isValid) {
      router.push('/');
      return;
    }
    loadWeeklyData();
  }, [selectedWeek]);

  const loadWeeklyData = async () => {
    setLoading(true);
    try {
      const userId = pb.authStore.model?.id;
      if (!userId) return;

      // Load children
      const kidRecords = await pb.collection('children').getFullList({
        filter: `user = "${userId}"`,
        sort: 'name'
      });
      setKids(kidRecords as unknown as Child[]);

      // Date range for the week
      const startStr = weekStart.toISOString().split('T')[0];
      const endDate = new Date(weekEnd);
      endDate.setDate(endDate.getDate() + 1);
      const endStr = endDate.toISOString().split('T')[0];

      // Load all data for the week
      const stats: WeeklyStats[] = await Promise.all(
        kidRecords.map(async (kid) => {
          // Attendance
          let attendance = { present: 0, absent: 0, excused: 0 };
          try {
            const attendanceRecords = await pb.collection('attendance').getFullList({
              filter: `child = "${kid.id}" && date >= "${startStr}" && date < "${endStr}"`
            });
            attendanceRecords.forEach((r: any) => {
              if (r.status === 'Present') attendance.present++;
              else if (r.status === 'Absent') attendance.absent++;
              else if (r.status === 'Excused') attendance.excused++;
            });
          } catch (e) { /* collection may not exist */ }

          // Assignments
          let assignments = { completed: 0, pending: 0, avgScore: 0, total: 0 };
          try {
            const assignmentRecords = await pb.collection('assignments').getFullList({
              filter: `child = "${kid.id}" && due_date >= "${startStr}" && due_date < "${endStr}"`
            }) as unknown as Assignment[];
            assignments.total = assignmentRecords.length;
            let totalScore = 0;
            let gradedCount = 0;
            assignmentRecords.forEach((a) => {
              if (a.status === 'Graded') {
                assignments.completed++;
                if (a.score !== undefined) {
                  totalScore += a.score;
                  gradedCount++;
                }
              } else {
                assignments.pending++;
              }
            });
            assignments.avgScore = gradedCount > 0 ? Math.round(totalScore / gradedCount) : 0;
          } catch (e) { /* collection may not exist */ }

          // Lessons completed (from courses - check updated_at)
          let lessons = { completed: 0 };
          try {
            const courses = await pb.collection('courses').getFullList({
              filter: `child = "${kid.id}"`
            });
            // Count lesson advances in the week (approximate based on activity logs)
            try {
              const activityLogs = await pb.collection('activity_logs').getFullList({
                filter: `child = "${kid.id}" && type = "lesson_complete" && date >= "${startStr}" && date < "${endStr}"`
              });
              lessons.completed = activityLogs.length;
            } catch (e) { /* activity logs may not exist */ }
          } catch (e) { /* courses may not exist */ }

          // Study sessions
          let studyTime = { minutes: 0, sessions: 0 };
          try {
            const studySessions = await pb.collection('study_sessions').getFullList({
              filter: `child = "${kid.id}" && date >= "${startStr}" && date < "${endStr}"`
            }) as unknown as StudySession[];
            studyTime.sessions = studySessions.length;
            studyTime.minutes = studySessions.reduce((sum, s) => sum + (s.duration_minutes || 0), 0);
          } catch (e) { /* collection may not exist */ }

          // Reading log
          let readingTime = { minutes: 0, entries: 0 };
          try {
            const readingEntries = await pb.collection('reading_entries').getFullList({
              filter: `child = "${kid.id}" && date >= "${startStr}" && date < "${endStr}"`
            }) as unknown as ReadingEntry[];
            readingTime.entries = readingEntries.length;
            readingTime.minutes = readingEntries.reduce((sum, r) => sum + (r.minutes || 0), 0);
          } catch (e) { /* collection may not exist */ }

          // Achievements earned this week
          let achievements = { count: 0, names: [] as string[] };
          try {
            const achievementRecords = await pb.collection('achievements').getFullList({
              filter: `child = "${kid.id}" && earned_at >= "${startStr}" && earned_at < "${endStr}"`
            }) as unknown as Achievement[];
            achievements.count = achievementRecords.length;
            achievements.names = achievementRecords.map(a => {
              const def = ACHIEVEMENT_DEFS[a.achievement_id];
              return def ? `${def.emoji} ${def.name}` : a.achievement_id;
            });
          } catch (e) { /* collection may not exist */ }

          return {
            child: kid as unknown as Child,
            attendance,
            assignments,
            lessons,
            studyTime,
            readingTime,
            achievements
          };
        })
      );

      setWeeklyStats(stats);
    } catch (error) {
      console.error('Report load error:', error);
      setToast({ message: 'Failed to load report data.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleEmailReport = async () => {
    setGenerating(true);
    try {
      // Generate report HTML
      const reportHtml = generateReportHtml();
      
      // Call the email API
      const response = await fetch('/api/send-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: `Village Homeschool - Weekly Report (${formatDate(weekStart)} - ${formatDate(weekEnd)})`,
          html: reportHtml,
          weekStart: weekStart.toISOString(),
          weekEnd: weekEnd.toISOString()
        })
      });

      if (response.ok) {
        setToast({ message: 'Report sent to your email!', type: 'success' });
      } else {
        throw new Error('Failed to send email');
      }
    } catch (error) {
      console.error('Email error:', error);
      setToast({ message: 'Failed to send email. Try printing instead.', type: 'error' });
    } finally {
      setGenerating(false);
    }
  };

  const generateReportHtml = () => {
    const familyName = pb.authStore.model?.name || 'Family';
    return `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; background: #FDFCF8;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #4B6344; margin: 0; font-size: 28px;">🏡 Village Homeschool</h1>
          <h2 style="color: #666; margin: 10px 0 0 0; font-size: 18px; font-weight: normal;">
            Weekly Progress Report
          </h2>
          <p style="color: #888; margin: 5px 0 0 0;">
            ${formatDate(weekStart)} - ${formatDate(weekEnd)}
          </p>
        </div>
        
        ${weeklyStats.map(stats => `
          <div style="background: white; border-radius: 16px; padding: 24px; margin-bottom: 20px; border: 1px solid #E8E4DA;">
            <h3 style="color: #4B6344; margin: 0 0 16px 0; font-size: 22px; border-bottom: 2px solid #4B6344; padding-bottom: 8px;">
              ${stats.child.name} <span style="font-size: 14px; color: #888; font-weight: normal;">(${stats.child.grade})</span>
            </h3>
            
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 12px 0; border-bottom: 1px solid #eee; width: 50%;">
                  <strong style="color: #4B6344;">📅 Attendance</strong><br/>
                  <span style="color: #333; font-size: 24px; font-weight: bold;">${stats.attendance.present}</span>
                  <span style="color: #666;"> days present</span>
                  ${stats.attendance.excused > 0 ? `<br/><span style="color: #888; font-size: 12px;">${stats.attendance.excused} excused</span>` : ''}
                </td>
                <td style="padding: 12px 0; border-bottom: 1px solid #eee;">
                  <strong style="color: #D97757;">📝 Assignments</strong><br/>
                  <span style="color: #333; font-size: 24px; font-weight: bold;">${stats.assignments.completed}/${stats.assignments.total}</span>
                  <span style="color: #666;"> completed</span>
                  ${stats.assignments.avgScore > 0 ? `<br/><span style="color: #888; font-size: 12px;">Avg: ${stats.assignments.avgScore}%</span>` : ''}
                </td>
              </tr>
              <tr>
                <td style="padding: 12px 0; border-bottom: 1px solid #eee;">
                  <strong style="color: #E6AF2E;">⏱️ Study Time</strong><br/>
                  <span style="color: #333; font-size: 24px; font-weight: bold;">${Math.round(stats.studyTime.minutes / 60 * 10) / 10}</span>
                  <span style="color: #666;"> hours</span>
                  <br/><span style="color: #888; font-size: 12px;">${stats.studyTime.sessions} sessions</span>
                </td>
                <td style="padding: 12px 0; border-bottom: 1px solid #eee;">
                  <strong style="color: #4B6344;">📚 Reading</strong><br/>
                  <span style="color: #333; font-size: 24px; font-weight: bold;">${Math.round(stats.readingTime.minutes / 60 * 10) / 10}</span>
                  <span style="color: #666;"> hours</span>
                  <br/><span style="color: #888; font-size: 12px;">${stats.readingTime.entries} entries</span>
                </td>
              </tr>
              ${stats.achievements.count > 0 ? `
              <tr>
                <td colspan="2" style="padding: 12px 0;">
                  <strong style="color: #D97757;">🏆 Achievements Earned</strong><br/>
                  <span style="color: #333;">${stats.achievements.names.join(', ')}</span>
                </td>
              </tr>
              ` : ''}
            </table>
          </div>
        `).join('')}
        
        <div style="text-align: center; color: #888; font-size: 12px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
          Generated by Village Homeschool • ${new Date().toLocaleDateString()}
        </div>
      </div>
    `;
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatHours = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) return `${mins}m`;
    if (mins === 0) return `${hours}h`;
    return `${hours}h ${mins}m`;
  };

  // Generate week options (last 12 weeks)
  const weekOptions = Array.from({ length: 12 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - date.getDay() + 1 - (i * 7));
    const endDate = new Date(date);
    endDate.setDate(date.getDate() + 6);
    return {
      value: date.toISOString().split('T')[0],
      label: `${formatDate(date)} - ${formatDate(endDate)}`
    };
  });

  if (loading) {
    return <LoadingScreen message="Generating report..." />;
  }

  return (
    <>
      <Header showLogout onLogout={() => { pb.authStore.clear(); router.push('/'); }} />
      
      {/* Print-only styles */}
      <style jsx global>{`
        @media print {
          body * { visibility: hidden; }
          .print-area, .print-area * { visibility: visible; }
          .print-area { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
          .print-break { page-break-after: always; }
        }
      `}</style>

      <main className="max-w-5xl mx-auto my-8 sm:my-12 px-4 sm:px-8 pb-20 animate-fade-in">
        {/* Header & Controls - Hidden on print */}
        <div className="no-print">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-6 mb-8">
            <div>
              <h2 className="font-display text-4xl sm:text-5xl font-extrabold tracking-tight mb-2">📊 Weekly Reports</h2>
              <p className="text-text-muted">Generate progress summaries for compliance & sharing.</p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => router.push('/dashboard')}>
              ← Dashboard
            </Button>
          </div>

          {/* Week Selector & Actions */}
          <Card className="mb-8 p-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4 sm:gap-6">
              <div className="flex-1 w-full sm:w-auto">
                <Select 
                  label="Select Week" 
                  value={selectedWeek} 
                  onChange={(e) => setSelectedWeek(e.target.value)}
                >
                  {weekOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </Select>
              </div>
              <div className="flex gap-3 w-full sm:w-auto">
                <Button variant="outline" onClick={handlePrint} className="flex-1 sm:flex-none">
                  🖨️ Print / PDF
                </Button>
                <Button onClick={handleEmailReport} disabled={generating} className="flex-1 sm:flex-none">
                  {generating ? '📧 Sending...' : '📧 Email Report'}
                </Button>
              </div>
            </div>
          </Card>
        </div>

        {/* Report Content - Printable Area */}
        <div ref={reportRef} className="print-area">
          {/* Report Header */}
          <div className="text-center mb-8 pb-6 border-b-2 border-primary/20">
            <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-primary mb-2">🏡 Village Homeschool</h1>
            <h2 className="font-serif italic text-xl text-text-muted">Weekly Progress Report</h2>
            <p className="text-text-muted mt-2">{formatDate(weekStart)} - {formatDate(weekEnd)}</p>
          </div>

          {kids.length === 0 ? (
            <Card className="text-center py-12">
              <p className="text-text-muted text-lg mb-6">No children added yet.</p>
              <Button onClick={() => router.push('/manage-kids')} className="no-print">Add Your First Child</Button>
            </Card>
          ) : (
            <div className="space-y-8">
              {weeklyStats.map((stats, index) => (
                <Card key={stats.child.id} className={index < weeklyStats.length - 1 ? 'print-break' : ''}>
                  {/* Child Header */}
                  <div className="flex items-center gap-4 mb-6 pb-4 border-b border-border">
                    <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center text-white text-xl font-bold">
                      {stats.child.name.charAt(0)}
                    </div>
                    <div>
                      <h3 className="font-display text-2xl font-bold m-0">{stats.child.name}</h3>
                      <p className="text-text-muted text-sm m-0">{stats.child.grade} • Age {stats.child.age}</p>
                    </div>
                  </div>

                  {/* Stats Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
                    {/* Attendance */}
                    <div className="bg-bg-alt rounded-xl p-4 sm:p-5">
                      <div className="flex items-center gap-2 text-primary font-semibold mb-2">
                        <span className="text-xl">📅</span>
                        <span>Attendance</span>
                      </div>
                      <div className="font-display text-3xl font-extrabold text-primary">
                        {stats.attendance.present}
                        <span className="text-lg font-normal text-text-muted"> / 5 days</span>
                      </div>
                      {stats.attendance.excused > 0 && (
                        <p className="text-xs text-text-muted mt-1">{stats.attendance.excused} excused absence{stats.attendance.excused > 1 ? 's' : ''}</p>
                      )}
                    </div>

                    {/* Assignments */}
                    <div className="bg-bg-alt rounded-xl p-4 sm:p-5">
                      <div className="flex items-center gap-2 text-secondary font-semibold mb-2">
                        <span className="text-xl">📝</span>
                        <span>Assignments</span>
                      </div>
                      <div className="font-display text-3xl font-extrabold text-secondary">
                        {stats.assignments.completed}
                        <span className="text-lg font-normal text-text-muted"> / {stats.assignments.total}</span>
                      </div>
                      {stats.assignments.avgScore > 0 && (
                        <p className="text-xs text-text-muted mt-1">Average: {stats.assignments.avgScore}%</p>
                      )}
                      {stats.assignments.pending > 0 && (
                        <p className="text-xs text-yellow-600 mt-1">{stats.assignments.pending} pending</p>
                      )}
                    </div>

                    {/* Lessons */}
                    <div className="bg-bg-alt rounded-xl p-4 sm:p-5">
                      <div className="flex items-center gap-2 text-accent font-semibold mb-2">
                        <span className="text-xl">📚</span>
                        <span>Lessons</span>
                      </div>
                      <div className="font-display text-3xl font-extrabold text-accent">
                        {stats.lessons.completed}
                        <span className="text-lg font-normal text-text-muted"> completed</span>
                      </div>
                    </div>

                    {/* Study Time */}
                    <div className="bg-bg-alt rounded-xl p-4 sm:p-5">
                      <div className="flex items-center gap-2 text-primary font-semibold mb-2">
                        <span className="text-xl">⏱️</span>
                        <span>Study Time</span>
                      </div>
                      <div className="font-display text-3xl font-extrabold text-primary">
                        {formatHours(stats.studyTime.minutes)}
                      </div>
                      <p className="text-xs text-text-muted mt-1">{stats.studyTime.sessions} focus session{stats.studyTime.sessions !== 1 ? 's' : ''}</p>
                    </div>

                    {/* Reading */}
                    <div className="bg-bg-alt rounded-xl p-4 sm:p-5">
                      <div className="flex items-center gap-2 text-secondary font-semibold mb-2">
                        <span className="text-xl">📖</span>
                        <span>Reading</span>
                      </div>
                      <div className="font-display text-3xl font-extrabold text-secondary">
                        {formatHours(stats.readingTime.minutes)}
                      </div>
                      <p className="text-xs text-text-muted mt-1">{stats.readingTime.entries} log entr{stats.readingTime.entries !== 1 ? 'ies' : 'y'}</p>
                    </div>

                    {/* Achievements */}
                    <div className="bg-bg-alt rounded-xl p-4 sm:p-5">
                      <div className="flex items-center gap-2 text-accent font-semibold mb-2">
                        <span className="text-xl">🏆</span>
                        <span>Achievements</span>
                      </div>
                      <div className="font-display text-3xl font-extrabold text-accent">
                        {stats.achievements.count}
                        <span className="text-lg font-normal text-text-muted"> earned</span>
                      </div>
                      {stats.achievements.names.length > 0 && (
                        <p className="text-xs text-text-muted mt-1 truncate" title={stats.achievements.names.join(', ')}>
                          {stats.achievements.names.slice(0, 2).join(', ')}
                          {stats.achievements.names.length > 2 && ` +${stats.achievements.names.length - 2} more`}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Weekly Summary */}
                  <div className="mt-6 pt-4 border-t border-border">
                    <p className="text-text-muted text-sm">
                      <strong className="text-text">{stats.child.name}</strong> was present <strong>{stats.attendance.present} day{stats.attendance.present !== 1 ? 's' : ''}</strong>, 
                      completed <strong>{stats.assignments.completed} assignment{stats.assignments.completed !== 1 ? 's' : ''}</strong>
                      {stats.assignments.avgScore > 0 && <> with an average score of <strong>{stats.assignments.avgScore}%</strong></>}, 
                      logged <strong>{formatHours(stats.studyTime.minutes)}</strong> of focused study time, 
                      and read for <strong>{formatHours(stats.readingTime.minutes)}</strong>.
                      {stats.achievements.count > 0 && <> They earned <strong>{stats.achievements.count} new achievement{stats.achievements.count !== 1 ? 's' : ''}</strong>!</>}
                    </p>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {/* Report Footer */}
          <div className="text-center text-text-muted text-sm mt-8 pt-6 border-t border-border">
            <p>Generated by Village Homeschool • {new Date().toLocaleDateString()}</p>
          </div>
        </div>
      </main>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </>
  );
}
