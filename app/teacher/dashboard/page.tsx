'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { DashboardCard } from '@/components/DashboardCard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { AnimatedCounter } from '@/components/animations/AnimatedCounter';
import { DashboardSkeleton } from '@/components/loading/Skeletons';
import { Users, TrendingUp, Award, FileText, MessageSquare, ArrowRight } from 'lucide-react';
import { useFetch } from '@/hooks';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface FeedbackItem {
  id: string;
  comment: string;
  rating: number;
  date: Date;
  source: 'student' | 'peer' | 'dean' | 'admin';
}

export default function TeacherDashboard() {
  const { user } = useAuth();
  const router = useRouter();
  const [feedbackItems, setFeedbackItems] = useState<FeedbackItem[]>([]);
  const [receivedEvals, setReceivedEvals] = useState<any[]>([]);
  const [receivedEvalsLoading, setReceivedEvalsLoading] = useState(true);
  const [showAllStudentFeedback, setShowAllStudentFeedback] = useState(false);
  const [showAllPeerFeedback, setShowAllPeerFeedback] = useState(false);

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

  const { data: coursesData, loading: coursesLoading } = useFetch<any>('/courses');
  const { data: evalData, loading: evalLoading } = useFetch<any>('/evaluations');
  const { data: analyticsData, loading: analyticsLoading } = useFetch<any>('/analytics');

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
          setFeedbackItems(data.comments.map((c: any) => ({
            id: c.id,
            comment: c.content,
            rating: c.rating || 0,
            date: new Date(c.created_at),
            source: c.author_role === 'teacher' ? 'peer' : ['dean', 'admin'].includes(c.author_role) ? 'admin' : 'student',
          })));
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

  const assignedCourses = coursesData?.courses || [];
  const assignedCount = assignedCourses.length;

  // Use received evaluations for stats
  const teacherEvals = receivedEvals;


  // Compute overall rating from received evaluation responses
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

  // Peer evaluations pending by this teacher (only those where user is evaluator)
  const peerPending = evalData?.evaluations?.filter((e: any) => e.evaluation_type === 'peer' && e.status === 'pending').length || 0;

  const deptAvg = analyticsData?.analytics?.departmentTrend?.slice(-1)[0]?.score || 0;

  // Split feedback by source
  const studentFeedback = feedbackItems.filter(f => f.source === 'student');
  const peerFeedback = feedbackItems.filter(f => f.source === 'peer' || f.source === 'admin' || f.source === 'dean');

  const studentFeedbackAvg = studentFeedback.length
    ? studentFeedback.reduce((s, f) => s + f.rating, 0) / studentFeedback.length
    : 0;

  const isLoading = coursesLoading || evalLoading || analyticsLoading || receivedEvalsLoading;



  if (isLoading) return <DashboardSkeleton />;

  // Calculate student satisfaction based on received evaluations
  const studentSatisfactionData = (() => {
    const counts = { very: 0, sat: 0, neutral: 0, unsat: 0 };
    teacherEvals.forEach((e: any) => {
      const ratings = (e.responses || []).map((r: any) => Number(r.rating ?? 0)).filter((v: number) => v > 0);
      const avg = ratings.length ? ratings.reduce((a: number, b: number) => a + b, 0) / ratings.length : 0;
      if (avg >= 4.5) counts.very++;
      else if (avg >= 3.5) counts.sat++;
      else if (avg >= 2.5) counts.neutral++;
      else if (avg > 0) counts.unsat++;
    });
    const total = teacherEvals.filter(e => {
      const resp = e.responses || [];
      return resp.some((r: any) => Number(r.rating ?? 0) > 0);
    }).length;

    if (!total) return [];
    const distribution = [
      { name: 'Very Satisfied', value: Math.round((counts.very / total) * 100) },
      { name: 'Satisfied', value: Math.round((counts.sat / total) * 100) },
      { name: 'Neutral', value: Math.round((counts.neutral / total) * 100) },
      { name: 'Unsatisfied', value: Math.round((counts.unsat / total) * 100) },
    ];
    const sum = distribution.reduce((a, v) => a + v.value, 0);
    const diff = 100 - sum;
    if (distribution.length && diff !== 0 && sum > 0) {
      distribution[distribution.length - 1].value += diff;
    }
    return distribution;
  })();

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white">
            Teaching Dashboard
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Welcome back, {user?.name || 'Teacher'}! Here&apos;s your performance overview
          </p>
        </div>

      </div>



      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {/* Anonymous Student Feedback */}
          <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Student Feedback</CardTitle>
              <CardDescription>Anonymous feedback from your students</CardDescription>
            </div>
            <Badge variant="secondary">{studentFeedback.length} comments</Badge>
          </div>
        </CardHeader>
        <CardContent>
          {studentFeedback.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400 text-center py-6">
              No student feedback received yet. Feedback will appear here once students submit evaluations.
            </p>
          ) : (
            <div className="space-y-4">
              {(showAllStudentFeedback ? studentFeedback : studentFeedback.slice(0, 4)).map((item) => (
                <div key={item.id} className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <span
                          key={star}
                          className={`text-lg ${star <= item.rating ? 'text-yellow-400' : 'text-gray-300 dark:text-gray-600'}`}
                        >
                          ★
                        </span>
                      ))}
                      <span className="text-sm text-gray-500 dark:text-gray-400 ml-2">
                        {item.rating}/5
                      </span>
                    </div>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {item.date.toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-gray-700 dark:text-gray-300 text-sm">{item.comment}</p>
                </div>
              ))}
              {studentFeedback.length > 4 && !showAllStudentFeedback && (
                <button
                  onClick={() => setShowAllStudentFeedback(true)}
                  className="w-full text-sm text-blue-600 dark:text-blue-400 hover:underline text-center pt-2 cursor-pointer"
                >
                  + {studentFeedback.length - 4} more comments
                </button>
              )}
              {showAllStudentFeedback && studentFeedback.length > 4 && (
                <button
                  onClick={() => setShowAllStudentFeedback(false)}
                  className="w-full text-sm text-blue-600 dark:text-blue-400 hover:underline text-center pt-2 cursor-pointer"
                >
                  Show less
                </button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Peer & Admin Feedback */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Peer Feedback</CardTitle>
              <CardDescription>Anonymous feedback from peer and administrator evaluations</CardDescription>
            </div>
            <Badge variant="secondary">{peerFeedback.length} comments</Badge>
          </div>
        </CardHeader>
        <CardContent>
          {peerFeedback.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400 text-center py-6">
              No peer or admin feedback received yet. Feedback will appear here once evaluations are submitted.
            </p>
          ) : (
            <div className="space-y-4">
              {(showAllPeerFeedback ? peerFeedback : peerFeedback.slice(0, 4)).map((item) => (
                <div key={item.id} className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <span
                          key={star}
                          className={`text-lg ${star <= item.rating ? 'text-yellow-400' : 'text-gray-300 dark:text-gray-600'}`}
                        >
                          ★
                        </span>
                      ))}
                      <span className="text-sm text-gray-500 dark:text-gray-400 ml-2">
                        {item.rating}/5
                      </span>
                    </div>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {item.date.toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-gray-700 dark:text-gray-300 text-sm">{item.comment}</p>
                </div>
              ))}
              {peerFeedback.length > 4 && !showAllPeerFeedback && (
                <button
                  onClick={() => setShowAllPeerFeedback(true)}
                  className="w-full text-sm text-blue-600 dark:text-blue-400 hover:underline text-center pt-2 cursor-pointer"
                >
                  + {peerFeedback.length - 4} more comments
                </button>
              )}
              {showAllPeerFeedback && peerFeedback.length > 4 && (
                <button
                  onClick={() => setShowAllPeerFeedback(false)}
                  className="w-full text-sm text-blue-600 dark:text-blue-400 hover:underline text-center pt-2 cursor-pointer"
                >
                  Show less
                </button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
        </div>

        <div className="space-y-4 flex flex-col">
          {/* Quick Actions */}
          <Card className="mb-2 hover:shadow-lg transition-shadow duration-150">
            <CardHeader className="pb-3 border-b border-gray-100 dark:border-gray-800">
              <CardTitle className="text-lg">✨ Quick Links</CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-3">
              <Button 
                variant="primary" 
                className="w-full gap-2 shadow-sm"
                onClick={() => router.push('/teacher/peer')}
              >
                <Users className="w-4 h-4" />
                Peer Evaluation
              </Button>
              <Button 
                variant="outline" 
                className="w-full gap-2 shadow-sm border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
                onClick={() => router.push('/teacher/results')}
              >
                <TrendingUp className="w-4 h-4" />
                View Results
              </Button>
            </CardContent>
          </Card>

          {/* Key Stats Migration */}
          <DashboardCard
            title="Overall Rating"
            value={
              <span>
                <AnimatedCounter endValue={Number.isFinite(evaluationAvg) ? evaluationAvg : 0} decimals={1} suffix="/5" />
              </span>
            }
            footer={`Based on ${teacherEvals.filter(e => (e.responses || []).length > 0).length} responses`}
            icon={<TrendingUp className="w-6 h-6" />}
            color="green"
          />
          <DashboardCard
            title="Classes Teaching"
            value={<AnimatedCounter endValue={assignedCount} />}
            footer="This semester"
            icon={<Users className="w-6 h-6" />}
            color="blue"
          />
          <DashboardCard
            title="Student Feedback"
            value={<AnimatedCounter endValue={Math.round(studentFeedbackAvg * 10) / 10} decimals={1} suffix="/5" />}
            footer={`${feedbackItems.length} comments`}
            icon={<MessageSquare className="w-6 h-6" />}
            color="yellow"
          />
          <DashboardCard
            title="Peer Reviews"
            value={<AnimatedCounter endValue={peerPending} />}
            footer="Pending tasks"
            icon={<Award className="w-6 h-6" />}
            color="red"
          />

          {/* Satisfaction Distribution */}
          {studentSatisfactionData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Student Satisfaction</CardTitle>
                <CardDescription>Distribution based on received evaluation scores</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {studentSatisfactionData.map((item) => (
                    <div key={item.name} className="flex items-center gap-3">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300 w-32">{item.name}</span>
                      <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                        <div
                          className={`h-3 rounded-full ${
                            item.name === 'Very Satisfied' ? 'bg-green-500' :
                            item.name === 'Satisfied' ? 'bg-blue-500' :
                            item.name === 'Neutral' ? 'bg-yellow-500' :
                            'bg-red-500'
                          }`}
                          style={{ width: `${item.value}%` }}
                        />
                      </div>
                      <span className="text-sm font-semibold text-gray-700 dark:text-gray-300 w-12 text-right">{item.value}%</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
