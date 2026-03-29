'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { DashboardCard } from '@/components/DashboardCard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { AnimatedCounter } from '@/components/animations/AnimatedCounter';
import { DashboardSkeleton } from '@/components/loading/Skeletons';
import { Users, TrendingUp, Award, FileText, MessageSquare, ArrowRight, BookOpen, ShieldCheck, Clock } from 'lucide-react';
import { useFetch } from '@/hooks';

import { useRouter } from 'next/navigation';

interface FeedbackItem {
  id: string;
  comment: string;
  rating: number;
  date: Date;
  source: 'student' | 'peer' | 'dean' | 'admin';
  subject?: string | null;
}

let syncFired = false;

export default function TeacherDashboard() {
  const { user } = useAuth();
  const router = useRouter();
  const [feedbackItems, setFeedbackItems] = useState<FeedbackItem[]>([]);
  const [receivedEvals, setReceivedEvals] = useState<any[]>([]);
  const [receivedEvalsLoading, setReceivedEvalsLoading] = useState(true);
  const [selectedSubject, setSelectedSubject] = useState<string>('all');

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

  const { data: coursesData, loading: coursesLoading } = useFetch<any>('/courses');
  const { data: evalData, loading: evalLoading } = useFetch<any>('/evaluations');
  const { data: periodData, loading: periodLoading } = useFetch<any>('/evaluation_periods?status=active');

  const activePeriod = periodData?.periods?.[0] || null;
  const teacherId = user?.id;

  // Fetch anonymous comments and received evaluations
  useEffect(() => {
    if (!teacherId) return;
    const token = typeof window !== 'undefined' ? sessionStorage.getItem('auth_token') : null;
    const base = process.env.NEXT_PUBLIC_API_URL || '/api';
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    // Anonymous student/peer comments about this teacher
    fetch(`${base}/comments?entity_type=evaluation&entity_id=${teacherId}`, { headers })
      .then(res => res.json())
      .then(data => {
        if (data.success && data.comments) {
          setFeedbackItems(data.comments.map((c: any) => {
            let meta: any = {};
            try { 
              if (c.meta_json) meta = typeof c.meta_json === 'string' ? JSON.parse(c.meta_json) : c.meta_json; 
            } catch(e) {}
            
            return {
              id: c.id,
              comment: c.content,
              rating: c.rating || 0,
              date: new Date(c.created_at),
              source: c.author_role === 'teacher' ? 'peer' : ['dean', 'admin'].includes(c.author_role) ? 'admin' : 'student',
              subject: meta.subject || null
            };
          }));
        }
      })
      .catch((err) => { console.error('Error:', err); });

    // Evaluations received (where this teacher is the evaluatee)
    fetch(`${base}/evaluations?role=evaluatee`, { headers })
      .then(res => res.json())
      .then(data => {
        if (data.success) setReceivedEvals(data.evaluations || []);
      })
      .catch((err) => { console.error('Error:', err); })
      .finally(() => setReceivedEvalsLoading(false));
  }, [teacherId]);

  // Use received evaluations for stats
  const teacherEvals = receivedEvals;

  // Merge explicit courses with implicit courses from evaluations
  const assignedCourses = [...(coursesData?.courses || [])];
  teacherEvals.forEach((evaluation: any) => {
    if (evaluation.course_id && !assignedCourses.find((c: any) => c.id === evaluation.course_id)) {
      assignedCourses.push({
        id: evaluation.course_id,
        name: evaluation.course_name || evaluation.course?.name,
        code: evaluation.course_code || evaluation.course?.code,
      });
    }
  });

  const assignedCount = assignedCourses.length;

  const evaluationAvg = (() => {
    if (!teacherEvals.length) return 0;
    const allRatings: number[] = [];
    teacherEvals.forEach((e: any) => {
      (e.responses || []).forEach((r: any) => {
        const val = Number(r.rating ?? 0);
        if (val > 0) allRatings.push(val);
      });
    });
    return allRatings.length ? allRatings.reduce((a, b) => a + b, 0) / allRatings.length : 0;
  })();

  const peerPending = evalData?.evaluations?.filter((e: any) => e.evaluation_type === 'peer' && e.status === 'pending').length || 0;
  const studentFeedback = feedbackItems.filter(f => f.source === 'student');
  const uniqueSubjects = Array.from(new Set(studentFeedback.map(f => f.subject).filter(Boolean)));
  const filteredStudentFeedback = selectedSubject === 'all' 
    ? studentFeedback 
    : studentFeedback.filter(f => f.subject === selectedSubject);
  const studentFeedbackAvg = studentFeedback.length ? studentFeedback.reduce((s, f) => s + f.rating, 0) / studentFeedback.length : 0;
  
  const pendingPeerDeadlines = (evalData?.evaluations || [])
    .filter((e: any) => e.evaluation_type === 'peer' && e.status === 'pending')
    .map((e: any) => new Date(e.period?.end_date || e.end_date).getTime());

  const mostUrgentPeriod = periodData?.periods?.length 
    ? [...periodData.periods].sort((a: any, b: any) => new Date(a.end_date).getTime() - new Date(b.end_date).getTime())[0]
    : activePeriod;

  const earliestTaskDeadline = pendingPeerDeadlines.length > 0 
    ? Math.min(...pendingPeerDeadlines) 
    : mostUrgentPeriod?.end_date ? new Date(mostUrgentPeriod.end_date).getTime() : 0;
    
  const targetDate = earliestTaskDeadline ? new Date(earliestTaskDeadline) : null;
  if (targetDate) targetDate.setHours(23, 59, 59, 999);
  
  const daysLeft = targetDate ? Math.max(0, Math.ceil((targetDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))) : 0;
  const deadlineDate = targetDate ? targetDate.toLocaleDateString('en-PH', { month: '2-digit', day: '2-digit', year: 'numeric' }) : '';

  const isLoading = coursesLoading || evalLoading || receivedEvalsLoading || periodLoading;
  if (isLoading) return <DashboardSkeleton />;

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white">Teaching Dashboard</h1>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <p className="text-gray-600 dark:text-gray-400">Welcome back, {user?.name || 'Teacher'}!</p>
            {activePeriod?.academic_year && (
              <Badge variant="secondary" className="px-2 py-0.5 text-xs font-bold bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                {activePeriod.name} • S.Y. {activePeriod.academic_year}
              </Badge>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {peerPending > 0 && (
            <Card className="border-red-100 dark:border-red-900/30 overflow-hidden shadow-sm">
              <CardHeader className="bg-red-50/50 dark:bg-red-900/10 pb-4">
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle className="text-lg text-red-800 dark:text-red-300 flex items-center gap-2">📋 Pending Peer Reviews</CardTitle>
                    <CardDescription>Complete these evaluations for your colleagues</CardDescription>
                  </div>
                  <Badge variant="destructive" className="font-bold">{peerPending}</Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-4 space-y-3">
                {(evalData?.evaluations || [])
                  .filter((e: any) => e.evaluation_type === 'peer' && e.status === 'pending')
                  .slice(0, 3)
                  .map((ev: any) => (
                    <div key={ev.id} className="flex items-center justify-between p-3 bg-white dark:bg-gray-900 rounded-lg border border-gray-100 dark:border-gray-800 shadow-sm hover:border-red-200 dark:hover:border-red-800 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 flex items-center justify-center font-bold text-sm">
                          {ev.evaluatee?.name?.charAt(0) || 'P'}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900 dark:text-gray-100">{ev.evaluatee?.name}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Peer Evaluation • S.Y. {ev.period?.academic_year || activePeriod?.academic_year}</p>
                          <p className="text-[10px] text-rose-500 font-black mt-0.5 uppercase tracking-wider bg-rose-50 dark:bg-rose-900/20 px-1 py-0.5 rounded inline-block">Deadline: {new Date(ev.period?.end_date || activePeriod?.end_date).toLocaleDateString()}</p>
                        </div>
                      </div>
                      <Button size="sm" variant="outline" className="border-red-200 text-red-700 hover:bg-red-50" onClick={() => router.push('/teacher/peer')}>Evaluate</Button>
                    </div>
                  ))}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="w-5 h-5 text-blue-600" />
                    Student Feedback
                  </CardTitle>
                  <CardDescription>Anonymous feedback from your students</CardDescription>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest border-r pr-2 shadow-neutral-200">Filter by:</span>
                    <select
                      value={selectedSubject}
                      onChange={(e) => setSelectedSubject(e.target.value)}
                      className="text-xs font-bold bg-transparent border-none focus:ring-0 text-blue-600 dark:text-blue-400 cursor-pointer outline-none pl-0 min-w-[70px]"
                    >
                      <option value="all">Global</option>
                      {uniqueSubjects.map((s) => (
                        <option key={s} value={s!}>{s}</option>
                      ))}
                    </select>
                  </div>
                  <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                    {filteredStudentFeedback.length} comments
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {filteredStudentFeedback.length === 0 ? (
                <div className="text-center py-6">
                   <p className="text-gray-500 dark:text-gray-400">No {selectedSubject === 'all' ? '' : `${selectedSubject} `}feedback received yet.</p>
                   {selectedSubject !== 'all' && (
                     <Button variant="ghost" size="sm" className="mt-2 text-blue-600" onClick={() => setSelectedSubject('all')}>View All Feedback</Button>
                   )}
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredStudentFeedback.slice(0, 10).map((item) => (
                    <div key={item.id} className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <span key={star} className={`text-lg ${star <= item.rating ? 'text-yellow-400' : 'text-gray-300'}`}>★</span>
                            ))}
                          </div>
                          {item.subject && (
                            <Badge variant="outline" className="text-[10px] bg-blue-50/50 text-blue-600 border-blue-200">
                              {item.subject}
                            </Badge>
                          )}
                        </div>
                        <span className="text-xs text-gray-500">{item.date.toLocaleDateString()}</span>
                      </div>
                      <p className="text-gray-700 dark:text-gray-300 text-sm">{item.comment}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Award className="w-5 h-5 text-indigo-600" />
                    Peer Feedback
                  </CardTitle>
                  <CardDescription>Anonymous collaborative critiques from colleagues and administration</CardDescription>
                </div>
                <Badge variant="secondary" className="bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
                  {feedbackItems.filter(f => ['peer', 'admin'].includes(f.source)).length} reviews
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {feedbackItems.filter(f => ['peer', 'admin'].includes(f.source)).length === 0 ? (
                <div className="text-center py-8 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-dashed border-gray-200 dark:border-gray-700">
                   <p className="text-gray-500 dark:text-gray-400 text-sm">No collaborative feedback received yet.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {feedbackItems.filter(f => ['peer', 'admin'].includes(f.source)).slice(0, 4).map((item) => (
                    <div key={item.id} className="p-4 bg-indigo-50/50 dark:bg-indigo-900/10 rounded-xl border border-indigo-100 dark:border-indigo-900/30 relative overflow-hidden group">
                      <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
                         <Award className="w-12 h-12" />
                      </div>
                      <div className="flex justify-between items-start mb-2 relative z-10">
                        <div className="flex items-center gap-1">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <span key={star} className={`text-[10px] ${star <= item.rating ? 'text-yellow-500' : 'text-gray-300'}`}>★</span>
                          ))}
                        </div>
                        <span className="text-[10px] uppercase font-bold tracking-wider text-gray-400">{item.date.toLocaleDateString()}</span>
                      </div>
                      <p className="text-gray-700 dark:text-gray-300 text-sm italic leading-relaxed relative z-10">"{item.comment}"</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4 flex flex-col">
          <Card className="mb-2">
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-lg">✨ Quick Links</CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-3">
              <Button variant="primary" className="w-full gap-2" onClick={() => router.push('/teacher/peer')}>
                <Users className="w-4 h-4" /> Peer Evaluation
              </Button>
              <Button variant="outline" className="w-full gap-2" onClick={() => router.push('/teacher/results')}>
                <TrendingUp className="w-4 h-4" /> View Results
              </Button>
            </CardContent>
          </Card>

          <DashboardCard title="Overall Rating" value={<AnimatedCounter endValue={evaluationAvg} decimals={1} suffix="/5" />} footer={`Based on ${teacherEvals.length} evaluations`} icon={<TrendingUp className="w-6 h-6" />} color="emerald" />
          
          {activePeriod && peerPending > 0 && (
            <Card className="relative overflow-hidden border-l-4 border-l-amber-500 shadow-sm">
              <CardContent className="pt-6">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-1">Days Left</p>
                    <div className="text-4xl font-black text-slate-900 dark:text-white mb-2 leading-none">
                      {daysLeft < 1 && daysLeft > 0 ? "Due Today" : daysLeft}
                    </div>
                    <p className="text-[11px] font-semibold text-gray-400">Deadline: {deadlineDate}</p>
                  </div>
                  <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-2xl">
                    <Clock className="w-6 h-6 text-amber-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <DashboardCard title="Classes Teaching" value={<AnimatedCounter endValue={assignedCount} />} footer="This semester" icon={<BookOpen className="w-6 h-6" />} color="indigo" />
          <DashboardCard title="Student Feedback" value={<AnimatedCounter endValue={studentFeedbackAvg} decimals={1} suffix="/5" />} footer={`${studentFeedback.length} comments`} icon={<MessageSquare className="w-6 h-6" />} color="amber" />
          <DashboardCard title="Peer Requests" value={<AnimatedCounter endValue={peerPending} />} footer="Pending tasks" icon={<Award className="w-6 h-6" />} color="rose" />
        </div>
      </div>
    </div>
  );
}
