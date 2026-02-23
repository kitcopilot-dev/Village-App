'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getPocketBase } from '@/lib/pocketbase';
import { Child, Course } from '@/lib/types';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ClientOnly } from '@/components/ui/ClientOnly';

interface StudySession {
  id: string;
  user: string;
  child: string;
  subject?: string;
  duration_minutes: number;
  started_at: string;
  completed_at?: string;
  created: string;
  updated: string;
}

interface ChildWithCourses extends Child {
  courses: Course[];
}

type TimerMode = 'focus' | 'break' | 'idle';

const PRESETS = [
  { label: '15m', minutes: 15, description: 'Quick focus' },
  { label: '25m', minutes: 25, description: 'Pomodoro' },
  { label: '45m', minutes: 45, description: 'Deep work' },
  { label: '60m', minutes: 60, description: 'Extended' },
];

const BREAK_DURATION = 5; // minutes

export default function StudyTimerPage() {
  const router = useRouter();
  const pb = getPocketBase();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  
  const [kids, setKids] = useState<ChildWithCourses[]>([]);
  const [sessions, setSessions] = useState<StudySession[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Timer state
  const [selectedChild, setSelectedChild] = useState<string>('');
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [selectedDuration, setSelectedDuration] = useState<number>(25);
  const [timeRemaining, setTimeRemaining] = useState<number>(25 * 60); // seconds
  const [isRunning, setIsRunning] = useState(false);
  const [mode, setMode] = useState<TimerMode>('idle');
  const [sessionStartTime, setSessionStartTime] = useState<Date | null>(null);
  const [showCelebration, setShowCelebration] = useState(false);
  
  // Stats
  const [todayMinutes, setTodayMinutes] = useState(0);
  const [weekMinutes, setWeekMinutes] = useState(0);
  const [currentStreak, setCurrentStreak] = useState(0);
  const [sessionsCompleted, setSessionsCompleted] = useState(0);

  useEffect(() => {
    if (!pb.authStore.isValid) {
      router.push('/');
      return;
    }
    loadData();
    
    // Create audio element for notification
    if (typeof window !== 'undefined') {
      audioRef.current = new Audio('data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YU'+Array(200).join('AAAAgP8A'));
    }
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  // Timer logic
  useEffect(() => {
    if (isRunning && timeRemaining > 0) {
      intervalRef.current = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            handleTimerComplete();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isRunning, timeRemaining]);

  const loadData = async () => {
    try {
      const userId = pb.authStore.model?.id;
      if (!userId) return;

      // Load children with courses
      const childRecords = await pb.collection('children').getFullList({
        filter: `user = "${userId}"`,
        sort: 'name'
      });

      const kidsWithCourses = await Promise.all(
        childRecords.map(async (kid) => {
          try {
            const courses = await pb.collection('courses').getFullList({
              filter: `child = "${kid.id}"`,
              sort: 'name'
            });
            return { ...kid, courses } as unknown as ChildWithCourses;
          } catch {
            return { ...kid, courses: [] } as unknown as ChildWithCourses;
          }
        })
      );

      setKids(kidsWithCourses);
      if (kidsWithCourses.length > 0) {
        setSelectedChild(kidsWithCourses[0].id);
      }

      // Try to load study sessions
      try {
        const sessionRecords = await pb.collection('study_sessions').getFullList({
          filter: `user = "${userId}"`,
          sort: '-started_at'
        });
        setSessions(sessionRecords as unknown as StudySession[]);
        calculateStats(sessionRecords as unknown as StudySession[]);
      } catch (e) {
        console.warn('Study sessions collection not found, will create on first use');
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (sessionList: StudySession[]) => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    
    let todayMins = 0;
    let weekMins = 0;
    let completed = 0;
    
    sessionList.forEach(session => {
      if (session.completed_at) {
        completed++;
        const sessionDate = new Date(session.started_at);
        
        if (sessionDate >= todayStart) {
          todayMins += session.duration_minutes;
        }
        if (sessionDate >= weekStart) {
          weekMins += session.duration_minutes;
        }
      }
    });
    
    setTodayMinutes(todayMins);
    setWeekMinutes(weekMins);
    setSessionsCompleted(completed);
    
    // Calculate streak (consecutive days with at least one session)
    const daySet = new Set<string>();
    sessionList
      .filter(s => s.completed_at)
      .forEach(s => {
        const d = new Date(s.started_at);
        daySet.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
      });
    
    let streak = 0;
    const checkDate = new Date(todayStart);
    while (daySet.has(`${checkDate.getFullYear()}-${checkDate.getMonth()}-${checkDate.getDate()}`)) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    }
    setCurrentStreak(streak);
  };

  const handleTimerComplete = async () => {
    setIsRunning(false);
    
    // Play notification sound
    if (audioRef.current) {
      try {
        audioRef.current.play();
      } catch (e) {
        console.warn('Could not play audio');
      }
    }
    
    // Browser notification
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('🎉 Study Session Complete!', {
        body: mode === 'focus' ? 'Great job! Take a short break.' : 'Break time is over. Ready for another session?',
        icon: '/favicon.ico'
      });
    }
    
    if (mode === 'focus') {
      // Save the completed session
      await saveSession();
      setShowCelebration(true);
      setTimeout(() => setShowCelebration(false), 3000);
      
      // Switch to break mode
      setMode('break');
      setTimeRemaining(BREAK_DURATION * 60);
    } else {
      // Break complete, back to idle
      setMode('idle');
      setTimeRemaining(selectedDuration * 60);
    }
  };

  const saveSession = async () => {
    try {
      const userId = pb.authStore.model?.id;
      if (!userId || !sessionStartTime) return;
      
      const session = await pb.collection('study_sessions').create({
        user: userId,
        child: selectedChild || undefined,
        subject: selectedSubject || undefined,
        duration_minutes: selectedDuration,
        started_at: sessionStartTime.toISOString(),
        completed_at: new Date().toISOString()
      });
      
      const newSessions = [session as unknown as StudySession, ...sessions];
      setSessions(newSessions);
      calculateStats(newSessions);
    } catch (error) {
      console.error('Failed to save session:', error);
      // Still update local state even if save fails
      setSessionsCompleted(prev => prev + 1);
      setTodayMinutes(prev => prev + selectedDuration);
      setWeekMinutes(prev => prev + selectedDuration);
    }
  };

  const startTimer = () => {
    if (mode === 'idle') {
      setMode('focus');
      setTimeRemaining(selectedDuration * 60);
      setSessionStartTime(new Date());
    }
    setIsRunning(true);
    
    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  };

  const pauseTimer = () => {
    setIsRunning(false);
  };

  const resetTimer = () => {
    setIsRunning(false);
    setMode('idle');
    setTimeRemaining(selectedDuration * 60);
    setSessionStartTime(null);
  };

  const skipBreak = () => {
    setMode('idle');
    setIsRunning(false);
    setTimeRemaining(selectedDuration * 60);
  };

  const handleLogout = () => {
    pb.authStore.clear();
    router.push('/');
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formatMinutes = (mins: number) => {
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    const remaining = mins % 60;
    return remaining > 0 ? `${hours}h ${remaining}m` : `${hours}h`;
  };

  // Get unique subjects from all kids' courses
  const allSubjects = Array.from(new Set(
    kids.flatMap(kid => kid.courses.map(c => c.name))
  )).sort();

  const progressPercentage = mode === 'idle' 
    ? 0 
    : mode === 'focus'
      ? ((selectedDuration * 60 - timeRemaining) / (selectedDuration * 60)) * 100
      : ((BREAK_DURATION * 60 - timeRemaining) / (BREAK_DURATION * 60)) * 100;

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
        <main className="max-w-4xl mx-auto my-12 px-6 pb-20 animate-fade-in">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-8">
            <div>
              <h2 className="font-display text-4xl sm:text-5xl font-extrabold tracking-tight mb-2">
                Study Timer
              </h2>
              <p className="text-text-muted">
                Focus mode for productive study sessions
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => router.push('/dashboard')}>
              ← Dashboard
            </Button>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[
              { label: 'Today', value: formatMinutes(todayMinutes), emoji: '📚', color: 'text-primary' },
              { label: 'This Week', value: formatMinutes(weekMinutes), emoji: '📅', color: 'text-secondary' },
              { label: 'Sessions', value: sessionsCompleted, emoji: '✅', color: 'text-accent' },
              { label: 'Streak', value: `${currentStreak} day${currentStreak !== 1 ? 's' : ''}`, emoji: '🔥', color: 'text-primary' }
            ].map((stat, i) => (
              <div key={i} className="bg-bg border-2 border-border rounded-xl p-4 text-center transition-all hover:border-primary hover:bg-white">
                <div className="text-xl mb-1">{stat.emoji}</div>
                <div className={`font-display text-2xl font-extrabold ${stat.color}`}>{stat.value}</div>
                <div className="text-xs text-text-muted font-semibold">{stat.label}</div>
              </div>
            ))}
          </div>

          {/* Timer Card */}
          <Card className="text-center mb-8 relative overflow-hidden">
            {/* Celebration Animation */}
            {showCelebration && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/90 z-10 animate-fade-in">
                <div className="text-center">
                  <div className="text-7xl mb-4 animate-bounce">🎉</div>
                  <h3 className="font-display text-3xl font-bold text-primary mb-2">Session Complete!</h3>
                  <p className="text-text-muted">Great focus! Take a {BREAK_DURATION} minute break.</p>
                </div>
              </div>
            )}

            {/* Progress Ring Background */}
            <div className="relative w-64 h-64 mx-auto mb-6">
              <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="45"
                  fill="none"
                  stroke="var(--border)"
                  strokeWidth="8"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="45"
                  fill="none"
                  stroke={mode === 'break' ? 'var(--accent)' : 'var(--primary)'}
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={`${progressPercentage * 2.83} 283`}
                  className="transition-all duration-1000"
                />
              </svg>
              
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="font-display text-6xl font-extrabold text-primary tracking-tight">
                  {formatTime(timeRemaining)}
                </span>
                <span className={`text-sm font-semibold uppercase tracking-wider ${
                  mode === 'break' ? 'text-accent' : mode === 'focus' ? 'text-primary' : 'text-text-muted'
                }`}>
                  {mode === 'break' ? '☕ Break Time' : mode === 'focus' ? '🧠 Focus Mode' : 'Ready'}
                </span>
              </div>
            </div>

            {/* Duration Presets (only show when idle) */}
            {mode === 'idle' && (
              <div className="flex justify-center gap-2 mb-6 flex-wrap">
                {PRESETS.map(preset => (
                  <button
                    key={preset.minutes}
                    onClick={() => {
                      setSelectedDuration(preset.minutes);
                      setTimeRemaining(preset.minutes * 60);
                    }}
                    className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all ${
                      selectedDuration === preset.minutes
                        ? 'bg-primary text-white'
                        : 'bg-bg-alt text-text-muted hover:bg-border hover:text-text'
                    }`}
                    title={preset.description}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            )}

            {/* Child & Subject Selection (only show when idle) */}
            {mode === 'idle' && kids.length > 0 && (
              <div className="flex flex-col sm:flex-row gap-4 justify-center mb-6">
                <div>
                  <label className="block text-xs font-semibold text-text-muted mb-1">WHO&apos;S STUDYING</label>
                  <select
                    value={selectedChild}
                    onChange={(e) => setSelectedChild(e.target.value)}
                    className="px-4 py-2 rounded-lg border-2 border-border bg-white font-semibold text-sm focus:border-primary focus:outline-none min-w-[150px]"
                  >
                    <option value="">Anyone</option>
                    {kids.map(kid => (
                      <option key={kid.id} value={kid.id}>{kid.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-muted mb-1">SUBJECT (OPTIONAL)</label>
                  <select
                    value={selectedSubject}
                    onChange={(e) => setSelectedSubject(e.target.value)}
                    className="px-4 py-2 rounded-lg border-2 border-border bg-white font-semibold text-sm focus:border-primary focus:outline-none min-w-[150px]"
                  >
                    <option value="">General Study</option>
                    {allSubjects.map(subject => (
                      <option key={subject} value={subject}>{subject}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* Timer Controls */}
            <div className="flex justify-center gap-4">
              {mode === 'idle' ? (
                <Button onClick={startTimer} className="px-8 py-3 text-lg">
                  ▶️ Start Focus Session
                </Button>
              ) : (
                <>
                  {isRunning ? (
                    <Button onClick={pauseTimer} variant="outline" className="px-6">
                      ⏸️ Pause
                    </Button>
                  ) : (
                    <Button onClick={startTimer} className="px-6">
                      ▶️ Resume
                    </Button>
                  )}
                  <Button onClick={resetTimer} variant="outline" className="px-6">
                    ↩️ Reset
                  </Button>
                  {mode === 'break' && (
                    <Button onClick={skipBreak} variant="ghost" className="px-6">
                      Skip Break →
                    </Button>
                  )}
                </>
              )}
            </div>
          </Card>

          {/* Recent Sessions */}
          <Card>
            <h3 className="font-serif italic text-2xl text-primary mb-6">Recent Sessions</h3>
            {sessions.length > 0 ? (
              <div className="space-y-3 max-h-[300px] overflow-y-auto">
                {sessions.slice(0, 10).map(session => {
                  const kid = kids.find(k => k.id === session.child);
                  const sessionDate = new Date(session.started_at);
                  const isToday = sessionDate.toDateString() === new Date().toDateString();
                  
                  return (
                    <div 
                      key={session.id}
                      className="flex items-center justify-between p-3 bg-bg-alt rounded-xl"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${
                          session.completed_at ? 'bg-green-100' : 'bg-yellow-100'
                        }`}>
                          {session.completed_at ? '✅' : '⏳'}
                        </div>
                        <div>
                          <p className="font-semibold text-sm m-0">
                            {kid?.name || 'Study Session'}
                            {session.subject && <span className="text-text-muted"> • {session.subject}</span>}
                          </p>
                          <p className="text-xs text-text-muted m-0">
                            {isToday ? 'Today' : sessionDate.toLocaleDateString()} at {sessionDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-display font-bold text-primary m-0">{session.duration_minutes}m</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-text-muted text-center py-8">
                No study sessions yet. Start your first focus session above! 🎯
              </p>
            )}
          </Card>

          {/* Tips Card */}
          <Card className="mt-8 bg-accent-soft/30">
            <h3 className="font-display font-bold text-lg text-primary mb-4">💡 Study Tips</h3>
            <ul className="space-y-2 text-sm text-text-muted">
              <li>• <strong>Pomodoro Technique:</strong> 25 minutes of focused work, followed by a 5-minute break</li>
              <li>• <strong>Remove distractions:</strong> Put phones away and close unnecessary tabs</li>
              <li>• <strong>Take real breaks:</strong> Stretch, get water, look away from screens</li>
              <li>• <strong>Consistency beats intensity:</strong> Regular short sessions are better than rare long ones</li>
            </ul>
          </Card>
        </main>
      </ClientOnly>
    </>
  );
}
