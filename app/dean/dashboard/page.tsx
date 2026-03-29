'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardCard } from '@/components/DashboardCard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { AnimatedCounter } from '@/components/animations/AnimatedCounter';
import { DashboardSkeleton } from '@/components/loading/Skeletons';
import { Users, Download, FilePlus, UserPlus, ClipboardList, Plus } from 'lucide-react';
import { useFetch } from '@/hooks';
import { downloadPdf } from '@/utils/helpers';

export default function DeanDashboard() {

  const router = useRouter();
  const [timerLoading, setTimerLoading] = useState(true);
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>('all');
  const { data: analyticsData, loading: analyticsLoading } = useFetch<any>(`/analytics${selectedPeriodId !== 'all' ? `?periodId=${selectedPeriodId}` : ''}`);
  const { data: evalData, loading: evalLoading } = useFetch<any>('/evaluations');
  const { data: auditData, loading: auditLoading } = useFetch<any>('/audit');
  const { data: periodData, loading: periodLoading } = useFetch<any>('/evaluation_periods?status=active');
  const { data: academicData, loading: academicLoading } = useFetch<any>('/academic_periods');

  const isLoading = timerLoading || analyticsLoading || evalLoading || auditLoading || periodLoading || academicLoading;

  useEffect(() => {
    const timer = setTimeout(() => setTimerLoading(false), 800);
    return () => clearTimeout(timer);
  }, []);

  // Update selected period to active if available
  useEffect(() => {
    if (periodData?.periods?.[0]?.academic_period_id && selectedPeriodId === 'all') {
      setSelectedPeriodId(String(periodData.periods[0].academic_period_id));
    }
  }, [periodData]);

  const downloadDepartmentReport = () => {
    try {
      const data = (analyticsData?.analytics?.performanceTrend || []).map((d: any) => ({
        period: d.period,
        score: d.score,
        completionRate: d.completionRate ?? undefined,
      }));
      const header = ['Period', 'Score', 'Completion Rate'];
      const csv = [header.join(','), ...data.map((d: any) => [d.period, d.score, d.completionRate].join(','))].join('\n');
      downloadPdf(csv, `department-performance-${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (error) {
      console.error('Error downloading CSV:', error);
    }
  };

  const activeEvalPeriod = periodData?.periods?.[0];
  const activeAcademicPeriod = academicData?.periods?.find((p: any) => p.is_active || p.status === 'active');
  const activePeriod = activeEvalPeriod || activeAcademicPeriod;
  
  const deadline = activeEvalPeriod?.end_date || activeAcademicPeriod?.end_date;
  const isEvalActive = !!activeEvalPeriod;
  
  const totalStudents = analyticsData?.analytics?.totalStudents || 0;
  const totalTeachers = analyticsData?.analytics?.totalTeachers || 0;

  if (isLoading) return <DashboardSkeleton />;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
        <div>
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white">Dean Dashboard</h1>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* System Alerts */}
          <Alert 
            variant={isEvalActive ? "success" : "info"} 
            title={isEvalActive ? "Active Evaluation Period" : "Current Academic Session"}
          >
            {activeEvalPeriod ? (
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                 <div>
                    <span className="font-bold underline uppercase">{activeEvalPeriod.name}</span> evaluations are currently open and accepting submissions.
                    <p className="text-xs mt-1 opacity-70">Window: {new Date(activeEvalPeriod.start_date).toLocaleDateString()} — {new Date(activeEvalPeriod.end_date).toLocaleDateString()}</p>
                 </div>
                 <div className="flex items-center gap-2">
                    <Badge variant="outline" className="bg-white/50">{activeEvalPeriod.form_type}</Badge>
                    <Button variant="outline" size="sm" onClick={() => router.push('/dean/evaluations')}>View Details</Button>
                 </div>
              </div>
            ) : activeAcademicPeriod ? (
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                <div>
                  <span className="font-bold">{activeAcademicPeriod.name}</span> is the active academic period. No evaluation has been started yet for this session.
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => router.push('/dean/evaluation-setup')}
                >
                  <FilePlus className="w-4 h-4 mr-1" /> Start Evaluation
                </Button>
              </div>
            ) : (
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                <span>No active academic or evaluation periods at the moment.</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push('/dean/academic')}
                >
                  <Plus className="w-4 h-4 mr-1" /> Create Academic Period
                </Button>
              </div>
            )}
          </Alert>

          {/* Faculty Rankings */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <div>
                <CardTitle>👨‍🏫 Faculty Performance Rankings</CardTitle>
                <CardDescription>Comprehensive list of department instructors ranked by overall rating</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Filtered by:</span>
                <select
                  value={selectedPeriodId}
                  onChange={(e) => setSelectedPeriodId(e.target.value)}
                  className="px-3 py-1.5 text-sm rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 transition-all cursor-pointer shadow-sm outline-none"
                >
                  <option value="all">Total History</option>
                  {academicData?.periods?.map((p: any) => (
                    <option key={p.id} value={p.id}>
                      S.Y. {p.academic_year} {p.semester === 1 ? '1st Sem' : p.semester === 2 ? '2nd Sem' : 'Summer'}
                    </option>
                  ))}
                </select>
              </div>
            </CardHeader>
            <CardContent>
              {analyticsData?.analytics?.topInstructors?.length ? (
                <ol className="space-y-3">
                  {analyticsData.analytics.topInstructors.map((t:any) => (
                    <li key={t.rank} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-sm">
                          {t.rank}
                        </div>
                        <span className="font-medium text-gray-900 dark:text-white">{t.instructor?.name}</span>
                      </div>
                      <Badge variant="success" className="text-sm px-2 py-0.5">{t.overallScore}</Badge>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-sm text-gray-600 dark:text-gray-400 py-4 text-center">No performance data yet</p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4 flex flex-col">
          <DashboardCard
            title="Total Students"
            value={<AnimatedCounter endValue={totalStudents} />}
            footer="Registered students"
            icon={<Users className="w-6 h-6" />}
            color="indigo"
          />
          <DashboardCard
            title="Total Teachers"
            value={<AnimatedCounter endValue={totalTeachers} />}
            footer="Active faculty members"
            icon={<Users className="w-6 h-6" />}
            color="purple"
          />
        </div>
      </div>
    </div>
  );
}
