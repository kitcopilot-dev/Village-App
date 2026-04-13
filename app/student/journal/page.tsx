'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getPocketBase } from '@/lib/pocketbase';
import { Child } from '@/lib/types';
import { Header } from '@/components/Header';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Input';
import { LoadingScreen } from '@/components/ui/Spinner';
import { Toast } from '@/components/ui/Toast';

export default function GratitudeJournalPage() {
  const router = useRouter();
  const pb = getPocketBase();
  
  const [student, setStudent] = useState<Child | null>(null);
  const [loading, setLoading] = useState(true);
  const [gratitude, setGratitude] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);
  const [history, setHistory] = useState<any[]>([]);

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
      const [kidRecord, journalRecords] = await Promise.all([
        pb.collection('children').getOne(id),
        pb.collection('activity_logs').getFullList({
          filter: `child = "${id}" && type = "gratitude"`,
          sort: '-date',
          limit: 5
        })
      ]);

      setStudent(kidRecord as unknown as Child);
      setHistory(journalRecords);
      
      // Check if already posted today
      const today = new Date().toISOString().split('T')[0];
      const todayEntry = journalRecords.find(r => r.date.startsWith(today));
      if (todayEntry) {
        setGratitude(todayEntry.description || '');
      }

    } catch (e) {
      console.error('Failed to load journal data:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gratitude.trim() || !student) return;

    setIsSaving(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const existing = history.find(r => r.date.startsWith(today));

      if (existing) {
        await pb.collection('activity_logs').update(existing.id, {
          description: gratitude
        });
      } else {
        await pb.collection('activity_logs').create({
          user: student.user,
          child: student.id,
          type: 'gratitude',
          title: `Gratitude Entry`,
          description: gratitude,
          date: new Date().toISOString()
        });
      }

      setToast({ message: 'Journal saved! Awesome work.', type: 'success' });
      loadData(student.id);
    } catch (error) {
      setToast({ message: 'Failed to save entry.', type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) return <LoadingScreen message="Opening your Gratitude Journal..." />;
  if (!student) return null;

  return (
    <>
      <header className="bg-bg/80 backdrop-blur-md px-8 py-6 flex justify-between items-center sticky top-0 z-50 border-b border-border/50">
        <h1 className="font-display text-2xl font-extrabold m-0 text-primary uppercase tracking-tighter">
          Village<span className="text-secondary">.</span> <span className="text-text-muted text-lg lowercase font-bold tracking-normal ml-2">journal</span>
        </h1>
        <Button variant="outline" size="sm" onClick={() => router.push('/student/dashboard')}>Back to Dashboard</Button>
      </header>

      <main className="max-w-3xl mx-auto my-12 px-4 sm:px-8 pb-24 animate-fade-in">
        <div className="text-center mb-12">
          <div className="text-6xl mb-6">🙏</div>
          <h2 className="font-display text-4xl sm:text-6xl font-extrabold tracking-tight mb-4">Gratitude Journal</h2>
          <p className="text-text-muted text-lg sm:text-xl font-serif italic">What are you thankful for today, {student.name}?</p>
        </div>

        <Card className="p-8 sm:p-12 shadow-xl border-primary/20">
          <form onSubmit={handleSave} className="space-y-8">
            <Textarea 
              value={gratitude}
              onChange={(e) => setGratitude(e.target.value)}
              placeholder="I am thankful for..."
              className="text-xl sm:text-2xl font-serif min-h-[200px] border-none focus:ring-0 p-0 placeholder:text-text-muted/30"
              autoFocus
            />
            
            <div className="pt-4 border-t border-border/50 flex justify-between items-center">
              <span className="text-xs font-bold text-text-muted uppercase tracking-widest">
                {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              </span>
              <Button type="submit" disabled={isSaving || !gratitude.trim()} size="lg">
                {isSaving ? 'Saving...' : 'Save Today\'s Entry'}
              </Button>
            </div>
          </form>
        </Card>

        {history.length > 1 && (
          <div className="mt-20">
            <h3 className="font-display text-2xl font-bold mb-8 text-center text-text-muted uppercase tracking-widest">Recent Reflections</h3>
            <div className="space-y-6">
              {history.slice(1).map((entry, i) => (
                <Card key={entry.id} className="p-6 bg-white/50 border-none transition-opacity hover:opacity-100 opacity-80">
                  <p className="text-sm font-bold text-primary mb-2 uppercase tracking-widest">
                    {new Date(entry.date).toLocaleDateString()}
                  </p>
                  <p className="text-lg font-serif italic m-0">&ldquo;{entry.description}&rdquo;</p>
                </Card>
              ))}
            </div>
          </div>
        )}
      </main>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </>
  );
}
