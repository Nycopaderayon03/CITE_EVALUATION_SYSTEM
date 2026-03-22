'use client';

import { useState, useMemo, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/Card';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Alert } from '@/components/ui/Alert';
import { Pencil, Trash2, Plus } from 'lucide-react';
import { useFetch } from '@/hooks';
import { DashboardSkeleton } from '@/components/loading/Skeletons';

type CurriculumProgram = 'BSIT' | 'BSEMC';

export default function SubjectsPage() {
  const [curriculumData, setCurriculumData] = useState<any>(null);
  const { data: fetchRes, loading: currLoading } = useFetch<any>('/curriculum');

  useEffect(() => {
    if (fetchRes?.curriculum) {
      setCurriculumData(fetchRes.curriculum);
    }
  }, [fetchRes]);

  const [program, setProgram] = useState<CurriculumProgram | ''>('');
  const [yearLevel, setYearLevel] = useState('');
  const [semester, setSemester] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [modalData, setModalData] = useState({ code: '', name: '', existingCode: '', year: '', semester: '', existingYear: '', existingSemester: '', program: '', existingProgram: '' });
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const yearLevels = useMemo(() => {
    return [
      { value: '1st Year', label: '1st Year' },
      { value: '2nd Year', label: '2nd Year' },
      { value: '3rd Year', label: '3rd Year' },
      { value: '4th Year', label: '4th Year' }
    ];
  }, []);

  const semesters = useMemo(() => {
    return [
      { value: '1st Semester', label: '1st Semester' },
      { value: '2nd Semester', label: '2nd Semester' },
      { value: 'Summer', label: 'Summer' }
    ];
  }, []);

  const semestersForModal = useMemo(() => {
    return [
      { value: '1st Semester', label: '1st Semester' },
      { value: '2nd Semester', label: '2nd Semester' },
      { value: 'Summer', label: 'Summer' }
    ];
  }, []);

  const allSubjectsForProgram = useMemo(() => {
    if (!program || !curriculumData) return [];
    const programData = curriculumData[program as CurriculumProgram];
    if (!programData) return [];
    const all: { code: string; name: string; year: string; semester: string }[] = [];
    for (const [year, semestersList] of Object.entries(programData)) {
      for (const [sem, subjectList] of Object.entries(semestersList as any)) {
        for (const s of subjectList as any[]) {
          all.push({ ...s, year, semester: sem });
        }
      }
    }
    return all;
  }, [program, curriculumData]);

  const filteredSubjects = useMemo(() => {
    let result = allSubjectsForProgram;
    if (yearLevel) result = result.filter(s => s.year === yearLevel);
    if (semester) result = result.filter(s => s.semester === semester);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(s => 
        s.code.toLowerCase().includes(q) || 
        s.name.toLowerCase().includes(q)
      );
    }
    return result;
  }, [allSubjectsForProgram, yearLevel, semester, searchQuery]);

  const showFeedback = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
    if (type === 'success') setTimeout(() => setFeedback(null), 3000);
  };

  const handleSaveToFs = async (newData: any, metadata?: { action: string; oldCode?: string; newCode?: string; newName?: string }) => {
    try {
      const token = sessionStorage.getItem('auth_token');
      const res = await fetch('/api/curriculum', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(metadata ? { newData, metadata } : { newData, metadata: null })
      });
      if (!res.ok) throw new Error('Failed to strictly save to file system layer.');
      setCurriculumData(newData);
      showFeedback('success', 'Curriculum officially recorded.');
      setIsModalOpen(false);
    } catch (err: any) {
      showFeedback('error', err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalData.program || !modalData.year || !modalData.semester) {
      showFeedback('error', 'Target system nodes missing for execution.');
      return;
    }
    
    setIsSaving(true);
    const newData = JSON.parse(JSON.stringify(curriculumData));
    
    if (!newData[modalData.program]) newData[modalData.program] = {};
    if (!newData[modalData.program][modalData.year]) {
      newData[modalData.program][modalData.year] = {};
    }
    if (!newData[modalData.program][modalData.year][modalData.semester]) {
      newData[modalData.program][modalData.year][modalData.semester] = [];
    }
    
    const targetArr = newData[modalData.program][modalData.year][modalData.semester];
    
    if (modalMode === 'add') {
      if (targetArr.some((s: any) => s.code === modalData.code)) {
        showFeedback('error', 'Subject code already conflicts natively.');
        setIsSaving(false);
        return;
      }
      targetArr.push({ code: modalData.code, name: modalData.name });
    } else {
      // If program, year, or semester changed, we must remove from old array
      if (modalData.existingProgram && modalData.existingYear && modalData.existingSemester && 
         (modalData.existingProgram !== modalData.program || modalData.existingYear !== modalData.year || modalData.existingSemester !== modalData.semester)) {
         
         const oldArr = newData[modalData.existingProgram]?.[modalData.existingYear]?.[modalData.existingSemester];
         if (oldArr) {
            const oldIdx = oldArr.findIndex((s: any) => s.code === modalData.existingCode);
            if (oldIdx !== -1) oldArr.splice(oldIdx, 1);
         }
         // Add to new array
         targetArr.push({ code: modalData.code, name: modalData.name });
      } else {
        // Standard in-place edit
        const idx = targetArr.findIndex((s: any) => s.code === modalData.existingCode);
        if (idx !== -1) {
          targetArr[idx] = { code: modalData.code, name: modalData.name };
        }
      }
    }
    
    handleSaveToFs(newData, { action: modalMode, oldCode: modalData.existingCode, newCode: modalData.code, newName: modalData.name });
  };

  const handleDelete = (s: any) => {
    if (!confirm(`Are you sure you want to delete ${s.code}?`)) return;
    setIsSaving(true);
    const newData = JSON.parse(JSON.stringify(curriculumData));
    const targetArr = newData[program as any][s.year][s.semester];
    const idx = targetArr.findIndex((x: any) => x.code === s.code);
    if (idx !== -1) {
      targetArr.splice(idx, 1);
    }
    handleSaveToFs(newData, { action: 'delete', oldCode: s.code });
  };

  if (currLoading || !curriculumData) return <DashboardSkeleton />;

  return (
    <div className="space-y-8 max-w-5xl mx-auto p-4">
      {feedback && <Alert variant={feedback.type}>{feedback.message}</Alert>}
      
      <div className="flex justify-between items-center bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white leading-tight">Subjects</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1 max-w-lg">
            Add, update, and manage curriculum subjects in the system.
          </p>
        </div>
        {program && (
          <Button onClick={() => {
            setModalMode('add');
            setModalData({ code: '', name: '', existingCode: '', year: yearLevel || '', semester: semester || '', existingYear: '', existingSemester: '', program: program, existingProgram: program });
            setIsModalOpen(true);
          }} className="gap-2 shrink-0">
            <Plus className="w-4 h-4" /> Add Subject
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filter Subjects</CardTitle>
          <CardDescription>Select a program to view its curriculum subjects.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Select
              label="Program"
              value={program}
              onChange={e => {
                setProgram(e.target.value as CurriculumProgram | '');
              }}
              options={[
                { value: 'BSIT', label: 'BSIT' },
                { value: 'BSEMC', label: 'BSEMC' },
              ]}
              placeholder="Select Program"
            />
            <Select
              label="Year Level"
              value={yearLevel}
              onChange={e => {
                setYearLevel(e.target.value);
              }}
              options={yearLevels}
              placeholder="All Years"
              disabled={!program}
            />
            <Select
              label="Semester"
              value={semester}
              onChange={e => setSemester(e.target.value)}
              options={semesters}
              placeholder="All Semesters"
              disabled={!program}
            />
            <Input
              label="Search"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search subjects..."
              disabled={!program}
            />
          </div>
        </CardContent>
      </Card>

      {program && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>
                {program} Subjects
                {yearLevel && ` — ${yearLevel}`}
                {semester && ` — ${semester}`}
              </CardTitle>
              <CardDescription>
                {filteredSubjects.length} subject{filteredSubjects.length !== 1 ? 's' : ''} shown
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                  <tr>
                    <th className="px-4 py-3 font-medium">Subject Code</th>
                    <th className="px-4 py-3 font-medium">Subject Name</th>
                    {!semester && (
                      <>
                        <th className="px-4 py-3 font-medium">Year</th>
                        <th className="px-4 py-3 font-medium">Semester</th>
                      </>
                    )}
                    <th className="px-4 py-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredSubjects.length > 0 ? 
                    filteredSubjects.map((s: any) => (
                    <tr key={`${s.year}-${s.semester}-${s.code}`} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="px-4 py-3">
                        <Badge variant="outline" className="font-mono bg-white dark:bg-gray-900">{s.code}</Badge>
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-800 dark:text-gray-200">{s.name}</td>
                      {!semester && (
                        <>
                          <td className="px-4 py-3 text-gray-500">{s.year}</td>
                          <td className="px-4 py-3 text-gray-500">{s.semester}</td>
                        </>
                      )}
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="sm" onClick={() => {
                            setModalMode('edit');
                            setModalData({ code: s.code, name: s.name, existingCode: s.code, year: s.year, semester: s.semester, existingYear: s.year, existingSemester: s.semester, program: program as string, existingProgram: program as string });
                            setIsModalOpen(true);
                          }}>
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="danger" size="sm" onClick={() => handleDelete(s)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={5} className="px-4 py-10 text-center text-gray-500 dark:text-gray-400">
                        No subjects found for this combination.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Editor Modal */}
      <Modal isOpen={isModalOpen} onClose={() => !isSaving && setIsModalOpen(false)} title={modalMode === 'add' ? 'Add Subject' : 'Edit Subject'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Select
            label="Program / Course"
            value={modalData.program}
            onChange={e => setModalData({...modalData, program: e.target.value})}
            options={[
              { value: 'BSIT', label: 'BSIT' },
              { value: 'BSEMC', label: 'BSEMC' },
            ]}
            placeholder="Select Program..."
            disabled={isSaving}
            required
          />
          <Input 
            label="Subject Code" 
            value={modalData.code} 
            onChange={e => setModalData({...modalData, code: e.target.value.toUpperCase()})} 
            placeholder="e.g. IT101" 
            required
            disabled={isSaving}
          />
          <Input 
            label="Subject Name" 
            value={modalData.name} 
            onChange={e => setModalData({...modalData, name: e.target.value})} 
            placeholder="Introduction to Programming" 
            required
            disabled={isSaving}
          />
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Year Level"
              value={modalData.year}
              onChange={e => setModalData({...modalData, year: e.target.value, semester: ''})}
              options={yearLevels}
              placeholder="Select Year..."
              disabled={isSaving}
              required
            />
            <Select
              label="Semester"
              value={modalData.semester}
              onChange={e => setModalData({...modalData, semester: e.target.value})}
              options={semestersForModal}
              placeholder="Select Semester..."
              disabled={!modalData.year || isSaving || semestersForModal.length === 0}
              required
            />
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)} disabled={isSaving}>Cancel</Button>
            <Button type="submit" disabled={isSaving}>{isSaving ? 'Saving...' : 'Save'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
