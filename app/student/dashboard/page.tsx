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
import { BookOpen, AlertCircle, CheckCircle, Clock, FileText, Target } from 'lucide-react';
import { useFetch } from '@/hooks';

let syncFired = false;
export default function StudentDashboard() {
  const router = useRouter();
  const { user } = useAuth();

  // Just-In-Time: sync missing evaluations for late registrants on dashboard load
  useEffect(() => {
    if (syncFired) return;
    syncFired = true;
    
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
  const evaluations = (evalData?.evaluations || []).filter((e: any) => e.evaluation_type === 'teacher');

  const pendingEvals = evaluations.filter((e: any) => {
    if (e.status === 'submitted' || e.status === 'locked') return false;
    const periodStatus = e.period?.status || e.period_status;
    return periodStatus === 'active';
  });

  const activePeriod = (evaluations.length > 0) 
    ? (pendingEvals[0]?.period || evaluations[0]?.period) 
    : null;

  let deadline = null;
  if (activePeriod?.end_date) {
    const dateStr = String(activePeriod.end_date);
    if (dateStr.includes('-')) {
      const parts = dateStr.split('T')[0].split('-');
      const y = parseInt(parts[0]);
      const m = parseInt(parts[1]);
      const d = parseInt(parts[2]);
      if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
        deadline = new Date(y, m - 1, d, 23, 59, 59, 999);
      }
    }
  }
  const deadlineStr = activePeriod?.end_date ? new Date(activePeriod.end_date).toLocaleDateString() : '';
  const daysUntilDeadline = deadline ? Math.max(0, Math.ceil((deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24))) : 0;

  const completedEvals = evaluations.filter((e: any) => e.status === 'submitted' || e.status === 'locked');
  const pendingCount = pendingEvals.length;
  const completedCount = completedEvals.length;
  const totalCount = evaluations.length;

  const enrolledCount = coursesData?.courses?.length || 0;

  if (isLoading) return <DashboardSkeleton />;

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Welcome back, {user?.name}!</h1>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <p className="text-gray-600 dark:text-gray-400">
              {activePeriod ? `Evaluation Period: ${activePeriod.name}` : 'No active evaluation period'}
            </p>
            {activePeriod?.academic_year && (
              <Badge variant="secondary" className="px-2 py-0.5 text-xs font-bold bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                S.Y. {activePeriod.academic_year}
              </Badge>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>📋 Pending Evaluations</CardTitle>
              <CardDescription>Complete these evaluations before the deadline</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {pendingCount === 0 ? (
                <div className="text-center py-12">
                  <CheckCircle className="w-12 h-12 mx-auto text-green-600 mb-4" />
                  <p className="text-lg font-semibold text-gray-900 dark:text-white">All Complete! 🎉</p>
                  <p className="text-gray-600 dark:text-gray-400 mt-2">You've completed all evaluations for this period.</p>
                </div>
              ) : (
                pendingEvals.map((evaluation:any) => (
                  <div key={evaluation.id} className="flex items-center justify-between p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                    <div>
                      <h4 className="font-semibold text-gray-900 dark:text-white">{evaluation.course_name || evaluation.course?.name}</h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{evaluation.course_code} • {evaluation.evaluatee_name}</p>
                    </div>
                    <Button variant="primary" size="sm" onClick={() => router.push('/student/evaluations')}>Evaluate Now</Button>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-lg">📚 Enrolled Subjects</CardTitle>
              <CardDescription>Courses registered for this academic period</CardDescription>
            </CardHeader>
            <CardContent className="pt-4 space-y-3">
              {enrolledCount === 0 ? (
                <div className="text-center py-10 bg-gray-50 dark:bg-gray-800/50 rounded-xl border-2 border-dashed border-gray-100 dark:border-gray-800">
                   <p className="text-sm text-gray-500 italic">No enrolled subjects were found for your profile.</p>
                </div>
              ) : (
                coursesData.courses.map((course: any) => (
                  <div key={course.id} className="group flex items-center gap-4 p-4 bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 hover:border-blue-200 dark:hover:border-blue-900/50 hover:shadow-md transition-all duration-200">
                    <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                      <BookOpen className="w-6 h-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="px-1.5 py-0 text-[10px] uppercase font-bold tracking-tighter bg-gray-50 dark:bg-gray-800">{course.code}</Badge>
                        <span className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">Subject Code</span>
                      </div>
                      <h4 className="font-bold text-gray-900 dark:text-white truncate" title={course.name}>{course.name}</h4>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-1.5">
                         <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                         Instructor: <span className="font-semibold text-gray-700 dark:text-gray-300">{course.instructor_name || 'Prof. Pending'}</span>
                      </p>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4 flex flex-col">
          <Card className="mb-2">
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-lg">✨ Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-3">
              <Button variant="primary" className="w-full gap-2" onClick={() => router.push('/student/evaluations')} disabled={pendingCount === 0}>
                <Target className="w-4 h-4" /> Start Evaluation
              </Button>
              <Button variant="outline" className="w-full gap-2" onClick={() => router.push('/student/history')}>
                <FileText className="w-4 h-4" /> View History
              </Button>
            </CardContent>
          </Card>

          <DashboardCard
            title="Pending task"
            value={<AnimatedCounter endValue={pendingCount} />}
            footer={`${pendingCount} tasks remaining`}
            icon={<AlertCircle className="w-6 h-6" />}
            color="rose"
          />
          <DashboardCard
            title="Completed"
            value={<AnimatedCounter endValue={completedCount} />}
            footer={`${completedCount} of ${totalCount} evaluations`}
            icon={<CheckCircle className="w-6 h-6" />}
            color="emerald"
          />

          {activePeriod && (
            <Card className="relative overflow-hidden border-l-4 border-l-amber-500 shadow-sm">
              <CardContent className="pt-6">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-1">Days Left</p>
                    <div className="text-4xl font-black text-slate-900 dark:text-white mb-2 leading-none">
                      {daysUntilDeadline < 1 && daysUntilDeadline > 0 ? "Due Today" : daysUntilDeadline}
                    </div>
                    <p className="text-[11px] font-semibold text-gray-400">Deadline: {deadlineStr}</p>
                  </div>
                  <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-2xl">
                    <Clock className="w-6 h-6 text-amber-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
          <DashboardCard
            title="Enrolled"
            value={<AnimatedCounter endValue={enrolledCount} />}
            footer="Current semester"
            icon={<BookOpen className="w-6 h-6" />}
            color="indigo"
          />
        </div>
      </div>
    </div>
  );
}
