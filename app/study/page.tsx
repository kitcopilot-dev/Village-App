'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getPocketBase } from '@/lib/pocketbase';
import { Child, StudySession } from '@/lib/types';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Select } from '@/components/ui/Input';
import { ClientOnly } from '@/components/ui/ClientOnly';

const SUBJECTS = [
  'Math', 'Reading', 'Writing', 'Science', 'History', 
  'Geography', 'Art', 'Music', 'Physical Education', 
  'Foreign Language', 'Computer Science', 'Other'
];

const POMODORO_WORK = 25 * 60; // 25 minutes
const POMODORO_BREAK = 5 * 60; // 5 minutes

type TimerMode = 'pomodoro' | 'stopwatch';
type PomodoroPhase = 'work' | 'break';

export default function StudyTimerPage() {
  const router = useRouter();
  const pb = getPocketBase();
  
  const [kids, setKids] = useState<Child[]>([]);
  const [sessions, setSessions] = useState<StudySession[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Timer state
  const [selectedChild, setSelectedChild] = useState<string>('');
  const [selectedSubject, setSelectedSubject] = useState<string>('Math');
  const [timerMode, setTimerMode] = useState<TimerMode>('pomodoro');
  const [pomodoroPhase, setPomodoroPhase] = useState<PomodoroPhase>('work');
  const [pomodoroCount, setPomodoroCount] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [time, setTime] = useState(POMODORO_WORK); // For pomodoro (countdown)
  const [elapsed, setElapsed] = useState(0); // For stopwatch (count up)
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<Date | null>(null);

  useEffect(() => {
    if (!pb.authStore.isValid) {
      router.push('/');
      return;
    }
    loadData();
  }, []);

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
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
      if (childRecords.length > 0) {
        setSelectedChild(childRecords[0].id);
      }

      // Load recent sessions (last 7 days)
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      try {
        const sessionRecords = await pb.collection('study_sessions').getFullList({
          filter: `user = "${userId}" && created >= "${weekAgo.toISOString()}"`,
          sort: '-created'
        });
        setSessions(sessionRecords as unknown as StudySession[]);
      } catch (e) {
        console.warn('Study sessions collection may not exist yet');
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

  // Timer tick logic
  const tick = useCallback(() => {
    if (timerMode === 'pomodoro') {
      setTime(prev => {
        if (prev <= 1) {
          // Phase complete
          if (pomodoroPhase === 'work') {
            // Work phase done, start break
            setPomodoroCount(c => c + 1);
            setPomodoroPhase('break');
            playSound('break');
            return POMODORO_BREAK;
          } else {
            // Break done, start work
            setPomodoroPhase('work');
            playSound('work');
            return POMODORO_WORK;
          }
        }
        return prev - 1;
      });
    } else {
      setElapsed(prev => prev + 1);
    }
  }, [timerMode, pomodoroPhase]);

  // Start/Stop timer
  const toggleTimer = async () => {
    if (isRunning) {
      // Stop timer
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setIsRunning(false);
      
      // Save session if we have elapsed time or completed pomodoros
      const totalElapsed = timerMode === 'stopwatch' 
        ? elapsed 
        : (pomodoroCount * POMODORO_WORK) + (pomodoroPhase === 'work' ? (POMODORO_WORK - time) : 0);
      
      if (totalElapsed > 0) {
        await saveSession(totalElapsed);
      }
    } else {
      // Start timer
      startTimeRef.current = new Date();
      setIsRunning(true);
      intervalRef.current = setInterval(tick, 1000);
      
      // Create active session in DB
      try {
        const userId = pb.authStore.model?.id;
        const session = await pb.collection('study_sessions').create({
          user: userId,
          child: selectedChild || null,
          subject: selectedSubject,
          duration: 0,
          start_time: new Date().toISOString(),
          status: 'active',
          pomodoro_count: 0
        });
        setCurrentSessionId(session.id);
      } catch (e) {
        console.warn('Could not create session record');
      }
    }
  };

  // Update interval when tick changes
  useEffect(() => {
    if (isRunning && intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = setInterval(tick, 1000);
    }
  }, [tick, isRunning]);

  const saveSession = async (duration: number) => {
    try {
      const userId = pb.authStore.model?.id;
      
      if (currentSessionId) {
        // Update existing session
        await pb.collection('study_sessions').update(currentSessionId, {
          duration,
          end_time: new Date().toISOString(),
          status: 'completed',
          pomodoro_count: timerMode === 'pomodoro' ? pomodoroCount : 0,
          notes: notes || null
        });
      } else {
        // Create new session
        await pb.collection('study_sessions').create({
          user: userId,
          child: selectedChild || null,
          subject: selectedSubject,
          duration,
          start_time: startTimeRef.current?.toISOString() || new Date().toISOString(),
          end_time: new Date().toISOString(),
          status: 'completed',
          pomodoro_count: timerMode === 'pomodoro' ? pomodoroCount : 0,
          notes: notes || null
        });
      }
      
      // Reload sessions
      loadData();
      
      // Reset timer state
      resetTimer();
    } catch (e) {
      console.error('Failed to save session:', e);
    }
  };

  const resetTimer = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsRunning(false);
    setTime(POMODORO_WORK);
    setElapsed(0);
    setPomodoroPhase('work');
    setPomodoroCount(0);
    setCurrentSessionId(null);
    setNotes('');
  };

  const playSound = (type: 'work' | 'break') => {
    // Simple audio feedback using Web Audio API
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = type === 'break' ? 440 : 880;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.5);
    } catch (e) {
      // Audio not supported
    }
  };

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) {
      return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const formatDuration = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m} min`;
    return `${seconds}s`;
  };

  // Calculate stats
  const today = new Date().toISOString().split('T')[0];
  const todaySessions = sessions.filter(s => s.created.startsWith(today) && s.status === 'completed');
  const totalToday = todaySessions.reduce((sum, s) => sum + (s.duration || 0), 0);
  const totalThisWeek = sessions.filter(s => s.status === 'completed').reduce((sum, s) => sum + (s.duration || 0), 0);
  const pomodorosToday = todaySessions.reduce((sum, s) => sum + (s.pomodoro_count || 0), 0);

  // Group sessions by child for stats
  const statsByChild: Record<string, number> = {};
  sessions.filter(s => s.status === 'completed').forEach(s => {
    const childId = s.child || 'family';
    statsByChild[childId] = (statsByChild[childId] || 0) + (s.duration || 0);
  });

  // Group sessions by subject
  const statsBySubject: Record<string, number> = {};
  sessions.filter(s => s.status === 'completed').forEach(s => {
    statsBySubject[s.subject] = (statsBySubject[s.subject] || 0) + (s.duration || 0);
  });

  if (loading) {
    return (
      <>
        <Header showLogout onLogout={handleLogout} />
        <main className="max-w-4xl mx-auto my-12 px-8">
          <p className="text-center text-text-muted">Loading study timer...</p>
        </main>
      </>
    );
  }

  return (
    <>
      <Header showLogout onLogout={handleLogout} />
      <ClientOnly>
        <main className="max-w-4xl mx-auto my-12 px-8 pb-20 animate-fade-in">
          <div className="flex justify-between items-center mb-8">
            <h2 className="font-display text-4xl sm:text-5xl font-extrabold tracking-tight mb-0">
              ⏱️ Study Timer
            </h2>
            <Button variant="ghost" size="sm" onClick={() => router.push('/dashboard')}>
              ← Dashboard
            </Button>
          </div>

          {/* Timer Card */}
          <Card className="mb-8">
            <div className="text-center mb-8">
              {/* Mode Toggle */}
              <div className="inline-flex rounded-full bg-bg-alt p-1 mb-6">
                <button
                  onClick={() => !isRunning && setTimerMode('pomodoro')}
                  disabled={isRunning}
                  className={`px-6 py-2 rounded-full font-bold text-sm transition-all ${
                    timerMode === 'pomodoro' 
                      ? 'bg-primary text-white shadow-md' 
                      : 'text-text-muted hover:text-text'
                  } ${isRunning ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  🍅 Pomodoro
                </button>
                <button
                  onClick={() => !isRunning && setTimerMode('stopwatch')}
                  disabled={isRunning}
                  className={`px-6 py-2 rounded-full font-bold text-sm transition-all ${
                    timerMode === 'stopwatch' 
                      ? 'bg-primary text-white shadow-md' 
                      : 'text-text-muted hover:text-text'
                  } ${isRunning ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  ⏱️ Stopwatch
                </button>
              </div>

              {/* Timer Display */}
              <div className={`mb-6 ${pomodoroPhase === 'break' ? 'bg-accent/10' : ''} rounded-3xl py-8 px-4 transition-colors`}>
                {timerMode === 'pomodoro' && (
                  <div className="text-sm font-bold uppercase tracking-widest text-text-muted mb-2">
                    {pomodoroPhase === 'work' ? '🎯 Focus Time' : '☕ Break Time'}
                  </div>
                )}
                <div className={`font-display text-7xl sm:text-8xl font-black tracking-tight ${
                  pomodoroPhase === 'break' ? 'text-accent' : 'text-primary'
                } ${isRunning ? 'animate-pulse' : ''}`}>
                  {formatTime(timerMode === 'pomodoro' ? time : elapsed)}
                </div>
                {timerMode === 'pomodoro' && pomodoroCount > 0 && (
                  <div className="mt-4 flex items-center justify-center gap-1">
                    {Array.from({ length: pomodoroCount }).map((_, i) => (
                      <span key={i} className="text-2xl">🍅</span>
                    ))}
                    <span className="text-text-muted ml-2 font-semibold">
                      {pomodoroCount} pomodoro{pomodoroCount !== 1 ? 's' : ''}
                    </span>
                  </div>
                )}
              </div>

              {/* Selectors */}
              <div className="grid sm:grid-cols-2 gap-4 mb-6 max-w-md mx-auto">
                <div>
                  <label className="block text-sm font-bold text-text-muted mb-2">Student</label>
                  <Select
                    value={selectedChild}
                    onChange={(e) => !isRunning && setSelectedChild(e.target.value)}
                    disabled={isRunning}
                    className={isRunning ? 'opacity-50' : ''}
                  >
                    <option value="">Family Session</option>
                    {kids.map(kid => (
                      <option key={kid.id} value={kid.id}>{kid.name}</option>
                    ))}
                  </Select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-text-muted mb-2">Subject</label>
                  <Select
                    value={selectedSubject}
                    onChange={(e) => !isRunning && setSelectedSubject(e.target.value)}
                    disabled={isRunning}
                    className={isRunning ? 'opacity-50' : ''}
                  >
                    {SUBJECTS.map(subject => (
                      <option key={subject} value={subject}>{subject}</option>
                    ))}
                  </Select>
                </div>
              </div>

              {/* Notes (only show when session is active) */}
              {isRunning && (
                <div className="max-w-md mx-auto mb-6">
                  <label className="block text-sm font-bold text-text-muted mb-2">Session Notes (optional)</label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="What are you studying?"
                    className="w-full px-4 py-3 rounded-xl border-2 border-border focus:border-primary focus:outline-none resize-none"
                    rows={2}
                  />
                </div>
              )}

              {/* Control Buttons */}
              <div className="flex justify-center gap-4">
                <Button
                  variant={isRunning ? 'outline' : 'primary'}
                  size="lg"
                  onClick={toggleTimer}
                  className="min-w-[160px] text-lg py-4"
                >
                  {isRunning ? '⏹️ Stop & Save' : '▶️ Start'}
                </Button>
                {(isRunning || elapsed > 0 || time !== POMODORO_WORK) && (
                  <Button
                    variant="ghost"
                    size="lg"
                    onClick={resetTimer}
                    className="text-lg py-4"
                  >
                    🔄 Reset
                  </Button>
                )}
              </div>
            </div>
          </Card>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-bg border-2 border-border rounded-[1.25rem] p-4 text-center hover:border-primary transition-colors">
              <div className="text-2xl mb-2">📚</div>
              <div className="font-display text-2xl font-extrabold text-primary">
                {formatDuration(totalToday)}
              </div>
              <div className="text-xs text-text-muted font-semibold">Today</div>
            </div>
            <div className="bg-bg border-2 border-border rounded-[1.25rem] p-4 text-center hover:border-primary transition-colors">
              <div className="text-2xl mb-2">📅</div>
              <div className="font-display text-2xl font-extrabold text-secondary">
                {formatDuration(totalThisWeek)}
              </div>
              <div className="text-xs text-text-muted font-semibold">This Week</div>
            </div>
            <div className="bg-bg border-2 border-border rounded-[1.25rem] p-4 text-center hover:border-primary transition-colors">
              <div className="text-2xl mb-2">🍅</div>
              <div className="font-display text-2xl font-extrabold text-accent">
                {pomodorosToday}
              </div>
              <div className="text-xs text-text-muted font-semibold">Pomodoros Today</div>
            </div>
            <div className="bg-bg border-2 border-border rounded-[1.25rem] p-4 text-center hover:border-primary transition-colors">
              <div className="text-2xl mb-2">🎯</div>
              <div className="font-display text-2xl font-extrabold text-primary">
                {todaySessions.length}
              </div>
              <div className="text-xs text-text-muted font-semibold">Sessions Today</div>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Time by Subject */}
            <Card>
              <h3 className="font-serif italic text-xl text-primary mb-4">📊 Time by Subject</h3>
              {Object.keys(statsBySubject).length > 0 ? (
                <div className="space-y-3">
                  {Object.entries(statsBySubject)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 6)
                    .map(([subject, duration]) => {
                      const maxDuration = Math.max(...Object.values(statsBySubject));
                      const percentage = (duration / maxDuration) * 100;
                      return (
                        <div key={subject}>
                          <div className="flex justify-between items-center mb-1">
                            <span className="font-semibold text-sm">{subject}</span>
                            <span className="text-xs text-text-muted">{formatDuration(duration)}</span>
                          </div>
                          <div className="w-full bg-bg-alt rounded-full h-2">
                            <div 
                              className="bg-gradient-to-r from-primary to-secondary h-2 rounded-full transition-all"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                </div>
              ) : (
                <p className="text-text-muted text-center py-8">No study sessions yet</p>
              )}
            </Card>

            {/* Time by Student */}
            <Card>
              <h3 className="font-serif italic text-xl text-primary mb-4">👨‍👩‍👧‍👦 Time by Student</h3>
              {Object.keys(statsByChild).length > 0 ? (
                <div className="space-y-3">
                  {Object.entries(statsByChild)
                    .sort((a, b) => b[1] - a[1])
                    .map(([childId, duration]) => {
                      const kid = kids.find(k => k.id === childId);
                      const name = kid?.name || (childId === 'family' ? 'Family Session' : 'Unknown');
                      const maxDuration = Math.max(...Object.values(statsByChild));
                      const percentage = (duration / maxDuration) * 100;
                      return (
                        <div key={childId}>
                          <div className="flex justify-between items-center mb-1">
                            <span className="font-semibold text-sm">{name}</span>
                            <span className="text-xs text-text-muted">{formatDuration(duration)}</span>
                          </div>
                          <div className="w-full bg-bg-alt rounded-full h-2">
                            <div 
                              className="bg-gradient-to-r from-secondary to-accent h-2 rounded-full transition-all"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                </div>
              ) : (
                <p className="text-text-muted text-center py-8">No study sessions yet</p>
              )}
            </Card>
          </div>

          {/* Recent Sessions */}
          <Card className="mt-8">
            <h3 className="font-serif italic text-xl text-primary mb-4">📝 Recent Sessions</h3>
            {sessions.filter(s => s.status === 'completed').length > 0 ? (
              <div className="space-y-3">
                {sessions
                  .filter(s => s.status === 'completed')
                  .slice(0, 10)
                  .map(session => {
                    const kid = kids.find(k => k.id === session.child);
                    const date = new Date(session.created);
                    return (
                      <div 
                        key={session.id}
                        className="flex items-center justify-between p-3 bg-bg-alt rounded-xl hover:bg-border transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                            {session.pomodoro_count && session.pomodoro_count > 0 ? '🍅' : '⏱️'}
                          </div>
                          <div>
                            <p className="font-semibold text-sm m-0">
                              {kid?.name || 'Family'} • {session.subject}
                            </p>
                            <p className="text-xs text-text-muted m-0">
                              {date.toLocaleDateString()} {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              {session.pomodoro_count && session.pomodoro_count > 0 && (
                                <span className="ml-2">• {session.pomodoro_count} 🍅</span>
                              )}
                            </p>
                            {session.notes && (
                              <p className="text-xs text-primary mt-1 m-0 line-clamp-1">{session.notes}</p>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-primary m-0">{formatDuration(session.duration)}</p>
                        </div>
                      </div>
                    );
                  })}
              </div>
            ) : (
              <p className="text-text-muted text-center py-8">
                Start your first study session! 🎯
              </p>
            )}
          </Card>

          {/* Tips Card */}
          <Card className="mt-8 bg-primary/5 border-primary/20">
            <h3 className="font-serif italic text-xl text-primary mb-4">💡 Study Tips</h3>
            <div className="grid sm:grid-cols-2 gap-4 text-sm">
              <div className="flex gap-3">
                <span className="text-xl">🍅</span>
                <div>
                  <p className="font-bold m-0">Pomodoro Technique</p>
                  <p className="text-text-muted m-0">25 min focus, 5 min break. Great for staying fresh!</p>
                </div>
              </div>
              <div className="flex gap-3">
                <span className="text-xl">⏱️</span>
                <div>
                  <p className="font-bold m-0">Stopwatch Mode</p>
                  <p className="text-text-muted m-0">Track longer sessions or project work without interruption.</p>
                </div>
              </div>
              <div className="flex gap-3">
                <span className="text-xl">📝</span>
                <div>
                  <p className="font-bold m-0">Add Notes</p>
                  <p className="text-text-muted m-0">Record what you studied for better documentation.</p>
                </div>
              </div>
              <div className="flex gap-3">
                <span className="text-xl">🎯</span>
                <div>
                  <p className="font-bold m-0">Stay Consistent</p>
                  <p className="text-text-muted m-0">Even 15 minutes daily adds up to big progress!</p>
                </div>
              </div>
            </div>
          </Card>
        </main>
      </ClientOnly>
    </>
  );
}
