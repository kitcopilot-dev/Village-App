'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getPocketBase } from '@/lib/pocketbase';
import { Child, Course, Assignment, SchoolYear } from '@/lib/types';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/Button';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { LoadingScreen } from '@/components/ui/Spinner';
import { Toast } from '@/components/ui/Toast';

// School Info stored in localStorage
interface SchoolInfo {
  schoolName: string;
  schoolAddress: string;
  schoolPhone: string;
  schoolEmail: string;
  instructorName: string;
}

const DEFAULT_SCHOOL_INFO: SchoolInfo = {
  schoolName: '',
  schoolAddress: '',
  schoolPhone: '',
  schoolEmail: '',
  instructorName: '',
};

export default function EnhancedTranscriptPage() {
  const router = useRouter();
  const pb = getPocketBase();
  
  const [kids, setKids] = useState<Child[]>([]);
  const [selectedKidId, setSelectedKidId] = useState('');
  const [courses, setCourses] = useState<Course[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [schoolYears, setSchoolYears] = useState<SchoolYear[]>([]);
  const [selectedYear, setSelectedYear] = useState<SchoolYear | null>(null);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // School info modal
  const [isSchoolModalOpen, setIsSchoolModalOpen] = useState(false);
  const [schoolInfo, setSchoolInfo] = useState<SchoolInfo>(DEFAULT_SCHOOL_INFO);
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);
  
  // Print options
  const [showAttendance, setShowAttendance] = useState(true);
  const [showCourses, setShowCourses] = useState(true);
  const [showGrades, setShowGrades] = useState(true);
  const [showSignature, setShowSignature] = useState(true);

  useEffect(() => {
    if (!pb.authStore.isValid) {
      router.push('/');
      return;
    }
    loadSchoolInfo();
    loadData();
  }, []);

  useEffect(() => {
    if (selectedKidId && selectedYear) {
      loadKidData();
    }
  }, [selectedKidId, selectedYear]);

  const loadSchoolInfo = () => {
    try {
      const stored = localStorage.getItem('village_school_info');
      if (stored) {
        setSchoolInfo(JSON.parse(stored));
      }
    } catch (e) {
      console.error('Failed to load school info:', e);
    }
  };

  const saveSchoolInfo = () => {
    try {
      localStorage.setItem('village_school_info', JSON.stringify(schoolInfo));
      setToast({ message: 'School info saved!', type: 'success' });
      setIsSchoolModalOpen(false);
    } catch (e) {
      setToast({ message: 'Failed to save.', type: 'error' });
    }
  };

  const loadData = async () => {
    try {
      const userId = pb.authStore.model?.id;
      if (!userId) return;

      const [childRecords, yearRecords] = await Promise.all([
        pb.collection('children').getFullList({
          filter: `user = "${userId}"`,
          sort: 'name'
        }),
        pb.collection('school_years').getFullList({
          filter: `user = "${userId}"`,
          sort: '-start_date'
        })
      ]);

      setKids(childRecords as unknown as Child[]);
      setSchoolYears(yearRecords as unknown as SchoolYear[]);
      
      if (childRecords.length > 0) {
        setSelectedKidId(childRecords[0].id);
      }
      if (yearRecords.length > 0) {
        setSelectedYear(yearRecords[0] as unknown as SchoolYear);
      }
    } catch (error) {
      console.error('Load error:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadKidData = async () => {
    if (!selectedKidId || !selectedYear) return;
    
    try {
      const userId = pb.authStore.model?.id;
      if (!userId) return;

      const [courseRecords, assignmentRecords, attendanceRecords] = await Promise.all([
        pb.collection('courses').getFullList({
          filter: `child = "${selectedKidId}"`,
          sort: 'name'
        }),
        pb.collection('assignments').getFullList({
          filter: `child = "${selectedKidId}"`,
          sort: '-due_date'
        }),
        pb.collection('attendance').getFullList({
          filter: `child = "${selectedKidId}"`,
        }).catch(() => [])
      ]);

      setCourses(courseRecords as unknown as Course[]);
      setAssignments(assignmentRecords as unknown as Assignment[]);
      setAttendance(attendanceRecords);
    } catch (error) {
      console.error('Kid data load error:', error);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  // Calculate attendance for selected year
  const calculateAttendance = () => {
    if (!selectedYear || attendance.length === 0) return null;
    
    const yearStart = new Date(selectedYear.start_date);
    const yearEnd = new Date(selectedYear.end_date);
    
    const relevant = attendance.filter(a => {
      const date = new Date(a.date);
      return date >= yearStart && date <= yearEnd;
    });
    
    const present = relevant.filter(a => a.status === 'present').length;
    const absent = relevant.filter(a => a.status === 'absent').length;
    const sick = relevant.filter(a => a.status === 'sick').length;
    const halfDay = relevant.filter(a => a.status === 'half-day').length;
    const holiday = relevant.filter(a => a.status === 'holiday').length;
    const total = relevant.length;
    
    return { present, absent, sick, halfDay, holiday, total };
  };

  // GPA helpers
  const scoreToGPA = (score: number): number => {
    if (score >= 93) return 4.0;
    if (score >= 90) return 3.7;
    if (score >= 87) return 3.3;
    if (score >= 83) return 3.0;
    if (score >= 80) return 2.7;
    if (score >= 77) return 2.3;
    if (score >= 73) return 2.0;
    if (score >= 70) return 1.7;
    if (score >= 67) return 1.3;
    if (score >= 63) return 1.0;
    if (score >= 60) return 0.7;
    return 0.0;
  };

  const scoreToLetterGrade = (score: number): string => {
    if (score >= 97) return 'A+';
    if (score >= 93) return 'A';
    if (score >= 90) return 'A-';
    if (score >= 87) return 'B+';
    if (score >= 83) return 'B';
    if (score >= 80) return 'B-';
    if (score >= 77) return 'C+';
    if (score >= 73) return 'C';
    if (score >= 70) return 'C-';
    if (score >= 67) return 'D+';
    if (score >= 63) return 'D';
    if (score >= 60) return 'D-';
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
  const attendanceStats = calculateAttendance();

  if (loading) {
    return (
      <>
        <Header showLogout onLogout={() => { pb.authStore.clear(); router.push('/'); }} />
        <main className="max-w-5xl mx-auto my-12 px-8">
          <LoadingScreen message="Loading transcript..." />
        </main>
      </>
    );
  }

  return (
    <>
      <Header showLogout onLogout={() => { pb.authStore.clear(); router.push('/'); }} />
      
      {/* Controls - Hidden on print */}
      <main className="max-w-5xl mx-auto my-8 sm:my-12 px-4 sm:px-8 pb-20 animate-fade-in">
        <div className="print:hidden mb-8">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-6 mb-8">
            <div>
              <h2 className="font-display text-4xl sm:text-6xl font-extrabold tracking-tight mb-2">
                📜 Enhanced Transcript
              </h2>
              <p className="text-text-muted text-sm sm:text-base">
                Professional academic record with school letterhead.
              </p>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setIsSchoolModalOpen(true)}>
                🏫 School Info
              </Button>
              <Button variant="ghost" onClick={() => router.push('/transcript')}>
                ← Original
              </Button>
              <Button variant="ghost" onClick={() => router.push('/dashboard')}>
                Dashboard
              </Button>
            </div>
          </div>

          <Card className="p-6 md:p-8">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
              <div>
                <Select 
                  label="Select Student" 
                  value={selectedKidId} 
                  onChange={(e) => setSelectedKidId(e.target.value)}
                >
                  {kids.map(k => <option key={k.id} value={k.id}>{k.name}</option>)}
                </Select>
              </div>
              <div>
                <Select 
                  label="School Year" 
                  value={selectedYear?.id || ''} 
                  onChange={(e) => {
                    const year = schoolYears.find(y => y.id === e.target.value);
                    if (year) setSelectedYear(year);
                  }}
                >
                  {schoolYears.map(y => (
                    <option key={y.id} value={y.id}>{y.name}</option>
                  ))}
                </Select>
              </div>
              <Button onClick={handlePrint} disabled={!selectedKidId} className="w-full sm:w-auto">
                🖨️ Print / Save PDF
              </Button>
            </div>
          </Card>

          {/* Print Options */}
          <Card className="mt-6 p-6">
            <h4 className="font-bold text-sm mb-4 uppercase tracking-wider text-text-muted">
              Print Options
            </h4>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={showAttendance} 
                  onChange={(e) => setShowAttendance(e.target.checked)}
                  className="w-4 h-4 rounded text-primary"
                />
                <span className="text-sm font-medium">Attendance</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={showCourses} 
                  onChange={(e) => setShowCourses(e.target.checked)}
                  className="w-4 h-4 rounded text-primary"
                />
                <span className="text-sm font-medium">Courses</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={showGrades} 
                  onChange={(e) => setShowGrades(e.target.checked)}
                  className="w-4 h-4 rounded text-primary"
                />
                <span className="text-sm font-medium">Grades</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={showSignature} 
                  onChange={(e) => setShowSignature(e.target.checked)}
                  className="w-4 h-4 rounded text-primary"
                />
                <span className="text-sm font-medium">Signature</span>
              </label>
            </div>
          </Card>
        </div>

        {/* Transcript Document */}
        {selectedKid && selectedYear && (
          <div className="bg-white border-2 border-border rounded-[2rem] p-8 md:p-12 shadow-lg print:border-0 print:p-0 print:shadow-none mx-auto max-w-[8.5in]">
            {/* School Header */}
            {(schoolInfo.schoolName || schoolInfo.schoolAddress) && (
              <div className="text-center mb-10 pb-6 border-b-2 border-primary/20">
                {schoolInfo.schoolName && (
                  <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-primary uppercase tracking-tight mb-2">
                    {schoolInfo.schoolName}
                  </h1>
                )}
                {(schoolInfo.schoolAddress || schoolInfo.schoolPhone) && (
                  <p className="text-sm text-text-muted">
                    {schoolInfo.schoolAddress && <span>{schoolInfo.schoolAddress}</span>}
                    {schoolInfo.schoolPhone && <span> ��� {schoolInfo.schoolPhone}</span>}
                    {schoolInfo.schoolEmail && <span> • {schoolInfo.schoolEmail}</span>}
                  </p>
                )}
              </div>
            )}

            {/* Document Title */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10">
              <div>
                <h2 className="font-display text-primary text-3xl sm:text-4xl font-extrabold uppercase tracking-tighter m-0 mb-2">
                  Academic Transcript
                </h2>
                <p className="font-serif italic text-lg text-text-muted m-0">
                  Official Record of Academic Work
                </p>
              </div>
              <div className="text-left md:text-right bg-primary/5 px-6 py-4 rounded-xl">
                <p className="text-xs font-bold uppercase tracking-widest text-primary mb-1">School Year</p>
                <p className="font-bold text-xl text-text-main m-0">{selectedYear.name}</p>
              </div>
            </div>

            {/* Student Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">
              <section>
                <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary mb-4 border-b pb-2">
                  Student Information
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between py-2 border-b border-border/30">
                    <span className="text-sm text-text-muted">Full Name</span>
                    <span className="text-sm font-bold text-text-main">{selectedKid.name}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-border/30">
                    <span className="text-sm text-text-muted">Date of Birth</span>
                    <span className="text-sm font-bold text-text-main">
                      {'birthdate' in selectedKid && (selectedKid as any).birthdate || 'On file'}
                    </span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-border/30">
                    <span className="text-sm text-text-muted">Grade Level</span>
                    <span className="text-sm font-bold text-text-main">{selectedKid.grade || 'On file'}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-border/30">
                    <span className="text-sm text-text-muted">Primary Focus</span>
                    <span className="text-sm font-bold text-text-main">{selectedKid.focus || 'General'}</span>
                  </div>
                </div>
              </section>

              <section>
                <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-secondary mb-4 border-b pb-2">
                  Academic Summary
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-4 bg-primary/5 rounded-xl text-center">
                    <p className="text-[10px] font-bold uppercase text-text-muted mb-1">Cumulative GPA</p>
                    <p className="font-display text-2xl font-extrabold text-primary m-0">
                      {overallGPA > 0 ? overallGPA.toFixed(2) : 'N/A'}
                    </p>
                  </div>
                  <div className="p-4 bg-secondary/5 rounded-xl text-center">
                    <p className="text-[10px] font-bold uppercase text-text-muted mb-1">Letter Grade</p>
                    <p className="font-display text-2xl font-extrabold text-secondary m-0">
                      {overallAverage > 0 ? scoreToLetterGrade(overallAverage) : 'N/A'}
                    </p>
                  </div>
                  <div className="p-4 bg-accent/5 rounded-xl text-center">
                    <p className="text-[10px] font-bold uppercase text-text-muted mb-1">Assignments</p>
                    <p className="font-display text-2xl font-extrabold text-accent m-0">
                      {gradedAssignments.length}
                    </p>
                  </div>
                  <div className="p-4 bg-green-50 rounded-xl text-center">
                    <p className="text-[10px] font-bold uppercase text-text-muted mb-1">Courses</p>
                    <p className="font-display text-2xl font-extrabold text-green-600 m-0">
                      {courses.length}
                    </p>
                  </div>
                </div>
              </section>
            </div>

            {/* Attendance Record */}
            {showAttendance && attendanceStats && (
              <div className="mb-10">
                <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary mb-4 border-b pb-2">
                  Attendance Record • {selectedYear.name}
                </h3>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                  <div className="p-3 bg-green-50 rounded-xl text-center">
                    <p className="text-2xl font-bold text-green-600">{attendanceStats.present}</p>
                    <p className="text-[10px] font-bold uppercase text-green-700">Present</p>
                  </div>
                  <div className="p-3 bg-red-50 rounded-xl text-center">
                    <p className="text-2xl font-bold text-red-600">{attendanceStats.absent}</p>
                    <p className="text-[10px] font-bold uppercase text-red-700">Absent</p>
                  </div>
                  <div className="p-3 bg-orange-50 rounded-xl text-center">
                    <p className="text-2xl font-bold text-orange-600">{attendanceStats.sick}</p>
                    <p className="text-[10px] font-bold uppercase text-orange-700">Sick</p>
                  </div>
                  <div className="p-3 bg-yellow-50 rounded-xl text-center">
                    <p className="text-2xl font-bold text-yellow-600">{attendanceStats.halfDay}</p>
                    <p className="text-[10px] font-bold uppercase text-yellow-700">Half Day</p>
                  </div>
                  <div className="p-3 bg-blue-50 rounded-xl text-center">
                    <p className="text-2xl font-bold text-blue-600">{attendanceStats.holiday}</p>
                    <p className="text-[10px] font-bold uppercase text-blue-700">Holiday</p>
                  </div>
                  <div className="p-3 bg-gray-100 rounded-xl text-center">
                    <p className="text-2xl font-bold text-gray-600">{attendanceStats.total}</p>
                    <p className="text-[10px] font-bold uppercase text-gray-600">Total Days</p>
                  </div>
                </div>
              </div>
            )}

            {/* Course Record */}
            {showCourses && courses.length > 0 && (
              <div className="mb-10">
                <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary mb-4 border-b pb-2">
                  Course Enrollment
                </h3>
                <div className="overflow-hidden rounded-xl border border-border shadow-sm">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-primary/5">
                        <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-text-muted">Course</th>
                        <th className="text-center px-4 py-3 text-xs font-bold uppercase tracking-wider text-text-muted">Lessons</th>
                        <th className="text-center px-4 py-3 text-xs font-bold uppercase tracking-wider text-text-muted">Progress</th>
                        <th className="text-right px-4 py-3 text-xs font-bold uppercase tracking-wider text-text-muted">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {courses.map(course => {
                        const progress = Math.min(course.current_lesson - 1, course.total_lessons);
                        const percentage = Math.round((progress / course.total_lessons) * 100);
                        const isComplete = course.current_lesson > course.total_lessons;
                        return (
                          <tr key={course.id} className="hover:bg-primary/5 transition-colors">
                            <td className="px-4 py-3 text-sm font-semibold text-text-main">{course.name}</td>
                            <td className="px-4 py-3 text-sm text-center text-text-muted">
                              {progress} / {course.total_lessons}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <div className="w-full bg-gray-200 rounded-full h-2">
                                <div 
                                  className={`h-2 rounded-full ${isComplete ? 'bg-green-500' : 'bg-primary'}`}
                                  style={{ width: `${percentage}%` }}
                                />
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${
                                isComplete ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                              }`}>
                                {isComplete ? '✓ Completed' : 'In Progress'}
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

            {/* Subject Performance */}
            {showGrades && Object.keys(subjectData).length > 0 && (
              <div className="mb-10">
                <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-secondary mb-4 border-b pb-2">
                  Subject Performance
                </h3>
                <div className="overflow-hidden rounded-xl border border-border shadow-sm">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-secondary/5">
                        <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-text-muted">Subject</th>
                        <th className="text-center px-4 py-3 text-xs font-bold uppercase tracking-wider text-text-muted">Items</th>
                        <th className="text-center px-4 py-3 text-xs font-bold uppercase tracking-wider text-text-muted">Average</th>
                        <th className="text-right px-4 py-3 text-xs font-bold uppercase tracking-wider text-text-muted">Grade</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {Object.entries(subjectData)
                        .sort((a, b) => b[1].average - a[1].average)
                        .map(([subject, data]) => (
                          <tr key={subject} className="hover:bg-secondary/5 transition-colors">
                            <td className="px-4 py-3 text-sm font-semibold text-text-main">{subject}</td>
                            <td className="px-4 py-3 text-sm text-center text-text-muted">{data.assignments.length}</td>
                            <td className="px-4 py-3 text-sm text-center font-bold text-text-main">
                              {data.average.toFixed(1)}%
                            </td>
                            <td className="px-4 py-3 text-right">
                              <span className="font-display font-bold text-lg text-secondary">
                                {scoreToLetterGrade(data.average)}
                              </span>
                              <span className="text-xs text-text-muted ml-2">
                                ({scoreToGPA(data.average).toFixed(1)})
                              </span>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Signature Section */}
            {showSignature && (
              <div className="mt-16 pt-8 border-t-2 border-dashed border-border">
                <div className="grid grid-cols-2 gap-12">
                  <div className="text-center">
                    <div className="h-16 border-b-2 border-text-main mb-4 mx-auto w-full max-w-[280px]"></div>
                    <p className="text-xs font-bold uppercase text-text-muted mb-1">
                      {schoolInfo.instructorName || 'Parent/Instructor'}
                    </p>
                    <p className="text-[10px] font-bold uppercase text-text-muted">
                      Parent / Instructor Signature
                    </p>
                  </div>
                  <div className="text-center">
                    <div className="h-16 border-b-2 border-text-main mb-4 mx-auto w-full max-w-[280px]"></div>
                    <p className="text-xs font-bold uppercase text-text-muted mb-1">
                      {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                    </p>
                    <p className="text-[10px] font-bold uppercase text-text-muted">
                      Date of Certification
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="mt-12 pt-6 border-t border-border text-center">
              <p className="text-[10px] text-text-muted leading-relaxed max-w-xl mx-auto italic">
                This transcript is an official record of home-based education. All courses were completed 
                through home instruction under the supervision of the parent/instructor named above. 
                This record complies with state requirements for homeschool documentation.
              </p>
              <p className="text-[10px] text-text-muted mt-3">
                Generated by Village Homeschool App • villageapp.co
              </p>
            </div>
          </div>
        )}

        {!selectedKid && kids.length === 0 && (
          <div className="text-center py-24 bg-bg-alt rounded-[3rem] border-2 border-dashed border-border">
            <p className="text-text-muted text-xl font-serif italic mb-8">No students found.</p>
            <Button size="lg" onClick={() => router.push('/manage-kids')}>
              Add Your First Child
            </Button>
          </div>
        )}
      </main>

      {/* School Info Modal */}
      <Modal 
        isOpen={isSchoolModalOpen} 
        onClose={() => setIsSchoolModalOpen(false)} 
        title="School Information"
        subtitle="Add your homeschool name and details for the transcript header."
      >
        <div className="space-y-4">
          <Input 
            label="School / Homeschool Name" 
            value={schoolInfo.schoolName} 
            onChange={(e) => setSchoolInfo(prev => ({ ...prev, schoolName: e.target.value }))}
            placeholder="e.g. Smith Family Academy"
          />
          <Input 
            label="Address" 
            value={schoolInfo.schoolAddress} 
            onChange={(e) => setSchoolInfo(prev => ({ ...prev, schoolAddress: e.target.value }))}
            placeholder="City, State ZIP"
          />
          <div className="grid grid-cols-2 gap-4">
            <Input 
              label="Phone" 
              value={schoolInfo.schoolPhone} 
              onChange={(e) => setSchoolInfo(prev => ({ ...prev, schoolPhone: e.target.value }))}
              placeholder="(555) 123-4567"
            />
            <Input 
              label="Email" 
              value={schoolInfo.schoolEmail} 
              onChange={(e) => setSchoolInfo(prev => ({ ...prev, schoolEmail: e.target.value }))}
              placeholder="email@example.com"
            />
          </div>
          <Input 
            label="Instructor / Parent Name" 
            value={schoolInfo.instructorName} 
            onChange={(e) => setSchoolInfo(prev => ({ ...prev, instructorName: e.target.value }))}
            placeholder="John Smith"
          />
          
          <div className="flex justify-end gap-4 mt-6">
            <Button type="button" variant="outline" onClick={() => setIsSchoolModalOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={saveSchoolInfo}>
              Save School Info
            </Button>
          </div>
        </div>
      </Modal>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Print styles */}
      <style jsx global>{`
        @media print {
          body {
            background: white !important;
          }
          @page {
            size: letter;
            margin: 0.5in;
          }
          .print\\:hidden {
            display: none !important;
          }
        }
      `}</style>
    </>
  );
}