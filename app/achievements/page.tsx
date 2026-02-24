'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { getPocketBase } from '@/lib/pocketbase';
import { Child, Course, Assignment, Attendance, EarnedAchievement } from '@/lib/types';
import { ACHIEVEMENTS, TIER_STYLES, CATEGORY_INFO, checkAchievement, getAchievementsByCategory } from '@/lib/achievements';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ClientOnly } from '@/components/ui/ClientOnly';

interface ChildWithData extends Child {
  courses: Course[];
}

type CategoryFilter = 'all' | 'learning' | 'consistency' | 'mastery' | 'milestone';

export default function AchievementsPage() {
  const router = useRouter();
  const pb = getPocketBase();
  
  const [kids, setKids] = useState<ChildWithData[]>([]);
  const [selectedKid, setSelectedKid] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [metrics, setMetrics] = useState<Record<string, Record<string, number>>>({});
  const [earnedAchievements, setEarnedAchievements] = useState<EarnedAchievement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUnlockAnimation, setShowUnlockAnimation] = useState<string | null>(null);

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

      // Load children with courses
      const childRecords = await pb.collection('children').getFullList({
        filter: `user = "${userId}"`,
        sort: 'name'
      });

      const kidsWithData = await Promise.all(
        childRecords.map(async (kid) => {
          try {
            const courses = await pb.collection('courses').getFullList({
              filter: `child = "${kid.id}"`,
              sort: 'name'
            });
            return { ...kid, courses } as unknown as ChildWithData;
          } catch {
            return { ...kid, courses: [] } as unknown as ChildWithData;
          }
        })
      );
      setKids(kidsWithData);

      // Calculate metrics for each child
      const childMetrics: Record<string, Record<string, number>> = {};
      
      for (const kid of kidsWithData) {
        const kidMetrics: Record<string, number> = {
          lessons_completed: 0,
          courses_completed: 0,
          attendance_days: 0,
          attendance_streak: 0,
          reading_streak: 0,
          study_sessions: 0,
          study_minutes: 0,
          perfect_assignments: 0,
          assignments_completed: 0,
          portfolio_items: 0,
          a_average_count: 0
        };

        // Calculate lessons completed from courses
        kid.courses.forEach(course => {
          const completed = Math.max(0, course.current_lesson - 1);
          kidMetrics.lessons_completed += completed;
          if (course.current_lesson > course.total_lessons) {
            kidMetrics.courses_completed += 1;
          }
        });

        // Load attendance data
        try {
          const attendance = await pb.collection('attendance').getFullList({
            filter: `child = "${kid.id}" && status = "present"`,
            sort: '-date'
          }) as unknown as Attendance[];
          
          kidMetrics.attendance_days = attendance.length;
          
          // Calculate streak
          if (attendance.length > 0) {
            let streak = 1;
            const sortedDates = attendance
              .map(a => new Date(a.date).getTime())
              .sort((a, b) => b - a);
            
            for (let i = 1; i < sortedDates.length; i++) {
              const diff = (sortedDates[i-1] - sortedDates[i]) / (1000 * 60 * 60 * 24);
              if (diff <= 1) streak++;
              else break;
            }
            kidMetrics.attendance_streak = streak;
          }
        } catch (e) {
          console.warn('Attendance not available');
        }

        // Load assignments data
        try {
          const assignments = await pb.collection('assignments').getFullList({
            filter: `child = "${kid.id}"`,
          }) as unknown as Assignment[];
          
          const completed = assignments.filter(a => a.status === 'completed' || a.status === 'Graded');
          kidMetrics.assignments_completed = completed.length;
          
          const graded = assignments.filter(a => a.score !== undefined && a.score !== null);
          kidMetrics.perfect_assignments = graded.filter(a => a.score === 100).length;
          
          // Check for A average
          if (graded.length >= 10) {
            const avgScore = graded.reduce((sum, a) => sum + (a.score || 0), 0) / graded.length;
            if (avgScore >= 90) {
              kidMetrics.a_average_count = graded.length;
            }
          }
        } catch (e) {
          console.warn('Assignments not available');
        }

        // Load portfolio items
        try {
          const portfolio = await pb.collection('portfolio_items').getFullList({
            filter: `child = "${kid.id}"`
          });
          kidMetrics.portfolio_items = portfolio.length;
        } catch (e) {
          console.warn('Portfolio not available');
        }

        // Load study sessions
        try {
          const sessions = await pb.collection('study_sessions').getFullList({
            filter: `child = "${kid.id}"`
          });
          kidMetrics.study_sessions = sessions.length;
          kidMetrics.study_minutes = sessions.reduce((sum: number, s: any) => sum + (s.duration_minutes || 0), 0);
        } catch (e) {
          console.warn('Study sessions not available');
        }

        // Load reading entries for streak
        try {
          const entries = await pb.collection('reading_entries').getFullList({
            filter: `child = "${kid.id}"`,
            sort: '-date'
          });
          
          if (entries.length > 0) {
            let streak = 1;
            const sortedDates = entries
              .map((e: any) => new Date(e.date).getTime())
              .sort((a: number, b: number) => b - a);
            
            for (let i = 1; i < sortedDates.length; i++) {
              const diff = (sortedDates[i-1] - sortedDates[i]) / (1000 * 60 * 60 * 24);
              if (diff <= 1) streak++;
              else break;
            }
            kidMetrics.reading_streak = streak;
          }
        } catch (e) {
          console.warn('Reading entries not available');
        }

        childMetrics[kid.id] = kidMetrics;
      }
      
      setMetrics(childMetrics);

      // Load earned achievements (graceful fallback if collection doesn't exist)
      try {
        const earned = await pb.collection('earned_achievements').getFullList({
          filter: `user = "${userId}"`
        });
        setEarnedAchievements(earned as unknown as EarnedAchievement[]);
      } catch (e) {
        console.warn('Earned achievements collection not found, using computed achievements');
        setEarnedAchievements([]);
      }

    } catch (error) {
      console.error('Error loading achievements data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Combine metrics across all kids or use selected kid
  const activeMetrics = useMemo(() => {
    if (selectedKid === 'all') {
      // Sum all kids' metrics
      const combined: Record<string, number> = {};
      Object.values(metrics).forEach(kidMetrics => {
        Object.entries(kidMetrics).forEach(([key, value]) => {
          combined[key] = (combined[key] || 0) + value;
        });
      });
      return combined;
    }
    return metrics[selectedKid] || {};
  }, [selectedKid, metrics]);

  // Check which achievements are earned
  const earnedKeys = useMemo(() => {
    // First check PocketBase stored achievements
    const storedKeys = new Set(
      earnedAchievements
        .filter(ea => selectedKid === 'all' || ea.child === selectedKid)
        .map(ea => ea.achievement_key)
    );
    
    // Also compute achievements based on current metrics
    ACHIEVEMENTS.forEach(achievement => {
      if (checkAchievement(achievement, activeMetrics)) {
        storedKeys.add(achievement.key);
      }
    });
    
    return storedKeys;
  }, [earnedAchievements, selectedKid, activeMetrics]);

  // Filter achievements
  const filteredAchievements = useMemo(() => {
    if (categoryFilter === 'all') return ACHIEVEMENTS;
    return getAchievementsByCategory(categoryFilter);
  }, [categoryFilter]);

  // Calculate stats
  const totalAchievements = ACHIEVEMENTS.length;
  const earnedCount = earnedKeys.size;
  const progressPercent = Math.round((earnedCount / totalAchievements) * 100);

  // Group by tier for display
  const achievementsByTier = {
    platinum: filteredAchievements.filter(a => a.tier === 'platinum'),
    gold: filteredAchievements.filter(a => a.tier === 'gold'),
    silver: filteredAchievements.filter(a => a.tier === 'silver'),
    bronze: filteredAchievements.filter(a => a.tier === 'bronze'),
  };

  const handleLogout = () => {
    pb.authStore.clear();
    router.push('/');
  };

  if (loading) {
    return (
      <>
        <Header showLogout onLogout={handleLogout} />
        <main className="max-w-7xl mx-auto my-12 px-8">
          <p className="text-center text-text-muted">Loading achievements...</p>
        </main>
      </>
    );
  }

  return (
    <>
      <Header showLogout onLogout={handleLogout} />
      <ClientOnly>
        <main className="max-w-7xl mx-auto my-12 px-8 pb-20 animate-fade-in">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-8">
            <div>
              <h2 className="font-display text-4xl sm:text-5xl font-extrabold tracking-tight mb-2">
                🏆 Achievements
              </h2>
              <p className="text-text-muted">Celebrate your learning journey with badges and milestones</p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => router.push('/dashboard')}>
              ← Dashboard
            </Button>
          </div>

          {/* Progress Overview */}
          <Card className="mb-8 bg-gradient-to-r from-primary/10 to-secondary/10">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div>
                <h3 className="font-display text-2xl font-bold mb-2">Your Progress</h3>
                <p className="text-text-muted">
                  You&apos;ve earned <span className="font-bold text-primary">{earnedCount}</span> of{' '}
                  <span className="font-bold">{totalAchievements}</span> achievements
                </p>
              </div>
              
              <div className="flex items-center gap-4">
                <div className="w-32 h-32 relative">
                  <svg className="w-full h-full transform -rotate-90">
                    <circle
                      cx="64"
                      cy="64"
                      r="56"
                      stroke="currentColor"
                      strokeWidth="12"
                      fill="none"
                      className="text-bg-alt"
                    />
                    <circle
                      cx="64"
                      cy="64"
                      r="56"
                      stroke="currentColor"
                      strokeWidth="12"
                      fill="none"
                      strokeLinecap="round"
                      strokeDasharray={`${progressPercent * 3.52} 352`}
                      className="text-primary transition-all duration-1000"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="font-display text-2xl font-bold text-primary">{progressPercent}%</span>
                  </div>
                </div>
                
                <div className="space-y-1">
                  {(['platinum', 'gold', 'silver', 'bronze'] as const).map(tier => {
                    const tierAchievements = ACHIEVEMENTS.filter(a => a.tier === tier);
                    const earned = tierAchievements.filter(a => earnedKeys.has(a.key)).length;
                    const style = TIER_STYLES[tier];
                    return (
                      <div key={tier} className="flex items-center gap-2 text-sm">
                        <div className={`w-3 h-3 rounded-full ${style.bg} ${style.border} border`} />
                        <span className="capitalize">{tier}:</span>
                        <span className="font-bold">{earned}/{tierAchievements.length}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </Card>

          {/* Filters */}
          <div className="flex flex-wrap gap-3 mb-8">
            {/* Child Filter */}
            {kids.length > 1 && (
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-text-muted">Student:</span>
                <select
                  value={selectedKid}
                  onChange={(e) => setSelectedKid(e.target.value)}
                  className="px-3 py-2 rounded-xl border-2 border-border bg-white focus:border-primary outline-none text-sm"
                >
                  <option value="all">All Students</option>
                  {kids.map(kid => (
                    <option key={kid.id} value={kid.id}>{kid.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Category Filter */}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setCategoryFilter('all')}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                  categoryFilter === 'all'
                    ? 'bg-primary text-white'
                    : 'bg-bg-alt text-text-muted hover:bg-border'
                }`}
              >
                All
              </button>
              {(Object.entries(CATEGORY_INFO) as [CategoryFilter, typeof CATEGORY_INFO[keyof typeof CATEGORY_INFO]][]).map(([key, info]) => (
                <button
                  key={key}
                  onClick={() => setCategoryFilter(key)}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                    categoryFilter === key
                      ? 'bg-primary text-white'
                      : 'bg-bg-alt text-text-muted hover:bg-border'
                  }`}
                >
                  {info.emoji} {info.name}
                </button>
              ))}
            </div>
          </div>

          {/* Achievement Grid by Tier */}
          {(['platinum', 'gold', 'silver', 'bronze'] as const).map(tier => {
            const tierAchievements = achievementsByTier[tier];
            if (tierAchievements.length === 0) return null;
            
            const style = TIER_STYLES[tier];
            
            return (
              <div key={tier} className="mb-10">
                <h3 className="font-display text-xl font-bold mb-4 flex items-center gap-2">
                  <div className={`w-5 h-5 rounded-full ${style.bg} ${style.border} border-2`} />
                  <span className="capitalize">{tier} Tier</span>
                  <span className="text-text-muted font-normal text-base ml-2">
                    ({tierAchievements.filter(a => earnedKeys.has(a.key)).length}/{tierAchievements.length})
                  </span>
                </h3>
                
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {tierAchievements.map(achievement => {
                    const isEarned = earnedKeys.has(achievement.key);
                    const progress = activeMetrics[achievement.requirement.metric] || 0;
                    const progressPercent = Math.min(100, Math.round((progress / achievement.requirement.value) * 100));
                    
                    return (
                      <div
                        key={achievement.id}
                        className={`relative p-4 rounded-2xl border-2 transition-all duration-300 ${
                          isEarned
                            ? `${style.bg} ${style.border} shadow-lg hover:scale-105`
                            : 'bg-bg-alt border-border opacity-60 hover:opacity-80'
                        } ${showUnlockAnimation === achievement.key ? 'animate-bounce' : ''}`}
                      >
                        {/* Earned Badge */}
                        {isEarned && (
                          <div className="absolute -top-2 -right-2 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center text-white text-xs">
                            ✓
                          </div>
                        )}
                        
                        {/* Emoji */}
                        <div className={`text-4xl mb-2 text-center ${!isEarned && 'grayscale'}`}>
                          {achievement.emoji}
                        </div>
                        
                        {/* Name */}
                        <h4 className={`font-display font-bold text-sm text-center mb-1 ${
                          isEarned ? style.text : 'text-text-muted'
                        }`}>
                          {achievement.name}
                        </h4>
                        
                        {/* Description */}
                        <p className="text-xs text-center text-text-muted mb-2 leading-tight">
                          {achievement.description}
                        </p>
                        
                        {/* Progress Bar (if not earned) */}
                        {!isEarned && (
                          <div className="mt-2">
                            <div className="flex justify-between text-xs text-text-muted mb-1">
                              <span>{progress}</span>
                              <span>{achievement.requirement.value}</span>
                            </div>
                            <div className="h-1.5 bg-border rounded-full overflow-hidden">
                              <div
                                className={`h-full ${style.bg} transition-all`}
                                style={{ width: `${progressPercent}%` }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Empty State */}
          {filteredAchievements.length === 0 && (
            <Card className="text-center py-12">
              <p className="text-text-muted text-lg">No achievements found in this category.</p>
            </Card>
          )}

          {/* No Kids State */}
          {kids.length === 0 && (
            <Card className="text-center py-12 mt-8">
              <p className="text-text-muted text-lg mb-4">Add children to start earning achievements!</p>
              <Button onClick={() => router.push('/manage-kids')}>Add Your First Child</Button>
            </Card>
          )}

          {/* Recent Unlocks (placeholder for future) */}
          {earnedCount > 0 && (
            <Card className="mt-8">
              <h3 className="font-serif italic text-2xl text-primary mb-4">🎉 Keep Going!</h3>
              <p className="text-text-muted">
                You&apos;ve unlocked {earnedCount} achievement{earnedCount !== 1 ? 's' : ''}! 
                Keep learning to earn more badges and celebrate your progress.
              </p>
              
              {/* Next achievements to unlock */}
              <div className="mt-4 pt-4 border-t border-border">
                <h4 className="font-semibold text-sm mb-3">Next achievements to unlock:</h4>
                <div className="flex flex-wrap gap-3">
                  {ACHIEVEMENTS
                    .filter(a => !earnedKeys.has(a.key))
                    .sort((a, b) => {
                      const aProgress = (activeMetrics[a.requirement.metric] || 0) / a.requirement.value;
                      const bProgress = (activeMetrics[b.requirement.metric] || 0) / b.requirement.value;
                      return bProgress - aProgress;
                    })
                    .slice(0, 3)
                    .map(achievement => {
                      const progress = activeMetrics[achievement.requirement.metric] || 0;
                      const progressPercent = Math.round((progress / achievement.requirement.value) * 100);
                      return (
                        <div key={achievement.id} className="flex items-center gap-2 bg-bg-alt px-3 py-2 rounded-xl">
                          <span>{achievement.emoji}</span>
                          <span className="text-sm font-semibold">{achievement.name}</span>
                          <span className="text-xs text-text-muted">({progressPercent}%)</span>
                        </div>
                      );
                    })}
                </div>
              </div>
            </Card>
          )}
        </main>
      </ClientOnly>
    </>
  );
}
