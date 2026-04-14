'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getPocketBase } from '@/lib/pocketbase';
import { Header } from '@/components/Header';
import { Card } from '@/components/ui/Card';

interface Lesson {
  id: string;
  topic: string;
  subject: string;
  grade: string;
  url: string;
}

const LESSONS: Lesson[] = [
  // Math
  { id: 'L-SBEY_U3i', topic: 'Fractions', subject: 'Math', grade: '3rd Grade', url: 'https://how-november.exe.xyz:3002/classroom/L-SBEY_U3i' },
  { id: 'N-E_S0eZ4E', topic: 'Decimals', subject: 'Math', grade: '5th Grade', url: 'https://how-november.exe.xyz:3002/classroom/N-E_S0eZ4E' },
  { id: '15A6OjrzZj', topic: 'Introduction to Algebra', subject: 'Math', grade: '6th Grade', url: 'https://how-november.exe.xyz:3002/classroom/15A6OjrzZj' },
  { id: 'NrbiZQaiKt', topic: 'Pre-Algebra', subject: 'Math', grade: '7th Grade', url: 'https://how-november.exe.xyz:3002/classroom/NrbiZQaiKt' },
  { id: '3upEahoQVh', topic: 'Geometry', subject: 'Math', grade: 'High School', url: 'https://how-november.exe.xyz:3002/classroom/3upEahoQVh' },
  // Science
  { id: 'OxHVofRcWy', topic: 'Plant Life Cycle', subject: 'Science', grade: 'Elementary', url: 'https://how-november.exe.xyz:3002/classroom/OxHVofRcWy' },
  { id: 'nvCsEwRqoy', topic: 'Ecosystems', subject: 'Science', grade: 'Middle School', url: 'https://how-november.exe.xyz:3002/classroom/nvCsEwRqoy' },
  { id: 'd9BKAW5lBf', topic: 'Chemistry Basics', subject: 'Science', grade: 'High School', url: 'https://how-november.exe.xyz:3002/classroom/d9BKAW5lBf' },
  // History
  { id: 'BukDLdIRei', topic: 'Ancient Egypt', subject: 'History', grade: 'Elementary', url: 'https://how-november.exe.xyz:3002/classroom/BukDLdIRei' },
  { id: 'Yrae3zUZAA', topic: 'World War II', subject: 'History', grade: 'Middle School', url: 'https://how-november.exe.xyz:3002/classroom/Yrae3zUZAA' },
  { id: 'ohDg0tpE7r', topic: 'US Constitution', subject: 'History', grade: 'High School', url: 'https://how-november.exe.xyz:3002/classroom/ohDg0tpE7r' },
  // Language Arts
  { id: 'g0PbloFUWr', topic: 'Reading Comprehension', subject: 'Language Arts', grade: 'Elementary', url: 'https://how-november.exe.xyz:3002/classroom/g0PbloFUWr' },
  { id: 'eZ7mfsVgdB', topic: 'Animals & Nature Reading', subject: 'Language Arts', grade: 'Elementary', url: 'https://how-november.exe.xyz:3002/classroom/eZ7mfsVgdB' },
  { id: 'oJiiVxpIU1', topic: 'Essay Writing', subject: 'Language Arts', grade: 'Middle School', url: 'https://how-november.exe.xyz:3002/classroom/oJiiVxpIU1' },
  { id: 'Bo9e6KLyu7', topic: 'Literature Analysis', subject: 'Language Arts', grade: 'High School', url: 'https://how-november.exe.xyz:3002/classroom/Bo9e6KLyu7' },
];

const SUBJECT_ICONS: Record<string, string> = {
  'Math': '📐',
  'Science': '🔬',
  'History': '🏛️',
  'Language Arts': '📖',
};

export default function LessonsPage() {
  const router = useRouter();
  const pb = getPocketBase();
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);

  useEffect(() => {
    if (!pb.authStore.isValid) {
      router.push('/');
    }
  }, [pb.authStore.isValid, router]);

  const filteredLessons = selectedSubject 
    ? LESSONS.filter(l => l.subject === selectedSubject)
    : LESSONS;

  const subjects = [...new Set(LESSONS.map(l => l.subject))];

  const handleLogout = () => {
    pb.authStore.clear();
    router.push('/');
  };

  return (
    <>
      <Header showLogout onLogout={handleLogout} />
      <main className="max-w-6xl mx-auto my-12 px-8 pb-20 animate-fade-in">
        <Card>
          <h2 className="font-display text-4xl font-extrabold tracking-tight mb-4">📚 Village Lesson Library</h2>
          <p className="text-text-muted mb-8 text-lg">
            Interactive AI-powered lessons. Click any lesson to start learning with AI teachers and classmates!
          </p>

          {/* Subject Filter */}
          <div className="flex gap-3 mb-8 flex-wrap">
            <button
              onClick={() => setSelectedSubject(null)}
              className={`px-4 py-2 rounded-full font-semibold text-sm transition-all ${
                selectedSubject === null 
                  ? 'bg-primary text-white' 
                  : 'bg-bg-alt text-text-muted hover:bg-border'
              }`}
            >
              All Subjects
            </button>
            {subjects.map(subject => (
              <button
                key={subject}
                onClick={() => setSelectedSubject(subject)}
                className={`px-4 py-2 rounded-full font-semibold text-sm transition-all ${
                  selectedSubject === subject 
                    ? 'bg-primary text-white' 
                    : 'bg-bg-alt text-text-muted hover:bg-border'
                }`}
              >
                {SUBJECT_ICONS[subject]} {subject}
              </button>
            ))}
          </div>

          {/* Lesson Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredLessons.map(lesson => (
              <a
                key={lesson.id}
                href={lesson.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block p-5 rounded-2xl border-2 border-border hover:border-primary hover:shadow-lg transition-all group"
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-2xl">{SUBJECT_ICONS[lesson.subject]}</span>
                  <span className="text-xs font-bold text-text-muted uppercase tracking-wider">
                    {lesson.subject}
                  </span>
                </div>
                <h3 className="font-display text-xl font-bold text-text group-hover:text-primary transition-colors">
                  {lesson.topic}
                </h3>
                <p className="text-sm text-text-muted mt-2">
                  {lesson.grade}
                </p>
                <div className="mt-3 text-primary text-sm font-semibold flex items-center gap-1">
                  Start Learning →
                </div>
              </a>
            ))}
          </div>
        </Card>
      </main>
    </>
  );
}