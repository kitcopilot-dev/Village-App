'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { getPocketBase } from '@/lib/pocketbase';
import { Child, Course, Attendance, Assignment, PortfolioItem } from '@/lib/types';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Select } from '@/components/ui/Input';
import { LoadingScreen } from '@/components/ui/Spinner';

// Get start of week (Monday)
function getStartOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Sunday
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

// Get end of week (Sunday)
function getEndOfWeek(date: Date): Date {
  const start = getStartOfWeek(date);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return end;
}

// Format date range
function formatDateRange(start: Date, end: Date): string {
  const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  const startStr = start.toLocaleDateString('en-US', options);
  const endStr = end.toLocaleDateString('en-US', { ...options, year: 'numeric' });
  return `${startStr} – ${endStr}`;
}

// Format just the date
function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', { 
    weekday: 'short', 
    month: 'short', 
    day: 'numeric' 
  });
}

// Get week options (last 12 weeks)
function getWeekOptions(): { value: string; label: string; start: Date; end: Date }[] {
  const weeks = [];
  const today = new Date();
  
  for (let i = 0; i < 12; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - (i * 7));
    const start = getStartOfWeek(date);
    const end = getEndOfWeek(date);
    
    weeks.push({
      value: start.toISOString().split('T')[0],
      label: i === 0 ? `This Week (${formatDateRange(start, end)})` : 
             i === 1 ? `Last Week (${formatDateRange(start, end)})` :
             formatDateRange(start, end),
      start,
      end
    });
  }
  
  return weeks;
}

interface WeeklyStats {
  attendance: {
    present: number;
    absent: number;
    sick: number;
    halfDay: number;
    holiday: number;
    total: number;
  };
  lessons: {
    completed: number;
    courses: { name: string; lessonsCompleted: number }[];
  };
  assignments: {
    completed: number;
    pending: number;
    overdue: number;
    grades: number[];
    avgGrade: number | null;
  };
  portfolio: {
    added: number;
    items: PortfolioItem[];
  };
}

interface ChildWeeklyData {
  child: Child;
  stats: WeeklyStats;
}

export default function ReportsPage() {
  const router = useRouter();
  const pb = getPocketBase();
  
  const [loading, setLoading] = useState(true);
  const [kids, setKids] = useState<Child[]>([]);
  const [selectedWeek, setSelectedWeek] = useState<string>('');
  const [weeklyData, setWeeklyData] = useState<ChildWeeklyData[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>([]);
  
  const weekOptions = useMemo(() => getWeekOptions(), []);

  useEffect(() => {
    if (!pb.authStore.isValid) {
      router.push('/');
      return;
    }
    
    // Set default week to this week
    if (!selectedWeek && weekOptions.length > 0) {
      setSelectedWeek(weekOptions[0].value);
    }
    
    loadInitialData();
  }, []);

  useEffect(() => {
    if (kids.length > 0 && selectedWeek) {
      loadWeeklyData();
    }
  }, [selectedWeek, kids]);

  const loadInitialData = async () => {
    try {
      const userId = pb.authStore.model?.id;
      if (!userId) return;

      const childRecords = await pb.collection('children').getFullList({
        filter: `user = "${userId}"`,
        sort: 'name'
      });

      setKids(childRecords as unknown as Child[]);
    } catch (error) {
      console.error('Load error:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadWeeklyData = async () => {
    if (!selectedWeek) return;
    
    const weekOption = weekOptions.find(w => w.value === selectedWeek);
    if (!weekOption) return;
    
    const { start, end } = weekOption;
    const startStr = start.toISOString().split('T')[0];
    const endStr = end.toISOString().split('T')[0];
    
    try {
      const userId = pb.authStore.model?.id;
      if (!userId) return;

      // Load all data for the week
      const [attendanceRecords, courseRecords, assignmentRecords, portfolioRecords] = await Promise.all([
        pb.collection('attendance').getFullList({
          filter: `user = "${userId}" && date >= "${startStr}" && date <= "${endStr}"`,
          sort: 'date'
        }).catch(() => []),
        pb.collection('courses').getFullList({
          filter: kids.map(k => `child = "${k.id}"`).join(' || '),
          sort: 'name'
        }).catch(() => []),
        pb.collection('assignments').getFullList({
          filter: `user = "${userId}" && (due_date >= "${startStr}" && due_date <= "${endStr}" || ((status = "completed" || status = "Graded") && updated >= "${startStr}" && updated <= "${endStr}"))`,
          sort: '-due_date'
        }).catch(() => []),
        pb.collection('portfolio_items').getFullList({
          filter: kids.map(k => `child = "${k.id}"`).join(' || ') + ` && created >= "${startStr}" && created <= "${endStr}"`,
          sort: '-created'
        }).catch(() => [])
      ]);

      setAttendance(attendanceRecords as unknown as Attendance[]);
      setCourses(courseRecords as unknown as Course[]);
      setAssignments(assignmentRecords as unknown as Assignment[]);
      setPortfolio(portfolioRecords as unknown as PortfolioItem[]);

      // Calculate per-child stats
      const data: ChildWeeklyData[] = kids.map(child => {
        const childAttendance = attendanceRecords.filter((a: any) => a.child === child.id) as unknown as Attendance[];
        const childCourses = courseRecords.filter((c: any) => c.child === child.id) as unknown as Course[];
        const childAssignments = assignmentRecords.filter((a: any) => a.child === child.id) as unknown as Assignment[];
        const childPortfolio = portfolioRecords.filter((p: any) => p.child === child.id) as unknown as PortfolioItem[];

        // Attendance stats
        const attendanceStats = {
          present: childAttendance.filter(a => a.status === 'present').length,
          absent: childAttendance.filter(a => a.status === 'absent').length,
          sick: childAttendance.filter(a => a.status === 'sick').length,
          halfDay: childAttendance.filter(a => a.status === 'half-day').length,
          holiday: childAttendance.filter(a => a.status === 'holiday').length,
          total: childAttendance.length
        };

        // Assignment stats
        const completedAssignments = childAssignments.filter(a => a.status === 'completed' || a.status === 'Graded');
        const pendingAssignments = childAssignments.filter(a => (a.status === 'pending' || a.status === 'in_progress') && (!a.due_date || new Date(a.due_date) >= new Date()));
        const overdueAssignments = childAssignments.filter(a => (a.status === 'pending' || a.status === 'in_progress') && a.due_date && new Date(a.due_date) < new Date());
        const grades = completedAssignments
          .filter(a => a.score !== undefined && a.score !== null)
          .map(a => a.score as number);
        const avgGrade = grades.length > 0 
          ? Math.round(grades.reduce((a, b) => a + b, 0) / grades.length) 
          : null;

        // Portfolio stats
        const portfolioStats = {
          added: childPortfolio.length,
          items: childPortfolio
        };

        // Lessons - estimate from course updates (simplified)
        const lessonsStats = {
          completed: 0, // We'd need activity logs to track this accurately
          courses: childCourses.map(c => ({
            name: c.name,
            lessonsCompleted: 0 // Placeholder - would need activity tracking
          }))
        };

        return {
          child,
          stats: {
            attendance: attendanceStats,
            lessons: lessonsStats,
            assignments: {
              completed: completedAssignments.length,
              pending: pendingAssignments.length,
              overdue: overdueAssignments.length,
              grades,
              avgGrade
            },
            portfolio: portfolioStats
          }
        };
      });

      setWeeklyData(data);
    } catch (error) {
      console.error('Weekly data load error:', error);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleLogout = () => {
    pb.authStore.clear();
    router.push('/');
  };

  // Calculate family totals
  const familyTotals = useMemo(() => {
    if (weeklyData.length === 0) return null;
    
    return {
      attendance: {
        present: weeklyData.reduce((sum, d) => sum + d.stats.attendance.present, 0),
        absent: weeklyData.reduce((sum, d) => sum + d.stats.attendance.absent, 0),
        sick: weeklyData.reduce((sum, d) => sum + d.stats.attendance.sick, 0),
        total: weeklyData.reduce((sum, d) => sum + d.stats.attendance.total, 0)
      },
      assignments: {
        completed: weeklyData.reduce((sum, d) => sum + d.stats.assignments.completed, 0),
        pending: weeklyData.reduce((sum, d) => sum + d.stats.assignments.pending, 0),
        overdue: weeklyData.reduce((sum, d) => sum + d.stats.assignments.overdue, 0)
      },
      portfolio: weeklyData.reduce((sum, d) => sum + d.stats.portfolio.added, 0)
    };
  }, [weeklyData]);

  const selectedWeekOption = weekOptions.find(w => w.value === selectedWeek);

  if (loading) {
    return (
      <>
        <Header showLogout onLogout={handleLogout} />
        <main className="max-w-7xl mx-auto my-12 px-8">
          <LoadingScreen />
        </main>
      </>
    );
  }

  return (
    <>
      <Header showLogout onLogout={handleLogout} />
      <main className="max-w-7xl mx-auto my-12 px-8 pb-20 animate-fade-in">
        {/* Header - hidden in print */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-8 print:hidden">
          <div>
            <h2 className="font-display text-4xl sm:text-5xl font-extrabold tracking-tight mb-2">
              📊 Weekly Reports
            </h2>
            <p className="text-text-muted">
              Track your family&apos;s weekly homeschool progress
            </p>
          </div>
          <div className="flex gap-3 flex-wrap">
            <Button variant="outline" size="sm" onClick={() => router.push('/dashboard')}>
              ← Dashboard
            </Button>
          </div>
        </div>

        {/* Controls - hidden in print */}
        <Card className="mb-8 print:hidden">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-semibold mb-2">Select Week</label>
              <Select
                value={selectedWeek}
                onChange={(e) => setSelectedWeek(e.target.value)}
              >
                {weekOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </Select>
            </div>
            <Button onClick={handlePrint} variant="primary">
              🖨️ Print Report
            </Button>
          </div>
        </Card>

        {/* Print Header - only visible in print */}
        <div className="hidden print:block mb-8">
          <div className="text-center border-b-2 border-primary pb-4 mb-6">
            <h1 className="text-3xl font-display font-bold text-primary mb-2">
              Weekly Progress Report
            </h1>
            <p className="text-lg font-semibold">
              {selectedWeekOption ? formatDateRange(selectedWeekOption.start, selectedWeekOption.end) : ''}
            </p>
            <p className="text-sm text-text-muted mt-1">
              Generated on {new Date().toLocaleDateString('en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
            </p>
          </div>
        </div>

        {kids.length === 0 ? (
          <Card className="text-center py-12">
            <p className="text-text-muted text-lg mb-6">No children added yet.</p>
            <Button onClick={() => router.push('/manage-kids')}>Add Your First Child</Button>
          </Card>
        ) : (
          <>
            {/* Family Summary */}
            {familyTotals && (
              <div className="mb-8">
                <h3 className="font-serif italic text-2xl text-primary mb-4 print:text-xl">
                  Family Summary
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-green-50 border-2 border-green-200 rounded-2xl p-4 text-center print:border print:border-gray-300">
                    <div className="text-3xl mb-1">✅</div>
                    <div className="text-3xl font-display font-bold text-green-700">
                      {familyTotals.attendance.present}
                    </div>
                    <div className="text-xs text-green-600 font-semibold">Days Present</div>
                  </div>
                  <div className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-4 text-center print:border print:border-gray-300">
                    <div className="text-3xl mb-1">📝</div>
                    <div className="text-3xl font-display font-bold text-blue-700">
                      {familyTotals.assignments.completed}
                    </div>
                    <div className="text-xs text-blue-600 font-semibold">Assignments Done</div>
                  </div>
                  <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-4 text-center print:border print:border-gray-300">
                    <div className="text-3xl mb-1">⏳</div>
                    <div className="text-3xl font-display font-bold text-amber-700">
                      {familyTotals.assignments.pending}
                    </div>
                    <div className="text-xs text-amber-600 font-semibold">Pending</div>
                  </div>
                  <div className="bg-purple-50 border-2 border-purple-200 rounded-2xl p-4 text-center print:border print:border-gray-300">
                    <div className="text-3xl mb-1">🎨</div>
                    <div className="text-3xl font-display font-bold text-purple-700">
                      {familyTotals.portfolio}
                    </div>
                    <div className="text-xs text-purple-600 font-semibold">Portfolio Items</div>
                  </div>
                </div>
              </div>
            )}

            {/* Per-Child Reports */}
            <div className="space-y-8">
              {weeklyData.map(({ child, stats }) => (
                <Card key={child.id} className="print:break-inside-avoid print:shadow-none print:border print:border-gray-300">
                  <div className="flex items-center gap-3 mb-6 pb-4 border-b border-border">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-2xl font-display font-bold text-primary">
                      {child.name.charAt(0)}
                    </div>
                    <div>
                      <h3 className="font-display text-2xl font-bold text-primary m-0">
                        {child.name}
                      </h3>
                      <p className="text-sm text-text-muted m-0">
                        {child.grade} • Age {child.age}
                      </p>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-6">
                    {/* Attendance */}
                    <div>
                      <h4 className="font-display font-bold text-lg mb-3 flex items-center gap-2">
                        📅 Attendance
                      </h4>
                      {stats.attendance.total > 0 ? (
                        <div className="space-y-2">
                          <div className="flex justify-between items-center p-2 bg-green-50 rounded-lg">
                            <span className="font-medium">Present</span>
                            <span className="font-bold text-green-700">{stats.attendance.present} days</span>
                          </div>
                          {stats.attendance.absent > 0 && (
                            <div className="flex justify-between items-center p-2 bg-red-50 rounded-lg">
                              <span className="font-medium">Absent</span>
                              <span className="font-bold text-red-700">{stats.attendance.absent} days</span>
                            </div>
                          )}
                          {stats.attendance.sick > 0 && (
                            <div className="flex justify-between items-center p-2 bg-orange-50 rounded-lg">
                              <span className="font-medium">Sick</span>
                              <span className="font-bold text-orange-700">{stats.attendance.sick} days</span>
                            </div>
                          )}
                          {stats.attendance.halfDay > 0 && (
                            <div className="flex justify-between items-center p-2 bg-yellow-50 rounded-lg">
                              <span className="font-medium">Half Day</span>
                              <span className="font-bold text-yellow-700">{stats.attendance.halfDay} days</span>
                            </div>
                          )}
                          {stats.attendance.holiday > 0 && (
                            <div className="flex justify-between items-center p-2 bg-blue-50 rounded-lg">
                              <span className="font-medium">Holiday</span>
                              <span className="font-bold text-blue-700">{stats.attendance.holiday} days</span>
                            </div>
                          )}
                          <div className="mt-3 pt-3 border-t border-border">
                            <div className="flex justify-between items-center">
                              <span className="font-semibold">Attendance Rate</span>
                              <span className="text-lg font-bold text-primary">
                                {stats.attendance.total > 0 
                                  ? Math.round((stats.attendance.present / (stats.attendance.present + stats.attendance.absent)) * 100) || 0
                                  : 0}%
                              </span>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <p className="text-text-muted text-sm py-4 text-center bg-bg-alt rounded-lg">
                          No attendance recorded this week
                        </p>
                      )}
                    </div>

                    {/* Assignments */}
                    <div>
                      <h4 className="font-display font-bold text-lg mb-3 flex items-center gap-2">
                        📝 Assignments
                      </h4>
                      {(stats.assignments.completed + stats.assignments.pending + stats.assignments.overdue) > 0 ? (
                        <div className="space-y-2">
                          <div className="flex justify-between items-center p-2 bg-green-50 rounded-lg">
                            <span className="font-medium">Completed</span>
                            <span className="font-bold text-green-700">{stats.assignments.completed}</span>
                          </div>
                          <div className="flex justify-between items-center p-2 bg-yellow-50 rounded-lg">
                            <span className="font-medium">Pending</span>
                            <span className="font-bold text-yellow-700">{stats.assignments.pending}</span>
                          </div>
                          {stats.assignments.overdue > 0 && (
                            <div className="flex justify-between items-center p-2 bg-red-50 rounded-lg">
                              <span className="font-medium">Overdue</span>
                              <span className="font-bold text-red-700">{stats.assignments.overdue}</span>
                            </div>
                          )}
                          {stats.assignments.avgGrade !== null && (
                            <div className="mt-3 pt-3 border-t border-border">
                              <div className="flex justify-between items-center">
                                <span className="font-semibold">Average Grade</span>
                                <span className="text-lg font-bold text-primary">
                                  {stats.assignments.avgGrade}%
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-text-muted text-sm py-4 text-center bg-bg-alt rounded-lg">
                          No assignments this week
                        </p>
                      )}
                    </div>

                    {/* Portfolio */}
                    <div className="md:col-span-2">
                      <h4 className="font-display font-bold text-lg mb-3 flex items-center gap-2">
                        🎨 Portfolio Items Added
                      </h4>
                      {stats.portfolio.added > 0 ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                          {stats.portfolio.items.map(item => (
                            <div 
                              key={item.id} 
                              className="p-3 bg-bg-alt rounded-xl border border-border hover:border-primary transition-colors"
                            >
                              <div className="text-sm font-semibold truncate">{item.title}</div>
                              {item.subject && (
                                <div className="text-xs text-text-muted mt-1">{item.subject}</div>
                              )}
                              <div className="text-xs text-text-muted mt-1">
                                {new Date(item.created).toLocaleDateString('en-US', { 
                                  weekday: 'short', 
                                  month: 'short', 
                                  day: 'numeric' 
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-text-muted text-sm py-4 text-center bg-bg-alt rounded-lg">
                          No portfolio items added this week
                        </p>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            {/* Print Footer */}
            <div className="hidden print:block mt-8 pt-4 border-t border-gray-300 text-center text-sm text-text-muted">
              <p>Generated by Village Homeschool App • villageapp.co</p>
            </div>
          </>
        )}
      </main>

      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          @page {
            size: letter;
            margin: 0.5in;
          }
          
          body {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          
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
