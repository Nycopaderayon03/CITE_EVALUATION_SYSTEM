'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { RatingScale } from '@/components/RatingScale';
import { Textarea } from '@/components/ui/Textarea';
import { FormStepper } from '@/components/FormStepper';
import { Badge } from '@/components/ui/Badge';
import { Checkbox } from '@/components/ui/Checkbox';
import { DashboardSkeleton } from '@/components/loading/Skeletons';
import { useFetch } from '@/hooks';
import { Alert } from '@/components/ui/Alert';
import { CheckCircle, AlertCircle } from 'lucide-react';

interface Evaluation {
  id: string;
  course_id: string;
  period_id: number;
  evaluatee_id: string;
  course: { name: string; code: string };
  evaluatee: { name: string };
  period: { id: number; name: string; academic_year: string; semester: string; form_id: string };
  status: 'draft' | 'submitted' | 'locked';
}

interface Question {
  id: string;
  text: string;
  type: string;
  maxScore: number;
}

interface Criteria {
  id: string;
  name: string;
  weight: number;
  questions: Question[];
}

const steps = [
  { id: 1, title: 'Select Evaluation', description: 'Choose pending evaluation' },
  { id: 2, title: 'Rate Criteria', description: 'Provide ratings and feedback' },
  { id: 3, title: 'Review', description: 'Review and submit' },
];

export default function StudentEvaluations() {
  const router = useRouter();

  // 1. Fetch pending evaluations assigned to this student (type=teacher only)
  const { data: evaluationsData, loading: evalsLoading } = useFetch<any>('/evaluations?type=teacher');

  // 2. Fetch active periods
  const { data: periodData, loading: periodLoading } = useFetch<any>('/evaluation_periods?status=active');

  // 3. State for the form (fetched dynamically per selected evaluation)
  const [formData, setFormData] = useState<any>(null);
  const [formLoading, setFormLoading] = useState(false);

  const [currentStep, setCurrentStep] = useState(0);
  const [selectedEvaluation, setSelectedEvaluation] = useState<Evaluation | null>(null);
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [comment, setComment] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Fetch all periods (not just active) so we can show closed ones as disabled
  const { data: allPeriodData } = useFetch<any>('/evaluation_periods');

  // Filter periods to student-to-teacher only
  const studentPeriods = useMemo(() => {
    if (!periodData?.periods) return [];
    return periodData.periods.filter((p: any) => p.form_type === 'student-to-teacher');
  }, [periodData]);

  // All pending evaluations
  const pendingEvaluations = useMemo(() => {
    if (!evaluationsData?.evaluations) return [];
    return evaluationsData.evaluations.filter((e: Evaluation) => e.status !== 'submitted' && e.status !== 'locked');
  }, [evaluationsData]);

  // Group pending evaluations by period
  const evaluationsByPeriod = useMemo(() => {
    const groups: Record<number, { period: any; evaluations: Evaluation[] }> = {};
    for (const ev of pendingEvaluations) {
      const pid = ev.period_id || ev.period?.id;
      if (!pid) continue;
      if (!groups[pid]) {
        // Try to find the period info from the evaluation itself or from studentPeriods
        const periodInfo = ev.period || studentPeriods.find((p: any) => p.id === pid);
        groups[pid] = {
          period: periodInfo || { id: pid, name: `Period ${pid}` },
          evaluations: [],
        };
      }
      groups[pid].evaluations.push(ev);
    }
    return groups;
  }, [pendingEvaluations, studentPeriods]);

  // Fetch the form dynamically when an evaluation is selected
  const fetchFormForEvaluation = (evaluation: Evaluation) => {
    const formId = evaluation.period?.form_id;
    if (!formId) {
      // Fallback: try to get form_id from matching period
      const matchingPeriod = studentPeriods.find((p: any) => p.id === evaluation.period_id);
      if (matchingPeriod?.form_id) {
        loadForm(matchingPeriod.form_id);
        return;
      }
      console.error('No form_id found for this evaluation');
      return;
    }
    loadForm(formId);
  };

  const loadForm = (formId: string) => {
    setFormLoading(true);
    setFormData(null);
    const token = sessionStorage.getItem('auth_token');
    fetch(`/api/forms?id=${formId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(res => res.json())
      .then(data => {
        if (data.success && data.form) {
          setFormData({ ...data.form, criteria: data.form.criteria || [] });
        }
      })
      .catch(err => console.error('Failed to load form', err))
      .finally(() => setFormLoading(false));
  };

  const handleStepChange = (step: number) => {
    if (step < currentStep || currentStep === 0 || (currentStep === 1 && selectedEvaluation)) {
      setCurrentStep(step);
    }
  };

  const handleEvaluationSelect = (evaluation: Evaluation) => {
    setSelectedEvaluation(evaluation);
    setRatings({});
    setComment('');
    setError('');
    fetchFormForEvaluation(evaluation);
    setCurrentStep(1);
  };

  // Calculate if all questions are answered
  const totalQuestions = useMemo(() => {
    if (!formData?.criteria) return 0;
    return formData.criteria.reduce((sum: number, c: Criteria) => sum + (c.questions?.length || 0), 0);
  }, [formData]);

  const answeredCount = Object.keys(ratings).length;
  const isComplete = totalQuestions > 0 && answeredCount === totalQuestions;

  const handleRatingChange = (questionId: string, value: number) => {
    setRatings(prev => ({ ...prev, [questionId]: value }));
  };

  const handleSubmit = async () => {
    if (!selectedEvaluation) return;
    if (!isComplete) {
      setError('Please answer all questions.');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const token = sessionStorage.getItem('auth_token');

      const responses = Object.entries(ratings).map(([qId, rating]) => ({
        criteriaId: qId,
        rating,
        comment: undefined as string | undefined,
      }));

      if (responses.length > 0 && comment) {
        responses[0].comment = comment;
      }

      const res = await fetch('/api/evaluations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          evaluationId: selectedEvaluation.id,
          comment: comment || undefined,
          responses,
        }),
      });

      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Submission failed');

      // Post anonymous comment for the evaluatee's feedback dashboard
      if (comment.trim() && selectedEvaluation.evaluatee_id) {
        const ratingValues = Object.values(ratings);
        const avgRating = ratingValues.length
          ? ratingValues.reduce((a, b) => a + Number(b), 0) / ratingValues.length
          : 0;

        await fetch('/api/comments', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ` + token,
          },
          body: JSON.stringify({
            entity_type: 'evaluation',
            entity_id: selectedEvaluation.evaluatee_id,
            content: comment,
            rating: Math.round(avgRating * 2) / 2,
          }),
        }).catch((err) => { console.error('Error:', err); });
      }

      setIsSubmitted(true);
      setTimeout(() => {
        router.push('/student/dashboard');
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submission failed');
      setIsSubmitting(false);
    }
  };

  if (evalsLoading || periodLoading) return <DashboardSkeleton />;

  if (isSubmitted) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <CheckCircle className="w-16 h-16 text-green-500 mb-4" />
        <h2 className="text-2xl font-bold mb-2">Evaluation Submitted!</h2>
        <p className="text-gray-600 mb-6">Thank you for your feedback.</p>
        <Button onClick={() => router.push('/student/dashboard')}>Return to Dashboard</Button>
      </div>
    );
  }

  if (studentPeriods.length === 0) {
    return (
      <Alert variant="info" title="No Active Evaluations">
        There are no active student-to-teacher evaluation periods at this time.
      </Alert>
    );
  }

  const periodIds = Object.keys(evaluationsByPeriod);
  const hasPendingEvaluations = periodIds.length > 0;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold">Teacher Evaluations</h1>
        <p className="text-gray-600 mt-2">
          {studentPeriods.length === 1
            ? <><strong>{studentPeriods[0].name}</strong> is currently active. Please complete your evaluations below.</>
            : <>{studentPeriods.length} evaluation periods are currently active. Please complete your evaluations below.</>}
        </p>
      </div>

      {!hasPendingEvaluations && (
        <Alert variant="success" title="All Done!">
          You have completed all your pending evaluations. Great job!
        </Alert>
      )}

      {hasPendingEvaluations && (
        <Card>
          <CardHeader>
            <CardTitle>Evaluation Form</CardTitle>
            <CardDescription>
              {selectedEvaluation ? `Evaluating: ${selectedEvaluation.evaluatee?.name}` : 'Select a subject to evaluate'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <FormStepper
              steps={steps}
              currentStep={currentStep}
              onStepChange={handleStepChange}
              canChangeStep={(step) => step < currentStep || (step === 1 && !!selectedEvaluation)}
            />

            {error && <Alert variant="error" title="Error">{error}</Alert>}

            {/* Step 0: Select Evaluation - grouped by period */}
            {currentStep === 0 && (
              <div className="space-y-6">
                {periodIds.map((pid) => {
                  const group = evaluationsByPeriod[Number(pid)];
                  const periodName = group.period?.name || `Period ${pid}`;
                  const periodLabel = group.period?.academic_year && group.period?.semester
                    ? `${periodName} (${group.period.academic_year} ${group.period.semester})`
                    : periodName;
                  const isClosed = group.period?.status === 'closed';

                  return (
                    <div key={pid}>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                        {periodLabel}
                        <Badge variant={isClosed ? 'destructive' : 'success'}>{isClosed ? 'Closed' : 'Active'}</Badge>
                      </h3>
                      {isClosed && (
                        <p className="text-sm text-red-600 dark:text-red-400 mb-3">
                          This evaluation period is closed. Submissions are no longer accepted.
                        </p>
                      )}
                      <div className="grid gap-3">
                        {group.evaluations.map((ev: Evaluation) => (
                          <button
                            key={ev.id}
                            onClick={() => !isClosed && handleEvaluationSelect(ev)}
                            disabled={isClosed}
                            className={`flex items-center justify-between p-4 border rounded-lg text-left transition-colors ${
                              isClosed
                                ? 'opacity-50 cursor-not-allowed bg-gray-100 dark:bg-gray-900'
                                : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                            }`}
                          >
                            <div>
                              <h4 className="font-semibold text-lg">{ev.evaluatee?.name}</h4>
                              <p className="text-sm text-gray-600 dark:text-gray-400">{ev.course?.name} ({ev.course?.code})</p>
                            </div>
                            <Badge variant={isClosed ? 'destructive' : 'outline'}>{isClosed ? 'Closed' : 'Pending'}</Badge>
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Step 1: Rate Criteria */}
            {currentStep === 1 && (
              <div className="space-y-8">
                {formLoading ? (
                  <p className="text-center text-gray-500 py-8">Loading evaluation form...</p>
                ) : formData ? (
                  <>
                    {formData.criteria.map((criteria: Criteria) => (
                      <div key={criteria.id} className="space-y-4">
                        <h3 className="text-xl font-semibold border-b pb-2">{criteria.name}</h3>
                        <div className="space-y-6">
                          {criteria.questions.map((q: Question) => (
                            <div key={q.id} className="space-y-2">
                              <p className="font-medium">{q.text}</p>
                              <RatingScale
                                value={ratings[q.id] || 0}
                                onChange={(val) => handleRatingChange(q.id, val)}
                                maxScore={5}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}

                    <div className="pt-6 border-t">
                      <Textarea
                        label="Anonymous Feedback (Optional)"
                        placeholder="Share any additional comments..."
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                      />
                    </div>

                    <div className="flex justify-end gap-3">
                      <Button variant="outline" onClick={() => { setCurrentStep(0); setFormData(null); setSelectedEvaluation(null); }}>Cancel</Button>
                      <Button onClick={() => setCurrentStep(2)} disabled={!isComplete}>Review Answers</Button>
                    </div>
                  </>
                ) : (
                  <Alert variant="error" title="Form Not Available">
                    Could not load the evaluation form. Please try again or contact your dean.
                  </Alert>
                )}
              </div>
            )}

            {/* Step 2: Review */}
            {currentStep === 2 && (
              <div className="space-y-6">
                <Alert variant="info" title="Confirm Submission">
                  Your feedback is anonymous. Please review your ratings before submitting.
                </Alert>

                <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                  <div className="flex justify-between">
                    <span className="font-semibold">Questions Answered:</span>
                    <span>{answeredCount} / {totalQuestions}</span>
                  </div>
                  {comment && (
                    <div className="mt-4 pt-4 border-t">
                      <span className="font-semibold block mb-1">Your Comment:</span>
                      <p className="italic text-gray-700">"{comment}"</p>
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-3">
                  <Button variant="outline" onClick={() => setCurrentStep(1)}>Back</Button>
                  <Button onClick={handleSubmit} disabled={isSubmitting}>
                    {isSubmitting ? 'Submitting...' : 'Submit Evaluation'}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
