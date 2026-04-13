'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { getPocketBase } from '@/lib/pocketbase';
import { Child } from '@/lib/types';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { LoadingScreen } from '@/components/ui/Spinner';
import { ClientOnly } from '@/components/ui/ClientOnly';

interface StudySession {
  id: string;
  user: string;
  child?: string;
  subject: string;
  duration_minutes: number;
  session_type: 'pomodoro' | 'free' | 'break';
  completed: boolean;
  started_at: string;
  ended_at?: string;
  notes?: string;
  created: string;
  updated: string;
}

interface StudyGoal {
  id: string;
  user: string;
  child?: string;
  daily_minutes: number;
  weekly_minutes: number;
  created: string;
  updated: string;
}

const SUBJECTS = [
  { value: 'math', label: 'Math', emoji: '🔢', color: 'bg-blue-500' },
  { value: 'reading', label: 'Reading', emoji: '📖', color: 'bg-green-500' },
  { value: 'writing', label: 'Writing', emoji: '✏️', color: 'bg-yellow-500' },
  { value: 'science', label: 'Science', emoji: '🔬', color: 'bg-purple-500' },
  { value: 'history', label: 'History', emoji: '🏛️', color: 'bg-orange-500' },
  { value: 'geography', label: 'Geography', emoji: '🌍', color: 'bg-teal-500' },
  { value: 'art', label: 'Art', emoji: '🎨', color: 'bg-pink-500' },
  { value: 'music', label: 'Music', emoji: '🎵', color: 'bg-indigo-500' },
  { value: 'pe', label: 'PE', emoji: '⚽', color: 'bg-red-500' },
  { value: 'language', label: 'Foreign Language', emoji: '🗣️', color: 'bg-cyan-500' },
  { value: 'bible', label: 'Bible/Religion', emoji: '📿', color: 'bg-amber-500' },
  { value: 'technology', label: 'Technology', emoji: '💻', color: 'bg-slate-500' },
  { value: 'life_skills', label: 'Life Skills', emoji: '🏠', color: 'bg-lime-500' },
  { value: 'other', label: 'Other', emoji: '📚', color: 'bg-gray-500' },
];

const TIMER_PRESETS = [
  { label: '15 min', minutes: 15, type: 'pomodoro' as const },
  { label: '25 min', minutes: 25, type: 'pomodoro' as const },
  { label: '45 min', minutes: 45, type: 'pomodoro' as const },
  { label: '60 min', minutes: 60, type: 'pomodoro' as const },
  { label: 'Free Timer', minutes: 0, type: 'free' as const },
];

export default function StudyTimerPage() {
  const router = useRouter();
  const pb = getPocketBase();
  
  const [kids, setKids] = useState<Child[]>([]);
  const [sessions, setSessions] = useState<StudySession[]>([]);
  const [goals, setGoals] = useState<StudyGoal[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Timer state
  const [selectedKid, setSelectedKid] = useState<string>('family');
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [timerMode, setTimerMode] = useState<'pomodoro' | 'free'>('pomodoro');
  const [timerMinutes, setTimerMinutes] = useState(25);
  const [timeRemaining, setTimeRemaining] = useState(25 * 60); // in seconds
  const [elapsedTime, setElapsedTime] = useState(0); // for free timer
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isBreak, setIsBreak] = useState(false);
  const [pomodoroCount, setPomodoroCount] = useState(0);
  const [sessionStartTime, setSessionStartTime] = useState<Date | null>(null);
  
  // Settings
  const [breakMinutes, setBreakMinutes] = useState(5);
  const [longBreakMinutes, setLongBreakMinutes] = useState(15);
  const [pomodorosUntilLongBreak, setPomodorosUntilLongBreak] = useState(4);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showGoals, setShowGoals] = useState(false);
  
  // Goal editing
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalDaily, setGoalDaily] = useState(120);
  const [goalWeekly, setGoalWeekly] = useState(600);
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!pb.authStore.isValid) {
      router.push('/');
      return;
    }
    loadData();
    
    // Initialize audio
    if (typeof window !== 'undefined') {
      audioRef.current = new Audio('/sounds/timer-complete.mp3');
    }
    
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
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

      // Load study sessions (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      try {
        const sessionRecords = await pb.collection('study_sessions').getFullList({
          filter: `user = "${userId}" && created >= "${thirtyDaysAgo.toISOString()}"`,
          sort: '-created'
        });
        setSessions(sessionRecords as unknown as StudySession[]);
      } catch (e) {
        console.warn('Study sessions collection not found');
        setSessions([]);
      }

      // Load goals
      try {
        const goalRecords = await pb.collection('study_goals').getFullList({
          filter: `user = "${userId}"`
        });
        setGoals(goalRecords as unknown as StudyGoal[]);
        
        // Set initial goal values if exists
        const familyGoal = goalRecords.find((g: any) => !g.child);
        if (familyGoal) {
          setGoalDaily((familyGoal as any).daily_minutes || 120);
          setGoalWeekly((familyGoal as any).weekly_minutes || 600);
        }
      } catch (e) {
        console.warn('Study goals collection not found');
        setGoals([]);
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

  // Timer functions
  const startTimer = useCallback(() => {
    if (!selectedSubject) {
      alert('Please select a subject first!');
      return;
    }
    
    setIsRunning(true);
    setIsPaused(false);
    setSessionStartTime(new Date());
    
    if (timerMode === 'pomodoro') {
      setTimeRemaining(timerMinutes * 60);
    } else {
      setElapsedTime(0);
    }
    
    timerRef.current = setInterval(() => {
      if (timerMode === 'pomodoro') {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            handleTimerComplete();
            return 0;
          }
          return prev - 1;
        });
      } else {
        setElapsedTime(prev => prev + 1);
      }
    }, 1000);
  }, [selectedSubject, timerMode, timerMinutes]);

  const pauseTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsPaused(true);
  };

  const resumeTimer = () => {
    setIsPaused(false);
    timerRef.current = setInterval(() => {
      if (timerMode === 'pomodoro') {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            handleTimerComplete();
            return 0;
          }
          return prev - 1;
        });
      } else {
        setElapsedTime(prev => prev + 1);
      }
    }, 1000);
  };

  const stopTimer = async (completed: boolean = false) => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    // Save session if it ran for at least 1 minute
    const duration = timerMode === 'pomodoro' 
      ? timerMinutes - Math.ceil(timeRemaining / 60)
      : Math.floor(elapsedTime / 60);
    
    if (duration >= 1 && sessionStartTime) {
      await saveSession(duration, completed);
    }
    
    resetTimer();
  };

  const resetTimer = () => {
    setIsRunning(false);
    setIsPaused(false);
    setIsBreak(false);
    setTimeRemaining(timerMinutes * 60);
    setElapsedTime(0);
    setSessionStartTime(null);
  };

  const handleTimerComplete = async () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    // Play sound
    if (soundEnabled && audioRef.current) {
      try {
        audioRef.current.play();
      } catch (e) {
        console.warn('Could not play sound');
      }
    }
    
    if (!isBreak) {
      // Work session completed
      await saveSession(timerMinutes, true);
      
      const newPomodoroCount = pomodoroCount + 1;
      setPomodoroCount(newPomodoroCount);
      
      // Start break
      setIsBreak(true);
      const breakDuration = newPomodoroCount % pomodorosUntilLongBreak === 0 
        ? longBreakMinutes 
        : breakMinutes;
      setTimeRemaining(breakDuration * 60);
      
      // Auto-start break timer
      timerRef.current = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            handleTimerComplete();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      // Break completed
      setIsBreak(false);
      resetTimer();
    }
  };

  const saveSession = async (duration: number, completed: boolean) => {
    try {
      const userId = pb.authStore.model?.id;
      if (!userId) return;

      const sessionData = {
        user: userId,
        child: selectedKid !== 'family' ? selectedKid : null,
        subject: selectedSubject,
        duration_minutes: duration,
        session_type: isBreak ? 'break' : timerMode,
        completed,
        started_at: sessionStartTime?.toISOString(),
        ended_at: new Date().toISOString(),
      };

      const newSession = await pb.collection('study_sessions').create(sessionData);
      setSessions(prev => [newSession as unknown as StudySession, ...prev]);
    } catch (e) {
      console.warn('Could not save session:', e);
    }
  };

  const saveGoal = async () => {
    try {
      const userId = pb.authStore.model?.id;
      if (!userId) return;

      const goalData = {
        user: userId,
        child: selectedKid !== 'family' ? selectedKid : null,
        daily_minutes: goalDaily,
        weekly_minutes: goalWeekly,
      };

      const existingGoal = goals.find(g => 
        selectedKid === 'family' ? !g.child : g.child === selectedKid
      );

      if (existingGoal) {
        await pb.collection('study_goals').update(existingGoal.id, goalData);
      } else {
        await pb.collection('study_goals').create(goalData);
      }
      
      await loadData();
      setEditingGoal(false);
    } catch (e) {
      console.warn('Could not save goal:', e);
    }
  };

  // Calculate stats
  const stats = useMemo(() => {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    const weekStart = startOfWeek.toISOString().split('T')[0];
    
    const filteredSessions = selectedKid === 'family' 
      ? sessions 
      : sessions.filter(s => s.child === selectedKid);
    
    const workSessions = filteredSessions.filter(s => s.session_type !== 'break' && s.completed);
    
    const todaySessions = workSessions.filter(s => s.started_at?.split('T')[0] === today);
    const weekSessions = workSessions.filter(s => s.started_at?.split('T')[0] >= weekStart);
    
    const todayMinutes = todaySessions.reduce((sum, s) => sum + s.duration_minutes, 0);
    const weekMinutes = weekSessions.reduce((sum, s) => sum + s.duration_minutes, 0);
    const totalMinutes = workSessions.reduce((sum, s) => sum + s.duration_minutes, 0);
    
    // Subject breakdown
    const subjectTime: Record<string, number> = {};
    workSessions.forEach(s => {
      subjectTime[s.subject] = (subjectTime[s.subject] || 0) + s.duration_minutes;
    });
    
    // Calculate streak (consecutive days with study sessions)
    const daySet = new Set(workSessions.map(s => s.started_at?.split('T')[0]));
    let streak = 0;
    const checkDate = new Date();
    while (true) {
      const dateStr = checkDate.toISOString().split('T')[0];
      if (daySet.has(dateStr)) {
        streak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else if (checkDate.toISOString().split('T')[0] === today) {
        // Today hasn't had a session yet, but don't break streak
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }
    
    const currentGoal = goals.find(g => 
      selectedKid === 'family' ? !g.child : g.child === selectedKid
    );
    
    return {
      todayMinutes,
      weekMinutes,
      totalMinutes,
      sessionCount: workSessions.length,
      subjectTime,
      streak,
      dailyGoal: currentGoal?.daily_minutes || goalDaily,
      weeklyGoal: currentGoal?.weekly_minutes || goalWeekly,
    };
  }, [sessions, selectedKid, goals, goalDaily, goalWeekly]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formatMinutes = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) return `${mins}m`;
    return `${hours}h ${mins}m`;
  };

  const getSubjectInfo = (value: string) => {
    return SUBJECTS.find(s => s.value === value) || SUBJECTS[SUBJECTS.length - 1];
  };

  const dailyProgress = Math.min((stats.todayMinutes / stats.dailyGoal) * 100, 100);
  const weeklyProgress = Math.min((stats.weekMinutes / stats.weeklyGoal) * 100, 100);

  if (loading) {
    return (
      <>
        <Header showLogout onLogout={handleLogout} />
        <LoadingScreen message="Loading study timer..." />
      </>
    );
  }

  return (
    <>
      <Header showLogout onLogout={handleLogout} />
      <ClientOnly>
        <main className="max-w-6xl mx-auto my-8 px-4 sm:px-8 pb-20 animate-fade-in">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-8">
            <div>
              <h2 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight mb-1">
                ⏱️ Study Timer
              </h2>
              <p className="text-text-muted">Focus, learn, grow!</p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button variant="outline" size="sm" onClick={() => setShowHistory(!showHistory)}>
                📊 {showHistory ? 'Hide' : 'Show'} History
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowGoals(!showGoals)}>
                🎯 Goals
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowSettings(!showSettings)}>
                ⚙️ Settings
              </Button>
              <Button variant="ghost" size="sm" onClick={() => router.push('/dashboard')}>
                ← Dashboard
              </Button>
            </div>
          </div>

          {/* Kid Selector */}
          <div className="flex gap-2 flex-wrap mb-6">
            <button
              onClick={() => setSelectedKid('family')}
              className={`px-4 py-2 rounded-full font-semibold text-sm transition-all ${
                selectedKid === 'family'
                  ? 'bg-primary text-white shadow-md'
                  : 'bg-bg-alt text-text-muted hover:bg-border'
              }`}
            >
              👨‍👩‍👧‍👦 Family
            </button>
            {kids.map(kid => (
              <button
                key={kid.id}
                onClick={() => setSelectedKid(kid.id)}
                className={`px-4 py-2 rounded-full font-semibold text-sm transition-all ${
                  selectedKid === kid.id
                    ? 'bg-primary text-white shadow-md'
                    : 'bg-bg-alt text-text-muted hover:bg-border'
                }`}
              >
                {kid.name}
              </button>
            ))}
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <Card className="text-center p-4">
              <div className="text-3xl mb-1">🔥</div>
              <div className="font-display text-3xl font-bold text-orange-500">{stats.streak}</div>
              <div className="text-xs text-text-muted font-semibold">Day Streak</div>
            </Card>
            <Card className="text-center p-4">
              <div className="text-3xl mb-1">📅</div>
              <div className="font-display text-3xl font-bold text-primary">{formatMinutes(stats.todayMinutes)}</div>
              <div className="text-xs text-text-muted font-semibold">Today</div>
              <div className="mt-2 h-2 bg-bg-alt rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary rounded-full transition-all"
                  style={{ width: `${dailyProgress}%` }}
                />
              </div>
            </Card>
            <Card className="text-center p-4">
              <div className="text-3xl mb-1">📆</div>
              <div className="font-display text-3xl font-bold text-secondary">{formatMinutes(stats.weekMinutes)}</div>
              <div className="text-xs text-text-muted font-semibold">This Week</div>
              <div className="mt-2 h-2 bg-bg-alt rounded-full overflow-hidden">
                <div 
                  className="h-full bg-secondary rounded-full transition-all"
                  style={{ width: `${weeklyProgress}%` }}
                />
              </div>
            </Card>
            <Card className="text-center p-4">
              <div className="text-3xl mb-1">🍅</div>
              <div className="font-display text-3xl font-bold text-accent">{pomodoroCount}</div>
              <div className="text-xs text-text-muted font-semibold">Pomodoros Today</div>
            </Card>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Timer Card */}
            <Card className="p-6">
              <div className="text-center">
                {/* Timer Display */}
                <div className={`relative w-64 h-64 mx-auto mb-6 rounded-full flex items-center justify-center ${
                  isBreak 
                    ? 'bg-gradient-to-br from-green-100 to-green-200' 
                    : isRunning 
                      ? 'bg-gradient-to-br from-primary/10 to-secondary/10'
                      : 'bg-bg-alt'
                }`}>
                  {/* Progress ring for pomodoro */}
                  {timerMode === 'pomodoro' && isRunning && (
                    <svg className="absolute inset-0 w-full h-full -rotate-90">
                      <circle
                        cx="128"
                        cy="128"
                        r="120"
                        stroke="currentColor"
                        strokeWidth="8"
                        fill="none"
                        className="text-border"
                      />
                      <circle
                        cx="128"
                        cy="128"
                        r="120"
                        stroke="currentColor"
                        strokeWidth="8"
                        fill="none"
                        strokeLinecap="round"
                        className={isBreak ? 'text-green-500' : 'text-primary'}
                        strokeDasharray={`${2 * Math.PI * 120}`}
                        strokeDashoffset={`${2 * Math.PI * 120 * (1 - timeRemaining / (timerMinutes * 60))}`}
                        style={{ transition: 'stroke-dashoffset 1s linear' }}
                      />
                    </svg>
                  )}
                  
                  <div className="text-center z-10">
                    {isBreak && (
                      <div className="text-green-600 font-semibold text-sm mb-1">☕ Break Time!</div>
                    )}
                    <div className={`font-display font-bold tracking-tight ${
                      timerMode === 'pomodoro' ? 'text-6xl' : 'text-5xl'
                    }`}>
                      {timerMode === 'pomodoro' ? formatTime(timeRemaining) : formatTime(elapsedTime)}
                    </div>
                    {selectedSubject && (
                      <div className="mt-2 text-text-muted text-sm">
                        {getSubjectInfo(selectedSubject).emoji} {getSubjectInfo(selectedSubject).label}
                      </div>
                    )}
                  </div>
                </div>

                {/* Timer Controls */}
                <div className="flex gap-3 justify-center mb-6">
                  {!isRunning ? (
                    <Button onClick={startTimer} className="px-8 py-3 text-lg">
                      ▶️ Start
                    </Button>
                  ) : isPaused ? (
                    <>
                      <Button onClick={resumeTimer} className="px-6">
                        ▶️ Resume
                      </Button>
                      <Button variant="outline" onClick={() => stopTimer(false)}>
                        ⏹️ Stop
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button variant="outline" onClick={pauseTimer}>
                        ⏸️ Pause
                      </Button>
                      <Button variant="outline" onClick={() => stopTimer(false)} className="text-red-500 border-red-200 hover:bg-red-50">
                        ⏹️ Stop
                      </Button>
                    </>
                  )}
                </div>

                {/* Timer Presets */}
                {!isRunning && (
                  <div className="flex gap-2 justify-center flex-wrap">
                    {TIMER_PRESETS.map(preset => (
                      <button
                        key={preset.label}
                        onClick={() => {
                          setTimerMode(preset.type);
                          setTimerMinutes(preset.minutes || 25);
                          setTimeRemaining((preset.minutes || 25) * 60);
                        }}
                        className={`px-3 py-1.5 rounded-full text-sm font-semibold transition-all ${
                          (timerMode === preset.type && (preset.type === 'free' || timerMinutes === preset.minutes))
                            ? 'bg-primary text-white'
                            : 'bg-bg-alt text-text-muted hover:bg-border'
                        }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </Card>

            {/* Subject Selector */}
            <Card className="p-6">
              <h3 className="font-display font-bold text-xl mb-4">Select Subject</h3>
              <div className="grid grid-cols-2 gap-2">
                {SUBJECTS.map(subject => (
                  <button
                    key={subject.value}
                    onClick={() => !isRunning && setSelectedSubject(subject.value)}
                    disabled={isRunning}
                    className={`p-3 rounded-xl text-left transition-all ${
                      selectedSubject === subject.value
                        ? 'bg-primary text-white shadow-md'
                        : 'bg-bg-alt hover:bg-border'
                    } ${isRunning ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <span className="text-xl mr-2">{subject.emoji}</span>
                    <span className="font-semibold text-sm">{subject.label}</span>
                  </button>
                ))}
              </div>
            </Card>
          </div>

          {/* Subject Time Breakdown */}
          {Object.keys(stats.subjectTime).length > 0 && (
            <Card className="mt-8 p-6">
              <h3 className="font-display font-bold text-xl mb-4">📊 Time by Subject (Last 30 Days)</h3>
              <div className="space-y-3">
                {Object.entries(stats.subjectTime)
                  .sort((a, b) => b[1] - a[1])
                  .map(([subject, minutes]) => {
                    const subjectInfo = getSubjectInfo(subject);
                    const percentage = (minutes / stats.totalMinutes) * 100;
                    return (
                      <div key={subject}>
                        <div className="flex justify-between items-center mb-1">
                          <span className="font-semibold text-sm">
                            {subjectInfo.emoji} {subjectInfo.label}
                          </span>
                          <span className="text-sm text-text-muted">{formatMinutes(minutes)}</span>
                        </div>
                        <div className="w-full bg-bg-alt rounded-full h-3 overflow-hidden">
                          <div 
                            className={`${subjectInfo.color} h-full rounded-full transition-all`}
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
              </div>
            </Card>
          )}

          {/* Session History */}
          {showHistory && (
            <Card className="mt-8 p-6">
              <h3 className="font-display font-bold text-xl mb-4">📜 Recent Sessions</h3>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {sessions
                  .filter(s => s.session_type !== 'break')
                  .filter(s => selectedKid === 'family' || s.child === selectedKid)
                  .slice(0, 20)
                  .map(session => {
                    const subjectInfo = getSubjectInfo(session.subject);
                    const kid = kids.find(k => k.id === session.child);
                    const date = new Date(session.started_at);
                    return (
                      <div key={session.id} className="flex items-center justify-between p-3 bg-bg-alt rounded-xl">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-full ${subjectInfo.color} flex items-center justify-center text-white`}>
                            {subjectInfo.emoji}
                          </div>
                          <div>
                            <div className="font-semibold text-sm">
                              {subjectInfo.label}
                              {kid && <span className="text-text-muted"> • {kid.name}</span>}
                            </div>
                            <div className="text-xs text-text-muted">
                              {date.toLocaleDateString()} at {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-primary">{formatMinutes(session.duration_minutes)}</div>
                          <div className="text-xs text-text-muted">
                            {session.completed ? '✅ Completed' : '⏹️ Stopped'}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                {sessions.filter(s => s.session_type !== 'break').length === 0 && (
                  <p className="text-center text-text-muted py-8">No study sessions yet. Start your first timer!</p>
                )}
              </div>
            </Card>
          )}

          {/* Goals Panel */}
          {showGoals && (
            <Card className="mt-8 p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-display font-bold text-xl">🎯 Study Goals</h3>
                <Button variant="outline" size="sm" onClick={() => setEditingGoal(!editingGoal)}>
                  {editingGoal ? 'Cancel' : 'Edit Goals'}
                </Button>
              </div>
              
              {editingGoal ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold mb-1">Daily Goal (minutes)</label>
                    <input
                      type="number"
                      value={goalDaily}
                      onChange={(e) => setGoalDaily(parseInt(e.target.value) || 0)}
                      className="w-full px-4 py-2 rounded-xl border-2 border-border focus:border-primary outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-1">Weekly Goal (minutes)</label>
                    <input
                      type="number"
                      value={goalWeekly}
                      onChange={(e) => setGoalWeekly(parseInt(e.target.value) || 0)}
                      className="w-full px-4 py-2 rounded-xl border-2 border-border focus:border-primary outline-none"
                    />
                  </div>
                  <Button onClick={saveGoal}>Save Goals</Button>
                </div>
              ) : (
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-semibold">Daily Goal</span>
                      <span className="text-primary font-bold">{formatMinutes(stats.todayMinutes)} / {formatMinutes(stats.dailyGoal)}</span>
                    </div>
                    <div className="w-full bg-bg-alt rounded-full h-4 overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all ${dailyProgress >= 100 ? 'bg-green-500' : 'bg-primary'}`}
                        style={{ width: `${dailyProgress}%` }}
                      />
                    </div>
                    {dailyProgress >= 100 && (
                      <div className="text-green-600 text-sm mt-1 font-semibold">🎉 Goal reached!</div>
                    )}
                  </div>
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-semibold">Weekly Goal</span>
                      <span className="text-secondary font-bold">{formatMinutes(stats.weekMinutes)} / {formatMinutes(stats.weeklyGoal)}</span>
                    </div>
                    <div className="w-full bg-bg-alt rounded-full h-4 overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all ${weeklyProgress >= 100 ? 'bg-green-500' : 'bg-secondary'}`}
                        style={{ width: `${weeklyProgress}%` }}
                      />
                    </div>
                    {weeklyProgress >= 100 && (
                      <div className="text-green-600 text-sm mt-1 font-semibold">🎉 Goal reached!</div>
                    )}
                  </div>
                </div>
              )}
            </Card>
          )}

          {/* Settings Panel */}
          {showSettings && (
            <Card className="mt-8 p-6">
              <h3 className="font-display font-bold text-xl mb-4">⚙️ Timer Settings</h3>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold mb-1">Short Break (minutes)</label>
                  <input
                    type="number"
                    value={breakMinutes}
                    onChange={(e) => setBreakMinutes(parseInt(e.target.value) || 5)}
                    className="w-full px-4 py-2 rounded-xl border-2 border-border focus:border-primary outline-none"
                    min="1"
                    max="30"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">Long Break (minutes)</label>
                  <input
                    type="number"
                    value={longBreakMinutes}
                    onChange={(e) => setLongBreakMinutes(parseInt(e.target.value) || 15)}
                    className="w-full px-4 py-2 rounded-xl border-2 border-border focus:border-primary outline-none"
                    min="5"
                    max="60"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">Pomodoros until Long Break</label>
                  <input
                    type="number"
                    value={pomodorosUntilLongBreak}
                    onChange={(e) => setPomodorosUntilLongBreak(parseInt(e.target.value) || 4)}
                    className="w-full px-4 py-2 rounded-xl border-2 border-border focus:border-primary outline-none"
                    min="2"
                    max="8"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="soundEnabled"
                    checked={soundEnabled}
                    onChange={(e) => setSoundEnabled(e.target.checked)}
                    className="w-5 h-5 rounded"
                  />
                  <label htmlFor="soundEnabled" className="font-semibold">🔔 Sound when timer completes</label>
                </div>
              </div>
            </Card>
          )}
        </main>
      </ClientOnly>
    </>
  );
}
