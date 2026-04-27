'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getPocketBase } from '@/lib/pocketbase';
import { Child, Course, Assignment, PortfolioItem } from '@/lib/types';
import { Card } from '@/components/ui/Card';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Button } from '@/components/ui/Button';

// Kid-friendly format helpers
function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return '☀️ Good morning';
  if (hour < 17) return '🌤️ Good afternoon';
  return '🌙 Good evening';
}

const EMOJIS: Record<string, string> = {
  math: '🔢',
  science: '🔬',
  history: '📜',
  reading: '📚',
  writing: '✏️',
  art: '🎨',
  music: '🎵',
  pe: '⚽',
  default: '📖',
};

function getSubjectEmoji(subject: string): string {
  const key = subject.toLowerCase();
  return EMOJIS[key] || EMOJIS.default;
}

export default function StudentDashboardPage() {
  const router = useRouter();
  const pb = getPocketBase();
  
  const [child, setChild] = useState<Child | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [portfolioItems, setPortfolioItems] = useState<PortfolioItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for student session
    const childId = localStorage.getItem('student_child_id');
    const childName = localStorage.getItem('student_name');
    
    if (!childId) {
      router.push('/student/login');
      return;
    }

    loadStudentData(childId, childName || 'Student');
  }, []);

  const loadStudentData = async (childId: string, childName: string) => {
    try {
      // Get the child's profile
      const childRecord = await pb.collection('children').getOne(childId);
      setChild(childRecord as unknown as Child);

      // Get child's courses
      const courseRecords = await pb.collection('courses').getFullList({
        filter: `child = "${childId}"`,
        sort: 'name'
      });
      setCourses(courseRecords as unknown as Course[]);

      // Get child's assignments
      const assignmentRecords = await pb.collection('assignments').getFullList({
        filter: `child = "${childId}"`,
        sort: 'due_date'
      });
      setAssignments(assignmentRecords as unknown as Assignment[]);

      // Get child's portfolio items
      const portfolioRecords = await pb.collection('portfolio').getFullList({
        filter: `child = "${childId}"`,
        sort: '-date',
        limit: 6
      });
      setPortfolioItems(portfolioRecords as unknown as PortfolioItem[]);
    } catch (e) {
      console.error('Failed to load student data:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('student_child_id');
    localStorage.removeItem('student_name');
    router.push('/student/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FDFCF8] flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4">📚</div>
          <p className="text-[#4B6344] font-medium">Loading your work...</p>
        </div>
      </div>
    );
  }

  // Today's assignments
  const today = new Date().toISOString().split('T')[0];
  const todaysAssignments = assignments.filter(a => {
    if (!a.due_date) return false;
    const due = new Date(a.due_date).toISOString().split('T')[0];
    return due === today;
  });
  
  const pendingAssignments = assignments.filter(a => a.status === 'pending' || a.status === 'in_progress');
  const completedCount = assignments.filter(a => a.status === 'completed' || a.status === 'Graded').length;

  return (
    <div className="min-h-screen bg-[#FDFCF8] pb-20">
      {/* Header */}
      <div className="bg-[#4B6344] text-white p-4 rounded-b-3xl">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-white/80 text-sm">{getGreeting()}!</p>
            <h1 className="font-[family-display] text-2xl">{child?.name} 👋</h1>
          </div>
          <button
            onClick={handleLogout}
            className="text-white/70 hover:text-white text-sm"
          >
            Exit 🚪
          </button>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Progress Overview */}
        <Card className="bg-gradient-to-r from-[#4B6344] to-[#5a7a52] text-white">
          <h2 className="font-[family-display] text-lg mb-3">📊 My Progress</h2>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold">{courses.length}</div>
              <div className="text-white/80 text-xs">Courses</div>
            </div>
            <div>
              <div className="text-2xl font-bold">{completedCount}</div>
              <div className="text-white/80 text-xs">Done</div>
            </div>
            <div>
              <div className="text-2xl font-bold">{pendingAssignments.length}</div>
              <div className="text-white/80 text-xs">To Do</div>
            </div>
          </div>
        </Card>

        {/* Today's Tasks */}
        {todaysAssignments.length > 0 && (
          <Card className="border-l-4 border-l-[#E6AF2E]">
            <h2 className="font-[family-display] text-lg text-[#4B6344] mb-3">
              📅 Today's Tasks
            </h2>
            <div className="space-y-2">
              {todaysAssignments.map((assignment) => (
                <div
                  key={assignment.id}
                  className="flex items-center gap-3 p-3 bg-[#FDFCF8] rounded-xl"
                >
                  <span className="text-xl">{getSubjectEmoji(assignment.subject || 'default')}</span>
                  <div className="flex-1">
                    <p className="font-medium text-[#333]">{assignment.title}</p>
                    <p className="text-gray-500 text-sm">{assignment.subject}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* My Courses */}
        <Card>
          <h2 className="font-[family-display] text-lg text-[#4B6344] mb-3">
            📚 My Courses
          </h2>
          {courses.length === 0 ? (
            <p className="text-gray-500 text-center py-4">No courses yet!</p>
          ) : (
            <div className="space-y-3">
              {courses.map((course) => {
                const progress = course.total_lessons > 0
                  ? Math.round((course.current_lesson / course.total_lessons) * 100)
                  : 0;
                
                return (
                  <div key={course.id} className="space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="font-medium text-[#333]">
                        {getSubjectEmoji(course.name)} {course.name}
                      </span>
                      <span className="text-sm text-gray-500">
                        {course.current_lesson}/{course.total_lessons} lessons
                      </span>
                    </div>
                    <ProgressBar
                      percentage={progress}
                      className="h-2"
                      showPercentage={false}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* To Do List */}
        {pendingAssignments.length > 0 && (
          <Card className="border-l-4 border-l-[#D97757]">
            <h2 className="font-[family-display] text-lg text-[#4B6344] mb-3">
              📝 To Do List
            </h2>
            <div className="space-y-2">
              {pendingAssignments.slice(0, 5).map((assignment) => (
                <div
                  key={assignment.id}
                  className="flex items-center gap-3 p-3 bg-[#FDFCF8] rounded-xl"
                >
                  <input
                    type="checkbox"
                    className="w-5 h-5 rounded border-2 border-[#D97757] text-[#D97757]"
                    readOnly
                  />
                  <div className="flex-1">
                    <p className="font-medium text-[#333]">{assignment.title}</p>
                    {assignment.due_date && (
                      <p className="text-gray-500 text-sm">
                        Due: {formatDate(assignment.due_date)}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* My Portfolio */}
        <Card>
          <h2 className="font-[family-display] text-lg text-[#4B6344] mb-3">
            🎨 My Portfolio
          </h2>
          {portfolioItems.length === 0 ? (
            <p className="text-gray-500 text-center py-4">
              No work in your portfolio yet!
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {portfolioItems.map((item) => (
                <div
                  key={item.id}
                  className="aspect-square bg-gray-100 rounded-xl overflow-hidden"
                >
                  {item.image && typeof item.image === 'string' ? (
                    <img
                      src={item.image}
                      alt={item.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-3xl">
                      📄
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Motivational footer */}
        <div className="text-center py-4">
          <p className="text-[#4B6344] font-[family-display]">
            You're doing great! 🌟
          </p>
        </div>
      </div>
    </div>
  );
}