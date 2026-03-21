'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { getPocketBase } from '@/lib/pocketbase';
import { Child, ReadingEntry } from '@/lib/types';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/Button';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { LoadingScreen } from '@/components/ui/Spinner';
import { Toast } from '@/components/ui/Toast';

const GENRES = [
  'Fiction',
  'Non-Fiction',
  'Fantasy',
  'Science Fiction',
  'Mystery',
  'Biography',
  'History',
  'Science',
  'Poetry',
  'Graphic Novel',
  'Picture Book',
  'Chapter Book',
  'Classic Literature',
  'Religious',
  'Other'
];

export default function ReadingLogPage() {
  const router = useRouter();
  const pb = getPocketBase();
  
  const [entries, setEntries] = useState<ReadingEntry[]>([]);
  const [kids, setKids] = useState<Child[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<ReadingEntry | null>(null);
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'stats'>('list');

  // Filter states
  const [filterChild, setFilterChild] = useState('all');
  const [filterFinished, setFilterFinished] = useState('all');

  // Form states
  const [bookTitle, setBookTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [childId, setChildId] = useState('');
  const [minutesRead, setMinutesRead] = useState('');
  const [pagesRead, setPagesRead] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [rating, setRating] = useState('');
  const [finished, setFinished] = useState(false);
  const [genre, setGenre] = useState('');

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

      const [entryRecords, kidRecords] = await Promise.all([
        pb.collection('reading_log').getFullList({
          filter: `user = "${userId}"`,
          sort: '-date'
        }),
        pb.collection('children').getFullList({
          filter: `user = "${userId}"`,
          sort: 'name'
        })
      ]);

      setEntries(entryRecords as unknown as ReadingEntry[]);
      setKids(kidRecords as unknown as Child[]);
      if (kidRecords.length > 0 && !childId) {
        setChildId(kidRecords[0].id);
      }
    } catch (error) {
      console.error('Reading log load error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const userId = pb.authStore.model?.id;
      if (!userId) return;

      const data = {
        user: userId,
        child: childId,
        book_title: bookTitle,
        author: author || undefined,
        minutes_read: parseInt(minutesRead) || 0,
        pages_read: pagesRead ? parseInt(pagesRead) : undefined,
        date,
        notes: notes || undefined,
        rating: rating ? parseInt(rating) : undefined,
        finished,
        genre: genre || undefined
      };

      if (editingEntry) {
        await pb.collection('reading_log').update(editingEntry.id, data);
        setToast({ message: 'Reading entry updated!', type: 'success' });
      } else {
        await pb.collection('reading_log').create(data);
        
        // Log activity
        try {
          const kid = kids.find(k => k.id === childId);
          await pb.collection('activity_logs').create({
            user: userId,
            child: childId,
            type: 'portfolio_add',
            title: `Reading: ${bookTitle}${finished ? ' (Finished!)' : ''}`,
            date: new Date().toISOString()
          });
        } catch (e) { /* ignore activity log failures */ }

        setToast({ message: 'Reading entry added!', type: 'success' });
      }

      setIsModalOpen(false);
      resetForm();
      loadData();
    } catch (error) {
      console.error('Save error:', error);
      setToast({ message: 'Failed to save entry.', type: 'error' });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this reading entry?')) return;
    try {
      await pb.collection('reading_log').delete(id);
      setToast({ message: 'Entry deleted.', type: 'success' });
      loadData();
    } catch (error) {
      setToast({ message: 'Failed to delete entry.', type: 'error' });
    }
  };

  const handleEdit = (entry: ReadingEntry) => {
    setEditingEntry(entry);
    setBookTitle(entry.book_title);
    setAuthor(entry.author || '');
    setChildId(entry.child);
    setMinutesRead(entry.minutes_read.toString());
    setPagesRead(entry.pages_read?.toString() || '');
    setDate(entry.date);
    setNotes(entry.notes || '');
    setRating(entry.rating?.toString() || '');
    setFinished(entry.finished);
    setGenre(entry.genre || '');
    setIsModalOpen(true);
  };

  const resetForm = () => {
    setEditingEntry(null);
    setBookTitle('');
    setAuthor('');
    setMinutesRead('');
    setPagesRead('');
    setDate(new Date().toISOString().split('T')[0]);
    setNotes('');
    setRating('');
    setFinished(false);
    setGenre('');
  };

  const filteredEntries = entries.filter(e => {
    if (filterChild !== 'all' && e.child !== filterChild) return false;
    if (filterFinished === 'finished' && !e.finished) return false;
    if (filterFinished === 'reading' && e.finished) return false;
    return true;
  });

  // Calculate statistics
  const stats = useMemo(() => {
    const childFilter = filterChild !== 'all' ? filterChild : null;
    const relevantEntries = childFilter 
      ? entries.filter(e => e.child === childFilter)
      : entries;

    const totalMinutes = relevantEntries.reduce((sum, e) => sum + (e.minutes_read || 0), 0);
    const totalBooks = new Set(relevantEntries.filter(e => e.finished).map(e => e.book_title.toLowerCase())).size;
    const totalPages = relevantEntries.reduce((sum, e) => sum + (e.pages_read || 0), 0);
    
    // Calculate current reading streak (consecutive days)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const uniqueDates = [...new Set(relevantEntries.map(e => e.date))].sort().reverse();
    let streak = 0;
    for (let i = 0; i < uniqueDates.length; i++) {
      const entryDate = new Date(uniqueDates[i]);
      entryDate.setHours(0, 0, 0, 0);
      const expectedDate = new Date(today);
      expectedDate.setDate(today.getDate() - i);
      if (entryDate.getTime() === expectedDate.getTime()) {
        streak++;
      } else if (i === 0 && entryDate.getTime() === expectedDate.getTime() - 86400000) {
        // Allow starting from yesterday
        streak++;
      } else {
        break;
      }
    }

    // Genre breakdown
    const genreCounts: Record<string, number> = {};
    relevantEntries.forEach(e => {
      const g = e.genre || 'Other';
      genreCounts[g] = (genreCounts[g] || 0) + 1;
    });

    // This month's stats
    const thisMonth = new Date().toISOString().slice(0, 7);
    const thisMonthEntries = relevantEntries.filter(e => e.date.startsWith(thisMonth));
    const thisMonthMinutes = thisMonthEntries.reduce((sum, e) => sum + (e.minutes_read || 0), 0);
    const thisMonthBooks = new Set(thisMonthEntries.filter(e => e.finished).map(e => e.book_title.toLowerCase())).size;

    return {
      totalMinutes,
      totalBooks,
      totalPages,
      streak,
      genreCounts,
      thisMonthMinutes,
      thisMonthBooks,
      totalEntries: relevantEntries.length
    };
  }, [entries, filterChild]);

  const renderStars = (rating: number | undefined) => {
    if (!rating) return null;
    return (
      <span className="text-accent">
        {'★'.repeat(rating)}{'☆'.repeat(5 - rating)}
      </span>
    );
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return <LoadingScreen message="Loading reading log..." />;
  }

  return (
    <>
      <Header showLogout onLogout={() => { pb.authStore.clear(); router.push('/'); }} />
      <main className="max-w-7xl mx-auto my-8 sm:my-12 px-4 sm:px-8 pb-20 animate-fade-in">
        {/* Page Header */}
        <div className="print:hidden flex flex-col sm:flex-row sm:justify-between sm:items-center gap-6 mb-8 sm:mb-12">
          <div>
            <h2 className="font-display text-4xl sm:text-6xl font-extrabold tracking-tight mb-2">📚 Reading Log</h2>
            <p className="text-text-muted text-sm sm:text-base">Track books, reading time, and build a love of reading.</p>
          </div>
          <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
            <Button variant="ghost" size="sm" onClick={() => router.push('/dashboard')}>
              📊 Dashboard
            </Button>
            <Button variant="outline" size="sm" onClick={handlePrint}>
              🖨️ Print
            </Button>
            <Button size="sm" onClick={() => { resetForm(); setIsModalOpen(true); }}>
              + Log Reading
            </Button>
          </div>
        </div>

        {/* Filters & View Toggle */}
        <Card className="mb-8 p-4 sm:p-8 print:hidden">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 sm:gap-6 items-end">
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
              value={filterFinished} 
              onChange={(e) => setFilterFinished(e.target.value)}
            >
              <option value="all">All Books</option>
              <option value="reading">Currently Reading</option>
              <option value="finished">Finished</option>
            </Select>
            <div className="lg:col-span-3 flex justify-end gap-2">
              <Button 
                variant={viewMode === 'list' ? 'primary' : 'ghost'} 
                size="sm" 
                onClick={() => setViewMode('list')}
              >
                📋 List
              </Button>
              <Button 
                variant={viewMode === 'stats' ? 'primary' : 'ghost'} 
                size="sm" 
                onClick={() => setViewMode('stats')}
              >
                📊 Stats
              </Button>
            </div>
          </div>
        </Card>

        {/* Stats View */}
        {viewMode === 'stats' && (
          <div className="mb-8 space-y-6 print:block">
            {/* Summary Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="p-6 text-center">
                <div className="text-4xl sm:text-5xl font-display font-extrabold text-primary mb-1">
                  {stats.totalBooks}
                </div>
                <div className="text-xs font-bold uppercase tracking-wider text-text-muted">Books Finished</div>
              </Card>
              <Card className="p-6 text-center">
                <div className="text-4xl sm:text-5xl font-display font-extrabold text-secondary mb-1">
                  {Math.round(stats.totalMinutes / 60)}h
                </div>
                <div className="text-xs font-bold uppercase tracking-wider text-text-muted">Total Reading</div>
              </Card>
              <Card className="p-6 text-center">
                <div className="text-4xl sm:text-5xl font-display font-extrabold text-accent mb-1">
                  {stats.streak}
                </div>
                <div className="text-xs font-bold uppercase tracking-wider text-text-muted">Day Streak 🔥</div>
              </Card>
              <Card className="p-6 text-center">
                <div className="text-4xl sm:text-5xl font-display font-extrabold text-primary mb-1">
                  {stats.totalPages.toLocaleString()}
                </div>
                <div className="text-xs font-bold uppercase tracking-wider text-text-muted">Pages Read</div>
              </Card>
            </div>

            {/* This Month */}
            <Card className="p-6 sm:p-8">
              <h3 className="text-xs font-bold uppercase tracking-widest text-primary mb-4 border-b pb-2">This Month</h3>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <span className="text-3xl font-display font-extrabold text-text-main">{stats.thisMonthBooks}</span>
                  <span className="text-sm text-text-muted ml-2">books finished</span>
                </div>
                <div>
                  <span className="text-3xl font-display font-extrabold text-text-main">{Math.round(stats.thisMonthMinutes / 60)}</span>
                  <span className="text-sm text-text-muted ml-2">hours reading</span>
                </div>
              </div>
            </Card>

            {/* Genre Breakdown */}
            {Object.keys(stats.genreCounts).length > 0 && (
              <Card className="p-6 sm:p-8">
                <h3 className="text-xs font-bold uppercase tracking-widest text-secondary mb-4 border-b pb-2">Genre Breakdown</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {Object.entries(stats.genreCounts)
                    .sort((a, b) => b[1] - a[1])
                    .map(([genre, count]) => (
                      <div key={genre} className="flex items-center justify-between p-3 bg-bg-alt rounded-xl">
                        <span className="text-sm font-medium truncate">{genre}</span>
                        <span className="text-sm font-bold text-primary ml-2">{count}</span>
                      </div>
                    ))}
                </div>
              </Card>
            )}
          </div>
        )}

        {/* List View */}
        {viewMode === 'list' && (
          <div className="space-y-4">
            {filteredEntries.map((entry) => {
              const kid = kids.find(k => k.id === entry.child);
              return (
                <div 
                  key={entry.id} 
                  className="bg-card border border-border rounded-[1.5rem] p-5 sm:p-8 transition-all hover:border-primary/30 print:border-black print:rounded-none print:p-4"
                >
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-start gap-3 mb-2 flex-wrap">
                        <h3 className="m-0 font-display text-lg sm:text-xl font-bold">{entry.book_title}</h3>
                        {entry.finished && (
                          <span className="px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700 border border-green-200">
                            ✓ Finished
                          </span>
                        )}
                      </div>
                      {entry.author && (
                        <p className="text-sm text-text-muted mb-2 italic">by {entry.author}</p>
                      )}
                      <div className="flex flex-wrap gap-x-4 sm:gap-x-6 gap-y-2 text-xs sm:text-sm text-text-muted">
                        <span className="font-bold text-primary">🧒 {kid?.name || 'Unknown'}</span>
                        <span>📅 {new Date(entry.date).toLocaleDateString()}</span>
                        <span>⏱️ {entry.minutes_read} min</span>
                        {entry.pages_read && <span>📖 {entry.pages_read} pages</span>}
                        {entry.genre && <span>📚 {entry.genre}</span>}
                      </div>
                      {entry.rating && (
                        <div className="mt-2">{renderStars(entry.rating)}</div>
                      )}
                      {entry.notes && (
                        <p className="mt-3 text-xs sm:text-sm text-text-muted bg-bg-alt p-3 rounded-xl line-clamp-3">
                          💭 {entry.notes}
                        </p>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2 print:hidden">
                      <Button variant="ghost" size="sm" onClick={() => handleEdit(entry)}>
                        ✏️
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(entry.id)}>
                        🗑️
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}

            {filteredEntries.length === 0 && (
              <div className="text-center py-20 bg-bg-alt rounded-[2rem] border-2 border-dashed border-border print:hidden">
                <p className="text-6xl mb-4">📚</p>
                <p className="text-text-muted text-lg mb-2">No reading entries yet.</p>
                <p className="text-text-muted text-sm mb-6">Start logging your reading adventures!</p>
                <Button onClick={() => { resetForm(); setIsModalOpen(true); }}>
                  + Log Your First Book
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Print Header (only visible when printing) */}
        <div className="hidden print:block mb-8">
          <div className="border-b-4 border-primary pb-4 mb-6">
            <h1 className="font-display text-3xl font-extrabold text-primary">Village Homeschool - Reading Log</h1>
            <p className="text-sm text-text-muted">Generated {new Date().toLocaleDateString()}</p>
          </div>
          {filterChild !== 'all' && (
            <p className="font-bold mb-4">Student: {kids.find(k => k.id === filterChild)?.name}</p>
          )}
          <div className="grid grid-cols-4 gap-4 mb-6 text-center">
            <div className="border p-3">
              <div className="text-2xl font-bold">{stats.totalBooks}</div>
              <div className="text-xs">Books Finished</div>
            </div>
            <div className="border p-3">
              <div className="text-2xl font-bold">{Math.round(stats.totalMinutes / 60)}h</div>
              <div className="text-xs">Total Reading</div>
            </div>
            <div className="border p-3">
              <div className="text-2xl font-bold">{stats.totalPages.toLocaleString()}</div>
              <div className="text-xs">Pages Read</div>
            </div>
            <div className="border p-3">
              <div className="text-2xl font-bold">{stats.totalEntries}</div>
              <div className="text-xs">Log Entries</div>
            </div>
          </div>
        </div>
      </main>

      {/* Add/Edit Modal */}
      <Modal 
        isOpen={isModalOpen} 
        onClose={() => { setIsModalOpen(false); resetForm(); }} 
        title={editingEntry ? "Edit Reading Entry" : "Log Reading"}
        subtitle="Record what was read today."
      >
        <form onSubmit={handleSave} className="space-y-4">
          <Input 
            label="Book Title" 
            value={bookTitle} 
            onChange={(e) => setBookTitle(e.target.value)} 
            required 
            placeholder="e.g. Charlotte's Web" 
          />
          <Input 
            label="Author (Optional)" 
            value={author} 
            onChange={(e) => setAuthor(e.target.value)} 
            placeholder="e.g. E.B. White" 
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select label="Child" value={childId} onChange={(e) => setChildId(e.target.value)} required>
              {kids.map(k => <option key={k.id} value={k.id}>{k.name}</option>)}
            </Select>
            <Select label="Genre (Optional)" value={genre} onChange={(e) => setGenre(e.target.value)}>
              <option value="">Select genre...</option>
              {GENRES.map(g => <option key={g} value={g}>{g}</option>)}
            </Select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input 
              label="Minutes Read" 
              type="number" 
              value={minutesRead} 
              onChange={(e) => setMinutesRead(e.target.value)} 
              required
              placeholder="30" 
            />
            <Input 
              label="Pages (Optional)" 
              type="number" 
              value={pagesRead} 
              onChange={(e) => setPagesRead(e.target.value)} 
              placeholder="25" 
            />
            <Input 
              label="Date" 
              type="date" 
              value={date} 
              onChange={(e) => setDate(e.target.value)} 
              required 
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select label="Rating (Optional)" value={rating} onChange={(e) => setRating(e.target.value)}>
              <option value="">No rating</option>
              <option value="1">★ (1 star)</option>
              <option value="2">★★ (2 stars)</option>
              <option value="3">★★★ (3 stars)</option>
              <option value="4">★★★★ (4 stars)</option>
              <option value="5">★★★★★ (5 stars)</option>
            </Select>
            <div className="flex items-center gap-3 pt-6">
              <input 
                type="checkbox" 
                id="finished" 
                checked={finished} 
                onChange={(e) => setFinished(e.target.checked)}
                className="w-5 h-5 rounded border-border accent-primary"
              />
              <label htmlFor="finished" className="text-sm font-bold cursor-pointer">
                📕 Finished this book!
              </label>
            </div>
          </div>
          <Textarea 
            label="Notes / Reflection (Optional)" 
            value={notes} 
            onChange={(e) => setNotes(e.target.value)} 
            placeholder="What did you think? Favorite character? What happened?"
          />
          
          <div className="flex flex-col sm:flex-row justify-end gap-4 mt-8">
            <Button type="button" variant="outline" onClick={() => { setIsModalOpen(false); resetForm(); }} className="w-full sm:w-auto order-2 sm:order-1">
              Cancel
            </Button>
            <Button type="submit" className="w-full sm:w-auto order-1 sm:order-2">
              {editingEntry ? 'Save Changes' : 'Log Reading'}
            </Button>
          </div>
        </form>
      </Modal>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Print styles */}
      <style jsx global>{`
        @media print {
          body {
            background: white;
          }
          @page {
            margin: 0.75in;
          }
        }
      `}</style>
    </>
  );
}
