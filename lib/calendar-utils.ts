import { SchoolYear, SchoolBreak, Course } from './types';

export interface LessonMapping {
  expectedLesson: number;
  status: 'ahead' | 'behind' | 'on-track';
  diff: number;
}

export function getExpectedLesson(
  course: Course,
  schoolYear: SchoolYear,
  breaks: SchoolBreak[]
): LessonMapping {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const start = new Date(schoolYear.start_date);
  start.setHours(0, 0, 0, 0);

  const end = new Date(schoolYear.end_date);
  end.setHours(0, 0, 0, 0);

  // If we haven't started school yet
  if (today < start) {
    return { expectedLesson: 1, status: 'on-track', diff: 0 };
  }

  // Active days for this course
  const activeDays = course.active_days ? course.active_days.split(',') : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  const dayMap: Record<string, number> = { 'Sun': 0, 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6 };
  const activeIndices = activeDays.map(d => dayMap[d]);

  let schoolDayCount = 0;
  let targetLesson = 0;

  // Iterate from start to either today or end of school year
  const limit = today < end ? today : end;

  for (let d = new Date(start); d <= limit; d.setDate(d.getDate() + 1)) {
    const dayOfWeek = d.getDay();
    
    // Check if this is an active day for the course
    if (!activeIndices.includes(dayOfWeek)) continue;

    // Check if in any break
    const isBreak = breaks.some(b => {
      const bStart = new Date(b.start_date);
      const bEnd = new Date(b.end_date);
      return d >= bStart && d <= bEnd;
    });

    if (!isBreak) {
      schoolDayCount++;
    }
  }

  targetLesson = Math.min(schoolDayCount, course.total_lessons);
  const diff = course.current_lesson - targetLesson;

  let status: 'ahead' | 'behind' | 'on-track' = 'on-track';
  if (diff > 0) status = 'ahead';
  if (diff < 0) status = 'behind';

  return {
    expectedLesson: targetLesson,
    status,
    diff: Math.abs(diff)
  };
}
