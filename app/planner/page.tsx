'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getPocketBase } from '@/lib/pocketbase';
import { Child, Course } from '@/lib/types';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { LoadingScreen } from '@/components/ui/Spinner';
import { Toast } from '@/components/ui/Toast';
import { ClientOnly } from '@/components/ui/ClientOnly';

interface LessonPlan {
  course: Course;
  child: Child;
  lessonNumber: number;
  completed: boolean;
  date: string;
}

interface DayPlan {
  date: Date;
  dateStr: string;
  isToday: boolean;
  isWeekend: boolean;
  lessons: LessonPlan[];
}

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const FULL_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Color palette for children - distinct, accessible colors
const CHILD_COLORS = [
  { bg: 'bg-blue-100', border: 'border-blue-400', text: 'text-blue-800', check: 'text-blue-600' },
  { bg: 'bg-emerald-100', border: 'border-emerald-400', text: 'text-emerald-800', check: 'text-emerald-600' },
  { bg: 'bg-amber-100', border: 'border-amber-400', text: 'text-amber-800', check: 'text-amber-600' },
  { bg: 'bg-purple-100', border: 'border-purple-400', text: 'text-purple-800', check: 'text-purple-600' },
  { bg: 'bg-rose-100', border: 'border-rose-400', text: 'text-rose-800', check: 'text-rose-600' },
  { bg: 'bg-cyan-100', border: 'border-cyan-400', text: 'text-cyan-800', check: 'text-cyan-600' },
];

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Monday start
  return new Date(d.setDate(diff));
}

function formatDateStr(date: Date): string {
  return date.toISOString().split('T')[0];
}

function formatDisplayDate(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getChildColor(index: number) {
  return CHILD_COLORS[index % CHILD_COLORS.length];
}

export default function WeeklyPlannerPage() {
  const router = useRouter();
  const pb = getPocketBase();
  
  const [kids, setKids] = useState<Child[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [weekStart, setWeekStart] = useState<Date>(() => getWeekStart(new Date()));
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);
  const [completedLessons, setCompletedLessons] = useState<Set<string>>(new Set());
  const [showWeekends, setShowWeekends] = useState(false);

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

      const [kidRecords, courseRecords] = await Promise.all([
        pb.collection('children').getFullList({
          filter: `user = "${userId}"`,
          sort: 'name'
        }),
        pb.collection('courses').getFullList({
          filter: `child.user = "${userId}"`,
          sort: 'name'
        })
      ]);

      setKids(kidRecords as unknown as Child[]);
      setCourses(courseRecords as unknown as Course[]);

      // Load completed lessons for the current week
      loadCompletedLessons(kidRecords as unknown as Child[]);
    } catch (error) {
      console.error('Planner load error:', error);
      setToast({ message: 'Failed to load data', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const loadCompletedLessons = async (children: Child[]) => {
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);
    
    const completed = new Set<string>();
    
    try {
      for (const child of children) {
        const logs = await pb.collection('activity_logs').getFullList({
          filter: `child = "${child.id}" && type = "lesson_complete" && date >= "${formatDateStr(weekStart)}" && date < "${formatDateStr(weekEnd)}"`
        });
        
        logs.forEach((log: any) => {
          // Key: childId-courseId-date-lessonNum
          const key = `${child.id}-${log.title}-${log.date}`;
          completed.add(key);
        });
      }
    } catch (e) {
      console.warn('Could not load activity logs');
    }
    
    setCompletedLessons(completed);
  };

  const navigateWeek = (direction: number) => {
    const newStart = new Date(weekStart);
    newStart.setDate(newStart.getDate() + (direction * 7));
    setWeekStart(newStart);
  };

  const goToToday = () => {
    setWeekStart(getWeekStart(new Date()));
  };

  const getWeekDays = useCallback((): DayPlan[] => {
    const days: DayPlan[] = [];
    const today = formatDateStr(new Date());
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(weekStart);
      date.setDate(date.getDate() + i);
      const dateStr = formatDateStr(date);
      const dayOfWeek = date.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      
      if (!showWeekends && isWeekend) continue;
      
      const lessons: LessonPlan[] = [];
      
      // For each child, check which courses are scheduled for this day
      kids.forEach((child, childIndex) => {
        const childCourses = courses.filter(c => c.child === child.id);
        
        childCourses.forEach(course => {
          // Check if this course runs on this day of week
          const activeDays = parseActiveDays(course.active_days);
          
          if (activeDays.includes(dayOfWeek)) {
            // Calculate which lesson number this would be
            const lessonNum = calculateLessonForDate(course, date);
            
            if (lessonNum > 0 && lessonNum <= course.total_lessons) {
              const completionKey = `${child.id}-${course.name}-${dateStr}`;
              lessons.push({
                course,
                child,
                lessonNumber: lessonNum,
                completed: completedLessons.has(completionKey),
                date: dateStr
              });
            }
          }
        });
      });
      
      days.push({
        date,
        dateStr,
        isToday: dateStr === today,
        isWeekend,
        lessons
      });
    }
    
    return days;
  }, [weekStart, kids, courses, completedLessons, showWeekends]);

  const parseActiveDays = (activeDays?: string): number[] => {
    if (!activeDays) return [1, 2, 3, 4, 5]; // Default to weekdays
    
    try {
      const parsed = JSON.parse(activeDays);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // Try comma-separated
      const days = activeDays.split(',').map(d => parseInt(d.trim())).filter(d => !isNaN(d));
      if (days.length > 0) return days;
    }
    
    return [1, 2, 3, 4, 5];
  };

  const calculateLessonForDate = (course: Course, targetDate: Date): number => {
    // Calculate based on start date and active days
    if (!course.start_date) {
      return course.current_lesson + 1;
    }
    
    const startDate = new Date(course.start_date);
    const activeDays = parseActiveDays(course.active_days);
    let lessonCount = 0;
    
    const current = new Date(startDate);
    while (current <= targetDate) {
      if (activeDays.includes(current.getDay())) {
        lessonCount++;
      }
      current.setDate(current.getDate() + 1);
    }
    
    return lessonCount;
  };

  const toggleLessonComplete = async (lesson: LessonPlan) => {
    const key = `${lesson.child.id}-${lesson.course.name}-${lesson.date}`;
    
    try {
      const userId = pb.authStore.model?.id;
      if (!userId) return;

      if (completedLessons.has(key)) {
        // Remove completion
        const logs = await pb.collection('activity_logs').getFullList({
          filter: `child = "${lesson.child.id}" && title = "${lesson.course.name}" && date = "${lesson.date}" && type = "lesson_complete"`
        });
        
        for (const log of logs) {
          await pb.collection('activity_logs').delete(log.id);
        }
        
        setCompletedLessons(prev => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
        
        setToast({ message: 'Lesson unmarked', type: 'success' });
      } else {
        // Add completion
        await pb.collection('activity_logs').create({
          user: userId,
          child: lesson.child.id,
          type: 'lesson_complete',
          title: lesson.course.name,
          description: `Lesson ${lesson.lessonNumber} completed`,
          date: lesson.date
        });
        
        // Update course progress
        if (lesson.lessonNumber > lesson.course.current_lesson) {
          await pb.collection('courses').update(lesson.course.id, {
            current_lesson: lesson.lessonNumber,
            last_lesson_date: lesson.date
          });
        }
        
        setCompletedLessons(prev => new Set([...prev, key]));
        setToast({ message: 'Lesson completed! 🎉', type: 'success' });
      }
    } catch (error) {
      console.error('Toggle error:', error);
      setToast({ message: 'Failed to update lesson', type: 'error' });
    }
  };

  const getWeekStats = () => {
    const days = getWeekDays();
    let total = 0;
    let completed = 0;
    
    days.forEach(day => {
      day.lessons.forEach(lesson => {
        total++;
        if (lesson.completed) completed++;
      });
    });
    
    return { total, completed, percentage: total > 0 ? Math.round((completed / total) * 100) : 0 };
  };

  const getChildIndex = (childId: string): number => {
    return kids.findIndex(k => k.id === childId);
  };

  if (loading) {
    return <LoadingScreen />;
  }

  const weekDays = getWeekDays();
  const stats = getWeekStats();
  const weekEndDate = new Date(weekStart);
  weekEndDate.setDate(weekEndDate.getDate() + 6);

  return (
    <ClientOnly>
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50">
        <Header showLogout />
        
        <main className="max-w-7xl mx-auto px-4 py-6 print:py-2">
          {/* Page Title */}
          <h1 className="font-display text-4xl sm:text-5xl font-extrabold tracking-tight mb-6 print:hidden">
            Weekly Planner
          </h1>
          
          {/* Week Navigation */}
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6 print:hidden">
            <div className="flex items-center gap-2">
              <Button variant="secondary" onClick={() => navigateWeek(-1)}>
                ← Prev
              </Button>
              <Button variant="secondary" onClick={goToToday}>
                Today
              </Button>
              <Button variant="secondary" onClick={() => navigateWeek(1)}>
                Next →
              </Button>
            </div>
            
            <h2 className="text-xl font-bold text-gray-800">
              {formatDisplayDate(weekStart)} - {formatDisplayDate(weekEndDate)}
            </h2>
            
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm text-gray-600">
                <input
                  type="checkbox"
                  checked={showWeekends}
                  onChange={(e) => setShowWeekends(e.target.checked)}
                  className="rounded text-orange-600"
                />
                Show Weekends
              </label>
              <Button 
                variant="secondary" 
                onClick={() => window.print()}
                className="flex items-center gap-1"
              >
                🖨️ Print
              </Button>
            </div>
          </div>

          {/* Print Header */}
          <div className="hidden print:block mb-4">
            <h1 className="text-2xl font-bold">Weekly Lesson Plan</h1>
            <p className="text-gray-600">{formatDisplayDate(weekStart)} - {formatDisplayDate(weekEndDate)}</p>
          </div>

          {/* Week Stats */}
          <Card className="mb-6 p-4 print:mb-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-6">
                <div>
                  <span className="text-3xl font-bold text-orange-600">{stats.completed}</span>
                  <span className="text-gray-500">/{stats.total} lessons</span>
                </div>
                <div className="w-32 h-3 bg-gray-200 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-orange-400 to-amber-500 transition-all duration-500"
                    style={{ width: `${stats.percentage}%` }}
                  />
                </div>
                <span className="text-lg font-medium text-gray-700">{stats.percentage}% complete</span>
              </div>
              
              {/* Child Legend */}
              <div className="flex flex-wrap gap-3">
                {kids.map((kid, index) => {
                  const colors = getChildColor(index);
                  return (
                    <div 
                      key={kid.id}
                      className={`px-3 py-1 rounded-full ${colors.bg} ${colors.text} text-sm font-medium`}
                    >
                      {kid.name}
                    </div>
                  );
                })}
              </div>
            </div>
          </Card>

          {/* Week Grid */}
          <div className={`grid gap-4 ${showWeekends ? 'grid-cols-7' : 'grid-cols-5'} print:gap-2`}>
            {weekDays.map(day => {
              const dayOfWeek = day.date.getDay();
              return (
                <Card 
                  key={day.dateStr}
                  className={`p-3 min-h-[200px] print:min-h-[150px] ${
                    day.isToday 
                      ? 'ring-2 ring-orange-500 ring-offset-2' 
                      : day.isWeekend 
                        ? 'bg-gray-50' 
                        : ''
                  }`}
                >
                  <div className={`text-center mb-3 pb-2 border-b ${day.isToday ? 'border-orange-300' : 'border-gray-200'}`}>
                    <div className="text-xs text-gray-500 uppercase tracking-wide">
                      {FULL_DAYS[dayOfWeek]}
                    </div>
                    <div className={`text-lg font-bold ${day.isToday ? 'text-orange-600' : 'text-gray-800'}`}>
                      {day.date.getDate()}
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    {day.lessons.length === 0 ? (
                      <p className="text-sm text-gray-400 italic text-center py-4">
                        No lessons
                      </p>
                    ) : (
                      day.lessons.map((lesson, idx) => {
                        const colors = getChildColor(getChildIndex(lesson.child.id));
                        return (
                          <button
                            key={`${lesson.course.id}-${idx}`}
                            onClick={() => toggleLessonComplete(lesson)}
                            className={`w-full text-left p-2 rounded-lg border-l-4 transition-all
                              ${colors.border} ${colors.bg}
                              ${lesson.completed ? 'opacity-60' : 'hover:shadow-md'}
                              print:hover:shadow-none`}
                          >
                            <div className="flex items-start gap-2">
                              <span className={`text-lg ${lesson.completed ? colors.check : 'text-gray-300'} print:hidden`}>
                                {lesson.completed ? '✓' : '○'}
                              </span>
                              <div className="flex-1 min-w-0">
                                <div className={`text-sm font-medium truncate ${lesson.completed ? 'line-through' : ''} ${colors.text}`}>
                                  {lesson.course.name}
                                </div>
                                <div className="text-xs text-gray-500">
                                  L{lesson.lessonNumber} • {lesson.child.name}
                                </div>
                              </div>
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                </Card>
              );
            })}
          </div>

          {/* Quick Links */}
          <div className="mt-6 flex gap-3 print:hidden">
            <Button variant="secondary" onClick={() => router.push('/dashboard')}>
              ← Dashboard
            </Button>
            <Button variant="secondary" onClick={() => router.push('/attendance')}>
              Attendance
            </Button>
            <Button variant="secondary" onClick={() => router.push('/reports')}>
              Reports
            </Button>
          </div>

          {/* Print Footer */}
          <div className="hidden print:block mt-8 pt-4 border-t text-center text-sm text-gray-500">
            Generated by Village Homeschool • {new Date().toLocaleDateString()}
          </div>
        </main>

        {toast && (
          <Toast
            message={toast.message}
            type={toast.type}
            onClose={() => setToast(null)}
          />
        )}
      </div>
    </ClientOnly>
  );
}
