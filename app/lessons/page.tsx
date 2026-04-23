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
  description?: string;
}

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
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!pb.authStore.isValid) {
      router.push('/');
      return;
    }
    fetchLessons();
  }, [pb.authStore.isValid, router]);

  const fetchLessons = async () => {
    try {
      const response = await fetch('/api/community-sparks');
      const data = await response.json();
      setLessons(data);
    } catch (error) {
      console.error('Failed to fetch lessons:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredLessons = selectedSubject 
    ? lessons.filter(l => l.subject === selectedSubject)
    : lessons;

  const subjects = [...new Set(lessons.map(l => l.subject))];

  const handleLogout = () => {
    pb.authStore.clear();
    router.push('/');
  };

  if (loading) {
    return (
      <>
        <Header showLogout onLogout={handleLogout} />
        <main className="max-w-6xl mx-auto my-12 px-8 text-center">
          <p className="text-text-muted">Loading Lesson Library...</p>
        </main>
      </>
    );
  }

  return (
    <>
      <Header showLogout onLogout={handleLogout} />
      <main className="max-w-6xl mx-auto my-12 px-8 pb-20 animate-fade-in">
        <Card>
          <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 mb-4">
            <h2 className="font-display text-4xl font-extrabold tracking-tight">📚 Village Lesson Library</h2>
            <button 
              onClick={() => router.push('/dashboard')}
              className="text-primary font-bold text-sm hover:underline"
            >
              ← Back to Dashboard
            </button>
          </div>
          <p className="text-text-muted mb-8 text-lg">
            Curated community lessons. Click any lesson to start learning with AI teachers and classmates!
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredLessons.map(lesson => (
              <a
                key={lesson.id}
                href={lesson.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col p-6 rounded-2xl border-2 border-border hover:border-primary hover:shadow-xl transition-all group bg-white"
              >
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-3xl">{SUBJECT_ICONS[lesson.subject]}</span>
                  <div>
                    <span className="block text-[10px] font-bold text-text-muted uppercase tracking-widest">
                      {lesson.subject}
                    </span>
                    <span className="block text-xs font-semibold text-primary">
                      {lesson.grade}
                    </span>
                  </div>
                </div>
                <h3 className="font-display text-xl font-extrabold text-text group-hover:text-primary transition-colors mb-2">
                  {lesson.topic}
                </h3>
                {lesson.description && (
                  <p className="text-sm text-text-muted mb-6 leading-relaxed flex-1">
                    {lesson.description}
                  </p>
                )}
                <div className="mt-auto pt-4 border-t border-border/50 text-primary text-sm font-bold flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                  Start Interactive Lesson →
                </div>
              </a>
            ))}
          </div>

          {filteredLessons.length === 0 && (
            <div className="text-center py-20 border-2 border-dashed border-border rounded-3xl">
              <p className="text-text-muted italic">No lessons found in this category.</p>
            </div>
          )}
        </Card>
      </main>
    </>
  );
}
