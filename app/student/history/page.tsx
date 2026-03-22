"use client";

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { DataTable } from '@/components/DataTable';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { DashboardSkeleton } from '@/components/loading/Skeletons';
import { formatDate } from '@/utils/helpers';
import { FileText, Search } from 'lucide-react';
import { useFetch } from '@/hooks';

export default function StudentHistory() {
  const { data: historyData, loading: historyLoading } = useFetch<any>('/evaluations?history=true');
  const [isLoading, setIsLoading] = useState(historyLoading);
  const [semester, setSemester] = useState('current');
  const [selectedEval, setSelectedEval] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    setIsLoading(historyLoading);
  }, [historyLoading]);

  // JSON export removed per requirement - all downloads now PDF only

  if (isLoading) return <DashboardSkeleton />;

  const availableSemesters = Array.from(
    new Set(
      (historyData?.evaluations || [])
        .map((e: any) => e.period?.academic_year && e.period?.semester ? `${e.period.academic_year} | ${e.period.semester}` : null)
        .filter(Boolean)
    )
  ) as string[];
  
  const semesters = [
    { value: 'current', label: 'Current Semester' },
    { value: 'all', label: 'All Semesters' },
    ...availableSemesters.sort().reverse().map((s: string) => ({ value: s, label: s })),
  ];

  const q = searchTerm.trim().toLowerCase();
  const filteredEvals = (historyData?.evaluations || []).filter((e:any) => {
    if (semester === 'current') {
      if (e.is_archived !== 0) return false;
    } else {
      const periodLabel = e.period?.academic_year && e.period?.semester ? `${e.period.academic_year} | ${e.period.semester}` : null;
      if (semester !== 'all' && periodLabel !== semester) return false;
    }

    if (!q) return true;
    return (
      (e.course?.name || '').toLowerCase().includes(q) ||
      (e.course?.code || '').toLowerCase().includes(q) ||
      (e.evaluatee?.name || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">📋 Evaluation History</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">View all your previously submitted evaluations</p>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search by course name, code, or instructor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          <div>
            <div className="text-sm font-semibold text-gray-900 dark:text-white block mb-2">Semester</div>
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
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-gray-600 dark:text-gray-400 text-sm mb-1">Total Evaluations</p>
            <p className="text-3xl font-bold text-gray-900 dark:text-white">{filteredEvals.length}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-gray-600 dark:text-gray-400 text-sm mb-1">Locked Evaluations</p>
            <p className="text-3xl font-bold text-green-600">{filteredEvals.filter((e:any) => e.status === 'locked').length}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-gray-600 dark:text-gray-400 text-sm mb-1">Submitted</p>
            <p className="text-3xl font-bold text-blue-600">{filteredEvals.filter((e:any) => e.status === 'submitted').length}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Submitted Evaluations</CardTitle>
          <CardDescription>All evaluations you have completed</CardDescription>
        </CardHeader>
        <CardContent>
          {filteredEvals.filter((e:any) => e.submitted_at).length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-600 dark:text-gray-400">No evaluations found</p>
            </div>
          ) : (
            <DataTable
              columns={[
                {
                  key: 'course',
                  label: 'Course',
                  render: (_: any, data: any) => (
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-white">{data.course_name || data.course?.name}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{data.course_code || data.course?.code}</p>
                    </div>
                  ),
                },
                {
                  key: 'evaluatee',
                  label: 'Instructor',
                  render: (_: any, data: any) => <span className="text-gray-700 dark:text-gray-300">{data.evaluatee_name || data.evaluatee?.name}</span>,
                },
                {
                  key: 'submittedAt',
                  label: 'Submitted',
                  render: (_: any, data: any) => <span className="text-gray-700 dark:text-gray-300">{data.submitted_at ? formatDate(new Date(data.submitted_at)) : 'N/A'}</span>,
                },
                {
                  key: 'status',
                  label: 'Status',
                  render: (_: any, data: any) => <Badge variant={data.status === 'locked' ? 'success' : 'warning'}>{data.status === 'locked' ? '🔒 Locked' : '✏️ Submitted'}</Badge>,
                },
                {
                  key: 'actions' as any,
                  label: 'Actions',
                  render: (_: any, data: any) => (
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => setSelectedEval(data.id)}>
                        View
                      </Button>
                    </div>
                  ),
                },
              ]}
              data={filteredEvals.filter((e:any) => e.submitted_at)}
            />
          )}
        </CardContent>
      </Card>

      {selectedEval && (() => {
        const responseItem = historyData?.evaluations?.find((e: any) => e.id === selectedEval);
        if (!responseItem) return null;
        return (
          <Card className="border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-900/20">
            <CardHeader className="flex flex-row justify-between items-start">
              <CardTitle>Evaluation Summary</CardTitle>
              <button
                onClick={() => setSelectedEval(null)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-xl"
              >
                ✕
              </button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Course</p>
                  <p className="font-semibold text-gray-900 dark:text-white">{responseItem.course?.name}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Instructor</p>
                  <p className="font-semibold text-gray-900 dark:text-white">{responseItem.evaluatee?.name}</p>
                </div>
              </div>

              <div className="space-y-2 pt-4 border-t border-gray-200 dark:border-gray-700">
                {responseItem.responses?.map((resp: any, idx: number) => (
                  <div key={`${responseItem.id}-${resp.criteriaId}-${idx}`} className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">
                      {resp.criteriaName || resp.criteria_id || 'Criterion'}
                    </span>
                    <span className="font-semibold text-gray-900 dark:text-white">{resp.rating || resp.score}/5</span>
                  </div>
                ))}
              </div>

              {responseItem.overallComment && (
                <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Comments:</p>
                  <p className="text-gray-900 dark:text-white">{responseItem.overallComment}</p>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })()}
    </div>
  );
}
