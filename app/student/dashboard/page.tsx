'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { DashboardCard } from '@/components/DashboardCard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { AnimatedCounter } from '@/components/animations/AnimatedCounter';
import { DashboardSkeleton } from '@/components/loading/Skeletons';
import { BookOpen, AlertCircle, CheckCircle, Clock, Download, FileText, Share2, BarChart3, Target } from 'lucide-react';
import Link from 'next/link';
import { useFetch } from '@/hooks';
export default function StudentDashboard() {
  const router = useRouter();
  const { user } = useAuth();

  // Just-In-Time: sync missing evaluations for late registrants on dashboard load
  useEffect(() => {
    const token = typeof window !== 'undefined' ? sessionStorage.getItem('auth_token') : null;
    if (!token) return;
    const base = process.env.NEXT_PUBLIC_API_URL || '/api';
    fetch(`${base}/evaluations/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    }).catch((err) => { console.error('Error:', err); });
  }, []);

  const { data: evalData, loading: evalLoading } = useFetch<any>('/evaluations?type=teacher');
  const { data: coursesData, loading: coursesLoading } = useFetch<any>('/courses');
  const { data: periodData, loading: periodLoading } = useFetch<any>('/evaluation_periods?status=active');

  const isLoading = evalLoading || coursesLoading || periodLoading;

  // Derived data
  const activePeriod = periodData?.periods?.find((p: any) => p.form_type === 'student-to-teacher') || null;
  const deadline = activePeriod?.end_date ? new Date(activePeriod.end_date) : null;
  const daysUntilDeadline = deadline ? Math.max(0, Math.ceil((deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24))) : 0;

  // Filter to only student-to-teacher evaluations (exclude peer-review)
  const evaluations = (evalData?.evaluations || []).filter((e: any) => e.evaluation_type === 'teacher');

  // Check period status for pending evaluations
  const pendingEvals = evaluations.filter((e: any) => {
    if (e.status === 'submitted' || e.status === 'locked') return false;
    // Only count as pending if the period is still active
    const periodStatus = e.period?.status || e.period_status;
    return periodStatus === 'active';
  });
  const closedPendingEvals = evaluations.filter((e: any) => {
    if (e.status === 'submitted' || e.status === 'locked') return false;
    const periodStatus = e.period?.status || e.period_status;
    return periodStatus === 'closed';
  });
  const completedEvals = evaluations.filter((e: any) => e.status === 'submitted' || e.status === 'locked');

  const pendingCount = pendingEvals.length;
  const completedCount = completedEvals.length;
  const totalCount = evaluations.length;
  const completionRate = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  // Use enrolled courses count for display, but completion rate based on evaluations
  const enrolledCount = coursesData?.courses?.length || 0;

  const handleStartEvaluation = () => {
    router.push('/student/evaluations');
  };

  const handleViewResults = () => {
    router.push('/student/history');
  };

  if (isLoading) return <DashboardSkeleton />;

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Welcome back, {user?.name}!
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            {activePeriod
              ? `Evaluation Period: ${activePeriod.name}${activePeriod.academic_year ? ` — ${activePeriod.academic_year}` : ''}${activePeriod.semester ? ` ${activePeriod.semester}` : ''}`
              : 'No active evaluation period'}
          </p>
        </div>
      </div>



      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Pending Evaluations */}
        <div className="lg:col-span-2 space-y-6">
          {/* Pending Evaluations */}
          <Card>
            <CardHeader>
              <CardTitle>📋 Pending Evaluations</CardTitle>
              <CardDescription>Complete these evaluations before the deadline</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {enrolledCount === 0 ? (
                <div className="text-center py-12">
                  <AlertCircle className="w-12 h-12 mx-auto text-yellow-600 mb-4" />
                  <p className="text-lg font-semibold text-gray-900 dark:text-white">No Courses Assigned</p>
                  <p className="text-gray-600 dark:text-gray-400 mt-2">You don’t have any enrolled courses yet.</p>
                </div>
              ) : !evalData?.evaluations?.length ? (
                <div className="text-center py-12">
                  <AlertCircle className="w-12 h-12 mx-auto text-blue-600 mb-4" />
                  <p className="text-lg font-semibold text-gray-900 dark:text-white">No Evaluations Available</p>
                  <p className="text-gray-600 dark:text-gray-400 mt-2">There are no active evaluations assigned to you at the moment.</p>
                </div>
              ) : pendingCount === 0 && closedPendingEvals.length === 0 ? (
                <div className="text-center py-12">
                  <CheckCircle className="w-12 h-12 mx-auto text-green-600 mb-4" />
                  <p className="text-lg font-semibold text-gray-900 dark:text-white">All Complete! 🎉</p>
                  <p className="text-gray-600 dark:text-gray-400 mt-2">You've completed all evaluations for this period.</p>
                </div>
              ) : (
                <>
                  {pendingEvals.map((evaluation:any) => (
                    <div
                      key={evaluation.id}
                      className="flex items-center justify-between p-4 bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-900/20 dark:to-orange-900/20 rounded-lg border border-red-200 dark:border-red-800"
                    >
                      <div>
                        <h4 className="font-semibold text-gray-900 dark:text-white">
                          {evaluation.course_name || evaluation.course?.name}
                        </h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {evaluation.course_code || evaluation.course?.code} • {evaluation.evaluatee_name || evaluation.evaluatee?.name}
                        </p>
                      </div>
                      <Button variant="primary" size="sm" onClick={() => router.push('/student/evaluations')}>
                        Evaluate Now
                      </Button>
                    </div>
                  ))}
                  {closedPendingEvals.length > 0 && (
                    <div className="pt-2 space-y-3">
                      <p className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wider">Closed (not submitted)</p>
                      {closedPendingEvals.map((evaluation:any) => (
                        <div
                          key={evaluation.id}
                          className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 opacity-60"
                        >
                          <div>
                            <h4 className="font-semibold text-gray-900 dark:text-white">
                              {evaluation.course_name || evaluation.course?.name}
                            </h4>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              {evaluation.course_code || evaluation.course?.code} • {evaluation.evaluatee_name || evaluation.evaluatee?.name}
                            </p>
                          </div>
                          <Badge variant="destructive">Closed</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* Current Courses */}
          <Card>
            <CardHeader>
              <CardTitle>📚 Your Courses</CardTitle>
              <CardDescription>All enrolled courses this semester</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {(coursesData?.courses || []).map((course:any) => {
                const evaluation = evaluations.find((e:any)=>e.course_id === course.id);
                const isCompleted = evaluation?.status === 'submitted' || evaluation?.status === 'locked';
                const periodStatus = evaluation?.period?.status || evaluation?.period_status;
                const isClosed = periodStatus === 'closed';
                return (
                  <div
                    key={course.id}
                    className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    <div className="flex-1">
                      <p className="font-medium text-gray-900 dark:text-white">{course.name || course.course_name}</p>
                      <p className="text-xs text-gray-600 dark:text-gray-400">{course.instructor_name || course.teacher_name}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{course.code || course.course_code}</Badge>
                      {isCompleted ? (
                        <Badge variant="success">✓ Done</Badge>
                      ) : evaluation && isClosed ? (
                        <Badge variant="destructive">Closed</Badge>
                      ) : evaluation ? (
                        <Badge variant="warning">⏳ Pending</Badge>
                      ) : (
                         <Badge variant="outline">-</Badge>
                      )}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>

        {/* Analytics & Sidebar */}
        <div className="space-y-4 flex flex-col">
          {/* Quick Actions */}
          <Card className="mb-2 hover:shadow-lg transition-shadow duration-150">
            <CardHeader className="pb-3 border-b border-gray-100 dark:border-gray-800">
              <CardTitle className="text-lg">✨ Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-3">
              {pendingCount > 0 && (
                <Button 
                  variant="primary" 
                  className="w-full gap-2 shadow-sm"
                  onClick={handleStartEvaluation}
                >
                  <Target className="w-4 h-4" />
                  Start Evaluation
                </Button>
              )}
              <Button 
                variant="outline" 
                className="w-full gap-2 shadow-sm border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
                onClick={handleViewResults}
              >
                <FileText className="w-4 h-4" />
                View History
              </Button>
            </CardContent>
          </Card>

          <DashboardCard
            title="Pending Evaluations"
            value={<AnimatedCounter endValue={pendingCount} />}
            footer={`${pendingCount} evaluations remaining`}
            icon={<AlertCircle className="w-6 h-6" />}
            color="red"
          />
          <DashboardCard
            title="Completed Evaluations"
            value={<AnimatedCounter endValue={completedCount} />}
            footer={`${completedCount} of ${totalCount} evaluations`}
            icon={<CheckCircle className="w-6 h-6" />}
            color="green"
          />
          <DashboardCard
            title="Days Left"
            value={<AnimatedCounter endValue={daysUntilDeadline} />}
            footer={deadline ? `Deadline: ${deadline.toLocaleDateString()}` : 'No deadline'}
            icon={<Clock className="w-6 h-6" />}
            color="yellow"
          />
          <DashboardCard
            title="Enrolled Courses"
            value={<AnimatedCounter endValue={enrolledCount} />}
            footer="Current semester"
            icon={<BookOpen className="w-6 h-6" />}
            color="blue"
          />

          {/* Privacy Notice */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                  <CheckCircle className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white text-sm">🔒 Your Privacy</p>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                    All evaluations are anonymous and confidential
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
