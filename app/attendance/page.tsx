'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getPocketBase } from '@/lib/pocketbase';
import { Child, Attendance, SchoolYear } from '@/lib/types';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { LoadingScreen } from '@/components/ui/Spinner';
import { Toast } from '@/components/ui/Toast';

export default function AttendancePage() {
  const router = useRouter();
  const pb = getPocketBase();
  
  const [kids, setKids] = useState<Child[]>([]);
  const [selectedKidId, setSelectedKidId] = useState('');
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [schoolYear, setSchoolYear] = useState<SchoolYear | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);

  // Calendar state
  const [currentMonth, setCurrentMonth] = useState(new Date());

  useEffect(() => {
    if (!pb.authStore.isValid) {
      router.push('/');
      return;
    }
    loadInitialData();
  }, []);

  useEffect(() => {
    if (selectedKidId) {
      loadAttendance(selectedKidId);
    }
  }, [selectedKidId]);

  const loadInitialData = async () => {
    try {
      const userId = pb.authStore.model?.id;
      if (!userId) return;

      const [kidRecords, yearRecords] = await Promise.all([
        pb.collection('children').getFullList({
          filter: `user = "${userId}"`,
          sort: 'name'
        }),
        pb.collection('school_years').getFullList({
          filter: `user = "${userId}"`,
          sort: '-start_date',
          limit: 1
        })
      ]);

      setKids(kidRecords as unknown as Child[]);
      if (yearRecords.length > 0) {
        setSchoolYear(yearRecords[0] as unknown as SchoolYear);
      }
      
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

  const loadAttendance = async (kidId: string) => {
    try {
      const records = await pb.collection('attendance').getFullList({
        filter: `child = "${kidId}"`,
      });
      setAttendance(records as unknown as Attendance[]);
    } catch (error) {
      console.error('Attendance load error:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleAttendance = async (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    const existing = attendance.find(a => a.date.startsWith(dateStr));
    const userId = pb.authStore.model?.id;

    try {
      if (existing) {
        await pb.collection('attendance').delete(existing.id);
        setAttendance(prev => prev.filter(a => a.id !== existing.id));
      } else {
        const newRecord = await pb.collection('attendance').create({
          user: userId,
          child: selectedKidId,
          date: new Date(dateStr + 'T12:00:00Z'),
          status: 'present'
        });
        setAttendance(prev => [...prev, newRecord as unknown as Attendance]);
      }
    } catch (error) {
      setToast({ message: 'Failed to update attendance', type: 'error' });
    }
  };

  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const generateCalendarDays = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay(); // 0 (Sun) to 6 (Sat)
    const daysInMonth = getDaysInMonth(year, month);
    
    const days = [];
    // Padding for start of month (adjusting to Monday start)
    const padding = firstDay === 0 ? 6 : firstDay - 1;
    for (let i = 0; i < padding; i++) {
      days.push(null);
    }
    
    for (let d = 1; d <= daysInMonth; d++) {
      days.push(new Date(year, month, d));
    }
    
    return days;
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const prevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  if (loading) return <LoadingScreen message="Loading attendance records..." />;

  if (kids.length === 0) {
    return (
      <>
        <Header showLogout onLogout={() => { pb.authStore.clear(); router.push('/'); }} />
        <main className="max-w-4xl mx-auto my-12 px-8 text-center">
          <Card className="py-20">
            <p className="text-xl text-text-muted mb-8 italic font-serif">No children found in your village.</p>
            <Button onClick={() => router.push('/manage-kids')}>Add Your First Child</Button>
          </Card>
        </main>
      </>
    );
  }

  const days = generateCalendarDays();
  const monthName = currentMonth.toLocaleString('default', { month: 'long' });
  const totalDaysThisYear = attendance.length;

  return (
    <>
      <Header showLogout onLogout={() => { pb.authStore.clear(); router.push('/'); }} />
      <main className="max-w-4xl mx-auto my-12 px-4 sm:px-8 pb-24 animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-6 mb-12">
          <div>
            <h2 className="font-display text-4xl sm:text-6xl font-extrabold tracking-tight mb-2">Attendance</h2>
            <p className="text-text-muted text-sm sm:text-base font-serif italic">Tap days to log your homeschooling sessions.</p>
          </div>
          <Button variant="ghost" onClick={() => router.push('/dashboard')}>← Dashboard</Button>
        </div>

        <div className="grid md:grid-cols-3 gap-8 items-start">
          {/* Left Column: Stats & Selector */}
          <div className="md:col-span-1 space-y-6">
            <Card className="p-6">
              <Select 
                label="Student" 
                value={selectedKidId} 
                onChange={(e) => setSelectedKidId(e.target.value)}
              >
                {kids.map(k => <option key={k.id} value={k.id}>{k.name}</option>)}
              </Select>

              <div className="mt-8 text-center">
                <div className="text-5xl font-display font-extrabold text-primary mb-1">{totalDaysThisYear}</div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-text-muted">Days Logged</p>
                {schoolYear && (
                  <p className="text-xs text-text-muted mt-4">
                    Goal: 180 days<br/>
                    ({Math.round((totalDaysThisYear / 180) * 100)}% complete)
                  </p>
                )}
              </div>
            </Card>

            <Card className="p-6 bg-secondary/5 border-secondary/20">
              <h4 className="font-display text-sm font-bold uppercase tracking-wider mb-4 text-secondary">Legend</h4>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded-full bg-primary shadow-sm" />
                  <span className="text-xs font-semibold">School Day</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded-full bg-bg-alt border border-border" />
                  <span className="text-xs font-semibold text-text-muted">No Session</span>
                </div>
              </div>
            </Card>
          </div>

          {/* Right Column: Calendar */}
          <div className="md:col-span-2">
            <Card className="p-4 sm:p-8">
              <div className="flex justify-between items-center mb-8">
                <button onClick={prevMonth} className="p-2 hover:bg-bg-alt rounded-full transition-colors">◀</button>
                <h3 className="font-display text-xl sm:text-2xl font-bold m-0">{monthName} {currentMonth.getFullYear()}</h3>
                <button onClick={nextMonth} className="p-2 hover:bg-bg-alt rounded-full transition-colors">▶</button>
              </div>

              <div className="grid grid-cols-7 gap-2 mb-4">
                {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
                  <div key={i} className="text-center text-[10px] font-bold text-text-muted uppercase tracking-widest py-2">
                    {d}
                  </div>
                ))}
                {days.map((date, i) => {
                  if (!date) return <div key={i} />;
                  
                  const dateStr = date.toISOString().split('T')[0];
                  const isLogged = attendance.some(a => a.date.startsWith(dateStr));
                  const isToday = new Date().toISOString().split('T')[0] === dateStr;
                  const isWeekend = date.getDay() === 0 || date.getDay() === 6;

                  return (
                    <button
                      key={i}
                      onClick={() => toggleAttendance(date)}
                      className={`
                        aspect-square rounded-2xl flex items-center justify-center text-sm font-bold transition-all
                        ${isLogged 
                          ? 'bg-primary text-white shadow-lg scale-105 hover:bg-primary-dark' 
                          : 'bg-bg-alt text-text-muted hover:border-primary border-2 border-transparent'
                        }
                        ${isToday ? 'ring-2 ring-accent ring-offset-2' : ''}
                        ${isWeekend && !isLogged ? 'opacity-40' : ''}
                      `}
                    >
                      {date.getDate()}
                    </button>
                  );
                })}
              </div>
              <p className="text-[10px] text-text-muted italic mt-6 text-center">
                Attendance is automatically saved as you tap.
              </p>
            </Card>
          </div>
        </div>
      </main>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </>
  );
}
