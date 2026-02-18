'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getPocketBase } from '@/lib/pocketbase';
import { Child, Assignment } from '@/lib/types';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/Button';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { LoadingScreen } from '@/components/ui/Spinner';
import { Toast } from '@/components/ui/Toast';

export default function AssignmentsPage() {
  const router = useRouter();
  const pb = getPocketBase();
  
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [kids, setKids] = useState<Child[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);

  // Filter states
  const [filterChild, setFilterChild] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  // Form states
  const [title, setTitle] = useState('');
  const [childId, setChildId] = useState('');
  const [subject, setSubject] = useState('');
  const [dueDate, setDueDate] = useState(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');
  const [score, setScore] = useState('');

  useEffect(() => {
    if (!pb.authStore.isValid) {
      router.push('/');
      return;
    }
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const userId = pb.authStore.model?.id;
      if (!userId) return;

      const [assignmentRecords, kidRecords] = await Promise.all([
        pb.collection('assignments').getFullList({
          filter: `user = "${userId}"`,
          sort: '-due_date'
        }),
        pb.collection('children').getFullList({
          filter: `user = "${userId}"`,
          sort: 'name'
        })
      ]);

      setAssignments(assignmentRecords as unknown as Assignment[]);
      setKids(kidRecords as unknown as Child[]);
      if (kidRecords.length > 0 && !childId) {
        setChildId(kidRecords[0].id);
      }
    } catch (error) {
      console.error('Assignments load error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const userId = pb.authStore.model?.id;
      if (!userId) return;

      await pb.collection('assignments').create({
        user: userId,
        child: childId,
        title,
        subject,
        due_date: dueDate,
        description,
        score: score ? parseFloat(score) : undefined,
        status: score ? 'Graded' : 'Pending'
      });

      // Log activity
      try {
        const kid = kids.find(k => k.id === childId);
        await pb.collection('activity_logs').create({
          user: userId,
          child: childId,
          type: 'portfolio_add',
          title: `New Assignment: ${title}`,
          date: new Date().toISOString()
        });
      } catch (e) { /* ignore activity log failures */ }

      setToast({ message: 'Assignment created!', type: 'success' });
      setIsModalOpen(false);
      resetForm();
      loadData();
    } catch (error) {
      console.error('Save error:', error);
      setToast({ message: 'Failed to save assignment.', type: 'error' });
    }
  };

  const handleUpdateScore = async (id: string, newScore: string) => {
    try {
      await pb.collection('assignments').update(id, {
        score: parseFloat(newScore),
        status: 'Graded'
      });
      setToast({ message: 'Score updated!', type: 'success' });
      loadData();
    } catch (error) {
      setToast({ message: 'Failed to update score.', type: 'error' });
    }
  };

  const resetForm = () => {
    setTitle('');
    setSubject('');
    setDueDate(new Date().toISOString().split('T')[0]);
    setDescription('');
    setScore('');
  };

  const filteredAssignments = assignments.filter(a => {
    if (filterChild !== 'all' && a.child !== filterChild) return false;
    if (filterStatus === 'pending' && a.status === 'Graded') return false;
    if (filterStatus === 'graded' && a.status !== 'Graded') return false;
    return true;
  });

  const getStatusBadge = (status?: string) => {
    const isGraded = status === 'Graded';
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-bold border ${
        isGraded ? 'bg-green-100 text-green-700 border-green-200' : 'bg-yellow-100 text-yellow-700 border-yellow-200'
      }`}>
        {isGraded ? '✓ Graded' : '🕒 Pending'}
      </span>
    );
  };

  if (loading) {
    return <LoadingScreen message="Loading assignments..." />;
  }

  return (
    <>
      <Header showLogout onLogout={() => { pb.authStore.clear(); router.push('/'); }} />
      <main className="max-w-7xl mx-auto my-8 sm:my-12 px-4 sm:px-8 pb-20 animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-6 mb-8 sm:mb-12">
          <div>
            <h2 className="font-display text-4xl sm:text-6xl font-extrabold tracking-tight mb-2">Assignments</h2>
            <p className="text-text-muted text-sm sm:text-base">Track work items, quizzes, and projects.</p>
          </div>
          <div className="flex items-center gap-3 sm:gap-4">
            <Button variant="ghost" size="sm" onClick={() => router.push('/dashboard')} className="flex-1 sm:flex-none">
              📊 Dashboard
            </Button>
            <Button size="sm" onClick={() => setIsModalOpen(true)} className="flex-1 sm:flex-none">
              + New Assignment
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card className="mb-8 p-4 sm:p-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 items-end">
            <Select 
              label="Filter by Child" 
              value={filterChild} 
              onChange={(e) => setFilterChild(e.target.value)}
            >
              <option value="all">All Children</option>
              {kids.map(k => <option key={k.id} value={k.id}>{k.name}</option>)}
            </Select>
            <Select 
              label="Status" 
              value={filterStatus} 
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="graded">Graded</option>
            </Select>
          </div>
        </Card>

        {/* Assignments List */}
        <div className="space-y-4">
          {filteredAssignments.map((a) => {
            const kid = kids.find(k => k.id === a.child);
            return (
              <div key={a.id} className="bg-card border border-border rounded-[1.5rem] p-5 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-4 sm:gap-6 transition-all hover:border-primary/30">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2 flex-wrap">
                    <h3 className="m-0 font-display text-lg sm:text-xl font-bold">{a.title}</h3>
                    {getStatusBadge(a.status)}
                  </div>
                  <div className="flex flex-wrap gap-x-4 sm:gap-x-6 gap-y-2 text-xs sm:text-sm text-text-muted">
                    <span className="font-bold text-primary">🧒 {kid?.name || 'Unknown'}</span>
                    <span>📚 {a.subject || 'General'}</span>
                    <span>📅 {a.due_date ? new Date(a.due_date).toLocaleDateString() : 'No due date'}</span>
                  </div>
                  {a.description && <p className="mt-3 text-xs sm:text-sm text-text-muted line-clamp-2">{a.description}</p>}
                </div>
                
                <div className="flex items-center gap-3 sm:gap-4 min-w-full md:min-w-[200px] justify-between md:justify-end border-t md:border-t-0 pt-4 md:pt-0 border-border/50">
                  {a.status === 'Graded' ? (
                    <div className="text-left md:text-right">
                      <div className="text-2xl sm:text-3xl font-display font-extrabold text-primary">{a.score}%</div>
                      <div className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Score</div>
                    </div>
                  ) : (
                    <div className="flex gap-2 items-center flex-1 md:flex-none">
                      <Input 
                        placeholder="Score %" 
                        type="number" 
                        className="w-full md:w-24 mb-0" 
                        onBlur={(e) => {
                          if (e.target.value) handleUpdateScore(a.id, e.target.value);
                        }}
                      />
                      <span className="font-bold text-text-muted">%</span>
                    </div>
                  )}
                  <Button variant="ghost" size="sm" onClick={async () => {
                    if (confirm('Delete assignment?')) {
                      await pb.collection('assignments').delete(a.id);
                      loadData();
                    }
                  }} className="px-3">
                    🗑️
                  </Button>
                </div>
              </div>
            );
          })}

          {filteredAssignments.length === 0 && (
            <div className="text-center py-20 bg-bg-alt rounded-[2rem] border-2 border-dashed border-border">
              <p className="text-text-muted text-lg">No assignments found.</p>
            </div>
          )}
        </div>
      </main>

      {/* New Assignment Modal */}
      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title="New Assignment"
        subtitle="Set a task or quiz for a child."
      >
        <form onSubmit={handleSave} className="space-y-4">
          <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="e.g. Weekly Math Quiz" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select label="Child" value={childId} onChange={(e) => setChildId(e.target.value)} required>
              {kids.map(k => <option key={k.id} value={k.id}>{k.name}</option>)}
            </Select>
            <Input label="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Math" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Due Date" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} required />
            <Input label="Initial Score % (Optional)" type="number" value={score} onChange={(e) => setScore(e.target.value)} placeholder="Leave blank if pending" />
          </div>
          <Textarea label="Description / Instructions" value={description} onChange={(e) => setDescription(e.target.value)} />
          
          <div className="flex flex-col sm:flex-row justify-end gap-4 mt-8">
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)} className="w-full sm:w-auto order-2 sm:order-1">Cancel</Button>
            <Button type="submit" className="w-full sm:w-auto order-1 sm:order-2">Create Assignment</Button>
          </div>
        </form>
      </Modal>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </>
  );
}
