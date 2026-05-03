'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getPocketBase } from '@/lib/pocketbase';
import { Child, Course, Assignment, Attendance, Event, SchoolYear, SchoolBreak } from '@/lib/types';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { ClientOnly } from '@/components/ui/ClientOnly';

interface TodayLesson {
  child: Child;
  course: Course;
  lessonNumber: number;
  isCompleted: boolean;
}

interface AttendanceStatus {
  child: Child;
  status: 'present' | 'absent' | 'half-day' | 'sick' | 'holiday' | 'unmarked';
  record?: Attendance;
}

export default function TodayPage() {
  const router = useRouter();
  const pb = getPocketBase();
  
  const [kids, setKids] = useState<Child[]>([]);
  const [todayLessons, setTodayLessons] = useState<TodayLesson[]>([]);
  const [attendanceStatuses, setAttendanceStatuses] = useState<AttendanceStatus[]>([]);
  const [dueAssignments, setDueAssignments] = useState<(Assignment & { childName: string })[]>([]);
  const [overdueAssignments, setOverdueAssignments] = useState<(Assignment & { childName: string })[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<Event[]>([]);
  const [schoolYear, setSchoolYear] = useState<SchoolYear | null>(null);
  const [breaks, setBreaks] = useState<SchoolBreak[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingAttendance, setMarkingAttendance] = useState<string | null>(null);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().split('T')[0];
  
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const dayOfWeek = today.getDay();
  const dayAbbrev = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dayOfWeek];
  
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

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

      // Load children with courses
      const childRecords = await pb.collection('children').getFullList({
        filter: `user = "${userId}"`,
        sort: 'name'
      });
      setKids(childRecords as unknown as Child[]);

      // Load school year and breaks
      let currentSchoolYear: SchoolYear | null = null;
      let currentBreaks: SchoolBreak[] = [];
      try {
        const years = await pb.collection('school_years').getFullList({
          filter: `user = "${userId}"`,
          sort: '-start_date',
          limit: 1
        });
        if (years.length > 0) {
          currentSchoolYear = years[0] as unknown as SchoolYear;
          setSchoolYear(currentSchoolYear);
          const breakRecords = await pb.collection('school_breaks').getFullList({
            filter: `school_year = "${years[0].id}"`
          });
          currentBreaks = breakRecords as unknown as SchoolBreak[];
          setBreaks(currentBreaks);
        }
      } catch (e) {
        console.warn('Calendar data not available');
      }

      // Check if today is a break day
      const isBreakDay = currentBreaks.some(b => {
        const bStart = new Date(b.start_date);
        const bEnd = new Date(b.end_date);
        bStart.setHours(0, 0, 0, 0);
        bEnd.setHours(0, 0, 0, 0);
        return today >= bStart && today <= bEnd;
      });

      // Load courses and determine today's lessons
      const lessons: TodayLesson[] = [];
      
      for (const kid of childRecords) {
        try {
          const courses = await pb.collection('courses').getFullList({
            filter: `child = "${kid.id}"`,
            sort: 'name'
          });

          for (const course of courses) {
            // Parse active days
            let activeDays: string[] = [];
            if (course.active_days) {
              if (typeof course.active_days === 'string') {
                const cleaned = course.active_days.trim();
                if (cleaned.startsWith('[') && cleaned.endsWith(']')) {
                  try {
                    activeDays = JSON.parse(cleaned);
                  } catch {
                    activeDays = cleaned.split(',').map((d: string) => d.trim());
                  }
                } else {
                  activeDays = cleaned.split(',').map((d: string) => d.trim());
                }
              } else if (Array.isArray(course.active_days)) {
                activeDays = course.active_days;
              }
            } else {
              activeDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
            }

            // Check if this course is active today
            const isActiveToday = activeDays.includes(dayAbbrev);
            
            // Check if already completed today (using last_lesson_date)
            const isCompletedToday = course.last_lesson_date === todayStr;
            
            // Only add if active today and course not finished
            if (isActiveToday && !isBreakDay && course.current_lesson <= course.total_lessons) {
              lessons.push({
                child: kid as unknown as Child,
                course: course as unknown as Course,
                lessonNumber: course.current_lesson,
                isCompleted: isCompletedToday
              });
            }
          }
        } catch (e) {
          console.warn(`Failed to load courses for ${kid.name}`);
        }
      }
      
      setTodayLessons(lessons);

      // Load attendance for today
      const attendances: AttendanceStatus[] = [];
      for (const kid of childRecords) {
        try {
          const records = await pb.collection('attendance').getFullList({
            filter: `child = "${kid.id}" && date = "${todayStr}"`
          });
          if (records.length > 0) {
            attendances.push({
              child: kid as unknown as Child,
              status: records[0].status as any,
              record: records[0] as unknown as Attendance
            });
          } else {
            attendances.push({
              child: kid as unknown as Child,
              status: 'unmarked'
            });
          }
        } catch (e) {
          attendances.push({
            child: kid as unknown as Child,
            status: 'unmarked'
          });
        }
      }
      setAttendanceStatuses(attendances);

      // Load assignments due today or overdue
      try {
        const allAssignments = await pb.collection('assignments').getFullList({
          filter: `user = "${userId}" && status != "completed" && status != "Graded"`,
          sort: 'due_date'
        });

        const due: (Assignment & { childName: string })[] = [];
        const overdue: (Assignment & { childName: string })[] = [];

        for (const a of allAssignments) {
          const assignment = a as unknown as Assignment;
          if (!assignment.due_date) continue;
          
          const dueDate = new Date(assignment.due_date);
          dueDate.setHours(0, 0, 0, 0);
          
          const kid = childRecords.find(k => k.id === assignment.child);
          const childName = kid?.name || 'Unassigned';

          if (dueDate.getTime() === today.getTime()) {
            due.push({ ...assignment, childName });
          } else if (dueDate < today) {
            overdue.push({ ...assignment, childName });
          }
        }

        setDueAssignments(due);
        setOverdueAssignments(overdue);
      } catch (e) {
        console.warn('Assignments not available');
      }

      // Load upcoming events (next 7 days)
      try {
        const nextWeek = new Date(today);
        nextWeek.setDate(nextWeek.getDate() + 7);
        
        const events = await pb.collection('events').getFullList({
          filter: `event_date >= "${todayStr}" && event_date <= "${nextWeek.toISOString().split('T')[0]}"`,
          sort: 'event_date,event_time'
        });
        setUpcomingEvents(events as unknown as Event[]);
      } catch (e) {
        console.warn('Events not available');
      }

    } catch (error) {
      console.error('Today load error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAttendance = async (childId: string, status: 'present' | 'absent' | 'half-day' | 'sick') => {
    setMarkingAttendance(childId);
    try {
      const userId = pb.authStore.model?.id;
      const existing = attendanceStatuses.find(a => a.child.id === childId);
      
      if (existing?.record) {
        await pb.collection('attendance').update(existing.record.id, { status });
      } else {
        await pb.collection('attendance').create({
          user: userId,
          child: childId,
          date: todayStr,
          status
        });
      }
      
      // Refresh
      await loadTodayData();
    } catch (e) {
      console.error('Failed to mark attendance:', e);
    } finally {
      setMarkingAttendance(null);
    }
  };

  const handleMarkLessonComplete = async (lesson: TodayLesson) => {
    try {
      await pb.collection('courses').update(lesson.course.id, {
        current_lesson: lesson.course.current_lesson + 1,
        last_lesson_date: todayStr
      });
      
      // Log activity
      try {
        await pb.collection('activity_logs').create({
          user: pb.authStore.model?.id,
          child: lesson.child.id,
          type: 'lesson_complete',
          title: `Completed ${lesson.course.name} Lesson ${lesson.lessonNumber}`,
          date: new Date().toISOString()
        });
      } catch (e) {
        // Activity log might not exist
      }
      
      await loadTodayData();
    } catch (e) {
      console.error('Failed to mark lesson complete:', e);
    }
  };

  const handleLogout = () => {
    pb.authStore.clear();
    router.push('/');
  };

  const isBreakToday = breaks.some(b => {
    const bStart = new Date(b.start_date);
    const bEnd = new Date(b.end_date);
    bStart.setHours(0, 0, 0, 0);
    bEnd.setHours(0, 0, 0, 0);
    return today >= bStart && today <= bEnd;
  });

  const currentBreak = breaks.find(b => {
    const bStart = new Date(b.start_date);
    const bEnd = new Date(b.end_date);
    bStart.setHours(0, 0, 0, 0);
    bEnd.setHours(0, 0, 0, 0);
    return today >= bStart && today <= bEnd;
  });

  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

  const completedCount = todayLessons.filter(l => l.isCompleted).length;
  const totalCount = todayLessons.length;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  if (loading) {
    return (
      <>
        <Header showLogout onLogout={handleLogout} />
        <main className="max-w-4xl mx-auto my-12 px-8">
          <p className="text-center text-text-muted">Loading today&apos;s overview...</p>
        </main>
      </>
    );
  }

  return (
    <>
      <Header showLogout onLogout={handleLogout} />
      <ClientOnly>
        <main className="max-w-4xl mx-auto my-8 px-8 pb-20 animate-fade-in">
          {/* Greeting Banner */}
          <div className="bg-gradient-to-r from-primary to-primary-dark rounded-3xl p-8 text-white mb-8 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />
            
            <div className="relative z-10">
              <p className="text-white/80 text-sm font-semibold uppercase tracking-wider mb-1">
                {dayNames[dayOfWeek]}, {monthNames[today.getMonth()]} {today.getDate()}, {today.getFullYear()}
              </p>
              <h1 className="font-display text-4xl sm:text-5xl font-extrabold mb-4">
                {getGreeting()}! ☀️
              </h1>
              
              {isBreakToday && currentBreak && (
                <div className="bg-white/20 backdrop-blur rounded-xl p-4 inline-block">
                  <p className="text-lg font-bold">🎉 {currentBreak.name}</p>
                  <p className="text-sm text-white/80">Enjoy your break!</p>
                </div>
              )}
              
              {isWeekend && !isBreakToday && (
                <div className="bg-white/20 backdrop-blur rounded-xl p-4 inline-block">
                  <p className="text-lg font-bold">🌟 It&apos;s the weekend!</p>
                  <p className="text-sm text-white/80">No lessons scheduled</p>
                </div>
              )}
              
              {!isBreakToday && !isWeekend && totalCount > 0 && (
                <div>
                  <div className="flex items-center gap-4 mb-2">
                    <span className="text-lg font-semibold">{completedCount} of {totalCount} lessons complete</span>
                    <span className="text-2xl font-bold">{progressPercent}%</span>
                  </div>
                  <div className="w-full bg-white/20 rounded-full h-3">
                    <div 
                      className="bg-white h-3 rounded-full transition-all duration-500"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex flex-wrap gap-3 mb-8">
            <Button variant="outline" size="sm" onClick={() => router.push('/dashboard')}>
              📊 Dashboard
            </Button>
            <Button variant="outline" size="sm" onClick={() => router.push('/attendance')}>
              📅 Attendance
            </Button>
            <Button variant="outline" size="sm" onClick={() => router.push('/assignments')}>
              📝 Assignments
            </Button>
            <Button variant="outline" size="sm" onClick={() => router.push('/lessons')}>
              🎓 Lessons
            </Button>
            <Button variant="outline" size="sm" onClick={() => router.push('/reading')}>
              📚 Reading
            </Button>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Today's Lessons */}
            <Card>
              <h2 className="font-serif italic text-2xl text-primary mb-6 flex items-center gap-2">
                📚 Today&apos;s Lessons
                {totalCount > 0 && (
                  <span className="text-sm font-sans not-italic bg-primary/10 text-primary px-3 py-1 rounded-full">
                    {completedCount}/{totalCount}
                  </span>
                )}
              </h2>
              
              {isBreakToday ? (
                <p className="text-text-muted text-center py-8">
                  🎉 No lessons during {currentBreak?.name || 'break'}!
                </p>
              ) : isWeekend ? (
                <p className="text-text-muted text-center py-8">
                  🌟 Enjoy your weekend! No lessons scheduled.
                </p>
              ) : todayLessons.length === 0 ? (
                <p className="text-text-muted text-center py-8">
                  No lessons scheduled for today.
                  <br />
                  <Button variant="ghost" size="sm" className="mt-4" onClick={() => router.push('/manage-kids')}>
                    Set up courses →
                  </Button>
                </p>
              ) : (
                <div className="space-y-3">
                  {todayLessons.map((lesson, i) => (
                    <div 
                      key={`${lesson.child.id}-${lesson.course.id}`}
                      className={`p-4 rounded-xl border-2 transition-all ${
                        lesson.isCompleted 
                          ? 'bg-green-50 border-green-200' 
                          : 'bg-bg-alt border-transparent hover:border-primary'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-bold uppercase px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                              {lesson.child.name}
                            </span>
                            {lesson.isCompleted && (
                              <span className="text-xs font-bold uppercase px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                                ✓ Done
                              </span>
                            )}
                          </div>
                          <h4 className="font-display font-bold text-lg m-0">{lesson.course.name}</h4>
                          <p className="text-sm text-text-muted m-0">
                            Lesson {lesson.lessonNumber} of {lesson.course.total_lessons}
                          </p>
                        </div>
                        {!lesson.isCompleted && (
                          <Button 
                            size="sm" 
                            onClick={() => handleMarkLessonComplete(lesson)}
                          >
                            Mark Done
                          </Button>
                        )}
                      </div>
                      <div className="mt-3">
                        <ProgressBar 
                          percentage={Math.round(((lesson.lessonNumber - 1) / lesson.course.total_lessons) * 100)}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Attendance Check */}
            <Card>
              <h2 className="font-serif italic text-2xl text-primary mb-6 flex items-center gap-2">
                ✅ Attendance
                {attendanceStatuses.some(a => a.status === 'unmarked') && (
                  <span className="text-sm font-sans not-italic bg-orange-100 text-orange-700 px-3 py-1 rounded-full">
                    Needs attention
                  </span>
                )}
              </h2>
              
              {kids.length === 0 ? (
                <p className="text-text-muted text-center py-8">
                  Add children to track attendance.
                </p>
              ) : (
                <div className="space-y-3">
                  {attendanceStatuses.map((att) => (
                    <div 
                      key={att.child.id}
                      className={`p-4 rounded-xl border-2 ${
                        att.status === 'unmarked' 
                          ? 'bg-orange-50 border-orange-200' 
                          : att.status === 'present' 
                            ? 'bg-green-50 border-green-200'
                            : att.status === 'sick' || att.status === 'absent'
                              ? 'bg-red-50 border-red-200'
                              : 'bg-bg-alt border-border'
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                            {att.child.name.charAt(0)}
                          </div>
                          <div>
                            <h4 className="font-display font-bold m-0">{att.child.name}</h4>
                            <p className="text-sm text-text-muted m-0 capitalize">
                              {att.status === 'unmarked' ? '⏳ Not marked yet' : 
                               att.status === 'present' ? '✓ Present' :
                               att.status === 'half-day' ? '½ Half Day' :
                               att.status === 'sick' ? '🤒 Sick' :
                               att.status === 'absent' ? '✗ Absent' :
                               att.status === 'holiday' ? '🎉 Holiday' : att.status}
                            </p>
                          </div>
                        </div>
                        
                        {att.status === 'unmarked' && (
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleMarkAttendance(att.child.id, 'present')}
                              disabled={markingAttendance === att.child.id}
                              className="w-8 h-8 rounded-full bg-green-100 hover:bg-green-200 text-green-700 flex items-center justify-center transition-colors"
                              title="Present"
                            >
                              ✓
                            </button>
                            <button
                              onClick={() => handleMarkAttendance(att.child.id, 'sick')}
                              disabled={markingAttendance === att.child.id}
                              className="w-8 h-8 rounded-full bg-orange-100 hover:bg-orange-200 text-orange-700 flex items-center justify-center transition-colors"
                              title="Sick"
                            >
                              🤒
                            </button>
                            <button
                              onClick={() => handleMarkAttendance(att.child.id, 'absent')}
                              disabled={markingAttendance === att.child.id}
                              className="w-8 h-8 rounded-full bg-red-100 hover:bg-red-200 text-red-700 flex items-center justify-center transition-colors"
                              title="Absent"
                            >
                              ✗
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          {/* Assignments Section */}
          {(dueAssignments.length > 0 || overdueAssignments.length > 0) && (
            <div className="mt-8">
              <Card>
                <h2 className="font-serif italic text-2xl text-primary mb-6 flex items-center gap-2">
                  📝 Assignments
                  {overdueAssignments.length > 0 && (
                    <span className="text-sm font-sans not-italic bg-red-100 text-red-700 px-3 py-1 rounded-full">
                      {overdueAssignments.length} overdue
                    </span>
                  )}
                </h2>
                
                <div className="space-y-4">
                  {/* Overdue */}
                  {overdueAssignments.length > 0 && (
                    <div>
                      <h3 className="text-sm font-bold text-red-600 uppercase tracking-wider mb-3">⚠️ Overdue</h3>
                      <div className="space-y-2">
                        {overdueAssignments.map(a => (
                          <div key={a.id} className="flex items-center justify-between p-3 bg-red-50 rounded-xl border border-red-200">
                            <div>
                              <p className="font-semibold m-0">{a.title}</p>
                              <p className="text-xs text-text-muted m-0">
                                {a.childName} • {a.subject || 'General'} • Due {new Date(a.due_date!).toLocaleDateString()}
                              </p>
                            </div>
                            <Button size="sm" variant="outline" onClick={() => router.push('/assignments')}>
                              View
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Due Today */}
                  {dueAssignments.length > 0 && (
                    <div>
                      <h3 className="text-sm font-bold text-orange-600 uppercase tracking-wider mb-3">📅 Due Today</h3>
                      <div className="space-y-2">
                        {dueAssignments.map(a => (
                          <div key={a.id} className="flex items-center justify-between p-3 bg-orange-50 rounded-xl border border-orange-200">
                            <div>
                              <p className="font-semibold m-0">{a.title}</p>
                              <p className="text-xs text-text-muted m-0">
                                {a.childName} • {a.subject || 'General'}
                              </p>
                            </div>
                            <Button size="sm" variant="outline" onClick={() => router.push('/assignments')}>
                              View
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            </div>
          )}

          {/* Upcoming Events */}
          {upcomingEvents.length > 0 && (
            <div className="mt-8">
              <Card>
                <h2 className="font-serif italic text-2xl text-primary mb-6">🎉 Upcoming Events</h2>
                <div className="space-y-3">
                  {upcomingEvents.slice(0, 5).map(event => {
                    const eventDate = new Date(event.event_date);
                    const isToday = eventDate.toDateString() === today.toDateString();
                    const isTomorrow = eventDate.getTime() === today.getTime() + 86400000;
                    
                    return (
                      <div 
                        key={event.id} 
                        className={`p-4 rounded-xl border-2 transition-all hover:border-primary ${
                          isToday ? 'bg-primary/5 border-primary/30' : 'bg-bg-alt border-transparent'
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              {isToday && (
                                <span className="text-xs font-bold uppercase px-2 py-0.5 rounded-full bg-primary text-white">
                                  Today
                                </span>
                              )}
                              {isTomorrow && (
                                <span className="text-xs font-bold uppercase px-2 py-0.5 rounded-full bg-secondary text-white">
                                  Tomorrow
                                </span>
                              )}
                            </div>
                            <h4 className="font-display font-bold text-lg m-0">{event.title}</h4>
                            <p className="text-sm text-text-muted m-0">
                              {eventDate.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                              {event.event_time && ` at ${event.event_time}`}
                              {event.location && ` • ${event.location}`}
                            </p>
                          </div>
                          <Button size="sm" variant="ghost" onClick={() => router.push('/events')}>
                            Details →
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            </div>
          )}

          {/* All Clear Message */}
          {!isBreakToday && !isWeekend && dueAssignments.length === 0 && overdueAssignments.length === 0 && completedCount === totalCount && totalCount > 0 && (
            <div className="mt-8 text-center">
              <Card className="bg-gradient-to-r from-green-50 to-emerald-50 border-green-200">
                <div className="py-8">
                  <div className="text-5xl mb-4">🎉</div>
                  <h3 className="font-display text-2xl font-bold text-green-700 mb-2">All Done for Today!</h3>
                  <p className="text-green-600">Great job! All lessons are complete and no assignments due.</p>
                </div>
              </Card>
            </div>
          )}
        </main>
      </ClientOnly>
    </>
  );
}
