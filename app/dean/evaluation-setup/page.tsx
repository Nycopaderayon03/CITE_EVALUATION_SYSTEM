'use client';

import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/Card';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { DashboardSkeleton } from '@/components/loading/Skeletons';
import { ConfirmPasswordModal } from '@/components/ui/ConfirmPasswordModal';
import { useFetch } from '@/hooks';
import {
  Save,
  Play,
  Trash2,
  FileText,
  RefreshCw,
  ArrowLeft,
  Eye,
  Plus,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import Link from 'next/link';

type SubjectAssignment = {
  code: string;
  name: string;
  instructorId: string;
};

type AssignmentGroup = {
  id: string;
  program: CurriculumProgram | '';
  yearLevel: string;
  defaultSection: string;
  assignments: Record<string, string>;
  sectionAssignments: Record<string, string>;
  selectedCodes: string[];
  collapsed: boolean;
};

const createGroupId = () => Math.random().toString(36).slice(2, 11) + Date.now().toString(36);

const createEmptyGroup = (): AssignmentGroup => ({
  id: createGroupId(),
  program: '',
  yearLevel: '',
  defaultSection: 'A',
  assignments: {},
  sectionAssignments: {},
  selectedCodes: [],
  collapsed: false,
});

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

const formatShortDate = (dateStr: string) => {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const formTypeLabel: Record<string, string> = {
  'student-to-teacher': 'Student to Teacher',
  'peer-review': 'Peer Review',
};

type CurriculumProgram = 'BSIT' | 'BSEMC';

function getSubjectsForGroup(curriculum: any, program: string, yearLevel: string, semester: string) {
  if (!program || !yearLevel || !semester || !curriculum) return [];
  const programData = (curriculum as any)[program];
  if (!programData) return [];
  const yearData = programData[yearLevel];
  if (!yearData) return [];
  return yearData[semester] || [];
}

export default function EvaluationSetupPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editPeriodId = searchParams.get('periodId');

  // ── Section 1: Evaluation Details & Form Selection ──
  const [selectedAcademicPeriodId, setSelectedAcademicPeriodId] = useState('');
  const [namePrefix, setNamePrefix] = useState('');
  const [evalStartDate, setEvalStartDate] = useState('');
  const [evalEndDate, setEvalEndDate] = useState('');
  const [dateWarning, setDateWarning] = useState('');
  const [selectedFormId, setSelectedFormId] = useState('');

  // ── Section 2: Multi-group assignment state ──
  const [groups, setGroups] = useState<AssignmentGroup[]>([createEmptyGroup()]);

  // ── Section 3: Save & Start ──
  const [status, setStatus] = useState('draft');
  const [saving, setSaving] = useState(false);
  const [starting, setStarting] = useState(false);
  const [savedPeriodId, setSavedPeriodId] = useState<number | null>(null);

  // ── Per-section feedback ──
  type FeedbackEntry = { type: 'success' | 'error'; message: string };
  const [sectionFeedback, setSectionFeedback] = useState<Record<string, FeedbackEntry | null>>({});
  const section1Ref = useRef<HTMLDivElement>(null);
  const section2Ref = useRef<HTMLDivElement>(null);
  const section3Ref = useRef<HTMLDivElement>(null);

  const showFeedback = (section: string, entry: FeedbackEntry) => {
    setSectionFeedback(prev => ({ ...prev, [section]: entry }));
    const refMap: Record<string, React.RefObject<HTMLDivElement | null>> = {
      section1: section1Ref, section2: section2Ref, section3: section3Ref,
    };
    const ref = refMap[section];
    requestAnimationFrame(() => {
      ref?.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    if (entry.type === 'success') {
      setTimeout(() => setSectionFeedback(prev => ({ ...prev, [section]: null })), 5000);
    }
  };

  const [isConfirmPasswordOpen, setIsConfirmPasswordOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<() => void>(() => () => {});
  const [confirmModalConfig, setConfirmModalConfig] = useState({ 
    title: 'Confirm Action', 
    message: 'Please enter your administrator password to proceed.', 
    variant: 'primary' as 'primary' | 'danger',
    confirmText: 'Confirm'
  });

  const confirmAction = (action: () => void, config: typeof confirmModalConfig) => {
    setPendingAction(() => action);
    setConfirmModalConfig(config);
    setIsConfirmPasswordOpen(true);
  };

  const clearFeedback = (section: string) => {
    setSectionFeedback(prev => ({ ...prev, [section]: null }));
  };

  // ── Drafts ──
  const [drafts, setDrafts] = useState<any[]>([]);
  const [draftsLoading, setDraftsLoading] = useState(true);
  const resumingRef = useRef(false);

  // ── API data ──
  const { data: usersData } = useFetch<any>('/users');
  const { data: formsData } = useFetch<any>('/forms');
  const { data: academicPeriodsData } = useFetch<any>('/academic_periods');
  const { data: curriculumDataRes, loading: currLoading } = useFetch<any>('/curriculum');
  const curriculum = curriculumDataRes?.curriculum || {};

  // Fetch drafts
  useEffect(() => {
    const token = typeof window !== 'undefined' ? sessionStorage.getItem('auth_token') : null;
    const base = process.env.NEXT_PUBLIC_API_URL || '/api';
    fetch(`${base}/evaluation_periods?status=draft`, {
      headers: { Authorization: `Bearer ${token || ''}` },
    })
      .then(r => r.json())
      .then(data => { if (data.success) setDrafts(data.periods || []); })
      .catch((err) => { console.error('Error:', err); })
      .finally(() => setDraftsLoading(false));
  }, []);

  // Academic period options
  const academicPeriodOptions = useMemo(() => {
    if (!academicPeriodsData?.periods) return [];
    return academicPeriodsData.periods
      .filter((p: any) => !p.is_archived || String(p.id) === selectedAcademicPeriodId)
      .map((p: any) => ({
        value: String(p.id),
        label: `${p.name} (${p.academic_year} — Sem ${p.semester})${p.is_archived ? ' [Locked]' : ''}`,
      }));
  }, [academicPeriodsData, selectedAcademicPeriodId]);

  // Auto-select the active academic period
  useEffect(() => {
    if (!selectedAcademicPeriodId && academicPeriodsData?.periods) {
      const active = academicPeriodsData.periods.find((p: any) => p.is_active);
      if (active) setSelectedAcademicPeriodId(String(active.id));
    }
  }, [academicPeriodsData, selectedAcademicPeriodId]);

  // Derived academic year + semester from selected period
  const selectedAcademicPeriod = useMemo(() => {
    if (!selectedAcademicPeriodId || !academicPeriodsData?.periods) return null;
    return academicPeriodsData.periods.find((p: any) => String(p.id) === selectedAcademicPeriodId) || null;
  }, [selectedAcademicPeriodId, academicPeriodsData]);

  const academicYear = selectedAcademicPeriod?.academic_year || '';
  const semesterFromPeriod = selectedAcademicPeriod?.semester;
  const semester = useMemo(() => {
    if (!semesterFromPeriod) return '';
    if (semesterFromPeriod === 1) return '1st Semester';
    if (semesterFromPeriod === 2) return '2nd Semester';
    if (semesterFromPeriod === 3) return 'Summer';
    return String(semesterFromPeriod);
  }, [semesterFromPeriod]);

  // Derive instructor options (teachers only)
  const instructorOptions = useMemo(() => {
    if (!usersData?.users) return [];
    return usersData.users
      .filter((u: any) => u.role === 'teacher')
      .map((u: any) => ({ value: u.id, label: u.name }));
  }, [usersData]);

  // Instructor name lookup
  const instructorNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const opt of instructorOptions) {
      map[opt.value] = opt.label;
    }
    return map;
  }, [instructorOptions]);

  // Derive saved forms options (with type badge)
  const formOptions = useMemo(() => {
    if (!formsData?.forms) return [];
    return formsData.forms.map((f: any) => ({
      value: String(f.id),
      label: `${f.name} — ${formTypeLabel[f.type] || f.type}`,
    }));
  }, [formsData]);

  // Selected form details (for preview + conditional logic)
  const selectedForm = useMemo(() => {
    if (!selectedFormId || !formsData?.forms) return null;
    const form = formsData.forms.find((f: any) => String(f.id) === selectedFormId);
    if (!form) return null;
    return { ...form, criteria: Array.isArray(form.criteria) ? form.criteria : [] };
  }, [selectedFormId, formsData]);

  const showInstructorAssignment = selectedForm?.type === 'student-to-teacher';

  // ── Year levels for a given program ──
  const getYearLevels = useCallback((program: string) => {
    if (!program || !curriculum) return [];
    const programData = (curriculum as any)[program];
    if (!programData) return [];
    return Object.keys(programData).map(y => ({ value: y, label: y }));
  }, [curriculum]);

  // Auto-generated evaluation name
  const generatedName = useMemo(() => {
    const prefix = namePrefix.trim() || 'Evaluation';
    const datePart = evalStartDate && evalEndDate
      ? ` (${formatShortDate(evalStartDate)} - ${formatShortDate(evalEndDate)})`
      : '';
    const ayPart = academicYear ? ` — ${academicYear}` : '';
    const semPart = semester ? ` ${semester}` : '';
    return `${prefix}${ayPart}${semPart}${datePart}`;
  }, [namePrefix, academicYear, semester, evalStartDate, evalEndDate]);

  // Date validation
  useEffect(() => {
    if (evalStartDate && evalEndDate) {
      setDateWarning(new Date(evalEndDate) < new Date(evalStartDate) ? 'End date cannot be earlier than start date.' : '');
    }
  }, [evalStartDate, evalEndDate]);

  // ── Group management ──
  const updateGroup = (groupId: string, updates: Partial<AssignmentGroup>) => {
    setGroups(prev => prev.map(g => g.id === groupId ? { ...g, ...updates } : g));
  };

  const addGroup = () => {
    setGroups(prev => [...prev, createEmptyGroup()]);
  };

  const removeGroup = (groupId: string) => {
    if (groups.length <= 1) return;
    setGroups(prev => prev.filter(g => g.id !== groupId));
  };

  const toggleGroupCollapse = (groupId: string) => {
    updateGroup(groupId, { collapsed: !groups.find(g => g.id === groupId)?.collapsed });
  };

  const toggleSubject = (groupId: string, code: string) => {
    const group = groups.find(g => g.id === groupId);
    if (!group) return;
    const newSelected = group.selectedCodes.includes(code)
      ? group.selectedCodes.filter(c => c !== code)
      : [...group.selectedCodes, code];
    updateGroup(groupId, { selectedCodes: newSelected });
  };

  const toggleAllSubjects = (groupId: string, subjects: any[]) => {
    const group = groups.find(g => g.id === groupId);
    if (!group) return;
    if (group.selectedCodes.length === subjects.length && subjects.length > 0) {
      updateGroup(groupId, { selectedCodes: [] });
    } else {
      updateGroup(groupId, { selectedCodes: subjects.map((s: any) => s.code) });
    }
  };

  const assignInstructor = (groupId: string, code: string, instructorId: string) => {
    const group = groups.find(g => g.id === groupId);
    if (!group) return;
    const newAssignments = { ...group.assignments, [code]: instructorId };
    const newSelected = instructorId && !group.selectedCodes.includes(code)
      ? [...group.selectedCodes, code]
      : group.selectedCodes;
    updateGroup(groupId, { assignments: newAssignments, selectedCodes: newSelected });
  };

  const assignSection = (groupId: string, code: string, sec: string) => {
    const group = groups.find(g => g.id === groupId);
    if (!group) return;
    updateGroup(groupId, { sectionAssignments: { ...group.sectionAssignments, [code]: sec } });
  };

  const getSection = (group: AssignmentGroup, code: string) => group.sectionAssignments[code] || group.defaultSection;

  // ── Assignment Summary for preview ──
  const assignmentSummary = useMemo(() => {
    const rows: { code: string; name: string; section: string; teacherName: string; program: string; yearLevel: string }[] = [];
    for (const group of groups) {
      if (!group.program || !group.yearLevel) continue;
      const subjects = getSubjectsForGroup(curriculum, group.program, group.yearLevel, semester);
      const subjectMap: Record<string, string> = {};
      for (const s of subjects) subjectMap[s.code] = s.name;

      for (const code of group.selectedCodes) {
        const instructorId = group.assignments[code];
        if (!instructorId) continue;
        rows.push({
          code,
          name: subjectMap[code] || code,
          section: getSection(group, code),
          teacherName: instructorNameMap[instructorId] || instructorId,
          program: group.program,
          yearLevel: group.yearLevel,
        });
      }
    }
    return rows;
  }, [groups, semester, instructorNameMap]);

  // ── Save / Start logic ──
  const buildAssignmentsJson = () => {
    const groupsData = groups
      .filter(g => g.program && g.yearLevel)
      .map(g => {
        const filteredAssignments: Record<string, string> = {};
        const filteredSections: Record<string, string> = {};
        g.selectedCodes.forEach(code => {
          filteredAssignments[code] = g.assignments[code] || '';
          filteredSections[code] = getSection(g, code);
        });
        return {
          program: g.program,
          yearLevel: g.yearLevel,
          defaultSection: g.defaultSection,
          sections: filteredSections,
          selectedCodes: g.selectedCodes,
          assignments: filteredAssignments,
        };
      });

    return JSON.stringify({
      namePrefix,
      groups: groupsData,
    });
  };

  const saveSetup = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (!selectedFormId || !selectedAcademicPeriodId) {
      showFeedback('section1', { type: 'error', message: 'Please select an academic period and evaluation form.' });
      return;
    }

    if (showInstructorAssignment) {
      const validGroups = groups.filter(g => g.program && g.yearLevel && g.selectedCodes.length > 0);
      if (validGroups.length === 0) {
        showFeedback('section2', { type: 'error', message: 'Add at least one group with a program, year level, and selected subjects.' });
        return;
      }
    }

    setSaving(true);
    clearFeedback('section3');
    try {
      const payload: any = {
        name: generatedName,
        academic_year: academicYear,
        semester,
        start_date: evalStartDate || null,
        end_date: evalEndDate || null,
        form_id: Number(selectedFormId),
        academic_period_id: Number(selectedAcademicPeriodId),
        assignments_json: buildAssignmentsJson(),
      };

      if (savedPeriodId) {
        // Preserve current status when updating an existing period
        await fetchApi('/evaluation_periods', {
          method: 'PATCH',
          body: JSON.stringify({ ...payload, id: savedPeriodId }),
        });
      } else {
        payload.status = 'draft';
        const periodData = await fetchApi('/evaluation_periods', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        setSavedPeriodId(periodData.period.id);
      }
      showFeedback('section3', { type: 'success', message: savedPeriodId ? 'Setup updated!' : 'Setup saved as draft!' });
      setTimeout(() => router.push('/dean/evaluations'), 1000);
    } catch (err) {
      showFeedback('section3', { type: 'error', message: `Failed to save: ${err instanceof Error ? err.message : 'Unknown error'}` });
    } finally {
      setSaving(false);
    }
  };

  // Shared logic: populate form from a period object
  const loadPeriodData = (period: any) => {
    resumingRef.current = true;

    setEvalStartDate(period.start_date ? period.start_date.split('T')[0] : '');
    setEvalEndDate(period.end_date ? period.end_date.split('T')[0] : '');
    if (period.form_id) setSelectedFormId(String(period.form_id));
    if (period.academic_period_id) setSelectedAcademicPeriodId(String(period.academic_period_id));
    setSavedPeriodId(period.id);
    setStatus(period.status || 'draft');

    let restoredPrefix = '';
    if (period.assignments_json) {
      try {
        const parsed = typeof period.assignments_json === 'string'
          ? JSON.parse(period.assignments_json) : period.assignments_json;
        if (parsed.namePrefix !== undefined) restoredPrefix = parsed.namePrefix;

        if (parsed.groups && Array.isArray(parsed.groups)) {
          // New multi-group format
          const restoredGroups: AssignmentGroup[] = parsed.groups.map((g: any) => ({
            id: createGroupId(),
            program: g.program || '',
            yearLevel: g.yearLevel || '',
            defaultSection: g.defaultSection || 'A',
            assignments: g.assignments || {},
            sectionAssignments: g.sections || {},
            selectedCodes: g.selectedCodes || Object.keys(g.assignments || {}),
            collapsed: false,
          }));
          if (restoredGroups.length > 0) {
            setGroups(restoredGroups);
          }
        } else if (parsed.program) {
          // Legacy single-group format
          setGroups([{
            id: createGroupId(),
            program: parsed.program || '',
            yearLevel: parsed.yearLevel || '',
            defaultSection: parsed.defaultSection || parsed.section || 'A',
            assignments: parsed.assignments || {},
            sectionAssignments: parsed.sections || {},
            selectedCodes: parsed.selectedCodes || Object.keys(parsed.assignments || {}),
            collapsed: false,
          }]);
        }
      } catch (err) { console.error('Error:', err); }
    }
    setNamePrefix(restoredPrefix);

    setTimeout(() => { resumingRef.current = false; }, 500);
  };

  // Resume a draft from the drafts table
  const resumeDraft = (draft: any) => loadPeriodData(draft);

  // Load an existing period via ?periodId= query param (edit mode)
  const [editLoading, setEditLoading] = useState(!!editPeriodId);
  useEffect(() => {
    if (!editPeriodId) return;
    setEditLoading(true);
    const token = typeof window !== 'undefined' ? sessionStorage.getItem('auth_token') : null;
    const base = process.env.NEXT_PUBLIC_API_URL || '/api';
    fetch(`${base}/evaluation_periods`, {
      headers: { Authorization: `Bearer ${token || ''}` },
    })
      .then(r => r.json())
      .then(data => {
        if (data.success && data.periods) {
          const period = data.periods.find((p: any) => String(p.id) === editPeriodId);
          if (period) loadPeriodData(period);
        }
      })
      .catch((err) => { console.error('Error:', err); })
      .finally(() => setEditLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editPeriodId]);

  // Delete a draft
  const deleteDraft = (id: number) => {
    confirmAction(async () => {
      try {
        await fetchApi(`/evaluation_periods?id=${id}`, { method: 'DELETE' });
        setDrafts(drafts.filter(d => d.id !== id));
      } catch (err) {
        showFeedback('section1', { type: 'error', message: `Failed to delete: ${err instanceof Error ? err.message : 'Unknown error'}` });
      }
    }, {
      title: 'Delete Draft',
      message: 'Are you sure you want to permanently delete this setup draft?',
      variant: 'danger',
      confirmText: 'Delete Draft'
    });
  };

  // ── Start Evaluation ──
  const executeStart = async () => {
    setStarting(true);
    clearFeedback('section3');
    try {
      let periodId = savedPeriodId;
      if (!periodId) {
        if (!selectedFormId || !selectedAcademicPeriodId) {
          throw new Error('Please select an academic period and evaluation form.');
        }
        const payload: any = {
          name: generatedName,
          academic_year: academicYear,
          semester,
          start_date: evalStartDate || null,
          end_date: evalEndDate || null,
          form_id: Number(selectedFormId),
          academic_period_id: Number(selectedAcademicPeriodId),
          status: 'draft',
          assignments_json: buildAssignmentsJson(),
        };
        const periodData = await fetchApi('/evaluation_periods', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        periodId = periodData.period.id;
        setSavedPeriodId(periodId);
      }
      if (!periodId) throw new Error('Failed to save setup before starting.');

      // Build full payload so date/assignment changes are persisted alongside the status update
      const updatePayload: any = {
        id: periodId,
        name: generatedName,
        academic_year: academicYear,
        semester,
        start_date: evalStartDate || null,
        end_date: evalEndDate || null,
        form_id: Number(selectedFormId),
        academic_period_id: Number(selectedAcademicPeriodId),
        assignments_json: buildAssignmentsJson(),
        status,
      };

      await fetchApi('/evaluation_periods', {
        method: 'PATCH',
        body: JSON.stringify(updatePayload),
      });

      if (status === 'active') {
        await fetchApi('/evaluations', {
          method: 'POST',
          body: JSON.stringify({ action: 'generate', periodId: periodId }),
        });
      }

      showFeedback('section3', { type: 'success', message: status === 'active' ? 'Evaluation started! Assignments have been generated.' : `Evaluation status set to ${status}.` });
      setTimeout(() => router.push('/dean/evaluations'), 1000);
    } catch (err) {
      showFeedback('section3', { type: 'error', message: `Failed to start: ${err instanceof Error ? err.message : 'Unknown error'}` });
    } finally {
      setStarting(false);
    }
  };

  const startEvaluation = async () => {
    if (!evalStartDate || !evalEndDate) {
      showFeedback('section1', { type: 'error', message: 'Set evaluation dates before starting.' });
      return;
    }
    if (dateWarning) {
      showFeedback('section1', { type: 'error', message: 'Fix date issues before starting.' });
      return;
    }
    if (!selectedFormId) {
      showFeedback('section1', { type: 'error', message: 'Select an evaluation form before starting.' });
      return;
    }
    if (showInstructorAssignment) {
      for (const group of groups) {
        if (!group.program || !group.yearLevel) continue;
        const missing = group.selectedCodes.filter(code => !group.assignments[code]);
        if (missing.length > 0) {
          showFeedback('section2', { type: 'error', message: `Assign instructors to all selected subjects in ${group.program} ${group.yearLevel}. Missing: ${missing.join(', ')}` });
          return;
        }
      }
    }

    // If status is draft, just save as draft instead of activating
    if (status === 'draft') {
      await saveSetup();
      return;
    }

    confirmAction(executeStart, {
      title: 'Start Evaluation',
      message: 'You are about to launch this evaluation period. This will generate assignments for all students. Enter password to confirm.',
      variant: 'primary',
      confirmText: 'Launch Evaluation'
    });
  };

  const isEditMode = !!editPeriodId;

  if (editLoading) return <DashboardSkeleton />;

  return (
    <div className="space-y-8">
      <div className="relative text-center">
        {isEditMode && (
          <Button 
            variant="outline" 
            size="sm" 
            className="absolute left-0 top-1/2 -translate-y-1/2 flex items-center gap-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
            onClick={() => router.push('/dean/evaluations')}
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </Button>
        )}
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white">
          {isEditMode ? 'Edit Evaluation' : 'Evaluation Setup'}
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          {isEditMode
            ? 'Update evaluation details, assignments, and status.'
            : 'Select a form, assign subjects, and launch.'}
        </p>
      </div>

      {/* ── DRAFTS SECTION (hidden in edit mode) ── */}
      {!isEditMode && !draftsLoading && drafts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Evaluation Drafts</CardTitle>
            <CardDescription>Resume or delete previously saved draft evaluations.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Name</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Academic Year</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Semester</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Dates</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {drafts.map((draft: any) => (
                    <tr key={draft.id}>
                      <td className="px-4 py-3 text-gray-900 dark:text-white">{draft.name}</td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{draft.academic_year || '—'}</td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{draft.semester || '—'}</td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                        {draft.start_date?.split('T')[0]} to {draft.end_date?.split('T')[0]}
                      </td>
                      <td className="px-4 py-3 flex gap-2">
                        <Button variant="primary" size="sm" onClick={() => resumeDraft(draft)} className="gap-1">
                          <RefreshCw className="w-3 h-3" /> Resume
                        </Button>
                        <Button variant="danger" size="sm" onClick={() => deleteDraft(draft.id)} className="gap-1">
                          <Trash2 className="w-3 h-3" /> Delete
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── SECTION 1: Evaluation Details & Form Selection ── */}
      <Card className="hover:shadow-lg transition-shadow">
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="text-2xl">1. Evaluation Details & Form Selection</CardTitle>
              <CardDescription>The active academic period is used automatically. Choose an evaluation form, name, and schedule.</CardDescription>
            </div>
            <Link href="/dean/forms">
              <Button variant="outline" size="sm" className="gap-1">
                <FileText className="w-4 h-4" /> Manage Forms
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col gap-6">
            
            {/* Top row: Read-only period + Form Select */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 bg-gray-50/50 dark:bg-gray-800/30 p-5 border border-gray-100 dark:border-gray-700/50 rounded-xl rounded-tr-xl">
              <div className="space-y-4">
                <div>
                  <div className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Connected Academic Period</div>
                  {selectedAcademicPeriod ? (
                    <div className="px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-800 dark:text-gray-200 text-sm flex items-center justify-between shadow-sm">
                      <span className="font-medium">{selectedAcademicPeriod.name}</span>
                      <Badge variant="success">Active</Badge>
                    </div>
                  ) : (
                    <div className="px-4 py-2.5 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg text-yellow-800 dark:text-yellow-300 text-sm shadow-sm">
                      No active academic period.{' '}
                      <Link href="/dean/academic" className="text-blue-600 font-semibold hover:underline">Set one up</Link>.
                    </div>
                  )}
                </div>

                {selectedAcademicPeriod && (
                  <div className="flex gap-4">
                    <div className="flex-1">
                      <div className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Academic Year</div>
                      <div className="px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded text-gray-700 dark:text-gray-300 text-sm font-medium">
                        {academicYear}
                      </div>
                    </div>
                    <div className="flex-1">
                      <div className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Semester</div>
                      <div className="px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded text-gray-700 dark:text-gray-300 text-sm font-medium">
                        {semester}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <Select
                  label="Target Evaluation Form"
                  value={selectedFormId}
                  onChange={e => setSelectedFormId(e.target.value)}
                  options={formOptions}
                  placeholder="Select an evaluation form..."
                  disabled={isEditMode && status !== 'draft'}
                />
                {selectedForm && (
                  <div className="mt-2 flex flex-col items-start gap-1">
                    <Badge variant={selectedForm.type === 'student-to-teacher' ? 'default' : 'secondary'} className="mb-0.5">
                      Type: {formTypeLabel[selectedForm.type] || selectedForm.type}
                    </Badge>
                    {isEditMode && status !== 'draft' && (
                      <span className="text-xs text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 px-2 py-0.5 rounded border border-orange-200 dark:border-orange-800 mt-1">
                        Locked — form cannot be changed after leaving draft
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Config options */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
              <div className="space-y-4">
                <Input
                  label="Evaluation Name Prefix"
                  value={namePrefix}
                  onChange={e => setNamePrefix(e.target.value)}
                  placeholder="e.g. Midterm Evaluation"
                  helperText="Optional custom prefix to distinguish this instance"
                />
                <div className="bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 p-4 rounded-lg">
                  <div className="block text-xs font-semibold text-blue-800 dark:text-blue-300 uppercase tracking-wider mb-2">Final Name Preview</div>
                  <div className="text-sm font-medium text-gray-800 dark:text-gray-200">
                    {generatedName || <span className="text-gray-400 italic">Name will generate here</span>}
                  </div>
                </div>
              </div>
              
              <div className="bg-gray-50/50 dark:bg-gray-800/30 p-4 border border-gray-100 dark:border-gray-700/50 rounded-xl space-y-4">
                <div className="block text-sm font-semibold text-gray-700 dark:text-gray-300">Execution Window</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <Input
                    label="Start Date"
                    type="date"
                    value={evalStartDate}
                    onChange={e => setEvalStartDate(e.target.value)}
                    className="calendar-lg-popup cursor-pointer"
                  />
                  <Input
                    label="End Date"
                    type="date"
                    value={evalEndDate}
                    onChange={e => setEvalEndDate(e.target.value)}
                    className="calendar-lg-popup cursor-pointer"
                  />
                </div>
                {dateWarning && <Alert variant="error" title="Date Warning">{dateWarning}</Alert>}
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                  Submissions are only allowed strictly within this timeframe.
                </p>
              </div>
            </div>
          </div>

          {/* Form preview */}
          {selectedForm && selectedForm.criteria.length > 0 && (
            <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg space-y-3">
              <div className="flex items-center gap-2 mb-2">
                <Eye className="w-4 h-4 text-gray-500" />
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Form Preview</span>
              </div>
              {selectedForm.criteria.map((c: any) => (
                <div key={c.id} className="border-l-2 border-blue-400 pl-3">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900 dark:text-white text-sm">{c.name}</span>
                    <Badge variant="outline">{c.weight}%</Badge>
                  </div>
                  {c.questions?.length > 0 && (
                    <ol className="list-decimal list-inside mt-1 text-xs text-gray-600 dark:text-gray-400 space-y-0.5">
                      {c.questions.map((q: any) => (
                        <li key={q.id}>{q.text}</li>
                      ))}
                    </ol>
                  )}
                </div>
              ))}
            </div>
          )}

          {formOptions.length === 0 && (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No forms created yet.{' '}
              <Link href="/dean/forms" className="text-blue-600 hover:underline">Create one first</Link>.
            </p>
          )}

          {sectionFeedback.section1 && (
            <div ref={section1Ref}>
              <Alert variant={sectionFeedback.section1.type === 'success' ? 'success' : 'error'} title={sectionFeedback.section1.type === 'success' ? 'Success' : 'Error'}>
                {sectionFeedback.section1.message}
              </Alert>
            </div>
          )}

        </CardContent>
      </Card>

      {/* ── SECTION 2: Assign Instructor and Subjects (multi-group, only for student-to-teacher) ── */}
      {showInstructorAssignment && (
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="text-2xl">2. Assign Instructor and Subjects</CardTitle>
                <CardDescription>
                  Add one or more program/year level groups. Subjects auto-populate from the curriculum based on the academic period semester.
                </CardDescription>
              </div>
              <Button variant="primary" size="sm" className="gap-1" onClick={addGroup}>
                <Plus className="w-4 h-4" /> Add Group
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {groups.map((group, groupIndex) => {
              const subjects = getSubjectsForGroup(curriculum, group.program, group.yearLevel, semester);
              const yearLevels = getYearLevels(group.program);
              const assignedCount = group.selectedCodes.filter(c => group.assignments[c]).length;

              return (
                <div key={group.id} className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden bg-white dark:bg-gray-800/50 shadow-sm transition-all focus-within:ring-2 focus-within:ring-blue-500/20">
                  {/* Group Header */}
                  <div
                    className="flex items-center justify-between px-5 py-4 bg-gray-50/80 dark:bg-gray-800/80 border-b border-gray-100 dark:border-gray-700/50 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition"
                    onClick={() => toggleGroupCollapse(group.id)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') { toggleGroupCollapse(group.id); } }}
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex justify-center flex-shrink-0 items-center w-7 h-7 bg-white dark:bg-gray-700 rounded-md border border-gray-200 dark:border-gray-600 shadow-sm">
                        {group.collapsed ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronUp className="w-4 h-4 text-gray-500" />}
                      </div>
                      <div className="flex flex-col">
                        <span className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                          Group {groupIndex + 1}
                          {group.program && group.yearLevel && (
                             <Badge variant="outline" className="ml-1 px-2 py-0.5 text-xs font-semibold">{group.program} - Year {group.yearLevel}</Badge>
                          )}
                        </span>
                      </div>
                      
                      {group.selectedCodes.length > 0 && (
                        <Badge variant={assignedCount === group.selectedCodes.length ? 'success' : 'secondary'} className="ml-2 font-medium">
                          {assignedCount}/{group.selectedCodes.length} Subjects Assigned
                        </Badge>
                      )}
                    </div>
                    {groups.length > 1 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-2 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                        onClick={(e) => { e.stopPropagation(); removeGroup(group.id); }}
                      >
                        <Trash2 className="w-4 h-4" /> <span className="hidden sm:inline">Remove Group</span>
                      </Button>
                    )}
                  </div>

                  {/* Group Body */}
                  {!group.collapsed && (
                    <div className="p-5 space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5 bg-blue-50/30 dark:bg-blue-900/10 p-4 rounded-xl border border-blue-100 dark:border-blue-900/30">
                        <Select
                          label="Course Program"
                          value={group.program}
                          onChange={e => {
                            updateGroup(group.id, {
                              program: e.target.value as CurriculumProgram | '',
                              yearLevel: '',
                              assignments: {},
                              sectionAssignments: {},
                              selectedCodes: [],
                            });
                          }}
                          options={[
                            { value: 'BSIT', label: 'BSIT' },
                            { value: 'BSEMC', label: 'BSEMC' },
                          ]}
                          placeholder="Select Program"
                        />
                        <Select
                          label="Year Level"
                          value={group.yearLevel}
                          onChange={e => {
                            updateGroup(group.id, {
                              yearLevel: e.target.value,
                              assignments: {},
                              sectionAssignments: {},
                              selectedCodes: [],
                            });
                          }}
                          options={yearLevels}
                          placeholder="Select Year"
                        />
                        <Select
                          label="Global Section Pattern"
                          value={group.defaultSection}
                          onChange={e => updateGroup(group.id, { defaultSection: e.target.value })}
                          options={[
                            { value: 'A', label: 'A' },
                            { value: 'B', label: 'B' },
                            { value: 'C', label: 'C' },
                            { value: 'D', label: 'D' },
                          ]}
                          placeholder="Select Section"
                          helperText="Applies by default to all subjects"
                        />
                        <Select
                          label="Assign All Instructor"
                          value=""
                          onChange={e => {
                            const teacherId = e.target.value;
                            if (!teacherId) return;
                            const codes = group.selectedCodes.length > 0
                              ? group.selectedCodes
                              : subjects.map((s: any) => s.code);
                            const newAssignments = { ...group.assignments };
                            for (const code of codes) {
                              newAssignments[code] = teacherId;
                            }
                            updateGroup(group.id, {
                              assignments: newAssignments,
                              selectedCodes: codes,
                            });
                          }}
                          options={instructorOptions}
                          placeholder="Batch Assign Instructor..."
                          helperText="Quickly assign one teacher to all selected"
                        />
                      </div>

                      {/* Subjects table */}
                      <div className="overflow-hidden border border-gray-200 dark:border-gray-700 rounded-xl">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-100/50 dark:bg-gray-800/80">
                            <tr>
                              <th className="px-4 py-3.5 text-left w-12">
                                <input
                                  type="checkbox"
                                  checked={group.selectedCodes.length === subjects.length && subjects.length > 0}
                                  onChange={() => toggleAllSubjects(group.id, subjects)}
                                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                />
                              </th>
                              <th className="px-4 py-3.5 text-left font-semibold text-gray-700 dark:text-gray-300 w-32">Code</th>
                              <th className="px-4 py-3.5 text-left font-semibold text-gray-700 dark:text-gray-300">Subject Name</th>
                              <th className="px-4 py-3.5 text-left font-semibold text-gray-700 dark:text-gray-300 min-w-[200px]">Instructor</th>
                              <th className="px-4 py-3.5 text-left font-semibold text-gray-700 dark:text-gray-300 w-28">Section</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200 dark:divide-gray-700/50">
                            {subjects.length > 0 ? subjects.map((s: any) => (
                              <tr key={s.code} className={`transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50 ${group.selectedCodes.includes(s.code) ? 'bg-blue-50/20 dark:bg-blue-900/5' : ''}`}>
                                <td className="px-4 py-3">
                                  <input
                                    type="checkbox"
                                    checked={group.selectedCodes.includes(s.code)}
                                    onChange={() => toggleSubject(group.id, s.code)}
                                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                  />
                                </td>
                                <td className="px-4 py-3 font-semibold text-gray-900 dark:text-white">
                                  <span className={!group.selectedCodes.includes(s.code) ? 'opacity-50' : ''}>{s.code}</span>
                                </td>
                                <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                                  <span className={!group.selectedCodes.includes(s.code) ? 'opacity-50' : ''}>{s.name}</span>
                                </td>
                                <td className="px-4 py-2">
                                  <select
                                    value={group.assignments[s.code] || ''}
                                    onChange={e => assignInstructor(group.id, s.code, e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 disabled:opacity-40 disabled:bg-gray-50 transition"
                                    disabled={!group.selectedCodes.includes(s.code)}
                                  >
                                    <option value="" disabled>Select Instructor...</option>
                                    {instructorOptions.map((opt: any) => (
                                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                                    ))}
                                  </select>
                                </td>
                                <td className="px-4 py-2">
                                  <select
                                    value={getSection(group, s.code)}
                                    onChange={e => assignSection(group.id, s.code, e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 disabled:opacity-40 disabled:bg-gray-50 transition"
                                    disabled={!group.selectedCodes.includes(s.code)}
                                  >
                                    {['A', 'B', 'C', 'D'].map(sec => (
                                      <option key={sec} value={sec}>{sec}</option>
                                    ))}
                                  </select>
                                </td>
                              </tr>
                            )) : (
                              <tr>
                                <td colSpan={5} className="text-center text-gray-500 dark:text-gray-400 py-12">
                                  <div className="flex flex-col items-center justify-center space-y-2 opacity-60">
                                    <FileText className="w-8 h-8 mb-2" />
                                    {!group.program || !group.yearLevel
                                      ? <span>Select a course program and year level above to load available subjects.</span>
                                      : !semester
                                      ? <span>Select an academic period to determine the semester.</span>
                                      : <span>No subjects found for this combination.</span>}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Add Group button (bottom) */}
            <div className="flex justify-center">
              <Button variant="outline" className="gap-2" onClick={addGroup}>
                <Plus className="w-4 h-4" /> Add Program / Year Level Group
              </Button>
            </div>

            {/* Assignment Summary */}
            {assignmentSummary.length > 0 && (
              <div className="mt-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Assignment Summary</h3>
                <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-800">
                      <tr>
                        <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Subject Code</th>
                        <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Subject Name</th>
                        <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Section</th>
                        <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Instructor</th>
                        <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Program</th>
                        <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Year Level</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {assignmentSummary.map((row, idx) => (
                        <tr key={`${row.code}-${row.program}-${row.yearLevel}-${idx}`}>
                          <td className="px-4 py-2 font-medium text-gray-900 dark:text-white">{row.code}</td>
                          <td className="px-4 py-2 text-gray-700 dark:text-gray-300">{row.name}</td>
                          <td className="px-4 py-2 text-gray-600 dark:text-gray-400">{row.section}</td>
                          <td className="px-4 py-2 text-gray-700 dark:text-gray-300">{row.teacherName}</td>
                          <td className="px-4 py-2">
                            <Badge variant="outline">{row.program}</Badge>
                          </td>
                          <td className="px-4 py-2 text-gray-600 dark:text-gray-400">{row.yearLevel}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  {assignmentSummary.length} subject{assignmentSummary.length !== 1 ? 's' : ''} across {groups.filter(g => g.program && g.yearLevel).length} group{groups.filter(g => g.program && g.yearLevel).length !== 1 ? 's' : ''} will be generated.
                </p>
              </div>
            )}

            {sectionFeedback.section2 && (
              <div ref={section2Ref}>
                <Alert variant={sectionFeedback.section2.type === 'success' ? 'success' : 'error'} title={sectionFeedback.section2.type === 'success' ? 'Success' : 'Error'}>
                  {sectionFeedback.section2.message}
                </Alert>
              </div>
            )}

          </CardContent>
        </Card>
      )}

      {/* ── SECTION 3: Save & Start ── */}
      <Card className="hover:shadow-lg transition-shadow border-t-4 border-t-rose-600/50">
        <CardHeader>
          <CardTitle className="text-2xl">{showInstructorAssignment ? '3' : '2'}. Review & Launch</CardTitle>
          <CardDescription>Confirm your status and either save a draft for later or start pushing the evaluation live to users.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
            <div className="space-y-4">
              <div className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Select Execution Status</div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { id: 'draft', label: 'Draft', desc: 'Hidden from users' },
                  { id: 'active', label: 'Active', desc: 'Live collecting data' },
                  { id: 'closed', label: 'Closed', desc: 'Archived record' }
                ].map((s) => (
                  <label 
                    key={s.id} 
                    className={`relative flex flex-col p-4 cursor-pointer rounded-xl border-2 transition-all hover:bg-gray-50 dark:hover:bg-gray-800/50 ${
                      status === s.id 
                        ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-900/20 dark:border-blue-500 shadow-sm' 
                        : 'border-gray-200 dark:border-gray-700'
                    }`}
                  >
                    <input
                      type="radio"
                      name="status"
                      value={s.id}
                      checked={status === s.id}
                      onChange={() => setStatus(s.id)}
                      className="peer sr-only"
                    />
                    <span className="text-sm font-bold text-gray-900 dark:text-white capitalize mb-1">{s.label}</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400 leading-tight">{s.desc}</span>
                    <div className={`absolute top-4 right-4 w-4 h-4 rounded-full border-2 flex justify-center items-center transition-colors ${
                      status === s.id ? 'border-blue-600 dark:border-blue-400' : 'border-gray-300 dark:border-gray-600'
                    }`}>
                       {status === s.id && <div className="w-2 h-2 rounded-full bg-blue-600 dark:bg-blue-400" />}
                    </div>
                  </label>
                ))}
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row lg:flex-col xl:flex-row justify-end gap-3 lg:mt-8">
              <Button 
                variant="outline" 
                size="lg"
                className="gap-2 flex-1 shadow-sm font-semibold border-gray-300 dark:border-gray-600 hover:bg-gray-50" 
                onClick={saveSetup} 
                disabled={saving || starting} 
                isLoading={saving}
              >
                <Save className="w-5 h-5 opacity-70" />
                {savedPeriodId ? 'Update Draft' : 'Save Draft'}
              </Button>
              <Button 
                variant="primary" 
                size="lg"
                className="gap-2 flex-1 shadow-md bg-rose-700 hover:bg-rose-800 text-white font-semibold" 
                onClick={startEvaluation} 
                disabled={starting || saving} 
                isLoading={starting}
              >
                <Play className="w-5 h-5" />
                {isEditMode ? 'Apply & Deploy' : 'Launch Evaluation'}
              </Button>
            </div>
          </div>

          {sectionFeedback.section3 && (
            <div ref={section3Ref} className="mt-6 animate-in fade-in slide-in-from-top-2">
              <Alert variant={sectionFeedback.section3.type === 'success' ? 'success' : 'error'} title={sectionFeedback.section3.type === 'success' ? 'Success' : 'Error'}>
                {sectionFeedback.section3.message}
              </Alert>
            </div>
          )}

        </CardContent>
      </Card>
      <ConfirmPasswordModal
        isOpen={isConfirmPasswordOpen}
        onClose={() => setIsConfirmPasswordOpen(false)}
        onConfirm={pendingAction}
        {...confirmModalConfig}
      />
    </div>
  );
}
