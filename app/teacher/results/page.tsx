'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { DataTable } from '@/components/DataTable';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { DashboardCard } from '@/components/DashboardCard';
import { DashboardSkeleton } from '@/components/loading/Skeletons';
import { AnimatedCounter } from '@/components/animations/AnimatedCounter';
import { TrendingUp } from 'lucide-react';
import { useFetch } from '@/hooks';
import { useAuth } from '@/context/AuthContext';

// sentiment distribution calculated from ratings
// (positive: >=4, neutral: 3-<4, negative: <3)

export default function TeacherResults() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCourse, setSelectedCourse] = useState<number | null>(null);
  const { data: analyticsData, loading: analyticsLoading } = useFetch<any>('/analytics');
  const { data: evalData, loading: evalLoading } = useFetch<any>('/evaluations?role=evaluatee&history=true');
  const { data: coursesData, loading: coursesLoading } = useFetch<any>('/courses?history=true');

  const [semester, setSemester] = useState('current');

  const isBusy = analyticsLoading || evalLoading || coursesLoading;

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 800);
    return () => clearTimeout(timer);
  }, []);

  if (isBusy) {
    return <DashboardSkeleton />;
  }

  const trend = analyticsData?.analytics?.performanceTrend || [];

  if (isLoading) return <DashboardSkeleton />;

  // Helper to compute average rating from an evaluation's responses array
  const evalAvg = (e: any): number => {
    const ratings = (e.responses || []).map((r: any) => Number(r.rating ?? 0)).filter((v: number) => v > 0);
    if (ratings.length) return ratings.reduce((a: number, b: number) => a + b, 0) / ratings.length;
    return Number(e.overall_score ?? 0);
  };

  // derive live teacher metrics
  // The API already filters by evaluatee_id since we pass ?role=evaluatee
  const allReceivedEvals = evalData?.evaluations || [];

  const availableSemesters = Array.from(
    new Set(
      allReceivedEvals
        .map((e: any) => e.period?.academic_year && e.period?.semester ? `${e.period.academic_year} | ${e.period.semester}` : null)
        .filter(Boolean)
    )
  ) as string[];

  const semesters = [
    { value: 'current', label: 'Current Semester' },
    { value: 'all', label: 'All Semesters' },
    ...availableSemesters.sort().reverse().map((s: string) => ({ value: s, label: s })),
  ];

  const filteredEvals = allReceivedEvals.filter((e: any) => {
    if (semester === 'current') return e.is_archived === 0;
    const periodLabel = e.period?.academic_year && e.period?.semester ? `${e.period.academic_year} | ${e.period.semester}` : null;
    if (semester !== 'all' && periodLabel !== semester) return false;
    return true;
  });

  const teacherEvals = filteredEvals.filter((e: any) => evalAvg(e) > 0);

  const overallRating = teacherEvals.length
    ? teacherEvals.reduce((s: number, e: any) => s + evalAvg(e), 0) / teacherEvals.length
    : 0;

  const criteriaBreakdown = (() => {
    const scores: Record<string, { total: number, count: number }> = {};
    teacherEvals.forEach((e: any) => {
      (e.responses || []).forEach((r: any) => {
        const name = r.criteria_name || 'Uncategorized';
        const rating = Number(r.rating || 0);
        if (rating > 0) {
          if (!scores[name]) scores[name] = { total: 0, count: 0 };
          scores[name].total += rating;
          scores[name].count += 1;
        }
      });
    });
    return Object.entries(scores)
      .map(([criteriaName, data]) => ({
        criteriaName,
        score: data.total / data.count,
      }))
      .sort((a, b) => b.score - a.score);
  })();

  let assignedCourses = (coursesData?.courses || []).filter((c: any) => c.teacher_id === user?.id);
  if (semester !== 'all') {
    const validCourseIds = new Set(teacherEvals.map((e: any) => e.course_id));
    assignedCourses = assignedCourses.filter((c: any) => validCourseIds.has(c.id));
  }

  // Build results per course the teacher teaches
  const courseResults = (assignedCourses || []).map((c: any) => {
    const evals = teacherEvals.filter((e: any) => e.course_id === c.id);
    const responses = evals.length;
    const avgScore = responses
      ? Math.round((evals.reduce((acc: number, e: any) => acc + evalAvg(e), 0) / responses) * 100) / 100
      : 0;
    const status = responses ? 'Completed' : 'Pending';
    return {
      id: c.id,
      code: c.code,
      name: c.name,
      section: c.section || '',
      responses,
      avgScore,
      status,
    };
  });

  const commentsList = teacherEvals
    .filter((e: any) => e.comments && e.comments.trim().length > 0)
    .sort((a: any, b: any) => new Date(b.submitted_at || b.created_at).getTime() - new Date(a.submitted_at || a.created_at).getTime())
    .map((e: any) => ({
      id: e.id,
      text: e.comments,
      date: new Date(e.submitted_at || e.created_at).toLocaleDateString(),
      type: (e.evaluation_type || '').includes('student') ? 'Student' : (e.evaluation_type || '').includes('peer') ? 'Peer' : 'Admin',
      score: Number(evalAvg(e)).toFixed(1)
    }));

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">📊 Evaluation Results</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Your comprehensive evaluation results and detailed analytics
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="text-sm font-semibold text-gray-900 dark:text-white block mb-2">Academic Year & Semester</div>
          <select
            value={semester}
            onChange={(e) => setSemester(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          >
            {semesters.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content Column */}
        <div className="lg:col-span-2 space-y-8">
          {/* Detailed Results by Course */}
          <Card>
            <CardHeader>
              <CardTitle>📚 Results by Course</CardTitle>
              <CardDescription>Detailed breakdown of evaluation results for each course</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {courseResults.map((course) => (
                  <div
                    key={course.id}
                    className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition cursor-pointer"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setSelectedCourse(selectedCourse === course.id ? null : course.id);
                    }}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        e.stopPropagation();
                        setSelectedCourse(selectedCourse === course.id ? null : course.id);
                      }
                    }}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-900 dark:text-white">{course.code} - {course.name}</h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          Section {course.section} • {course.responses} responses
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-green-600">{course.avgScore}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">/5.0</p>
                      </div>
                      <Badge variant="success" className="ml-4">{course.status}</Badge>
                    </div>
                    {selectedCourse === course.id && (
                      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 space-y-2">
                        <p><strong>Course Code:</strong> {course.code}</p>
                        <p><strong>Student Responses:</strong> {course.responses}</p>
                        <p><strong>Average Score:</strong> {course.avgScore}/5.0</p>
                        <p><strong>Completion Status:</strong> {course.status}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Anonymous Written Feedback */}
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>💬 Written Feedback</CardTitle>
                  <CardDescription>Anonymous comments submitted during evaluations</CardDescription>
                </div>
                <Badge variant="secondary">{commentsList.length} comments</Badge>
              </div>
            </CardHeader>
            <CardContent>
              {commentsList.length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400 text-center py-6">
                  No written comments available for this selected period.
                </p>
              ) : (
                <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
                  {commentsList.map((c: any) => (
                    <div key={c.id} className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">Anonymous</Badge>
                          <span className="text-sm font-semibold text-yellow-500">
                            ★ {c.score}
                          </span>
                        </div>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {c.date}
                        </span>
                      </div>
                      <p className="text-gray-700 dark:text-gray-300 text-sm whitespace-pre-wrap">{c.text}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar Column */}
        <div className="space-y-8 flex flex-col">
          {/* Key Metrics */}
          <DashboardCard
            title="Overall Rating"
            value={
              <span>
                <AnimatedCounter endValue={Number.isFinite(overallRating) ? overallRating : 0} decimals={1} suffix="/5" />
              </span>
            }
            footer={`Based on ${teacherEvals.length || '0'} responses`}
            icon={<TrendingUp className="w-6 h-6" />}
            color="green"
            trend={4}
          />

          {/* Key Insights */}
          <Card className="border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20">
            <CardHeader>
              <CardTitle className="text-base">💡 Key Insights</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="text-gray-700 dark:text-gray-300">
                ✓ Highest criterion: {criteriaBreakdown.length ? `${[...criteriaBreakdown].sort((a: any,b: any)=>b.score-a.score)[0]?.criteriaName} (${[...criteriaBreakdown].sort((a: any,b: any)=>b.score-a.score)[0]?.score?.toFixed(1)}/5)` : 'N/A'}
              </p>
              <p className="text-gray-700 dark:text-gray-300">
                ✓ {courseResults.length ? `${[...courseResults].sort((a,b)=>b.avgScore-a.avgScore)[0]?.code} has the highest avg score (${[...courseResults].sort((a,b)=>b.avgScore-a.avgScore)[0]?.avgScore}/5)` : 'No course data available'}
              </p>
            </CardContent>
          </Card>

          {/* Data Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle>Criteria Performance</CardTitle>
              <CardDescription>Your average score by evaluation criteria</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {criteriaBreakdown.length ? (
                criteriaBreakdown.map((item: any, index: number) => (
                  <div key={`${item.criteriaName}-${index}`} className="flex justify-between text-sm">
                    <span className="text-gray-900 dark:text-white">{item.criteriaName}</span>
                    <span className="font-semibold text-blue-600">{item.score?.toFixed(1) ?? 'N/A'}/5</span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400">No criteria data available.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
