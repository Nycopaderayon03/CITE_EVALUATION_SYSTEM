'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { RatingScale } from '@/components/RatingScale';
import { Textarea } from '@/components/ui/Textarea';
import { Badge } from '@/components/ui/Badge';
import { Alert } from '@/components/ui/Alert';
import { DashboardSkeleton } from '@/components/loading/Skeletons';
import { ArrowLeft, CheckCircle } from 'lucide-react';

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

export default function DeanEvaluationFill() {
  const router = useRouter();
  const params = useParams();
  const evaluationId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [evaluation, setEvaluation] = useState<any>(null);
  const [formData, setFormData] = useState<any>(null);
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        // Fetch the evaluation details
        const evalData = await fetchApi(`/evaluations?id=${evaluationId}`);
        const eval_ = evalData.evaluations?.[0] || evalData.evaluation;
        if (!eval_) throw new Error('Evaluation not found');
        setEvaluation(eval_);

        // Pre-fill ratings and comment if editing a submitted evaluation
        if (eval_.responses && eval_.responses.length > 0) {
          const existingRatings: Record<string, number> = {};
          let existingComment = '';
          for (const r of eval_.responses) {
            if (r.criteria_id) {
              existingRatings[r.criteria_id] = r.rating;
            }
            if (r.comment) {
              existingComment = r.comment;
            }
          }
          setRatings(existingRatings);
          if (existingComment) setComment(existingComment);
        }

        // Determine form_id from evaluation's period
        const periodId = eval_.period_id;
        if (periodId) {
          const periodData = await fetchApi(`/evaluation_periods?id=${periodId}`);
          const period = periodData.periods?.[0] || periodData.period;
          if (period?.form_id) {
            const formRes = await fetchApi(`/forms?id=${period.form_id}`);
            if (formRes.form) {
              setFormData({ ...formRes.form, criteria: formRes.form.criteria || [] });
            }
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load evaluation');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [evaluationId]);

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
    if (!isComplete) {
      setError('Please answer all questions.');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const responses = Object.entries(ratings).map(([qId, rating]) => ({
        criteriaId: qId,
        rating,
        comment: undefined as string | undefined,
      }));

      if (responses.length > 0 && comment) {
        responses[0].comment = comment;
      }

      await fetchApi('/evaluations', {
        method: 'POST',
        body: JSON.stringify({
          evaluationId: Number(evaluationId),
          comment: comment || undefined,
          responses,
        }),
      });

      // Post anonymous comment for evaluatee feedback
      if (comment.trim() && evaluation?.evaluatee_id) {
        const ratingValues = Object.values(ratings);
        const avgRating = ratingValues.length
          ? ratingValues.reduce((a, b) => a + Number(b), 0) / ratingValues.length
          : 0;

        const token = sessionStorage.getItem('auth_token');
        await fetch('/api/comments', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            entity_type: 'evaluation',
            entity_id: evaluation.evaluatee_id,
            content: comment,
            rating: Math.round(avgRating * 2) / 2,
          }),
        }).catch((err) => { console.error('Error:', err); });
      }

      setIsSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submission failed');
      setIsSubmitting(false);
    }
  };

  if (loading) return <DashboardSkeleton />;

  if (isSubmitted) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <CheckCircle className="w-16 h-16 text-green-500 mb-4" />
        <h2 className="text-2xl font-bold mb-2">Evaluation Submitted!</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-6">The dean evaluation has been recorded anonymously.</p>
        <Button onClick={() => router.push('/dean/evaluations')}>Return to Evaluations</Button>
      </div>
    );
  }

  const evaluateeName = evaluation?.evaluatee?.name || evaluation?.evaluatee_name || 'Unknown';
  const courseName = evaluation?.course?.name || evaluation?.course_name;
  const isEditMode = evaluation?.status === 'submitted';

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" onClick={() => router.push('/dean/evaluations')} className="gap-1">
          <ArrowLeft className="w-4 h-4" /> Back
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {isEditMode ? 'Edit Dean Evaluation' : 'Dean Evaluation'}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 text-sm flex items-center gap-2">
            Evaluating: <span className="font-semibold">{evaluateeName}</span>
            {courseName && <Badge variant="secondary">{courseName}</Badge>}
          </p>
        </div>
      </div>

      {error && <Alert variant="error" title="Error">{error}</Alert>}

      <Card>
        <CardHeader>
          <CardTitle>{formData?.name || 'Evaluation Form'}</CardTitle>
          <CardDescription>
            {answeredCount}/{totalQuestions} questions answered
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          {!formData ? (
            <Alert variant="error" title="Form Not Available">
              Could not load the evaluation form.
            </Alert>
          ) : (
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
                <Button variant="outline" onClick={() => router.push('/dean/evaluations')}>Cancel</Button>
                <Button onClick={handleSubmit} disabled={isSubmitting || !isComplete}>
                  {isSubmitting ? 'Submitting...' : isEditMode ? 'Update Evaluation' : 'Submit Evaluation'}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
