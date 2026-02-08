'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getPocketBase } from '@/lib/pocketbase';
import { Child, Course, PortfolioItem, SchoolYear, SchoolBreak } from '@/lib/types';
import { getExpectedLesson } from '@/lib/calendar-utils';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { LoadingScreen } from '@/components/ui/Spinner';
import { Toast } from '@/components/ui/Toast';

export default function ManageKidsPage() {
  const router = useRouter();
  const pb = getPocketBase();
  
  const [kids, setKids] = useState<Child[]>([]);
  const [selectedKidId, setSelectedKidId] = useState<string | null>(null);
  const [isKidModalOpen, setIsKidModalOpen] = useState(false);
  const [isCourseModalOpen, setIsCourseModalOpen] = useState(false);
  const [editingKid, setEditingKid] = useState<Child | null>(null);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'schedule' | 'portfolio'>('overview');
  const [scheduleDay, setScheduleDay] = useState('Mon');
  const [loading, setLoading] = useState(true);
  const [schoolYear, setSchoolYear] = useState<SchoolYear | null>(null);
  const [breaks, setBreaks] = useState<SchoolBreak[]>([]);
  const [portfolioItems, setPortfolioItems] = useState<PortfolioItem[]>([]);
  const [isPortfolioModalOpen, setIsPortfolioModalOpen] = useState(false);
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);
  const [refreshCount, setRefreshCount] = useState(0);

  // Derived state: Always get the latest kid data from the main list
  const selectedKid = kids.find(k => k.id === selectedKidId) || null;

  // Form states
  const [kidName, setKidName] = useState('');
  const [kidAge, setKidAge] = useState('');
  const [kidGrade, setKidGrade] = useState('Kindergarten');
  const [kidFocus, setKidFocus] = useState('');
  
  const [courseName, setCourseName] = useState('');
  const [totalLessons, setTotalLessons] = useState('180');
  const [currentLesson, setCurrentLesson] = useState('1');
  const [activeDays, setActiveDays] = useState(['Mon', 'Tue', 'Wed', 'Thu', 'Fri']);

  const [portfolioTitle, setPortfolioTitle] = useState('');
  const [portfolioSubject, setPortfolioSubject] = useState('');
  const [portfolioFile, setPortfolioFile] = useState<File | null>(null);

  const toggleDay = (day: string) => {
    setActiveDays(prev => 
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  };

  useEffect(() => {
    if (!pb.authStore.isValid) {
      router.push('/');
      return;
    }
    
    loadKids();
  }, []);

  const loadKids = async () => {
    try {
      const userId = pb.authStore.model?.id;
      if (!userId) {
        setLoading(false);
        return;
      }

      const records = await pb.collection('children').getFullList({
        filter: `user = "${userId}"`,
        sort: 'name'
      });
      
      // Load courses for each child
      const kidsWithCourses = await Promise.all(
        records.map(async (kid) => {
          try {
            const courses = await pb.collection('courses').getFullList({
              filter: `child = "${kid.id}"`,
              sort: 'name'
            });
            return { ...kid, courses } as unknown as Child;
          } catch {
            return { ...kid, courses: [] } as unknown as Child;
          }
        })
      );
      
      setKids(kidsWithCourses);

      // Load school year and breaks once
      if (schoolYear === null) {
        try {
          const years = await pb.collection('school_years').getFullList({
            filter: `user = "${userId}"`,
            sort: '-start_date',
            limit: 1
          });
          if (years.length > 0) {
            setSchoolYear(years[0] as unknown as SchoolYear);
            const breakRecords = await pb.collection('school_breaks').getFullList({
              filter: `school_year = "${years[0].id}"`
            });
            setBreaks(breakRecords as unknown as SchoolBreak[]);
          }
        } catch (e) {
          console.warn('Calendar data failed to load');
        }
      }

      setLoading(false);
    } catch (error) {
      console.error('Kids load error:', error);
      setKids([]);
      setLoading(false);
    }
  };

  const handleLogout = () => {
    pb.authStore.clear();
    router.push('/');
  };

  const loadPortfolio = async (kidId: string) => {
    try {
      const records = await pb.collection('portfolio').getFullList({
        filter: `child = "${kidId}"`,
        sort: '-date'
      });
      setPortfolioItems(records as unknown as PortfolioItem[]);
    } catch (error) {
      console.warn('Portfolio load error:', error);
      setPortfolioItems([]);
    }
  };

  const handleSavePortfolio = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (!selectedKidId) return;

      const formData = new FormData();
      formData.append('child', selectedKidId);
      formData.append('title', portfolioTitle);
      formData.append('subject', portfolioSubject);
      formData.append('date', new Date().toISOString());
      if (portfolioFile) {
        formData.append('image', portfolioFile);
      }

      await pb.collection('portfolio').create(formData);
      
      try {
        const userId = pb.authStore.model?.id;
        if (userId) {
          await pb.collection('activity_logs').create({
            user: userId,
            child: selectedKidId,
            type: 'portfolio_add',
            title: `Added "${portfolioTitle}" to portfolio`,
            date: new Date().toISOString()
          });
        }
      } catch (e) { console.warn('Activity log failed'); }

      setToast({ message: 'Project saved!', type: 'success' });
      setIsPortfolioModalOpen(false);
      setPortfolioTitle('');
      setPortfolioSubject('');
      setPortfolioFile(null);
      loadPortfolio(selectedKidId);
    } catch (error) {
      setToast({ message: 'Failed to save project', type: 'error' });
    }
  };

  const openKidModal = (kid?: Child) => {
    if (kid) {
      setEditingKid(kid);
      setKidName(kid.name);
      setKidAge(kid.age.toString());
      setKidGrade(kid.grade || 'Kindergarten');
      setKidFocus(kid.focus || '');
    } else {
      setEditingKid(null);
      setKidName('');
      setKidAge('');
      setKidGrade('Kindergarten');
      setKidFocus('');
    }
    setIsKidModalOpen(true);
  };

  const openCourseModal = (course?: Course) => {
    if (course) {
      setEditingCourse(course);
      setCourseName(course.name);
      setTotalLessons(course.total_lessons.toString());
      setCurrentLesson(course.current_lesson.toString());
      
      if (typeof course.active_days === 'string') {
        setActiveDays(course.active_days.split(',').filter(d => d.trim() !== ''));
      } else if (Array.isArray(course.active_days)) {
        setActiveDays(course.active_days);
      } else {
        setActiveDays(['Mon', 'Tue', 'Wed', 'Thu', 'Fri']);
      }
    } else {
      setEditingCourse(null);
      setCourseName('');
      setTotalLessons('180');
      setCurrentLesson('1');
      setActiveDays(['Mon', 'Tue', 'Wed', 'Thu', 'Fri']);
    }
    setIsCourseModalOpen(true);
  };

  const handleDeleteCourse = async (courseId: string) => {
    if (!confirm('Are you sure you want to delete this course?')) return;
    try {
      await pb.collection('courses').delete(courseId);
      setToast({ message: 'Course deleted', type: 'success' });
      await loadKids();
    } catch (error) {
      setToast({ message: 'Failed to delete', type: 'error' });
    }
  };

  const handleSaveKid = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const userId = pb.authStore.model?.id;
      if (!userId) return;

      const data = { user: userId, name: kidName, age: parseInt(kidAge), grade: kidGrade, focus: kidFocus };

      if (editingKid) {
        await pb.collection('children').update(editingKid.id, data);
        setToast({ message: `${kidName} updated!`, type: 'success' });
      } else {
        await pb.collection('children').create(data);
        setToast({ message: `${kidName} added!`, type: 'success' });
      }

      setIsKidModalOpen(false);
      setEditingKid(null);
      await loadKids();
    } catch (error) {
      setToast({ message: 'Failed to save', type: 'error' });
    }
  };

  const handleSaveCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (!selectedKidId) return;

      const data = {
        child: selectedKidId,
        name: courseName,
        total_lessons: parseInt(totalLessons),
        current_lesson: parseInt(currentLesson),
        active_days: activeDays.join(',')
      };

      if (editingCourse) {
        await pb.collection('courses').update(editingCourse.id, data);
        setToast({ message: `${courseName} updated!`, type: 'success' });
      } else {
        await pb.collection('courses').create(data);
        setToast({ message: `${courseName} added!`, type: 'success' });
      }

      setIsCourseModalOpen(false);
      setEditingCourse(null);
      
      // Reload kids data from backend
      await loadKids(); 
      setRefreshCount(prev => prev + 1);
    } catch (error) {
      console.error('Save course error:', error);
      setToast({ message: 'Failed to save course', type: 'error' });
    }
  };

  const handleMarkComplete = async (courseId: string, current: number, total: number) => {
    try {
      if (current >= total) return;

      await pb.collection('courses').update(courseId, {
        current_lesson: current + 1,
        last_lesson_date: new Date().toISOString().split('T')[0]
      });

      setToast({ message: 'Lesson recorded!', type: 'success' });
      await loadKids();
    } catch (error) {
      setToast({ message: 'Failed to update progress', type: 'error' });
    }
  };

  const openVault = (kid: Child) => {
    setSelectedKidId(kid.id);
    setActiveTab('overview');
    loadPortfolio(kid.id);
  };

  const closeVault = () => {
    setSelectedKidId(null);
  };

  const getWeekDates = () => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const monday = new Date(today);
    monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
    const fullNames: Record<string, string> = { Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday', Fri: 'Friday' };
    return days.map((day, i) => {
      const date = new Date(monday);
      date.setDate(monday.getDate() + i);
      return { short: day, full: fullNames[day], date: `${date.getMonth() + 1}/${date.getDate()}` };
    });
  };

  const weekDates = getWeekDates();

  const isCourseActiveOnDay = (course: Course, dayShort: string) => {
    // If no days selected, default to all days (safety)
    if (!course.active_days || course.active_days.trim() === "") return true;
    
    // Normalize to array
    const activeDays = typeof course.active_days === 'string' 
      ? course.active_days.split(',').map(d => d.trim()) 
      : Array.isArray(course.active_days) ? course.active_days : [];
      
    return activeDays.includes(dayShort);
  };

  if (loading) {
    return (
      <>
        <Header showLogout onLogout={handleLogout} />
        <main className="max-w-7xl mx-auto my-12 px-8">
          <LoadingScreen message="Loading family profiles..." />
        </main>
      </>
    );
  }

  return (
    <>
      <Header showLogout onLogout={handleLogout} />
      <main className="max-w-7xl mx-auto my-12 px-8 pb-20 animate-fade-in">
        {!selectedKidId ? (
          <div>
            <div className="flex justify-between items-center mb-12 flex-wrap gap-4">
              <div>
                <h2 className="font-display text-5xl font-extrabold tracking-tight mb-2">Family Profiles</h2>
                <p className="text-text-muted">Manage your children&apos;s personalized learning journeys.</p>
              </div>
              <div className="flex gap-4">
                <Button variant="ghost" onClick={() => router.push('/profile')}>🏠 Parent Home</Button>
                <Button onClick={() => openKidModal()}>+ Add Child</Button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {kids.map((kid) => (
                <div key={kid.id} className="bg-card rounded-[2rem] p-10 shadow-sm border border-border hover:-translate-y-2 transition-all relative overflow-hidden flex flex-col before:content-[''] before:absolute before:top-0 before:left-0 before:w-full before:h-1.5 before:bg-primary">
                  <div className="flex items-center gap-5 mb-8">
                    <div className="w-16 h-16 rounded-full bg-bg-alt flex items-center justify-center font-display text-2xl text-primary font-extrabold border-2 border-border">
                      {kid.name.charAt(0)}
                    </div>
                    <div>
                      <h3 className="m-0 font-display text-2xl font-bold">{kid.name}</h3>
                      <span className="text-xs font-bold uppercase px-3 py-1 rounded-full bg-bg-alt text-primary-dark">Age {kid.age} • {kid.grade}</span>
                    </div>
                  </div>
                  <div className="flex gap-3 mt-auto">
                    <button onClick={() => openVault(kid)} className="flex-1 h-11 rounded-xl border border-border bg-bg hover:bg-white hover:border-primary transition-all">📚 Vault</button>
                    <button onClick={() => openKidModal(kid)} className="flex-1 h-11 rounded-xl border border-border bg-bg hover:bg-white hover:border-primary transition-all">✏️ Edit</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div>
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-8">
              <div>
                <h2 className="font-display text-4xl sm:text-5xl font-extrabold tracking-tight mb-2">{selectedKid?.name}&apos;s Learning Vault</h2>
                <p className="text-text-muted">Stored resources and progress.</p>
              </div>
              <Button variant="ghost" onClick={closeVault}>← Back</Button>
            </div>

            <div className="flex gap-6 mb-12 border-b-2 border-border">
              {['overview', 'schedule', 'portfolio'].map((tab) => (
                <button key={tab} className={`font-body font-bold text-base px-0 py-4 border-b-4 transition-all ${activeTab === tab ? 'text-primary border-primary' : 'text-text-muted border-transparent hover:text-primary'}`} onClick={() => setActiveTab(tab as any)}>
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>

            {activeTab === 'overview' && (
              <div key={`overview-${refreshCount}`}>
                <div className="mb-12">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="font-display text-2xl font-extrabold m-0">Course Progress</h3>
                    <Button size="sm" variant="ghost" onClick={() => openCourseModal()}>+ Add Course</Button>
                  </div>
                  <div className="space-y-6">
                    {selectedKid?.courses?.map((course) => {
                      const mapping = schoolYear ? getExpectedLesson(course, schoolYear, breaks) : null;
                      return (
                        <div key={course.id} className="bg-card p-6 rounded-[1.25rem] border border-border group">
                          <div className="flex justify-between items-start mb-4">
                            <div className="flex-1 mr-4">
                              <div className="flex items-center gap-3 mb-1">
                                <h4 className="font-display font-bold m-0">{course.name}</h4>
                                {mapping && (
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${mapping.status === 'ahead' ? 'bg-green-100 text-green-700' : mapping.status === 'behind' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                                    {mapping.status === 'on-track' ? 'On Track' : `${mapping.diff} Lessons ${mapping.status}`}
                                  </span>
                                )}
                                <div className="flex gap-2 ml-auto opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button onClick={() => openCourseModal(course)} className="text-text-muted hover:text-primary">✏️</button>
                                  <button onClick={() => handleDeleteCourse(course.id)} className="text-text-muted hover:text-red-500">🗑️</button>
                                </div>
                              </div>
                              <ProgressBar label={`Lesson ${course.current_lesson} of ${course.total_lessons}`} percentage={(course.current_lesson / course.total_lessons) * 100} />
                              {mapping && <p className="text-[10px] text-text-muted mt-2 m-0">Expected: Lesson {mapping.expectedLesson}</p>}
                            </div>
                            <Button size="sm" variant={course.current_lesson > course.total_lessons ? 'ghost' : 'outline'} disabled={course.current_lesson > course.total_lessons} onClick={() => handleMarkComplete(course.id, course.current_lesson, course.total_lessons)}>
                              {course.current_lesson > course.total_lessons ? '✓ Done' : 'Next Lesson →'}
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'schedule' && (
              <div key={`schedule-${refreshCount}`} className="grid grid-cols-1 sm:grid-cols-5 gap-6">
                {weekDates.map((day) => (
                  <div key={day.short} className="bg-bg-alt p-4 rounded-[1.25rem] border border-border">
                    <h5 className="font-display uppercase tracking-wider text-sm mt-0">{day.short} {day.date}</h5>
                    <div className="space-y-2 mt-4">
                      {selectedKid?.courses?.filter(c => c.current_lesson <= c.total_lessons && isCourseActiveOnDay(c, day.short)).map((course, idx) => (
                        <div key={course.id} className={`bg-white p-3 rounded-lg text-sm border-l-4 ${idx % 2 === 0 ? 'border-primary' : 'border-secondary'}`}>
                          <div className="font-semibold text-xs">{course.name}</div>
                          <div className="text-text-muted text-[10px] mt-1">L{course.current_lesson}/{course.total_lessons}</div>
                        </div>
                      ))}
                      {selectedKid?.courses?.filter(c => c.current_lesson <= c.total_lessons && isCourseActiveOnDay(c, day.short)).length === 0 && (
                        <p className="text-text-muted text-[10px]">No courses scheduled</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'portfolio' && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                <div onClick={() => setIsPortfolioModalOpen(true)} className="aspect-square bg-bg-alt rounded-[1.25rem] flex items-center justify-center flex-col gap-4 border-2 border-dashed border-primary cursor-pointer hover:bg-bg transition-colors">
                  <span className="text-4xl">➕</span>
                  <span className="text-sm font-bold text-primary">Add Project</span>
                </div>
                {portfolioItems.map((item) => (
                  <div key={item.id} className="bg-white rounded-[1.25rem] overflow-hidden border border-border shadow-sm">
                    <div className="h-36 bg-bg-alt bg-cover bg-center flex items-center justify-center text-5xl" style={{ backgroundImage: item.image ? `url(${pb.files.getUrl(item as any, item.image)})` : 'none' }}>
                      {!item.image && '🎨'}
                    </div>
                    <div className="p-6">
                      <h5 className="m-0 font-display text-base">{item.title}</h5>
                      <p className="text-xs mt-2 text-text-muted">{item.subject || 'General'} • {new Date(item.date).toLocaleDateString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      <Modal isOpen={isKidModalOpen} onClose={() => setIsKidModalOpen(false)} title={editingKid ? 'Edit Child' : 'Add a Child'} subtitle="Enter details to personalize their learning experience.">
        <form onSubmit={handleSaveKid} className="space-y-4">
          <Input placeholder="Full Name" value={kidName} onChange={(e) => setKidName(e.target.value)} required />
          <div className="grid grid-cols-2 gap-6">
            <Input type="number" placeholder="Age" value={kidAge} onChange={(e) => setKidAge(e.target.value)} required />
            <Select value={kidGrade} onChange={(e) => setKidGrade(e.target.value)}>
              <option>Preschool</option><option>Kindergarten</option><option>1st Grade</option><option>2nd Grade</option><option>3rd Grade</option><option>4th Grade</option><option>5th Grade</option><option>6th Grade</option><option>7th Grade</option><option>8th Grade</option><option>High School</option>
            </Select>
          </div>
          <Input placeholder="Current Focus" value={kidFocus} onChange={(e) => setKidFocus(e.target.value)} />
          <div className="flex justify-end gap-6 mt-12">
            <Button type="button" variant="outline" onClick={() => setIsKidModalOpen(false)}>Cancel</Button>
            <Button type="submit">Save Profile</Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={isCourseModalOpen} onClose={() => setIsCourseModalOpen(false)} title={editingCourse ? 'Edit Course' : 'Track a New Course'} subtitle="Set up a course to track progress.">
        <form onSubmit={handleSaveCourse} className="space-y-4">
          <Input placeholder="Course Name" value={courseName} onChange={(e) => setCourseName(e.target.value)} required />
          <div className="grid grid-cols-2 gap-6">
            <Input type="number" label="Total Lessons" value={totalLessons} onChange={(e) => setTotalLessons(e.target.value)} required />
            <Input type="number" label="Current Lesson" value={currentLesson} onChange={(e) => setCurrentLesson(e.target.value)} required />
          </div>
          <div className="mt-6">
            <p className="text-sm font-bold text-primary mb-3">Active Days</p>
            <div className="flex flex-wrap gap-2">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map(day => (
                <button key={day} type="button" onClick={() => toggleDay(day)} className={`px-4 py-2 rounded-xl text-xs font-bold border-2 ${activeDays.includes(day) ? 'bg-primary text-white border-primary' : 'bg-bg-alt text-text-muted border-border'}`}>{day}</button>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-6 mt-12">
            <Button type="button" variant="outline" onClick={() => setIsCourseModalOpen(false)}>Cancel</Button>
            <Button type="submit">{editingCourse ? 'Update Course' : 'Add Course'}</Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={isPortfolioModalOpen} onClose={() => setIsPortfolioModalOpen(false)} title="Add to Portfolio" subtitle="Upload a work sample.">
        <form onSubmit={handleSavePortfolio} className="space-y-4">
          <Input placeholder="Project Title" value={portfolioTitle} onChange={(e) => setPortfolioTitle(e.target.value)} required />
          <Input placeholder="Subject" value={portfolioSubject} onChange={(e) => setPortfolioSubject(e.target.value)} />
          <div className="mt-4">
            <label className="block text-sm font-bold text-primary mb-2">Photo / Work Sample</label>
            <input type="file" accept="image/*,.pdf" onChange={(e) => setPortfolioFile(e.target.files?.[0] || null)} className="block w-full text-sm text-text-muted file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-bold file:bg-primary file:text-white" />
          </div>
          <div className="flex justify-end gap-6 mt-12">
            <Button type="button" variant="outline" onClick={() => setIsPortfolioModalOpen(false)}>Cancel</Button>
            <Button type="submit">Save Project</Button>
          </div>
        </form>
      </Modal>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </>
  );
}
