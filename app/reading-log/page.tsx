'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getPocketBase } from '@/lib/pocketbase';
import { Child } from '@/lib/types';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/Button';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { LoadingScreen } from '@/components/ui/Spinner';
import { Toast } from '@/components/ui/Toast';

interface ReadingEntry {
  id: string;
  user: string;
  child: string;
  date: string;
  minutes: number;
  book_title?: string;
  pages_read?: number;
  notes?: string;
  created: string;
  updated: string;
}

interface Book {
  id: string;
  user: string;
  child: string;
  title: string;
  author?: string;
  total_pages?: number;
  pages_read: number;
  status: 'reading' | 'completed' | 'paused';
  started_date?: string;
  completed_date?: string;
  created: string;
  updated: string;
}

export default function ReadingLogPage() {
  const router = useRouter();
  const pb = getPocketBase();

  const [kids, setKids] = useState<Child[]>([]);
  const [selectedKidId, setSelectedKidId] = useState('');
  const [entries, setEntries] = useState<ReadingEntry[]>([]);
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Modal states
  const [isEntryModalOpen, setIsEntryModalOpen] = useState(false);
  const [isBookModalOpen, setIsBookModalOpen] = useState(false);

  // Calendar state
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // Entry form states
  const [entryDate, setEntryDate] = useState(new Date().toISOString().split('T')[0]);
  const [entryMinutes, setEntryMinutes] = useState('');
  const [entryBook, setEntryBook] = useState('');
  const [entryPages, setEntryPages] = useState('');
  const [entryNotes, setEntryNotes] = useState('');
  const [editingEntry, setEditingEntry] = useState<ReadingEntry | null>(null);

  // Book form states
  const [bookTitle, setBookTitle] = useState('');
  const [bookAuthor, setBookAuthor] = useState('');
  const [bookTotalPages, setBookTotalPages] = useState('');

  useEffect(() => {
    if (!pb.authStore.isValid) {
      router.push('/');
      return;
    }
    loadInitialData();
  }, []);

  useEffect(() => {
    if (selectedKidId) {
      loadEntriesAndBooks(selectedKidId);
    }
  }, [selectedKidId]);

  const loadInitialData = async () => {
    try {
      const userId = pb.authStore.model?.id;
      if (!userId) return;

      const kidRecords = await pb.collection('children').getFullList({
        filter: `user = "${userId}"`,
        sort: 'name',
      });

      setKids(kidRecords as unknown as Child[]);
      if (kidRecords.length > 0) {
        setSelectedKidId(kidRecords[0].id);
      } else {
        setLoading(false);
      }
    } catch (error) {
      console.error('Initial load error:', error);
      setLoading(false);
    }
  };

  const loadEntriesAndBooks = async (kidId: string) => {
    try {
      // Try to load reading_entries - if collection doesn't exist, use empty array
      let entryRecords: ReadingEntry[] = [];
      let bookRecords: Book[] = [];

      try {
        entryRecords = (await pb.collection('reading_entries').getFullList({
          filter: `child = "${kidId}"`,
          sort: '-date',
        })) as unknown as ReadingEntry[];
      } catch (e) {
        // Collection might not exist yet - that's ok
        console.log('Reading entries collection not found, will be created on first entry');
      }

      try {
        bookRecords = (await pb.collection('reading_books').getFullList({
          filter: `child = "${kidId}"`,
          sort: '-created',
        })) as unknown as Book[];
      } catch (e) {
        // Collection might not exist yet
        console.log('Reading books collection not found, will be created on first book');
      }

      setEntries(entryRecords);
      setBooks(bookRecords);
    } catch (error) {
      console.error('Load error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const userId = pb.authStore.model?.id;
      if (!userId || !selectedKidId) return;

      const entryData = {
        user: userId,
        child: selectedKidId,
        date: entryDate,
        minutes: parseInt(entryMinutes) || 0,
        book_title: entryBook || undefined,
        pages_read: entryPages ? parseInt(entryPages) : undefined,
        notes: entryNotes || undefined,
      };

      if (editingEntry) {
        await pb.collection('reading_entries').update(editingEntry.id, entryData);
        setToast({ message: 'Reading log updated!', type: 'success' });
      } else {
        await pb.collection('reading_entries').create(entryData);
        setToast({ message: 'Reading logged! 📚', type: 'success' });
      }

      // Update book progress if applicable
      if (entryBook && entryPages) {
        const book = books.find((b) => b.title === entryBook);
        if (book) {
          const newPagesRead = book.pages_read + parseInt(entryPages);
          const updates: Partial<Book> = { pages_read: newPagesRead };
          if (book.total_pages && newPagesRead >= book.total_pages) {
            updates.status = 'completed';
            updates.completed_date = new Date().toISOString();
          }
          await pb.collection('reading_books').update(book.id, updates);
        }
      }

      setIsEntryModalOpen(false);
      resetEntryForm();
      loadEntriesAndBooks(selectedKidId);
    } catch (error) {
      console.error('Save error:', error);
      setToast({ message: 'Failed to save reading log.', type: 'error' });
    }
  };

  const handleSaveBook = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const userId = pb.authStore.model?.id;
      if (!userId || !selectedKidId) return;

      await pb.collection('reading_books').create({
        user: userId,
        child: selectedKidId,
        title: bookTitle,
        author: bookAuthor || undefined,
        total_pages: bookTotalPages ? parseInt(bookTotalPages) : undefined,
        pages_read: 0,
        status: 'reading',
        started_date: new Date().toISOString(),
      });

      setToast({ message: 'Book added! Happy reading! 📖', type: 'success' });
      setIsBookModalOpen(false);
      resetBookForm();
      loadEntriesAndBooks(selectedKidId);
    } catch (error) {
      console.error('Save error:', error);
      setToast({ message: 'Failed to add book.', type: 'error' });
    }
  };

  const handleDeleteEntry = async (id: string) => {
    if (!confirm('Delete this reading entry?')) return;
    try {
      await pb.collection('reading_entries').delete(id);
      setToast({ message: 'Entry deleted', type: 'success' });
      loadEntriesAndBooks(selectedKidId);
    } catch (error) {
      setToast({ message: 'Failed to delete', type: 'error' });
    }
  };

  const handleCompleteBook = async (book: Book) => {
    try {
      await pb.collection('reading_books').update(book.id, {
        status: 'completed',
        completed_date: new Date().toISOString(),
        pages_read: book.total_pages || book.pages_read,
      });
      setToast({ message: `Finished "${book.title}"! 🎉`, type: 'success' });
      loadEntriesAndBooks(selectedKidId);
    } catch (error) {
      setToast({ message: 'Failed to update book', type: 'error' });
    }
  };

  const resetEntryForm = () => {
    setEntryDate(new Date().toISOString().split('T')[0]);
    setEntryMinutes('');
    setEntryBook('');
    setEntryPages('');
    setEntryNotes('');
    setEditingEntry(null);
  };

  const resetBookForm = () => {
    setBookTitle('');
    setBookAuthor('');
    setBookTotalPages('');
  };

  // Calendar helpers
  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const generateCalendarDays = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = getDaysInMonth(year, month);

    const days: (Date | null)[] = [];
    const padding = firstDay === 0 ? 6 : firstDay - 1;
    for (let i = 0; i < padding; i++) {
      days.push(null);
    }

    for (let d = 1; d <= daysInMonth; d++) {
      days.push(new Date(year, month, d));
    }

    return days;
  };

  const getEntryForDate = (date: Date): ReadingEntry | undefined => {
    const dateStr = date.toISOString().split('T')[0];
    return entries.find((e) => e.date.startsWith(dateStr));
  };

  const getMinutesColor = (minutes: number): string => {
    if (minutes >= 60) return 'bg-green-500';
    if (minutes >= 30) return 'bg-green-400';
    if (minutes >= 15) return 'bg-green-300';
    if (minutes > 0) return 'bg-green-200';
    return 'bg-bg-alt';
  };

  // Stats
  const totalMinutesThisMonth = entries
    .filter((e) => {
      const entryDate = new Date(e.date);
      return (
        entryDate.getMonth() === currentMonth.getMonth() &&
        entryDate.getFullYear() === currentMonth.getFullYear()
      );
    })
    .reduce((sum, e) => sum + e.minutes, 0);

  const totalMinutesAllTime = entries.reduce((sum, e) => sum + e.minutes, 0);
  const totalBooksCompleted = books.filter((b) => b.status === 'completed').length;
  const currentlyReading = books.filter((b) => b.status === 'reading');

  // Calculate streak
  const calculateStreak = (): number => {
    const sortedDates = [...new Set(entries.map((e) => e.date.split('T')[0]))]
      .sort()
      .reverse();

    if (sortedDates.length === 0) return 0;

    let streak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 0; i < sortedDates.length; i++) {
      const checkDate = new Date(today);
      checkDate.setDate(checkDate.getDate() - i);
      const checkDateStr = checkDate.toISOString().split('T')[0];

      if (sortedDates.includes(checkDateStr)) {
        streak++;
      } else if (i === 0) {
        // If today has no entry, check if yesterday had one
        continue;
      } else {
        break;
      }
    }

    return streak;
  };

  const streak = calculateStreak();

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const prevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  if (loading) return <LoadingScreen message="Loading reading log..." />;

  if (kids.length === 0) {
    return (
      <>
        <Header
          showLogout
          onLogout={() => {
            pb.authStore.clear();
            router.push('/');
          }}
        />
        <main className="max-w-4xl mx-auto my-12 px-8 text-center">
          <Card className="py-20">
            <p className="text-xl text-text-muted mb-8 italic font-serif">
              No children found in your village.
            </p>
            <Button onClick={() => router.push('/manage-kids')}>Add Your First Child</Button>
          </Card>
        </main>
      </>
    );
  }

  const days = generateCalendarDays();
  const monthName = currentMonth.toLocaleString('default', { month: 'long' });
  const selectedKid = kids.find((k) => k.id === selectedKidId);

  return (
    <>
      <Header
        showLogout
        onLogout={() => {
          pb.authStore.clear();
          router.push('/');
        }}
      />
      <main className="max-w-7xl mx-auto my-8 sm:my-12 px-4 sm:px-8 pb-24 animate-fade-in">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-6 mb-8 sm:mb-12">
          <div>
            <h2 className="font-display text-4xl sm:text-6xl font-extrabold tracking-tight mb-2">
              Reading Log
            </h2>
            <p className="text-text-muted text-sm sm:text-base font-serif italic">
              Track daily reading and build lifelong habits. 📚
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button
              size="sm"
              onClick={() => {
                resetEntryForm();
                setIsEntryModalOpen(true);
              }}
            >
              + Log Reading
            </Button>
            <Button variant="outline" size="sm" onClick={() => setIsBookModalOpen(true)}>
              + Add Book
            </Button>
            <Button variant="ghost" size="sm" onClick={() => router.push('/dashboard')}>
              ← Dashboard
            </Button>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Left Column: Stats & Books */}
          <div className="lg:col-span-1 space-y-6">
            {/* Child Selector */}
            <Card className="p-6">
              <Select
                label="Reader"
                value={selectedKidId}
                onChange={(e) => setSelectedKidId(e.target.value)}
              >
                {kids.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.name}
                  </option>
                ))}
              </Select>
            </Card>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 gap-4">
              <Card className="p-4 text-center">
                <div className="text-3xl font-display font-extrabold text-primary">{streak}</div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
                  Day Streak 🔥
                </div>
              </Card>
              <Card className="p-4 text-center">
                <div className="text-3xl font-display font-extrabold text-secondary">
                  {Math.round(totalMinutesThisMonth / 60)}h
                </div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
                  This Month
                </div>
              </Card>
              <Card className="p-4 text-center">
                <div className="text-3xl font-display font-extrabold text-accent">
                  {totalBooksCompleted}
                </div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
                  Books Done
                </div>
              </Card>
              <Card className="p-4 text-center">
                <div className="text-3xl font-display font-extrabold text-primary">
                  {Math.round(totalMinutesAllTime / 60)}h
                </div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
                  All Time
                </div>
              </Card>
            </div>

            {/* Currently Reading */}
            <Card className="p-6">
              <h4 className="font-display text-lg font-bold mb-4 text-primary">
                📖 Currently Reading
              </h4>
              {currentlyReading.length === 0 ? (
                <p className="text-sm text-text-muted italic">No books in progress.</p>
              ) : (
                <div className="space-y-4">
                  {currentlyReading.map((book) => {
                    const progress = book.total_pages
                      ? Math.round((book.pages_read / book.total_pages) * 100)
                      : null;
                    return (
                      <div
                        key={book.id}
                        className="p-4 bg-bg-alt rounded-xl border border-border/50"
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex-1 min-w-0">
                            <h5 className="font-bold text-sm truncate">{book.title}</h5>
                            {book.author && (
                              <p className="text-xs text-text-muted">by {book.author}</p>
                            )}
                          </div>
                          <button
                            onClick={() => handleCompleteBook(book)}
                            className="text-green-600 hover:bg-green-100 p-1 rounded-lg transition-colors text-xs font-bold"
                            title="Mark as finished"
                          >
                            ✓ Done
                          </button>
                        </div>
                        {progress !== null && (
                          <div className="mt-3">
                            <div className="flex justify-between text-[10px] mb-1">
                              <span className="text-text-muted">
                                {book.pages_read} / {book.total_pages} pages
                              </span>
                              <span className="font-bold text-primary">{progress}%</span>
                            </div>
                            <div className="h-2 bg-border rounded-full overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-primary to-primary-light transition-all"
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>

            {/* Legend */}
            <Card className="p-6 bg-primary/5 border-primary/20">
              <h4 className="font-display text-sm font-bold uppercase tracking-wider mb-4 text-primary">
                Reading Intensity
              </h4>
              <div className="flex items-center gap-2 text-xs">
                <div className="w-4 h-4 rounded bg-bg-alt border border-border" />
                <span>0 min</span>
                <div className="w-4 h-4 rounded bg-green-200" />
                <span>&lt;15</span>
                <div className="w-4 h-4 rounded bg-green-300" />
                <span>15-29</span>
                <div className="w-4 h-4 rounded bg-green-400" />
                <span>30-59</span>
                <div className="w-4 h-4 rounded bg-green-500" />
                <span>60+</span>
              </div>
            </Card>
          </div>

          {/* Right Column: Calendar */}
          <div className="lg:col-span-2">
            <Card className="p-4 sm:p-8">
              <div className="flex justify-between items-center mb-8">
                <button
                  onClick={prevMonth}
                  className="p-2 hover:bg-bg-alt rounded-full transition-colors text-xl"
                >
                  ◀
                </button>
                <h3 className="font-display text-xl sm:text-2xl font-bold m-0">
                  {monthName} {currentMonth.getFullYear()}
                </h3>
                <button
                  onClick={nextMonth}
                  className="p-2 hover:bg-bg-alt rounded-full transition-colors text-xl"
                >
                  ▶
                </button>
              </div>

              {/* Day headers */}
              <div className="grid grid-cols-7 gap-2 mb-4">
                {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
                  <div
                    key={i}
                    className="text-center text-[10px] font-bold text-text-muted uppercase tracking-widest py-2"
                  >
                    {d}
                  </div>
                ))}
              </div>

              {/* Calendar grid */}
              <div className="grid grid-cols-7 gap-2">
                {days.map((date, i) => {
                  if (!date) return <div key={i} />;

                  const entry = getEntryForDate(date);
                  const isToday =
                    new Date().toISOString().split('T')[0] === date.toISOString().split('T')[0];

                  return (
                    <button
                      key={i}
                      onClick={() => {
                        if (entry) {
                          // Edit existing entry
                          setEditingEntry(entry);
                          setEntryDate(entry.date.split('T')[0]);
                          setEntryMinutes(String(entry.minutes));
                          setEntryBook(entry.book_title || '');
                          setEntryPages(entry.pages_read ? String(entry.pages_read) : '');
                          setEntryNotes(entry.notes || '');
                        } else {
                          // New entry for this date
                          resetEntryForm();
                          setEntryDate(date.toISOString().split('T')[0]);
                        }
                        setIsEntryModalOpen(true);
                      }}
                      className={`
                        aspect-square rounded-xl flex flex-col items-center justify-center text-sm font-bold transition-all relative group
                        ${entry ? getMinutesColor(entry.minutes) + ' text-white shadow-md' : 'bg-bg-alt text-text-muted hover:border-primary border-2 border-transparent'}
                        ${isToday ? 'ring-2 ring-accent ring-offset-2' : ''}
                      `}
                    >
                      <span>{date.getDate()}</span>
                      {entry && (
                        <span className="text-[9px] opacity-90">{entry.minutes}m</span>
                      )}
                    </button>
                  );
                })}
              </div>

              <p className="text-[10px] text-text-muted italic mt-6 text-center">
                Tap a day to log or edit reading time for {selectedKid?.name || 'this student'}.
              </p>
            </Card>

            {/* Recent Entries */}
            <Card className="mt-8 p-6">
              <h4 className="font-display text-lg font-bold mb-4 text-primary">
                📝 Recent Reading Sessions
              </h4>
              {entries.length === 0 ? (
                <p className="text-sm text-text-muted italic text-center py-8">
                  No reading logged yet. Tap a day on the calendar to start!
                </p>
              ) : (
                <div className="space-y-3 max-h-80 overflow-y-auto">
                  {entries.slice(0, 10).map((entry) => (
                    <div
                      key={entry.id}
                      className="flex items-center justify-between p-4 bg-bg-alt rounded-xl hover:bg-border/50 transition-colors"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-1">
                          <span className="font-bold text-primary">{entry.minutes} min</span>
                          <span className="text-xs text-text-muted">
                            {new Date(entry.date).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                            })}
                          </span>
                        </div>
                        {entry.book_title && (
                          <p className="text-sm text-text-muted">
                            📖 {entry.book_title}
                            {entry.pages_read && ` · ${entry.pages_read} pages`}
                          </p>
                        )}
                        {entry.notes && (
                          <p className="text-xs text-text-muted italic mt-1">
                            &ldquo;{entry.notes}&rdquo;
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => handleDeleteEntry(entry.id)}
                        className="text-red-400 hover:text-red-600 p-2 transition-colors"
                      >
                        🗑️
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </div>

        {/* Print Section */}
        <div className="mt-12 print:hidden">
          <Card className="p-6 bg-blue-50 border-blue-200">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h4 className="font-display font-bold text-lg mb-1">📄 Print Reading Log</h4>
                <p className="text-sm text-text-muted">
                  Generate a printable reading log for your homeschool portfolio.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.print()}
                className="whitespace-nowrap"
              >
                🖨️ Print This Month
              </Button>
            </div>
          </Card>
        </div>
      </main>

      {/* Log Reading Modal */}
      <Modal
        isOpen={isEntryModalOpen}
        onClose={() => setIsEntryModalOpen(false)}
        title={editingEntry ? 'Edit Reading Session' : 'Log Reading'}
        subtitle={`Track reading time for ${selectedKid?.name || 'your student'}`}
      >
        <form onSubmit={handleSaveEntry} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Date"
              type="date"
              value={entryDate}
              onChange={(e) => setEntryDate(e.target.value)}
              required
            />
            <Input
              label="Minutes Read"
              type="number"
              value={entryMinutes}
              onChange={(e) => setEntryMinutes(e.target.value)}
              required
              placeholder="30"
              min="1"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] sm:text-xs font-bold mb-1.5 uppercase tracking-wide text-primary">
                Book (Optional)
              </label>
              <select
                value={entryBook}
                onChange={(e) => setEntryBook(e.target.value)}
                className="w-full px-4 py-3 text-sm rounded-xl border-2 border-border bg-bg focus:border-primary focus:outline-none transition-colors"
              >
                <option value="">Select a book...</option>
                {currentlyReading.map((book) => (
                  <option key={book.id} value={book.title}>
                    {book.title}
                  </option>
                ))}
                <option value="__other__">Other / Not Listed</option>
              </select>
            </div>
            <Input
              label="Pages Read (Optional)"
              type="number"
              value={entryPages}
              onChange={(e) => setEntryPages(e.target.value)}
              placeholder="15"
              min="1"
            />
          </div>

          {entryBook === '__other__' && (
            <Input
              label="Book Title"
              value={entryBook === '__other__' ? '' : entryBook}
              onChange={(e) => setEntryBook(e.target.value)}
              placeholder="Enter book title"
            />
          )}

          <Textarea
            label="Notes (Optional)"
            value={entryNotes}
            onChange={(e) => setEntryNotes(e.target.value)}
            placeholder="What did they read about? Any thoughts?"
          />

          <div className="flex flex-col sm:flex-row justify-end gap-4 mt-8">
            {editingEntry && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  handleDeleteEntry(editingEntry.id);
                  setIsEntryModalOpen(false);
                }}
                className="text-red-500 hover:bg-red-50"
              >
                Delete
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsEntryModalOpen(false)}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button type="submit" className="w-full sm:w-auto">
              {editingEntry ? 'Update' : 'Log Reading'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Add Book Modal */}
      <Modal
        isOpen={isBookModalOpen}
        onClose={() => setIsBookModalOpen(false)}
        title="Add New Book"
        subtitle="Start tracking a book for your reader"
      >
        <form onSubmit={handleSaveBook} className="space-y-4">
          <Input
            label="Book Title"
            value={bookTitle}
            onChange={(e) => setBookTitle(e.target.value)}
            required
            placeholder="e.g. Charlotte's Web"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Author (Optional)"
              value={bookAuthor}
              onChange={(e) => setBookAuthor(e.target.value)}
              placeholder="e.g. E.B. White"
            />
            <Input
              label="Total Pages (Optional)"
              type="number"
              value={bookTotalPages}
              onChange={(e) => setBookTotalPages(e.target.value)}
              placeholder="192"
              min="1"
            />
          </div>

          <div className="flex flex-col sm:flex-row justify-end gap-4 mt-8">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsBookModalOpen(false)}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button type="submit" className="w-full sm:w-auto">
              Add Book
            </Button>
          </div>
        </form>
      </Modal>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          main,
          main * {
            visibility: visible;
          }
          main {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          .print\\:hidden {
            display: none !important;
          }
          header,
          nav,
          button {
            display: none !important;
          }
        }
      `}</style>
    </>
  );
}
