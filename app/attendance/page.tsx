'use client';

import { useState, useEffect } from 'react';
import { Attendance, Child } from '@/lib/types';
import { getChildren, getAttendance, markAttendance } from '@/lib/pocketbase';

export default function AttendancePage() {
  const [children, setChildren] = useState<Child[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [weekStart, setWeekStart] = useState<Date>(() => {
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Monday start
    return new Date(now.setDate(diff));
  });
  const [loading, setLoading] = useState(true);

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(weekStart);
    date.setDate(date.getDate() + i);
    return date;
  });

  useEffect(() => {
    async function loadData() {
      try {
        const [childrenData, attendanceData] = await Promise.all([
          getChildren(),
          getAttendance(weekStart.toISOString().split('T')[0])
        ]);
        setChildren(childrenData);
        setAttendance(attendanceData);
      } catch (error) {
        console.error('Failed to load attendance data:', error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [weekStart]);

  const handleMarkAttendance = async (childId: string, date: string, status: Attendance['status']) => {
    try {
      const updated = await markAttendance(childId, date, status);
      setAttendance(prev => {
        const existing = prev.findIndex(a => a.child === childId && a.date === date);
        if (existing > -1) {
          const newAttendance = [...prev];
          newAttendance[existing] = updated;
          return newAttendance;
        }
        return [...prev, updated];
      });
    } catch (error) {
      console.error('Failed to mark attendance:', error);
    }
  };

  const getAttendanceStatus = (childId: string, date: string) => {
    return attendance.find(a => a.child === childId && a.date === date)?.status || null;
  };

  const navigateWeek = (direction: 'prev' | 'next') => {
    const newStart = new Date(weekStart);
    newStart.setDate(newStart.getDate() + (direction === 'next' ? 7 : -7));
    setWeekStart(newStart);
  };

  if (loading) {
    return <div className="p-8 text-center">Loading attendance data...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Attendance Tracking</h1>
          <div className="flex gap-4 items-center">
            <button
              onClick={() => navigateWeek('prev')}
              className="px-4 py-2 bg-white border rounded-lg hover:bg-gray-50"
            >
              ← Previous Week
            </button>
            <span className="text-lg font-medium">
              {weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} -{' '}
              {new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
            <button
              onClick={() => navigateWeek('next')}
              className="px-4 py-2 bg-white border rounded-lg hover:bg-gray-50"
            >
              Next Week →
            </button>
          </div>
        </div>

        {children.length === 0 ? (
          <div className="bg-white rounded-xl shadow p-8 text-center">
            <p className="text-gray-500">No children added yet. Add children in your profile to track attendance.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="p-4 text-left text-sm font-medium text-gray-500 uppercase tracking-wider">
                      Student
                    </th>
                    {weekDays.map(day => (
                      <th key={day.toISOString()} className="p-4 text-center text-sm font-medium text-gray-500 uppercase tracking-wider">
                        <div>{day.toLocaleDateString('en-US', { weekday: 'short' })}</div>
                        <div className="text-xs text-gray-400">{day.getDate()}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {children.map(child => (
                    <tr key={child.id} className="hover:bg-gray-50">
                      <td className="p-4 font-medium text-gray-900">{child.name}</td>
                      {weekDays.map(day => {
                        const dateStr = day.toISOString().split('T')[0];
                        const status = getAttendanceStatus(child.id, dateStr);
                        return (
                          <td key={dateStr} className="p-4 text-center">
                            <select
                              value={status || ''}
                              onChange={(e) => handleMarkAttendance(child.id, dateStr, e.target.value as Attendance['status'])}
                              className={`px-2 py-1 rounded text-sm border ${
                                status === 'present' ? 'bg-green-50 border-green-200 text-green-800' :
                                status === 'absent' ? 'bg-red-50 border-red-200 text-red-800' :
                                status === 'half-day' ? 'bg-yellow-50 border-yellow-200 text-yellow-800' :
                                status === 'sick' ? 'bg-blue-50 border-blue-200 text-blue-800' :
                                status === 'holiday' ? 'bg-purple-50 border-purple-200 text-purple-800' :
                                'bg-gray-50 border-gray-200 text-gray-500'
                              }`}
                            >
                              <option value="">--</option>
                              <option value="present">Present</option>
                              <option value="absent">Absent</option>
                              <option value="half-day">Half Day</option>
                              <option value="sick">Sick</option>
                              <option value="holiday">Holiday</option>
                            </select>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="mt-8 bg-white rounded-xl shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Attendance Legend</h2>
          <div className="flex flex-wrap gap-4">
            {[
              { status: 'present', color: 'bg-green-50 border-green-200 text-green-800', label: 'Present' },
              { status: 'absent', color: 'bg-red-50 border-red-200 text-red-800', label: 'Absent' },
              { status: 'half-day', color: 'bg-yellow-50 border-yellow-200 text-yellow-800', label: 'Half Day' },
              { status: 'sick', color: 'bg-blue-50 border-blue-200 text-blue-800', label: 'Sick' },
              { status: 'holiday', color: 'bg-purple-50 border-purple-200 text-purple-800', label: 'Holiday' },
            ].map(({ status, color, label }) => (
              <div key={status} className={`px-3 py-1 rounded border ${color}`}>{label}</div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
