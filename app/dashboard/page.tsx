'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getPocketBase } from '@/lib/pocketbase';
import { Child, Course, ActivityLog, Assignment, SchoolYear, SchoolBreak } from '@/lib/types';
import { getExpectedLesson } from '@/lib/calendar-utils';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { LoadingScreen } from '@/components/ui/Spinner';

interface ChildWithCourses extends Child {
  courses: Course[];
}

export default function DashboardPage() {
  const router = useRouter();
  const pb = getPocketBase();
  
  const [kids, setKids] = useState<ChildWithCourses[]>([]);
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [schoolYear, setSchoolYear] = useState<SchoolYear | null>(null);
  const [breaks, setBreaks] = useState<SchoolBreak[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!pb.authStore.isValid) {
      router.push('/');
      return;
    }
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      const userId = pb.authStore.model?.id;
      if (!userId) return;

      // Load children
      const childRecords = await pb.collection('children').getFullList({
        filter: `user = "${userId}"`,
        sort: 'name'
      });

      // Load courses for each child
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

      // Load recent activity
      try {
        const activityRecords = await pb.collection('activity_logs').getFullList({
          filter: `user = "${userId}"`,
          sort: '-date',
          limit: 10
        });
        setActivities(activityRecords as unknown as ActivityLog[]);
      } catch (e) {
        console.warn('Activity logs not found, falling back to course data');
      }

      // Load assignments for grading analytics
      try {
        const assignmentRecords = await pb.collection('assignments').getFullList({
          filter: `user = "${userId}"`,
          sort: '-due_date'
        });
        setAssignments(assignmentRecords as unknown as Assignment[]);
      } catch (e) {
        console.warn('Assignments not found');
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
    } catch (error) {
      console.error('Dashboard load error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    pb.authStore.clear();
    router.push('/');
  };

  // Grade conversion helper
  const scoreToGPA = (score: number): number => {
    if (score >= 90) return 4.0;
    if (score >= 80) return 3.0;
    if (score >= 70) return 2.0;
    if (score >= 60) return 1.0;
    return 0.0;
  };

  const scoreToLetterGrade = (score: number): string => {
    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
  };

  // Calculate grading analytics
  const gradedAssignments = assignments.filter(a => a.score !== undefined && a.score !== null);
  
  const gradeStats = kids.map(kid => {
    const kidAssignments = gradedAssignments.filter(a => a.child === kid.id);
    if (kidAssignments.length === 0) return { kid, gpa: 0, average: 0, total: 0 };
    
    const totalScore = kidAssignments.reduce((sum, a) => sum + (a.score || 0), 0);
    const average = totalScore / kidAssignments.length;
    const gpa = kidAssignments.reduce((sum, a) => sum + scoreToGPA(a.score || 0), 0) / kidAssignments.length;
    
    return { kid, gpa, average, total: kidAssignments.length };
  });

  const subjectAverages: Record<string, { total: number; count: number; average: number }> = {};
  gradedAssignments.forEach(a => {
    const subject = a.subject || 'General';
    if (!subjectAverages[subject]) {
      subjectAverages[subject] = { total: 0, count: 0, average: 0 };
    }
    subjectAverages[subject].total += a.score || 0;
    subjectAverages[subject].count += 1;
  });
  Object.keys(subjectAverages).forEach(subject => {
    subjectAverages[subject].average = subjectAverages[subject].total / subjectAverages[subject].count;
  });

  const gradeDistribution = { A: 0, B: 0, C: 0, D: 0, F: 0 };
  gradedAssignments.forEach(a => {
    const grade = scoreToLetterGrade(a.score || 0);
    gradeDistribution[grade as keyof typeof gradeDistribution]++;
  });

  // Calculate aggregate stats
  const stats = kids.reduce((acc, kid) => {
    kid.courses.forEach(course => {
      acc.totalCourses++;
      const completed = Math.min(course.current_lesson - 1, course.total_lessons);
      acc.lessonsCompleted += completed;
      acc.totalLessons += course.total_lessons;
      
      if (course.current_lesson > course.total_lessons) {
        acc.completedCourses++;
      }
    });
    return acc;
  }, { totalCourses: 0, lessonsCompleted: 0, totalLessons: 0, completedCourses: 0 });

  const overallProgress = stats.totalLessons > 0 
    ? Math.round((stats.lessonsCompleted / stats.totalLessons) * 100) 
    : 0;

  // Group courses by subject/name for breakdown
  const subjectProgress: Record<string, { completed: number; total: number }> = {};
  kids.forEach(kid => {
    kid.courses.forEach(course => {
      if (!subjectProgress[course.name]) {
        subjectProgress[course.name] = { completed: 0, total: 0 };
      }
      const completed = Math.min(course.current_lesson - 1, course.total_lessons);
      subjectProgress[course.name].completed += completed;
      subjectProgress[course.name].total += course.total_lessons;
    });
  });

  if (loading) {
    return (
      <>
        <Header showLogout onLogout={handleLogout} />
        <main className="max-w-7xl mx-auto my-12 px-8">
          <p className="text-center text-text-muted">Loading dashboard...</p>
        </main>
      </>
    );
  }

  return (
    <>
      <Header showLogout onLogout={handleLogout} />
      <main className="max-w-7xl mx-auto my-12 px-8 pb-20 animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-8">
          <h2 className="font-display text-4xl sm:text-5xl font-extrabold tracking-tight mb-0">Family Dashboard</h2>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => router.push('/assignments')}>
              📝 Assignments
            </Button>
            <Button variant="outline" onClick={() => router.push('/transcript')}>
              📄 Transcript
            </Button>
            <Button variant="outline" onClick={() => router.push('/calendar')}>
              📅 Calendar
            </Button>
            <Button variant="ghost" onClick={() => router.push('/profile')}>← Profile</Button>
          </div>
        </div>

        {kids.length === 0 ? (
          <Card className="text-center py-12">
            <p className="text-text-muted text-lg mb-6">No children added yet.</p>
            <Button onClick={() => router.push('/manage-kids')}>Add Your First Child</Button>
          </Card>
        ) : (
          <>
            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 mb-12">
              {[
                { label: 'Children', value: kids.length, emoji: '👨‍👩‍👧‍👦', color: 'text-primary' },
                { label: 'Active Courses', value: stats.totalCourses - stats.completedCourses, emoji: '📚', color: 'text-secondary' },
                { label: 'Completed', value: stats.completedCourses, emoji: '✅', color: 'text-accent' },
                { label: 'Overall Progress', value: `${overallProgress}%`, emoji: '📊', color: 'text-primary' }
              ].map((stat, i) => (
                <div key={i} className="bg-bg border-2 border-border rounded-[1.25rem] p-4 sm:p-8 text-center transition-all hover:border-primary hover:bg-white">
                  <div className="text-2xl sm:text-3xl mb-2">{stat.emoji}</div>
                  <div className={`font-display text-3xl sm:text-5xl font-extrabold ${stat.color}`}>{stat.value}</div>
                  <div className="text-xs sm:text-sm mt-2 text-text-muted font-semibold">{stat.label}</div>
                </div>
              ))}
            </div>

            <div className="grid md:grid-cols-2 gap-8">
              {/* Progress by Child */}
              <Card>
                <h3 className="font-serif italic text-2xl text-primary mb-6">Progress by Child</h3>
                <div className="space-y-6">
                  {kids.map((kid) => {
                    const kidStats = kid.courses.reduce((acc, course) => {
                      const completed = Math.min(course.current_lesson - 1, course.total_lessons);
                      acc.completed += completed;
                      acc.total += course.total_lessons;
                      return acc;
                    }, { completed: 0, total: 0 });
                    
                    const progress = kidStats.total > 0 
                      ? Math.round((kidStats.completed / kidStats.total) * 100) 
                      : 0;

                    // Calculate mapping for all courses to see if any are behind
                    const behindCount = kid.courses.filter(c => {
                      if (!schoolYear) return false;
                      const mapping = getExpectedLesson(c, schoolYear, breaks);
                      return mapping.status === 'behind';
                    }).length;

                    return (
                      <div key={kid.id}>
                        <div className="flex justify-between items-center mb-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-display font-bold m-0">{kid.name}</h4>
                              {behindCount > 0 && (
                                <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase bg-red-100 text-red-700">
                                  ⚠️ {behindCount} {behindCount === 1 ? 'Subject' : 'Subjects'} Behind
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-text-muted m-0">
                              {kid.courses.length} course{kid.courses.length !== 1 ? 's' : ''} • 
                              {kidStats.completed} / {kidStats.total} lessons
                            </p>
                          </div>
                          <span className="text-2xl font-bold text-primary">{progress}%</span>
                        </div>
                        <ProgressBar percentage={progress} />
                      </div>
                    );
                  })}
                </div>
              </Card>

              {/* Course Breakdown */}
              <Card>
                <h3 className="font-serif italic text-2xl text-primary mb-6">Course Breakdown</h3>
                <div className="space-y-4">
                  {Object.entries(subjectProgress).length > 0 ? (
                    Object.entries(subjectProgress)
                      .sort((a, b) => (b[1].completed / b[1].total) - (a[1].completed / a[1].total))
                      .map(([subject, data]) => {
                        const progress = Math.round((data.completed / data.total) * 100);
                        return (
                          <div key={subject}>
                            <ProgressBar
                              label={`${subject}`}
                              sublabel={`${data.completed} / ${data.total} lessons`}
                              percentage={progress}
                            />
                          </div>
                        );
                      })
                  ) : (
                    <p className="text-text-muted text-center py-8">No courses tracked yet</p>
                  )}
                </div>
              </Card>
            </div>

            {/* Grading Analytics */}
            {gradedAssignments.length > 0 && (
              <div className="mt-12">
                <h3 className="font-serif italic text-3xl text-primary mb-6">📊 Grading Analytics</h3>
                
                <div className="grid md:grid-cols-3 gap-6 mb-8">
                  {/* GPA by Child */}
                  <Card>
                    <h4 className="font-display font-bold text-lg mb-4">GPA by Student</h4>
                    <div className="space-y-3">
                      {gradeStats.filter(s => s.total > 0).map(stat => (
                        <div key={stat.kid.id} className="flex justify-between items-center">
                          <span className="font-semibold">{stat.kid.name}</span>
                          <div className="text-right">
                            <div className="font-display font-bold text-xl text-primary">{stat.gpa.toFixed(2)}</div>
                            <div className="text-xs text-text-muted">{stat.average.toFixed(0)}% avg</div>
                          </div>
                        </div>
                      ))}
                      {gradeStats.every(s => s.total === 0) && (
                        <p className="text-text-muted text-center py-4">No graded assignments yet</p>
                      )}
                    </div>
                  </Card>

                  {/* Subject Averages */}
                  <Card>
                    <h4 className="font-display font-bold text-lg mb-4">Subject Averages</h4>
                    <div className="space-y-3">
                      {Object.entries(subjectAverages)
                        .sort((a, b) => b[1].average - a[1].average)
                        .map(([subject, data]) => (
                          <div key={subject} className="flex justify-between items-center">
                            <span className="font-semibold">{subject}</span>
                            <div className="text-right">
                              <div className="font-display font-bold text-xl text-secondary">{data.average.toFixed(0)}%</div>
                              <div className="text-xs text-text-muted">{data.count} assignment{data.count !== 1 ? 's' : ''}</div>
                            </div>
                          </div>
                        ))}
                    </div>
                  </Card>

                  {/* Grade Distribution */}
                  <Card>
                    <h4 className="font-display font-bold text-lg mb-4">Grade Distribution</h4>
                    <div className="space-y-2">
                      {(['A', 'B', 'C', 'D', 'F'] as const).map(grade => {
                        const count = gradeDistribution[grade];
                        const percentage = gradedAssignments.length > 0 
                          ? Math.round((count / gradedAssignments.length) * 100) 
                          : 0;
                        const color = grade === 'A' ? 'bg-green-500' : 
                                      grade === 'B' ? 'bg-blue-500' : 
                                      grade === 'C' ? 'bg-yellow-500' : 
                                      grade === 'D' ? 'bg-orange-500' : 'bg-red-500';
                        return (
                          <div key={grade}>
                            <div className="flex justify-between items-center mb-1">
                              <span className="font-bold text-sm">{grade}</span>
                              <span className="text-xs text-text-muted">{count} ({percentage}%)</span>
                            </div>
                            <div className="w-full bg-bg-alt rounded-full h-2">
                              <div 
                                className={`${color} h-2 rounded-full transition-all`} 
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </Card>
                </div>
              </div>
            )}

            {/* Recent Activity */}
            <Card className="mt-8">
              <h3 className="font-serif italic text-2xl text-primary mb-6">Recent Activity</h3>
              <div className="space-y-3">
                {activities.length > 0 ? (
                  activities.map((item, i) => {
                    const kid = kids.find(k => k.id === item.child);
                    const icon = item.type === 'lesson_complete' ? '📚' : item.type === 'portfolio_add' ? '🎨' : '📅';
                    return (
                      <div key={item.id} className="flex items-center justify-between p-3 bg-bg-alt rounded-xl hover:bg-border transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                            {icon}
                          </div>
                          <div>
                            <p className="font-semibold m-0 text-sm">{kid?.name || 'Child'} — {item.title}</p>
                            <p className="text-xs text-text-muted m-0">{new Date(item.date).toLocaleDateString()} {new Date(item.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  kids.flatMap(kid => 
                    kid.courses
                      .filter(c => c.current_lesson > 1 && c.current_lesson <= c.total_lessons)
                      .slice(0, 8)
                      .map(course => ({
                        kid: kid.name,
                        course: course.name,
                        lesson: course.current_lesson - 1,
                        total: course.total_lessons,
                        progress: Math.round(((course.current_lesson - 1) / course.total_lessons) * 100)
                      }))
                  ).length > 0 ? (
                    kids.flatMap(kid => 
                      kid.courses
                        .filter(c => c.current_lesson > 1 && c.current_lesson <= c.total_lessons)
                        .slice(0, 8)
                        .map(course => ({
                          kid: kid.name,
                          course: course.name,
                          lesson: course.current_lesson - 1,
                          total: course.total_lessons,
                          progress: Math.round(((course.current_lesson - 1) / course.total_lessons) * 100)
                        }))
                    ).slice(0, 8).map((item, i) => (
                      <div key={i} className="flex items-center justify-between p-3 bg-bg-alt rounded-xl hover:bg-border transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                            {item.kid.charAt(0)}
                          </div>
                          <div>
                            <p className="font-semibold m-0 text-sm">{item.kid} • {item.course}</p>
                            <p className="text-xs text-text-muted m-0">Completed lesson {item.lesson}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-primary m-0">{item.progress}%</p>
                          <p className="text-xs text-text-muted m-0">{item.lesson}/{item.total}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-text-muted text-center py-8">No activity yet. Add courses to start tracking!</p>
                  )
                )}
              </div>
            </Card>
          </>
        )}
      </main>
    </>
  );
}
