'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { getPocketBase } from '@/lib/pocketbase';
import { Child, ActivityLog, Attendance, Assignment, PortfolioItem, Course } from '@/lib/types';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ClientOnly } from '@/components/ui/ClientOnly';

// Unified activity item type
interface FeedItem {
  id: string;
  type: 'lesson' | 'attendance' | 'assignment' | 'portfolio' | 'course_complete' | 'milestone';
  childId: string;
  childName: string;
  title: string;
  description?: string;
  timestamp: Date;
  icon: string;
  color: string;
  metadata?: Record<string, unknown>;
}

// Time formatting helpers
const formatRelativeTime = (date: Date): string => {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay === 1) return 'Yesterday';
  if (diffDay < 7) return `${diffDay} days ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const formatTimeOfDay = (date: Date): string => {
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
};

const getDateGroup = (date: Date): string => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const itemDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (itemDate.getTime() === today.getTime()) return 'Today';
  if (itemDate.getTime() === yesterday.getTime()) return 'Yesterday';
  
  const diffDays = Math.floor((today.getTime() - itemDate.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 7) return date.toLocaleDateString('en-US', { weekday: 'long' });
  if (diffDays < 14) return 'Last Week';
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
};

// Child colors for avatars
const getChildColor = (childId: string): string => {
  const colors = [
    'bg-primary text-white',
    'bg-secondary text-white',
    'bg-accent text-white',
    'bg-blue-500 text-white',
    'bg-purple-500 text-white',
    'bg-pink-500 text-white',
    'bg-teal-500 text-white',
    'bg-orange-500 text-white',
  ];
  const hash = childId.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
  return colors[hash % colors.length];
};

export default function FeedPage() {
  const router = useRouter();
  const pb = getPocketBase();
  const loadMoreRef = useRef<HTMLDivElement>(null);
  
  const [kids, setKids] = useState<Child[]>([]);
  const [feedItems, setFeedItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  
  // Filters
  const [filterChild, setFilterChild] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const ITEMS_PER_PAGE = 30;

  useEffect(() => {
    if (!pb.authStore.isValid) {
      router.push('/');
      return;
    }
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      const userId = pb.authStore.model?.id;
      if (!userId) return;

      // Load children
      const childRecords = await pb.collection('children').getFullList({
        filter: `user = "${userId}"`,
        sort: 'name'
      });
      setKids(childRecords as unknown as Child[]);

      // Load feed items
      await loadFeedItems(userId, childRecords as unknown as Child[], 1, true);
    } catch (error) {
      console.error('Feed load error:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadFeedItems = async (userId: string, children: Child[], pageNum: number, reset: boolean = false) => {
    const items: FeedItem[] = [];
    
    // Helper to get child name
    const getChildName = (childId: string): string => {
      const kid = children.find(k => k.id === childId);
      return kid?.name || 'Student';
    };

    try {
      // Load activity logs
      const activities = await pb.collection('activity_logs').getFullList({
        filter: `user = "${userId}"`,
        sort: '-date'
      }) as unknown as ActivityLog[];

      activities.forEach(activity => {
        items.push({
          id: `activity-${activity.id}`,
          type: activity.type === 'lesson_complete' ? 'lesson' : 
                activity.type === 'portfolio_add' ? 'portfolio' : 'milestone',
          childId: activity.child,
          childName: getChildName(activity.child),
          title: activity.title,
          description: activity.description,
          timestamp: new Date(activity.date),
          icon: activity.type === 'lesson_complete' ? '📚' : 
                activity.type === 'portfolio_add' ? '🎨' : '🎉',
          color: activity.type === 'lesson_complete' ? 'border-l-primary' : 
                 activity.type === 'portfolio_add' ? 'border-l-purple-500' : 'border-l-accent',
        });
      });
    } catch (e) {
      console.warn('Activity logs not available');
    }

    try {
      // Load attendance records
      const attendance = await pb.collection('attendance').getFullList({
        filter: `user = "${userId}"`,
        sort: '-date'
      }) as unknown as Attendance[];

      attendance.forEach(record => {
        const statusEmoji = record.status === 'present' ? '✓' : 
                          record.status === 'sick' ? '🤒' : 
                          record.status === 'absent' ? '✗' : '½';
        const statusText = record.status === 'present' ? 'marked present' : 
                          record.status === 'sick' ? 'marked sick' : 
                          record.status === 'absent' ? 'marked absent' : 
                          record.status === 'half-day' ? 'marked half-day' : 'attendance recorded';
        
        items.push({
          id: `attendance-${record.id}`,
          type: 'attendance',
          childId: record.child,
          childName: getChildName(record.child),
          title: `${statusEmoji} ${getChildName(record.child)} ${statusText}`,
          description: record.notes,
          timestamp: new Date(record.date),
          icon: '📅',
          color: record.status === 'present' ? 'border-l-green-500' : 
                 record.status === 'sick' ? 'border-l-orange-500' : 'border-l-red-500',
          metadata: { status: record.status }
        });
      });
    } catch (e) {
      console.warn('Attendance not available');
    }

    try {
      // Load completed/graded assignments
      const assignments = await pb.collection('assignments').getFullList({
        filter: `user = "${userId}" && (status = "completed" || status = "Graded")`,
        sort: '-updated'
      }) as unknown as Assignment[];

      assignments.forEach(assignment => {
        const scoreText = assignment.score !== undefined ? ` (${assignment.score}%)` : '';
        items.push({
          id: `assignment-${assignment.id}`,
          type: 'assignment',
          childId: assignment.child || '',
          childName: assignment.child ? getChildName(assignment.child) : 'Family',
          title: `Completed: ${assignment.title}${scoreText}`,
          description: assignment.feedback || assignment.description,
          timestamp: new Date(assignment.updated),
          icon: assignment.status === 'Graded' ? '📝' : '✅',
          color: assignment.score && assignment.score >= 90 ? 'border-l-green-500' : 
                 assignment.score && assignment.score >= 70 ? 'border-l-blue-500' : 'border-l-secondary',
          metadata: { score: assignment.score, subject: assignment.subject }
        });
      });
    } catch (e) {
      console.warn('Assignments not available');
    }

    try {
      // Load portfolio items
      const portfolio = await pb.collection('portfolio_items').getFullList({
        filter: `user = "${userId}"`,
        sort: '-created'
      }) as unknown as PortfolioItem[];

      portfolio.forEach(item => {
        items.push({
          id: `portfolio-${item.id}`,
          type: 'portfolio',
          childId: item.child,
          childName: getChildName(item.child),
          title: `Added to portfolio: ${item.title}`,
          description: item.description,
          timestamp: new Date(item.created),
          icon: '🖼️',
          color: 'border-l-purple-500',
          metadata: { subject: item.subject, hasImage: !!item.image }
        });
      });
    } catch (e) {
      console.warn('Portfolio not available');
    }

    try {
      // Load courses to detect completions
      const courses = await pb.collection('courses').getFullList({
        filter: `user = "${userId}"`,
        sort: '-updated'
      }) as unknown as Course[];

      courses.forEach(course => {
        // Course completion
        if (course.current_lesson > course.total_lessons) {
          items.push({
            id: `course-complete-${course.id}`,
            type: 'course_complete',
            childId: course.child,
            childName: getChildName(course.child),
            title: `🎉 Completed ${course.name}!`,
            description: `Finished all ${course.total_lessons} lessons`,
            timestamp: new Date(course.updated),
            icon: '🏆',
            color: 'border-l-accent',
            metadata: { courseName: course.name, totalLessons: course.total_lessons }
          });
        }
      });
    } catch (e) {
      console.warn('Courses not available');
    }

    // Sort by timestamp (newest first) and dedupe
    const sortedItems = items
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    // Simple pagination simulation
    const startIdx = (pageNum - 1) * ITEMS_PER_PAGE;
    const pageItems = sortedItems.slice(startIdx, startIdx + ITEMS_PER_PAGE);
    
    if (reset) {
      setFeedItems(pageItems);
    } else {
      setFeedItems(prev => [...prev, ...pageItems]);
    }
    
    setHasMore(startIdx + ITEMS_PER_PAGE < sortedItems.length);
  };

  const handleLoadMore = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const nextPage = page + 1;
    setPage(nextPage);
    
    const userId = pb.authStore.model?.id;
    if (userId) {
      await loadFeedItems(userId, kids, nextPage, false);
    }
    setLoadingMore(false);
  };

  // Filter items
  const filteredItems = useMemo(() => {
    return feedItems.filter(item => {
      if (filterChild !== 'all' && item.childId !== filterChild) return false;
      if (filterType !== 'all' && item.type !== filterType) return false;
      return true;
    });
  }, [feedItems, filterChild, filterType]);

  // Group items by date
  const groupedItems = useMemo(() => {
    const groups: Record<string, FeedItem[]> = {};
    filteredItems.forEach(item => {
      const group = getDateGroup(item.timestamp);
      if (!groups[group]) groups[group] = [];
      groups[group].push(item);
    });
    return groups;
  }, [filteredItems]);

  const handleLogout = () => {
    pb.authStore.clear();
    router.push('/');
  };

  const handleRefresh = async () => {
    setLoading(true);
    setPage(1);
    await loadInitialData();
    setLoading(false);
  };

  if (loading) {
    return (
      <>
        <Header showLogout onLogout={handleLogout} />
        <main className="max-w-2xl mx-auto my-12 px-4">
          <div className="animate-pulse space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="bg-bg-alt rounded-xl h-24" />
            ))}
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <Header showLogout onLogout={handleLogout} />
      <ClientOnly>
        <main className="max-w-2xl mx-auto my-8 px-4 pb-24 animate-fade-in">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight">
                📰 Activity Feed
              </h1>
              <p className="text-text-muted text-sm mt-1">
                Everything happening in your homeschool
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => router.push('/dashboard')}>
                ← Dashboard
              </Button>
              <Button variant="ghost" size="sm" onClick={handleRefresh}>
                🔄
              </Button>
            </div>
          </div>

          {/* Filters */}
          <Card className="p-4 mb-6 sticky top-0 z-10 bg-bg/95 backdrop-blur">
            <div className="flex flex-wrap gap-3">
              {/* Child Filter */}
              <select
                value={filterChild}
                onChange={(e) => setFilterChild(e.target.value)}
                className="px-3 py-2 rounded-xl border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="all">All Children</option>
                {kids.map(kid => (
                  <option key={kid.id} value={kid.id}>{kid.name}</option>
                ))}
              </select>

              {/* Type Filter */}
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="px-3 py-2 rounded-xl border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="all">All Activity</option>
                <option value="lesson">📚 Lessons</option>
                <option value="attendance">📅 Attendance</option>
                <option value="assignment">✅ Assignments</option>
                <option value="portfolio">🖼️ Portfolio</option>
                <option value="course_complete">🏆 Completions</option>
              </select>

              {/* Item count */}
              <span className="px-3 py-2 text-sm text-text-muted">
                {filteredItems.length} items
              </span>
            </div>
          </Card>

          {/* Feed Items */}
          {filteredItems.length === 0 ? (
            <Card className="p-12 text-center">
              <div className="text-5xl mb-4">📭</div>
              <h3 className="font-display text-xl font-bold mb-2">No activity yet</h3>
              <p className="text-text-muted mb-6">
                Start logging attendance, completing lessons, or adding portfolio items!
              </p>
              <div className="flex gap-3 justify-center flex-wrap">
                <Button variant="outline" onClick={() => router.push('/attendance')}>
                  📅 Log Attendance
                </Button>
                <Button variant="outline" onClick={() => router.push('/portfolio')}>
                  🎨 Add Portfolio Item
                </Button>
              </div>
            </Card>
          ) : (
            <div className="space-y-6">
              {Object.entries(groupedItems).map(([dateGroup, items]) => (
                <div key={dateGroup}>
                  {/* Date Group Header */}
                  <div className="flex items-center gap-3 mb-4">
                    <div className="h-px flex-1 bg-border" />
                    <span className="text-xs font-bold uppercase tracking-wider text-text-muted px-2">
                      {dateGroup}
                    </span>
                    <div className="h-px flex-1 bg-border" />
                  </div>

                  {/* Items */}
                  <div className="space-y-3">
                    {items.map((item) => (
                      <div
                        key={item.id}
                        className={`bg-card border-l-4 ${item.color} rounded-r-xl p-4 hover:bg-bg-alt transition-colors`}
                      >
                        <div className="flex gap-3">
                          {/* Child Avatar */}
                          <div className={`w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center text-sm font-bold ${getChildColor(item.childId)}`}>
                            {item.childName.charAt(0)}
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            {/* Header */}
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <span className="font-semibold text-sm">{item.childName}</span>
                                <span className="text-text-muted text-sm"> · </span>
                                <span className="text-text-muted text-sm">{formatRelativeTime(item.timestamp)}</span>
                              </div>
                              <span className="text-lg flex-shrink-0">{item.icon}</span>
                            </div>
                            
                            {/* Title */}
                            <p className="text-text mt-1 font-medium">{item.title}</p>
                            
                            {/* Description */}
                            {item.description && (
                              <p className="text-text-muted text-sm mt-1 line-clamp-2">
                                {item.description}
                              </p>
                            )}
                            
                            {/* Metadata badges */}
                            {item.metadata && (
                              <div className="flex gap-2 mt-2 flex-wrap">
                                {typeof item.metadata.subject === 'string' && item.metadata.subject && (
                                  <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
                                    {item.metadata.subject}
                                  </span>
                                )}
                                {typeof item.metadata.score === 'number' && (
                                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                    item.metadata.score >= 90 ? 'bg-green-100 text-green-700' :
                                    item.metadata.score >= 80 ? 'bg-blue-100 text-blue-700' :
                                    item.metadata.score >= 70 ? 'bg-yellow-100 text-yellow-700' :
                                    'bg-red-100 text-red-700'
                                  }`}>
                                    Score: {item.metadata.score}%
                                  </span>
                                )}
                                {item.metadata.hasImage === true && (
                                  <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 text-xs font-medium">
                                    📷 Has photo
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {/* Load More */}
              {hasMore && (
                <div ref={loadMoreRef} className="py-8 text-center">
                  <Button 
                    variant="outline" 
                    onClick={handleLoadMore}
                    disabled={loadingMore}
                  >
                    {loadingMore ? 'Loading...' : 'Load More'}
                  </Button>
                </div>
              )}

              {/* End of feed */}
              {!hasMore && filteredItems.length > 0 && (
                <div className="py-8 text-center text-text-muted">
                  <div className="text-2xl mb-2">🏁</div>
                  <p className="text-sm">You&apos;ve reached the beginning!</p>
                </div>
              )}
            </div>
          )}

          {/* Quick Actions FAB */}
          <div className="fixed bottom-6 right-6 flex flex-col gap-2">
            <Button 
              className="w-12 h-12 rounded-full shadow-lg"
              onClick={() => router.push('/today')}
              title="Today's View"
            >
              ☀️
            </Button>
          </div>
        </main>
      </ClientOnly>
    </>
  );
}
