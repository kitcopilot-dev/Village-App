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
      <main className="max-w-5xl mx-auto my-8 sm:my-12 px-4 sm:px-8 pb-20 animate-fade-in">
        {/* Controls - Hidden on print */}
        <div className="print:hidden mb-12">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-6 mb-8">
            <div>
              <h2 className="font-display text-4xl sm:text-6xl font-extrabold tracking-tight mb-2">Transcript</h2>
              <p className="text-text-muted text-sm sm:text-base">Generate an official academic record for your records.</p>
            </div>
            <Button variant="ghost" onClick={() => router.push('/dashboard')}>← Dashboard</Button>
          </div>

          <Card className="p-6 md:p-8">
            <div className="flex flex-col md:flex-row gap-6 items-end">
              <div className="flex-1 w-full">
                <Select 
                  label="Select Student" 
                  value={selectedKidId} 
                  onChange={(e) => setSelectedKidId(e.target.value)}
                >
                  {kids.map(k => <option key={k.id} value={k.id}>{k.name}</option>)}
                </Select>
              </div>
              <Button onClick={handlePrint} disabled={!selectedKidId} className="w-full md:w-auto">
                🖨️ Print / Save as PDF
              </Button>
            </div>
          </Card>
        </div>

        {/* Transcript Document - Optimized for printing */}
        {selectedKid && (
          <div className="bg-white border-2 border-border rounded-[2rem] p-8 md:p-16 shadow-shadow print:border-0 print:p-0 print:shadow-none mx-auto max-w-[8.5in]">
            {/* Document Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 mb-16 pb-12 border-b-4 border-primary/10">
              <div>
                <h1 className="font-display text-primary text-3xl sm:text-4xl font-extrabold uppercase tracking-tighter m-0 mb-1">
                  Village<span className="text-secondary">.</span> Homeschool
                </h1>
                <p className="font-serif italic text-lg text-text-muted m-0">Official Academic Record</p>
              </div>
              <div className="text-left md:text-right">
                <p className="text-xs font-bold uppercase tracking-widest text-primary mb-1">Issue Date</p>
                <p className="font-bold text-lg m-0">{new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
              </div>
            </div>

            {/* Student Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mb-16">
              <section>
                <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary mb-6 border-b pb-2">Student Information</h3>
                <div className="space-y-4">
                  <div className="flex justify-between">
                    <span className="text-sm text-text-muted">Full Name</span>
                    <span className="text-sm font-bold text-text-main">{selectedKid.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-text-muted">Current Age</span>
                    <span className="text-sm font-bold text-text-main">{selectedKid.age} years</span>
                  </div>
                  {selectedKid.grade && (
                    <div className="flex justify-between">
                      <span className="text-sm text-text-muted">Grade Level</span>
                      <span className="text-sm font-bold text-text-main">{selectedKid.grade}</span>
                    </div>
                  )}
                  {selectedKid.focus && (
                    <div className="flex justify-between">
                      <span className="text-sm text-text-muted">Primary Focus</span>
                      <span className="text-sm font-bold text-text-main">{selectedKid.focus}</span>
                    </div>
                  )}
                </div>
              </section>

              <section>
                <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-secondary mb-6 border-b pb-2">Academic Summary</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-bg-alt rounded-2xl text-center">
                    <p className="text-[10px] font-bold uppercase text-text-muted mb-1">Cumulative GPA</p>
                    <p className="font-display text-2xl font-extrabold text-primary m-0">{overallGPA.toFixed(2)}</p>
                  </div>
                  <div className="p-4 bg-bg-alt rounded-2xl text-center">
                    <p className="text-[10px] font-bold uppercase text-text-muted mb-1">Letter Grade</p>
                    <p className="font-display text-2xl font-extrabold text-secondary m-0">{scoreToLetterGrade(overallAverage)}</p>
                  </div>
                  <div className="p-4 bg-bg-alt rounded-2xl text-center col-span-2">
                    <p className="text-[10px] font-bold uppercase text-text-muted mb-1">Work Samples Completed</p>
                    <p className="font-display text-2xl font-extrabold text-accent m-0">{gradedAssignments.length}</p>
                  </div>
                </div>
              </section>
            </div>

            {/* Course Record Table */}
            {courses.length > 0 && (
              <div className="mb-16">
                <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary mb-6 border-b pb-2">Course Record</h3>
                <div className="overflow-hidden rounded-2xl border border-border shadow-sm">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-bg-alt">
                        <th className="text-left px-6 py-4 text-xs font-bold uppercase tracking-wider text-text-muted">Course Title</th>
                        <th className="text-center px-6 py-4 text-xs font-bold uppercase tracking-wider text-text-muted">Progress</th>
                        <th className="text-right px-6 py-4 text-xs font-bold uppercase tracking-wider text-text-muted">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {courses.map(course => {
                        const progress = Math.min(course.current_lesson - 1, course.total_lessons);
                        const percentage = Math.round((progress / course.total_lessons) * 100);
                        const isComplete = course.current_lesson > course.total_lessons;
                        return (
                          <tr key={course.id} className="hover:bg-bg-alt/30 transition-colors">
                            <td className="px-6 py-4 text-sm font-bold text-text-main">{course.name}</td>
                            <td className="px-6 py-4 text-sm text-center text-text-muted">
                              {progress} / {course.total_lessons} lessons ({percentage}%)
                            </td>
                            <td className="px-6 py-4 text-right">
                              <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase ${
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
              </div>
            )}

            {/* Subject Performance Table */}
            {Object.keys(subjectData).length > 0 && (
              <div className="mb-16">
                <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-secondary mb-6 border-b pb-2">Subject Performance</h3>
                <div className="overflow-hidden rounded-2xl border border-border shadow-sm">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-bg-alt">
                        <th className="text-left px-6 py-4 text-xs font-bold uppercase tracking-wider text-text-muted">Subject</th>
                        <th className="text-center px-6 py-4 text-xs font-bold uppercase tracking-wider text-text-muted">Work items</th>
                        <th className="text-center px-6 py-4 text-xs font-bold uppercase tracking-wider text-text-muted">Avg. Score</th>
                        <th className="text-right px-6 py-4 text-xs font-bold uppercase tracking-wider text-text-muted">Final Grade</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {Object.entries(subjectData)
                        .sort((a, b) => b[1].average - a[1].average)
                        .map(([subject, data]) => (
                          <tr key={subject} className="hover:bg-bg-alt/30 transition-colors">
                            <td className="px-6 py-4 text-sm font-bold text-text-main">{subject}</td>
                            <td className="px-6 py-4 text-sm text-center text-text-muted">{data.assignments.length}</td>
                            <td className="px-6 py-4 text-sm text-center font-bold text-text-main">{data.average.toFixed(1)}%</td>
                            <td className="px-6 py-4 text-right">
                              <span className="font-display font-bold text-lg text-primary">{scoreToLetterGrade(data.average)}</span>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Signature Section */}
            <div className="mt-24 pt-12 border-t-2 border-dashed border-border grid grid-cols-2 gap-16">
              <div className="text-center">
                <div className="h-16 border-b border-text-muted mb-4 mx-auto w-full max-w-[250px]"></div>
                <p className="text-[10px] font-bold uppercase text-text-muted">Parent / Instructor Signature</p>
              </div>
              <div className="text-center">
                <div className="h-16 border-b border-text-muted mb-4 mx-auto w-full max-w-[250px]"></div>
                <p className="text-[10px] font-bold uppercase text-text-muted">Date of Certification</p>
              </div>
            </div>

            {/* Legal Footer */}
            <div className="mt-16 text-center text-[10px] text-text-muted leading-relaxed max-w-lg mx-auto italic">
              This academic transcript is a certified record of home instruction. Village Homeschool provides the administrative framework, but the parent/instructor is solely responsible for the accuracy of the data and compliance with local education laws.
            </div>
          </div>
        )}

        {!selectedKid && kids.length === 0 && (
          <div className="text-center py-24 bg-bg-alt rounded-[3rem] border-2 border-dashed border-border">
            <p className="text-text-muted text-xl font-serif italic mb-8">No students found in your village.</p>
            <Button size="lg" onClick={() => router.push('/manage-kids')}>
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
