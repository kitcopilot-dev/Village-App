'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { getPocketBase } from '@/lib/pocketbase';
import { Child } from '@/lib/types';
import { Header } from '@/components/Header';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Input';

type TimerMode = 'pomodoro' | 'stopwatch';
type TimerStatus = 'idle' | 'running' | 'paused' | 'break';
type StudySession = {
  id: string;
  childId: string;
  childName?: string;
  subject: string;
  duration: number;
  mode: TimerMode;
  startTime: string;
  endTime?: string;
  pomodoroCount: number;
};

export default function StudyTimerPage() {
  const router = useRouter();
  const pb = getPocketBase();
  
  const [kids, setKids] = useState<Child[]>([]);
  const [selectedKidId, setSelectedKidId] = useState('');
  const [subject, setSubject] = useState('');
  
  // Timer state
  const [mode, setMode] = useState<TimerMode>('pomodoro');
  const [status, setStatus] = useState<TimerStatus>('idle');
  const [timeLeft, setTimeLeft] = useState(25 * 60); // seconds
  const [totalTime, setTotalTime] = useState(0);
  const [pomodoroCount, setPomodoroCount] = useState(0);
  
  // Sessions history
  const [sessions, setSessions] = useState<StudySession[]>([]);
  const [todayTotal, setTodayTotal] = useState(0);
  const [weekTotal, setWeekTotal] = useState(0);
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const sessionStartRef = useRef<string | null>(null);

  useEffect(() => {
    if (!pb.authStore.isValid) {
      router.push('/');
      return;
    }
    loadKids();
    loadSessions();
  }, []);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const loadKids = async () => {
    try {
      const userId = pb.authStore.model?.id;
      if (!userId) return;
      
      const kidRecords = await pb.collection('children').getFullList({
        filter: `user = "${userId}"`,
        sort: 'name'
      });
      
      setKids(kidRecords as unknown as Child[]);
      if (kidRecords.length > 0) {
        setSelectedKidId(kidRecords[0].id);
        const kid = kidRecords[0] as unknown as Child;
        setSubject(kid.focus || 'General');
      }
    } catch (error) {
      console.error('Failed to load kids:', error);
    }
  };

  const loadSessions = () => {
    try {
      const stored = localStorage.getItem('village_study_sessions');
      if (stored) {
        const allSessions: StudySession[] = JSON.parse(stored);
        setSessions(allSessions.slice(0, 10)); // Last 10 sessions
        
        // Calculate today's total
        const today = new Date().toDateString();
        const todaySeconds = allSessions
          .filter(s => new Date(s.startTime).toDateString() === today)
          .reduce((acc, s) => acc + s.duration, 0);
        setTodayTotal(todaySeconds);
        
        // Calculate week's total
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        const weekSeconds = allSessions
          .filter(s => new Date(s.startTime) >= weekAgo)
          .reduce((acc, s) => acc + s.duration, 0);
        setWeekTotal(weekSeconds);
      }
    } catch (e) {
      console.error('Failed to load sessions:', e);
    }
  };

  const startTimer = () => {
    if (!selectedKidId) {
      alert('Please select a child first');
      return;
    }
    
    const now = new Date().toISOString();
    sessionStartRef.current = now;
    
    if (mode === 'pomodoro') {
      setTimeLeft(25 * 60);
    } else {
      setTimeLeft(0);
    }
    
    setStatus('running');
    
    intervalRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (mode === 'pomodoro') {
          if (prev <= 1) {
            // Time's up!
            handlePomodoroComplete();
            return 0;
          }
          return prev - 1;
        } else {
          // Stopwatch mode
          setTotalTime(t => t + 1);
          return prev + 1;
        }
      });
    }, 1000);
  };

  const pauseTimer = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setStatus('paused');
  };

  const resumeTimer = () => {
    setStatus('running');
    intervalRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (mode === 'pomodoro') {
          if (prev <= 1) {
            handlePomodoroComplete();
            return 0;
          }
          return prev - 1;
        } else {
          setTotalTime(t => t + 1);
          return prev + 1;
        }
      });
    }, 1000);
  };

  const handlePomodoroComplete = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    const newCount = pomodoroCount + 1;
    setPomodoroCount(newCount);
    
    // Auto-save session
    saveSession(mode === 'pomodoro' ? 25 * 60 : totalTime);
    
    // Start break
    if (newCount % 4 === 0) {
      // Long break after 4 pomodoros
      setTimeLeft(15 * 60);
      setStatus('break');
    } else {
      // Short break
      setTimeLeft(5 * 60);
      setStatus('break');
    }
    
    // Break timer
    intervalRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          setStatus('idle');
          setTimeLeft(25 * 60);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const stopTimer = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    const duration = mode === 'pomodoro' ? (25 * 60) - timeLeft : totalTime;
    if (duration > 0) {
      saveSession(duration);
    }
    
    setStatus('idle');
    setTimeLeft(mode === 'pomodoro' ? 25 * 60 : 0);
    setTotalTime(0);
  };

  const saveSession = (duration: number) => {
    if (!sessionStartRef.current) return;
    
    const kid = kids.find(k => k.id === selectedKidId);
    const newSession: StudySession = {
      id: Date.now().toString(),
      childId: selectedKidId,
      childName: kid?.name,
      subject,
      duration,
      mode,
      startTime: sessionStartRef.current,
      endTime: new Date().toISOString(),
      pomodoroCount: mode === 'pomodoro' ? 1 : 0
    };
    
    const stored = localStorage.getItem('village_study_sessions');
    const allSessions: StudySession[] = stored ? JSON.parse(stored) : [];
    allSessions.unshift(newSession);
    localStorage.setItem('village_study_sessions', JSON.stringify(allSessions));
    
    loadSessions();
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  if (!pb.authStore.isValid) {
    return null;
  }

  return (
    <>
      <Header />
      <main className="max-w-3xl mx-auto my-12 px-4 sm:px-8 pb-24">
        <div className="text-center mb-12">
          <h1 className="font-display text-4xl sm:text-5xl font-extrabold tracking-tight mb-2">
            ⏱️ Study <span className="text-primary">Timer</span>
          </h1>
          <p className="text-text-muted text-base font-serif italic">
            {mode === 'pomodoro' ? 'Pomodoro Mode (25 min focus / 5 min break)' : 'Stopwatch Mode'}
          </p>
        </div>

        {/* Mode Selection */}
        <div className="flex justify-center gap-4 mb-8">
          <Button 
            variant={mode === 'pomodoro' ? 'primary' : 'outline'} 
            onClick={() => { setMode('pomodoro'); setTimeLeft(25 * 60); }}
            disabled={status === 'running'}
          >
            🍅 Pomodoro
          </Button>
          <Button 
            variant={mode === 'stopwatch' ? 'primary' : 'outline'} 
            onClick={() => { setMode('stopwatch'); setTimeLeft(0); }}
            disabled={status === 'running'}
          >
            ⏱️ Stopwatch
          </Button>
        </div>

        {/* Kid & Subject Selection */}
        <Card className="mb-8 p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-text-muted mb-2">Student</label>
              <Select
                value={selectedKidId}
                onChange={(e) => {
                  setSelectedKidId(e.target.value);
                  const kid = kids.find(k => k.id === e.target.value);
                  if (kid) setSubject(kid.focus || 'General');
                }}
                disabled={status === 'running'}
              >
                {kids.map(kid => (
                  <option key={kid.id} value={kid.id}>{kid.name}</option>
                ))}
              </Select>
            </div>
            <div>
              <label className="block text-sm font-bold text-text-muted mb-2">Subject</label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                disabled={status === 'running'}
                className="w-full px-4 py-3 rounded-xl border-2 border-border bg-bg focus:border-primary focus:outline-none transition-colors font-semibold"
                placeholder="Math, Reading, Science..."
              />
            </div>
          </div>
        </Card>

        {/* Timer Display */}
        <Card className="mb-8 p-12 text-center">
          <div className={`font-display text-7xl sm:text-8xl font-extrabold mb-4 ${
            status === 'break' ? 'text-accent' : 
            timeLeft < 60 && status === 'running' ? 'text-red-500' : 
            'text-primary'
          }`}>
            {mode === 'pomodoro' ? formatTime(timeLeft) : formatTime(totalTime)}
          </div>
          
          {status === 'break' && (
            <div className="text-accent text-xl font-bold mb-4">☕ Break Time!</div>
          )}
          
          {mode === 'pomodoro' && pomodoroCount > 0 && (
            <div className="text-text-muted text-lg font-semibold mb-4">
              🍅 {pomodoroCount} pomodoro{pomodoroCount !== 1 ? 's' : ''} completed
            </div>
          )}
          
          <div className="flex justify-center gap-4">
            {status === 'idle' && (
              <Button size="lg" onClick={startTimer}>Start</Button>
            )}
            {status === 'running' && (
              <>
                <Button variant="outline" size="lg" onClick={pauseTimer}>Pause</Button>
                <Button variant="secondary" size="lg" onClick={stopTimer}>Stop & Save</Button>
              </>
            )}
            {status === 'paused' && (
              <>
                <Button size="lg" onClick={resumeTimer}>Resume</Button>
                <Button variant="secondary" size="lg" onClick={stopTimer}>Stop & Save</Button>
              </>
            )}
          </div>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <Card className="p-6 text-center">
            <div className="text-3xl mb-1">📅</div>
            <div className="font-display text-3xl font-extrabold text-primary">
              {formatDuration(todayTotal)}
            </div>
            <div className="text-sm text-text-muted font-semibold">Today</div>
          </Card>
          <Card className="p-6 text-center">
            <div className="text-3xl mb-1">📆</div>
            <div className="font-display text-3xl font-extrabold text-secondary">
              {formatDuration(weekTotal)}
            </div>
            <div className="text-sm text-text-muted font-semibold">This Week</div>
          </Card>
        </div>

        {/* Recent Sessions */}
        {sessions.length > 0 && (
          <Card className="p-6">
            <h2 className="font-display text-2xl font-bold mb-4">Recent Sessions</h2>
            <div className="space-y-3">
              {sessions.slice(0, 5).map(session => (
                <div key={session.id} className="flex justify-between items-center py-2 border-b border-border/50 last:border-0">
                  <div>
                    <div className="font-bold">{session.subject}</div>
                    <div className="text-sm text-text-muted">
                      {session.childName} • {new Date(session.startTime).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="text-primary font-bold">
                    {formatDuration(session.duration)}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Study Tips */}
        <Card className="mt-8 p-6 bg-gradient-to-r from-primary/5 to-secondary/5 border-primary/20">
          <h3 className="font-bold text-lg mb-2">💡 Study Tips</h3>
          <ul className="text-sm text-text-muted space-y-1">
            <li>• Pomodoro: 25 min focused work + 5 min break</li>
            <li>• After 4 pomodoros, take a 15 min long break</li>
            <li>• Stopwatch is great for longer project-based learning</li>
            <li>• Sessions are saved automatically to your browser</li>
          </ul>
        </Card>
      </main>
    </>
  );
}