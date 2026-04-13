'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { getPocketBase } from '@/lib/pocketbase';
import { Child, Course, Assignment, Attendance, ActivityLog, Profile, PortfolioItem } from '@/lib/types';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input, Select } from '@/components/ui/Input';
import { LoadingScreen } from '@/components/ui/Spinner';
import { ClientOnly } from '@/components/ui/ClientOnly';

interface ChildWithCourses extends Child {
  courses: Course[];
}

interface ReportData {
  lessonsCompleted: ActivityLog[];
  attendanceRecords: Attendance[];
  assignmentsGraded: Assignment[];
  portfolioItems: PortfolioItem[];
}

const CHILD_COLORS = [
  { bg: 'bg-primary/10', text: 'text-primary', border: 'border-primary/30', accent: '#4B6344' },
  { bg: 'bg-secondary/10', text: 'text-secondary', border: 'border-secondary/30', accent: '#D97757' },
  { bg: 'bg-accent/10', text: 'text-accent-dark', border: 'border-accent/30', accent: '#E6AF2E' },
  { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-300', accent: '#7C3AED' },
  { bg: 'bg-teal-100', text: 'text-teal-700', border: 'border-teal-300', accent: '#0D9488' },
  { bg: 'bg-pink-100', text: 'text-pink-700', border: 'border-pink-300', accent: '#DB2777' },
];

// Get Monday of a given week
function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

// Get Sunday of a given week
function getSunday(d: Date): Date {
  const monday = getMonday(d);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return sunday;
}

export default function ReportsPage() {
  const router = useRouter();
  const pb = getPocketBase();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [kids, setKids] = useState<ChildWithCourses[]>([]);
  const [reportData, setReportData] = useState<ReportData>({
    lessonsCompleted: [],
    attendanceRecords: [],
    assignmentsGraded: [],
    portfolioItems: []
  });
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  // Date range - default to current week
  const [startDate, setStartDate] = useState(() => {
    const monday = getMonday(new Date());
    return monday.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    const sunday = getSunday(new Date());
    return sunday.toISOString().split('T')[0];
  });
  const [filterChild, setFilterChild] = useState('all');

  useEffect(() => {
    if (!pb.authStore.isValid) {
      router.push('/');
      return;
    }
    loadBaseData();
  }, []);

  useEffect(() => {
    if (kids.length > 0) {
      loadReportData();
    }
  }, [startDate, endDate, kids]);

  const loadBaseData = async () => {
    try {
      const userId = pb.authStore.model?.id;
      if (!userId) return;

      // Load profile
      try {
        const profiles = await pb.collection('profiles').getFullList({
          filter: `user = "${userId}"`,
          limit: 1
        });
        if (profiles.length > 0) {
          setProfile(profiles[0] as unknown as Profile);
        }
      } catch (e) {
        console.warn('Profile not found');
      }

      // Load children with courses
      const childRecords = await pb.collection('children').getFullList({
        filter: `user = "${userId}"`,
        sort: 'name'
      });

      const kidsWithCourses = await Promise.all(
        childRecords.map(async (kid) => {
          try {
            const courses = await pb.collection('courses').getFullList({
              filter: `child = "${kid.id}"`,
              sort: 'name'
            });
            return { ...kid, courses } as unknown as ChildWithCourses;
          } catch {
            return { ...kid, courses: [] } as unknown as ChildWithCourses;
          }
        })
      );
      setKids(kidsWithCourses);
    } catch (error) {
      console.error('Base data load error:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadReportData = async () => {
    setGenerating(true);
    try {
      const userId = pb.authStore.model?.id;
      if (!userId) return;

      const startIso = `${startDate}T00:00:00`;
      const endIso = `${endDate}T23:59:59`;

      // Load activity logs (completed lessons)
      let lessonsCompleted: ActivityLog[] = [];
      try {
        lessonsCompleted = await pb.collection('activity_logs').getFullList({
          filter: `user = "${userId}" && type = "lesson_complete" && date >= "${startIso}" && date <= "${endIso}"`,
          sort: 'date'
        }) as unknown as ActivityLog[];
      } catch (e) {
        console.warn('Activity logs not found');
      }

      // Load attendance
      let attendanceRecords: Attendance[] = [];
      try {
        attendanceRecords = await pb.collection('attendance').getFullList({
          filter: `user = "${userId}" && date >= "${startDate}" && date <= "${endDate}"`,
          sort: 'date'
        }) as unknown as Attendance[];
      } catch (e) {
        console.warn('Attendance not found');
      }

      // Load graded assignments
      let assignmentsGraded: Assignment[] = [];
      try {
        assignmentsGraded = await pb.collection('assignments').getFullList({
          filter: `user = "${userId}" && status = "Graded" && due_date >= "${startDate}" && due_date <= "${endDate}"`,
          sort: 'due_date'
        }) as unknown as Assignment[];
      } catch (e) {
        console.warn('Assignments not found');
      }

      // Load portfolio items
      let portfolioItems: PortfolioItem[] = [];
      try {
        portfolioItems = await pb.collection('portfolio').getFullList({
          filter: `user = "${userId}" && date >= "${startDate}" && date <= "${endDate}"`,
          sort: 'date'
        }) as unknown as PortfolioItem[];
      } catch (e) {
        console.warn('Portfolio not found');
      }

      setReportData({
        lessonsCompleted,
        attendanceRecords,
        assignmentsGraded,
        portfolioItems
      });
    } catch (error) {
      console.error('Report data load error:', error);
    } finally {
      setGenerating(false);
    }
  };

  const handleLogout = () => {
    pb.authStore.clear();
    router.push('/');
  };

  // Quick date range setters
  const setThisWeek = () => {
    const monday = getMonday(new Date());
    const sunday = getSunday(new Date());
    setStartDate(monday.toISOString().split('T')[0]);
    setEndDate(sunday.toISOString().split('T')[0]);
  };

  const setLastWeek = () => {
    const lastWeek = new Date();
    lastWeek.setDate(lastWeek.getDate() - 7);
    const monday = getMonday(lastWeek);
    const sunday = getSunday(lastWeek);
    setStartDate(monday.toISOString().split('T')[0]);
    setEndDate(sunday.toISOString().split('T')[0]);
  };

  const setThisMonth = () => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    setStartDate(firstDay.toISOString().split('T')[0]);
    setEndDate(lastDay.toISOString().split('T')[0]);
  };

  // Filter data by child
  const filteredData = useMemo(() => {
    if (filterChild === 'all') return reportData;
    return {
      lessonsCompleted: reportData.lessonsCompleted.filter(l => l.child === filterChild),
      attendanceRecords: reportData.attendanceRecords.filter(a => a.child === filterChild),
      assignmentsGraded: reportData.assignmentsGraded.filter(a => a.child === filterChild),
      portfolioItems: reportData.portfolioItems.filter(p => p.child === filterChild)
    };
  }, [reportData, filterChild]);

  // Calculate stats
  const stats = useMemo(() => {
    const totalLessons = filteredData.lessonsCompleted.length;
    const totalDaysPresent = filteredData.attendanceRecords.filter(a => a.status === 'present').length;
    const totalDaysAbsent = filteredData.attendanceRecords.filter(a => a.status === 'absent').length;
    const totalDaysSick = filteredData.attendanceRecords.filter(a => a.status === 'sick').length;
    const totalAssignments = filteredData.assignmentsGraded.length;
    const avgScore = totalAssignments > 0 
      ? Math.round(filteredData.assignmentsGraded.reduce((sum, a) => sum + (a.score || 0), 0) / totalAssignments)
      : 0;
    const totalPortfolio = filteredData.portfolioItems.length;

    // Lessons by child
    const lessonsByChild: Record<string, number> = {};
    filteredData.lessonsCompleted.forEach(l => {
      lessonsByChild[l.child] = (lessonsByChild[l.child] || 0) + 1;
    });

    // Attendance by child
    const attendanceByChild: Record<string, { present: number; absent: number; sick: number }> = {};
    filteredData.attendanceRecords.forEach(a => {
      if (!attendanceByChild[a.child]) {
        attendanceByChild[a.child] = { present: 0, absent: 0, sick: 0 };
      }
      if (a.status === 'present') attendanceByChild[a.child].present++;
      else if (a.status === 'absent') attendanceByChild[a.child].absent++;
      else if (a.status === 'sick') attendanceByChild[a.child].sick++;
    });

    return {
      totalLessons,
      totalDaysPresent,
      totalDaysAbsent,
      totalDaysSick,
      totalAssignments,
      avgScore,
      totalPortfolio,
      lessonsByChild,
      attendanceByChild
    };
  }, [filteredData]);

  // Group lessons by day
  const lessonsByDay = useMemo(() => {
    const grouped: Record<string, ActivityLog[]> = {};
    filteredData.lessonsCompleted.forEach(l => {
      const day = l.date.split('T')[0];
      if (!grouped[day]) grouped[day] = [];
      grouped[day].push(l);
    });
    return grouped;
  }, [filteredData]);

  const handlePrint = () => {
    window.print();
  };

  const formatDateRange = () => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  };

  if (loading) {
    return <LoadingScreen message="Loading report data..." />;
  }

  return (
    <>
      <Header showLogout onLogout={handleLogout} />
      <ClientOnly>
        <main className="max-w-5xl mx-auto my-8 px-4 sm:px-6 pb-20 animate-fade-in print:my-0 print:px-0">
          {/* Header - Hidden on print */}
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-6 mb-8 print:hidden">
            <div>
              <h1 className="font-display text-4xl sm:text-5xl font-extrabold tracking-tight mb-2">
                Progress Reports
              </h1>
              <p className="text-text-muted">Generate weekly or monthly summaries of homeschool progress.</p>
            </div>
            <div className="flex gap-3">
              <Button variant="ghost" onClick={() => router.push('/dashboard')}>📊 Dashboard</Button>
              <Button variant="primary" onClick={handlePrint}>🖨️ Print</Button>
            </div>
          </div>

          {/* Date Range Picker - Hidden on print */}
          <Card className="mb-8 print:hidden">
            <div className="flex flex-col lg:flex-row lg:items-end gap-4">
              <div className="flex flex-wrap gap-2 lg:order-2 lg:ml-auto">
                <Button variant="ghost" size="sm" onClick={setThisWeek}>This Week</Button>
                <Button variant="ghost" size="sm" onClick={setLastWeek}>Last Week</Button>
                <Button variant="ghost" size="sm" onClick={setThisMonth}>This Month</Button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 flex-1 lg:order-1">
                <Input 
                  label="Start Date" 
                  type="date" 
                  value={startDate} 
                  onChange={(e) => setStartDate(e.target.value)} 
                />
                <Input 
                  label="End Date" 
                  type="date" 
                  value={endDate} 
                  onChange={(e) => setEndDate(e.target.value)} 
                />
                <Select
                  label="Filter by Child"
                  value={filterChild}
                  onChange={(e) => setFilterChild(e.target.value)}
                >
                  <option value="all">All Children</option>
                  {kids.map(k => <option key={k.id} value={k.id}>{k.name}</option>)}
                </Select>
              </div>
            </div>
          </Card>

          {/* Print Header - Only visible on print */}
          <div className="hidden print:block mb-8 border-b-2 border-primary pb-6">
            <div className="flex justify-between items-start">
              <div>
                <h1 className="font-display text-3xl font-extrabold text-primary mb-1">
                  {profile?.family_name || 'Family'} Homeschool
                </h1>
                <p className="text-lg font-semibold">Weekly Progress Report</p>
                <p className="text-sm text-text-muted">{formatDateRange()}</p>
              </div>
              <div className="text-right text-sm text-text-muted">
                <p>Generated: {new Date().toLocaleDateString()}</p>
                {filterChild !== 'all' && (
                  <p className="font-semibold text-primary">
                    Student: {kids.find(k => k.id === filterChild)?.name}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Report Content */}
          {generating ? (
            <div className="text-center py-20">
              <div className="animate-spin w-10 h-10 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
              <p className="text-text-muted">Generating report...</p>
            </div>
          ) : (
            <>
              {/* Summary Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8 print:grid-cols-4">
                <Card className="text-center py-6 print:py-4 print:shadow-none print:border">
                  <div className="text-3xl sm:text-4xl font-display font-extrabold text-primary print:text-2xl">
                    {stats.totalLessons}
                  </div>
                  <div className="text-xs font-bold uppercase tracking-wider text-text-muted mt-1">
                    Lessons Completed
                  </div>
                </Card>
                <Card className="text-center py-6 print:py-4 print:shadow-none print:border">
                  <div className="text-3xl sm:text-4xl font-display font-extrabold text-green-600 print:text-2xl">
                    {stats.totalDaysPresent}
                  </div>
                  <div className="text-xs font-bold uppercase tracking-wider text-text-muted mt-1">
                    Days Present
                  </div>
                </Card>
                <Card className="text-center py-6 print:py-4 print:shadow-none print:border">
                  <div className="text-3xl sm:text-4xl font-display font-extrabold text-secondary print:text-2xl">
                    {stats.totalAssignments}
                  </div>
                  <div className="text-xs font-bold uppercase tracking-wider text-text-muted mt-1">
                    Assignments Graded
                  </div>
                </Card>
                <Card className="text-center py-6 print:py-4 print:shadow-none print:border">
                  <div className="text-3xl sm:text-4xl font-display font-extrabold text-accent-dark print:text-2xl">
                    {stats.avgScore > 0 ? `${stats.avgScore}%` : '—'}
                  </div>
                  <div className="text-xs font-bold uppercase tracking-wider text-text-muted mt-1">
                    Average Score
                  </div>
                </Card>
              </div>

              {/* Per-Child Summary */}
              {filterChild === 'all' && kids.length > 1 && (
                <Card className="mb-8 print:shadow-none print:border">
                  <h2 className="font-display text-xl font-bold mb-4 flex items-center gap-2">
                    <span>👨‍👩‍👧‍👦</span> By Student
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {kids.map((kid, idx) => {
                      const colors = CHILD_COLORS[idx % CHILD_COLORS.length];
                      const lessons = stats.lessonsByChild[kid.id] || 0;
                      const att = stats.attendanceByChild[kid.id] || { present: 0, absent: 0, sick: 0 };
                      const childAssignments = reportData.assignmentsGraded.filter(a => a.child === kid.id);
                      const avgChildScore = childAssignments.length > 0
                        ? Math.round(childAssignments.reduce((sum, a) => sum + (a.score || 0), 0) / childAssignments.length)
                        : null;

                      return (
                        <div key={kid.id} className={`p-4 rounded-xl border-2 ${colors.bg} ${colors.border}`}>
                          <div className="flex items-center gap-3 mb-3">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold ${colors.bg} ${colors.text} border-2 ${colors.border}`}>
                              {kid.name.charAt(0)}
                            </div>
                            <div>
                              <h3 className={`font-bold ${colors.text}`}>{kid.name}</h3>
                              <p className="text-xs text-text-muted">{kid.grade || `Age ${kid.age}`}</p>
                            </div>
                          </div>
                          <div className="grid grid-cols-3 gap-2 text-center text-sm">
                            <div>
                              <div className="font-bold">{lessons}</div>
                              <div className="text-[10px] text-text-muted uppercase">Lessons</div>
                            </div>
                            <div>
                              <div className="font-bold text-green-600">{att.present}</div>
                              <div className="text-[10px] text-text-muted uppercase">Present</div>
                            </div>
                            <div>
                              <div className="font-bold">{avgChildScore !== null ? `${avgChildScore}%` : '—'}</div>
                              <div className="text-[10px] text-text-muted uppercase">Avg Score</div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </Card>
              )}

              {/* Lessons Completed */}
              <Card className="mb-8 print:shadow-none print:border print:break-inside-avoid">
                <h2 className="font-display text-xl font-bold mb-4 flex items-center gap-2">
                  <span>📖</span> Lessons Completed
                </h2>
                {Object.keys(lessonsByDay).length === 0 ? (
                  <p className="text-text-muted text-center py-8">No lessons recorded for this period.</p>
                ) : (
                  <div className="space-y-4">
                    {Object.entries(lessonsByDay)
                      .sort((a, b) => b[0].localeCompare(a[0]))
                      .map(([day, lessons]) => {
                        const dayDate = new Date(day);
                        return (
                          <div key={day} className="border-l-4 border-primary/30 pl-4">
                            <div className="font-semibold text-sm text-primary mb-2">
                              {dayDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                            </div>
                            <div className="space-y-1">
                              {lessons.map((lesson, i) => {
                                const kid = kids.find(k => k.id === lesson.child);
                                const kidIndex = kids.findIndex(k => k.id === lesson.child);
                                const colors = CHILD_COLORS[kidIndex % CHILD_COLORS.length];
                                return (
                                  <div key={i} className="flex items-center gap-2 text-sm">
                                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${colors.bg} ${colors.text}`}>
                                      {kid?.name || '?'}
                                    </span>
                                    <span>{lesson.title}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </Card>

              {/* Attendance Summary */}
              <Card className="mb-8 print:shadow-none print:border print:break-inside-avoid">
                <h2 className="font-display text-xl font-bold mb-4 flex items-center gap-2">
                  <span>📅</span> Attendance Summary
                </h2>
                {filteredData.attendanceRecords.length === 0 ? (
                  <p className="text-text-muted text-center py-8">No attendance records for this period.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b-2 border-border">
                          <th className="text-left py-2 font-bold">Student</th>
                          <th className="text-center py-2 font-bold text-green-600">✅ Present</th>
                          <th className="text-center py-2 font-bold text-red-500">❌ Absent</th>
                          <th className="text-center py-2 font-bold text-yellow-600">🤒 Sick</th>
                          <th className="text-center py-2 font-bold">Attendance %</th>
                        </tr>
                      </thead>
                      <tbody>
                        {kids.filter(k => filterChild === 'all' || k.id === filterChild).map((kid, idx) => {
                          const att = stats.attendanceByChild[kid.id] || { present: 0, absent: 0, sick: 0 };
                          const total = att.present + att.absent + att.sick;
                          const percentage = total > 0 ? Math.round((att.present / total) * 100) : 0;
                          const colors = CHILD_COLORS[idx % CHILD_COLORS.length];
                          
                          return (
                            <tr key={kid.id} className="border-b border-border/50">
                              <td className="py-3">
                                <span className={`font-semibold ${colors.text}`}>{kid.name}</span>
                              </td>
                              <td className="text-center py-3 font-bold text-green-600">{att.present}</td>
                              <td className="text-center py-3 font-bold text-red-500">{att.absent}</td>
                              <td className="text-center py-3 font-bold text-yellow-600">{att.sick}</td>
                              <td className="text-center py-3">
                                <span className={`font-bold ${percentage >= 90 ? 'text-green-600' : percentage >= 75 ? 'text-yellow-600' : 'text-red-500'}`}>
                                  {total > 0 ? `${percentage}%` : '—'}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>

              {/* Assignments & Grades */}
              <Card className="mb-8 print:shadow-none print:border print:break-inside-avoid">
                <h2 className="font-display text-xl font-bold mb-4 flex items-center gap-2">
                  <span>📝</span> Assignments & Grades
                </h2>
                {filteredData.assignmentsGraded.length === 0 ? (
                  <p className="text-text-muted text-center py-8">No graded assignments for this period.</p>
                ) : (
                  <div className="space-y-3">
                    {filteredData.assignmentsGraded.map((assignment) => {
                      const kid = kids.find(k => k.id === assignment.child);
                      const kidIndex = kids.findIndex(k => k.id === assignment.child);
                      const colors = CHILD_COLORS[kidIndex % CHILD_COLORS.length];
                      const score = assignment.score || 0;
                      
                      return (
                        <div key={assignment.id} className="flex items-center gap-4 p-3 bg-bg-alt rounded-xl print:bg-transparent print:border print:border-border">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`px-2 py-0.5 rounded text-xs font-bold ${colors.bg} ${colors.text}`}>
                                {kid?.name || '?'}
                              </span>
                              <span className="font-semibold">{assignment.title}</span>
                            </div>
                            <div className="text-xs text-text-muted mt-1">
                              {assignment.subject && <span>{assignment.subject} • </span>}
                              {assignment.due_date && new Date(assignment.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className={`text-2xl font-display font-extrabold ${
                              score >= 90 ? 'text-green-600' : score >= 70 ? 'text-yellow-600' : 'text-red-500'
                            }`}>
                              {score}%
                            </div>
                            <div className="text-[10px] text-text-muted uppercase">Score</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>

              {/* Portfolio Additions */}
              {filteredData.portfolioItems.length > 0 && (
                <Card className="mb-8 print:shadow-none print:border print:break-inside-avoid">
                  <h2 className="font-display text-xl font-bold mb-4 flex items-center gap-2">
                    <span>🎨</span> Portfolio Additions
                  </h2>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 print:grid-cols-4">
                    {filteredData.portfolioItems.map((item) => {
                      const kid = kids.find(k => k.id === item.child);
                      return (
                        <div key={item.id} className="text-center">
                          <div className="aspect-square bg-bg-alt rounded-xl flex items-center justify-center text-4xl mb-2 print:border">
                            🎨
                          </div>
                          <p className="font-semibold text-sm truncate">{item.title}</p>
                          <p className="text-xs text-text-muted">{kid?.name} • {item.subject}</p>
                        </div>
                      );
                    })}
                  </div>
                </Card>
              )}

              {/* Print Footer */}
              <div className="hidden print:block mt-8 pt-4 border-t border-border text-center text-xs text-text-muted">
                <p>Generated by Village Homeschool • {new Date().toLocaleDateString()} • {formatDateRange()}</p>
              </div>

              {/* Actions - Hidden on print */}
              <div className="flex flex-col sm:flex-row justify-center gap-4 mt-8 print:hidden">
                <Button variant="outline" onClick={() => router.push('/dashboard')}>
                  ← Back to Dashboard
                </Button>
                <Button variant="primary" onClick={handlePrint}>
                  🖨️ Print Report
                </Button>
              </div>
            </>
          )}
        </main>
      </ClientOnly>

      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          body {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          header, .print\\:hidden {
            display: none !important;
          }
          .print\\:block {
            display: block !important;
          }
          @page {
            margin: 0.75in;
          }
        }
      `}</style>
    </>
  );
}
