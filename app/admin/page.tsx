'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getPocketBase } from '@/lib/pocketbase';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { LoadingScreen } from '@/components/ui/Spinner';

const ADMIN_EMAILS = ['jtown.80@gmail.com', 'jlynch8080@pm.me'];

export default function AdminDashboardPage() {
  const router = useRouter();
  const pb = getPocketBase();
  
  const [stats, setStats] = useState({
    families: 0,
    kids: 0,
    courses: 0,
    lessons: 0,
    events: 0,
    avgScore: 0
  });
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const userEmail = pb.authStore.model?.email;
    if (!pb.authStore.isValid || !ADMIN_EMAILS.includes(userEmail)) {
      router.push('/dashboard');
      return;
    }
    setIsAdmin(true);
    loadAdminData();
  }, []);

  const loadAdminData = async () => {
    try {
      const [
        profileRecords,
        kidRecords,
        courseRecords,
        lessonRecords,
        eventRecords,
        assignmentRecords
      ] = await Promise.all([
        pb.collection('profiles').getFullList(),
        pb.collection('children').getFullList(),
        pb.collection('courses').getFullList(),
        pb.collection('lessons').getFullList(),
        pb.collection('events').getFullList(),
        pb.collection('assignments').getFullList({ filter: 'score != null' })
      ]);

      const totalScore = assignmentRecords.reduce((sum, a) => sum + (a.score || 0), 0);
      const avg = assignmentRecords.length > 0 ? totalScore / assignmentRecords.length : 0;

      setStats({
        families: profileRecords.length,
        kids: kidRecords.length,
        courses: courseRecords.length,
        lessons: lessonRecords.length,
        events: eventRecords.length,
        avgScore: avg
      });
    } catch (error) {
      console.error('Admin load error:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <LoadingScreen message="Accessing Village command center..." />;
  if (!isAdmin) return null;

  return (
    <>
      <Header showLogout onLogout={() => { pb.authStore.clear(); router.push('/'); }} />
      <main className="max-w-7xl mx-auto my-12 px-4 sm:px-8 pb-24 animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-6 mb-12">
          <div>
            <h2 className="font-display text-4xl sm:text-6xl font-extrabold tracking-tight mb-2">Village Admin</h2>
            <p className="text-text-muted text-sm sm:text-base font-serif italic">Platform metrics and community insights.</p>
          </div>
          <Button variant="ghost" onClick={() => router.push('/dashboard')}>← User Dashboard</Button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {[
            { label: 'Total Families', value: stats.families, emoji: '🏘️', color: 'text-primary' },
            { label: 'Total Children', value: stats.kids, emoji: '🧒', color: 'text-secondary' },
            { label: 'Active Courses', value: stats.courses, emoji: '📚', color: 'text-accent' },
            { label: 'AI Sparks Generated', value: stats.lessons, emoji: '🤖', color: 'text-primary' }
          ].map((stat, i) => (
            <Card key={i} className="p-6 sm:p-10 text-center hover:scale-105 transition-transform border-border/50">
              <div className="text-3xl mb-4">{stat.emoji}</div>
              <div className={`text-4xl sm:text-5xl font-display font-extrabold ${stat.color} mb-2`}>{stat.value}</div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-text-muted">{stat.label}</div>
            </Card>
          ))}
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Platform Health */}
          <Card className="p-8">
            <h3 className="font-display text-2xl font-bold mb-8 text-primary border-b pb-4">Academic Health</h3>
            <div className="space-y-8">
              <div>
                <div className="flex justify-between items-end mb-2">
                  <span className="text-sm font-bold text-text-muted uppercase tracking-wider">Average Platform Score</span>
                  <span className="text-4xl font-display font-extrabold text-secondary">{stats.avgScore.toFixed(1)}%</span>
                </div>
                <div className="h-2 bg-bg-alt rounded-full overflow-hidden">
                  <div className="h-full bg-secondary rounded-full" style={{ width: `${stats.avgScore}%` }} />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4 pt-4">
                <div className="p-4 bg-bg-alt rounded-2xl">
                  <p className="text-[10px] font-bold uppercase text-text-muted mb-1">Upcoming Events</p>
                  <p className="text-3xl font-display font-extrabold text-primary m-0">{stats.events}</p>
                </div>
                <div className="p-4 bg-bg-alt rounded-2xl">
                  <p className="text-[10px] font-bold uppercase text-text-muted mb-1">Growth Rate</p>
                  <p className="text-3xl font-display font-extrabold text-accent m-0">+0%</p>
                </div>
              </div>
            </div>
          </Card>

          {/* Quick Actions */}
          <Card className="p-8 bg-primary/5 border-primary/20">
            <h3 className="font-display text-2xl font-bold mb-8 text-primary border-b border-primary/10 pb-4">Admin Controls</h3>
            <div className="grid grid-cols-1 gap-4">
              <Button variant="outline" className="justify-start gap-4 bg-white">
                <span>📣</span> Send Community Announcement
              </Button>
              <Button variant="outline" className="justify-start gap-4 bg-white">
                <span>⚖️</span> Bulk Update Legal Guides
              </Button>
              <Button variant="outline" className="justify-start gap-4 bg-white">
                <span>🧹</span> Clear Temporary AI Lessons
              </Button>
              <Button variant="outline" className="justify-start gap-4 bg-white text-red-500 hover:border-red-200 hover:bg-red-50">
                <span>🛡️</span> Manage Blocked Users
              </Button>
            </div>
          </Card>
        </div>
      </main>
    </>
  );
}
