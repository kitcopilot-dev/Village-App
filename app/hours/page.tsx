'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { getPocketBase } from '@/lib/pocketbase';
import { Child } from '@/lib/types';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { LoadingScreen } from '@/components/ui/Spinner';
import { ClientOnly } from '@/components/ui/ClientOnly';

// Hours entry type
interface HoursEntry {
  id: string;
  user: string;
  child: string;
  date: string;
  subject: string;
  duration_minutes: number;
  notes?: string;
  created: string;
  updated: string;
  expand?: {
    child?: Child;
  };
}

// Weekly goal type
interface WeeklyGoal {
  id: string;
  user: string;
  child?: string;
  target_hours: number;
  created: string;
  updated: string;
}

// Default subjects
const SUBJECTS = [
  'Math',
  'Reading',
  'Writing',
  'Science',
  'History',
  'Geography',
  'Art',
  'Music',
  'Physical Education',
  'Foreign Language',
  'Computer Science',
  'Life Skills',
  'Field Trip',
  'Library',
  'Other'
];

// Helper to get week bounds
function getWeekBounds(date: Date): { start: Date; end: Date } {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day; // Sunday start
  const start = new Date(d.setDate(diff));
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

// Helper to get month bounds
function getMonthBounds(date: Date): { start: Date; end: Date } {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
  return { start, end };
}

// Format minutes to hours and minutes
function formatDuration(minutes: number): string {
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hrs === 0) return `${mins}m`;
  if (mins === 0) return `${hrs}h`;
  return `${hrs}h ${mins}m`;
}

export default function HoursPage() {
  const router = useRouter();
  const pb = getPocketBase();
  
  const [kids, setKids] = useState<Child[]>([]);
  const [entries, setEntries] = useState<HoursEntry[]>([]);
  const [weeklyGoals, setWeeklyGoals] = useState<WeeklyGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [selectedChild, setSelectedChild] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'week' | 'month' | 'year'>('week');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [editingEntry, setEditingEntry] = useState<HoursEntry | null>(null);
  
  // Form state
  const [formChild, setFormChild] = useState('');
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0]);
  const [formSubject, setFormSubject] = useState('');
  const [formHours, setFormHours] = useState('');
  const [formMinutes, setFormMinutes] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formGoalHours, setFormGoalHours] = useState('20');
  const [formGoalChild, setFormGoalChild] = useState('');
  const [saving, setSaving] = useState(false);

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

      // Load children
      const childRecords = await pb.collection('children').getFullList({
        filter: `user = "${userId}"`,
        sort: 'name'
      });
      setKids(childRecords as unknown as Child[]);

      // Set default child for form
      if (childRecords.length > 0) {
        setFormChild(childRecords[0].id);
        setFormGoalChild(childRecords[0].id);
      }

      // Load hours entries
      try {
        const hourRecords = await pb.collection('hours_log').getFullList({
          filter: `user = "${userId}"`,
          sort: '-date',
          expand: 'child'
        });
        setEntries(hourRecords as unknown as HoursEntry[]);
      } catch (e) {
        console.warn('Hours log collection may not exist yet');
        setEntries([]);
      }

      // Load weekly goals
      try {
        const goalRecords = await pb.collection('weekly_goals').getFullList({
          filter: `user = "${userId}"`
        });
        setWeeklyGoals(goalRecords as unknown as WeeklyGoal[]);
      } catch (e) {
        console.warn('Weekly goals collection may not exist yet');
        setWeeklyGoals([]);
      }

    } catch (error) {
      console.error('Load error:', error);
    } finally {
      setLoading(false);
    }
  };

  // Calculate filtered entries based on date range and selected child
  const filteredEntries = useMemo(() => {
    let bounds: { start: Date; end: Date };
    
    if (viewMode === 'week') {
      bounds = getWeekBounds(currentDate);
    } else if (viewMode === 'month') {
      bounds = getMonthBounds(currentDate);
    } else {
      // Year
      bounds = {
        start: new Date(currentDate.getFullYear(), 0, 1),
        end: new Date(currentDate.getFullYear(), 11, 31, 23, 59, 59, 999)
      };
    }

    return entries.filter(entry => {
      const entryDate = new Date(entry.date);
      const inRange = entryDate >= bounds.start && entryDate <= bounds.end;
      const matchesChild = selectedChild === 'all' || entry.child === selectedChild;
      return inRange && matchesChild;
    });
  }, [entries, currentDate, viewMode, selectedChild]);

  // Calculate statistics
  const stats = useMemo(() => {
    const totalMinutes = filteredEntries.reduce((sum, e) => sum + e.duration_minutes, 0);
    
    // Group by subject
    const bySubject: Record<string, number> = {};
    filteredEntries.forEach(e => {
      bySubject[e.subject] = (bySubject[e.subject] || 0) + e.duration_minutes;
    });
    
    // Group by child
    const byChild: Record<string, number> = {};
    filteredEntries.forEach(e => {
      byChild[e.child] = (byChild[e.child] || 0) + e.duration_minutes;
    });
    
    // Group by day (for this week)
    const byDay: Record<string, number> = {};
    filteredEntries.forEach(e => {
      const dayKey = e.date;
      byDay[dayKey] = (byDay[dayKey] || 0) + e.duration_minutes;
    });

    // Get weekly goal
    const relevantGoal = weeklyGoals.find(g => 
      !g.child || selectedChild === 'all' || g.child === selectedChild
    );
    const weeklyTarget = relevantGoal?.target_hours || 20;
    const weeklyProgress = viewMode === 'week' 
      ? Math.min(100, (totalMinutes / 60 / weeklyTarget) * 100)
      : 0;

    return { 
      totalMinutes, 
      bySubject, 
      byChild, 
      byDay,
      weeklyTarget,
      weeklyProgress
    };
  }, [filteredEntries, weeklyGoals, selectedChild, viewMode]);

  const handleLogout = () => {
    pb.authStore.clear();
    router.push('/');
  };

  const navigatePeriod = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    if (viewMode === 'week') {
      newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7));
    } else if (viewMode === 'month') {
      newDate.setMonth(newDate.getMonth() + (direction === 'next' ? 1 : -1));
    } else {
      newDate.setFullYear(newDate.getFullYear() + (direction === 'next' ? 1 : -1));
    }
    setCurrentDate(newDate);
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const getPeriodLabel = (): string => {
    if (viewMode === 'week') {
      const { start, end } = getWeekBounds(currentDate);
      return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    } else if (viewMode === 'month') {
      return currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    } else {
      return currentDate.getFullYear().toString();
    }
  };

  const handleSaveEntry = async () => {
    if (!formChild || !formSubject || (!formHours && !formMinutes)) return;
    
    setSaving(true);
    try {
      const userId = pb.authStore.model?.id;
      const totalMinutes = (parseInt(formHours || '0') * 60) + parseInt(formMinutes || '0');
      
      const data = {
        user: userId,
        child: formChild,
        date: formDate,
        subject: formSubject,
        duration_minutes: totalMinutes,
        notes: formNotes || undefined
      };

      if (editingEntry) {
        await pb.collection('hours_log').update(editingEntry.id, data);
      } else {
        await pb.collection('hours_log').create(data);
      }
      
      setShowAddModal(false);
      setEditingEntry(null);
      resetForm();
      await loadData();
    } catch (error) {
      console.error('Save error:', error);
      alert('Failed to save entry. Make sure the hours_log collection exists in PocketBase.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteEntry = async (entryId: string) => {
    if (!confirm('Delete this time entry?')) return;
    
    try {
      await pb.collection('hours_log').delete(entryId);
      await loadData();
    } catch (error) {
      console.error('Delete error:', error);
    }
  };

  const handleSaveGoal = async () => {
    const targetHours = parseFloat(formGoalHours);
    if (isNaN(targetHours) || targetHours <= 0) return;
    
    setSaving(true);
    try {
      const userId = pb.authStore.model?.id;
      
      // Check if goal already exists for this child
      const existingGoal = weeklyGoals.find(g => 
        (formGoalChild ? g.child === formGoalChild : !g.child)
      );

      const data = {
        user: userId,
        child: formGoalChild || undefined,
        target_hours: targetHours
      };

      if (existingGoal) {
        await pb.collection('weekly_goals').update(existingGoal.id, data);
      } else {
        await pb.collection('weekly_goals').create(data);
      }
      
      setShowGoalModal(false);
      await loadData();
    } catch (error) {
      console.error('Save goal error:', error);
      alert('Failed to save goal. Make sure the weekly_goals collection exists in PocketBase.');
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setFormDate(new Date().toISOString().split('T')[0]);
    setFormSubject('');
    setFormHours('');
    setFormMinutes('');
    setFormNotes('');
    if (kids.length > 0) {
      setFormChild(kids[0].id);
    }
  };

  const openEditModal = (entry: HoursEntry) => {
    setEditingEntry(entry);
    setFormChild(entry.child);
    setFormDate(entry.date);
    setFormSubject(entry.subject);
    setFormHours(Math.floor(entry.duration_minutes / 60).toString());
    setFormMinutes((entry.duration_minutes % 60).toString());
    setFormNotes(entry.notes || '');
    setShowAddModal(true);
  };

  const getKidName = (kidId: string): string => {
    return kids.find(k => k.id === kidId)?.name || 'Unknown';
  };

  // Sort subjects by total time
  const sortedSubjects = useMemo(() => {
    return Object.entries(stats.bySubject)
      .sort((a, b) => b[1] - a[1]);
  }, [stats.bySubject]);

  // Get color for subject (consistent hashing)
  const getSubjectColor = (subject: string): string => {
    const colors = [
      'bg-primary/20 text-primary-dark',
      'bg-secondary/20 text-secondary-hover',
      'bg-accent/20 text-accent',
      'bg-blue-100 text-blue-700',
      'bg-purple-100 text-purple-700',
      'bg-pink-100 text-pink-700',
      'bg-green-100 text-green-700',
      'bg-orange-100 text-orange-700',
      'bg-teal-100 text-teal-700',
      'bg-indigo-100 text-indigo-700'
    ];
    const hash = subject.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
    return colors[hash % colors.length];
  };

  if (loading) {
    return (
      <ClientOnly>
        <LoadingScreen />
      </ClientOnly>
    );
  }

  return (
    <ClientOnly>
      <div className="min-h-screen bg-bg">
        <Header onLogout={handleLogout} showLogout={true} />
        
        <main className="max-w-7xl mx-auto px-4 md:px-8 py-8">
          {/* Page Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
            <div>
              <h1 className="font-display text-3xl md:text-4xl font-bold text-text">
                ⏱️ Hours Tracker
              </h1>
              <p className="text-text-muted mt-1">
                Track educational hours for compliance and insights
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowGoalModal(true)}>
                🎯 Set Goal
              </Button>
              <Button onClick={() => { resetForm(); setEditingEntry(null); setShowAddModal(true); }}>
                + Log Time
              </Button>
            </div>
          </div>

          {/* Controls Row */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            {/* Child Filter */}
            <div className="flex-1">
              <label className="block text-sm font-medium text-text-muted mb-1">Filter by Child</label>
              <select
                value={selectedChild}
                onChange={(e) => setSelectedChild(e.target.value)}
                className="w-full px-4 py-2 rounded-xl border border-border bg-card focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="all">All Children</option>
                {kids.map(kid => (
                  <option key={kid.id} value={kid.id}>{kid.name}</option>
                ))}
              </select>
            </div>
            
            {/* View Mode */}
            <div className="flex-1">
              <label className="block text-sm font-medium text-text-muted mb-1">View</label>
              <div className="flex rounded-xl overflow-hidden border border-border">
                {(['week', 'month', 'year'] as const).map(mode => (
                  <button
                    key={mode}
                    onClick={() => setViewMode(mode)}
                    className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
                      viewMode === mode
                        ? 'bg-primary text-white'
                        : 'bg-card hover:bg-bg-alt text-text'
                    }`}
                  >
                    {mode.charAt(0).toUpperCase() + mode.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Date Navigation */}
          <div className="flex items-center justify-center gap-4 mb-8">
            <Button variant="outline" size="sm" onClick={() => navigatePeriod('prev')}>
              ← Prev
            </Button>
            <button
              onClick={goToToday}
              className="text-lg font-semibold text-text hover:text-primary transition-colors"
            >
              {getPeriodLabel()}
            </button>
            <Button variant="outline" size="sm" onClick={() => navigatePeriod('next')}>
              Next →
            </Button>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            {/* Total Hours */}
            <Card className="p-6 text-center">
              <div className="text-4xl font-bold text-primary mb-2">
                {formatDuration(stats.totalMinutes)}
              </div>
              <div className="text-text-muted">
                Total {viewMode === 'week' ? 'This Week' : viewMode === 'month' ? 'This Month' : 'This Year'}
              </div>
            </Card>

            {/* Weekly Progress (only show in week view) */}
            {viewMode === 'week' && (
              <Card className="p-6">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-text-muted">Weekly Goal</span>
                  <span className="font-semibold text-primary">{stats.weeklyTarget}h</span>
                </div>
                <div className="h-4 bg-bg-alt rounded-full overflow-hidden mb-2">
                  <div 
                    className="h-full bg-gradient-to-r from-primary to-primary-light transition-all duration-500"
                    style={{ width: `${stats.weeklyProgress}%` }}
                  />
                </div>
                <div className="text-sm text-text-muted text-center">
                  {Math.round(stats.weeklyProgress)}% complete • {formatDuration(stats.totalMinutes)} / {stats.weeklyTarget}h
                </div>
              </Card>
            )}

            {/* Entries Count */}
            <Card className="p-6 text-center">
              <div className="text-4xl font-bold text-secondary mb-2">
                {filteredEntries.length}
              </div>
              <div className="text-text-muted">
                Sessions Logged
              </div>
            </Card>

            {/* If not week view, show average */}
            {viewMode !== 'week' && (
              <Card className="p-6 text-center">
                <div className="text-4xl font-bold text-accent mb-2">
                  {Object.keys(stats.bySubject).length}
                </div>
                <div className="text-text-muted">
                  Subjects Covered
                </div>
              </Card>
            )}
          </div>

          {/* Subject Breakdown */}
          {sortedSubjects.length > 0 && (
            <Card className="p-6 mb-8">
              <h2 className="font-display text-xl font-bold text-text mb-4">📚 Time by Subject</h2>
              <div className="space-y-3">
                {sortedSubjects.map(([subject, minutes]) => {
                  const percentage = (minutes / stats.totalMinutes) * 100;
                  return (
                    <div key={subject}>
                      <div className="flex justify-between items-center mb-1">
                        <span className={`px-2 py-1 rounded-lg text-sm font-medium ${getSubjectColor(subject)}`}>
                          {subject}
                        </span>
                        <span className="text-text-muted text-sm">
                          {formatDuration(minutes)} ({Math.round(percentage)}%)
                        </span>
                      </div>
                      <div className="h-2 bg-bg-alt rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-primary/50 transition-all duration-500"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {/* Child Breakdown (if viewing all children) */}
          {selectedChild === 'all' && Object.keys(stats.byChild).length > 1 && (
            <Card className="p-6 mb-8">
              <h2 className="font-display text-xl font-bold text-text mb-4">👨‍👩‍👧‍👦 Time by Child</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {Object.entries(stats.byChild).map(([childId, minutes]) => (
                  <div 
                    key={childId}
                    className="text-center p-4 bg-bg-alt rounded-xl"
                  >
                    <div className="text-2xl font-bold text-primary">
                      {formatDuration(minutes)}
                    </div>
                    <div className="text-sm text-text-muted">
                      {getKidName(childId)}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Recent Entries */}
          <Card className="p-6">
            <h2 className="font-display text-xl font-bold text-text mb-4">📝 Time Entries</h2>
            
            {filteredEntries.length === 0 ? (
              <div className="text-center py-12 text-text-muted">
                <div className="text-4xl mb-4">⏱️</div>
                <p className="mb-4">No time logged for this period</p>
                <Button onClick={() => { resetForm(); setEditingEntry(null); setShowAddModal(true); }}>
                  Log Your First Entry
                </Button>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {filteredEntries.map(entry => (
                  <div 
                    key={entry.id}
                    className="py-4 flex items-center justify-between hover:bg-bg-alt/50 -mx-2 px-2 rounded-lg transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="text-center">
                        <div className="text-sm text-text-muted">
                          {new Date(entry.date).toLocaleDateString('en-US', { weekday: 'short' })}
                        </div>
                        <div className="font-bold text-text">
                          {new Date(entry.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </div>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-1 rounded-lg text-xs font-medium ${getSubjectColor(entry.subject)}`}>
                            {entry.subject}
                          </span>
                          <span className="font-semibold text-primary">
                            {formatDuration(entry.duration_minutes)}
                          </span>
                        </div>
                        <div className="text-sm text-text-muted mt-1">
                          {getKidName(entry.child)}
                          {entry.notes && <span> • {entry.notes}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => openEditModal(entry)}
                        className="p-2 text-text-muted hover:text-primary transition-colors"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => handleDeleteEntry(entry.id)}
                        className="p-2 text-text-muted hover:text-red-500 transition-colors"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Print Summary Button */}
          <div className="mt-8 text-center">
            <Button 
              variant="outline"
              onClick={() => window.print()}
            >
              🖨️ Print Summary
            </Button>
          </div>
        </main>

        {/* Add/Edit Entry Modal */}
        <Modal
          isOpen={showAddModal}
          onClose={() => { setShowAddModal(false); setEditingEntry(null); }}
          title={editingEntry ? 'Edit Time Entry' : 'Log Time'}
        >
          <div className="space-y-4">
            {/* Child */}
            <div>
              <label className="block text-sm font-medium text-text mb-1">Child</label>
              <select
                value={formChild}
                onChange={(e) => setFormChild(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-border bg-card focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                {kids.map(kid => (
                  <option key={kid.id} value={kid.id}>{kid.name}</option>
                ))}
              </select>
            </div>

            {/* Date */}
            <div>
              <label className="block text-sm font-medium text-text mb-1">Date</label>
              <Input
                type="date"
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
              />
            </div>

            {/* Subject */}
            <div>
              <label className="block text-sm font-medium text-text mb-1">Subject</label>
              <select
                value={formSubject}
                onChange={(e) => setFormSubject(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-border bg-card focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="">Select subject...</option>
                {SUBJECTS.map(subject => (
                  <option key={subject} value={subject}>{subject}</option>
                ))}
              </select>
            </div>

            {/* Duration */}
            <div>
              <label className="block text-sm font-medium text-text mb-1">Duration</label>
              <div className="flex gap-2">
                <div className="flex-1">
                  <div className="relative">
                    <Input
                      type="number"
                      min="0"
                      placeholder="0"
                      value={formHours}
                      onChange={(e) => setFormHours(e.target.value)}
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-text-muted text-sm">
                      hours
                    </span>
                  </div>
                </div>
                <div className="flex-1">
                  <div className="relative">
                    <Input
                      type="number"
                      min="0"
                      max="59"
                      placeholder="0"
                      value={formMinutes}
                      onChange={(e) => setFormMinutes(e.target.value)}
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-text-muted text-sm">
                      min
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-text mb-1">Notes (optional)</label>
              <Textarea
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                placeholder="What did you work on?"
                rows={2}
              />
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-4">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => { setShowAddModal(false); setEditingEntry(null); }}
              >
                Cancel
              </Button>
              <Button
                className="flex-1"
                onClick={handleSaveEntry}
                disabled={saving || !formChild || !formSubject || (!formHours && !formMinutes)}
              >
                {saving ? 'Saving...' : editingEntry ? 'Update' : 'Log Time'}
              </Button>
            </div>
          </div>
        </Modal>

        {/* Goal Setting Modal */}
        <Modal
          isOpen={showGoalModal}
          onClose={() => setShowGoalModal(false)}
          title="Set Weekly Goal"
        >
          <div className="space-y-4">
            <p className="text-text-muted text-sm">
              Set a weekly hours target to track your progress. Common targets:
            </p>
            <div className="flex gap-2 flex-wrap">
              {[10, 15, 20, 25, 30].map(hrs => (
                <button
                  key={hrs}
                  onClick={() => setFormGoalHours(hrs.toString())}
                  className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                    formGoalHours === hrs.toString()
                      ? 'bg-primary text-white'
                      : 'bg-bg-alt text-text hover:bg-primary/10'
                  }`}
                >
                  {hrs}h/week
                </button>
              ))}
            </div>

            {/* Child-specific goal (optional) */}
            <div>
              <label className="block text-sm font-medium text-text mb-1">
                For Child (optional)
              </label>
              <select
                value={formGoalChild}
                onChange={(e) => setFormGoalChild(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-border bg-card focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="">Family-wide goal</option>
                {kids.map(kid => (
                  <option key={kid.id} value={kid.id}>{kid.name}</option>
                ))}
              </select>
            </div>

            {/* Custom hours */}
            <div>
              <label className="block text-sm font-medium text-text mb-1">Target Hours per Week</label>
              <Input
                type="number"
                min="1"
                value={formGoalHours}
                onChange={(e) => setFormGoalHours(e.target.value)}
              />
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-4">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setShowGoalModal(false)}
              >
                Cancel
              </Button>
              <Button
                className="flex-1"
                onClick={handleSaveGoal}
                disabled={saving || !formGoalHours}
              >
                {saving ? 'Saving...' : 'Save Goal'}
              </Button>
            </div>
          </div>
        </Modal>
      </div>

      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          header, button, .no-print {
            display: none !important;
          }
          body {
            background: white !important;
          }
        }
      `}</style>
    </ClientOnly>
  );
}
