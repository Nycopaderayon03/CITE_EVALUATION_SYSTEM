'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardSkeleton } from '@/components/loading/Skeletons';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Alert } from '@/components/ui/Alert';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { useConfirmModal } from '@/components/ui/ConfirmModal';
import { useFetch } from '@/hooks';
import {
  Search, Eye, ArrowLeft, Lock, Unlock,
  Pencil, Trash2, XCircle, PlayCircle, UserCheck, RotateCcw, Clock,
} from 'lucide-react';

const fetchApi = async (url: string, options?: RequestInit) => {
  const base = process.env.NEXT_PUBLIC_API_URL || '/api';
  const token = typeof window !== 'undefined' ? sessionStorage.getItem('auth_token') : null;
  const res = await fetch(`${base}${url}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  const data = await res.json();
  if (!res.ok || !data.success) throw new Error(data.error || `Request failed: ${res.status}`);
  return data;
};

const statusBadge = (status: string) => {
  const map: Record<string, 'success' | 'warning' | 'secondary' | 'destructive'> = {
    active: 'success',
    draft: 'secondary',
    upcoming: 'warning',
    closed: 'destructive',
  };
  return <Badge variant={map[status] || 'secondary'}>{status}</Badge>;
};

const formatDate = (d?: string) => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const calculateDaysLeft = (endDate?: string) => {
  if (!endDate) return 0;
  const deadline = new Date(endDate);
  deadline.setHours(23, 59, 59, 999);
  const diff = deadline.getTime() - new Date().getTime();
  const days = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  return days;
};

export default function Evaluations() {
  const router = useRouter();
  const { confirm, modalProps, ConfirmModal } = useConfirmModal();

  // ── Top level: periods list ──
  const { data: periodsData, loading: periodsLoading } = useFetch<any>('/evaluation_periods');
  const [periods, setPeriods] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // Sync from fetch
  useEffect(() => {
    if (periodsData?.periods) setPeriods(periodsData.periods);
  }, [periodsData]);

  // ── Drill-down state ──
  const [selectedPeriod, setSelectedPeriod] = useState<any>(null);
  const [periodEvals, setPeriodEvals] = useState<any[]>([]);
  const [evalsLoading, setEvalsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedEval, setSelectedEval] = useState<any>(null);

  // ── Dean evaluation state ──
  const { data: usersData } = useFetch<any>('/users');
  const [deanModalOpen, setDeanModalOpen] = useState(false);
  const [deanTeacher, setDeanTeacher] = useState('');
  const [deanCourse, setDeanCourse] = useState('');
  const [deanCreating, setDeanCreating] = useState(false);

  // Automatically load every registered teacher from the system DB
  const deanTeachers = useMemo(() => {
    return (usersData?.users || [])
      .filter((u: any) => u.role === 'teacher')
      .sort((a: any, b: any) => a.name.localeCompare(b.name));
  }, [usersData]);

  // Auto-select the first teacher when the modal opens if none is selected
  useEffect(() => {
    if (deanModalOpen && deanTeachers.length > 0 && !deanTeacher) {
      setDeanTeacher(deanTeachers[0].id);
    }
  }, [deanModalOpen, deanTeachers, deanTeacher]);

  const selectedDeanTeacher = deanTeachers.find((t: any) => t.id === deanTeacher);
  const isPeerPeriod = selectedPeriod?.form_type === 'peer-review';

  const handleDeanCreate = async () => {
    if (!deanTeacher) return;
    setDeanCreating(true);
    try {
      const data = await fetchApi('/evaluations/dean', {
        method: 'POST',
        body: JSON.stringify({
          period_id: selectedPeriod.id,
          evaluatee_id: deanTeacher,
          course_id: deanCourse || null,
        }),
      });
      setDeanModalOpen(false);
      setDeanTeacher('');
      router.push(`/dean/evaluations/fill/${data.evaluationId}`);
    } catch (err) {
      showFeedback('error', err instanceof Error ? err.message : 'Failed to create dean evaluation');
    } finally {
      setDeanCreating(false);
    }
  };

  // ── Feedback ──
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showFeedback = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
    if (type === 'success') setTimeout(() => setFeedback(null), 4000);
  };

  // ── Progress from all evaluations ──
  const [allEvals, setAllEvals] = useState<any[]>([]);
  const [allEvalsLoaded, setAllEvalsLoaded] = useState(false);

  const refreshAllEvals = () => {
    fetchApi('/evaluations')
      .then(data => setAllEvals(data.evaluations || []))
      .catch((err) => { console.error('Error:', err); });
  };

  useEffect(() => {
    if (periods.length > 0 && !allEvalsLoaded) {
      refreshAllEvals();
      setAllEvalsLoaded(true);
    }
  }, [periods, allEvalsLoaded]);

  const periodProgress = useMemo(() => {
    const map: Record<number, { total: number; submitted: number }> = {};
    for (const e of allEvals) {
      const pid = e.period_id;
      if (!pid) continue;
      if (e.status === 'locked') continue;
      if (!map[pid]) map[pid] = { total: 0, submitted: 0 };
      map[pid].total++;
      if (e.status === 'submitted') map[pid].submitted++;
    }
    return map;
  }, [allEvals]);

  // ── Drill-down actions ──
  const [drillForm, setDrillForm] = useState<any>(null);

  const viewPeriod = async (period: any) => {
    setSelectedPeriod(period);
    setEvalsLoading(true);
    setSearchTerm('');
    setFilterType('all');
    setFilterStatus('all');
    setDrillForm(null);
    try {
      const [data, formData] = await Promise.all([
        fetchApi(`/evaluations?period_id=${period.id}`),
        period.form_id ? fetchApi(`/forms?id=${period.form_id}`).catch(() => ({ form: null })) : Promise.resolve({ form: null })
      ]);
      setPeriodEvals(data.evaluations || []);
      if (formData.form && formData.form.criteria) {
        const payload = Array.isArray(formData.form.criteria) 
            ? formData.form.criteria 
            : typeof formData.form.criteria === 'string' ? JSON.parse(formData.form.criteria) : [];
        setDrillForm({ ...formData.form, criteria: payload });
      }
    } catch {
      setPeriodEvals([]);
    } finally {
      setEvalsLoading(false);
    }
  };

  const goBack = () => {
    setSelectedPeriod(null);
    setPeriodEvals([]);
    setSelectedEval(null);
  };

  const handleToggleLock = async (e: any) => {
    try {
      const isLocked = e.status === 'locked';
      const newStatus = !isLocked ? 'locked' : (e.submitted_at || e.responses?.length > 0 ? 'submitted' : 'pending');
      await fetchApi('/evaluations', {
        method: 'PATCH',
        body: JSON.stringify({ id: e.id, status: newStatus }),
      });
      if (selectedPeriod) viewPeriod(selectedPeriod);
    } catch {
      showFeedback('error', 'Failed to update lock status');
    }
  };

  const handleEvalDelete = (evalItem: any) => {
    const isGhost = evalItem.is_ghost;
    const label = isGhost ? 'Delete Dean Evaluation' : 'Reset to Pending';
    const message = isGhost
      ? 'This will permanently delete this dean evaluation and all its responses.'
      : 'This will clear all responses and reset this evaluation to pending, requiring the evaluator to submit again.';

    confirm({
      title: label,
      message,
      confirmLabel: isGhost ? 'Delete' : 'Reset',
      variant: isGhost ? 'danger' : 'warning',
      onConfirm: async () => {
        try {
          await fetchApi(`/evaluations?id=${evalItem.id}`, { method: 'DELETE' });
          showFeedback('success', isGhost ? 'Dean evaluation deleted.' : 'Evaluation reset to pending.');
          if (selectedPeriod) viewPeriod(selectedPeriod);
          refreshAllEvals();
        } catch (err) {
          showFeedback('error', err instanceof Error ? err.message : 'Operation failed');
        }
      },
    });
  };

  // ── Period CRUD actions ──
  const handleStatusChange = (period: any, newStatus: string) => {
    const labels: Record<string, string> = { active: 'reopen', closed: 'close' };
    const label = labels[newStatus] || newStatus;
    confirm({
      title: `${label === 'close' ? 'Close' : 'Reopen'} Period`,
      message: `Are you sure you want to ${label} "${period.name}"? ${label === 'close' ? 'This instantly locks all pending evaluations preventing further submissions.' : 'This will unlock all evaluations previously locked by its closure.'}`,
      confirmLabel: label === 'close' ? 'Close Period' : 'Reopen Period',
      variant: label === 'close' ? 'warning' : 'default',
      onConfirm: async () => {
        try {
          const data = await fetchApi('/evaluation_periods', {
            method: 'PATCH',
            body: JSON.stringify({ id: period.id, status: newStatus }),
          });
          setPeriods(prev => prev.map(p => p.id === period.id ? data.period : p));
          if (selectedPeriod?.id === period.id) {
            setSelectedPeriod(data.period);
            viewPeriod(data.period);
          }
          refreshAllEvals();
          showFeedback('success', `Period ${label === 'close' ? 'closed' : 'reopened'} successfully.`);
        } catch (err) {
          showFeedback('error', err instanceof Error ? err.message : 'Failed to update status');
        }
      },
    });
  };

  const handleDelete = (period: any) => {
    confirm({
      title: 'Delete Period',
      message: `Delete "${period.name}" and all its evaluations? This cannot be undone.`,
      confirmLabel: 'Delete',
      variant: 'danger',
      onConfirm: async () => {
        try {
          await fetchApi(`/evaluation_periods?id=${period.id}`, { method: 'DELETE' });
          setPeriods(prev => prev.filter(p => p.id !== period.id));
          refreshAllEvals();
          showFeedback('success', 'Period deleted.');
        } catch (err) {
          showFeedback('error', err instanceof Error ? err.message : 'Failed to delete');
        }
      },
    });
  };

  // ── Filtered evaluations ──
  const filteredEvals = useMemo(() => {
    return periodEvals.filter((e: any) => {
      const evaluatorName = e.evaluator?.name || e.evaluator_name || '';
      const evaluateeName = e.evaluatee?.name || e.evaluatee_name || '';
      const courseName = e.course?.name || e.course_name || '';
      const courseCode = e.course?.code || e.course_code || '';
      const matchSearch = searchTerm === '' ||
        evaluatorName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        evaluateeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        courseName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        courseCode.toLowerCase().includes(searchTerm.toLowerCase());
      const matchType = filterType === 'all' || e.evaluation_type === filterType;
      const matchStatus = filterStatus === 'all' || e.status === filterStatus;
      return matchSearch && matchType && matchStatus;
    });
  }, [periodEvals, searchTerm, filterType, filterStatus]);

  if (periodsLoading) return <DashboardSkeleton />;

  // ── DRILL-DOWN VIEW ──
  if (selectedPeriod) {
    const avgScore = filteredEvals.length > 0
      ? (filteredEvals.reduce((sum: number, e: any) => {
        const ratings = (e.responses || []).map((r: any) => r.rating || 0);
        return sum + (ratings.length > 0 ? ratings.reduce((a: number, b: number) => a + b, 0) / ratings.length : 0);
      }, 0) / filteredEvals.length).toFixed(2)
      : '—';

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="sm" onClick={goBack} className="gap-1">
              <ArrowLeft className="w-4 h-4" /> Back
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                {selectedPeriod.name}
                {selectedPeriod.status === 'active' && (
                  <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 font-bold ml-1">
                    {calculateDaysLeft(selectedPeriod.end_date)} Days Left
                  </Badge>
                )}
              </h1>
              <p className="text-gray-600 dark:text-gray-400 text-sm">
                {formatDate(selectedPeriod.start_date)} — {formatDate(selectedPeriod.end_date)} {statusBadge(selectedPeriod.status)}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            {selectedPeriod.status === 'active' && (
              <Button variant="primary" size="sm" className="gap-1" onClick={() => { setDeanTeacher(''); setDeanModalOpen(true); }}>
                <UserCheck className="w-3 h-3" /> Dean Evaluate
              </Button>
            )}
            <Button variant="outline" size="sm" className="gap-1" onClick={() => router.push(`/dean/evaluation-setup?periodId=${selectedPeriod.id}`)}>
              <Pencil className="w-3 h-3" /> Edit
            </Button>
            {selectedPeriod.status === 'active' && (
              <Button variant="danger" size="sm" className="gap-1" onClick={() => handleStatusChange(selectedPeriod, 'closed')}>
                <XCircle className="w-3 h-3" /> Close
              </Button>
            )}
            {selectedPeriod.status === 'closed' && (
              <Button variant="primary" size="sm" className="gap-1" onClick={() => handleStatusChange(selectedPeriod, 'active')}>
                <PlayCircle className="w-3 h-3" /> Reopen
              </Button>
            )}
          </div>
        </div>

        {feedback && (
          <Alert variant={feedback.type === 'success' ? 'success' : 'error'} title={feedback.type === 'success' ? 'Success' : 'Error'}>
            {feedback.message}
          </Alert>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-gray-600 dark:text-gray-400 text-sm mb-1">Total</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">{periodEvals.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-gray-600 dark:text-gray-400 text-sm mb-1">Submitted</p>
              <p className="text-3xl font-bold text-green-600">
                {periodEvals.filter((e: any) => e.status === 'submitted').length}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-gray-600 dark:text-gray-400 text-sm mb-1">Locked</p>
              <p className="text-3xl font-bold text-red-600">
                {periodEvals.filter((e: any) => e.status === 'locked').length}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-gray-600 dark:text-gray-400 text-sm mb-1">Pending</p>
              <p className="text-3xl font-bold text-yellow-600">
                {periodEvals.filter((e: any) => e.status === 'pending').length}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-gray-600 dark:text-gray-400 text-sm mb-1">Avg Score</p>
              <p className="text-3xl font-bold text-blue-600">{avgScore}/5</p>
            </CardContent>
          </Card>
        </div>

        {/* Evaluations table */}
        <Card className="shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden">
          <CardHeader className="border-b border-gray-100 dark:border-gray-700/50 bg-gray-50/30 dark:bg-gray-800/30">
            <CardTitle>Evaluation Submissions</CardTitle>
            <CardDescription>Track all submitted, pending, and locked data generated during this period.</CardDescription>
          </CardHeader>
          <CardContent className="pt-6 space-y-5 flex flex-col">
            <div className="flex gap-3 flex-col lg:flex-row lg:items-center bg-gray-50/80 dark:bg-gray-800/50 p-3 rounded-xl border border-gray-100 dark:border-gray-700">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by evaluator, evaluatee, or course..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm"
                />
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <select
                  className="px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer shadow-sm"
                  value={filterType}
                  onChange={e => setFilterType(e.target.value)}
                >
                  <option value="all">All Form Types</option>
                  <option value="teacher">Student to Teacher</option>
                  <option value="peer">Peer Review</option>
                </select>
                <select
                  className="px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer shadow-sm"
                  value={filterStatus}
                  onChange={e => setFilterStatus(e.target.value)}
                >
                  <option value="all">Any Status</option>
                  <option value="submitted">Submitted</option>
                  <option value="locked">Locked</option>
                  <option value="pending">Pending Submission</option>
                </select>
              </div>
            </div>

            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
              Showing {filteredEvals.length} of {periodEvals.length} evaluations
            </p>

            {evalsLoading ? (
              <p className="text-center text-gray-500 py-8">Loading evaluations...</p>
            ) : filteredEvals.length === 0 ? (
              <p className="text-center text-gray-500 py-8">No evaluations found for this period.</p>
            ) : (
              <div className="overflow-hidden border border-gray-200 dark:border-gray-700 rounded-xl">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50/80 dark:bg-gray-800/80 border-b border-gray-200 dark:border-gray-700">
                    <tr>
                      <th className="px-5 py-3.5 text-left font-semibold text-gray-700 dark:text-gray-300">Evaluator</th>
                      <th className="px-5 py-3.5 text-left font-semibold text-gray-700 dark:text-gray-300">Target Evaluatee</th>
                      <th className="px-5 py-3.5 text-left font-semibold text-gray-700 dark:text-gray-300">Program</th>
                      <th className="px-5 py-3.5 text-left font-semibold text-gray-700 dark:text-gray-300">Level</th>
                      <th className="px-5 py-3.5 text-left font-semibold text-gray-700 dark:text-gray-300">Target Subject</th>
                      <th className="px-5 py-3.5 text-left font-semibold text-gray-700 dark:text-gray-300">Form Type</th>
                      <th className="px-5 py-3.5 text-left font-semibold text-gray-700 dark:text-gray-300">Status</th>
                      <th className="px-5 py-3.5 text-left font-semibold text-gray-700 dark:text-gray-300">Score</th>
                      <th className="px-5 py-3.5 text-right font-semibold text-gray-700 dark:text-gray-300">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {filteredEvals.map((e: any) => {
                      const evaluatorName = e.evaluator?.name || e.evaluator_name || '—';
                      const evaluateeName = e.evaluatee?.name || e.evaluatee_name || '—';
                      const courseName = e.course?.name || e.course_name || '—';
                      const courseCode = e.course?.code || e.course_code || '';
                      const ratings = (e.responses || []).map((r: any) => r.rating || 0);
                      const avg = ratings.length > 0
                        ? (ratings.reduce((a: number, b: number) => a + b, 0) / ratings.length).toFixed(1)
                        : '—';
                      const isLocked = e.status === 'locked';
                      const isSubmitted = e.status === 'submitted';

                      return (
                        <tr key={e.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                          <td className="px-5 py-3 text-gray-900 dark:text-white font-medium">
                            <div className="flex items-center gap-2">
                              {evaluatorName}
                              {e.is_ghost && <Badge variant="outline" className="text-[10px] leading-tight px-1.5 py-0">Dean</Badge>}
                            </div>
                          </td>
                          <td className="px-5 py-3 text-gray-900 dark:text-gray-200">{evaluateeName}</td>
                          <td className="px-5 py-3">
                            <Badge variant="outline" className="text-xs bg-indigo-50/50 dark:bg-indigo-900/10 text-indigo-700 dark:text-indigo-400 border-indigo-200/50">
                              {e.evaluator?.program || '—'}
                            </Badge>
                          </td>
                          <td className="px-5 py-3">
                            <span className="text-gray-600 dark:text-gray-400 font-medium">
                              {e.evaluator?.year ? `${e.evaluator.year}${e.evaluator.year === 1 ? 'st' : e.evaluator.year === 2 ? 'nd' : e.evaluator.year === 3 ? 'rd' : 'th'}` : '—'}
                            </span>
                          </td>
                          <td className="px-5 py-3">
                             <div className="flex flex-col">
                                {courseCode ? <span className="font-semibold text-gray-700 dark:text-gray-300 text-xs tracking-wider">{courseCode}</span> : null}
                                <span className="text-gray-600 dark:text-gray-400 truncate max-w-[200px]" title={courseName}>{courseName}</span>
                             </div>
                          </td>
                          <td className="px-5 py-3">
                            <Badge variant="secondary" className="whitespace-nowrap font-medium">
                              {e.evaluation_type === 'teacher' ? 'Student \u2192 Teacher' : e.evaluation_type === 'peer' ? 'Peer' : e.evaluation_type}
                            </Badge>
                          </td>
                          <td className="px-5 py-3">
                            <Badge variant={isSubmitted ? 'success' : isLocked ? 'destructive' : 'secondary'} className="shadow-sm">
                              {e.status}
                            </Badge>
                          </td>
                          <td className="px-5 py-3 font-bold text-blue-600 dark:text-blue-400">{avg === '—' ? '—' : `${avg}/5`}</td>
                          <td className="px-5 py-3">
                            <div className="flex gap-1.5 flex-wrap justify-end">
                              {/* View responses (submitted or locked) */}
                              {(isSubmitted || isLocked) && (
                                <Button variant="outline" size="sm" className="gap-1.5 shadow-sm bg-white dark:bg-gray-800" onClick={() => setSelectedEval(e)}>
                                  <Eye className="w-3.5 h-3.5" /> View
                                </Button>
                              )}
                              {/* Ghost: Resume (pending) or Edit (submitted) */}
                              {e.is_ghost && e.status === 'pending' && (
                                <Button variant="primary" size="sm" className="gap-1.5 shadow-sm" onClick={() => router.push(`/dean/evaluations/fill/${e.id}`)}>
                                  <UserCheck className="w-3.5 h-3.5" /> Resume
                                </Button>
                              )}
                              {e.is_ghost && isSubmitted && (
                                <Button variant="outline" size="sm" className="gap-1.5 shadow-sm bg-white dark:bg-gray-800" onClick={() => router.push(`/dean/evaluations/fill/${e.id}`)}>
                                  <Pencil className="w-3.5 h-3.5" /> Edit
                                </Button>
                              )}
                              {/* Lock/Unlock (non-ghost) */}
                              {!e.is_ghost && (
                                <Button
                                  variant={isLocked ? 'danger' : 'secondary'}
                                  size="sm"
                                  className="gap-1.5 shadow-sm"
                                  onClick={() => handleToggleLock(e)}
                                >
                                  {isLocked ? <><Unlock className="w-3.5 h-3.5" /> Unlock</> : <><Lock className="w-3.5 h-3.5" /> Lock</>}
                                </Button>
                              )}
                              {/* Delete (ghost) or Reset (normal) */}
                              {(e.is_ghost || isSubmitted) && !isLocked && (
                                <Button variant="danger" size="sm" className="gap-1.5 shadow-sm" onClick={() => handleEvalDelete(e)}>
                                  {e.is_ghost ? <Trash2 className="w-3.5 h-3.5" /> : <RotateCcw className="w-3.5 h-3.5" />}
                                  <span className="hidden sm:inline">{e.is_ghost ? 'Delete' : 'Reset'}</span>
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {selectedEval && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setSelectedEval(null)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') { setSelectedEval(null); } }}>
            <Card className="w-full max-w-2xl max-h-[80vh] overflow-auto" onClick={e => e.stopPropagation()}>
              <CardHeader className="border-b flex flex-row justify-between items-center">
                <div>
                  <CardTitle>Evaluation Details</CardTitle>
                  <CardDescription>
                    {selectedEval.evaluator?.name || selectedEval.evaluator_name} {'\u2192'} {selectedEval.evaluatee?.name || selectedEval.evaluatee_name}
                  </CardDescription>
                </div>
                <Button variant="outline" onClick={() => setSelectedEval(null)}>Close</Button>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Course</p>
                    <p className="font-semibold text-gray-900 dark:text-white">
                      {(selectedEval.course?.code || selectedEval.course_code)
                        ? `${selectedEval.course?.code || selectedEval.course_code} — ${selectedEval.course?.name || selectedEval.course_name}`
                        : selectedEval.course?.name || selectedEval.course_name || '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Type</p>
                    <p className="font-semibold text-gray-900 dark:text-white">{selectedEval.evaluation_type}</p>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">Responses:</p>
                  {(selectedEval.responses || []).length === 0 ? (
                    <p className="text-sm text-gray-500">No responses recorded.</p>
                  ) : (
                    selectedEval.responses.map((r: any, idx: number) => {
                      let qText = r.question_text || r.criteria_name || `Question ${idx + 1}`;
                      if (drillForm?.criteria) {
                        for (const c of drillForm.criteria) {
                          const q = (c.questions || []).find((queryQ: any) => String(queryQ.id) === String(r.criteria_id));
                          if (q) {
                            qText = q.text; break;
                          }
                        }
                      }

                      return (
                        <div key={idx} className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg mb-2 border border-gray-100 dark:border-gray-700">
                          <div className="flex justify-between items-start gap-4">
                            <span className="text-sm font-medium text-gray-900 dark:text-white leading-tight">
                              {qText}
                            </span>
                            <span className="font-bold text-blue-600 dark:text-blue-400 whitespace-nowrap bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded text-sm">{r.rating}/5</span>
                          </div>
                          {r.criteria_name && (
                            <span className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mt-1 block">{r.criteria_name}</span>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
                
                <div className="pt-4 mt-6 border-t border-gray-100 dark:border-gray-800">
                  <div className="bg-orange-50 dark:bg-orange-900/10 border border-orange-100 dark:border-orange-900/30 p-3 rounded-lg flex gap-2 text-sm text-orange-800 dark:text-orange-300">
                    <Lock className="w-4 h-4 mt-0.5 shrink-0" />
                    <p>Qualitative comments and text feedback are hidden from administrative view to strictly protect evaluator anonymity.</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Dean Evaluate Modal */}
        <Modal isOpen={deanModalOpen} onClose={() => setDeanModalOpen(false)} title="Dean Evaluation" size="2xl">
          <div className="space-y-6">
            <div className="bg-indigo-50/50 dark:bg-indigo-900/10 p-4 rounded-xl border border-indigo-100 dark:border-indigo-900/30">
               <div className="flex justify-between items-start">
                  <div>
                    <h5 className="text-xs font-bold text-indigo-700 dark:text-indigo-400 uppercase tracking-widest mb-1">Target Period</h5>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">{selectedPeriod?.name}</p>
                    <p className="text-[10px] text-gray-500 mt-0.5">AY {selectedPeriod?.academic_year} • {selectedPeriod?.semester}</p>
                  </div>
                  <Badge variant="outline" className="bg-white dark:bg-gray-800 text-indigo-600 border-indigo-200">
                    {selectedPeriod?.form_type === 'peer-review' ? 'Peer Review Form' : 'Faculty Evaluation Form'}
                  </Badge>
               </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest border-b pb-1">Target Individual</h4>
                <Select
                  label="Select Teacher"
                  value={deanTeacher}
                  onChange={e => {
                    setDeanTeacher(e.target.value);
                    setDeanCourse(''); // Reset course when teacher changes
                  }}
                  options={deanTeachers.map(t => ({ value: t.id, label: t.name }))}
                  placeholder="Choose a faculty member..."
                />
                <p className="text-[10px] text-gray-500 leading-relaxed italic">
                  Note: The evaluation will appear as an anonymous entry in the system to protect the integrity of the data stream.
                </p>
              </div>

              <div className="space-y-4">
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest border-b pb-1">Academic Context</h4>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Subject (Optional)</label>
                  <select 
                    className="w-full p-2.5 rounded-xl border border-gray-200 bg-white dark:bg-gray-800 dark:border-gray-700 focus:ring-2 focus:ring-blue-500/20 transition-all cursor-pointer shadow-sm text-sm"
                    value={deanCourse}
                    onChange={e => setDeanCourse(e.target.value)}
                  >
                    <option value="">No specific subject / General</option>
                    {periodEvals
                      .filter((e: any) => e.evaluatee_id === deanTeacher && e.course_id)
                      .reduce((acc: any[], current: any) => {
                        const cid = current.course_id;
                        if (!acc.find(x => x.id === cid)) acc.push({ id: cid, code: current.course_code, name: current.course_name });
                        return acc;
                      }, [])
                      .map((c: any) => (
                        <option key={c.id} value={c.id}>
                          {c.code} — {c.name}
                        </option>
                      )
                    )}
                  </select>
                </div>
                <div className="p-3 bg-amber-50 dark:bg-amber-900/10 rounded-xl border border-amber-100 dark:border-amber-900/30">
                   <p className="text-[10px] text-amber-700 dark:text-amber-400 leading-tight">
                     Associating a subject helps in granular reporting but is not required for general faculty assessment.
                   </p>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button variant="outline" className="px-6" onClick={() => setDeanModalOpen(false)}>Cancel</Button>
              <Button
                variant="primary"
                className="px-8 shadow-lg shadow-blue-500/10"
                onClick={handleDeanCreate}
                disabled={deanCreating || !deanTeacher}
                isLoading={deanCreating}
              >
                Start Evaluation
              </Button>
            </div>
          </div>
        </Modal>

        <ConfirmModal {...modalProps} />
      </div>
    );
  }

  // ── TOP-LEVEL: Periods list ──
  const visiblePeriods = periods.filter(p => showHistory ? p.status === 'closed' : p.status !== 'closed');

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            {showHistory ? 'Evaluation History' : 'Evaluations'}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            {showHistory 
               ? 'View past and closed evaluation periods from previous timelines.'
               : 'Manage active evaluation periods and drill down into live submissions.'}
          </p>
        </div>
        <Button 
          variant={showHistory ? 'primary' : 'outline'}
          className={showHistory ? 'bg-indigo-600 hover:bg-indigo-700 shadow-sm border-indigo-700' : 'shadow-sm bg-white dark:bg-gray-800'}
          onClick={() => setShowHistory(!showHistory)}
        >
          {showHistory ? 'Return to Active Periods' : 'View Evaluation History'}
        </Button>
      </div>

      {feedback && (
        <Alert variant={feedback.type === 'success' ? 'success' : 'error'} title={feedback.type === 'success' ? 'Success' : 'Error'}>
          {feedback.message}
        </Alert>
      )}

      {visiblePeriods.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-center py-12">
            <p className="text-gray-500 dark:text-gray-400 mb-2">
               {showHistory ? 'No closed or archived evaluation periods exist.' : 'No active evaluation periods found.'}
            </p>
            {!showHistory && <p className="text-sm text-gray-400">Create one in Evaluation Setup to get started.</p>}
          </CardContent>
        </Card>
      ) : (
        <Card className="shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50/80 dark:bg-gray-800/80 border-b border-gray-100 dark:border-gray-700/50">
                <tr>
                  <th className="px-5 py-4 text-left font-semibold text-gray-700 dark:text-gray-300">Name</th>
                  <th className="px-5 py-4 text-left font-semibold text-gray-700 dark:text-gray-300">Form Type</th>
                  <th className="px-5 py-4 text-left font-semibold text-gray-700 dark:text-gray-300">Target Range</th>
                  <th className="px-5 py-4 text-left font-semibold text-gray-700 dark:text-gray-300">Time Remaining</th>
                  <th className="px-5 py-4 text-left font-semibold text-gray-700 dark:text-gray-300">Status</th>
                  <th className="px-5 py-4 text-left font-semibold text-gray-700 dark:text-gray-300">Progress Tracking</th>
                  <th className="px-5 py-4 text-right font-semibold text-gray-700 dark:text-gray-300">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {visiblePeriods.map((p: any) => {
                  const prog = periodProgress[p.id] || { total: 0, submitted: 0 };
                  const pct = prog.total > 0 ? Math.round((prog.submitted / prog.total) * 100) : 0;

                  return (
                    <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                      <td className="px-5 py-4 font-semibold text-gray-900 dark:text-white">{p.name}</td>
                      <td className="px-5 py-4">
                        <Badge variant={p.form_type === 'peer-review' ? 'warning' : 'default'} className="font-medium whitespace-nowrap">
                          {p.form_type === 'peer-review' ? 'Peer Review' : p.form_type === 'student-to-teacher' ? 'Student \u2192 Teacher' : p.form_type || '—'}
                        </Badge>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex flex-col">
                           <span className="text-gray-900 dark:text-gray-200 font-medium">AY {p.academic_year || '—'} / Sem {p.semester || '—'}</span>
                           <span className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{formatDate(p.start_date)} — {formatDate(p.end_date)}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        {p.status === 'active' ? (
                          <div className="flex items-center gap-1.5 font-bold text-amber-600 dark:text-amber-400">
                             <Clock className="w-4 h-4" />
                             {calculateDaysLeft(p.end_date)} Days
                          </div>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-5 py-4">{statusBadge(p.status)}</td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3 min-w-[160px]">
                          <div className="flex-1 bg-gray-100 dark:bg-gray-800/80 rounded-full h-2.5 overflow-hidden border border-gray-200 dark:border-gray-700">
                            <div
                              className="bg-blue-600 dark:bg-blue-500 h-2.5 rounded-full transition-all duration-500"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-xs font-semibold text-gray-600 dark:text-gray-400 whitespace-nowrap">{prog.submitted}/{prog.total} <span className="opacity-70">({pct}%)</span></span>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex gap-2 flex-wrap justify-end">
                          <Button variant="outline" size="sm" className="gap-1.5 shadow-sm bg-white dark:bg-gray-800" onClick={() => viewPeriod(p)}>
                            <Eye className="w-3.5 h-3.5" /> View
                          </Button>
                          <Button variant="outline" size="sm" className="gap-1.5 shadow-sm bg-white dark:bg-gray-800" onClick={() => router.push(`/dean/evaluation-setup?periodId=${p.id}`)}>
                            <Pencil className="w-3.5 h-3.5" /> Edit
                          </Button>
                          {p.status === 'active' && (
                            <Button variant="danger" size="sm" className="gap-1.5 shadow-sm" onClick={() => handleStatusChange(p, 'closed')}>
                              <XCircle className="w-3.5 h-3.5" /> Close
                            </Button>
                          )}
                          {p.status === 'closed' && (
                            <Button variant="primary" size="sm" className="gap-1.5 shadow-sm" onClick={() => handleStatusChange(p, 'active')}>
                              <PlayCircle className="w-3.5 h-3.5" /> Reopen
                            </Button>
                          )}
                          {p.status !== 'active' && (
                            <Button variant="ghost" size="sm" className="gap-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20" onClick={() => handleDelete(p)}>
                              <Trash2 className="w-3.5 h-3.5" /> <span className="sr-only sm:not-sr-only">Delete</span>
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <ConfirmModal {...modalProps} />
    </div>
  );
}
