'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getPocketBase } from '@/lib/pocketbase';
import { Child, Course, Lesson } from '@/lib/types';
import { Header } from '@/components/Header';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { LoadingScreen } from '@/components/ui/Spinner';
import { HomeworkHelper } from '@/components/HomeworkHelper';

export default function StudentDashboardPage() {
  const router = useRouter();
  const pb = getPocketBase();
  
  const [student, setStudent] = useState<Child | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const studentId = localStorage.getItem('village_student_id');
    if (!studentId) {
      router.push('/student');
      return;
    }
    loadData(studentId);
  }, []);

  const loadData = async (id: string) => {
    try {
      const [kidRecord, courseRecords, lessonRecords] = await Promise.all([
        pb.collection('children').getOne(id),
        pb.collection('courses').getFullList({
          filter: `child = "${id}"`,
          sort: 'name'
        }),
        pb.collection('lessons').getFullList({
          filter: `child = "${id}"`,
          sort: '-created',
          limit: 5
        })
      ]);

      setStudent(kidRecord as unknown as Child);
      setCourses(courseRecords as unknown as Course[]);
      setLessons(lessonRecords as unknown as Lesson[]);
    } catch (e) {
      console.error('Failed to load student data:', e);
      router.push('/student');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('village_student_id');
    router.push('/student');
  };

  // Save tutor conversations for parent review
  const saveConversation = useCallback(async (messages: { role: string; content: string; timestamp: Date }[]) => {
    if (!student || messages.length < 2) return;
    
    try {
      // Get existing session or create new one
      const sessionKey = `tutor_session_${student.id}_${new Date().toISOString().split('T')[0]}`;
      const existingSession = localStorage.getItem(sessionKey);
      
      const sessionData = {
        student_id: student.id,
        student_name: student.name,
        date: new Date().toISOString(),
        messages: messages.map(m => ({
          role: m.role,
          content: m.content,
          timestamp: m.timestamp.toISOString()
        }))
      };

      // Save to localStorage for now (can be synced to PocketBase later)
      localStorage.setItem(sessionKey, JSON.stringify(sessionData));

      // Also try to save to PocketBase if collection exists
      try {
        await pb.collection('tutor_sessions').create({
          child: student.id,
          user: student.user,
          date: new Date().toISOString(),
          messages: JSON.stringify(sessionData.messages),
        });
      } catch (e) {
        // Collection might not exist yet, that's okay
        console.log('Tutor sessions collection not set up yet');
      }
    } catch (e) {
      console.error('Failed to save conversation:', e);
    }
  }, [student, pb]);

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
      </main>

      {/* AI Homework Helper */}
      <HomeworkHelper 
        studentName={student.name}
        gradeLevel={student.grade || `${student.age} years old`}
        onConversation={saveConversation}
      />
    </>
  );
}
