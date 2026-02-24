import { Achievement } from './types';

// All available achievements in the system
export const ACHIEVEMENTS: Achievement[] = [
  // Learning Category - Progress through content
  {
    id: 'first-lesson',
    key: 'first_lesson',
    name: 'First Steps',
    description: 'Complete your very first lesson',
    emoji: '👣',
    category: 'learning',
    tier: 'bronze',
    requirement: { type: 'count', metric: 'lessons_completed', value: 1 }
  },
  {
    id: 'lesson-explorer',
    key: 'lesson_explorer',
    name: 'Lesson Explorer',
    description: 'Complete 10 lessons',
    emoji: '🧭',
    category: 'learning',
    tier: 'bronze',
    requirement: { type: 'count', metric: 'lessons_completed', value: 10 }
  },
  {
    id: 'lesson-adventurer',
    key: 'lesson_adventurer',
    name: 'Lesson Adventurer',
    description: 'Complete 50 lessons',
    emoji: '🗺️',
    category: 'learning',
    tier: 'silver',
    requirement: { type: 'count', metric: 'lessons_completed', value: 50 }
  },
  {
    id: 'lesson-master',
    key: 'lesson_master',
    name: 'Lesson Master',
    description: 'Complete 100 lessons',
    emoji: '🏔️',
    category: 'learning',
    tier: 'gold',
    requirement: { type: 'count', metric: 'lessons_completed', value: 100 }
  },
  {
    id: 'course-champion',
    key: 'course_champion',
    name: 'Course Champion',
    description: 'Finish your first complete course',
    emoji: '🏆',
    category: 'learning',
    tier: 'silver',
    requirement: { type: 'count', metric: 'courses_completed', value: 1 }
  },
  {
    id: 'rising-star',
    key: 'rising_star',
    name: 'Rising Star',
    description: 'Complete 5 courses',
    emoji: '⭐',
    category: 'learning',
    tier: 'gold',
    requirement: { type: 'count', metric: 'courses_completed', value: 5 }
  },
  {
    id: 'diamond-scholar',
    key: 'diamond_scholar',
    name: 'Diamond Scholar',
    description: 'Complete 10 courses',
    emoji: '💎',
    category: 'learning',
    tier: 'platinum',
    requirement: { type: 'count', metric: 'courses_completed', value: 10 }
  },

  // Consistency Category - Building habits
  {
    id: 'attendance-starter',
    key: 'attendance_starter',
    name: 'Showing Up',
    description: 'Log your first day of attendance',
    emoji: '📅',
    category: 'consistency',
    tier: 'bronze',
    requirement: { type: 'count', metric: 'attendance_days', value: 1 }
  },
  {
    id: 'week-warrior',
    key: 'week_warrior',
    name: 'Week Warrior',
    description: '7-day attendance streak',
    emoji: '🔥',
    category: 'consistency',
    tier: 'bronze',
    requirement: { type: 'streak', metric: 'attendance_streak', value: 7 }
  },
  {
    id: 'month-champion',
    key: 'month_champion',
    name: 'Month Champion',
    description: '30-day attendance streak',
    emoji: '🌟',
    category: 'consistency',
    tier: 'silver',
    requirement: { type: 'streak', metric: 'attendance_streak', value: 30 }
  },
  {
    id: 'century-student',
    key: 'century_student',
    name: 'Century Student',
    description: 'Log 100 days of attendance',
    emoji: '💯',
    category: 'consistency',
    tier: 'gold',
    requirement: { type: 'count', metric: 'attendance_days', value: 100 }
  },
  {
    id: 'bookworm-starter',
    key: 'bookworm_starter',
    name: 'Bookworm',
    description: 'Read for 7 days in a row',
    emoji: '📚',
    category: 'consistency',
    tier: 'bronze',
    requirement: { type: 'streak', metric: 'reading_streak', value: 7 }
  },
  {
    id: 'bibliophile',
    key: 'bibliophile',
    name: 'Bibliophile',
    description: 'Read for 30 days in a row',
    emoji: '📖',
    category: 'consistency',
    tier: 'silver',
    requirement: { type: 'streak', metric: 'reading_streak', value: 30 }
  },
  {
    id: 'focus-beginner',
    key: 'focus_beginner',
    name: 'Getting Focused',
    description: 'Complete your first study session',
    emoji: '🎯',
    category: 'consistency',
    tier: 'bronze',
    requirement: { type: 'count', metric: 'study_sessions', value: 1 }
  },
  {
    id: 'focus-master',
    key: 'focus_master',
    name: 'Focus Master',
    description: 'Complete 10 study timer sessions',
    emoji: '⏱️',
    category: 'consistency',
    tier: 'silver',
    requirement: { type: 'count', metric: 'study_sessions', value: 10 }
  },
  {
    id: 'study-champion',
    key: 'study_champion',
    name: 'Study Champion',
    description: 'Complete 50 study timer sessions',
    emoji: '🧠',
    category: 'consistency',
    tier: 'gold',
    requirement: { type: 'count', metric: 'study_sessions', value: 50 }
  },

  // Mastery Category - Excellence in performance
  {
    id: 'perfect-score',
    key: 'perfect_score',
    name: 'Perfect Score',
    description: 'Get 100% on an assignment',
    emoji: '🎯',
    category: 'mastery',
    tier: 'silver',
    requirement: { type: 'score', metric: 'perfect_assignments', value: 1 }
  },
  {
    id: 'triple-perfect',
    key: 'triple_perfect',
    name: 'Triple Perfect',
    description: 'Get 100% on 3 assignments',
    emoji: '🎪',
    category: 'mastery',
    tier: 'gold',
    requirement: { type: 'score', metric: 'perfect_assignments', value: 3 }
  },
  {
    id: 'perfectionist',
    key: 'perfectionist',
    name: 'Perfectionist',
    description: 'Get 100% on 10 assignments',
    emoji: '👑',
    category: 'mastery',
    tier: 'platinum',
    requirement: { type: 'score', metric: 'perfect_assignments', value: 10 }
  },
  {
    id: 'a-student',
    key: 'a_student',
    name: 'A Student',
    description: 'Maintain an A average (90%+) across 10 assignments',
    emoji: '🅰️',
    category: 'mastery',
    tier: 'gold',
    requirement: { type: 'score', metric: 'a_average_count', value: 10 }
  },

  // Milestone Category - Special achievements
  {
    id: 'assignment-starter',
    key: 'assignment_starter',
    name: 'Assignment Starter',
    description: 'Complete your first assignment',
    emoji: '📝',
    category: 'milestone',
    tier: 'bronze',
    requirement: { type: 'count', metric: 'assignments_completed', value: 1 }
  },
  {
    id: 'assignment-pro',
    key: 'assignment_pro',
    name: 'Assignment Pro',
    description: 'Complete 25 assignments',
    emoji: '✅',
    category: 'milestone',
    tier: 'silver',
    requirement: { type: 'count', metric: 'assignments_completed', value: 25 }
  },
  {
    id: 'assignment-legend',
    key: 'assignment_legend',
    name: 'Assignment Legend',
    description: 'Complete 100 assignments',
    emoji: '🏅',
    category: 'milestone',
    tier: 'gold',
    requirement: { type: 'count', metric: 'assignments_completed', value: 100 }
  },
  {
    id: 'portfolio-starter',
    key: 'portfolio_starter',
    name: 'Portfolio Starter',
    description: 'Add your first portfolio item',
    emoji: '🎨',
    category: 'milestone',
    tier: 'bronze',
    requirement: { type: 'count', metric: 'portfolio_items', value: 1 }
  },
  {
    id: 'portfolio-collector',
    key: 'portfolio_collector',
    name: 'Portfolio Collector',
    description: 'Add 10 portfolio items',
    emoji: '🖼️',
    category: 'milestone',
    tier: 'silver',
    requirement: { type: 'count', metric: 'portfolio_items', value: 10 }
  },
  {
    id: 'portfolio-curator',
    key: 'portfolio_curator',
    name: 'Portfolio Curator',
    description: 'Add 25 portfolio items',
    emoji: '🏛️',
    category: 'milestone',
    tier: 'gold',
    requirement: { type: 'count', metric: 'portfolio_items', value: 25 }
  },
  {
    id: 'hour-of-focus',
    key: 'hour_of_focus',
    name: 'Hour of Focus',
    description: 'Accumulate 1 hour of study time',
    emoji: '⏰',
    category: 'milestone',
    tier: 'bronze',
    requirement: { type: 'count', metric: 'study_minutes', value: 60 }
  },
  {
    id: 'study-marathon',
    key: 'study_marathon',
    name: 'Study Marathon',
    description: 'Accumulate 10 hours of study time',
    emoji: '🏃',
    category: 'milestone',
    tier: 'silver',
    requirement: { type: 'count', metric: 'study_minutes', value: 600 }
  },
  {
    id: 'study-olympian',
    key: 'study_olympian',
    name: 'Study Olympian',
    description: 'Accumulate 50 hours of study time',
    emoji: '🏆',
    category: 'milestone',
    tier: 'gold',
    requirement: { type: 'count', metric: 'study_minutes', value: 3000 }
  },
];

// Tier colors and styling
export const TIER_STYLES = {
  bronze: {
    bg: 'bg-amber-100',
    border: 'border-amber-400',
    text: 'text-amber-700',
    glow: 'shadow-amber-200',
    gradient: 'from-amber-200 to-amber-100'
  },
  silver: {
    bg: 'bg-slate-100',
    border: 'border-slate-400',
    text: 'text-slate-600',
    glow: 'shadow-slate-200',
    gradient: 'from-slate-200 to-slate-100'
  },
  gold: {
    bg: 'bg-yellow-100',
    border: 'border-yellow-500',
    text: 'text-yellow-700',
    glow: 'shadow-yellow-200',
    gradient: 'from-yellow-200 to-yellow-100'
  },
  platinum: {
    bg: 'bg-violet-100',
    border: 'border-violet-400',
    text: 'text-violet-600',
    glow: 'shadow-violet-200',
    gradient: 'from-violet-200 to-violet-100'
  }
};

export const CATEGORY_INFO = {
  learning: { name: 'Learning', emoji: '📚', description: 'Progress through lessons and courses' },
  consistency: { name: 'Consistency', emoji: '🔄', description: 'Build good learning habits' },
  mastery: { name: 'Mastery', emoji: '🎯', description: 'Excel in your performance' },
  milestone: { name: 'Milestones', emoji: '🏁', description: 'Reach important achievements' }
};

// Helper to get achievement by key
export function getAchievement(key: string): Achievement | undefined {
  return ACHIEVEMENTS.find(a => a.key === key);
}

// Helper to get achievements by category
export function getAchievementsByCategory(category: Achievement['category']): Achievement[] {
  return ACHIEVEMENTS.filter(a => a.category === category);
}

// Helper to check if achievement is earned based on metrics
export function checkAchievement(achievement: Achievement, metrics: Record<string, number>): boolean {
  const { type, metric, value } = achievement.requirement;
  const currentValue = metrics[metric] || 0;
  
  switch (type) {
    case 'count':
    case 'streak':
    case 'score':
      return currentValue >= value;
    case 'completion':
      return currentValue >= value;
    default:
      return false;
  }
}
