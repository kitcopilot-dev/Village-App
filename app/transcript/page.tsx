'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getPocketBase } from '@/lib/pocketbase';
import { Child, Course, Assignment } from '@/lib/types';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Input';
import { LoadingScreen } from '@/components/ui/Spinner';

export default function TranscriptPage() {
  const router = useRouter();
  const pb = getPocketBase();
  
  const [kids, setKids] = useState<Child[]>([]);
  const [selectedKidId, setSelectedKidId] = useState('');
  const [courses, setCourses] = useState<Course[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!pb.authStore.isValid) {
      router.push('/');
      return;
    }
    loadData();
  }, []);

  useEffect(() => {
    if (selectedKidId) {
      loadKidData(selectedKidId);
    }
  }, [selectedKidId]);

  const loadData = async () => {
    try {
      const userId = pb.authStore.model?.id;
      if (!userId) return;

      const childRecords = await pb.collection('children').getFullList({
        filter: `user = "${userId}"`,
        sort: 'name'
      });

      setKids(childRecords as unknown as Child[]);
      if (childRecords.length > 0 && !selectedKidId) {
        setSelectedKidId(childRecords[0].id);
      }
    } catch (error) {
      console.error('Load error:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadKidData = async (kidId: string) => {
    try {
      const [courseRecords, assignmentRecords] = await Promise.all([
        pb.collection('courses').getFullList({
          filter: `child = "${kidId}"`,
          sort: 'name'
        }),
        pb.collection('assignments').getFullList({
          filter: `child = "${kidId}"`,
          sort: '-due_date'
        })
      ]);

      setCourses(courseRecords as unknown as Course[]);
      setAssignments(assignmentRecords as unknown as Assignment[]);
    } catch (error) {
      console.error('Kid data load error:', error);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  // Calculate GPA
  const scoreToGPA = (score: number): number => {
    if (score >= 90) return 4.0;
    if (score >= 80) return 3.0;
    if (score >= 70) return 2.0;
    if (score >= 60) return 1.0;
    return 0.0;
  };

  const scoreToLetterGrade = (score: number): string => {
    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
  };

  const gradedAssignments = assignments.filter(a => a.score !== undefined && a.score !== null);
  const overallAverage = gradedAssignments.length > 0
    ? gradedAssignments.reduce((sum, a) => sum + (a.score || 0), 0) / gradedAssignments.length
    : 0;
  const overallGPA = gradedAssignments.length > 0
    ? gradedAssignments.reduce((sum, a) => sum + scoreToGPA(a.score || 0), 0) / gradedAssignments.length
    : 0;

  // Subject breakdown
  const subjectData: Record<string, { assignments: Assignment[]; average: number }> = {};
  gradedAssignments.forEach(a => {
    const subject = a.subject || 'General';
    if (!subjectData[subject]) {
      subjectData[subject] = { assignments: [], average: 0 };
    }
    subjectData[subject].assignments.push(a);
  });
  Object.keys(subjectData).forEach(subject => {
    const total = subjectData[subject].assignments.reduce((sum, a) => sum + (a.score || 0), 0);
    subjectData[subject].average = total / subjectData[subject].assignments.length;
  });

  const selectedKid = kids.find(k => k.id === selectedKidId);

  if (loading) {
    return <LoadingScreen message="Loading transcript data..." />;
  }

  return (
    <>
      <Header showLogout onLogout={() => { pb.authStore.clear(); router.push('/'); }} />
      <main className="max-w-5xl mx-auto my-12 px-8 pb-20">
        {/* Controls - Hidden on print */}
        <div className="print:hidden mb-8">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
            <div>
              <h2 className="font-display text-4xl font-extrabold tracking-tight mb-2">Academic Transcript</h2>
              <p className="text-text-muted">Generate a comprehensive academic record</p>
            </div>
            <Button variant="ghost" onClick={() => router.push('/dashboard')}>← Dashboard</Button>
          </div>

          <div className="flex gap-4 items-end">
            <Select 
              label="Select Student" 
              value={selectedKidId} 
              onChange={(e) => setSelectedKidId(e.target.value)}
              className="flex-1"
            >
              {kids.map(k => <option key={k.id} value={k.id}>{k.name}</option>)}
            </Select>
            <Button onClick={handlePrint} disabled={!selectedKidId}>
              🖨️ Print / Export PDF
            </Button>
          </div>
        </div>

        {/* Transcript Document - Optimized for printing */}
        {selectedKid && (
          <div className="bg-white border-2 border-border rounded-lg p-12 print:border-0 print:p-8">
            {/* Header */}
            <div className="text-center mb-12 pb-8 border-b-2 border-border">
              <h1 className="font-display text-4xl font-extrabold mb-2">Academic Transcript</h1>
              <p className="text-lg text-text-muted">Village Homeschool</p>
              <p className="text-sm text-text-muted mt-4">Generated: {new Date().toLocaleDateString()}</p>
            </div>

            {/* Student Information */}
            <div className="mb-12">
              <h2 className="font-display text-2xl font-bold mb-4 text-primary border-b pb-2">Student Information</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-text-muted mb-1">Student Name</p>
                  <p className="font-bold text-lg">{selectedKid.name}</p>
                </div>
                <div>
                  <p className="text-sm text-text-muted mb-1">Age</p>
                  <p className="font-bold text-lg">{selectedKid.age} years</p>
                </div>
                {selectedKid.grade && (
                  <div>
                    <p className="text-sm text-text-muted mb-1">Grade Level</p>
                    <p className="font-bold text-lg">{selectedKid.grade}</p>
                  </div>
                )}
                {selectedKid.focus && (
                  <div>
                    <p className="text-sm text-text-muted mb-1">Focus Areas</p>
                    <p className="font-bold text-lg">{selectedKid.focus}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Academic Summary */}
            {gradedAssignments.length > 0 && (
              <div className="mb-12">
                <h2 className="font-display text-2xl font-bold mb-4 text-primary border-b pb-2">Academic Summary</h2>
                <div className="grid grid-cols-3 gap-8">
                  <div className="text-center p-6 bg-bg-alt rounded-lg">
                    <p className="text-sm text-text-muted mb-2">Cumulative GPA</p>
                    <p className="font-display text-4xl font-extrabold text-primary">{overallGPA.toFixed(2)}</p>
                    <p className="text-xs text-text-muted mt-1">out of 4.0</p>
                  </div>
                  <div className="text-center p-6 bg-bg-alt rounded-lg">
                    <p className="text-sm text-text-muted mb-2">Overall Average</p>
                    <p className="font-display text-4xl font-extrabold text-secondary">{overallAverage.toFixed(1)}%</p>
                    <p className="text-xs text-text-muted mt-1">Grade: {scoreToLetterGrade(overallAverage)}</p>
                  </div>
                  <div className="text-center p-6 bg-bg-alt rounded-lg">
                    <p className="text-sm text-text-muted mb-2">Assignments Completed</p>
                    <p className="font-display text-4xl font-extrabold text-accent">{gradedAssignments.length}</p>
                    <p className="text-xs text-text-muted mt-1">graded work</p>
                  </div>
                </div>
              </div>
            )}

            {/* Course Record */}
            {courses.length > 0 && (
              <div className="mb-12">
                <h2 className="font-display text-2xl font-bold mb-4 text-primary border-b pb-2">Course Record</h2>
                <table className="w-full">
                  <thead>
                    <tr className="border-b-2 border-border">
                      <th className="text-left py-3 font-bold">Course Name</th>
                      <th className="text-center py-3 font-bold">Progress</th>
                      <th className="text-center py-3 font-bold">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {courses.map(course => {
                      const progress = Math.min(course.current_lesson - 1, course.total_lessons);
                      const percentage = Math.round((progress / course.total_lessons) * 100);
                      const isComplete = course.current_lesson > course.total_lessons;
                      return (
                        <tr key={course.id} className="border-b border-border">
                          <td className="py-3 font-semibold">{course.name}</td>
                          <td className="text-center py-3">{progress} / {course.total_lessons} lessons ({percentage}%)</td>
                          <td className="text-center py-3">
                            <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                              isComplete ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                            }`}>
                              {isComplete ? 'Completed' : 'In Progress'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Subject Breakdown */}
            {Object.keys(subjectData).length > 0 && (
              <div className="mb-12">
                <h2 className="font-display text-2xl font-bold mb-4 text-primary border-b pb-2">Subject Performance</h2>
                <table className="w-full">
                  <thead>
                    <tr className="border-b-2 border-border">
                      <th className="text-left py-3 font-bold">Subject</th>
                      <th className="text-center py-3 font-bold">Assignments</th>
                      <th className="text-center py-3 font-bold">Average</th>
                      <th className="text-center py-3 font-bold">Grade</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(subjectData)
                      .sort((a, b) => b[1].average - a[1].average)
                      .map(([subject, data]) => (
                        <tr key={subject} className="border-b border-border">
                          <td className="py-3 font-semibold">{subject}</td>
                          <td className="text-center py-3">{data.assignments.length}</td>
                          <td className="text-center py-3 font-bold">{data.average.toFixed(1)}%</td>
                          <td className="text-center py-3">
                            <span className="font-bold text-lg">{scoreToLetterGrade(data.average)}</span>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Assignment History */}
            {gradedAssignments.length > 0 && (
              <div className="mb-12 page-break-before">
                <h2 className="font-display text-2xl font-bold mb-4 text-primary border-b pb-2">Assignment History</h2>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b-2 border-border">
                      <th className="text-left py-2 font-bold">Date</th>
                      <th className="text-left py-2 font-bold">Title</th>
                      <th className="text-left py-2 font-bold">Subject</th>
                      <th className="text-center py-2 font-bold">Score</th>
                      <th className="text-center py-2 font-bold">Grade</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gradedAssignments.map(a => (
                      <tr key={a.id} className="border-b border-border">
                        <td className="py-2">{new Date(a.due_date).toLocaleDateString()}</td>
                        <td className="py-2 font-medium">{a.title}</td>
                        <td className="py-2">{a.subject || '—'}</td>
                        <td className="text-center py-2 font-bold">{a.score}%</td>
                        <td className="text-center py-2 font-bold">{scoreToLetterGrade(a.score || 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Footer */}
            <div className="mt-16 pt-8 border-t-2 border-border text-center text-sm text-text-muted">
              <p>This transcript is an official record of academic work completed through Village Homeschool.</p>
              <p className="mt-2">For questions or verification, please contact the family.</p>
            </div>
          </div>
        )}

        {!selectedKid && kids.length === 0 && (
          <div className="text-center py-20">
            <p className="text-text-muted text-lg">No children added yet.</p>
            <Button className="mt-6" onClick={() => router.push('/manage-kids')}>
              Add Your First Child
            </Button>
          </div>
        )}
      </main>

      {/* Print styles */}
      <style jsx global>{`
        @media print {
          body {
            background: white;
          }
          @page {
            margin: 1in;
          }
          .page-break-before {
            page-break-before: always;
          }
        }
      `}</style>
    </>
  );
}
