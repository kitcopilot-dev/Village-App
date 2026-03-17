'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getPocketBase } from '@/lib/pocketbase';
import { Child, Course, Assignment, Attendance, PortfolioItem, SchoolYear, Profile } from '@/lib/types';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { LoadingScreen } from '@/components/ui/Spinner';

interface ChildSummary {
  child: Child;
  attendance: Attendance[];
  courses: Course[];
  assignments: Assignment[];
  portfolioItems: PortfolioItem[];
  completedCourses: number;
  inProgressCourses: number;
  totalAssignments: number;
  gradedAssignments: number;
  averageScore: number;
  subjectBreakdown: Record<string, { count: number; avgScore: number }>;
}

export default function YearEndSummaryPage() {
  const router = useRouter();
  const pb = getPocketBase();
  
  const [profile, setProfile] = useState<Profile | null>(null);
  const [kids, setKids] = useState<Child[]>([]);
  const [schoolYears, setSchoolYears] = useState<SchoolYear[]>([]);
  const [selectedYearId, setSelectedYearId] = useState('');
  const [childSummaries, setChildSummaries] = useState<ChildSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [generatingReport, setGeneratingReport] = useState(false);

  // Get current school year based on date (Aug-Jul)
  const getCurrentSchoolYearRange = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth(); // 0-11
    
    if (month >= 7) { // August onwards
      return { 
        start: `${year}-08-01`, 
        end: `${year + 1}-07-31`,
        label: `${year}-${year + 1}`
      };
    } else {
      return { 
        start: `${year - 1}-08-01`, 
        end: `${year}-07-31`,
        label: `${year - 1}-${year}`
      };
    }
  };

  useEffect(() => {
    if (!pb.authStore.isValid) {
      router.push('/');
      return;
    }
    loadInitialData();
  }, []);

  useEffect(() => {
    if (selectedYearId && kids.length > 0) {
      generateSummaries();
    }
  }, [selectedYearId, kids]);

  const loadInitialData = async () => {
    try {
      const userId = pb.authStore.model?.id;
      if (!userId) return;

      const [profileRecords, kidRecords, yearRecords] = await Promise.all([
        pb.collection('profiles').getFullList({
          filter: `user = "${userId}"`,
          limit: 1
        }),
        pb.collection('children').getFullList({
          filter: `user = "${userId}"`,
          sort: 'name'
        }),
        pb.collection('school_years').getFullList({
          filter: `user = "${userId}"`,
          sort: '-start_date'
        })
      ]);

      if (profileRecords.length > 0) {
        setProfile(profileRecords[0] as unknown as Profile);
      }
      setKids(kidRecords as unknown as Child[]);
      setSchoolYears(yearRecords as unknown as SchoolYear[]);
      
      // Default to most recent school year or create a virtual "current" year
      if (yearRecords.length > 0) {
        setSelectedYearId(yearRecords[0].id);
      } else {
        setSelectedYearId('current');
      }
    } catch (error) {
      console.error('Load error:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateSummaries = async () => {
    setGeneratingReport(true);
    try {
      const userId = pb.authStore.model?.id;
      if (!userId) return;

      // Determine date range
      let startDate: string, endDate: string;
      if (selectedYearId === 'current') {
        const range = getCurrentSchoolYearRange();
        startDate = range.start;
        endDate = range.end;
      } else {
        const year = schoolYears.find(y => y.id === selectedYearId);
        if (!year) return;
        startDate = year.start_date;
        endDate = year.end_date;
      }

      const summaries: ChildSummary[] = [];

      for (const child of kids) {
        // Fetch all data for this child within the date range
        const [attendanceRecords, courseRecords, assignmentRecords, portfolioRecords] = await Promise.all([
          pb.collection('attendance').getFullList({
            filter: `child = "${child.id}" && date >= "${startDate}" && date <= "${endDate}"`
          }),
          pb.collection('courses').getFullList({
            filter: `child = "${child.id}"`
          }),
          pb.collection('assignments').getFullList({
            filter: `child = "${child.id}" && created >= "${startDate}" && created <= "${endDate}"`
          }),
          pb.collection('portfolio_items').getFullList({
            filter: `child = "${child.id}" && created >= "${startDate}" && created <= "${endDate}"`
          })
        ]);

        const attendance = attendanceRecords as unknown as Attendance[];
        const courses = courseRecords as unknown as Course[];
        const assignments = assignmentRecords as unknown as Assignment[];
        const portfolioItems = portfolioRecords as unknown as PortfolioItem[];

        // Calculate course statistics
        const completedCourses = courses.filter(c => c.current_lesson > c.total_lessons).length;
        const inProgressCourses = courses.filter(c => c.current_lesson > 1 && c.current_lesson <= c.total_lessons).length;

        // Calculate assignment statistics
        const gradedAssignments = assignments.filter(a => a.score !== undefined && a.score !== null);
        const averageScore = gradedAssignments.length > 0
          ? gradedAssignments.reduce((sum, a) => sum + (a.score || 0), 0) / gradedAssignments.length
          : 0;

        // Subject breakdown
        const subjectBreakdown: Record<string, { count: number; avgScore: number; total: number }> = {};
        gradedAssignments.forEach(a => {
          const subject = a.subject || 'General';
          if (!subjectBreakdown[subject]) {
            subjectBreakdown[subject] = { count: 0, avgScore: 0, total: 0 };
          }
          subjectBreakdown[subject].count++;
          subjectBreakdown[subject].total += a.score || 0;
        });
        
        Object.keys(subjectBreakdown).forEach(subject => {
          subjectBreakdown[subject].avgScore = subjectBreakdown[subject].total / subjectBreakdown[subject].count;
        });

        summaries.push({
          child,
          attendance,
          courses,
          assignments,
          portfolioItems,
          completedCourses,
          inProgressCourses,
          totalAssignments: assignments.length,
          gradedAssignments: gradedAssignments.length,
          averageScore,
          subjectBreakdown
        });
      }

      setChildSummaries(summaries);
    } catch (error) {
      console.error('Summary generation error:', error);
    } finally {
      setGeneratingReport(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const scoreToLetterGrade = (score: number): string => {
    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
  };

  const getSelectedYearLabel = () => {
    if (selectedYearId === 'current') {
      return getCurrentSchoolYearRange().label;
    }
    const year = schoolYears.find(y => y.id === selectedYearId);
    return year?.name || 'Unknown';
  };

  const getDateRange = () => {
    if (selectedYearId === 'current') {
      const range = getCurrentSchoolYearRange();
      return { start: range.start, end: range.end };
    }
    const year = schoolYears.find(y => y.id === selectedYearId);
    return { start: year?.start_date || '', end: year?.end_date || '' };
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  };

  // Total statistics across all children
  const totalStats = {
    attendance: childSummaries.reduce((sum, s) => sum + s.attendance.length, 0),
    courses: childSummaries.reduce((sum, s) => sum + s.courses.length, 0),
    completed: childSummaries.reduce((sum, s) => sum + s.completedCourses, 0),
    assignments: childSummaries.reduce((sum, s) => sum + s.totalAssignments, 0),
    portfolio: childSummaries.reduce((sum, s) => sum + s.portfolioItems.length, 0)
  };

  if (loading) {
    return <LoadingScreen message="Loading year-end summary..." />;
  }

  return (
    <>
      <Header showLogout onLogout={() => { pb.authStore.clear(); router.push('/'); }} />
      <main className="max-w-5xl mx-auto my-8 sm:my-12 px-4 sm:px-8 pb-20 animate-fade-in">
        {/* Controls - Hidden on print */}
        <div className="print:hidden mb-12">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-6 mb-8">
            <div>
              <h2 className="font-display text-4xl sm:text-6xl font-extrabold tracking-tight mb-2">Year-End Summary</h2>
              <p className="text-text-muted text-sm sm:text-base">Generate an official compliance report for the school year.</p>
            </div>
            <Button variant="ghost" onClick={() => router.push('/dashboard')}>← Dashboard</Button>
          </div>

          <Card className="p-6 md:p-8">
            <div className="flex flex-col md:flex-row gap-6 items-end">
              <div className="flex-1 w-full">
                <Select 
                  label="School Year" 
                  value={selectedYearId} 
                  onChange={(e) => setSelectedYearId(e.target.value)}
                >
                  <option value="current">Current Year ({getCurrentSchoolYearRange().label})</option>
                  {schoolYears.map(y => (
                    <option key={y.id} value={y.id}>{y.name}</option>
                  ))}
                </Select>
              </div>
              <Button 
                onClick={handlePrint} 
                disabled={childSummaries.length === 0 || generatingReport}
                className="w-full md:w-auto"
              >
                {generatingReport ? '⏳ Generating...' : '🖨️ Print / Save as PDF'}
              </Button>
            </div>
          </Card>
        </div>

        {/* Report Document - Optimized for printing */}
        {childSummaries.length > 0 && (
          <div className="bg-white border-2 border-border rounded-[2rem] p-8 md:p-16 shadow-shadow print:border-0 print:p-0 print:shadow-none mx-auto max-w-[8.5in]">
            {/* Document Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 mb-16 pb-12 border-b-4 border-primary/10">
              <div>
                <h1 className="font-display text-primary text-3xl sm:text-4xl font-extrabold uppercase tracking-tighter m-0 mb-1">
                  Village<span className="text-secondary">.</span> Homeschool
                </h1>
                <p className="font-serif italic text-lg text-text-muted m-0">Annual Education Summary Report</p>
              </div>
              <div className="text-left md:text-right">
                <p className="text-xs font-bold uppercase tracking-widest text-primary mb-1">School Year</p>
                <p className="font-bold text-lg m-0">{getSelectedYearLabel()}</p>
                <p className="text-xs text-text-muted mt-2">
                  {formatDate(getDateRange().start)} – {formatDate(getDateRange().end)}
                </p>
              </div>
            </div>

            {/* Family Information */}
            <section className="mb-16">
              <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary mb-6 border-b pb-2">Family Information</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 bg-bg-alt rounded-2xl">
                  <p className="text-[10px] font-bold uppercase text-text-muted mb-1">Family Name</p>
                  <p className="font-bold text-lg m-0">{profile?.family_name || 'Not Set'}</p>
                </div>
                <div className="p-4 bg-bg-alt rounded-2xl">
                  <p className="text-[10px] font-bold uppercase text-text-muted mb-1">Students</p>
                  <p className="font-bold text-lg m-0">{kids.length}</p>
                </div>
                <div className="p-4 bg-bg-alt rounded-2xl">
                  <p className="text-[10px] font-bold uppercase text-text-muted mb-1">Location</p>
                  <p className="font-bold text-lg m-0">{profile?.location || 'Not Set'}</p>
                </div>
                <div className="p-4 bg-bg-alt rounded-2xl">
                  <p className="text-[10px] font-bold uppercase text-text-muted mb-1">Report Date</p>
                  <p className="font-bold text-lg m-0">{new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                </div>
              </div>
            </section>

            {/* Year-at-a-Glance Stats */}
            <section className="mb-16">
              <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-secondary mb-6 border-b pb-2">Year-at-a-Glance</h3>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="p-6 bg-primary/5 rounded-2xl text-center border border-primary/20">
                  <p className="font-display text-3xl font-extrabold text-primary m-0">{totalStats.attendance}</p>
                  <p className="text-[10px] font-bold uppercase text-text-muted mt-1">School Days</p>
                </div>
                <div className="p-6 bg-secondary/5 rounded-2xl text-center border border-secondary/20">
                  <p className="font-display text-3xl font-extrabold text-secondary m-0">{totalStats.courses}</p>
                  <p className="text-[10px] font-bold uppercase text-text-muted mt-1">Total Courses</p>
                </div>
                <div className="p-6 bg-green-50 rounded-2xl text-center border border-green-200">
                  <p className="font-display text-3xl font-extrabold text-green-600 m-0">{totalStats.completed}</p>
                  <p className="text-[10px] font-bold uppercase text-text-muted mt-1">Completed</p>
                </div>
                <div className="p-6 bg-accent/5 rounded-2xl text-center border border-accent/20">
                  <p className="font-display text-3xl font-extrabold text-accent m-0">{totalStats.assignments}</p>
                  <p className="text-[10px] font-bold uppercase text-text-muted mt-1">Assignments</p>
                </div>
                <div className="p-6 bg-purple-50 rounded-2xl text-center border border-purple-200">
                  <p className="font-display text-3xl font-extrabold text-purple-600 m-0">{totalStats.portfolio}</p>
                  <p className="text-[10px] font-bold uppercase text-text-muted mt-1">Portfolio Items</p>
                </div>
              </div>
            </section>

            {/* Individual Student Sections */}
            {childSummaries.map((summary, index) => (
              <section key={summary.child.id} className={`mb-16 ${index > 0 ? 'page-break-before' : ''}`}>
                <div className="flex items-center gap-4 mb-8">
                  <div className="w-12 h-12 rounded-full bg-primary text-white flex items-center justify-center font-display font-bold text-xl">
                    {summary.child.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-display text-2xl font-extrabold m-0">{summary.child.name}</h3>
                    <p className="text-sm text-text-muted m-0">
                      {summary.child.grade ? `Grade ${summary.child.grade}` : `Age ${summary.child.age}`}
                      {summary.child.focus && ` • ${summary.child.focus}`}
                    </p>
                  </div>
                </div>

                {/* Student Stats Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                  <div className="p-4 bg-bg-alt rounded-2xl text-center">
                    <p className="font-display text-2xl font-extrabold text-primary m-0">{summary.attendance.length}</p>
                    <p className="text-[10px] font-bold uppercase text-text-muted mt-1">Days Attended</p>
                  </div>
                  <div className="p-4 bg-bg-alt rounded-2xl text-center">
                    <p className="font-display text-2xl font-extrabold text-secondary m-0">{summary.completedCourses}/{summary.courses.length}</p>
                    <p className="text-[10px] font-bold uppercase text-text-muted mt-1">Courses Complete</p>
                  </div>
                  <div className="p-4 bg-bg-alt rounded-2xl text-center">
                    <p className="font-display text-2xl font-extrabold text-accent m-0">
                      {summary.averageScore > 0 ? `${summary.averageScore.toFixed(0)}%` : '—'}
                    </p>
                    <p className="text-[10px] font-bold uppercase text-text-muted mt-1">Average Score</p>
                  </div>
                  <div className="p-4 bg-bg-alt rounded-2xl text-center">
                    <p className="font-display text-2xl font-extrabold text-purple-600 m-0">{summary.portfolioItems.length}</p>
                    <p className="text-[10px] font-bold uppercase text-text-muted mt-1">Work Samples</p>
                  </div>
                </div>

                {/* Course Record Table */}
                {summary.courses.length > 0 && (
                  <div className="mb-8">
                    <h4 className="text-[10px] font-bold uppercase tracking-[0.15em] text-text-muted mb-4">Course Record</h4>
                    <div className="overflow-hidden rounded-2xl border border-border">
                      <table className="w-full border-collapse text-sm">
                        <thead>
                          <tr className="bg-bg-alt">
                            <th className="text-left px-4 py-3 text-xs font-bold uppercase text-text-muted">Course</th>
                            <th className="text-center px-4 py-3 text-xs font-bold uppercase text-text-muted">Progress</th>
                            <th className="text-right px-4 py-3 text-xs font-bold uppercase text-text-muted">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {summary.courses.map(course => {
                            const progress = Math.min(course.current_lesson - 1, course.total_lessons);
                            const percentage = Math.round((progress / course.total_lessons) * 100);
                            const isComplete = course.current_lesson > course.total_lessons;
                            return (
                              <tr key={course.id}>
                                <td className="px-4 py-3 font-semibold">{course.name}</td>
                                <td className="px-4 py-3 text-center text-text-muted">
                                  {progress}/{course.total_lessons} ({percentage}%)
                                </td>
                                <td className="px-4 py-3 text-right">
                                  <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${
                                    isComplete ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                                  }`}>
                                    {isComplete ? 'Complete' : 'In Progress'}
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
                {Object.keys(summary.subjectBreakdown).length > 0 && (
                  <div className="mb-8">
                    <h4 className="text-[10px] font-bold uppercase tracking-[0.15em] text-text-muted mb-4">Subject Performance</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {Object.entries(summary.subjectBreakdown)
                        .sort((a, b) => b[1].avgScore - a[1].avgScore)
                        .map(([subject, data]) => (
                          <div key={subject} className="p-4 bg-bg-alt rounded-xl border border-border">
                            <p className="text-xs font-bold text-text-main mb-1 truncate">{subject}</p>
                            <div className="flex items-baseline gap-2">
                              <span className="font-display text-xl font-extrabold text-primary">
                                {scoreToLetterGrade(data.avgScore)}
                              </span>
                              <span className="text-xs text-text-muted">
                                ({data.avgScore.toFixed(0)}%)
                              </span>
                            </div>
                            <p className="text-[10px] text-text-muted mt-1">{data.count} assignments</p>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* Empty states */}
                {summary.courses.length === 0 && summary.gradedAssignments === 0 && (
                  <div className="p-8 bg-bg-alt rounded-2xl text-center text-text-muted">
                    <p className="italic font-serif">No academic records for this period.</p>
                  </div>
                )}
              </section>
            ))}

            {/* Certification Section */}
            <section className="mt-24 pt-12 border-t-2 border-dashed border-border">
              <h3 className="text-center text-[10px] font-bold uppercase tracking-[0.2em] text-primary mb-12">Parent/Instructor Certification</h3>
              
              <p className="text-sm text-text-muted text-center max-w-2xl mx-auto mb-12 leading-relaxed">
                I certify that the educational activities and academic progress documented in this report accurately represent the home instruction provided during the {getSelectedYearLabel()} school year.
              </p>

              <div className="grid grid-cols-2 gap-16 max-w-2xl mx-auto">
                <div className="text-center">
                  <div className="h-16 border-b border-text-muted mb-4"></div>
                  <p className="text-[10px] font-bold uppercase text-text-muted">Parent / Instructor Signature</p>
                </div>
                <div className="text-center">
                  <div className="h-16 border-b border-text-muted mb-4"></div>
                  <p className="text-[10px] font-bold uppercase text-text-muted">Date</p>
                </div>
              </div>
            </section>

            {/* Legal Footer */}
            <div className="mt-16 text-center text-[10px] text-text-muted leading-relaxed max-w-lg mx-auto italic">
              This Year-End Summary is a comprehensive record of home-based education. Village Homeschool provides the administrative framework; the parent/instructor is solely responsible for accuracy and compliance with local education laws. Retain this document for your records.
            </div>
          </div>
        )}

        {/* Empty State */}
        {childSummaries.length === 0 && !generatingReport && !loading && (
          <div className="text-center py-24 bg-bg-alt rounded-[3rem] border-2 border-dashed border-border">
            <p className="text-text-muted text-xl font-serif italic mb-8">
              {kids.length === 0 
                ? "No students found in your village." 
                : "Select a school year to generate the summary."}
            </p>
            {kids.length === 0 && (
              <Button size="lg" onClick={() => router.push('/manage-kids')}>
                Add Your First Child
              </Button>
            )}
          </div>
        )}
      </main>

      {/* Print styles */}
      <style jsx global>{`
        @media print {
          body {
            background: white;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          @page {
            margin: 0.75in;
            size: letter;
          }
          .page-break-before {
            page-break-before: always;
          }
        }
      `}</style>
    </>
  );
}
