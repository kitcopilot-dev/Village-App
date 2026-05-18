import { getExpectedLesson } from './calendar-utils';
import { Assignment, Attendance, Child, Course, PortfolioItem, SchoolBreak, SchoolYear } from './types';

export type GapPriority = 'urgent' | 'soon' | 'steady';
export type GapCategory = 'attendance' | 'assignments' | 'portfolio' | 'pace';

export interface LearningGapAction {
  id: string;
  childId: string;
  childName: string;
  category: GapCategory;
  priority: GapPriority;
  title: string;
  detail: string;
  metric: string;
  href: string;
}

export interface ChildLearningSnapshot {
  child: Child;
  readinessScore: number;
  actions: LearningGapAction[];
  metrics: {
    missingAttendanceDays: number;
    overdueAssignments: number;
    ungradedAssignments: number;
    portfolioItemsLast30Days: number;
    coursesBehind: number;
  };
}

export interface LearningGapReport {
  snapshots: ChildLearningSnapshot[];
  actions: LearningGapAction[];
  counts: Record<GapPriority, number>;
}

interface BuildReportInput {
  children: Child[];
  courses: Course[];
  attendance: Attendance[];
  assignments: Assignment[];
  portfolio: PortfolioItem[];
  schoolYear: SchoolYear | null;
  breaks: SchoolBreak[];
  today?: Date;
}

const priorityWeight: Record<GapPriority, number> = {
  urgent: 20,
  soon: 10,
  steady: 6,
};

function dateKey(value: string | Date | undefined): string {
  if (!value) return '';
  if (value instanceof Date) return value.toISOString().split('T')[0];
  return value.slice(0, 10);
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function daysBetween(start: string, end: string): number {
  const startDate = new Date(`${start}T12:00:00`);
  const endDate = new Date(`${end}T12:00:00`);
  return Math.round((endDate.getTime() - startDate.getTime()) / 86400000);
}

function getRecentWeekdays(today: Date, calendarDays = 14): string[] {
  const dates: string[] = [];
  for (let offset = calendarDays - 1; offset >= 0; offset--) {
    const date = addDays(today, -offset);
    const day = date.getDay();
    if (day !== 0 && day !== 6) {
      dates.push(dateKey(date));
    }
  }
  return dates;
}

function isCompleteAssignment(assignment: Assignment): boolean {
  const status = assignment.status?.toLowerCase();
  return status === 'completed' || status === 'graded';
}

function isOpenAssignment(assignment: Assignment): boolean {
  return !isCompleteAssignment(assignment);
}

function normalizedSubject(value?: string): string {
  return value?.trim() || 'General';
}

function byChild<T extends { child?: string }>(items: T[], childId: string): T[] {
  return items.filter((item) => item.child === childId);
}

export function buildLearningGapReport({
  children,
  courses,
  attendance,
  assignments,
  portfolio,
  schoolYear,
  breaks,
  today = new Date(),
}: BuildReportInput): LearningGapReport {
  const todayKey = dateKey(today);
  const recentWeekdays = getRecentWeekdays(today);

  const snapshots = children.map((child): ChildLearningSnapshot => {
    const childCourses = byChild(courses, child.id);
    const childAttendance = byChild(attendance, child.id);
    const childAssignments = byChild(assignments, child.id);
    const childPortfolio = byChild(portfolio, child.id);
    const actions: LearningGapAction[] = [];

    const loggedAttendanceDates = new Set(childAttendance.map((item) => dateKey(item.date)));
    const missingAttendanceDates = recentWeekdays.filter((date) => !loggedAttendanceDates.has(date));

    if (missingAttendanceDates.length > 0) {
      actions.push({
        id: `${child.id}-attendance`,
        childId: child.id,
        childName: child.name,
        category: 'attendance',
        priority: missingAttendanceDates.length >= 4 ? 'urgent' : 'soon',
        title: 'Backfill attendance',
        detail: `${child.name} has ${missingAttendanceDates.length} unlogged weekday${missingAttendanceDates.length === 1 ? '' : 's'} in the last two weeks.`,
        metric: `${missingAttendanceDates.length} missing`,
        href: '/attendance',
      });
    }

    const overdueAssignments = childAssignments.filter((assignment) => (
      isOpenAssignment(assignment) &&
      Boolean(assignment.due_date) &&
      dateKey(assignment.due_date) < todayKey
    ));

    if (overdueAssignments.length > 0) {
      actions.push({
        id: `${child.id}-overdue`,
        childId: child.id,
        childName: child.name,
        category: 'assignments',
        priority: 'urgent',
        title: 'Clear overdue assignments',
        detail: overdueAssignments.slice(0, 3).map((assignment) => assignment.title).join(', '),
        metric: `${overdueAssignments.length} overdue`,
        href: '/assignments',
      });
    }

    const dueSoonAssignments = childAssignments.filter((assignment) => {
      const dueDate = dateKey(assignment.due_date);
      return isOpenAssignment(assignment) && dueDate >= todayKey && daysBetween(todayKey, dueDate) <= 7;
    });

    if (dueSoonAssignments.length > 0) {
      actions.push({
        id: `${child.id}-due-soon`,
        childId: child.id,
        childName: child.name,
        category: 'assignments',
        priority: 'soon',
        title: 'Plan this week\'s assignment work',
        detail: dueSoonAssignments.slice(0, 3).map((assignment) => assignment.title).join(', '),
        metric: `${dueSoonAssignments.length} due soon`,
        href: '/assignments',
      });
    }

    const ungradedAssignments = childAssignments.filter((assignment) => (
      isCompleteAssignment(assignment) &&
      (assignment.score === undefined || assignment.score === null)
    ));

    if (ungradedAssignments.length > 0) {
      actions.push({
        id: `${child.id}-ungraded`,
        childId: child.id,
        childName: child.name,
        category: 'assignments',
        priority: 'steady',
        title: 'Add missing scores',
        detail: `${child.name} has completed work without a score, which weakens transcript and progress summaries.`,
        metric: `${ungradedAssignments.length} unscored`,
        href: '/assignments',
      });
    }

    const portfolioItemsLast30Days = childPortfolio.filter((item) => {
      const itemDate = dateKey(item.date || item.created);
      return itemDate && daysBetween(itemDate, todayKey) <= 30;
    });

    if (portfolioItemsLast30Days.length === 0 && (childAssignments.length > 0 || childCourses.length > 0)) {
      actions.push({
        id: `${child.id}-portfolio-recent`,
        childId: child.id,
        childName: child.name,
        category: 'portfolio',
        priority: 'soon',
        title: 'Capture a fresh work sample',
        detail: `${child.name} has no portfolio evidence from the last 30 days.`,
        metric: '0 recent samples',
        href: '/portfolio',
      });
    }

    const assignmentSubjects = childAssignments.map((assignment) => normalizedSubject(assignment.subject));
    const courseSubjects = childCourses.map((course) => normalizedSubject(course.name));
    const activeSubjects = Array.from(new Set([...assignmentSubjects, ...courseSubjects]));
    const portfolioSubjects = new Set(childPortfolio.map((item) => normalizedSubject(item.subject)));
    const subjectsWithoutEvidence = activeSubjects.filter((subject) => !portfolioSubjects.has(subject));

    if (subjectsWithoutEvidence.length > 0) {
      actions.push({
        id: `${child.id}-portfolio-subjects`,
        childId: child.id,
        childName: child.name,
        category: 'portfolio',
        priority: subjectsWithoutEvidence.length >= 3 ? 'soon' : 'steady',
        title: 'Round out subject evidence',
        detail: subjectsWithoutEvidence.slice(0, 4).join(', '),
        metric: `${subjectsWithoutEvidence.length} uncovered`,
        href: '/portfolio',
      });
    }

    const coursesBehind = schoolYear
      ? childCourses.filter((course) => {
          const mapping = getExpectedLesson(course, schoolYear, breaks);
          return mapping.status === 'behind' && mapping.diff >= 2;
        })
      : [];

    coursesBehind.slice(0, 3).forEach((course) => {
      const mapping = schoolYear ? getExpectedLesson(course, schoolYear, breaks) : null;
      actions.push({
        id: `${child.id}-pace-${course.id}`,
        childId: child.id,
        childName: child.name,
        category: 'pace',
        priority: mapping && mapping.diff >= 5 ? 'urgent' : 'soon',
        title: `${course.name} is behind pace`,
        detail: mapping
          ? `Expected lesson ${mapping.expectedLesson}; current lesson is ${course.current_lesson}.`
          : 'Course pacing needs a school year calendar to calculate accurately.',
        metric: mapping ? `${mapping.diff} behind` : 'check pace',
        href: '/dashboard',
      });
    });

    const penalty = actions.reduce((sum, action) => sum + priorityWeight[action.priority], 0);
    const readinessScore = Math.max(0, 100 - penalty);

    return {
      child,
      readinessScore,
      actions: actions.sort((a, b) => priorityWeight[b.priority] - priorityWeight[a.priority]),
      metrics: {
        missingAttendanceDays: missingAttendanceDates.length,
        overdueAssignments: overdueAssignments.length,
        ungradedAssignments: ungradedAssignments.length,
        portfolioItemsLast30Days: portfolioItemsLast30Days.length,
        coursesBehind: coursesBehind.length,
      },
    };
  });

  const actions = snapshots
    .flatMap((snapshot) => snapshot.actions)
    .sort((a, b) => priorityWeight[b.priority] - priorityWeight[a.priority]);

  return {
    snapshots,
    actions,
    counts: {
      urgent: actions.filter((action) => action.priority === 'urgent').length,
      soon: actions.filter((action) => action.priority === 'soon').length,
      steady: actions.filter((action) => action.priority === 'steady').length,
    },
  };
}
