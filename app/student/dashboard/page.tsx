'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getPocketBase } from '@/lib/pocketbase';
import { Child, Course, Lesson } from '@/lib/types';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { LoadingScreen } from '@/components/ui/Spinner';

// Confetti component for celebrations
function Confetti({ show }: { show: boolean }) {
  if (!show) return null;
  
  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {[...Array(50)].map((_, i) => (
        <div
          key={i}
          className="absolute animate-confetti"
          style={{
            left: `${Math.random() * 100}%`,
            top: '-20px',
            animationDelay: `${Math.random() * 2}s`,
            animationDuration: `${2 + Math.random() * 2}s`,
          }}
        >
          {['🎉', '⭐', '🌟', '✨', '🎊', '💫'][Math.floor(Math.random() * 6)]}
        </div>
      ))}
    </div>
  );
}

// Welcome modal for first-time or returning students
function WelcomeModal({ student, onClose }: { student: Child; onClose: () => void }) {
  const greetings = [
    `Welcome back, ${student.name}! 🌟`,
    `Great to see you, ${student.name}! ✨`,
    `Ready to learn, ${student.name}? 🚀`,
    `Hey ${student.name}! Let's do this! 💪`,
  ];
  const greeting = greetings[Math.floor(Math.random() * greetings.length)];
  
  const motivations = [
    "Every expert was once a beginner!",
    "Small steps lead to big discoveries!",
    "Your brain is ready for an adventure!",
    "Today is a great day to learn something new!",
    "Mistakes help us grow - don't be afraid to try!",
  ];
  const motivation = motivations[Math.floor(Math.random() * motivations.length)];
  
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-40 p-4 animate-fade-in">
      <Card className="max-w-sm w-full p-8 text-center">
        <div className="text-6xl mb-4 animate-bounce-slow">👋</div>
        <h2 className="font-display text-2xl font-extrabold text-primary mb-2">{greeting}</h2>
        <p className="text-text-muted italic font-serif mb-6">{motivation}</p>
        <Button className="w-full" onClick={onClose}>
          Let's Go! 🚀
        </Button>
      </Card>
    </div>
  );
}

// Achievement badge component
function AchievementBadge({ type, value }: { type: 'streak' | 'lessons' | 'courses'; value: number }) {
  const badges = {
    streak: { icon: '🔥', label: 'Day Streak', threshold: [3, 7, 14, 30] },
    lessons: { icon: '📚', label: 'Lessons Done', threshold: [5, 10, 25, 50] },
    courses: { icon: '🏆', label: 'Courses Complete', threshold: [1, 3, 5, 10] },
  };
  
  const badge = badges[type];
  const level = badge.threshold.filter(t => value >= t).length;
  
  if (level === 0) return null;
  
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-accent/10 rounded-full text-sm">
      <span>{badge.icon}</span>
      <span className="font-bold text-accent">{value}</span>
      <span className="text-text-muted text-xs">{badge.label}</span>
    </div>
  );
}

export default function StudentDashboardPage() {
  const router = useRouter();
  const pb = getPocketBase();
  
  const [student, setStudent] = useState<Child | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [showWelcome, setShowWelcome] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [stats, setStats] = useState({ lessonsCompleted: 0, streak: 0, coursesComplete: 0 });

  useEffect(() => {
    const studentId = localStorage.getItem('village_student_id');
    if (!studentId) {
      router.push('/student');
      return;
    }
    loadData(studentId);
    
    // Check if we should show welcome
    const lastVisit = localStorage.getItem('village_student_last_visit');
    const today = new Date().toDateString();
    if (lastVisit !== today) {
      setShowWelcome(true);
      localStorage.setItem('village_student_last_visit', today);
    }
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
        })
      ]);

      setStudent(kidRecord as unknown as Child);
      setCourses(courseRecords as unknown as Course[]);
      setLessons((lessonRecords as unknown as Lesson[]).slice(0, 5));
      
      // Calculate stats
      const completedCourses = courseRecords.filter((c: any) => c.current_lesson >= c.total_lessons);
      setStats({
        lessonsCompleted: lessonRecords.length,
        streak: Math.floor(Math.random() * 7) + 1, // TODO: Calculate from activity_log
        coursesComplete: completedCourses.length,
      });
    } catch (e) {
      console.error('Failed to load student data:', e);
      router.push('/student');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('village_student_id');
    localStorage.removeItem('village_student_last_visit');
    router.push('/student');
  };

  const handleWelcomeClose = () => {
    setShowWelcome(false);
    setShowConfetti(true);
    setTimeout(() => setShowConfetti(false), 3000);
  };

  if (loading) return <LoadingScreen message="Opening your Learning Vault..." />;
  if (!student) return null;

  const totalProgress = courses.length > 0 
    ? Math.round(courses.reduce((sum, c) => sum + (c.current_lesson / c.total_lessons) * 100, 0) / courses.length)
    : 0;

  return (
    <>
      <Confetti show={showConfetti} />
      {showWelcome && <WelcomeModal student={student} onClose={handleWelcomeClose} />}
      
      {/* Header */}
      <header className="bg-bg/80 backdrop-blur-md px-4 sm:px-8 py-4 sm:py-6 flex justify-between items-center sticky top-0 z-30 border-b border-border/50">
        <h1 className="font-display text-xl sm:text-2xl font-extrabold m-0 text-primary uppercase tracking-tighter">
          Village<span className="text-secondary">.</span>
          <span className="text-text-muted text-base sm:text-lg lowercase font-bold tracking-normal ml-2 hidden sm:inline">student</span>
        </h1>
        <div className="flex items-center gap-2 sm:gap-4">
          <p className="m-0 font-bold text-sm sm:text-base hidden sm:block text-primary">Hi, {student.name}!</p>
          <Button variant="outline" size="sm" onClick={handleLogout}>Log Out</Button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto my-6 sm:my-12 px-4 sm:px-8 pb-24 animate-fade-in">
        {/* Hero Section */}
        <div className="mb-8 sm:mb-12">
          <h2 className="font-display text-3xl sm:text-6xl font-extrabold tracking-tight mb-2">
            My Journey
          </h2>
          <p className="text-text-muted text-sm sm:text-base font-serif italic">
            What are we exploring today?
          </p>
          
          {/* Achievement Badges */}
          <div className="flex flex-wrap gap-2 mt-4">
            <AchievementBadge type="streak" value={stats.streak} />
            <AchievementBadge type="lessons" value={stats.lessonsCompleted} />
            <AchievementBadge type="courses" value={stats.coursesComplete} />
          </div>
        </div>

        {/* Overall Progress */}
        {courses.length > 0 && (
          <Card className="p-6 mb-8 bg-gradient-to-r from-primary/5 to-secondary/5">
            <div className="flex items-center justify-between mb-3">
              <span className="font-display font-bold text-lg">Overall Progress</span>
              <span className="text-2xl font-display font-extrabold text-primary">{totalProgress}%</span>
            </div>
            <ProgressBar percentage={totalProgress} />
            <p className="text-sm text-text-muted mt-2 text-center">
              {totalProgress < 25 && "Just getting started - you've got this! 💪"}
              {totalProgress >= 25 && totalProgress < 50 && "Making great progress! Keep it up! 🌟"}
              {totalProgress >= 50 && totalProgress < 75 && "Halfway there - amazing work! 🚀"}
              {totalProgress >= 75 && totalProgress < 100 && "Almost done - the finish line is near! 🏁"}
              {totalProgress === 100 && "🎉 Champion! You completed everything! 🎉"}
            </p>
          </Card>
        )}

        <div className="grid md:grid-cols-2 gap-6 sm:gap-8">
          {/* AI Sparks / Lessons */}
          <div className="space-y-4 sm:space-y-6">
            <h3 className="font-display text-lg sm:text-xl font-bold uppercase tracking-widest text-secondary flex items-center gap-2">
              <span>✨</span> New Missions
            </h3>
            
            {lessons.length === 0 ? (
              <Card className="p-8 sm:p-12 text-center bg-bg-alt border-dashed">
                <div className="text-5xl mb-4">🎯</div>
                <p className="text-text-muted italic mb-4">
                  No new missions yet!
                </p>
                <p className="text-sm text-text-muted">
                  Ask your parent to generate an AI Spark for your courses!
                </p>
              </Card>
            ) : (
              lessons.map((lesson, idx) => (
                <Card 
                  key={lesson.id} 
                  className="p-6 sm:p-8 hover:border-secondary transition-all group"
                  style={{ animationDelay: `${idx * 100}ms` }}
                >
                  <div className="flex justify-between items-start mb-4 sm:mb-6">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-secondary bg-secondary/10 px-2 py-0.5 rounded">
                        AI Spark
                      </span>
                      <h4 className="text-xl sm:text-2xl font-display font-extrabold mt-2 mb-0">
                        {lesson.title}
                      </h4>
                    </div>
                    <div className="text-2xl sm:text-3xl grayscale group-hover:grayscale-0 transition-all">
                      ✨
                    </div>
                  </div>
                  <p className="text-sm text-text-muted line-clamp-2 mb-6 sm:mb-8 leading-relaxed">
                    &ldquo;{lesson.content?.hook || 'Ready to explore something amazing?'}&rdquo;
                  </p>
                  <Button 
                    className="w-full" 
                    variant="secondary" 
                    onClick={() => router.push(`/lessons/${lesson.id}`)}
                  >
                    Start Lesson →
                  </Button>
                </Card>
              ))
            )}
          </div>

          {/* Courses / Subjects */}
          <div className="space-y-4 sm:space-y-6">
            <h3 className="font-display text-lg sm:text-xl font-bold uppercase tracking-widest text-primary flex items-center gap-2">
              <span>📚</span> My Subjects
            </h3>
            
            {courses.length === 0 ? (
              <Card className="p-8 sm:p-12 text-center bg-bg-alt border-dashed">
                <div className="text-5xl mb-4">📖</div>
                <p className="text-text-muted italic mb-4">
                  No courses added yet!
                </p>
                <p className="text-sm text-text-muted">
                  Your parent will set up your courses soon.
                </p>
              </Card>
            ) : (
              <div className="grid gap-3 sm:gap-4">
                {courses.map((course, idx) => {
                  const progress = Math.round((course.current_lesson / course.total_lessons) * 100);
                  const isComplete = progress >= 100;
                  
                  return (
                    <Card 
                      key={course.id} 
                      className={`p-4 sm:p-6 ${isComplete ? 'bg-gradient-to-r from-primary/5 to-accent/5 border-primary/30' : ''}`}
                      style={{ animationDelay: `${idx * 50}ms` }}
                    >
                      <div className="flex justify-between items-center mb-3 sm:mb-4">
                        <h4 className="font-display font-bold m-0 text-base sm:text-lg flex items-center gap-2">
                          {isComplete && <span>🏆</span>}
                          {course.name}
                        </h4>
                        <span className={`text-xs font-bold px-3 py-1 rounded-full ${
                          isComplete 
                            ? 'bg-primary text-white' 
                            : 'text-primary bg-primary/10'
                        }`}>
                          {isComplete ? 'Complete!' : `L${course.current_lesson}`}
                        </span>
                      </div>
                      <ProgressBar 
                        percentage={progress} 
                        className="mb-0"
                      />
                      <p className="text-[10px] text-text-muted mt-2 sm:mt-3 uppercase font-bold tracking-widest text-center">
                        {isComplete 
                          ? '✨ Amazing work! ✨' 
                          : `${course.total_lessons - course.current_lesson + 1} lessons to go!`
                        }
                      </p>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Quick Tips */}
        <Card className="mt-8 p-6 bg-bg-alt border-dashed">
          <h4 className="font-display font-bold text-sm uppercase tracking-widest text-text-muted mb-3 flex items-center gap-2">
            <span>💡</span> Learning Tip
          </h4>
          <p className="text-sm text-text-muted italic">
            {[
              "Take breaks! Your brain learns better with rest.",
              "Don't be afraid to make mistakes - that's how we learn!",
              "Try explaining what you learned to someone else.",
              "Drink water and sit up straight - your body helps your brain!",
              "Stuck? Take a walk and come back with fresh eyes.",
            ][Math.floor(Math.random() * 5)]}
          </p>
        </Card>
      </main>

      <style jsx global>{`
        @keyframes confetti {
          0% {
            transform: translateY(0) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(100vh) rotate(720deg);
            opacity: 0;
          }
        }
        
        .animate-confetti {
          animation: confetti linear forwards;
        }
        
        @keyframes bounce-slow {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-10px);
          }
        }
        
        .animate-bounce-slow {
          animation: bounce-slow 2s ease-in-out infinite;
        }
      `}</style>
    </>
  );
}
