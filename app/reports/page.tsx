'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { getPocketBase } from '@/lib/pocketbase';
import { Child, Course, ActivityLog, Assignment, Attendance, SchoolYear } from '@/lib/types';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Select } from '@/components/ui/Input';
import { LoadingScreen } from '@/components/ui/Spinner';
import { ClientOnly } from '@/components/ui/ClientOnly';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { format, subDays, startOfWeek, endOfWeek, eachDayOfInterval, parseISO, isWithinInterval, startOfMonth, endOfMonth } from 'date-fns';

interface ChildWithCourses extends Child {
  courses: Course[];
}

const COLORS = ['#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#6366f1'];

export default function ReportsPage() {
  const router = useRouter();
  const pb = getPocketBase();
  const printRef = useRef<HTMLDivElement>(null);
  
  const [kids, setKids] = useState<ChildWithCourses[]>([]);
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [schoolYear, setSchoolYear] = useState<SchoolYear | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [dateRange, setDateRange] = useState<'week' | 'month' | 'quarter' | 'year'>('month');
  const [selectedChild, setSelectedChild] = useState<string>('all');
  
  useEffect(() => {
    if (!pb.authStore.isValid) {
      router.push('/');
      return;
    }
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const userId = pb.authStore.model?.id;
      if (!userId) return;

      const [childRecords, activityRecords, assignmentRecords, attendanceRecords, yearRecords] = await Promise.all([
        pb.collection('children').getFullList({ filter: `user = "${userId}"`, sort: 'name' }),
        pb.collection('activity_logs').getFullList({ filter: `user = "${userId}"`, sort: '-date' }).catch(() => []),
        pb.collection('assignments').getFullList({ filter: `user = "${userId}"`, sort: '-due_date' }).catch(() => []),
        pb.collection('attendance').getFullList({ filter: `user = "${userId}"`, sort: '-date' }).catch(() => []),
        pb.collection('school_years').getFullList({ filter: `user = "${userId}"`, sort: '-start_date', limit: 1 }).catch(() => []),
      ]);

      const kidsWithCourses = await Promise.all(
        childRecords.map(async (kid) => {
          try {
            const courses = await pb.collection('courses').getFullList({ filter: `child = "${kid.id}"`, sort: 'name' });
            return { ...kid, courses } as unknown as ChildWithCourses;
          } catch {
            return { ...kid, courses: [] } as unknown as ChildWithCourses;
          }
        })
      );

      setKids(kidsWithCourses);
      setActivities(activityRecords as unknown as ActivityLog[]);
      setAssignments(assignmentRecords as unknown as Assignment[]);
      setAttendance(attendanceRecords as unknown as Attendance[]);
      if (yearRecords.length > 0) setSchoolYear(yearRecords[0] as unknown as SchoolYear);
    } catch (error) {
      console.error('Reports load error:', error);
    } finally {
      setLoading(false);
    }
  };

  // Calculate date range
  const { startDate, endDate } = useMemo(() => {
    const now = new Date();
    switch (dateRange) {
      case 'week':
        return { startDate: startOfWeek(now), endDate: endOfWeek(now) };
      case 'month':
        return { startDate: startOfMonth(now), endDate: endOfMonth(now) };
      case 'quarter':
        return { startDate: subDays(now, 90), endDate: now };
      case 'year':
        return { startDate: subDays(now, 365), endDate: now };
      default:
        return { startDate: subDays(now, 30), endDate: now };
    }
  }, [dateRange]);

  // Filter data by date range and child
  const filteredActivities = useMemo(() => {
    return activities.filter(a => {
      const date = parseISO(a.date);
      const inRange = isWithinInterval(date, { start: startDate, end: endDate });
      const matchesChild = selectedChild === 'all' || a.child === selectedChild;
      return inRange && matchesChild;
    });
  }, [activities, startDate, endDate, selectedChild]);

  const filteredAssignments = useMemo(() => {
    return assignments.filter(a => {
      const date = parseISO(a.due_date);
      const inRange = isWithinInterval(date, { start: startDate, end: endDate });
      const matchesChild = selectedChild === 'all' || a.child === selectedChild;
      return inRange && matchesChild;
    });
  }, [assignments, startDate, endDate, selectedChild]);

  const filteredAttendance = useMemo(() => {
    return attendance.filter(a => {
      const date = parseISO(a.date);
      const inRange = isWithinInterval(date, { start: startDate, end: endDate });
      const matchesChild = selectedChild === 'all' || a.child === selectedChild;
      return inRange && matchesChild;
    });
  }, [attendance, startDate, endDate, selectedChild]);

  // Generate daily activity chart data
  const dailyActivityData = useMemo(() => {
    const days = eachDayOfInterval({ start: startDate, end: endDate });
    return days.map(day => {
      const dayStr = format(day, 'yyyy-MM-dd');
      const lessonCount = filteredActivities.filter(a => 
        a.date.startsWith(dayStr) && a.type === 'lesson_complete'
      ).length;
      const portfolioCount = filteredActivities.filter(a => 
        a.date.startsWith(dayStr) && a.type === 'portfolio_add'
      ).length;
      const attendanceRecord = filteredAttendance.find(a => a.date.startsWith(dayStr));
      
      return {
        date: format(day, 'MMM d'),
        fullDate: dayStr,
        lessons: lessonCount,
        portfolio: portfolioCount,
        attendance: attendanceRecord?.status === 'present' ? 1 : attendanceRecord?.status === 'half-day' ? 0.5 : 0,
      };
    });
  }, [startDate, endDate, filteredActivities, filteredAttendance]);

  // Progress by subject data
  const subjectProgressData = useMemo(() => {
    const subjects: Record<string, { completed: number; total: number }> = {};
    
    const filteredKids = selectedChild === 'all' ? kids : kids.filter(k => k.id === selectedChild);
    
    filteredKids.forEach(kid => {
      kid.courses.forEach(course => {
        if (!subjects[course.name]) {
          subjects[course.name] = { completed: 0, total: 0 };
        }
        subjects[course.name].completed += Math.min(course.current_lesson - 1, course.total_lessons);
        subjects[course.name].total += course.total_lessons;
      });
    });

    return Object.entries(subjects).map(([name, data]) => ({
      name: name.length > 15 ? name.substring(0, 15) + '...' : name,
      fullName: name,
      completed: data.completed,
      remaining: data.total - data.completed,
      progress: data.total > 0 ? Math.round((data.completed / data.total) * 100) : 0,
    }));
  }, [kids, selectedChild]);

  // Grade distribution for pie chart
  const gradeDistributionData = useMemo(() => {
    const gradedAssignments = filteredAssignments.filter(a => a.score !== undefined && a.score !== null);
    const distribution = { A: 0, B: 0, C: 0, D: 0, F: 0 };
    
    gradedAssignments.forEach(a => {
      const score = a.score || 0;
      if (score >= 90) distribution.A++;
      else if (score >= 80) distribution.B++;
      else if (score >= 70) distribution.C++;
      else if (score >= 60) distribution.D++;
      else distribution.F++;
    });

    return Object.entries(distribution)
      .filter(([_, value]) => value > 0)
      .map(([grade, count]) => ({ name: grade, value: count }));
  }, [filteredAssignments]);

  // Summary stats
  const summaryStats = useMemo(() => {
    const lessonsCompleted = filteredActivities.filter(a => a.type === 'lesson_complete').length;
    const portfolioItems = filteredActivities.filter(a => a.type === 'portfolio_add').length;
    const daysPresent = filteredAttendance.filter(a => a.status === 'present' || a.status === 'half-day').length;
    const totalDays = eachDayOfInterval({ start: startDate, end: endDate }).filter(d => d.getDay() !== 0 && d.getDay() !== 6).length;
    const attendanceRate = totalDays > 0 ? Math.round((daysPresent / totalDays) * 100) : 0;
    
    const gradedAssignments = filteredAssignments.filter(a => a.score !== undefined && a.score !== null);
    const averageGrade = gradedAssignments.length > 0 
      ? Math.round(gradedAssignments.reduce((sum, a) => sum + (a.score || 0), 0) / gradedAssignments.length)
      : null;

    return {
      lessonsCompleted,
      portfolioItems,
      attendanceRate,
      daysPresent,
      totalDays,
      assignmentsGraded: gradedAssignments.length,
      averageGrade,
    };
  }, [filteredActivities, filteredAttendance, filteredAssignments, startDate, endDate]);

  // Export to PDF
  const handleExport = () => {
    window.print();
  };

  if (loading) return <LoadingScreen message="Loading reports..." />;

  return (
    <>
      <Header showLogout onLogout={() => { pb.authStore.clear(); router.push('/'); }} />
      <ClientOnly>
        <main className="max-w-7xl mx-auto my-12 px-4 sm:px-8 pb-20 animate-fade-in print:my-0 print:px-4">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-6 mb-8 print:hidden">
            <div>
              <h2 className="font-display text-4xl sm:text-5xl font-extrabold tracking-tight mb-2">
                📊 Progress Reports
              </h2>
              <p className="text-text-muted">
                Visualize learning progress and generate documentation for compliance.
              </p>
            </div>
            <div className="flex gap-3 flex-wrap">
              <Button variant="outline" onClick={() => router.push('/dashboard')}>← Dashboard</Button>
              <Button onClick={handleExport}>🖨️ Print Report</Button>
            </div>
          </div>

          {/* Print Header */}
          <div className="hidden print:block mb-8">
            <h1 className="text-3xl font-bold mb-2">Homeschool Progress Report</h1>
            <p className="text-gray-600">
              {format(startDate, 'MMMM d, yyyy')} — {format(endDate, 'MMMM d, yyyy')}
            </p>
            <p className="text-gray-600">
              Student: {selectedChild === 'all' ? 'All Students' : kids.find(k => k.id === selectedChild)?.name}
            </p>
          </div>

          {/* Filters */}
          <Card className="mb-8 p-6 print:hidden">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1 max-w-xs">
                <Select
                  label="Date Range"
                  value={dateRange}
                  onChange={(e) => setDateRange(e.target.value as 'week' | 'month' | 'quarter' | 'year')}
                >
                  <option value="week">This Week</option>
                  <option value="month">This Month</option>
                  <option value="quarter">Last 90 Days</option>
                  <option value="year">This Year</option>
                </Select>
              </div>
              <div className="flex-1 max-w-xs">
                <Select
                  label="Student"
                  value={selectedChild}
                  onChange={(e) => setSelectedChild(e.target.value)}
                >
                  <option value="all">All Students</option>
                  {kids.map(k => <option key={k.id} value={k.id}>{k.name}</option>)}
                </Select>
              </div>
              <div className="flex items-end">
                <p className="text-sm text-text-muted">
                  {format(startDate, 'MMM d')} — {format(endDate, 'MMM d, yyyy')}
                </p>
              </div>
            </div>
          </Card>

          {/* Summary Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8 print:grid-cols-4">
            {[
              { 
                label: 'Lessons Completed', 
                value: summaryStats.lessonsCompleted, 
                emoji: '📚', 
                color: 'text-purple-600',
                sublabel: `in ${dateRange === 'week' ? '7 days' : dateRange === 'month' ? '30 days' : dateRange === 'quarter' ? '90 days' : '365 days'}`
              },
              { 
                label: 'Portfolio Items', 
                value: summaryStats.portfolioItems, 
                emoji: '🎨', 
                color: 'text-cyan-600',
                sublabel: 'work samples added'
              },
              { 
                label: 'Attendance Rate', 
                value: `${summaryStats.attendanceRate}%`, 
                emoji: '📅', 
                color: 'text-emerald-600',
                sublabel: `${summaryStats.daysPresent}/${summaryStats.totalDays} school days`
              },
              { 
                label: 'Avg. Grade', 
                value: summaryStats.averageGrade !== null ? `${summaryStats.averageGrade}%` : 'N/A', 
                emoji: '📝', 
                color: 'text-amber-600',
                sublabel: `${summaryStats.assignmentsGraded} assignments graded`
              },
            ].map((stat, i) => (
              <Card key={i} className="p-4 sm:p-6 text-center print:border print:border-gray-300">
                <div className="text-2xl mb-1 print:hidden">{stat.emoji}</div>
                <div className={`font-display text-3xl sm:text-4xl font-extrabold ${stat.color} print:text-black`}>
                  {stat.value}
                </div>
                <div className="text-xs sm:text-sm mt-1 text-text-muted font-semibold">{stat.label}</div>
                <div className="text-[10px] text-text-muted/70 mt-1">{stat.sublabel}</div>
              </Card>
            ))}
          </div>

          <div className="grid lg:grid-cols-2 gap-8 mb-8">
            {/* Daily Activity Chart */}
            <Card className="p-6 print:border print:border-gray-300">
              <h3 className="font-display text-xl font-bold mb-4">Daily Activity</h3>
              <div className="h-64 print:h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={dailyActivityData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis 
                      dataKey="date" 
                      tick={{ fontSize: 10 }} 
                      interval={dateRange === 'week' ? 0 : 'preserveStartEnd'}
                    />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: '#fff', 
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px',
                        fontSize: '12px'
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '12px' }} />
                    <Line 
                      type="monotone" 
                      dataKey="lessons" 
                      name="Lessons" 
                      stroke="#8b5cf6" 
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="portfolio" 
                      name="Portfolio" 
                      stroke="#06b6d4" 
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <p className="text-xs text-text-muted mt-4 text-center">
                Track daily learning activities over time
              </p>
            </Card>

            {/* Subject Progress Chart */}
            <Card className="p-6 print:border print:border-gray-300">
              <h3 className="font-display text-xl font-bold mb-4">Progress by Subject</h3>
              {subjectProgressData.length > 0 ? (
                <div className="h-64 print:h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart 
                      data={subjectProgressData} 
                      layout="vertical"
                      margin={{ left: 0, right: 20 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 10 }} domain={[0, 'dataMax']} />
                      <YAxis 
                        dataKey="name" 
                        type="category" 
                        width={100} 
                        tick={{ fontSize: 10 }}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: '#fff', 
                          border: '1px solid #e5e7eb',
                          borderRadius: '8px',
                          fontSize: '12px'
                        }}
                        formatter={(value) => [
                          value ?? 0,
                          ''
                        ]}
                      />
                      <Legend wrapperStyle={{ fontSize: '12px' }} />
                      <Bar dataKey="completed" name="Completed" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} />
                      <Bar dataKey="remaining" name="Remaining" stackId="a" fill="#e5e7eb" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-64 flex items-center justify-center text-text-muted">
                  No courses tracked yet
                </div>
              )}
              <p className="text-xs text-text-muted mt-4 text-center">
                Lesson completion by subject
              </p>
            </Card>
          </div>

          <div className="grid lg:grid-cols-2 gap-8 mb-8">
            {/* Grade Distribution */}
            <Card className="p-6 print:border print:border-gray-300">
              <h3 className="font-display text-xl font-bold mb-4">Grade Distribution</h3>
              {gradeDistributionData.length > 0 ? (
                <div className="h-64 print:h-48 flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={gradeDistributionData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={90}
                        paddingAngle={3}
                        dataKey="value"
                        label={({ name, percent }) => `${name}: ${((percent ?? 0) * 100).toFixed(0)}%`}
                        labelLine={false}
                      >
                        {gradeDistributionData.map((entry, index) => {
                          const gradeColors: Record<string, string> = {
                            A: '#10b981',
                            B: '#3b82f6',
                            C: '#f59e0b',
                            D: '#f97316',
                            F: '#ef4444',
                          };
                          return (
                            <Cell key={`cell-${index}`} fill={gradeColors[entry.name] || COLORS[index % COLORS.length]} />
                          );
                        })}
                      </Pie>
                      <Tooltip 
                        formatter={(value) => [value ?? 0, 'Assignments']}
                        contentStyle={{ 
                          backgroundColor: '#fff', 
                          border: '1px solid #e5e7eb',
                          borderRadius: '8px',
                          fontSize: '12px'
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-64 flex items-center justify-center text-text-muted">
                  No graded assignments in this period
                </div>
              )}
              <p className="text-xs text-text-muted mt-4 text-center">
                Distribution of grades across all assignments
              </p>
            </Card>

            {/* Student Progress Summary */}
            <Card className="p-6 print:border print:border-gray-300">
              <h3 className="font-display text-xl font-bold mb-4">Student Progress</h3>
              <div className="space-y-4">
                {(selectedChild === 'all' ? kids : kids.filter(k => k.id === selectedChild)).map(kid => {
                  const kidStats = kid.courses.reduce((acc, course) => {
                    acc.completed += Math.min(course.current_lesson - 1, course.total_lessons);
                    acc.total += course.total_lessons;
                    return acc;
                  }, { completed: 0, total: 0 });
                  
                  const progress = kidStats.total > 0 ? Math.round((kidStats.completed / kidStats.total) * 100) : 0;
                  
                  return (
                    <div key={kid.id} className="bg-bg-alt p-4 rounded-xl">
                      <div className="flex justify-between items-center mb-2">
                        <div>
                          <h4 className="font-bold">{kid.name}</h4>
                          <p className="text-xs text-text-muted">
                            {kid.grade} • {kid.courses.length} courses • {kidStats.completed}/{kidStats.total} lessons
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="text-2xl font-bold text-primary">{progress}%</span>
                        </div>
                      </div>
                      <div className="w-full bg-border rounded-full h-2">
                        <div 
                          className="bg-primary h-2 rounded-full transition-all" 
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
                {kids.length === 0 && (
                  <div className="text-center text-text-muted py-8">
                    No students added yet
                  </div>
                )}
              </div>
            </Card>
          </div>

          {/* Detailed Activity Log (for print) */}
          <Card className="p-6 print:border print:border-gray-300">
            <h3 className="font-display text-xl font-bold mb-4">Recent Activity Log</h3>
            <div className="space-y-2 max-h-96 overflow-y-auto print:max-h-none print:overflow-visible">
              {filteredActivities.length > 0 ? (
                filteredActivities.slice(0, 20).map((activity, i) => {
                  const kid = kids.find(k => k.id === activity.child);
                  return (
                    <div key={activity.id || i} className="flex items-center gap-3 p-2 bg-bg-alt rounded-lg print:bg-white print:border-b print:border-gray-200 print:rounded-none">
                      <span className="text-lg print:hidden">
                        {activity.type === 'lesson_complete' ? '📚' : activity.type === 'portfolio_add' ? '🎨' : '📅'}
                      </span>
                      <div className="flex-1">
                        <p className="text-sm font-semibold m-0">{activity.title}</p>
                        <p className="text-xs text-text-muted m-0">
                          {kid?.name || 'Student'} • {format(parseISO(activity.date), 'MMM d, yyyy h:mm a')}
                        </p>
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="text-center text-text-muted py-8">
                  No activities recorded in this period
                </p>
              )}
            </div>
          </Card>

          {/* Print Footer */}
          <div className="hidden print:block mt-8 pt-4 border-t border-gray-300 text-center text-gray-500 text-sm">
            <p>Generated by Village Homeschool • {format(new Date(), 'MMMM d, yyyy')}</p>
            <p>This document serves as an official record of homeschool progress.</p>
          </div>
        </main>
      </ClientOnly>

      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          @page {
            margin: 0.5in;
            size: letter;
          }
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
        }
      `}</style>
    </>
  );
}
