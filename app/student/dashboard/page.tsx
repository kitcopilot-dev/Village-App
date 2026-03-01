'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getPocketBase } from '@/lib/pocketbase';
import { Child, Course, Lesson, Assignment } from '@/lib/types';
import { Header } from '@/components/Header';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { LoadingScreen } from '@/components/ui/Spinner';
import { trackStudentLogin, trackDashboardView, trackStudentLogout, trackAssignmentComplete, trackLessonStart } from '@/lib/analytics';

export default function StudentDashboardPage() {
  const router = useRouter();
  const pb = getPocketBase();
  
  const [student, setStudent] = useState<Child | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const studentId = localStorage.getItem('village_student_id');
    if (!studentId) {
      router.push('/student');
      return;
    }
    
    const load = async () => {
      try {
        const [kidRecord, courseRecords, lessonRecords, assignmentRecords] = await Promise.all([
          pb.collection('children').getOne(studentId),
          pb.collection('courses').getFullList({
            filter: `child = "${studentId}"`,
            sort: 'name'
          }),
          pb.collection('lessons').getFullList({
            filter: `child = "${studentId}"`,
            sort: '-created',
            limit: 5
          }),
          pb.collection('assignments').getFullList({
            filter: `child = "${studentId}"`,
            sort: '-due_date'
          })
        ]);

        if (!cancelled) {
          setStudent(kidRecord as unknown as Child);
          setCourses(courseRecords as unknown as Course[]);
          setLessons(lessonRecords as unknown as Lesson[]);
          setAssignments(assignmentRecords as unknown as Assignment[]);
          
          // Track student login and dashboard view
          trackStudentLogin(kidRecord.id, kidRecord.name);
          trackDashboardView('student');
        }
      } catch (e: any) {
        if (!cancelled) {
          console.error('Failed to load student data:', e);
          // Don't redirect if it's just an abort/cancellation error
          if (e?.name !== 'AbortError' && e?.isAbort !== true) {
            router.push('/student');
          }
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };
    
    load();
    
    return () => {
      cancelled = true;
    };
  }, []);

  const handleLogout = () => {
    if (student) {
      trackStudentLogout(student.id);
    }
    localStorage.removeItem('village_student_id');
    router.push('/student');
  };

  const handleCompleteAssignment = async (assignmentId: string) => {
    try {
      const assignment = assignments.find(a => a.id === assignmentId);
      await pb.collection('assignments').update(assignmentId, {
        status: 'Complete'
      });
      
      // Track assignment completion
      if (assignment) {
        trackAssignmentComplete(assignmentId, assignment.title, assignment.score);
      }
      
      // Reload assignments
      const assignmentRecords = await pb.collection('assignments').getFullList({
        filter: `child = "${student?.id}"`,
        sort: '-due_date'
      });
      setAssignments(assignmentRecords as unknown as Assignment[]);
    } catch (error) {
      console.error('Failed to mark assignment complete:', error);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const isOverdue = (dueDate: string, status?: string) => {
    if (status === 'Complete' || status === 'Graded') return false;
    return new Date(dueDate) < new Date();
  };

  const pendingAssignments = assignments.filter(a => a.status !== 'completed' && a.status !== 'Graded');
  const completedAssignments = assignments.filter(a => a.status === 'completed' || a.status === 'Graded');

  if (loading) return <LoadingScreen message="Opening your Learning Vault..." />;
  if (!student) return null;

  return (
    <>
      <header className="bg-bg/80 backdrop-blur-md px-8 py-6 flex justify-between items-center sticky top-0 z-50 border-b border-border/50">
        <h1 className="font-display text-2xl font-extrabold m-0 text-primary uppercase tracking-tighter">
          Village<span className="text-secondary">.</span> <span className="text-text-muted text-lg lowercase font-bold tracking-normal ml-2">student</span>
        </h1>
        <div className="flex items-center gap-4">
          <p className="m-0 font-bold hidden sm:block text-primary">Hi, {student.name}!</p>
          <Button variant="outline" size="sm" onClick={handleLogout}>Log Out</Button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto my-12 px-4 sm:px-8 pb-24 animate-fade-in">
        <div className="mb-12">
          <h2 className="font-display text-4xl sm:text-6xl font-extrabold tracking-tight mb-2">My Journey</h2>
          <p className="text-text-muted text-sm sm:text-base font-serif italic">What are we exploring today?</p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* My Lessons (AI Sparks) */}
          <div className="space-y-6">
            <h3 className="font-display text-xl font-bold uppercase tracking-widest text-secondary">New Missions</h3>
            {lessons.length === 0 ? (
              <Card className="p-12 text-center bg-bg-alt border-dashed">
                <p className="text-text-muted italic">Ask your parent to generate an AI Spark for your courses!</p>
              </Card>
            ) : (
              lessons.map(lesson => (
                <Card key={lesson.id} className="p-8 hover:border-secondary transition-all group">
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-secondary bg-secondary/10 px-2 py-0.5 rounded">AI Spark</span>
                      <h4 className="text-2xl font-display font-extrabold mt-2 mb-0">{lesson.title}</h4>
                    </div>
                    <div className="text-3xl grayscale group-hover:grayscale-0 transition-all">✨</div>
                  </div>
                  <p className="text-sm text-text-muted line-clamp-2 mb-8 leading-relaxed">&ldquo;{lesson.content.hook}&rdquo;</p>
                  <Button className="w-full" variant="secondary" onClick={() => router.push(`/lessons/${lesson.id}`)}>Start Lesson</Button>
                </Card>
              ))
            )}
          </div>

          {/* My Courses */}
          <div className="space-y-6">
            <h3 className="font-display text-xl font-bold uppercase tracking-widest text-primary">My Subjects</h3>
            <div className="grid gap-4">
              {courses.map(course => (
                <Card key={course.id} className="p-6">
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="font-display font-bold m-0 text-lg">{course.name}</h4>
                    <span className="text-xs font-bold text-primary bg-primary/10 px-3 py-1 rounded-full">L{course.current_lesson}</span>
                  </div>
                  <ProgressBar 
                    percentage={(course.current_lesson / course.total_lessons) * 100} 
                    className="mb-0"
                  />
                  <p className="text-[10px] text-text-muted mt-3 uppercase font-bold tracking-widest text-center">{course.total_lessons - course.current_lesson + 1} lessons to go!</p>
                </Card>
              ))}
            </div>
          </div>
        </div>

        {/* My Assignments */}
        {assignments.length > 0 && (
          <div className="mt-12 space-y-6">
            <h3 className="font-display text-xl font-bold uppercase tracking-widest text-accent">My Assignments</h3>
            
            {/* Pending Assignments */}
            {pendingAssignments.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-sm font-bold text-text-muted uppercase tracking-wider">To Do</h4>
                {pendingAssignments.map(assignment => (
                  <Card key={assignment.id} className={`p-6 ${assignment.due_date && isOverdue(assignment.due_date, assignment.status) ? 'border-red-500 bg-red-50 dark:bg-red-950/20' : ''}`}>
                    <div className="flex justify-between items-start gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="font-display font-bold m-0">{assignment.title}</h4>
                          {assignment.due_date && isOverdue(assignment.due_date, assignment.status) && (
                            <span className="text-xs font-bold text-red-600 bg-red-100 dark:bg-red-900/30 px-2 py-0.5 rounded">Overdue</span>
                          )}
                        </div>
                        <p className="text-sm text-text-muted mb-2">{assignment.subject}</p>
                        {assignment.description && (
                          <p className="text-sm text-text line-clamp-2 mb-3">{assignment.description}</p>
                        )}
                        {assignment.due_date && (
                          <p className="text-xs text-text-muted">
                            📅 Due: {formatDate(assignment.due_date)}
                          </p>
                        )}
                      </div>
                      <Button 
                        size="sm" 
                        variant="primary" 
                        onClick={() => handleCompleteAssignment(assignment.id)}
                      >
                        ✓ Mark Done
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}

            {/* Completed Assignments */}
            {completedAssignments.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-sm font-bold text-text-muted uppercase tracking-wider">Completed</h4>
                {completedAssignments.slice(0, 5).map(assignment => (
                  <Card key={assignment.id} className="p-6 opacity-60">
                    <div className="flex justify-between items-start gap-4">
                      <div className="flex-1">
                        <h4 className="font-display font-bold m-0 line-through">{assignment.title}</h4>
                        <p className="text-sm text-text-muted">{assignment.subject}</p>
                        {assignment.score !== undefined && assignment.score !== null && (
                          <p className="text-sm font-bold text-green-600 mt-2">
                            Score: {assignment.score}%
                          </p>
                        )}
                      </div>
                      <span className="text-green-600 text-2xl">✓</span>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </>
  );
}
