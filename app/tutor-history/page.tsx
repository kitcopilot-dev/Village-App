'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getPocketBase } from '@/lib/pocketbase';
import { Child } from '@/lib/types';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { LoadingScreen } from '@/components/ui/Spinner';

interface TutorMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

interface TutorSession {
  student_id: string;
  student_name: string;
  date: string;
  messages: TutorMessage[];
}

export default function TutorHistoryPage() {
  const router = useRouter();
  const pb = getPocketBase();
  
  const [kids, setKids] = useState<Child[]>([]);
  const [sessions, setSessions] = useState<TutorSession[]>([]);
  const [selectedKid, setSelectedKid] = useState<string>('all');
  const [selectedSession, setSelectedSession] = useState<TutorSession | null>(null);
  const [loading, setLoading] = useState(true);

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

      // Load kids
      const kidRecords = await pb.collection('children').getFullList({
        filter: `user = "${userId}"`,
        sort: 'name'
      });
      setKids(kidRecords as unknown as Child[]);

      // Load sessions from localStorage
      const loadedSessions: TutorSession[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith('tutor_session_')) {
          try {
            const data = JSON.parse(localStorage.getItem(key) || '');
            if (data.messages && data.messages.length > 0) {
              loadedSessions.push(data);
            }
          } catch (e) {
            // Invalid JSON, skip
          }
        }
      }

      // Sort by date (newest first)
      loadedSessions.sort((a, b) => 
        new Date(b.date).getTime() - new Date(a.date).getTime()
      );

      setSessions(loadedSessions);
    } catch (error) {
      console.error('Load error:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredSessions = selectedKid === 'all'
    ? sessions
    : sessions.filter(s => s.student_id === selectedKid);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  const getSessionPreview = (session: TutorSession) => {
    const userMessages = session.messages.filter(m => m.role === 'user');
    if (userMessages.length === 0) return 'No questions asked';
    return userMessages[0].content.slice(0, 100) + (userMessages[0].content.length > 100 ? '...' : '');
  };

  if (loading) {
    return <LoadingScreen message="Loading tutor history..." />;
  }

  return (
    <>
      <Header showLogout onLogout={() => { pb.authStore.clear(); router.push('/'); }} />
      <main className="max-w-6xl mx-auto my-8 sm:my-12 px-4 sm:px-8 pb-20 animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-6 mb-8">
          <div>
            <h2 className="font-display text-4xl sm:text-5xl font-extrabold tracking-tight mb-2">
              🦉 Tutor History
            </h2>
            <p className="text-text-muted text-sm sm:text-base">
              Review your children's homework help conversations
            </p>
          </div>
          <Button variant="ghost" onClick={() => router.push('/dashboard')}>
            ← Dashboard
          </Button>
        </div>

        {/* Filter by child */}
        <Card className="mb-8 p-4">
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-sm font-bold text-text-muted">Filter:</span>
            <button
              onClick={() => setSelectedKid('all')}
              className={`px-4 py-2 rounded-full text-sm font-bold transition-all ${
                selectedKid === 'all'
                  ? 'bg-primary text-white'
                  : 'bg-bg-alt hover:bg-border'
              }`}
            >
              All Kids
            </button>
            {kids.map(kid => (
              <button
                key={kid.id}
                onClick={() => setSelectedKid(kid.id)}
                className={`px-4 py-2 rounded-full text-sm font-bold transition-all ${
                  selectedKid === kid.id
                    ? 'bg-primary text-white'
                    : 'bg-bg-alt hover:bg-border'
                }`}
              >
                {kid.name}
              </button>
            ))}
          </div>
        </Card>

        {selectedSession ? (
          // Session detail view
          <Card>
            <div className="p-6 border-b border-border flex justify-between items-start">
              <div>
                <h3 className="font-display text-xl font-bold m-0">
                  {selectedSession.student_name}'s Session
                </h3>
                <p className="text-sm text-text-muted m-0 mt-1">
                  {formatDate(selectedSession.date)}
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => setSelectedSession(null)}>
                ← Back to List
              </Button>
            </div>
            <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
              {selectedSession.messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] px-4 py-3 rounded-2xl ${
                      msg.role === 'user'
                        ? 'bg-primary text-white rounded-br-md'
                        : 'bg-bg-alt border border-border rounded-bl-md'
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap m-0">{msg.content}</p>
                    <p className="text-[10px] opacity-60 mt-2 m-0">
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <div className="p-4 bg-bg-alt border-t border-border">
              <p className="text-xs text-text-muted text-center m-0">
                {selectedSession.messages.filter(m => m.role === 'user').length} questions asked •{' '}
                {selectedSession.messages.filter(m => m.role === 'assistant').length} responses
              </p>
            </div>
          </Card>
        ) : (
          // Sessions list
          <div className="space-y-4">
            {filteredSessions.length === 0 ? (
              <Card className="text-center py-16">
                <p className="text-4xl mb-4">🦉</p>
                <p className="text-text-muted text-lg">No tutor sessions yet</p>
                <p className="text-text-muted text-sm mt-2">
                  When your kids use the Homework Helper, their conversations will appear here.
                </p>
              </Card>
            ) : (
              filteredSessions.map((session, i) => {
                const questionCount = session.messages.filter(m => m.role === 'user').length;
                return (
                  <Card
                    key={i}
                    className="p-6 cursor-pointer hover:border-primary/50 transition-all"
                    onClick={() => setSelectedSession(session)}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-secondary/10 flex items-center justify-center text-lg">
                          {session.student_name.charAt(0)}
                        </div>
                        <div>
                          <h4 className="font-display font-bold m-0">{session.student_name}</h4>
                          <p className="text-xs text-text-muted m-0">{formatDate(session.date)}</p>
                        </div>
                      </div>
                      <span className="text-xs font-bold text-secondary bg-secondary/10 px-3 py-1 rounded-full">
                        {questionCount} {questionCount === 1 ? 'question' : 'questions'}
                      </span>
                    </div>
                    <p className="text-sm text-text-muted mt-4 mb-0 line-clamp-2 italic">
                      "{getSessionPreview(session)}"
                    </p>
                  </Card>
                );
              })
            )}
          </div>
        )}
      </main>
    </>
  );
}
