'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getPocketBase } from '@/lib/pocketbase';
import { Child, Goal, GoalMilestone } from '@/lib/types';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/Button';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { LoadingScreen } from '@/components/ui/Spinner';
import { Toast } from '@/components/ui/Toast';

const CATEGORY_ICONS: Record<string, string> = {
  academic: '📚',
  reading: '📖',
  skill: '🎯',
  habit: '🔄',
  project: '🛠️',
  other: '✨'
};

const CATEGORY_COLORS: Record<string, string> = {
  academic: 'bg-blue-100 text-blue-700 border-blue-200',
  reading: 'bg-purple-100 text-purple-700 border-purple-200',
  skill: 'bg-green-100 text-green-700 border-green-200',
  habit: 'bg-orange-100 text-orange-700 border-orange-200',
  project: 'bg-pink-100 text-pink-700 border-pink-200',
  other: 'bg-gray-100 text-gray-700 border-gray-200'
};

export default function GoalsPage() {
  const router = useRouter();
  const pb = getPocketBase();

  const [goals, setGoals] = useState<Goal[]>([]);
  const [kids, setKids] = useState<Child[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Filters
  const [filterChild, setFilterChild] = useState('all');
  const [filterStatus, setFilterStatus] = useState<'active' | 'completed' | 'all'>('active');
  const [filterCategory, setFilterCategory] = useState('all');

  // Form states
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [childId, setChildId] = useState('');
  const [category, setCategory] = useState<Goal['category']>('academic');
  const [targetType, setTargetType] = useState<Goal['target_type']>('number');
  const [targetValue, setTargetValue] = useState('');
  const [currentValue, setCurrentValue] = useState('0');
  const [unit, setUnit] = useState('');
  const [deadline, setDeadline] = useState('');

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

      const [goalRecords, kidRecords] = await Promise.all([
        pb.collection('goals').getFullList({
          filter: `user = "${userId}"`,
          sort: '-created'
        }).catch(() => []),
        pb.collection('children').getFullList({
          filter: `user = "${userId}"`,
          sort: 'name'
        })
      ]);

      setGoals(goalRecords as unknown as Goal[]);
      setKids(kidRecords as unknown as Child[]);
    } catch (error) {
      console.error('Goals load error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const userId = pb.authStore.model?.id;
      if (!userId) return;

      const goalData = {
        user: userId,
        child: childId || undefined,
        title,
        description,
        category,
        target_type: targetType,
        target_value: targetType === 'number' ? parseFloat(targetValue) : 1,
        current_value: parseFloat(currentValue) || 0,
        unit: targetType === 'number' ? unit : undefined,
        deadline: deadline || undefined,
        status: 'active' as const
      };

      if (editingGoal) {
        await pb.collection('goals').update(editingGoal.id, goalData);
        setToast({ message: 'Goal updated!', type: 'success' });
      } else {
        await pb.collection('goals').create(goalData);
        setToast({ message: 'Goal created!', type: 'success' });
      }

      setIsModalOpen(false);
      resetForm();
      loadData();
    } catch (error) {
      console.error('Save error:', error);
      setToast({ message: 'Failed to save goal. Make sure the goals collection exists in PocketBase.', type: 'error' });
    }
  };

  const handleUpdateProgress = async (goal: Goal, newValue: number) => {
    try {
      const updates: Partial<Goal> = { current_value: newValue };
      
      // Check if goal is completed
      if (goal.target_type === 'number' && goal.target_value && newValue >= goal.target_value) {
        updates.status = 'completed';
        updates.completed_date = new Date().toISOString();
      } else if (goal.target_type === 'completion' && newValue >= 1) {
        updates.status = 'completed';
        updates.completed_date = new Date().toISOString();
      }

      await pb.collection('goals').update(goal.id, updates);
      
      if (updates.status === 'completed') {
        setToast({ message: '🎉 Goal completed! Congratulations!', type: 'success' });
      } else {
        setToast({ message: 'Progress updated!', type: 'success' });
      }
      
      loadData();
    } catch (error) {
      setToast({ message: 'Failed to update progress.', type: 'error' });
    }
  };

  const handleDelete = async (goalId: string) => {
    if (!confirm('Delete this goal?')) return;
    try {
      await pb.collection('goals').delete(goalId);
      setToast({ message: 'Goal deleted.', type: 'success' });
      loadData();
    } catch (error) {
      setToast({ message: 'Failed to delete goal.', type: 'error' });
    }
  };

  const handleArchive = async (goal: Goal) => {
    try {
      await pb.collection('goals').update(goal.id, {
        status: goal.status === 'archived' ? 'active' : 'archived'
      });
      setToast({ message: goal.status === 'archived' ? 'Goal restored!' : 'Goal archived.', type: 'success' });
      loadData();
    } catch (error) {
      setToast({ message: 'Failed to update goal.', type: 'error' });
    }
  };

  const openEditModal = (goal: Goal) => {
    setEditingGoal(goal);
    setTitle(goal.title);
    setDescription(goal.description || '');
    setChildId(goal.child || '');
    setCategory(goal.category);
    setTargetType(goal.target_type);
    setTargetValue(goal.target_value?.toString() || '');
    setCurrentValue(goal.current_value.toString());
    setUnit(goal.unit || '');
    setDeadline(goal.deadline ? goal.deadline.split('T')[0] : '');
    setIsModalOpen(true);
  };

  const resetForm = () => {
    setEditingGoal(null);
    setTitle('');
    setDescription('');
    setChildId('');
    setCategory('academic');
    setTargetType('number');
    setTargetValue('');
    setCurrentValue('0');
    setUnit('');
    setDeadline('');
  };

  const getProgress = (goal: Goal): number => {
    if (goal.target_type === 'completion') {
      return goal.status === 'completed' ? 100 : 0;
    }
    if (!goal.target_value || goal.target_value === 0) return 0;
    return Math.min(100, Math.round((goal.current_value / goal.target_value) * 100));
  };

  const getDaysRemaining = (deadline?: string): number | null => {
    if (!deadline) return null;
    const deadlineDate = new Date(deadline);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diff = Math.ceil((deadlineDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return diff;
  };

  const filteredGoals = goals.filter(g => {
    if (filterChild !== 'all' && g.child !== filterChild && !(filterChild === 'family' && !g.child)) return false;
    if (filterStatus !== 'all' && g.status !== filterStatus) return false;
    if (filterCategory !== 'all' && g.category !== filterCategory) return false;
    return true;
  });

  // Group by child for display
  const familyGoals = filteredGoals.filter(g => !g.child);
  const kidGoalsMap = new Map<string, Goal[]>();
  filteredGoals.filter(g => g.child).forEach(g => {
    const existing = kidGoalsMap.get(g.child!) || [];
    kidGoalsMap.set(g.child!, [...existing, g]);
  });

  if (loading) {
    return <LoadingScreen message="Loading goals..." />;
  }

  return (
    <>
      <Header showLogout onLogout={() => { pb.authStore.clear(); router.push('/'); }} />
      <main className="max-w-7xl mx-auto my-8 sm:my-12 px-4 sm:px-8 pb-20 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-6 mb-8 sm:mb-12">
          <div>
            <h2 className="font-display text-4xl sm:text-6xl font-extrabold tracking-tight mb-2">Learning Goals</h2>
            <p className="text-text-muted text-sm sm:text-base">Set goals, track progress, celebrate achievements.</p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => router.push('/dashboard')}>← Dashboard</Button>
            <Button size="sm" onClick={() => { resetForm(); setIsModalOpen(true); }}>+ New Goal</Button>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Active Goals', value: goals.filter(g => g.status === 'active').length, emoji: '🎯', color: 'text-primary' },
            { label: 'Completed', value: goals.filter(g => g.status === 'completed').length, emoji: '✅', color: 'text-green-600' },
            { label: 'This Month', value: goals.filter(g => g.status === 'completed' && g.completed_date && new Date(g.completed_date).getMonth() === new Date().getMonth()).length, emoji: '📅', color: 'text-secondary' },
            { label: 'Completion Rate', value: `${goals.length > 0 ? Math.round((goals.filter(g => g.status === 'completed').length / goals.length) * 100) : 0}%`, emoji: '📊', color: 'text-accent' }
          ].map((stat, i) => (
            <div key={i} className="bg-card border-2 border-border rounded-[1.25rem] p-4 sm:p-6 text-center transition-all hover:border-primary">
              <div className="text-xl sm:text-2xl mb-1">{stat.emoji}</div>
              <div className={`font-display text-2xl sm:text-4xl font-extrabold ${stat.color}`}>{stat.value}</div>
              <div className="text-xs mt-1 text-text-muted font-semibold">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <Card className="mb-8 p-4 sm:p-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
            <Select label="Filter by Child" value={filterChild} onChange={(e) => setFilterChild(e.target.value)}>
              <option value="all">All</option>
              <option value="family">Family Goals</option>
              {kids.map(k => <option key={k.id} value={k.id}>{k.name}</option>)}
            </Select>
            <Select label="Status" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as typeof filterStatus)}>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="all">All</option>
            </Select>
            <Select label="Category" value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
              <option value="all">All Categories</option>
              <option value="academic">📚 Academic</option>
              <option value="reading">📖 Reading</option>
              <option value="skill">🎯 Skill</option>
              <option value="habit">🔄 Habit</option>
              <option value="project">🛠️ Project</option>
              <option value="other">✨ Other</option>
            </Select>
          </div>
        </Card>

        {/* Goals List */}
        {filteredGoals.length === 0 ? (
          <div className="text-center py-20 bg-bg-alt rounded-[2rem] border-2 border-dashed border-border">
            <div className="text-5xl mb-4">🎯</div>
            <h3 className="font-display text-2xl font-bold mb-2">No goals yet</h3>
            <p className="text-text-muted mb-6">Start setting learning goals for your family!</p>
            <Button onClick={() => { resetForm(); setIsModalOpen(true); }}>Create Your First Goal</Button>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Family Goals */}
            {familyGoals.length > 0 && (
              <div>
                <h3 className="font-display text-xl font-bold text-primary mb-4 flex items-center gap-2">
                  <span className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">👨‍👩‍👧‍👦</span>
                  Family Goals
                </h3>
                <div className="space-y-4">
                  {familyGoals.map(goal => (
                    <GoalCard
                      key={goal.id}
                      goal={goal}
                      onEdit={() => openEditModal(goal)}
                      onDelete={() => handleDelete(goal.id)}
                      onArchive={() => handleArchive(goal)}
                      onUpdateProgress={(val) => handleUpdateProgress(goal, val)}
                      getProgress={getProgress}
                      getDaysRemaining={getDaysRemaining}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Goals by Child */}
            {Array.from(kidGoalsMap.entries()).map(([kidId, kidGoals]) => {
              const kid = kids.find(k => k.id === kidId);
              if (!kid) return null;
              return (
                <div key={kidId}>
                  <h3 className="font-display text-xl font-bold text-primary mb-4 flex items-center gap-2">
                    <span className="w-8 h-8 rounded-full bg-secondary/20 flex items-center justify-center text-secondary font-bold">
                      {kid.name.charAt(0)}
                    </span>
                    {kid.name}'s Goals
                  </h3>
                  <div className="space-y-4">
                    {kidGoals.map(goal => (
                      <GoalCard
                        key={goal.id}
                        goal={goal}
                        onEdit={() => openEditModal(goal)}
                        onDelete={() => handleDelete(goal.id)}
                        onArchive={() => handleArchive(goal)}
                        onUpdateProgress={(val) => handleUpdateProgress(goal, val)}
                        getProgress={getProgress}
                        getDaysRemaining={getDaysRemaining}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* New/Edit Goal Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); resetForm(); }}
        title={editingGoal ? 'Edit Goal' : 'New Goal'}
        subtitle="Set a measurable learning goal"
      >
        <form onSubmit={handleSave} className="space-y-4">
          <Input
            label="Goal Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            placeholder="e.g. Read 20 books this semester"
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select label="Assign To" value={childId} onChange={(e) => setChildId(e.target.value)}>
              <option value="">Whole Family</option>
              {kids.map(k => <option key={k.id} value={k.id}>{k.name}</option>)}
            </Select>
            <Select label="Category" value={category} onChange={(e) => setCategory(e.target.value as Goal['category'])}>
              <option value="academic">📚 Academic</option>
              <option value="reading">📖 Reading</option>
              <option value="skill">🎯 Skill Building</option>
              <option value="habit">🔄 Daily Habit</option>
              <option value="project">🛠️ Project</option>
              <option value="other">✨ Other</option>
            </Select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select label="Goal Type" value={targetType} onChange={(e) => setTargetType(e.target.value as Goal['target_type'])}>
              <option value="number">🔢 Reach a Number</option>
              <option value="completion">✅ Complete Once</option>
              <option value="streak">🔥 Build a Streak</option>
            </Select>
            <Input
              label="Deadline (Optional)"
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
            />
          </div>

          {targetType === 'number' && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Input
                label="Target"
                type="number"
                value={targetValue}
                onChange={(e) => setTargetValue(e.target.value)}
                required
                placeholder="20"
              />
              <Input
                label="Current Progress"
                type="number"
                value={currentValue}
                onChange={(e) => setCurrentValue(e.target.value)}
                placeholder="0"
              />
              <Input
                label="Unit"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="books, hours, lessons"
              />
            </div>
          )}

          {targetType === 'streak' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Target Days"
                type="number"
                value={targetValue}
                onChange={(e) => setTargetValue(e.target.value)}
                required
                placeholder="30"
              />
              <Input
                label="Current Streak"
                type="number"
                value={currentValue}
                onChange={(e) => setCurrentValue(e.target.value)}
                placeholder="0"
              />
            </div>
          )}

          <Textarea
            label="Description / Notes (Optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Why is this goal important? Any specific milestones?"
          />

          <div className="flex flex-col sm:flex-row justify-end gap-4 mt-8">
            <Button type="button" variant="outline" onClick={() => { setIsModalOpen(false); resetForm(); }} className="w-full sm:w-auto">
              Cancel
            </Button>
            <Button type="submit" className="w-full sm:w-auto">
              {editingGoal ? 'Save Changes' : 'Create Goal'}
            </Button>
          </div>
        </form>
      </Modal>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </>
  );
}

// Goal Card Component
interface GoalCardProps {
  goal: Goal;
  onEdit: () => void;
  onDelete: () => void;
  onArchive: () => void;
  onUpdateProgress: (value: number) => void;
  getProgress: (goal: Goal) => number;
  getDaysRemaining: (deadline?: string) => number | null;
}

function GoalCard({ goal, onEdit, onDelete, onArchive, onUpdateProgress, getProgress, getDaysRemaining }: GoalCardProps) {
  const [showProgressInput, setShowProgressInput] = useState(false);
  const [progressInput, setProgressInput] = useState(goal.current_value.toString());

  const progress = getProgress(goal);
  const daysRemaining = getDaysRemaining(goal.deadline);
  const isOverdue = daysRemaining !== null && daysRemaining < 0;
  const isUrgent = daysRemaining !== null && daysRemaining >= 0 && daysRemaining <= 7;

  const handleProgressSubmit = () => {
    const newValue = parseFloat(progressInput);
    if (!isNaN(newValue) && newValue >= 0) {
      onUpdateProgress(newValue);
      setShowProgressInput(false);
    }
  };

  const handleQuickIncrement = () => {
    onUpdateProgress(goal.current_value + 1);
  };

  return (
    <div className={`bg-card border-2 rounded-[1.5rem] p-5 sm:p-6 transition-all hover:shadow-lg ${
      goal.status === 'completed' ? 'border-green-200 bg-green-50/30' : 
      isOverdue ? 'border-red-200' : 'border-border hover:border-primary/30'
    }`}>
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        {/* Goal Info */}
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2 flex-wrap">
            <span className={`px-3 py-1 rounded-full text-xs font-bold border ${CATEGORY_COLORS[goal.category]}`}>
              {CATEGORY_ICONS[goal.category]} {goal.category.charAt(0).toUpperCase() + goal.category.slice(1)}
            </span>
            {goal.status === 'completed' && (
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700 border border-green-200">
                ✓ Completed
              </span>
            )}
            {isOverdue && goal.status !== 'completed' && (
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700 border border-red-200">
                ⚠️ Overdue
              </span>
            )}
            {isUrgent && !isOverdue && goal.status !== 'completed' && (
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-yellow-100 text-yellow-700 border border-yellow-200">
                ⏰ {daysRemaining} days left
              </span>
            )}
          </div>

          <h3 className="font-display text-lg sm:text-xl font-bold mb-1">{goal.title}</h3>
          {goal.description && (
            <p className="text-sm text-text-muted mb-3 line-clamp-2">{goal.description}</p>
          )}

          {/* Progress Display */}
          {goal.target_type === 'number' && goal.target_value && (
            <div className="mb-3">
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm font-semibold text-text-muted">
                  {goal.current_value} / {goal.target_value} {goal.unit || ''}
                </span>
                <span className="text-sm font-bold text-primary">{progress}%</span>
              </div>
              <ProgressBar percentage={progress} />
            </div>
          )}

          {goal.target_type === 'streak' && (
            <div className="flex items-center gap-2 mb-3">
              <span className="text-2xl">🔥</span>
              <span className="font-display text-2xl font-bold text-secondary">{goal.current_value}</span>
              <span className="text-sm text-text-muted">/ {goal.target_value} days</span>
            </div>
          )}

          {goal.deadline && (
            <p className="text-xs text-text-muted">
              📅 Due: {new Date(goal.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-wrap md:flex-nowrap">
          {goal.status === 'active' && goal.target_type !== 'completion' && (
            <>
              {showProgressInput ? (
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={progressInput}
                    onChange={(e) => setProgressInput(e.target.value)}
                    className="w-20 mb-0"
                  />
                  <Button size="sm" onClick={handleProgressSubmit}>✓</Button>
                  <Button size="sm" variant="ghost" onClick={() => setShowProgressInput(false)}>✕</Button>
                </div>
              ) : (
                <>
                  <Button size="sm" variant="outline" onClick={handleQuickIncrement} title="Quick +1">
                    +1
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => { setProgressInput(goal.current_value.toString()); setShowProgressInput(true); }}>
                    Update
                  </Button>
                </>
              )}
            </>
          )}

          {goal.status === 'active' && goal.target_type === 'completion' && (
            <Button size="sm" onClick={() => onUpdateProgress(1)}>
              ✓ Complete
            </Button>
          )}

          <Button size="sm" variant="ghost" onClick={onEdit}>✏️</Button>
          <Button size="sm" variant="ghost" onClick={onArchive}>
            {goal.status === 'archived' ? '📤' : '📥'}
          </Button>
          <Button size="sm" variant="ghost" onClick={onDelete}>🗑️</Button>
        </div>
      </div>
    </div>
  );
}
