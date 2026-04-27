'use client';

import { useMemo } from 'react';
import { Course, SchoolYear, SchoolBreak, Child } from '@/lib/types';
import { getExpectedLesson } from '@/lib/calendar-utils';

interface DaysBehindAlert {
  childId: string;
  childName: string;
  childGrade: string;
  courseName: string;
  expectedLesson: number;
  currentLesson: number;
  daysDiff: number;
  status: 'on-track' | 'behind' | 'ahead';
}

interface AlertBannerProps {
  kids: (Child & { courses?: Course[] })[];
  schoolYear: SchoolYear | null;
  breaks: SchoolBreak[];
}

export function AlertBanner({ kids, schoolYear, breaks }: AlertBannerProps) {
  const alerts = useMemo(() => {
    if (!schoolYear) return [];

    const allAlerts: DaysBehindAlert[] = [];

    kids.forEach(kid => {
      kid.courses?.forEach(course => {
        if (!course.start_date || !course.active_days) return;
        
        const mapping = getExpectedLesson(course, schoolYear, breaks);
        
        allAlerts.push({
          childId: kid.id,
          childName: kid.name,
          childGrade: kid.grade || '',
          courseName: course.name,
          expectedLesson: mapping.expectedLesson,
          currentLesson: course.current_lesson,
          daysDiff: mapping.diff,
          status: mapping.status
        });
      });
    });

    // Sort: behind first, then by days diff
    return allAlerts.sort((a, b) => {
      if (a.status === 'behind' && b.status !== 'behind') return -1;
      if (b.status === 'behind' && a.status !== 'behind') return 1;
      if (a.status === 'behind' && b.status === 'behind') {
        return b.daysDiff - a.daysDiff;
      }
      return 0;
    });
  }, [kids, schoolYear, breaks]);

  const behindAlerts = alerts.filter(a => a.status === 'behind');
  const aheadAlerts = alerts.filter(a => a.status === 'ahead');

  if (alerts.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3 mb-6">
      {/* Behind Alerts */}
      {behindAlerts.length > 0 && (
        <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xl">⚠️</span>
            <h4 className="font-display font-bold text-red-800 m-0">
              {behindAlerts.length} Course{behindAlerts.length > 1 ? 's' : ''} Behind Schedule
            </h4>
          </div>
          <div className="flex flex-wrap gap-2">
            {behindAlerts.map((alert, i) => (
              <div 
                key={i}
                className="bg-white border border-red-200 rounded-lg px-3 py-2 flex items-center gap-2"
              >
                <div className="text-red-600 font-bold text-sm">
                  {alert.childName} — {alert.courseName}
                </div>
                <div className="text-red-500 text-xs">
                  {alert.daysDiff} day{alert.daysDiff !== 1 ? 's' : ''} behind
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* On Track / Ahead Alerts */}
      {(aheadAlerts.length > 0 || (behindAlerts.length === 0 && alerts.length > 0)) && (
        <div className="bg-green-50 border-2 border-green-200 rounded-xl p-4">
          <div className="flex items-center gap-2">
            {aheadAlerts.length > 0 ? (
              <>
                <span className="text-xl">🎉</span>
                <h4 className="font-display font-bold text-green-800 m-0">
                  {aheadAlerts.length} Course{aheadAlerts.length > 1 ? 's' : ''} Ahead!
                </h4>
              </>
            ) : (
              <>
                <span className="text-xl">✅</span>
                <h4 className="font-display font-bold text-green-800 m-0">
                  All Courses On Track
                </h4>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}