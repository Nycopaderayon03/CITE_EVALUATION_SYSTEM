'use client';

import { useState, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { useConfirmModal } from '@/components/ui/ConfirmModal';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Textarea } from '@/components/ui/Textarea';
import { useFetch } from '@/hooks';
import { DashboardCard } from '@/components/DashboardCard';
import { AnimatedCounter } from '@/components/animations/AnimatedCounter';
import { Plus, Edit, Trash2, ChevronDown, ChevronUp, ArrowLeft, FileText, Users, Award } from 'lucide-react';

type Question = {
  id: string;
  text: string;
  type: 'rating' | 'yesno' | 'comment';
  maxScore: number;
};

type CriteriaRow = {
  id: string;
  name: string;
  weight: number;
  maxScore: number;
  questions: Question[];
};

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

const FORM_TYPES = [
  { value: 'student-to-teacher', label: 'Student to Teacher' },
  { value: 'peer-review', label: 'Peer Review' },
];

const generateId = () => {
  if (typeof globalThis !== 'undefined' && typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }

  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

export default function EvaluationFormsPage() {
  const { confirm: showConfirm, modalProps, ConfirmModal } = useConfirmModal();
  // View state
  const [view, setView] = useState<'list' | 'editor'>('list');
  const [editingFormId, setEditingFormId] = useState<number | null>(null);

  // Form editor state
  const [formName, setFormName] = useState('');
  const [formType, setFormType] = useState('student-to-teacher');
  const [formDescription, setFormDescription] = useState('');
  const [criteria, setCriteria] = useState<CriteriaRow[]>([]);
  const [expandedCriteria, setExpandedCriteria] = useState<string | null>(null);

  // Question modal
  const [questionModalOpen, setQuestionModalOpen] = useState(false);
  const [activeCriteriaId, setActiveCriteriaId] = useState<string | null>(null);
  const [questionInput, setQuestionInput] = useState('');

  // Feedback
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Fetch forms
  const { data: formsData, loading } = useFetch<any>('/forms');
  const [formsRefreshKey, setFormsRefreshKey] = useState(0);
  const forms = formsData?.forms || [];

  const totalWeight = useMemo(() => criteria.reduce((sum, c) => sum + c.weight, 0), [criteria]);

  const resetEditor = () => {
    setFormName('');
    setFormType('student-to-teacher');
    setFormDescription('');
    setCriteria([]);
    setEditingFormId(null);
    setError('');
    setSuccess('');
  };

  const openNewForm = () => {
    resetEditor();
    setView('editor');
  };

  const openEditForm = (form: any) => {
    setFormName(form.name);
    setFormType(form.type);
    setFormDescription(form.description || '');
    const sanitizedCriteria = (Array.isArray(form.criteria) ? form.criteria : []).map((c: any) => ({
      ...c,
      questions: Array.isArray(c.questions) ? c.questions : [],
    }));
    setCriteria(sanitizedCriteria);
    setEditingFormId(form.id);
    setError('');
    setSuccess('');
    setView('editor');
  };

  const deleteForm = async (id: number) => {
    showConfirm({
      title: 'Delete Form',
      message: 'Delete this form? This cannot be undone.',
      confirmLabel: 'Delete',
      variant: 'danger',
      onConfirm: async () => {
        try {
          await fetchApi(`/forms?id=${id}`, { method: 'DELETE' });
          window.location.reload();
        } catch (err) {
          setError(`Failed to delete: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
      }
    });
  };

  // Criteria management
  const addCriteria = () => {
    const newCriteria: CriteriaRow = {
      id: generateId(),
      name: '',
      weight: 0,
      maxScore: 5,
      questions: [],
    };

    setCriteria(prev => [...prev, newCriteria]);
    setExpandedCriteria(newCriteria.id);
  };

  const updateCriteria = (id: string, field: keyof CriteriaRow, value: any) => {
    setCriteria(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c));
  };

  const removeCriteria = (id: string) => {
    setCriteria(prev => prev.filter(c => c.id !== id));
    setExpandedCriteria(prev => prev === id ? null : prev);
  };

  // Question management
  const openQuestions = (criteriaId: string) => {
    setActiveCriteriaId(criteriaId);
    setQuestionInput('');
    setQuestionModalOpen(true);
  };

  const addQuestion = () => {
    if (!questionInput.trim() || !activeCriteriaId) return;
    setCriteria(prev => prev.map(c => {
      if (c.id !== activeCriteriaId) return c;
      return {
        ...c,
        questions: [...c.questions, {
          id: generateId(),
          text: questionInput.trim(),
          type: 'rating' as const,
          maxScore: 5,
        }],
      };
    }));
    setQuestionInput('');
  };

  const removeQuestion = (criteriaId: string, questionId: string) => {
    setCriteria(prev => prev.map(c => {
      if (c.id !== criteriaId) return c;
      return { ...c, questions: c.questions.filter(q => q.id !== questionId) };
    }));
  };

  // Save form
  const saveForm = async () => {
    if (!formName.trim()) { setError('Form name is required.'); return; }
    if (!criteria.length) { setError('Add at least one criteria.'); return; }
    if (totalWeight !== 100) { setError('Total weight must equal 100%.'); return; }
    const emptyNames = criteria.filter(c => !c.name.trim());
    if (emptyNames.length) { setError('All criteria must have a name.'); return; }

    setSaving(true);
    setError('');
    try {
      if (editingFormId) {
        await fetchApi('/forms', {
          method: 'PATCH',
          body: JSON.stringify({
            id: editingFormId,
            name: formName,
            type: formType,
            description: formDescription,
            criteria,
          }),
        });
      } else {
        await fetchApi('/forms', {
          method: 'POST',
          body: JSON.stringify({
            name: formName,
            type: formType,
            description: formDescription,
            criteria,
          }),
        });
      }
      setSuccess('Form saved successfully!');
      setTimeout(() => {
        setView('list');
        resetEditor();
        window.location.reload();
      }, 1000);
    } catch (err) {
      setError(`Failed to save: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  };

  const activeCriteria = criteria.find(c => c.id === activeCriteriaId);

  // ── LIST VIEW ──
  if (view === 'list') {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Evaluation Forms</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">Create and manage evaluation forms with criteria and questions.</p>
          </div>
          <Button variant="primary" className="gap-2" onClick={openNewForm}>
            <Plus className="w-4 h-4" /> New Form
          </Button>
        </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3">
          {loading ? (
            <p className="text-center text-gray-500 py-12">Loading forms...</p>
          ) : forms.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-gray-500 dark:text-gray-400 mb-4">No evaluation forms yet.</p>
                <Button variant="primary" onClick={openNewForm}>Create Your First Form</Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {forms.map((form: any) => {
                const criteriaArr = Array.isArray(form.criteria) ? form.criteria : [];
                const criteriaCount = criteriaArr.length;
                const questionCount = criteriaArr.reduce((s: number, c: any) => s + (c.questions?.length || 0), 0);
                return (
                  <Card key={form.id} className="hover:shadow-md transition">
                    <CardContent className="pt-6">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{form.name}</h3>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                            {FORM_TYPES.find(t => t.value === form.type)?.label || form.type}
                            {' '} &middot; {criteriaCount} criteria &middot; {questionCount} questions
                          </p>
                          {form.description && (
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{form.description}</p>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={() => openEditForm(form)} className="gap-1">
                            <Edit className="w-3 h-3" /> Edit
                          </Button>
                          <Button variant="danger" size="sm" onClick={() => deleteForm(form.id)} className="gap-1">
                            <Trash2 className="w-3 h-3" /> Delete
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
        
        <div className="lg:col-span-1 space-y-4 flex flex-col">
          <DashboardCard 
            title="Total Forms Saved" 
            value={<AnimatedCounter endValue={forms.length} />} 
            footer="Templates in directory"
            icon={<FileText className="w-6 h-6" />} 
            color="indigo" 
          />
          <DashboardCard 
            title="Student Evaluations" 
            value={<AnimatedCounter endValue={forms.filter((f: any) => f.type === 'student-to-teacher').length} />} 
            footer="Learner feedback"
            icon={<Users className="w-6 h-6" />} 
            color="blue" 
          />
          <DashboardCard 
            title="Peer Evaluations" 
            value={<AnimatedCounter endValue={forms.filter((f: any) => f.type === 'peer-review').length} />} 
            footer="Faculty reviews"
            icon={<Award className="w-6 h-6" />} 
            color="purple" 
          />
        </div>
      </div>
      <ConfirmModal {...modalProps} />
      </div>
    );
  }

  // ── EDITOR VIEW ──
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 mb-2">
        <Button variant="secondary" size="sm" onClick={() => { setView('list'); resetEditor(); }} className="gap-2 shadow-sm bg-white/80 backdrop-blur hover:bg-white text-gray-800 border-0">
          <ArrowLeft className="w-4 h-4" /> Back
        </Button>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          {editingFormId ? 'Edit Form' : 'New Evaluation Form'}
        </h1>
      </div>

      {error && <Alert variant="error" title="Error">{error}</Alert>}
      {success && <Alert variant="success" title="Success">{success}</Alert>}

      {/* Form Details */}
      <Card>
        <CardHeader>
          <CardTitle>Form Details</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Form Name"
            value={formName}
            onChange={e => setFormName(e.target.value)}
            placeholder="e.g. Teaching Effectiveness Form"
          />
          <Select
            label="Form Type"
            value={formType}
            onChange={e => setFormType(e.target.value)}
            options={FORM_TYPES}
          />
          <div className="md:col-span-2">
            <Textarea
              label="Description (Optional)"
              value={formDescription}
              onChange={e => setFormDescription(e.target.value)}
              placeholder="Brief description of this evaluation form..."
            />
          </div>
        </CardContent>
      </Card>

      {/* Criteria Management */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Evaluation Criteria</CardTitle>
              <CardDescription>Add criteria with weights that total 100%. Expand each to manage questions.</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={addCriteria} className="gap-1">
              <Plus className="w-4 h-4" /> Add Criteria
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {criteria.length === 0 && (
            <p className="text-center text-gray-500 dark:text-gray-400 py-6">No criteria added yet. Click "Add Criteria" to begin.</p>
          )}
          {criteria.map((c, index) => (
            <div key={c.id} className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden bg-gray-50/50 dark:bg-gray-800/30">
              {/* Criteria Header Row */}
              <div className="flex flex-col md:flex-row md:items-center gap-4 p-4 bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700/50">
                <div className="flex items-center gap-3 flex-1">
                  <div className="flex items-center justify-center w-6 h-6 rounded bg-gray-100 dark:bg-gray-700 font-medium text-xs text-gray-500">
                    {index + 1}
                  </div>
                  <input
                    type="text"
                    value={c.name}
                    onChange={e => updateCriteria(c.id, 'name', e.target.value)}
                    placeholder="Enter criteria name (e.g., Professionalism)"
                    className="flex-1 bg-transparent border-0 focus:ring-0 text-base font-medium px-0 text-gray-900 dark:text-white placeholder-gray-400 outline-none"
                  />
                </div>
                
                <div className="flex items-center gap-4 sm:justify-end">
                  <div className="flex items-center bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 transition-all">
                    <span className="text-xs text-gray-500 font-medium mr-2 uppercase tracking-wide">Weight</span>
                    <input
                      type="number"
                      value={c.weight}
                      onChange={e => updateCriteria(c.id, 'weight', Number(e.target.value))}
                      className="w-12 bg-transparent border-0 p-0 text-center font-semibold text-gray-900 dark:text-white focus:ring-0 outline-none"
                      min={0}
                      max={100}
                    />
                    <span className="text-sm font-medium text-gray-500 ml-1">%</span>
                  </div>

                  <div className="flex items-center gap-1 border-l border-gray-200 dark:border-gray-700 pl-4">
                    <Button variant="outline" size="sm" onClick={() => openQuestions(c.id)} className="gap-2 shrink-0">
                      <Badge variant={(c.questions?.length || 0) > 0 ? 'success' : 'secondary'} className="px-1.5 min-w-[1.5rem] flex items-center justify-center">
                        {c.questions?.length || 0}
                      </Badge>
                      Questions
                    </Button>
                    <button
                      onClick={() => setExpandedCriteria(expandedCriteria === c.id ? null : c.id)}
                      className="p-2 text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition"
                      title="Toggle questions preview"
                    >
                      {expandedCriteria === c.id ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </button>
                    <button
                      onClick={() => removeCriteria(c.id)}
                      className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition"
                      title="Delete criteria"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Expanded Preview */}
              {expandedCriteria === c.id && (
                <div className="p-4 sm:px-6">
                  <div className="flex justify-between items-center mb-3">
                    <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Questions under this criteria</h4>
                    <Button variant="ghost" size="sm" onClick={() => openQuestions(c.id)} className="h-8 text-xs text-blue-600">
                      <Plus className="w-3 h-3 mr-1" /> Manage Questions
                    </Button>
                  </div>
                  {c.questions.length > 0 ? (
                    <div className="space-y-2">
                       {c.questions.map((q, qIndex) => (
                         <div key={q.id} className="group flex gap-3 text-sm text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-800 p-2.5 rounded-md border border-gray-100 dark:border-gray-700 hover:border-blue-200 dark:hover:border-blue-800 transition">
                           <span className="font-medium text-gray-400">{qIndex + 1}.</span>
                           <span className="flex-1">{q.text}</span>
                           <button onClick={() => removeQuestion(c.id, q.id)} className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700">
                             <Trash2 className="w-4 h-4"/>
                           </button>
                         </div>
                       ))}
                    </div>
                  ) : (
                    <div className="text-center py-4 bg-white dark:bg-gray-800 rounded border border-dashed border-gray-300 dark:border-gray-700">
                      <p className="text-sm text-gray-500">No questions added yet.</p>
                      <Button variant="ghost" size="sm" onClick={() => openQuestions(c.id)} className="mt-2 text-blue-600">
                        Add Questions
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}

          {/* Weight total */}
          {criteria.length > 0 && (
            <div className="flex items-center gap-3 pt-2">
              <span className="font-semibold">Total Weight:</span>
              <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                totalWeight === 100
                  ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                  : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
              }`}>
                {totalWeight}% {totalWeight === 100 ? '✓' : '— Must equal 100%'}
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Save button */}
      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={() => { setView('list'); resetEditor(); }}>Cancel</Button>
        <Button variant="primary" onClick={saveForm} disabled={saving} isLoading={saving}>
          {editingFormId ? 'Update Form' : 'Create Form'}
        </Button>
      </div>

      {/* Question Modal */}
      <Modal
        isOpen={questionModalOpen}
        onClose={() => setQuestionModalOpen(false)}
        title={activeCriteria ? `Questions for "${activeCriteria.name || 'Untitled Criteria'}"` : 'Manage Questions'}
        size="2xl"
      >
        <div className="space-y-6">
          <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Add New Question
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                placeholder="e.g., The instructor explains concepts clearly..."
                value={questionInput}
                onChange={e => setQuestionInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') addQuestion(); }}
                autoFocus
              />
              <Button variant="primary" onClick={addQuestion} className="px-6">Add</Button>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
              Current Questions
              <Badge variant="secondary">{activeCriteria?.questions.length || 0}</Badge>
            </h4>
            
            {activeCriteria && activeCriteria.questions.length > 0 ? (
              <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-2">
                {activeCriteria.questions.map((q, idx) => (
                  <div key={q.id} className="group flex items-start gap-3 p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm hover:border-blue-300 dark:hover:border-blue-700 transition">
                    <div className="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-xs font-bold mt-0.5">
                      {idx + 1}
                    </div>
                    <span className="flex-1 text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{q.text}</span>
                    <button
                      onClick={() => removeQuestion(activeCriteria.id, q.id)}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition opacity-0 group-hover:opacity-100"
                      title="Delete question"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 px-4 bg-gray-50 dark:bg-gray-800/30 border border-dashed border-gray-300 dark:border-gray-700 rounded-lg">
                <p className="text-gray-500 dark:text-gray-400 text-sm">No questions added yet. Type a question above and click "Add".</p>
              </div>
            )}
          </div>

          <div className="flex justify-end pt-2 border-t border-gray-200 dark:border-gray-700 mt-6 pt-4">
            <Button variant="primary" onClick={() => setQuestionModalOpen(false)}>Done</Button>
          </div>
        </div>
      </Modal>
      <ConfirmModal {...modalProps} />
    </div>
  );
}
