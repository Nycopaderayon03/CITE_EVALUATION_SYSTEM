'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { RatingScale } from '@/components/RatingScale';
import { Textarea } from '@/components/ui/Textarea';
import { Badge } from '@/components/ui/Badge';
import { Checkbox } from '@/components/ui/Checkbox';
import { Alert } from '@/components/ui/Alert';
import { useFetch } from '@/hooks';
import { CheckCircle, Clock, MessageSquare } from 'lucide-react';
import { DashboardSkeleton } from '@/components/loading/Skeletons';

interface PeerEvaluation {
  id: string;
  evaluateeId: string;
  peerName: string;
  peerDepartment: string;
  dueDate: string;
  status: 'pending' | 'completed' | 'locked';
  completedDate?: string;
  responses?: any[];
  comment?: string;
  formId?: string;
}

interface FormCriteria {
  id: string;
  name: string;
  weight: number;
  questions: { id: string; text: string }[];
}

export default function PeerEvaluation() {
  const [selectedPeer, setSelectedPeer] = useState<string | null>(null);
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [comment, setComment] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { data: evalData, loading: evalLoading } = useFetch<any>('/evaluations?history=true');
  const { data: periodData, loading: periodLoading } = useFetch<any>('/evaluation_periods?status=active');
  const [evaluationList, setEvaluationList] = useState<PeerEvaluation[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showReceived, setShowReceived] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [historyFormCache, setHistoryFormCache] = useState<Record<string, any>>({});
  
  const { data: receivedData, loading: receivedLoading } = useFetch<any>('/evaluations?role=evaluatee&type=peer');
  const receivedEvals = receivedData?.evaluations || [];

  const toggleDetails = async (peer: PeerEvaluation) => {
    if (expandedId === peer.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(peer.id);
    if (peer.formId && !historyFormCache[peer.formId]) {
      try {
        const token = sessionStorage.getItem('auth_token');
        const res = await fetch(`/api/forms?id=${peer.formId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (data.form && data.form.criteria) {
           const payload = Array.isArray(data.form.criteria) 
                ? data.form.criteria 
                : typeof data.form.criteria === 'string' ? JSON.parse(data.form.criteria) : [];
           setHistoryFormCache(prev => ({ ...prev, [peer.formId!]: payload }));
        }
      } catch (err) { console.error(err); }
    }
  };

  // Find the active peer-review period and fetch its form
  const [formData, setFormData] = useState<any>(null);
  const [formLoading, setFormLoading] = useState(false);

  const peerPeriod = useMemo(() => {
    if (!periodData?.periods) return null;
    return periodData.periods.find((p: any) => p.form_type === 'peer-review') || null;
  }, [periodData]);

  useEffect(() => {
    if (peerPeriod?.form_id) {
      setFormLoading(true);
      const token = sessionStorage.getItem('auth_token');
      fetch(`/api/forms?id=${peerPeriod.form_id}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then(res => res.json())
        .then(data => {
          if (data.success && data.form) {
            setFormData({ ...data.form, criteria: data.form.criteria || [] });
          }
        })
        .catch(err => console.error('Failed to load peer form', err))
        .finally(() => setFormLoading(false));
    }
  }, [peerPeriod]);

  const formCriteria: FormCriteria[] = formData?.criteria || [];
  const allQuestions = useMemo(() => {
    return formCriteria.flatMap(c => (c.questions || []).map(q => ({ ...q, criteriaName: c.name })));
  }, [formCriteria]);
  const totalQuestions = allQuestions.length;

  const selectedPeerData = evaluationList.find(p => p.id === selectedPeer);

  useEffect(() => {
    if (evalData?.evaluations) {
      const peers = evalData.evaluations
        .filter((e: any) => e.evaluation_type === 'peer')
        .map((e: any) => ({
          id: e.id,
          evaluateeId: e.evaluatee_id,
          peerName: e.evaluatee?.name || e.evaluatee_name || 'Unknown',
          peerDepartment: e.evaluatee_department || '',
          dueDate: e.created_at,
          status: e.status === 'submitted' ? 'completed' : e.status === 'locked' ? 'locked' : 'pending',
          completedDate: e.submitted_at,
          responses: e.responses || [],
          comment: e.comments || '',
          formId: e.period?.form_id,
        }));
      setEvaluationList(peers);
    }
  }, [evalData]);

  const handleSubmit = async () => {
    if (!selectedPeer) return;

    const token = typeof window !== 'undefined' ? sessionStorage.getItem('auth_token') : null;
    try {
      const res = await fetch('/api/evaluations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token || ''}`,
        },
        body: JSON.stringify({
          evaluationId: selectedPeer,
          comment: comment || undefined,
          responses: Object.entries(ratings).map(([criteriaId, rating]) => ({
            criteriaId,
            rating,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit');

      // Post anonymous comment for the evaluatee's feedback dashboard
      if (comment.trim() && selectedPeerData?.evaluateeId) {
        const ratingValues = Object.values(ratings);
        const avgRating = ratingValues.length
          ? ratingValues.reduce((a, b) => a + Number(b), 0) / ratingValues.length
          : 0;

        await fetch('/api/comments', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token || ''}`,
          },
          body: JSON.stringify({
            entity_type: 'evaluation',
            entity_id: selectedPeerData.evaluateeId,
            content: comment,
            rating: Math.round(avgRating * 2) / 2,
          }),
        }).catch((err) => { console.error('Error:', err); });
      }

      // update local state to reflect submission
      const updatedList = evaluationList.map(p => {
        if (p.id === selectedPeer) {
          return {
            ...p,
            status: 'completed' as const,
            completedDate: new Date().toISOString().split('T')[0],
            comment,
          };
        }
        return p;
      });
      setEvaluationList(updatedList);
      setSubmitted(true);
      setError(null);
      setTimeout(() => {
        setSelectedPeer(null);
        setRatings({});
        setComment('');
        setSubmitted(false);
      }, 2000);
    } catch (err) {
      setError(`Error submitting evaluation: ${err instanceof Error ? err.message : String(err)}`);
    }
  };


  if (evalLoading || periodLoading || formLoading) return <DashboardSkeleton />;

  const pendingCount = evaluationList.filter(p => p.status === 'pending').length;
  const completed = evaluationList.filter(p => p.status === 'completed' || p.status === 'locked').length;



  // Check if all questions are answered
  const answeredCount = Object.keys(ratings).length;
  const isFormComplete = totalQuestions > 0
    ? answeredCount >= totalQuestions
    : answeredCount >= 1; // fallback: at least 1 rating if no form loaded

  if (!showHistory && pendingCount === 0) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">No peer evaluations pending</h2>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              You have completed all assigned peer reviews.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            {completed > 0 && (
              <Button variant="primary" size="lg" onClick={() => setShowHistory(true)} className="gap-2 shadow-md px-6 py-3">
                <CheckCircle className="w-5 h-5" />
                View Submissions
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (showHistory) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Peer Evaluation History</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              Review your completed peer evaluations
            </p>
          </div>
          <Button variant="primary" onClick={() => setShowHistory(false)}>
            Back to Evaluations
          </Button>
        </div>

        {evaluationList
          .filter(p => p.status === 'completed' || p.status === 'locked')
          .map((peer) => {
            const isLocked = peer.status === 'locked';
            const isExpanded = expandedId === peer.id;
            const criteriaList = peer.formId ? historyFormCache[peer.formId] : null;

            const ratings = (peer.responses || []).map((r: any) => Number(r.rating ?? 0)).filter((v: number) => v > 0);
            const avg = ratings.length ? (ratings.reduce((a: number, b: number) => a + b, 0) / ratings.length).toFixed(1) : '—';
            return (
              <Card key={peer.id} className={isLocked ? "opacity-75 bg-gray-50 dark:bg-gray-800/50" : ""}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle>{peer.peerName}</CardTitle>
                      <CardDescription>
                        {peer.peerDepartment} 
                        {!isLocked && peer.completedDate ? ` • Completed ${new Date(peer.completedDate).toLocaleDateString()}` : ''}
                        {isLocked ? ' • Locked by Administrator' : ''}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                       {!isLocked && <span className="text-lg font-bold text-blue-600">{avg}/5</span>}
                      <Badge variant={isLocked ? 'secondary' : 'success'}>
                        {isLocked ? 'Locked' : 'Completed'}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {peer.comment && (
                    <div>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Comments</p>
                      <p className="text-gray-700 dark:text-gray-300 p-3 bg-gray-50 dark:bg-gray-800 rounded">
                        {peer.comment}
                      </p>
                    </div>
                  )}

                  {!isLocked && (peer.responses || []).length > 0 && (
                    <div>
                      <Button variant="outline" size="sm" onClick={() => toggleDetails(peer)}>
                        {isExpanded ? 'Hide Ratings' : 'View Ratings'}
                      </Button>
                      
                      {isExpanded && (
                        <div className="pt-4 mt-4 border-t border-gray-200 dark:border-gray-700 space-y-3">
                          {(peer.responses || []).map((resp: any, idx: number) => {
                            let qText = resp.criteriaName || resp.criteria_id || 'Criterion';
                            if (criteriaList) {
                              for (const c of criteriaList) {
                                const q = (c.questions || []).find((queryQ: any) => String(queryQ.id) === String(resp.criteria_id));
                                if (q) {
                                  qText = q.text; break;
                                }
                              }
                            }
                            return (
                              <div key={idx} className="flex justify-between items-start gap-4">
                                <span className="text-gray-600 dark:text-gray-300 text-sm">{qText}</span>
                                <span className="font-semibold text-gray-900 dark:text-white whitespace-nowrap">{resp.rating || resp.score}/5</span>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}

        {evaluationList.filter(p => p.status === 'completed' || p.status === 'locked').length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-gray-600 dark:text-gray-400">No completed evaluations yet</p>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  if (showReceived) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Received Peer Reviews</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              View anonymous feedback and ratings given to you by your colleagues
            </p>
          </div>
          <Button variant="primary" onClick={() => setShowReceived(false)}>
            Back to Evaluations
          </Button>
        </div>

        {receivedLoading ? <DashboardSkeleton /> : receivedEvals
          .filter((e: any) => e.status === 'submitted' || e.status === 'locked')
          .map((peerEval: any, index: number) => {
            const ratings = (peerEval.responses || []).map((r: any) => Number(r.rating ?? 0)).filter((v: number) => v > 0);
            const avg = ratings.length ? (ratings.reduce((a: number, b: number) => a + b, 0) / ratings.length).toFixed(1) : '—';
            
            return (
              <Card key={peerEval.id || index}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle>Anonymous Peer Review</CardTitle>
                      <CardDescription>
                        {peerEval.submitted_at ? `Received on ${new Date(peerEval.submitted_at).toLocaleDateString()}` : ''}
                      </CardDescription>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-500 mr-2">Average Score</p>
                      <span className="text-2xl font-bold text-blue-600">{avg}/5</span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {peerEval.comments && (
                    <div>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Overall Feedback</p>
                      <p className="text-gray-700 dark:text-gray-300 p-3 bg-gray-50 dark:bg-gray-800 rounded italic">
                        "{peerEval.comments}"
                      </p>
                    </div>
                  )}

                  {(peerEval.responses || []).length > 0 && (
                    <div className="pt-4 mt-2 border-t border-gray-200 dark:border-gray-700 space-y-3">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Rating Breakdown</p>
                      {(peerEval.responses || []).map((resp: any, idx: number) => (
                        <div key={idx} className="flex justify-between items-start gap-4">
                          <span className="text-gray-600 dark:text-gray-300 text-sm">{resp.criteria_name || 'Criterion'}</span>
                          <span className="font-semibold text-gray-900 dark:text-white whitespace-nowrap">{resp.rating}/5</span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}

        {!receivedLoading && receivedEvals.filter((e: any) => e.status === 'submitted' || e.status === 'locked').length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-gray-600 dark:text-gray-400">You have no received peer reviews yet.</p>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Peer Evaluation</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Evaluate your colleagues&apos; teaching effectiveness
          </p>
        </div>
        <div className="flex gap-2">
          {completed > 0 && (
            <Button variant="primary" size="lg" onClick={() => setShowHistory(true)} className="gap-2 shadow-md px-6 py-3">
              <CheckCircle className="w-5 h-5" />
              View Submissions
            </Button>
          )}
        </div>
      </div>
      
      {error && (
        <Alert variant="error" title="Submission Error">
          {error}
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          {!selectedPeer ? (
        <>
          {/* Pending Evaluations */}
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">Pending Evaluations</h2>
            <div className="space-y-3">
              {evaluationList
                .filter(p => p.status === 'pending')
                .map((peer) => (
                  <Card key={peer.id} className="hover:shadow-lg transition">
                    <CardContent className="pt-6">
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="font-semibold text-gray-900 dark:text-white">{peer.peerName}</p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">{peer.peerDepartment}</p>
                        </div>
                        <Button
                          variant="primary"
                          onClick={() => setSelectedPeer(peer.id)}
                        >
                          Evaluate
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
            </div>
          </div>

          {/* Completed Evaluations */}
          {completed > 0 && (
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">History</h2>
              <div className="space-y-3">
                {evaluationList
                  .filter(p => p.status === 'completed' || p.status === 'locked')
                  .map((peer) => (
                    <Card key={peer.id} className="opacity-75">
                      <CardContent className="pt-6">
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="font-semibold text-gray-900 dark:text-white">{peer.peerName}</p>
                            <p className="text-sm text-gray-600 dark:text-gray-400">{peer.peerDepartment}</p>
                            <p className="text-xs text-gray-500 mt-1">
                              {peer.status === 'locked' ? 'Locked by Admin' : `Completed: ${peer.completedDate ? new Date(peer.completedDate).toLocaleDateString() : ''}`}
                            </p>
                          </div>
                          <Badge variant={peer.status === 'locked' ? 'secondary' : 'success'}>
                            {peer.status === 'locked' ? 'Locked' : 'Submitted'}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          {submitted ? (
            <Card>
              <CardContent className="pt-6 text-center py-12">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full mb-4">
                  <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Evaluation Submitted</h2>
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                  Your feedback for {selectedPeerData?.peerName} has been recorded successfully.
                </p>
                <Button variant="primary" onClick={() => setSelectedPeer(null)}>
                  Evaluate Another Colleague
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle>
                      Evaluate {selectedPeerData?.peerName}
                    </CardTitle>
                    <CardDescription>
                      {selectedPeerData?.peerDepartment ? `Department: ${selectedPeerData.peerDepartment} • ` : ''}
                      {answeredCount}/{totalQuestions || '?'} questions answered
                    </CardDescription>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setSelectedPeer(null)}>
                    Cancel
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Dynamic criteria from form */}
                {formCriteria.length > 0 ? (
                  formCriteria.map((criteria) => (
                    <div key={criteria.id} className="space-y-4">
                      <h3 className="text-lg font-semibold border-b pb-2">{criteria.name}</h3>
                      {(criteria.questions || []).map((q) => (
                        <div key={q.id} className="space-y-2">
                          <p className="font-medium text-sm">{q.text}</p>
                          <RatingScale
                            value={ratings[q.id] || 0}
                            onChange={(v) => setRatings(prev => ({ ...prev, [q.id]: v }))}
                            maxScore={5}
                          />
                        </div>
                      ))}
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-gray-500">No evaluation form is configured for peer review. Please contact the dean.</p>
                )}

                <div>
                  <Textarea
                    label="(Anonymous Feedback) *"
                    placeholder="Provide constructive feedback or suggestions to improve teaching performance."
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    required
                    minLength={10}
                  />
                  <p className="text-xs text-gray-500 mt-1">Minimum 10 characters required (currently {comment.length} / 10)</p>
                </div>

                <Checkbox label="I confirm this evaluation is honest, fair, and confidential" required />

                <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <Button variant="outline" onClick={() => setSelectedPeer(null)}>
                    Back
                  </Button>
                  <Button
                    variant="primary"
                    onClick={handleSubmit}
                    disabled={!isFormComplete || comment.trim().length < 10}
                  >
                    Submit Evaluation
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </>
          )}
        </div>

        <div className="space-y-4 flex flex-col">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <Clock className="w-8 h-8 mx-auto text-orange-600 mb-2" />
                <p className="text-gray-600 dark:text-gray-400 text-sm mb-1">Pending</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white">{pendingCount}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <CheckCircle className="w-8 h-8 mx-auto text-green-600 mb-2" />
                <p className="text-gray-600 dark:text-gray-400 text-sm mb-1">Completed</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white">{completed}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
