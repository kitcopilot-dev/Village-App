'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { getPocketBase } from '@/lib/pocketbase';
import { Child, Course, Assignment, Event, Attendance, SchoolYear, SchoolBreak, Profile } from '@/lib/types';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ClientOnly } from '@/components/ui/ClientOnly';

interface ChildWithCourses extends Child {
  courses: Course[];
}

interface TodayLesson {
  child: ChildWithCourses;
  course: Course;
  lessonNumber: number;
  isComplete: boolean;
}

const MOTIVATIONAL_QUOTES = [
  { text: "Education is not the filling of a pail, but the lighting of a fire.", author: "W.B. Yeats" },
  { text: "The beautiful thing about learning is that no one can take it away from you.", author: "B.B. King" },
  { text: "Every child is an artist. The problem is how to remain an artist once we grow up.", author: "Pablo Picasso" },
  { text: "Play is the highest form of research.", author: "Albert Einstein" },
  { text: "Children must be taught how to think, not what to think.", author: "Margaret Mead" },
  { text: "The more that you read, the more things you will know.", author: "Dr. Seuss" },
  { text: "Learning is a treasure that will follow its owner everywhere.", author: "Chinese Proverb" },
  { text: "Education is the passport to the future.", author: "Malcolm X" },
  { text: "Tell me and I forget. Teach me and I remember. Involve me and I learn.", author: "Benjamin Franklin" },
  { text: "The roots of education are bitter, but the fruit is sweet.", author: "Aristotle" },
  { text: "Live as if you were to die tomorrow. Learn as if you were to live forever.", author: "Mahatma Gandhi" },
  { text: "Education is not preparation for life; education is life itself.", author: "John Dewey" },
];

const CHILD_COLORS = [
  'bg-primary/10 text-primary border-primary/30',
  'bg-secondary/10 text-secondary border-secondary/30',
  'bg-accent/10 text-accent-dark border-accent/30',
  'bg-purple-100 text-purple-700 border-purple-300',
  'bg-teal-100 text-teal-700 border-teal-300',
  'bg-pink-100 text-pink-700 border-pink-300',
];

export default function TodayPage() {
  const router = useRouter();
  const pb = getPocketBase();
  
  const [profile, setProfile] = useState<Profile | null>(null);
  const [kids, setKids] = useState<ChildWithCourses[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [schoolYear, setSchoolYear] = useState<SchoolYear | null>(null);
  const [breaks, setBreaks] = useState<SchoolBreak[]>([]);
  const [loading, setLoading] = useState(true);
  const [completedLessons, setCompletedLessons] = useState<Set<string>>(new Set());
  const [markingAttendance, setMarkingAttendance] = useState<string | null>(null);

  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const dayOfWeek = today.getDay();
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayAbbr = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Get a consistent quote for the day (based on date)
  const dailyQuote = useMemo(() => {
    const dayOfYear = Math.floor((today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24));
    return MOTIVATIONAL_QUOTES[dayOfYear % MOTIVATIONAL_QUOTES.length];
  }, [todayStr]);

  useEffect(() => {
    if (!pb.authStore.isValid) {
      router.push('/');
      return;
    }
    loadTodayData();
  }, []);

  const loadTodayData = async () => {
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

      // Load assignments due in next 3 days
      const threeDaysLater = new Date();
      threeDaysLater.setDate(threeDaysLater.getDate() + 3);
      try {
        const assignmentRecords = await pb.collection('assignments').getFullList({
          filter: `user = "${userId}" && status != "completed" && status != "Graded" && due_date >= "${todayStr}" && due_date <= "${threeDaysLater.toISOString().split('T')[0]}"`,
          sort: 'due_date'
        });
        setAssignments(assignmentRecords as unknown as Assignment[]);
      } catch (e) {
        console.warn('Assignments not found');
      }

      // Load events in next 7 days
      const sevenDaysLater = new Date();
      sevenDaysLater.setDate(sevenDaysLater.getDate() + 7);
      try {
        const eventRecords = await pb.collection('events').getFullList({
          filter: `event_date >= "${todayStr}" && event_date <= "${sevenDaysLater.toISOString().split('T')[0]}"`,
          sort: 'event_date,event_time',
          limit: 5
        });
        setEvents(eventRecords as unknown as Event[]);
      } catch (e) {
        console.warn('Events not found');
      }

      // Load today's attendance
      try {
        const attendanceRecords = await pb.collection('attendance').getFullList({
          filter: `user = "${userId}" && date = "${todayStr}"`
        });
        setAttendance(attendanceRecords as unknown as Attendance[]);
      } catch (e) {
        console.warn('Attendance not found');
      }

      // Load school year and breaks
      try {
        const years = await pb.collection('school_years').getFullList({
          filter: `user = "${userId}"`,
          sort: '-start_date',
          limit: 1
        });
        if (years.length > 0) {
          setSchoolYear(years[0] as unknown as SchoolYear);
          const breakRecords = await pb.collection('school_breaks').getFullList({
            filter: `school_year = "${years[0].id}"`
          });
          setBreaks(breakRecords as unknown as SchoolBreak[]);
        }
      } catch (e) {
        console.warn('Calendar data failed to load');
      }

      // Load completed lessons for today (activity logs)
      try {
        const activityRecords = await pb.collection('activity_logs').getFullList({
          filter: `user = "${userId}" && date >= "${todayStr}T00:00:00" && date <= "${todayStr}T23:59:59" && type = "lesson_complete"`
        });
        const completed = new Set<string>();
        activityRecords.forEach(a => {
          // Store as child_course key
          if (a.child && a.description) {
            completed.add(`${a.child}_${a.description}`);
          }
        });
        setCompletedLessons(completed);
      } catch (e) {
        console.warn('Activity logs not found');
      }

    } catch (error) {
      console.error('Today load error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    pb.authStore.clear();
    router.push('/');
  };

  // Get courses scheduled for today
  const getTodayLessons = (): TodayLesson[] => {
    const lessons: TodayLesson[] = [];
    const todayAbbr = dayAbbr[dayOfWeek];

    kids.forEach(kid => {
      kid.courses.forEach(course => {
        // Parse active_days
        let activeDays: string[] = [];
        if (course.active_days) {
          if (typeof course.active_days === 'string') {
            const cleaned = course.active_days.trim();
            if (cleaned.startsWith('[') && cleaned.endsWith(']')) {
              try {
                activeDays = JSON.parse(cleaned);
              } catch {
                activeDays = cleaned.split(',').map(d => d.trim());
              }
            } else {
              activeDays = cleaned.split(',').map(d => d.trim());
            }
          } else if (Array.isArray(course.active_days)) {
            activeDays = course.active_days;
          }
        } else {
          // Default to weekdays
          activeDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
        }

        // Check if today is an active day for this course
        if (activeDays.includes(todayAbbr)) {
          // Check if course is not complete
          if (course.current_lesson <= course.total_lessons) {
            const lessonKey = `${kid.id}_${course.id}`;
            lessons.push({
              child: kid,
              course: course,
              lessonNumber: course.current_lesson,
              isComplete: completedLessons.has(lessonKey)
            });
          }
        }
      });
    });

    return lessons;
  };

  const todayLessons = getTodayLessons();

  // Check if in a school break
  const isInBreak = breaks.some(b => {
    const bStart = new Date(b.start_date);
    const bEnd = new Date(b.end_date);
    bStart.setHours(0, 0, 0, 0);
    bEnd.setHours(23, 59, 59, 999);
    return today >= bStart && today <= bEnd;
  });

  const currentBreak = breaks.find(b => {
    const bStart = new Date(b.start_date);
    const bEnd = new Date(b.end_date);
    bStart.setHours(0, 0, 0, 0);
    bEnd.setHours(23, 59, 59, 999);
    return today >= bStart && today <= bEnd;
  });

  // Mark attendance for a child
  const markAttendance = async (childId: string, status: 'present' | 'absent' | 'half-day' | 'sick') => {
    setMarkingAttendance(childId);
    try {
      const userId = pb.authStore.model?.id;
      const existing = attendance.find(a => a.child === childId);
      
      if (existing) {
        // Update existing
        await pb.collection('attendance').update(existing.id, { status });
        setAttendance(prev => prev.map(a => a.id === existing.id ? { ...a, status } : a));
      } else {
        // Create new
        const record = await pb.collection('attendance').create({
          user: userId,
          child: childId,
          date: todayStr,
          status
        });
        setAttendance(prev => [...prev, record as unknown as Attendance]);
      }
    } catch (error) {
      console.error('Failed to mark attendance:', error);
    } finally {
      setMarkingAttendance(null);
    }
  };

  // Mark lesson complete
  const markLessonComplete = async (lesson: TodayLesson) => {
    try {
      const userId = pb.authStore.model?.id;
      const lessonKey = `${lesson.child.id}_${lesson.course.id}`;

      if (lesson.isComplete) {
        // Un-complete: decrement course and remove from set
        await pb.collection('courses').update(lesson.course.id, {
          current_lesson: lesson.course.current_lesson - 1
        });
        setCompletedLessons(prev => {
          const next = new Set(prev);
          next.delete(lessonKey);
          return next;
        });
        // Reload to refresh course data
        loadTodayData();
      } else {
        // Complete: increment course, add activity log
        await pb.collection('courses').update(lesson.course.id, {
          current_lesson: lesson.course.current_lesson + 1,
          last_lesson_date: todayStr
        });

        // Log activity
        try {
          await pb.collection('activity_logs').create({
            user: userId,
            child: lesson.child.id,
            type: 'lesson_complete',
            title: `${lesson.course.name} - Lesson ${lesson.lessonNumber}`,
            description: lesson.course.id,
            date: new Date().toISOString()
          });
        } catch (e) {
          console.warn('Could not log activity');
        }

        setCompletedLessons(prev => {
          const next = new Set(prev);
          next.add(lessonKey);
          return next;
        });
        loadTodayData();
      }
    } catch (error) {
      console.error('Failed to mark lesson:', error);
    }
  };

  // Get greeting based on time of day
  const getGreeting = () => {
    const hour = today.getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const isToday = dateStr === todayStr;
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const isTomorrow = dateStr === tomorrow.toISOString().split('T')[0];
    
    if (isToday) return 'Today';
    if (isTomorrow) return 'Tomorrow';
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  if (loading) {
    return (
      <>
        <Header showLogout onLogout={handleLogout} />
        <main className="max-w-4xl mx-auto my-12 px-6">
          <p className="text-center text-text-muted">Loading your day...</p>
        </main>
      </>
    );
  }

  const completedCount = todayLessons.filter(l => l.isComplete).length;
  const totalLessons = todayLessons.length;
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

  return (
    <>
      <Header showLogout onLogout={handleLogout} />
      <ClientOnly>
        <main className="max-w-4xl mx-auto my-8 px-6 pb-20 animate-fade-in">
          {/* Hero Section */}
          <div className="text-center mb-10">
            <div className="text-6xl mb-4">
              {isInBreak ? '🏖️' : isWeekend ? '🌟' : '📚'}
            </div>
            <h1 className="font-display text-4xl sm:text-5xl font-extrabold tracking-tight mb-2">
              {getGreeting()}{profile?.family_name ? `, ${profile.family_name.split(' ')[0]}` : ''}!
            </h1>
            <p className="text-xl text-text-muted">
              {dayNames[dayOfWeek]}, {today.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </p>
            
            {isInBreak && currentBreak && (
              <div className="mt-4 inline-block px-6 py-3 rounded-full bg-accent/20 text-accent-dark font-bold">
                🎉 {currentBreak.name} — Enjoy your break!
              </div>
            )}
          </div>

          {/* Daily Quote */}
          <Card className="mb-8 bg-gradient-to-br from-primary/5 to-secondary/5 border-primary/20">
            <blockquote className="text-center">
              <p className="font-serif italic text-lg text-text leading-relaxed mb-2">
                "{dailyQuote.text}"
              </p>
              <footer className="text-sm text-text-muted">— {dailyQuote.author}</footer>
            </blockquote>
          </Card>

          {/* Today's Progress Overview */}
          {!isInBreak && !isWeekend && todayLessons.length > 0 && (
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-display text-2xl font-bold">Today's Progress</h2>
                <span className="text-lg font-bold text-primary">{completedCount}/{totalLessons} complete</span>
              </div>
              <div className="w-full h-4 bg-bg-alt rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-primary to-secondary rounded-full transition-all duration-500"
                  style={{ width: `${totalLessons > 0 ? (completedCount / totalLessons) * 100 : 0}%` }}
                />
              </div>
              {completedCount === totalLessons && totalLessons > 0 && (
                <p className="text-center mt-4 text-lg font-bold text-primary animate-pulse">
                  🎉 All done for today! Great work!
                </p>
              )}
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-6">
            {/* Today's Lessons */}
            <Card>
              <h3 className="font-display text-xl font-bold mb-4 flex items-center gap-2">
                <span>📖</span> Today's Lessons
              </h3>
              
              {isInBreak ? (
                <p className="text-text-muted text-center py-6">No lessons during break!</p>
              ) : isWeekend ? (
                <p className="text-text-muted text-center py-6">
                  Weekend — enjoy your time off! 🌈
                </p>
              ) : todayLessons.length === 0 ? (
                <p className="text-text-muted text-center py-6">
                  No lessons scheduled today. <br />
                  <button 
                    onClick={() => router.push('/manage-kids')}
                    className="text-primary underline mt-2"
                  >
                    Add courses →
                  </button>
                </p>
              ) : (
                <div className="space-y-3">
                  {todayLessons.map((lesson, idx) => {
                    const childIndex = kids.findIndex(k => k.id === lesson.child.id);
                    const colorClass = CHILD_COLORS[childIndex % CHILD_COLORS.length];
                    
                    return (
                      <button
                        key={`${lesson.child.id}-${lesson.course.id}`}
                        onClick={() => markLessonComplete(lesson)}
                        className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${
                          lesson.isComplete 
                            ? 'bg-primary/10 border-primary/30 line-through opacity-60' 
                            : 'bg-bg-alt border-border hover:border-primary hover:bg-white'
                        }`}
                      >
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border ${colorClass}`}>
                          {lesson.child.name.charAt(0)}
                        </div>
                        <div className="flex-1 text-left">
                          <p className="font-semibold text-sm">{lesson.course.name}</p>
                          <p className="text-xs text-text-muted">
                            {lesson.child.name} • Lesson {lesson.lessonNumber}/{lesson.course.total_lessons}
                          </p>
                        </div>
                        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                          lesson.isComplete ? 'bg-primary border-primary text-white' : 'border-border'
                        }`}>
                          {lesson.isComplete && '✓'}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </Card>

            {/* Attendance Quick-Mark */}
            <Card>
              <h3 className="font-display text-xl font-bold mb-4 flex items-center gap-2">
                <span>📅</span> Attendance
              </h3>
              
              {kids.length === 0 ? (
                <p className="text-text-muted text-center py-6">No children added yet.</p>
              ) : (
                <div className="space-y-3">
                  {kids.map((kid, idx) => {
                    const kidAttendance = attendance.find(a => a.child === kid.id);
                    const status = kidAttendance?.status;
                    const colorClass = CHILD_COLORS[idx % CHILD_COLORS.length];
                    const isMarking = markingAttendance === kid.id;
                    
                    return (
                      <div key={kid.id} className="flex items-center gap-3 p-3 bg-bg-alt rounded-xl">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border ${colorClass}`}>
                          {kid.name.charAt(0)}
                        </div>
                        <span className="font-semibold flex-1">{kid.name}</span>
                        <div className="flex gap-1">
                          {(['present', 'absent', 'sick'] as const).map(s => {
                            const icons = { present: '✅', absent: '❌', sick: '🤒' };
                            const isActive = status === s;
                            return (
                              <button
                                key={s}
                                onClick={() => markAttendance(kid.id, s)}
                                disabled={isMarking}
                                className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
                                  isActive 
                                    ? 'bg-primary text-white scale-110' 
                                    : 'bg-white border border-border hover:border-primary'
                                } ${isMarking ? 'opacity-50' : ''}`}
                                title={s.charAt(0).toUpperCase() + s.slice(1)}
                              >
                                {icons[s]}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>

            {/* Upcoming Assignments */}
            <Card>
              <h3 className="font-display text-xl font-bold mb-4 flex items-center gap-2">
                <span>📝</span> Due Soon
              </h3>
              
              {assignments.length === 0 ? (
                <p className="text-text-muted text-center py-6">
                  No assignments due in the next 3 days. 🎉
                </p>
              ) : (
                <div className="space-y-3">
                  {assignments.slice(0, 5).map(assignment => {
                    const kid = kids.find(k => k.id === assignment.child);
                    const dueLabel = formatDate(assignment.due_date || '');
                    const isToday = assignment.due_date === todayStr;
                    
                    return (
                      <div 
                        key={assignment.id} 
                        className={`flex items-center gap-3 p-3 rounded-xl border-2 ${
                          isToday ? 'bg-secondary/10 border-secondary/30' : 'bg-bg-alt border-border'
                        }`}
                      >
                        <div className="flex-1">
                          <p className="font-semibold text-sm">{assignment.title}</p>
                          <p className="text-xs text-text-muted">
                            {kid?.name || 'All'} {assignment.subject && `• ${assignment.subject}`}
                          </p>
                        </div>
                        <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                          isToday ? 'bg-secondary text-white' : 'bg-bg text-text-muted'
                        }`}>
                          {dueLabel}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
              
              <Button 
                variant="ghost" 
                size="sm" 
                className="w-full mt-4"
                onClick={() => router.push('/assignments')}
              >
                View All Assignments →
              </Button>
            </Card>

            {/* Upcoming Events */}
            <Card>
              <h3 className="font-display text-xl font-bold mb-4 flex items-center gap-2">
                <span>🎉</span> Upcoming Events
              </h3>
              
              {events.length === 0 ? (
                <p className="text-text-muted text-center py-6">
                  No events in the next week.
                </p>
              ) : (
                <div className="space-y-3">
                  {events.slice(0, 4).map(event => {
                    const eventDate = formatDate(event.event_date);
                    const isToday = event.event_date === todayStr;
                    
                    return (
                      <div 
                        key={event.id} 
                        className={`p-3 rounded-xl border-2 ${
                          isToday ? 'bg-accent/10 border-accent/30' : 'bg-bg-alt border-border'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-semibold text-sm">{event.title}</p>
                            <p className="text-xs text-text-muted mt-1">
                              {eventDate} {event.event_time && `at ${event.event_time}`}
                            </p>
                          </div>
                          {isToday && (
                            <span className="text-xs font-bold px-2 py-1 rounded-full bg-accent text-white">
                              Today!
                            </span>
                          )}
                        </div>
                        {event.location && (
                          <p className="text-xs text-text-muted mt-1">📍 {event.location}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              
              <Button 
                variant="ghost" 
                size="sm" 
                className="w-full mt-4"
                onClick={() => router.push('/events')}
              >
                View All Events →
              </Button>
            </Card>
          </div>

          {/* Quick Actions */}
          <Card className="mt-8">
            <h3 className="font-display text-xl font-bold mb-4 flex items-center gap-2">
              <span>⚡</span> Quick Actions
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Dashboard', icon: '📊', path: '/dashboard' },
                { label: 'Portfolio', icon: '🎨', path: '/portfolio' },
                { label: 'Field Trips', icon: '🗺️', path: '/field-trips' },
                { label: 'Calendar', icon: '🗓️', path: '/calendar' },
              ].map(action => (
                <button
                  key={action.path}
                  onClick={() => router.push(action.path)}
                  className="flex flex-col items-center gap-2 p-4 rounded-xl bg-bg-alt border-2 border-border hover:border-primary hover:bg-white transition-all"
                >
                  <span className="text-2xl">{action.icon}</span>
                  <span className="text-sm font-semibold">{action.label}</span>
                </button>
              ))}
            </div>
          </Card>

          {/* Navigation */}
          <div className="mt-8 flex justify-center gap-4">
            <Button variant="outline" onClick={() => router.push('/profile')}>
              ← Profile
            </Button>
            <Button variant="primary" onClick={() => router.push('/dashboard')}>
              Full Dashboard →
            </Button>
          </div>
        </main>
      </ClientOnly>
    </>
  );
}
