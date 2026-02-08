'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getPocketBase } from '@/lib/pocketbase';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { Toast } from '@/components/ui/Toast';
import { LoadingScreen } from '@/components/ui/Spinner';

interface SchoolYear {
  id: string;
  user: string;
  name: string;
  start_date: string;
  end_date: string;
  created: string;
  updated: string;
}

interface SchoolBreak {
  id: string;
  school_year: string;
  name: string;
  start_date: string;
  end_date: string;
  created: string;
  updated: string;
}

export default function CalendarPage() {
  const router = useRouter();
  const pb = getPocketBase();
  
  const [schoolYears, setSchoolYears] = useState<SchoolYear[]>([]);
  const [selectedYear, setSelectedYear] = useState<SchoolYear | null>(null);
  const [breaks, setBreaks] = useState<SchoolBreak[]>([]);
  const [loading, setLoading] = useState(true);
  const [isYearModalOpen, setIsYearModalOpen] = useState(false);
  const [isBreakModalOpen, setIsBreakModalOpen] = useState(false);
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);

  // Form states
  const [yearName, setYearName] = useState('');
  const [yearStart, setYearStart] = useState('');
  const [yearEnd, setYearEnd] = useState('');
  const [breakName, setBreakName] = useState('');
  const [breakStart, setBreakStart] = useState('');
  const [breakEnd, setBreakEnd] = useState('');

  useEffect(() => {
    if (!pb.authStore.isValid) {
      router.push('/');
      return;
    }
    loadData();
  }, []);

  useEffect(() => {
    if (selectedYear) {
      loadBreaks(selectedYear.id);
    }
  }, [selectedYear]);

  const loadData = async () => {
    try {
      const userId = pb.authStore.model?.id;
      if (!userId) return;

      const yearRecords = await pb.collection('school_years').getFullList({
        filter: `user = "${userId}"`,
        sort: '-start_date'
      });

      setSchoolYears(yearRecords as unknown as SchoolYear[]);
      if (yearRecords.length > 0 && !selectedYear) {
        setSelectedYear(yearRecords[0] as unknown as SchoolYear);
      }
    } catch (error) {
      console.error('Load error:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadBreaks = async (yearId: string) => {
    try {
      const breakRecords = await pb.collection('school_breaks').getFullList({
        filter: `school_year = "${yearId}"`,
        sort: 'start_date'
      });
      setBreaks(breakRecords as unknown as SchoolBreak[]);
    } catch (error) {
      console.error('Breaks load error:', error);
    }
  };

  const handleSaveYear = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const userId = pb.authStore.model?.id;
      if (!userId) return;

      const newYear = await pb.collection('school_years').create({
        user: userId,
        name: yearName,
        start_date: yearStart,
        end_date: yearEnd
      });

      setToast({ message: 'School year created!', type: 'success' });
      setIsYearModalOpen(false);
      resetYearForm();
      loadData();
    } catch (error) {
      console.error('Save error:', error);
      setToast({ message: 'Failed to save school year.', type: 'error' });
    }
  };

  const handleSaveBreak = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedYear) return;

    try {
      await pb.collection('school_breaks').create({
        school_year: selectedYear.id,
        name: breakName,
        start_date: breakStart,
        end_date: breakEnd
      });

      setToast({ message: 'Break added!', type: 'success' });
      setIsBreakModalOpen(false);
      resetBreakForm();
      loadBreaks(selectedYear.id);
    } catch (error) {
      console.error('Save error:', error);
      setToast({ message: 'Failed to save break.', type: 'error' });
    }
  };

  const handleDeleteBreak = async (breakId: string) => {
    if (!confirm('Delete this break?')) return;
    try {
      await pb.collection('school_breaks').delete(breakId);
      setToast({ message: 'Break deleted!', type: 'success' });
      if (selectedYear) loadBreaks(selectedYear.id);
    } catch (error) {
      setToast({ message: 'Failed to delete break.', type: 'error' });
    }
  };

  const resetYearForm = () => {
    setYearName('');
    setYearStart('');
    setYearEnd('');
  };

  const resetBreakForm = () => {
    setBreakName('');
    setBreakStart('');
    setBreakEnd('');
  };

  // Calculate school days
  const calculateSchoolDays = (): number => {
    if (!selectedYear) return 0;
    
    const start = new Date(selectedYear.start_date);
    const end = new Date(selectedYear.end_date);
    let schoolDays = 0;

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dayOfWeek = d.getDay();
      // Skip weekends
      if (dayOfWeek === 0 || dayOfWeek === 6) continue;
      
      // Check if in any break
      const isBreak = breaks.some(b => {
        const bStart = new Date(b.start_date);
        const bEnd = new Date(b.end_date);
        return d >= bStart && d <= bEnd;
      });
      
      if (!isBreak) schoolDays++;
    }

    return schoolDays;
  };

  const totalSchoolDays = calculateSchoolDays();
  const daysElapsed = selectedYear ? Math.max(0, Math.floor((Date.now() - new Date(selectedYear.start_date).getTime()) / (1000 * 60 * 60 * 24))) : 0;
  const daysRemaining = selectedYear ? Math.max(0, Math.floor((new Date(selectedYear.end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))) : 0;

  if (loading) {
    return <LoadingScreen message="Loading calendar..." />;
  }

  return (
    <>
      <Header showLogout onLogout={() => { pb.authStore.clear(); router.push('/'); }} />
      <main className="max-w-7xl mx-auto my-12 px-8 pb-20 animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-8">
          <div>
            <h2 className="font-display text-4xl sm:text-5xl font-extrabold tracking-tight mb-2">School Year Calendar</h2>
            <p className="text-text-muted">Set your academic calendar and track progress</p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setIsYearModalOpen(true)}>
              + New School Year
            </Button>
            <Button variant="ghost" onClick={() => router.push('/dashboard')}>← Dashboard</Button>
          </div>
        </div>

        {schoolYears.length === 0 ? (
          <Card className="text-center py-20">
            <p className="text-text-muted text-lg mb-6">No school years defined yet.</p>
            <Button onClick={() => setIsYearModalOpen(true)}>Create Your First School Year</Button>
          </Card>
        ) : (
          <>
            {/* School Year Selector */}
            <Card className="mb-8 p-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h3 className="font-display text-2xl font-bold mb-1">{selectedYear?.name}</h3>
                  <p className="text-text-muted text-sm">
                    {selectedYear && new Date(selectedYear.start_date).toLocaleDateString()} — {selectedYear && new Date(selectedYear.end_date).toLocaleDateString()}
                  </p>
                </div>
                {schoolYears.length > 1 && (
                  <select 
                    className="px-4 py-2 border-2 border-border rounded-lg bg-bg font-semibold"
                    value={selectedYear?.id || ''}
                    onChange={(e) => {
                      const year = schoolYears.find(y => y.id === e.target.value);
                      if (year) setSelectedYear(year);
                    }}
                  >
                    {schoolYears.map(y => (
                      <option key={y.id} value={y.id}>{y.name}</option>
                    ))}
                  </select>
                )}
              </div>
            </Card>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 mb-8">
              {[
                { label: 'Total School Days', value: totalSchoolDays, emoji: '📅', color: 'text-primary' },
                { label: 'Days Elapsed', value: daysElapsed, emoji: '⏳', color: 'text-secondary' },
                { label: 'Days Remaining', value: daysRemaining, emoji: '🎯', color: 'text-accent' },
                { label: 'Breaks Scheduled', value: breaks.length, emoji: '🏖️', color: 'text-primary' }
              ].map((stat, i) => (
                <div key={i} className="bg-bg border-2 border-border rounded-[1.25rem] p-4 sm:p-6 text-center transition-all hover:border-primary hover:bg-white">
                  <div className="text-2xl sm:text-3xl mb-2">{stat.emoji}</div>
                  <div className={`font-display text-3xl sm:text-4xl font-extrabold ${stat.color}`}>{stat.value}</div>
                  <div className="text-xs sm:text-sm mt-2 text-text-muted font-semibold">{stat.label}</div>
                </div>
              ))}
            </div>

            {/* Breaks Management */}
            <Card>
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-serif italic text-2xl text-primary">Breaks & Holidays</h3>
                <Button size="sm" onClick={() => setIsBreakModalOpen(true)}>+ Add Break</Button>
              </div>

              {breaks.length === 0 ? (
                <div className="text-center py-12 bg-bg-alt rounded-lg border-2 border-dashed border-border">
                  <p className="text-text-muted">No breaks scheduled. Add holidays, winter break, spring break, etc.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {breaks.map(brk => {
                    const start = new Date(brk.start_date);
                    const end = new Date(brk.end_date);
                    const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                    
                    return (
                      <div key={brk.id} className="flex items-center justify-between p-4 bg-bg-alt rounded-lg hover:bg-border transition-colors">
                        <div>
                          <h4 className="font-bold mb-1">{brk.name}</h4>
                          <p className="text-sm text-text-muted">
                            {start.toLocaleDateString()} — {end.toLocaleDateString()} ({days} day{days !== 1 ? 's' : ''})
                          </p>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => handleDeleteBreak(brk.id)}>
                          🗑️
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>

            {/* Info Box */}
            <Card className="mt-8 bg-blue-50 border-blue-200">
              <h4 className="font-display font-bold text-lg mb-3">💡 How It Works</h4>
              <ul className="space-y-2 text-sm text-text-muted">
                <li>• <strong>School Days:</strong> Calculated as weekdays (Mon-Fri) minus scheduled breaks</li>
                <li>• <strong>Lesson Mapping:</strong> Courses will auto-schedule based on their "Active Days" setting</li>
                <li>• <strong>Progress Tracking:</strong> Dashboard will show if students are ahead or behind schedule</li>
                <li>• <strong>Breaks:</strong> Any dates marked as breaks are excluded from lesson scheduling</li>
              </ul>
            </Card>
          </>
        )}
      </main>

      {/* New School Year Modal */}
      <Modal 
        isOpen={isYearModalOpen} 
        onClose={() => setIsYearModalOpen(false)} 
        title="New School Year"
        subtitle="Define your academic year dates"
      >
        <form onSubmit={handleSaveYear} className="space-y-4">
          <Input 
            label="Name" 
            value={yearName} 
            onChange={(e) => setYearName(e.target.value)} 
            required 
            placeholder="e.g. 2024-2025" 
          />
          <div className="grid grid-cols-2 gap-4">
            <Input 
              label="Start Date" 
              type="date" 
              value={yearStart} 
              onChange={(e) => setYearStart(e.target.value)} 
              required 
            />
            <Input 
              label="End Date" 
              type="date" 
              value={yearEnd} 
              onChange={(e) => setYearEnd(e.target.value)} 
              required 
            />
          </div>
          
          <div className="flex justify-end gap-4 mt-8">
            <Button type="button" variant="outline" onClick={() => setIsYearModalOpen(false)}>Cancel</Button>
            <Button type="submit">Create School Year</Button>
          </div>
        </form>
      </Modal>

      {/* New Break Modal */}
      <Modal 
        isOpen={isBreakModalOpen} 
        onClose={() => setIsBreakModalOpen(false)} 
        title="Add Break / Holiday"
        subtitle="Define dates when school is not in session"
      >
        <form onSubmit={handleSaveBreak} className="space-y-4">
          <Input 
            label="Name" 
            value={breakName} 
            onChange={(e) => setBreakName(e.target.value)} 
            required 
            placeholder="e.g. Winter Break, Thanksgiving" 
          />
          <div className="grid grid-cols-2 gap-4">
            <Input 
              label="Start Date" 
              type="date" 
              value={breakStart} 
              onChange={(e) => setBreakStart(e.target.value)} 
              required 
            />
            <Input 
              label="End Date" 
              type="date" 
              value={breakEnd} 
              onChange={(e) => setBreakEnd(e.target.value)} 
              required 
            />
          </div>
          
          <div className="flex justify-end gap-4 mt-8">
            <Button type="button" variant="outline" onClick={() => setIsBreakModalOpen(false)}>Cancel</Button>
            <Button type="submit">Add Break</Button>
          </div>
        </form>
      </Modal>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </>
  );
}
