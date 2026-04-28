'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getPocketBase } from '@/lib/pocketbase';
import { Child, Course, ActivityLog } from '@/lib/types';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { LoadingScreen } from '@/components/ui/Spinner';
import { Toast } from '@/components/ui/Toast';

type LogType = 'lesson' | 'portfolio' | 'field-trip' | 'note';

interface QuickLogEntry {
  type: LogType;
  childId: string;
  courseId?: string;
  title: string;
  description?: string;
  subject?: string;
  date: string;
  image?: string;
}

export default function QuickLogPage() {
  const router = useRouter();
  const pb = getPocketBase();

  const [kids, setKids] = useState<Child[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<LogType>('lesson');
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);
  const [recentLogs, setRecentLogs] = useState<ActivityLog[]>([]);

  // Form state
  const [selectedKidId, setSelectedKidId] = useState('');
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [subject, setSubject] = useState('');
  const [logDate, setLogDate] = useState(new Date().toISOString().split('T')[0]);
  const [isLogging, setIsLogging] = useState(false);
  const [lastSaved, setLastSaved] = useState<QuickLogEntry | null>(null);

  // Portfolio image state
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  useEffect(() => {
    if (!pb.authStore.isValid) {
      router.push('/');
      return;
    }
    loadData();
  }, []);

  useEffect(() => {
    if (selectedKidId) {
      loadCourses(selectedKidId);
    }
  }, [selectedKidId]);

  // Quick-load last log for one-click repeat
  useEffect(() => {
    if (lastSaved && !selectedKidId) {
      setSelectedKidId(lastSaved.childId);
      setSubject(lastSaved.subject || '');
    }
  }, [lastSaved, selectedKidId]);

  const loadData = async () => {
    try {
      const userId = pb.authStore.model?.id;
      if (!userId) return;

      const [kidRecords, logRecords] = await Promise.all([
        pb.collection('children').getFullList({
          filter: `user = "${userId}"`,
          sort: 'name'
        }),
        pb.collection('activity_logs').getFullList({
          filter: `user = "${userId}"`,
          sort: '-date',
          limit: 10
        }).catch(() => [])
      ]);

      setKids(kidRecords as unknown as Child[]);
      setRecentLogs(logRecords as unknown as ActivityLog[]);

      if (kidRecords.length > 0) {
        setSelectedKidId(kidRecords[0].id);
      }
    } catch (error) {
      console.error('Load error:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCourses = async (kidId: string) => {
    try {
      const courseRecords = await pb.collection('courses').getFullList({
        filter: `child = "${kidId}"`,
        sort: 'name'
      });
      setCourses(courseRecords as unknown as Course[]);
      if (courseRecords.length > 0) {
        setSelectedCourseId(courseRecords[0].id);
      } else {
        setSelectedCourseId('');
      }
    } catch (error) {
      setCourses([]);
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedKidId) {
      setToast({ message: 'Please select a child first.', type: 'error' });
      return;
    }

    setIsLogging(true);

    try {
      const userId = pb.authStore.model?.id;
      if (!userId) return;

      let imageUrl = '';
      if (imageFile) {
        const formData = new FormData();
        formData.append('file', imageFile);
        formData.append('child', selectedKidId);
        formData.append('title', title || `Portfolio item from ${logDate}`);
        formData.append('date', logDate);
        if (subject) formData.append('subject', subject);
        if (description) formData.append('description', description);
        const uploaded = await pb.collection('portfolio_items').create(formData) as any;
        imageUrl = uploaded.image || uploaded.file || '';
      }

      // Determine what to log based on active tab
      let logTitle = title;
      let activityType: string = 'lesson_complete';
      let extraData: Record<string, any> = {};

      switch (activeTab) {
        case 'lesson':
          activityType = 'lesson_complete';
          if (selectedCourseId) {
            const course = courses.find(c => c.id === selectedCourseId);
            if (course) {
              // Increment the course lesson
              const newLesson = Math.min(course.current_lesson + 1, course.total_lessons + 1);
              await pb.collection('courses').update(selectedCourseId, {
                current_lesson: newLesson,
                last_lesson_date: logDate
              });
              logTitle = `${course.name} — Lesson ${newLesson}`;
            }
          }
          break;
        case 'portfolio':
          activityType = 'portfolio_add';
          if (imageUrl) {
            // Create portfolio item
            await pb.collection('portfolio_items').create({
              child: selectedKidId,
              title: title || `Portfolio item from ${logDate}`,
              subject: subject || undefined,
              description: description || undefined,
              image: imageUrl,
              date: logDate
            });
          }
          break;
        case 'field-trip':
          activityType = 'event_join';
          logTitle = `🌍 Field Trip: ${title}`;
          break;
        case 'note':
          activityType = 'portfolio_add';
          logTitle = `📝 Note: ${title}`;
          break;
      }

      // Always create an activity log entry
      const logEntry: any = {
        user: userId,
        child: selectedKidId,
        type: activityType as any,
        title: logTitle,
        description: description || undefined,
        date: new Date(logDate + 'T12:00:00Z').toISOString()
      };

      await pb.collection('activity_logs').create(logEntry);

      // Also create a field trip record if needed
      if (activeTab === 'field-trip' && selectedCourseId) {
        try {
          await pb.collection('field_trips').create({
            user: userId,
            child: selectedKidId,
            title: title,
            location: description || 'Unknown location',
            date: logDate
          }).catch(() => { /* field_trips collection may not exist */ });
        } catch (e) { /* ignore */ }
      }

      setLastSaved({
        type: activeTab,
        childId: selectedKidId,
        courseId: selectedCourseId,
        title: logTitle,
        description,
        subject,
        date: logDate
      });

      setToast({ message: `✅ ${activeTab === 'lesson' ? 'Lesson logged!' : activeTab === 'portfolio' ? 'Portfolio item added!' : activeTab === 'field-trip' ? 'Field trip logged!' : 'Note saved!'}`, type: 'success' });

      // Reset form but keep child selected
      resetForm(true);

      // Refresh recent logs
      loadData();
    } catch (error) {
      console.error('Log error:', error);
      setToast({ message: 'Failed to save. Please try again.', type: 'error' });
    } finally {
      setIsLogging(false);
    }
  };

  const resetForm = (keepChild = false) => {
    if (!keepChild) {
      setSelectedKidId(kids[0]?.id || '');
      setSelectedCourseId('');
    }
    setTitle('');
    setDescription('');
    setSubject('');
    setImageFile(null);
    setImagePreview(null);
  };

  const repeatLastLog = async () => {
    if (!lastSaved) return;

    setSelectedKidId(lastSaved.childId);
    setSubject(lastSaved.subject || '');
    setTitle(lastSaved.title.replace(/.*—\s*/, '')); // strip prefix
    setDescription(lastSaved.description || '');
    setActiveTab(lastSaved.type);
  };

  const getIcon = (type: LogType) => {
    switch (type) {
      case 'lesson': return '📚';
      case 'portfolio': return '🎨';
      case 'field-trip': return '🌍';
      case 'note': return '📝';
    }
  };

  const getLabel = (type: LogType) => {
    switch (type) {
      case 'lesson': return 'Log Lesson';
      case 'portfolio': return 'Add to Portfolio';
      case 'field-trip': return 'Field Trip';
      case 'note': return 'Quick Note';
    }
  };

  if (loading) {
    return <LoadingScreen message="Loading quick log..." />;
  }

  return (
    <>
      <Header showLogout onLogout={() => { pb.authStore.clear(); router.push('/'); }} />
      <main className="max-w-3xl mx-auto my-8 sm:my-12 px-4 sm:px-8 pb-20 animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-8">
          <div>
            <h2 className="font-display text-4xl sm:text-5xl font-extrabold tracking-tight mb-2">⚡ Quick Log</h2>
            <p className="text-text-muted text-sm sm:text-base">Log lessons, portfolio items, field trips, and notes — fast.</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {lastSaved && (
              <Button variant="outline" size="sm" onClick={repeatLastLog} title="Log the same child & subject again">
                🔄 Repeat Last
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => router.push('/dashboard')}>← Dashboard</Button>
          </div>
        </div>

        {kids.length === 0 ? (
          <Card className="text-center py-12">
            <p className="text-text-muted text-lg mb-6">Add children in Manage Kids first.</p>
            <Button onClick={() => router.push('/manage-kids')}>Add Your First Child</Button>
          </Card>
        ) : (
          <form onSubmit={handleLog}>
            {/* Kid Selector — always visible */}
            <Card className="mb-4 p-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {kids.map(kid => (
                  <button
                    key={kid.id}
                    type="button"
                    onClick={() => setSelectedKidId(kid.id)}
                    className={`p-3 rounded-xl text-center transition-all border-2 ${
                      selectedKidId === kid.id
                        ? 'bg-primary text-white border-primary shadow-md scale-105'
                        : 'bg-bg-alt border-border hover:border-primary'
                    }`}
                  >
                    <div className="text-xl mb-1">{getChildEmoji(kid)}</div>
                    <div className="font-bold text-xs truncate">{kid.name}</div>
                    <div className="text-[10px] opacity-70">{kid.grade}</div>
                  </button>
                ))}
              </div>
            </Card>

            {/* Tab Bar */}
            <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
              {(['lesson', 'portfolio', 'field-trip', 'note'] as LogType[]).map(tab => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-all ${
                    activeTab === tab
                      ? 'bg-secondary text-white shadow-md'
                      : 'bg-bg-alt text-text-muted hover:bg-border'
                  }`}
                >
                  <span>{getIcon(tab)}</span>
                  <span>{getLabel(tab)}</span>
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <Card className="p-6 space-y-4">
              {/* Date — always visible */}
              <Input
                label="Date"
                type="date"
                value={logDate}
                onChange={(e) => setLogDate(e.target.value)}
                required
              />

              {/* Course selector for lessons */}
              {activeTab === 'lesson' && (
                <>
                  <Select
                    label="Course (optional — auto-increments lesson)"
                    value={selectedCourseId}
                    onChange={(e) => setSelectedCourseId(e.target.value)}
                  >
                    <option value="">No specific course</option>
                    {courses.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name} (Lesson {c.current_lesson}/{c.total_lessons})
                      </option>
                    ))}
                  </Select>
                  <Input
                    label="What was learned today?"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Completed Chapter 3, practiced multiplication"
                  />
                </>
              )}

              {/* Portfolio fields */}
              {activeTab === 'portfolio' && (
                <>
                  <Input
                    label="Item Title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Rainbow watercolor painting"
                    required
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Input
                      label="Subject / Category"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      placeholder="e.g. Art, Science"
                    />
                    <div>
                      <label className="block text-sm font-semibold mb-2 text-text-muted">Photo (optional)</label>
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={handleImageSelect}
                        className="hidden"
                        id="portfolio-image"
                      />
                      <label
                        htmlFor="portfolio-image"
                        className="flex items-center justify-center gap-2 px-4 py-2 bg-bg-alt border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-primary transition-colors text-sm font-semibold text-text-muted"
                      >
                        {imagePreview ? '📷 Change Photo' : '📷 Add Photo'}
                      </label>
                      {imagePreview && (
                        <div className="mt-2 relative">
                          <img src={imagePreview} alt="Preview" className="w-full h-32 object-cover rounded-xl" />
                          <button
                            type="button"
                            onClick={() => { setImageFile(null); setImagePreview(null); }}
                            className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full text-xs font-bold"
                          >
                            ✕
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}

              {/* Field trip fields */}
              {activeTab === 'field-trip' && (
                <>
                  <Input
                    label="Field Trip Destination"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Natural History Museum"
                    required
                  />
                  <Textarea
                    label="Location & Notes"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="e.g. Downtown location, what they learned..."
                    rows={3}
                  />
                </>
              )}

              {/* Note fields */}
              {activeTab === 'note' && (
                <>
                  <Input
                    label="Note Title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Reading progress update"
                    required
                  />
                  <Textarea
                    label="Details"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Any observations, milestones, or notes..."
                    rows={3}
                  />
                </>
              )}

              {/* Submit */}
              <div className="pt-4 border-t border-border flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => resetForm(true)}
                  className="flex-1"
                >
                  Clear
                </Button>
                <Button
                  type="submit"
                  className="flex-1"
                  disabled={isLogging}
                >
                  {isLogging ? 'Saving...' : `💾 Log ${activeTab === 'lesson' ? 'Lesson' : activeTab === 'portfolio' ? 'Portfolio' : activeTab === 'field-trip' ? 'Field Trip' : 'Note'}`}
                </Button>
              </div>
            </Card>
          </form>
        )}

        {/* Recent Logs */}
        {recentLogs.length > 0 && (
          <div className="mt-8">
            <h3 className="font-serif italic text-2xl text-primary mb-4">Recent Logs</h3>
            <div className="space-y-2">
              {recentLogs.slice(0, 8).map(log => {
                const kid = kids.find(k => k.id === log.child);
                const icon = log.type === 'lesson_complete' ? '📚' : log.type === 'portfolio_add' ? '🎨' : log.type === 'event_join' ? '🌍' : '📝';
                return (
                  <div key={log.id} className="flex items-center gap-3 p-3 bg-bg-alt rounded-xl border border-border hover:border-primary transition-colors">
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-lg flex-shrink-0">
                      {icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{log.title}</p>
                      <p className="text-xs text-text-muted">{kid?.name || 'Unknown'} · {new Date(log.date).toLocaleDateString()}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </>
  );
}

function getChildEmoji(kid: Child) {
  const emojiMap: Record<string, string> = {
    'Emma': '👧',
    'Liam': '👦',
    'Olivia': '👧',
    'Noah': '👦',
    'Sophia': '👧',
    'James': '👦',
    'Ava': '👧',
    'Lucas': '👦',
    'Isabella': '👧',
    'Mia': '👧',
  };
  return emojiMap[kid.name] || (kid.age >= 10 ? '🧑' : '👶');
}