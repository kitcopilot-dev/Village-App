/**
 * Plausible Analytics Utilities
 * 
 * Track custom events for Village app user interactions
 */

// Extend Window interface to include plausible
declare global {
  interface Window {
    plausible?: (
      eventName: string,
      options?: { props?: Record<string, string | number> }
    ) => void;
  }
}

/**
 * Track a custom event in Plausible Analytics
 * @param eventName - Name of the event to track
 * @param props - Optional event properties
 */
export function trackEvent(
  eventName: string,
  props?: Record<string, string | number>
) {
  if (typeof window !== 'undefined' && window.plausible) {
    window.plausible(eventName, { props });
  }
}

/**
 * Pre-defined event tracking functions for key Village actions
 */

// Student tracking
export function trackStudentLogin(studentId?: string, studentName?: string) {
  trackEvent('Student Login', {
    ...(studentId && { studentId }),
    ...(studentName && { studentName }),
  });
}

export function trackStudentLogout(studentId?: string) {
  trackEvent('Student Logout', studentId ? { studentId } : undefined);
}

export function trackDashboardView(dashboardType: 'student' | 'parent' | 'admin') {
  trackEvent('Dashboard View', { dashboardType });
}

// Lesson tracking
export function trackLessonStart(lessonId: string, lessonTitle?: string) {
  trackEvent('Lesson Start', {
    lessonId,
    ...(lessonTitle && { lessonTitle }),
  });
}

export function trackLessonComplete(lessonId: string, duration?: number) {
  trackEvent('Lesson Complete', {
    lessonId,
    ...(duration && { durationSeconds: duration }),
  });
}

// Assignment tracking
export function trackAssignmentComplete(
  assignmentId: string,
  assignmentTitle?: string,
  score?: number
) {
  trackEvent('Assignment Complete', {
    assignmentId,
    ...(assignmentTitle && { assignmentTitle }),
    ...(score !== undefined && { score }),
  });
}

export function trackAssignmentCreate(assignmentId?: string, assignmentTitle?: string, subject?: string) {
  trackEvent('Assignment Created', {
    ...(assignmentId && { assignmentId }),
    ...(assignmentTitle && { assignmentTitle }),
    ...(subject && { subject }),
  });
}

export function trackAssignmentGrade(assignmentId?: string, score?: number) {
  trackEvent('Assignment Graded', {
    ...(assignmentId && { assignmentId }),
    ...(score !== undefined && { score }),
  });
}

// AI Spark tracking
export function trackSparkGeneration(sparkType: string, subject?: string) {
  trackEvent('AI Spark Generated', {
    sparkType,
    ...(subject && { subject }),
  });
}

// Kid management tracking
export function trackManageKids(action: 'add' | 'edit' | 'delete') {
  trackEvent('Manage Kids', { action });
}

export function trackChildAdd(childName?: string, childGrade?: string) {
  trackEvent('Child Added', {
    ...(childName && { childName }),
    ...(childGrade && { childGrade }),
  });
}

export function trackChildEdit(childId?: string, childName?: string) {
  trackEvent('Child Edited', {
    ...(childId && { childId }),
    ...(childName && { childName }),
  });
}

// Calendar tracking
export function trackCalendarEventCreated(eventType?: string) {
  trackEvent('Calendar Event Created', eventType ? { eventType } : undefined);
}

// Attendance tracking
export function trackAttendanceMarked(status: 'present' | 'absent' | 'excused') {
  trackEvent('Attendance Marked', { status });
}

// Resource tracking
export function trackResourceShared(resourceType?: string) {
  trackEvent('Resource Shared', resourceType ? { resourceType } : undefined);
}

/**
 * Object-based API for backwards compatibility
 */
export const analytics = {
  studentLogin: trackStudentLogin,
  studentLogout: trackStudentLogout,
  dashboardView: trackDashboardView,
  lessonStart: trackLessonStart,
  lessonComplete: trackLessonComplete,
  assignmentComplete: trackAssignmentComplete,
  sparkGeneration: trackSparkGeneration,
  manageKids: trackManageKids,
  calendarEventCreated: trackCalendarEventCreated,
  attendanceMarked: trackAttendanceMarked,
  resourceShared: trackResourceShared,
};
