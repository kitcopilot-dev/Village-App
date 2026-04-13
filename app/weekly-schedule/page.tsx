'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { getPocketBase } from '@/lib/pocketbase';
import { Child, Course } from '@/lib/types';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ClientOnly } from '@/components/ui/ClientOnly';

interface ChildWithCourses extends Child {
  courses: Course[];
}

interface ScheduleItem {
  childId: string;
  childName: string;
  courseId: string;
  courseName: string;
  lessonNumber: number;
  totalLessons: number;
}

interface WeeklyPlan {
  [dayKey: string]: ScheduleItem[];
}

// Get Monday of the current week
const getWeekStart = (date: Date): Date => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Sunday
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
};

// Format date for display
const formatDate = (date: Date): string => {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

// Get day key for localStorage
const getDayKey = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

// Days of the week (Monday-Friday for school)
const SCHOOL_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const FULL_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export default function WeeklySchedulePage() {
  const router = useRouter();
  const pb = getPocketBase();

  const [kids, setKids] = useState<ChildWithCourses[]>([]);
  const [loading, setLoading] = useState(true);
  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()));
  const [completedItems, setCompletedItems] = useState<Set<string>>(new Set());
  const [showWeekend, setShowWeekend] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  useEffect(() => {
    if (!pb.authStore.isValid) {
      router.push('/');
      return;
    }
    loadData();
  }, []);

  // Load completed items from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('village_weekly_completed');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setCompletedItems(new Set(parsed));
      } catch (e) {
        console.warn('Failed to parse completed items');
      }
    }
  }, []);

  // Save completed items to localStorage
  useEffect(() => {
    if (completedItems.size > 0) {
      localStorage.setItem('village_weekly_completed', JSON.stringify([...completedItems]));
    }
  }, [completedItems]);

  const loadData = async () => {
    try {
      const userId = pb.authStore.model?.id;
      if (!userId) return;

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
      console.error('Error loading schedule data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Generate weekly plan based on courses and active days
  const weeklyPlan = useMemo((): WeeklyPlan => {
    const plan: WeeklyPlan = {};
    const daysToUse = showWeekend ? FULL_WEEK : SCHOOL_DAYS;
    
    // Initialize all days
    daysToUse.forEach((_, i) => {
      const dayDate = new Date(weekStart);
      dayDate.setDate(weekStart.getDate() + i);
      plan[getDayKey(dayDate)] = [];
    });

    kids.forEach((kid) => {
      kid.courses.forEach((course) => {
        // Parse active days (default to weekdays if not set)
        let activeDays: number[];
        try {
          if (course.active_days) {
            // Could be "1,2,3,4,5" or JSON array [1,2,3,4,5]
            if (course.active_days.startsWith('[')) {
              activeDays = JSON.parse(course.active_days);
            } else {
              activeDays = course.active_days.split(',').map(d => parseInt(d.trim()));
            }
          } else {
            // Default: Monday through Friday (1-5)
            activeDays = [1, 2, 3, 4, 5];
          }
        } catch {
          activeDays = [1, 2, 3, 4, 5];
        }

        // Calculate remaining lessons
        const remainingLessons = course.total_lessons - course.current_lesson + 1;
        if (remainingLessons <= 0) return; // Course complete

        // Distribute lessons across active days this week
        let lessonIndex = 0;
        daysToUse.forEach((dayName, i) => {
          const dayOfWeek = i + 1; // Monday = 1
          if (!activeDays.includes(dayOfWeek)) return;

          const dayDate = new Date(weekStart);
          dayDate.setDate(weekStart.getDate() + i);
          const dayKey = getDayKey(dayDate);

          // Only add if there are remaining lessons
          if (lessonIndex < remainingLessons) {
            const lessonNum = course.current_lesson + lessonIndex;
            if (lessonNum <= course.total_lessons) {
              plan[dayKey].push({
                childId: kid.id,
                childName: kid.name,
                courseId: course.id,
                courseName: course.name,
                lessonNumber: lessonNum,
                totalLessons: course.total_lessons
              });
              lessonIndex++;
            }
          }
        });
      });
    });

    return plan;
  }, [kids, weekStart, showWeekend]);

  const toggleComplete = (dayKey: string, item: ScheduleItem) => {
    const itemKey = `${dayKey}_${item.courseId}_${item.lessonNumber}`;
    setCompletedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemKey)) {
        newSet.delete(itemKey);
      } else {
        newSet.add(itemKey);
      }
      return newSet;
    });
  };

  const isCompleted = (dayKey: string, item: ScheduleItem): boolean => {
    const itemKey = `${dayKey}_${item.courseId}_${item.lessonNumber}`;
    return completedItems.has(itemKey);
  };

  const navigateWeek = (direction: 'prev' | 'next') => {
    const newDate = new Date(weekStart);
    newDate.setDate(weekStart.getDate() + (direction === 'next' ? 7 : -7));
    setWeekStart(newDate);
  };

  const goToCurrentWeek = () => {
    setWeekStart(getWeekStart(new Date()));
  };

  const handlePrint = () => {
    window.print();
  };

  const handleLogout = () => {
    pb.authStore.clear();
    router.push('/');
  };

  // Calculate stats
  const weekDays = showWeekend ? FULL_WEEK : SCHOOL_DAYS;
  const totalItems = Object.values(weeklyPlan).flat().length;
  const completedCount = Object.entries(weeklyPlan).reduce((count, [dayKey, items]) => {
    return count + items.filter(item => isCompleted(dayKey, item)).length;
  }, 0);
  const completionPercent = totalItems > 0 ? Math.round((completedCount / totalItems) * 100) : 0;

  if (loading) {
    return (
      <>
        <Header showLogout onLogout={handleLogout} />
        <main className="max-w-7xl mx-auto my-12 px-8">
          <p className="text-center text-text-muted">Loading schedule...</p>
        </main>
      </>
    );
  }

  return (
    <>
      <Header showLogout onLogout={handleLogout} />
      <ClientOnly>
        <main className="max-w-7xl mx-auto my-12 px-4 sm:px-8 pb-20 animate-fade-in print:my-0 print:px-4">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6 print:hidden">
            <div>
              <h2 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight mb-1">
                📅 Weekly Schedule
              </h2>
              <p className="text-text-muted">Plan your homeschool week at a glance</p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button variant="outline" size="sm" onClick={() => router.push('/dashboard')}>
                ← Dashboard
              </Button>
              <Button variant="outline" size="sm" onClick={handlePrint}>
                🖨️ Print
              </Button>
            </div>
          </div>

          {/* Print Header */}
          <div className="hidden print:block mb-6">
            <h1 className="text-2xl font-bold">Weekly Schedule</h1>
            <p className="text-gray-600">
              Week of {formatDate(weekStart)} — {formatDate(new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000))}
            </p>
          </div>

          {/* Controls */}
          <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center mb-6 print:hidden">
            {/* Week Navigation */}
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => navigateWeek('prev')}>
                ← Prev
              </Button>
              <div className="text-center min-w-[200px]">
                <span className="font-semibold">
                  {formatDate(weekStart)} — {formatDate(new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000))}
                </span>
              </div>
              <Button variant="ghost" size="sm" onClick={() => navigateWeek('next')}>
                Next →
              </Button>
              <Button variant="outline" size="sm" onClick={goToCurrentWeek}>
                Today
              </Button>
            </div>

            {/* View Options */}
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={showWeekend}
                  onChange={(e) => setShowWeekend(e.target.checked)}
                  className="rounded border-gray-300"
                />
                Show Weekend
              </label>
              <div className="flex border rounded-lg overflow-hidden">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`px-3 py-1.5 text-sm ${viewMode === 'grid' ? 'bg-primary text-white' : 'bg-white hover:bg-gray-50'}`}
                >
                  Grid
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`px-3 py-1.5 text-sm ${viewMode === 'list' ? 'bg-primary text-white' : 'bg-white hover:bg-gray-50'}`}
                >
                  List
                </button>
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          <Card className="mb-6 print:border print:shadow-none">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h3 className="font-semibold text-lg m-0">Week Progress</h3>
                <p className="text-sm text-text-muted m-0">
                  {completedCount} of {totalItems} lessons completed
                </p>
              </div>
              <div className="flex items-center gap-4 w-full sm:w-auto">
                <div className="flex-1 sm:w-48 h-3 bg-bg-alt rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-primary to-secondary transition-all duration-500"
                    style={{ width: `${completionPercent}%` }}
                  />
                </div>
                <span className="text-xl font-bold text-primary">{completionPercent}%</span>
              </div>
            </div>
          </Card>

          {kids.length === 0 ? (
            <Card className="text-center py-12">
              <p className="text-text-muted text-lg mb-4">No children or courses set up yet.</p>
              <Button onClick={() => router.push('/manage-kids')}>Add Children & Courses</Button>
            </Card>
          ) : totalItems === 0 ? (
            <Card className="text-center py-12">
              <p className="text-text-muted text-lg mb-4">All courses are complete or no active lessons this week!</p>
              <Button onClick={() => router.push('/dashboard')}>Back to Dashboard</Button>
            </Card>
          ) : viewMode === 'grid' ? (
            /* Grid View */
            <div className="grid gap-4 print:gap-2" style={{ 
              gridTemplateColumns: `repeat(${weekDays.length}, minmax(0, 1fr))` 
            }}>
              {weekDays.map((dayName, i) => {
                const dayDate = new Date(weekStart);
                dayDate.setDate(weekStart.getDate() + i);
                const dayKey = getDayKey(dayDate);
                const dayItems = weeklyPlan[dayKey] || [];
                const isToday = getDayKey(new Date()) === dayKey;
                const dayCompleted = dayItems.filter(item => isCompleted(dayKey, item)).length;

                return (
                  <div 
                    key={dayName}
                    className={`rounded-xl border-2 p-3 transition-all print:rounded print:border ${
                      isToday ? 'border-primary bg-primary/5' : 'border-border bg-white'
                    }`}
                  >
                    <div className="text-center mb-3 pb-2 border-b">
                      <div className={`font-bold text-sm ${isToday ? 'text-primary' : ''}`}>
                        {dayName}
                      </div>
                      <div className="text-xs text-text-muted">{formatDate(dayDate)}</div>
                      {dayItems.length > 0 && (
                        <div className="text-xs mt-1 text-text-muted">
                          {dayCompleted}/{dayItems.length} done
                        </div>
                      )}
                    </div>
                    <div className="space-y-2">
                      {dayItems.length === 0 ? (
                        <p className="text-center text-xs text-text-muted py-4">No lessons</p>
                      ) : (
                        dayItems.map((item, idx) => {
                          const completed = isCompleted(dayKey, item);
                          return (
                            <div
                              key={`${item.courseId}-${idx}`}
                              onClick={() => toggleComplete(dayKey, item)}
                              className={`p-2 rounded-lg cursor-pointer transition-all text-sm print:cursor-default ${
                                completed 
                                  ? 'bg-green-100 border border-green-300 line-through opacity-75' 
                                  : 'bg-bg-alt hover:bg-border border border-transparent'
                              }`}
                            >
                              <div className="flex items-start gap-2">
                                <span className={`text-base print:text-sm ${completed ? 'opacity-50' : ''}`}>
                                  {completed ? '✅' : '⬜'}
                                </span>
                                <div className="flex-1 min-w-0">
                                  <div className={`font-medium truncate ${completed ? 'text-green-800' : ''}`}>
                                    {item.childName}
                                  </div>
                                  <div className="text-xs text-text-muted truncate">
                                    {item.courseName}
                                  </div>
                                  <div className="text-xs text-text-muted">
                                    Lesson {item.lessonNumber}/{item.totalLessons}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* List View - Grouped by Child */
            <div className="space-y-6">
              {kids.map((kid) => {
                const kidLessons = Object.entries(weeklyPlan).flatMap(([dayKey, items]) => 
                  items.filter(item => item.childId === kid.id).map(item => ({ dayKey, ...item }))
                );
                
                if (kidLessons.length === 0) return null;

                return (
                  <Card key={kid.id}>
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                        {kid.name.charAt(0)}
                      </div>
                      <div>
                        <h3 className="font-display font-bold m-0">{kid.name}</h3>
                        <p className="text-xs text-text-muted m-0">{kidLessons.length} lessons this week</p>
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left py-2 px-2">Done</th>
                            <th className="text-left py-2 px-2">Day</th>
                            <th className="text-left py-2 px-2">Course</th>
                            <th className="text-left py-2 px-2">Lesson</th>
                          </tr>
                        </thead>
                        <tbody>
                          {kidLessons.map((lesson, idx) => {
                            const completed = isCompleted(lesson.dayKey, lesson);
                            const dayDate = new Date(lesson.dayKey);
                            const dayName = dayDate.toLocaleDateString('en-US', { weekday: 'short' });
                            
                            return (
                              <tr 
                                key={idx}
                                className={`border-b last:border-0 cursor-pointer hover:bg-bg-alt ${
                                  completed ? 'bg-green-50' : ''
                                }`}
                                onClick={() => toggleComplete(lesson.dayKey, lesson)}
                              >
                                <td className="py-2 px-2">
                                  <span className="text-lg">{completed ? '✅' : '⬜'}</span>
                                </td>
                                <td className={`py-2 px-2 ${completed ? 'line-through opacity-75' : ''}`}>
                                  {dayName} {formatDate(dayDate)}
                                </td>
                                <td className={`py-2 px-2 font-medium ${completed ? 'line-through opacity-75' : ''}`}>
                                  {lesson.courseName}
                                </td>
                                <td className={`py-2 px-2 ${completed ? 'line-through opacity-75' : ''}`}>
                                  {lesson.lessonNumber} / {lesson.totalLessons}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Quick Legend */}
          <div className="mt-8 text-center text-sm text-text-muted print:hidden">
            <p>
              💡 Tip: Click any lesson to mark it complete. Progress saves automatically.
            </p>
          </div>

          {/* Print Footer */}
          <div className="hidden print:block mt-8 pt-4 border-t text-xs text-gray-500 text-center">
            Generated by Village Homeschool • {new Date().toLocaleDateString()}
          </div>
        </main>
      </ClientOnly>

      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          header, .print\\:hidden {
            display: none !important;
          }
          .print\\:block {
            display: block !important;
          }
          main {
            margin: 0 !important;
            padding: 0.5rem !important;
          }
          @page {
            margin: 0.5in;
            size: landscape;
          }
        }
      `}</style>
    </>
  );
}
