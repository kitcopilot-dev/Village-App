'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { getPocketBase } from '@/lib/pocketbase';
import { Child, DailyLogEntry } from '@/lib/types';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ClientOnly } from '@/components/ui/ClientOnly';

// Common subjects with emoji shortcuts
const SUBJECTS = [
  { name: 'Math', emoji: '🔢', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { name: 'Reading', emoji: '📖', color: 'bg-purple-100 text-purple-700 border-purple-200' },
  { name: 'Writing', emoji: '✏️', color: 'bg-pink-100 text-pink-700 border-pink-200' },
  { name: 'Science', emoji: '🔬', color: 'bg-green-100 text-green-700 border-green-200' },
  { name: 'History', emoji: '🏛️', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  { name: 'Geography', emoji: '🌍', color: 'bg-teal-100 text-teal-700 border-teal-200' },
  { name: 'Art', emoji: '🎨', color: 'bg-rose-100 text-rose-700 border-rose-200' },
  { name: 'Music', emoji: '🎵', color: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
  { name: 'PE', emoji: '⚽', color: 'bg-orange-100 text-orange-700 border-orange-200' },
  { name: 'Language', emoji: '🗣️', color: 'bg-cyan-100 text-cyan-700 border-cyan-200' },
  { name: 'Life Skills', emoji: '🏠', color: 'bg-slate-100 text-slate-700 border-slate-200' },
  { name: 'Field Trip', emoji: '🚌', color: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  { name: 'Other', emoji: '📝', color: 'bg-gray-100 text-gray-700 border-gray-200' },
];

const MOODS = [
  { value: 'great', label: 'Great!', emoji: '🌟' },
  { value: 'good', label: 'Good', emoji: '😊' },
  { value: 'okay', label: 'Okay', emoji: '😐' },
  { value: 'struggling', label: 'Struggling', emoji: '😓' },
];

// Helper to get subject color class
const getSubjectStyle = (subject: string) => {
  const found = SUBJECTS.find(s => s.name.toLowerCase() === subject?.toLowerCase());
  return found?.color || 'bg-gray-100 text-gray-700 border-gray-200';
};

const getSubjectEmoji = (subject: string) => {
  const found = SUBJECTS.find(s => s.name.toLowerCase() === subject?.toLowerCase());
  return found?.emoji || '📝';
};

// Format date for display
const formatDate = (dateStr: string) => {
  const date = new Date(dateStr + 'T12:00:00');
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
};

// Get today's date in YYYY-MM-DD format
const getTodayStr = () => {
  const now = new Date();
  return now.toISOString().split('T')[0];
};

// Get relative date label
const getRelativeDate = (dateStr: string) => {
  const today = getTodayStr();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  if (dateStr === today) return 'Today';
  if (dateStr === yesterdayStr) return 'Yesterday';
  return formatDate(dateStr);
};

export default function DailyLogPage() {
  const router = useRouter();
  const pb = getPocketBase();

  const [kids, setKids] = useState<Child[]>([]);
  const [entries, setEntries] = useState<DailyLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedDate, setSelectedDate] = useState(getTodayStr());
  const [viewMode, setViewMode] = useState<'day' | 'week' | 'month'>('day');

  // Form state for new entry
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    child: '',
    subject: '',
    activity: '',
    notes: '',
    duration_minutes: '',
    mood: '' as '' | 'great' | 'good' | 'okay' | 'struggling',
  });

  useEffect(() => {
    if (!pb.authStore.isValid) {
      router.push('/');
      return;
    }
    loadData();
  }, []);

  useEffect(() => {
    if (pb.authStore.isValid) {
      loadEntries();
    }
  }, [selectedDate, viewMode]);

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

      // Load entries
      await loadEntries();
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadEntries = async () => {
    try {
      const userId = pb.authStore.model?.id;
      if (!userId) return;

      let dateFilter = '';
      if (viewMode === 'day') {
        dateFilter = `date = "${selectedDate}"`;
      } else if (viewMode === 'week') {
        const startDate = new Date(selectedDate);
        startDate.setDate(startDate.getDate() - startDate.getDay()); // Start of week (Sunday)
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 6);
        dateFilter = `date >= "${startDate.toISOString().split('T')[0]}" && date <= "${endDate.toISOString().split('T')[0]}"`;
      } else {
        const startDate = new Date(selectedDate);
        startDate.setDate(1); // Start of month
        const endDate = new Date(startDate);
        endDate.setMonth(endDate.getMonth() + 1);
        endDate.setDate(0); // End of month
        dateFilter = `date >= "${startDate.toISOString().split('T')[0]}" && date <= "${endDate.toISOString().split('T')[0]}"`;
      }

      const entryRecords = await pb.collection('daily_logs').getFullList({
        filter: `user = "${userId}" && ${dateFilter}`,
        sort: '-date,-created'
      });
      setEntries(entryRecords as unknown as DailyLogEntry[]);
    } catch (error) {
      console.error('Failed to load entries:', error);
      setEntries([]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const userId = pb.authStore.model?.id;
      if (!userId) return;

      const data = {
        user: userId,
        child: formData.child || null,
        date: selectedDate,
        subject: formData.subject,
        activity: formData.activity,
        notes: formData.notes || null,
        duration_minutes: formData.duration_minutes ? parseInt(formData.duration_minutes) : null,
        mood: formData.mood || null,
      };

      if (editingId) {
        await pb.collection('daily_logs').update(editingId, data);
      } else {
        await pb.collection('daily_logs').create(data);
      }

      // Reset form and reload
      setFormData({ child: '', subject: '', activity: '', notes: '', duration_minutes: '', mood: '' });
      setShowForm(false);
      setEditingId(null);
      await loadEntries();
    } catch (error) {
      console.error('Failed to save entry:', error);
      alert('Failed to save entry. Make sure the daily_logs collection exists in PocketBase.');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (entry: DailyLogEntry) => {
    setFormData({
      child: entry.child || '',
      subject: entry.subject || '',
      activity: entry.activity,
      notes: entry.notes || '',
      duration_minutes: entry.duration_minutes?.toString() || '',
      mood: entry.mood || '',
    });
    setEditingId(entry.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this entry?')) return;
    
    try {
      await pb.collection('daily_logs').delete(id);
      await loadEntries();
    } catch (error) {
      console.error('Failed to delete entry:', error);
    }
  };

  const handleQuickAdd = (subject: string) => {
    setFormData({ ...formData, subject });
    setShowForm(true);
  };

  const handleLogout = () => {
    pb.authStore.clear();
    router.push('/');
  };

  // Group entries by date for week/month view
  const entriesByDate = useMemo(() => {
    const grouped: Record<string, DailyLogEntry[]> = {};
    entries.forEach(entry => {
      if (!grouped[entry.date]) grouped[entry.date] = [];
      grouped[entry.date].push(entry);
    });
    return grouped;
  }, [entries]);

  // Stats for current view
  const stats = useMemo(() => {
    const totalMinutes = entries.reduce((sum, e) => sum + (e.duration_minutes || 0), 0);
    const subjectCounts: Record<string, number> = {};
    entries.forEach(e => {
      const subject = e.subject || 'Other';
      subjectCounts[subject] = (subjectCounts[subject] || 0) + 1;
    });
    const topSubject = Object.entries(subjectCounts).sort((a, b) => b[1] - a[1])[0];
    
    return {
      totalEntries: entries.length,
      totalMinutes,
      hours: Math.floor(totalMinutes / 60),
      minutes: totalMinutes % 60,
      topSubject: topSubject ? topSubject[0] : null,
      uniqueDays: Object.keys(entriesByDate).length,
    };
  }, [entries, entriesByDate]);

  // Mini calendar for month view
  const calendarDays = useMemo(() => {
    const date = new Date(selectedDate);
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const days: { date: string; hasEntries: boolean; isSelected: boolean; isToday: boolean }[] = [];
    
    // Add padding for start of week
    for (let i = 0; i < firstDay.getDay(); i++) {
      days.push({ date: '', hasEntries: false, isSelected: false, isToday: false });
    }
    
    const today = getTodayStr();
    for (let d = 1; d <= lastDay.getDate(); d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      days.push({
        date: dateStr,
        hasEntries: !!entriesByDate[dateStr],
        isSelected: dateStr === selectedDate,
        isToday: dateStr === today,
      });
    }
    
    return days;
  }, [selectedDate, entriesByDate]);

  if (loading) {
    return (
      <>
        <Header showLogout onLogout={handleLogout} />
        <main className="max-w-4xl mx-auto my-12 px-8">
          <p className="text-center text-text-muted">Loading...</p>
        </main>
      </>
    );
  }

  return (
    <>
      <Header showLogout onLogout={handleLogout} />
      <ClientOnly>
        <main className="max-w-5xl mx-auto my-8 px-4 sm:px-8 pb-20 animate-fade-in">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-8">
            <div>
              <h2 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight mb-1">📝 Daily Log</h2>
              <p className="text-text-muted">Quick journaling for your homeschool day</p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button variant="ghost" size="sm" onClick={() => router.push('/dashboard')}>
                ← Dashboard
              </Button>
            </div>
          </div>

          {/* Date Navigation & View Toggle */}
          <Card className="mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const d = new Date(selectedDate);
                    d.setDate(d.getDate() - (viewMode === 'day' ? 1 : viewMode === 'week' ? 7 : 30));
                    setSelectedDate(d.toISOString().split('T')[0]);
                  }}
                  className="p-2 rounded-lg hover:bg-bg-alt transition-colors"
                >
                  ◀️
                </button>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="px-4 py-2 rounded-lg border-2 border-border bg-bg focus:border-primary focus:outline-none font-semibold"
                />
                <button
                  onClick={() => {
                    const d = new Date(selectedDate);
                    d.setDate(d.getDate() + (viewMode === 'day' ? 1 : viewMode === 'week' ? 7 : 30));
                    setSelectedDate(d.toISOString().split('T')[0]);
                  }}
                  className="p-2 rounded-lg hover:bg-bg-alt transition-colors"
                >
                  ▶️
                </button>
                <Button variant="ghost" size="sm" onClick={() => setSelectedDate(getTodayStr())}>
                  Today
                </Button>
              </div>

              <div className="flex gap-1 bg-bg-alt p-1 rounded-lg">
                {(['day', 'week', 'month'] as const).map(mode => (
                  <button
                    key={mode}
                    onClick={() => setViewMode(mode)}
                    className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-all ${
                      viewMode === mode
                        ? 'bg-primary text-white shadow-sm'
                        : 'text-text-muted hover:text-text'
                    }`}
                  >
                    {mode.charAt(0).toUpperCase() + mode.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </Card>

          <div className="grid lg:grid-cols-3 gap-6">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-6">
              {/* Quick Add Buttons */}
              {viewMode === 'day' && (
                <Card>
                  <h3 className="font-display font-bold text-lg mb-4">Quick Add</h3>
                  <div className="flex flex-wrap gap-2">
                    {SUBJECTS.map(subject => (
                      <button
                        key={subject.name}
                        onClick={() => handleQuickAdd(subject.name)}
                        className={`px-3 py-1.5 rounded-full text-sm font-semibold border transition-all hover:scale-105 ${subject.color}`}
                      >
                        {subject.emoji} {subject.name}
                      </button>
                    ))}
                  </div>
                </Card>
              )}

              {/* Entry Form */}
              {showForm && (
                <Card className="border-2 border-primary">
                  <h3 className="font-display font-bold text-lg mb-4">
                    {editingId ? '✏️ Edit Entry' : '➕ New Entry'} — {getRelativeDate(selectedDate)}
                  </h3>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold mb-1">Child (optional)</label>
                        <select
                          value={formData.child}
                          onChange={(e) => setFormData({ ...formData, child: e.target.value })}
                          className="w-full px-4 py-2 rounded-lg border-2 border-border bg-bg focus:border-primary focus:outline-none"
                        >
                          <option value="">All / Family</option>
                          {kids.map(kid => (
                            <option key={kid.id} value={kid.id}>{kid.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold mb-1">Subject</label>
                        <select
                          value={formData.subject}
                          onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                          className="w-full px-4 py-2 rounded-lg border-2 border-border bg-bg focus:border-primary focus:outline-none"
                          required
                        >
                          <option value="">Select subject...</option>
                          {SUBJECTS.map(s => (
                            <option key={s.name} value={s.name}>{s.emoji} {s.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold mb-1">Activity / What was done *</label>
                      <input
                        type="text"
                        value={formData.activity}
                        onChange={(e) => setFormData({ ...formData, activity: e.target.value })}
                        placeholder="e.g., Completed Chapter 5, practiced multiplication tables"
                        className="w-full px-4 py-2 rounded-lg border-2 border-border bg-bg focus:border-primary focus:outline-none"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold mb-1">Notes / Observations (optional)</label>
                      <textarea
                        value={formData.notes}
                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                        placeholder="How did it go? Any highlights or struggles?"
                        rows={3}
                        className="w-full px-4 py-2 rounded-lg border-2 border-border bg-bg focus:border-primary focus:outline-none resize-none"
                      />
                    </div>

                    <div className="grid sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold mb-1">Time Spent (minutes)</label>
                        <input
                          type="number"
                          min="1"
                          max="480"
                          value={formData.duration_minutes}
                          onChange={(e) => setFormData({ ...formData, duration_minutes: e.target.value })}
                          placeholder="30"
                          className="w-full px-4 py-2 rounded-lg border-2 border-border bg-bg focus:border-primary focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold mb-1">How did it go?</label>
                        <div className="flex gap-2">
                          {MOODS.map(mood => (
                            <button
                              key={mood.value}
                              type="button"
                              onClick={() => setFormData({ ...formData, mood: formData.mood === mood.value ? '' : mood.value as any })}
                              className={`flex-1 py-2 rounded-lg text-xl transition-all ${
                                formData.mood === mood.value
                                  ? 'bg-primary text-white scale-110'
                                  : 'bg-bg-alt hover:bg-border'
                              }`}
                              title={mood.label}
                            >
                              {mood.emoji}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2 pt-2">
                      <Button type="submit" disabled={saving}>
                        {saving ? 'Saving...' : editingId ? 'Update Entry' : 'Add Entry'}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => {
                          setShowForm(false);
                          setEditingId(null);
                          setFormData({ child: '', subject: '', activity: '', notes: '', duration_minutes: '', mood: '' });
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </form>
                </Card>
              )}

              {/* Entries List */}
              <Card>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-display font-bold text-lg">
                    {viewMode === 'day' ? getRelativeDate(selectedDate) : viewMode === 'week' ? 'This Week' : 'This Month'}
                  </h3>
                  {!showForm && viewMode === 'day' && (
                    <Button size="sm" onClick={() => setShowForm(true)}>+ Add Entry</Button>
                  )}
                </div>

                {entries.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-4xl mb-4">📓</p>
                    <p className="text-text-muted mb-4">No entries for this {viewMode}.</p>
                    {viewMode === 'day' && (
                      <Button onClick={() => setShowForm(true)}>Log Your First Activity</Button>
                    )}
                  </div>
                ) : viewMode === 'day' ? (
                  <div className="space-y-3">
                    {entries.map(entry => {
                      const kid = kids.find(k => k.id === entry.child);
                      return (
                        <div
                          key={entry.id}
                          className="p-4 bg-bg-alt rounded-xl hover:bg-border transition-colors group"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap mb-1">
                                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${getSubjectStyle(entry.subject || '')}`}>
                                  {getSubjectEmoji(entry.subject || '')} {entry.subject || 'General'}
                                </span>
                                {kid && (
                                  <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary">
                                    {kid.name}
                                  </span>
                                )}
                                {entry.duration_minutes && (
                                  <span className="text-xs text-text-muted">
                                    ⏱️ {entry.duration_minutes}m
                                  </span>
                                )}
                                {entry.mood && (
                                  <span className="text-sm">
                                    {MOODS.find(m => m.value === entry.mood)?.emoji}
                                  </span>
                                )}
                              </div>
                              <p className="font-semibold text-sm mb-1">{entry.activity}</p>
                              {entry.notes && (
                                <p className="text-sm text-text-muted">{entry.notes}</p>
                              )}
                            </div>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => handleEdit(entry)}
                                className="p-1.5 rounded hover:bg-white transition-colors"
                                title="Edit"
                              >
                                ✏️
                              </button>
                              <button
                                onClick={() => handleDelete(entry.id)}
                                className="p-1.5 rounded hover:bg-white transition-colors"
                                title="Delete"
                              >
                                🗑️
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  // Week/Month view - grouped by date
                  <div className="space-y-6">
                    {Object.entries(entriesByDate)
                      .sort((a, b) => b[0].localeCompare(a[0]))
                      .map(([date, dateEntries]) => (
                        <div key={date}>
                          <h4 className="font-semibold text-sm text-text-muted mb-2 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-primary" />
                            {getRelativeDate(date)}
                            <span className="text-xs">({dateEntries.length} {dateEntries.length === 1 ? 'entry' : 'entries'})</span>
                          </h4>
                          <div className="space-y-2 pl-4 border-l-2 border-border">
                            {dateEntries.map(entry => {
                              const kid = kids.find(k => k.id === entry.child);
                              return (
                                <div key={entry.id} className="flex items-center gap-2 text-sm">
                                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${getSubjectStyle(entry.subject || '')}`}>
                                    {getSubjectEmoji(entry.subject || '')}
                                  </span>
                                  {kid && <span className="text-primary font-semibold">{kid.name}:</span>}
                                  <span>{entry.activity}</span>
                                  {entry.duration_minutes && (
                                    <span className="text-text-muted text-xs">({entry.duration_minutes}m)</span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </Card>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Stats */}
              <Card>
                <h3 className="font-display font-bold text-lg mb-4">📊 Summary</h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-text-muted">Entries</span>
                    <span className="font-bold text-lg">{stats.totalEntries}</span>
                  </div>
                  {viewMode !== 'day' && (
                    <div className="flex justify-between items-center">
                      <span className="text-text-muted">Days Logged</span>
                      <span className="font-bold text-lg">{stats.uniqueDays}</span>
                    </div>
                  )}
                  {stats.totalMinutes > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-text-muted">Total Time</span>
                      <span className="font-bold text-lg">
                        {stats.hours > 0 ? `${stats.hours}h ` : ''}{stats.minutes}m
                      </span>
                    </div>
                  )}
                  {stats.topSubject && (
                    <div className="flex justify-between items-center">
                      <span className="text-text-muted">Top Subject</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${getSubjectStyle(stats.topSubject)}`}>
                        {getSubjectEmoji(stats.topSubject)} {stats.topSubject}
                      </span>
                    </div>
                  )}
                </div>
              </Card>

              {/* Mini Calendar */}
              <Card>
                <h3 className="font-display font-bold text-lg mb-4">📅 Calendar</h3>
                <div className="text-center mb-3">
                  <span className="font-semibold">
                    {new Date(selectedDate).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                  </span>
                </div>
                <div className="grid grid-cols-7 gap-1 text-center text-xs">
                  {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                    <div key={i} className="font-semibold text-text-muted py-1">{d}</div>
                  ))}
                  {calendarDays.map((day, i) => (
                    <button
                      key={i}
                      disabled={!day.date}
                      onClick={() => day.date && setSelectedDate(day.date)}
                      className={`
                        aspect-square rounded-lg text-sm font-semibold transition-all
                        ${!day.date ? 'invisible' : ''}
                        ${day.isSelected ? 'bg-primary text-white' : ''}
                        ${day.isToday && !day.isSelected ? 'ring-2 ring-primary' : ''}
                        ${day.hasEntries && !day.isSelected ? 'bg-primary/20 text-primary' : ''}
                        ${!day.isSelected && !day.hasEntries && day.date ? 'hover:bg-bg-alt' : ''}
                      `}
                    >
                      {day.date ? parseInt(day.date.split('-')[2]) : ''}
                    </button>
                  ))}
                </div>
                <div className="mt-3 pt-3 border-t border-border">
                  <div className="flex items-center gap-4 text-xs text-text-muted justify-center">
                    <span className="flex items-center gap-1">
                      <span className="w-3 h-3 rounded bg-primary/20" /> Has entries
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-3 h-3 rounded ring-2 ring-primary" /> Today
                    </span>
                  </div>
                </div>
              </Card>

              {/* Quick Tips */}
              <Card className="bg-primary/5 border-primary/20">
                <h3 className="font-display font-bold text-lg mb-3">💡 Tips</h3>
                <ul className="text-sm text-text-muted space-y-2">
                  <li>• Log activities as you go for accuracy</li>
                  <li>• Use notes for observations and highlights</li>
                  <li>• Track time to meet state requirements</li>
                  <li>• Review weekly to spot patterns</li>
                </ul>
              </Card>
            </div>
          </div>
        </main>
      </ClientOnly>
    </>
  );
}
