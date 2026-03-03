'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { getPocketBase } from '@/lib/pocketbase';
import { Child, JournalEntry } from '@/lib/types';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { LoadingScreen } from '@/components/ui/Spinner';
import { ClientOnly } from '@/components/ui/ClientOnly';

const CATEGORIES = [
  { value: 'observation', label: 'Observation', emoji: '👀', color: 'bg-blue-100 text-blue-700' },
  { value: 'milestone', label: 'Milestone', emoji: '🏆', color: 'bg-yellow-100 text-yellow-700' },
  { value: 'struggle', label: 'Struggle', emoji: '😓', color: 'bg-red-100 text-red-700' },
  { value: 'breakthrough', label: 'Breakthrough', emoji: '💡', color: 'bg-green-100 text-green-700' },
  { value: 'reflection', label: 'Reflection', emoji: '🪞', color: 'bg-purple-100 text-purple-700' },
  { value: 'field_trip', label: 'Field Trip', emoji: '🚌', color: 'bg-orange-100 text-orange-700' },
  { value: 'project', label: 'Project', emoji: '🎨', color: 'bg-pink-100 text-pink-700' },
  { value: 'resource', label: 'Resource', emoji: '📚', color: 'bg-indigo-100 text-indigo-700' },
  { value: 'other', label: 'Other', emoji: '📝', color: 'bg-gray-100 text-gray-700' },
];

const SUBJECTS = [
  'Math', 'Language Arts', 'Science', 'History', 'Geography', 
  'Art', 'Music', 'PE', 'Foreign Language', 'Bible/Religion',
  'Life Skills', 'Technology', 'Social Studies', 'General'
];

const MOODS = [
  { value: 'great', label: 'Great', emoji: '🌟' },
  { value: 'good', label: 'Good', emoji: '😊' },
  { value: 'neutral', label: 'Neutral', emoji: '😐' },
  { value: 'challenging', label: 'Challenging', emoji: '😤' },
  { value: 'difficult', label: 'Difficult', emoji: '😢' },
];

export default function JournalPage() {
  const router = useRouter();
  const pb = getPocketBase();
  
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [kids, setKids] = useState<Child[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState<JournalEntry | null>(null);
  
  // Filters
  const [filterChild, setFilterChild] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterSubject, setFilterSubject] = useState<string>('all');
  const [filterMood, setFilterMood] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateRange, setDateRange] = useState<'week' | 'month' | 'year' | 'all'>('month');
  
  // Form state
  const [formData, setFormData] = useState({
    child: '',
    title: '',
    content: '',
    category: 'observation' as JournalEntry['category'],
    subject: '',
    mood: '' as JournalEntry['mood'] | '',
    tags: '',
    date: new Date().toISOString().split('T')[0],
    is_private: false,
  });

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

      // Load journal entries
      try {
        const journalRecords = await pb.collection('journal_entries').getFullList({
          filter: `user = "${userId}"`,
          sort: '-date'
        });
        setEntries(journalRecords as unknown as JournalEntry[]);
      } catch (e) {
        console.warn('Journal entries collection not found');
        setEntries([]);
      }
    } catch (error) {
      console.error('Load error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    pb.authStore.clear();
    router.push('/');
  };

  const resetForm = () => {
    setFormData({
      child: '',
      title: '',
      content: '',
      category: 'observation',
      subject: '',
      mood: '',
      tags: '',
      date: new Date().toISOString().split('T')[0],
      is_private: false,
    });
    setEditingEntry(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const userId = pb.authStore.model?.id;
    if (!userId) return;

    const entryData = {
      user: userId,
      child: formData.child || null,
      title: formData.title,
      content: formData.content,
      category: formData.category,
      subject: formData.subject || null,
      mood: formData.mood || null,
      tags: formData.tags ? formData.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
      date: formData.date,
      is_private: formData.is_private,
    };

    try {
      if (editingEntry) {
        await pb.collection('journal_entries').update(editingEntry.id, entryData);
      } else {
        await pb.collection('journal_entries').create(entryData);
      }
      await loadData();
      setShowModal(false);
      resetForm();
    } catch (error) {
      console.error('Save error:', error);
      alert('Failed to save entry. Make sure the journal_entries collection exists in PocketBase.');
    }
  };

  const handleEdit = (entry: JournalEntry) => {
    setEditingEntry(entry);
    setFormData({
      child: entry.child || '',
      title: entry.title,
      content: entry.content,
      category: entry.category,
      subject: entry.subject || '',
      mood: entry.mood || '',
      tags: entry.tags?.join(', ') || '',
      date: entry.date,
      is_private: entry.is_private,
    });
    setShowModal(true);
  };

  const handleDelete = async (entry: JournalEntry) => {
    if (!confirm('Delete this journal entry?')) return;
    try {
      await pb.collection('journal_entries').delete(entry.id);
      await loadData();
    } catch (error) {
      console.error('Delete error:', error);
    }
  };

  // Date range filter
  const getDateRangeStart = () => {
    const now = new Date();
    switch (dateRange) {
      case 'week':
        return new Date(now.setDate(now.getDate() - 7)).toISOString().split('T')[0];
      case 'month':
        return new Date(now.setMonth(now.getMonth() - 1)).toISOString().split('T')[0];
      case 'year':
        return new Date(now.setFullYear(now.getFullYear() - 1)).toISOString().split('T')[0];
      default:
        return null;
    }
  };

  // Filter entries
  const filteredEntries = useMemo(() => {
    const rangeStart = getDateRangeStart();
    
    return entries.filter(entry => {
      if (filterChild !== 'all' && entry.child !== filterChild) return false;
      if (filterCategory !== 'all' && entry.category !== filterCategory) return false;
      if (filterSubject !== 'all' && entry.subject !== filterSubject) return false;
      if (filterMood !== 'all' && entry.mood !== filterMood) return false;
      if (rangeStart && entry.date < rangeStart) return false;
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        if (!entry.title.toLowerCase().includes(query) && 
            !entry.content.toLowerCase().includes(query) &&
            !entry.tags?.some(t => t.toLowerCase().includes(query))) {
          return false;
        }
      }
      return true;
    });
  }, [entries, filterChild, filterCategory, filterSubject, filterMood, dateRange, searchQuery]);

  // Group entries by date
  const groupedEntries = useMemo(() => {
    const groups: Record<string, JournalEntry[]> = {};
    filteredEntries.forEach(entry => {
      const dateKey = entry.date;
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(entry);
    });
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filteredEntries]);

  // Stats
  const stats = useMemo(() => {
    const categoryCount: Record<string, number> = {};
    const moodCount: Record<string, number> = {};
    const childCount: Record<string, number> = {};
    
    filteredEntries.forEach(entry => {
      categoryCount[entry.category] = (categoryCount[entry.category] || 0) + 1;
      if (entry.mood) moodCount[entry.mood] = (moodCount[entry.mood] || 0) + 1;
      if (entry.child) childCount[entry.child] = (childCount[entry.child] || 0) + 1;
    });
    
    return { categoryCount, moodCount, childCount, total: filteredEntries.length };
  }, [filteredEntries]);

  const getCategoryInfo = (cat: string) => CATEGORIES.find(c => c.value === cat) || CATEGORIES[8];
  const getMoodInfo = (mood: string) => MOODS.find(m => m.value === mood);
  const getChildName = (childId: string) => kids.find(k => k.id === childId)?.name || 'Unknown';

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (dateStr === today.toISOString().split('T')[0]) return 'Today';
    if (dateStr === yesterday.toISOString().split('T')[0]) return 'Yesterday';
    
    return date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      month: 'long', 
      day: 'numeric',
      year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined
    });
  };

  if (loading) {
    return (
      <>
        <Header showLogout onLogout={handleLogout} />
        <main className="max-w-7xl mx-auto my-12 px-8">
          <LoadingScreen />
        </main>
      </>
    );
  }

  return (
    <>
      <Header showLogout onLogout={handleLogout} />
      <ClientOnly>
        <main className="max-w-7xl mx-auto my-12 px-4 sm:px-8 pb-20 animate-fade-in">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-8">
            <div>
              <h2 className="font-display text-4xl sm:text-5xl font-extrabold tracking-tight mb-2">
                📓 Learning Journal
              </h2>
              <p className="text-text-muted">
                Document observations, milestones, and learning moments
              </p>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" size="sm" onClick={() => router.push('/dashboard')}>
                ← Dashboard
              </Button>
              <Button onClick={() => { resetForm(); setShowModal(true); }}>
                + New Entry
              </Button>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-bg border-2 border-border rounded-xl p-4 text-center hover:border-primary transition-all">
              <div className="text-3xl font-bold text-primary">{stats.total}</div>
              <div className="text-sm text-text-muted font-medium">Total Entries</div>
            </div>
            <div className="bg-bg border-2 border-border rounded-xl p-4 text-center hover:border-primary transition-all">
              <div className="text-3xl font-bold text-green-600">{stats.categoryCount.milestone || 0}</div>
              <div className="text-sm text-text-muted font-medium">🏆 Milestones</div>
            </div>
            <div className="bg-bg border-2 border-border rounded-xl p-4 text-center hover:border-primary transition-all">
              <div className="text-3xl font-bold text-yellow-600">{stats.categoryCount.breakthrough || 0}</div>
              <div className="text-sm text-text-muted font-medium">💡 Breakthroughs</div>
            </div>
            <div className="bg-bg border-2 border-border rounded-xl p-4 text-center hover:border-primary transition-all">
              <div className="text-3xl font-bold text-blue-600">{Object.keys(stats.childCount).length}</div>
              <div className="text-sm text-text-muted font-medium">Kids Documented</div>
            </div>
          </div>

          {/* Filters */}
          <Card className="mb-8">
            <div className="flex flex-wrap gap-4 items-center">
              {/* Search */}
              <div className="flex-1 min-w-[200px]">
                <input
                  type="text"
                  placeholder="Search entries..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-4 py-2 border-2 border-border rounded-xl focus:border-primary outline-none transition-colors"
                />
              </div>
              
              {/* Child Filter */}
              <select
                value={filterChild}
                onChange={(e) => setFilterChild(e.target.value)}
                className="px-4 py-2 border-2 border-border rounded-xl focus:border-primary outline-none bg-white"
              >
                <option value="all">All Children</option>
                <option value="">Family-wide</option>
                {kids.map(kid => (
                  <option key={kid.id} value={kid.id}>{kid.name}</option>
                ))}
              </select>

              {/* Category Filter */}
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="px-4 py-2 border-2 border-border rounded-xl focus:border-primary outline-none bg-white"
              >
                <option value="all">All Categories</option>
                {CATEGORIES.map(cat => (
                  <option key={cat.value} value={cat.value}>{cat.emoji} {cat.label}</option>
                ))}
              </select>

              {/* Subject Filter */}
              <select
                value={filterSubject}
                onChange={(e) => setFilterSubject(e.target.value)}
                className="px-4 py-2 border-2 border-border rounded-xl focus:border-primary outline-none bg-white"
              >
                <option value="all">All Subjects</option>
                {SUBJECTS.map(subj => (
                  <option key={subj} value={subj}>{subj}</option>
                ))}
              </select>

              {/* Date Range */}
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value as typeof dateRange)}
                className="px-4 py-2 border-2 border-border rounded-xl focus:border-primary outline-none bg-white"
              >
                <option value="week">Past Week</option>
                <option value="month">Past Month</option>
                <option value="year">Past Year</option>
                <option value="all">All Time</option>
              </select>
            </div>
          </Card>

          {/* Journal Entries */}
          {groupedEntries.length === 0 ? (
            <Card className="text-center py-12">
              <div className="text-6xl mb-4">📓</div>
              <p className="text-text-muted text-lg mb-6">
                {entries.length === 0 
                  ? "No journal entries yet. Start documenting your learning journey!"
                  : "No entries match your filters."}
              </p>
              {entries.length === 0 && (
                <Button onClick={() => { resetForm(); setShowModal(true); }}>
                  Write First Entry
                </Button>
              )}
            </Card>
          ) : (
            <div className="space-y-8">
              {groupedEntries.map(([date, dayEntries]) => (
                <div key={date}>
                  <h3 className="font-display text-xl font-bold text-primary mb-4 sticky top-20 bg-bg/95 backdrop-blur-sm py-2 z-10">
                    {formatDate(date)}
                    <span className="text-sm font-normal text-text-muted ml-2">
                      ({dayEntries.length} {dayEntries.length === 1 ? 'entry' : 'entries'})
                    </span>
                  </h3>
                  
                  <div className="space-y-4">
                    {dayEntries.map(entry => {
                      const catInfo = getCategoryInfo(entry.category);
                      const moodInfo = entry.mood ? getMoodInfo(entry.mood) : null;
                      
                      return (
                        <Card key={entry.id} className="hover:border-primary/50 transition-all">
                          <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                            {/* Category Badge */}
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${catInfo.color}`}>
                              {catInfo.emoji}
                            </div>
                            
                            {/* Content */}
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-2 mb-2">
                                <h4 className="font-display font-bold text-lg m-0">{entry.title}</h4>
                                {entry.child && (
                                  <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary">
                                    {getChildName(entry.child)}
                                  </span>
                                )}
                                {entry.subject && (
                                  <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-secondary/10 text-secondary">
                                    {entry.subject}
                                  </span>
                                )}
                                {moodInfo && (
                                  <span className="text-sm" title={moodInfo.label}>
                                    {moodInfo.emoji}
                                  </span>
                                )}
                                {entry.is_private && (
                                  <span className="text-xs text-text-muted">🔒</span>
                                )}
                              </div>
                              
                              <p className="text-text-muted whitespace-pre-wrap mb-3">{entry.content}</p>
                              
                              {/* Tags */}
                              {entry.tags && entry.tags.length > 0 && (
                                <div className="flex flex-wrap gap-1 mb-3">
                                  {entry.tags.map((tag, i) => (
                                    <span 
                                      key={i}
                                      className="px-2 py-0.5 rounded-full text-xs bg-bg-alt text-text-muted"
                                    >
                                      #{tag}
                                    </span>
                                  ))}
                                </div>
                              )}
                              
                              {/* Actions */}
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleEdit(entry)}
                                  className="text-xs text-primary hover:underline"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => handleDelete(entry)}
                                  className="text-xs text-red-500 hover:underline"
                                >
                                  Delete
                                </button>
                              </div>
                            </div>
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Category Quick Insights */}
          {entries.length > 0 && (
            <Card className="mt-12">
              <h3 className="font-display text-xl font-bold text-primary mb-4">📊 Category Breakdown</h3>
              <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-9 gap-2">
                {CATEGORIES.map(cat => {
                  const count = stats.categoryCount[cat.value] || 0;
                  return (
                    <button
                      key={cat.value}
                      onClick={() => setFilterCategory(filterCategory === cat.value ? 'all' : cat.value)}
                      className={`p-3 rounded-xl text-center transition-all ${
                        filterCategory === cat.value 
                          ? 'ring-2 ring-primary ' + cat.color
                          : cat.color + ' opacity-60 hover:opacity-100'
                      }`}
                    >
                      <div className="text-xl mb-1">{cat.emoji}</div>
                      <div className="text-xs font-bold">{count}</div>
                    </button>
                  );
                })}
              </div>
            </Card>
          )}

          {/* Modal */}
          {showModal && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
              <div className="bg-white rounded-2xl p-6 w-full max-w-2xl my-8 max-h-[90vh] overflow-y-auto">
                <h3 className="font-display text-2xl font-bold mb-6">
                  {editingEntry ? '✏️ Edit Entry' : '📝 New Journal Entry'}
                </h3>
                
                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Title */}
                  <div>
                    <label className="block text-sm font-semibold mb-1">Title *</label>
                    <input
                      type="text"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      placeholder="What happened today?"
                      className="w-full px-4 py-3 border-2 border-border rounded-xl focus:border-primary outline-none"
                      required
                    />
                  </div>

                  {/* Child + Date Row */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold mb-1">Child</label>
                      <select
                        value={formData.child}
                        onChange={(e) => setFormData({ ...formData, child: e.target.value })}
                        className="w-full px-4 py-3 border-2 border-border rounded-xl focus:border-primary outline-none bg-white"
                      >
                        <option value="">Family-wide</option>
                        {kids.map(kid => (
                          <option key={kid.id} value={kid.id}>{kid.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold mb-1">Date *</label>
                      <input
                        type="date"
                        value={formData.date}
                        onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                        className="w-full px-4 py-3 border-2 border-border rounded-xl focus:border-primary outline-none"
                        required
                      />
                    </div>
                  </div>

                  {/* Category */}
                  <div>
                    <label className="block text-sm font-semibold mb-2">Category *</label>
                    <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                      {CATEGORIES.map(cat => (
                        <button
                          key={cat.value}
                          type="button"
                          onClick={() => setFormData({ ...formData, category: cat.value as JournalEntry['category'] })}
                          className={`p-3 rounded-xl text-center transition-all ${
                            formData.category === cat.value
                              ? 'ring-2 ring-primary ' + cat.color
                              : 'bg-bg-alt hover:bg-border'
                          }`}
                        >
                          <div className="text-xl">{cat.emoji}</div>
                          <div className="text-[10px] font-semibold mt-1">{cat.label}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Subject + Mood Row */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold mb-1">Subject</label>
                      <select
                        value={formData.subject}
                        onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                        className="w-full px-4 py-3 border-2 border-border rounded-xl focus:border-primary outline-none bg-white"
                      >
                        <option value="">None</option>
                        {SUBJECTS.map(subj => (
                          <option key={subj} value={subj}>{subj}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold mb-1">Mood</label>
                      <div className="flex gap-2">
                        {MOODS.map(mood => (
                          <button
                            key={mood.value}
                            type="button"
                            onClick={() => setFormData({ 
                              ...formData, 
                              mood: formData.mood === mood.value ? '' : mood.value as JournalEntry['mood']
                            })}
                            className={`flex-1 p-2 rounded-xl text-center text-xl transition-all ${
                              formData.mood === mood.value
                                ? 'ring-2 ring-primary bg-primary/10'
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

                  {/* Content */}
                  <div>
                    <label className="block text-sm font-semibold mb-1">Notes *</label>
                    <textarea
                      value={formData.content}
                      onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                      placeholder="Describe what happened, what you observed, or what was learned..."
                      className="w-full px-4 py-3 border-2 border-border rounded-xl focus:border-primary outline-none resize-none"
                      rows={5}
                      required
                    />
                  </div>

                  {/* Tags */}
                  <div>
                    <label className="block text-sm font-semibold mb-1">Tags</label>
                    <input
                      type="text"
                      value={formData.tags}
                      onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                      placeholder="reading, phonics, outdoor (comma separated)"
                      className="w-full px-4 py-3 border-2 border-border rounded-xl focus:border-primary outline-none"
                    />
                  </div>

                  {/* Private Toggle */}
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="is_private"
                      checked={formData.is_private}
                      onChange={(e) => setFormData({ ...formData, is_private: e.target.checked })}
                      className="w-5 h-5 rounded border-border"
                    />
                    <label htmlFor="is_private" className="text-sm">
                      🔒 Private entry (won't show in exports/reports)
                    </label>
                  </div>

                  {/* Actions */}
                  <div className="flex justify-end gap-3 pt-4">
                    <Button 
                      type="button" 
                      variant="ghost" 
                      onClick={() => { setShowModal(false); resetForm(); }}
                    >
                      Cancel
                    </Button>
                    <Button type="submit">
                      {editingEntry ? 'Save Changes' : 'Add Entry'}
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </main>
      </ClientOnly>
    </>
  );
}
