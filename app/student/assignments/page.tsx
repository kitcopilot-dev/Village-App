'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getPocketBase } from '@/lib/pocketbase';
import { Child, Assignment } from '@/lib/types';
import { Header } from '@/components/Header';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { LoadingScreen } from '@/components/ui/Spinner';
import { Toast } from '@/components/ui/Toast';

export default function StudentAssignmentsPage() {
  const router = useRouter();
  const pb = getPocketBase();
  
  const [student, setStudent] = useState<Child | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);

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
      const [kidRecord, assignmentRecords] = await Promise.all([
        pb.collection('children').getOne(id),
        pb.collection('assignments').getFullList({
          filter: `child = "${id}"`,
          sort: '-due_date',
        })
      ]);

      setStudent(kidRecord as unknown as Child);
      setAssignments(assignmentRecords as unknown as Assignment[]);
    } catch (e: any) {
      console.error('Failed to load assignments:', e);
      if (e?.name !== 'AbortError' && e?.isAbort !== true) {
        router.push('/student');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (assignment: Assignment, newStatus: 'in_progress' | 'completed' | 'pending') => {
    try {
      await pb.collection('assignments').update(assignment.id, {
        status: newStatus
      });
      
      setToast({ 
        message: newStatus === 'completed' ? 'Great job! Assignment marked as finished.' : 'Update saved!', 
        type: 'success' 
      });
      
      // Refresh list
      const updated = await pb.collection('assignments').getFullList({
        filter: `child = "${student?.id}"`,
        sort: '-due_date',
      });
      setAssignments(updated as unknown as Assignment[]);
    } catch (error) {
      setToast({ message: 'Failed to update assignment.', type: 'error' });
    }
  };

  const isOverdue = (dueDate?: string) => {
    if (!dueDate) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return new Date(dueDate) < today;
  };

  if (loading) return <LoadingScreen message="Loading your assignments..." />;
  if (!student) return null;

  const pending = assignments.filter(a => a.status !== 'Graded' && a.status !== 'completed');
  const finished = assignments.filter(a => a.status === 'Graded' || a.status === 'completed');

  return (
    <>
      <header className="bg-bg/80 backdrop-blur-md px-8 py-6 flex justify-between items-center sticky top-0 z-50 border-b border-border/50">
        <h1 className="font-display text-2xl font-extrabold m-0 text-primary uppercase tracking-tighter">
          Village<span className="text-secondary">.</span> <span className="text-text-muted text-lg lowercase font-bold tracking-normal ml-2">missions</span>
        </h1>
        <Button variant="outline" size="sm" onClick={() => router.push('/student/dashboard')}>Back to Dashboard</Button>
      </header>

      <main className="max-w-4xl mx-auto my-12 px-4 sm:px-8 pb-24 animate-fade-in">
        <div className="mb-12">
          <h2 className="font-display text-4xl sm:text-6xl font-extrabold tracking-tight mb-2">My Missions</h2>
          <p className="text-text-muted text-sm sm:text-base font-serif italic">Let&apos;s see what we need to tackle today!</p>
        </div>

        {/* Pending Assignments */}
        <section className="mb-16">
          <h3 className="font-display text-xl font-bold uppercase tracking-widest text-secondary mb-8">Active Quests</h3>
          <div className="space-y-6">
            {pending.length === 0 ? (
              <Card className="p-12 text-center bg-bg-alt border-dashed">
                <p className="text-text-muted italic mb-0 text-lg">No active assignments for now. Great work!</p>
              </Card>
            ) : (
              pending.sort((a,b) => {
                // Pin in_progress to top
                if (a.status === 'in_progress' && b.status !== 'in_progress') return -1;
                if (b.status === 'in_progress' && a.status !== 'in_progress') return 1;
                return 0;
              }).map(a => (
                <Card key={a.id} className={`p-8 transition-all border-l-8 ${a.status === 'in_progress' ? 'border-primary' : 'border-secondary/30'} hover:border-l-primary`}>
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h4 className="font-display font-extrabold text-2xl m-0">{a.title}</h4>
                        {isOverdue(a.due_date) && (
                          <span className="text-[10px] bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-bold uppercase tracking-widest border border-red-200">Overdue</span>
                        )}
                        {a.status === 'in_progress' && (
                          <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold uppercase tracking-widest border border-primary/20">Working on it</span>
                        )}
                      </div>
                      <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-4">
                        {a.subject && <span className="mr-4">📚 {a.subject}</span>}
                        {a.due_date && <span>📅 Due {new Date(a.due_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric'})}</span>}
                      </p>
                      {a.description && (
                        <p className="text-text-muted leading-relaxed font-serif italic border-l-2 border-border/50 pl-4 py-1">
                          {a.description}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-3 md:flex-col lg:flex-row">
                      {a.status !== 'in_progress' && (
                        <Button variant="outline" size="sm" onClick={() => handleStatusUpdate(a, 'in_progress')}>
                          Start Work
                        </Button>
                      )}
                      <Button variant="secondary" size="sm" onClick={() => handleStatusUpdate(a, 'completed')}>
                        Mark Finished
                      </Button>
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>
        </section>

        {/* Completed Assignments */}
        {finished.length > 0 && (
          <section>
            <h3 className="font-display text-xl font-bold uppercase tracking-widest text-text-muted mb-8">Completed Missions</h3>
            <div className="grid sm:grid-cols-2 gap-4">
              {finished.map(a => (
                <Card key={a.id} className="p-6 bg-white/50 border-none opacity-80 hover:opacity-100 transition-opacity">
                  <div className="flex justify-between items-start mb-4">
                    <h4 className="font-display font-extrabold text-lg m-0">{a.title}</h4>
                    {a.status === 'Graded' && (
                      <div className="text-right">
                        <span className="text-2xl font-display font-extrabold text-primary">{a.score}%</span>
                      </div>
                    )}
                    {a.status === 'completed' && (
                      <span className="text-[10px] font-bold text-green-600 bg-green-50 px-2 py-1 rounded-full border border-green-100 uppercase tracking-widest">Done</span>
                    )}
                  </div>
                  <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest m-0">
                    {a.subject && <span className="mr-3">{a.subject}</span>}
                    {new Date(a.created).toLocaleDateString()}
                  </p>
                </Card>
              ))}
            </div>
          </section>
        )}
      </main>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </>
  );
}
