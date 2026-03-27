'use client';

import { useEffect, useState } from 'react';
import { DashboardSkeleton } from '@/components/loading/Skeletons';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { DataTable } from '@/components/DataTable';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useFetch } from '@/hooks';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Checkbox } from '@/components/ui/Checkbox';
import { Alert } from '@/components/ui/Alert';
import { DashboardCard } from '@/components/DashboardCard';
import { ConfirmPasswordModal } from '@/components/ui/ConfirmPasswordModal';
import { AnimatedCounter } from '@/components/animations/AnimatedCounter';
import type { User } from '@/types';
import { Search, Plus, Trash2, Edit2, ChevronDown, ChevronUp, Lock, GraduationCap, ShieldCheck, BookOpen, Users } from 'lucide-react';

// Teacher stats component helper
function TeacherStatsMap({ teachers, evaluations }: { teachers: User[], evaluations: any[] }) {
  const [expandedTeacher, setExpandedTeacher] = useState<string | null>(null);

  return (
    <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
      {teachers.map(teacher => {
        const teacherEvals = (evaluations || []).filter(e => e.evaluatee_id === teacher.id && e.status === 'submitted');
        
        let totalScore = 0;
        let count = 0;
        const studentComments: string[] = [];
        const peerComments: string[] = [];
        const adminComments: string[] = [];

        teacherEvals.forEach(ev => {
          if (ev.responses && ev.responses.length > 0) {
            const sum = ev.responses.reduce((acc: number, r: any) => acc + Number(r.rating), 0);
            totalScore += sum / ev.responses.length;
            count++;
          }
          const comment = ev.comments || ev.responses?.find((r: any) => r.comment)?.comment;
          if (comment) {
            if (ev.evaluation_type === 'peer') peerComments.push(comment);
            else if (ev.evaluation_type === 'dean' || ev.is_ghost) adminComments.push(comment);
            else studentComments.push(comment);
          }
        });

        const avgScore = count > 0 ? (totalScore / count).toFixed(2) : 'N/A';
        const isExpanded = expandedTeacher === teacher.id;

        return (
          <div key={teacher.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-800/50">
            <div 
              className="flex justify-between items-center cursor-pointer"
              onClick={() => setExpandedTeacher(isExpanded ? null : teacher.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setExpandedTeacher(isExpanded ? null : teacher.id);
                }
              }}
              role="button"
              tabIndex={0}
            >
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">{teacher.name}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">{teacherEvals.length} evaluations</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Score</p>
                  <p className="text-xl font-bold text-blue-600 dark:text-blue-400">{avgScore}</p>
                </div>
                {isExpanded ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
              </div>
            </div>

            {isExpanded && (
              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 space-y-4">
                <div>
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Student Feedback ({studentComments.length})</h4>
                  {studentComments.length > 0 ? (
                    <ul className="list-disc pl-5 space-y-1">
                      {studentComments.map((c, i) => <li key={i} className="text-sm text-gray-600 dark:text-gray-400 italic">"{c}"</li>)}
                    </ul>
                  ) : <p className="text-sm text-gray-500 italic">No feedback</p>}
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Peer Feedback ({peerComments.length})</h4>
                  {peerComments.length > 0 ? (
                    <ul className="list-disc pl-5 space-y-1">
                      {peerComments.map((c, i) => <li key={i} className="text-sm text-gray-600 dark:text-gray-400 italic">"{c}"</li>)}
                    </ul>
                  ) : <p className="text-sm text-gray-500 italic">No feedback</p>}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function UserManagementPage() {
  const { data: usersData, loading: usersLoading, error: usersError } = useFetch<any>('/users');
  const { data: evalData } = useFetch<any>('/evaluations');
  const [users, setUsers] = useState<User[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isTeacherStatsOpen, setIsTeacherStatsOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'student' as User['role'], course: '', year_level: 0, section: '' });
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

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

  const displaySuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  const displayError = (msg: string) => {
    setErrorMsg(msg);
    setTimeout(() => setErrorMsg(''), 3000);
  };

  useEffect(() => {
    if (usersData?.users) setUsers(usersData.users);
  }, [usersData]);

  if (usersLoading) return <DashboardSkeleton />;

  const filteredUsers = users.filter(user => {
    const matchSearch = searchTerm === '' || 
      user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (user.course?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false);
    const matchRole = roleFilter === 'all' || user.role === roleFilter;
    return matchSearch && matchRole;
  });

  const openAdd = () => {
    setEditingUser(null);
    setForm({ name: '', email: '', password: '', role: 'student', course: '', year_level: 0, section: '' });
    setIsModalOpen(true);
  };

  const openEdit = (user: User) => {
    setEditingUser(user);
    setForm({ 
      name: user.name || '', 
      email: user.email || '', 
      password: '', 
      role: user.role,
      course: user.course || '',
      year_level: (user as any).year_level || 0,
      section: (user as any).section || ''
    });
    setIsModalOpen(true);
  };

  const executeSave = async () => {
    try {
      const token = sessionStorage.getItem('auth_token');
      const payload: any = { ...form };
      if (editingUser) {
        payload.id = editingUser.id;
        const res = await fetch('/api/users', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.error);
        setUsers(prev => prev.map(u => (u.id === editingUser.id ? data.user : u)));
        displaySuccess('User updated successfully!');
      } else {
        const res = await fetch('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.error);
        setUsers(prev => [...prev, data.user]);
        displaySuccess('User created successfully!');
      }
      setIsModalOpen(false);
    } catch (err: any) {
      displayError(err.message || 'Operation failed');
    }
  };

  const saveUser = () => {
    if (!form.name?.trim() || !form.email?.trim()) return displayError('Name and email are required');
    confirmAction(executeSave, {
      title: editingUser ? 'Confirm Edit' : 'Confirm Creation',
      message: `You are about to ${editingUser ? 'update' : 'create'} a user account. Enter your password to proceed.`,
      variant: 'primary',
      confirmText: editingUser ? 'Update User' : 'Create User'
    });
  };

  const deleteUser = (id: string) => {
    confirmAction(async () => {
      try {
        const token = sessionStorage.getItem('auth_token');
        const res = await fetch(`/api/users?id=${id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.error);
        setUsers(prev => prev.filter(u => u.id !== id));
        displaySuccess('User deleted successfully!');
      } catch (err: any) {
        displayError(err.message || 'Deletion failed');
      }
    }, {
      title: 'Delete User',
      message: 'This user and their history will be permanently erased. Enter password to confirm.',
      variant: 'danger',
      confirmText: 'Delete Now'
    });
  };

  const bulkDelete = () => {
    confirmAction(async () => {
      try {
        const token = sessionStorage.getItem('auth_token');
        for (const id of selectedUsers) {
          await fetch(`/api/users?id=${id}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` }
          });
        }
        setUsers(prev => prev.filter(u => !selectedUsers.includes(u.id)));
        displaySuccess('Selected users deleted successfully!');
        setSelectedUsers([]);
      } catch (err: any) {
        displayError(err.message || 'Bulk deletion failed');
      }
    }, {
      title: 'Bulk Delete',
      message: `Delete ${selectedUsers.length} user(s)? Enter password to confirm.`,
      variant: 'danger',
      confirmText: 'Delete All'
    });
  };

  const bulkChangeRole = (newRole: User['role']) => {
    confirmAction(async () => {
      try {
        const token = sessionStorage.getItem('auth_token');
        for (const id of selectedUsers) {
          await fetch('/api/users', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ id, role: newRole })
          });
        }
        setUsers(prev => prev.map(u => selectedUsers.includes(u.id) ? { ...u, role: newRole } : u));
        displaySuccess('Roles updated successfully!');
        setSelectedUsers([]);
      } catch (err: any) {
        displayError(err.message || 'Bulk change failed');
      }
    }, {
      title: 'Bulk Change Role',
      message: `Change ${selectedUsers.length} user(s) to ${newRole}? Enter password to confirm.`,
      variant: 'primary',
      confirmText: 'Change Now'
    });
  };

  const toggleUserSelection = (id: string) => setSelectedUsers(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);

  const stats = {
    total: users.length,
    students: users.filter(u => u.role === 'student').length,
    teachers: users.filter(u => u.role === 'teacher').length,
    admins: users.filter(u => u.role === 'dean').length,
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-4xl font-black text-gray-900 dark:text-white">User Management</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1 font-medium">Manage and monitor all system accounts</p>
        </div>
        <Button variant="primary" size="lg" className="px-8 shadow-lg" onClick={openAdd}>
          <Plus className="w-5 h-5 mr-2" /> Add User
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <DashboardCard title="Total Users" value={<AnimatedCounter endValue={stats.total} />} footer="Accounts registered" icon={<Users className="w-6 h-6" />} color="indigo" />
        <DashboardCard title="Students" value={<AnimatedCounter endValue={stats.students} />} footer="Learners assigned" icon={<GraduationCap className="w-6 h-6" />} color="blue" />
        <DashboardCard title="Teachers" value={<AnimatedCounter endValue={stats.teachers} />} footer="Click to view analytics" icon={<BookOpen className="w-6 h-6" />} color="emerald" onClick={() => setIsTeacherStatsOpen(true)} />
        <DashboardCard title="Administrators" value={<AnimatedCounter endValue={stats.admins} />} footer="Secure handlers" icon={<ShieldCheck className="w-6 h-6" />} color="purple" />
      </div>

      <Card>
        <CardHeader className="border-b">
          <CardTitle>Directory</CardTitle>
          <CardDescription>Filtering {filteredUsers.length} of {users.length} total</CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="space-y-4">
            <div className="flex gap-2 flex-col md:flex-row">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                <Input placeholder="Search..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-10" autoComplete="off" />
              </div>
              <select className="px-4 py-2 rounded-lg border dark:border-gray-700 bg-white dark:bg-gray-800" value={roleFilter} onChange={e => setRoleFilter(e.target.value)}>
                <option value="all">All Roles</option>
                <option value="student">Students</option>
                <option value="teacher">Teachers</option>
                <option value="dean">Administrators</option>
              </select>
            </div>

            {selectedUsers.length > 0 && (
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg flex justify-between items-center animate-in fade-in zoom-in-95">
                <p className="text-sm font-bold text-blue-900 dark:text-blue-200">{selectedUsers.length} selected</p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => bulkChangeRole('student')}>Set Student</Button>
                  <Button variant="outline" size="sm" onClick={() => bulkChangeRole('teacher')}>Set Teacher</Button>
                  <Button variant="danger" size="sm" onClick={bulkDelete}><Trash2 className="w-4 h-4 mr-2" />Delete</Button>
                </div>
              </div>
            )}

            <DataTable
              columns={[
                { key: 'checkbox' as any, label: '', render: (_, user: User) => <Checkbox checked={selectedUsers.includes(user.id)} onChange={() => toggleUserSelection(user.id)} /> },
                { key: 'name' as any, label: 'Name' },
                { key: 'email' as any, label: 'Email' },
                { key: 'role' as any, label: 'Role', render: v => <Badge variant={v === 'teacher' ? 'success' : v === 'dean' ? 'warning' : 'default'}>{String(v).toUpperCase()}</Badge> },
                { key: 'course' as any, label: 'Program', render: v => v ? <Badge variant="outline" className="font-bold border-indigo-200 text-indigo-700 bg-indigo-50">{String(v)}</Badge> : '—' },
                { key: 'year_level' as any, label: 'Year', render: v => v ? <span className="text-sm font-semibold text-gray-700">{v}{v == 1 ? 'st' : v == 2 ? 'nd' : v == 3 ? 'rd' : 'th'}</span> : '—' },
                { key: 'section' as any, label: 'Section', render: v => v ? <Badge variant="secondary" className="font-bold bg-gray-100 text-gray-600">{String(v)}</Badge> : '—' },
                { key: 'actions' as any, label: 'Actions', render: (_, row: User) => (
                  <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                    <Button variant="outline" size="sm" onClick={() => openEdit(row)}><Edit2 className="w-4 h-4" /></Button>
                    <Button variant="danger" size="sm" onClick={() => deleteUser(row.id)}><Trash2 className="w-4 h-4" /></Button>
                  </div>
                )},
              ]}
              data={filteredUsers}
            />
          </div>
        </CardContent>
      </Card>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingUser ? 'Edit User' : 'Add User'} size="2xl">
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
            {/* Left Column: Account Identity */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2 border-b pb-1">Account Identity</h3>
              <Input label="Full Name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="John Doe" autoComplete="off" />
              <Input label="Institutional Email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="email@jmc.edu.ph" autoComplete="off" />
              <Input label="Update Password" type="password" value={form.password} placeholder={editingUser ? "(Keep empty to stay same)" : "Initial password"} onChange={e => setForm({ ...form, password: e.target.value })} autoComplete="new-password" />
            </div>
            
            {/* Right Column: Academic Details */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2 border-b pb-1">Academic Profiling</h3>
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Target Role</label>
                <select className="w-full p-2.5 rounded-xl border border-gray-200 bg-white dark:bg-gray-800 dark:border-gray-700 focus:ring-2 focus:ring-blue-500/20 transition-all cursor-pointer shadow-sm" value={form.role} onChange={e => setForm({ ...form, role: e.target.value as any })}>
                  <option value="student">Student Account</option>
                  <option value="teacher">Faculty / Teacher</option>
                  <option value="dean">System Administrator</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Assigned Program</label>
                <select className="w-full p-2.5 rounded-xl border border-gray-200 bg-white dark:bg-gray-800 dark:border-gray-700 focus:ring-2 focus:ring-blue-500/20 transition-all cursor-pointer shadow-sm" value={form.course} onChange={e => setForm({ ...form, course: e.target.value })}>
                  <option value="">N/A (Non-Student)</option>
                  <option value="BSIT">BSIT Program</option>
                  <option value="BSEMC">BSEMC Program</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Level</label>
                  <select className="w-full p-2.5 rounded-xl border border-gray-200 bg-white dark:bg-gray-800 dark:border-gray-700 focus:ring-2 focus:ring-blue-500/20 shadow-sm transition-all" value={form.year_level} onChange={e => setForm({ ...form, year_level: Number(e.target.value) })}>
                    <option value="0">N/A</option>
                    {[1, 2, 3, 4].map(y => <option key={y} value={y}>{y}{y === 1 ? 'st' : y === 2 ? 'nd' : y === 3 ? 'rd' : 'th'} Year</option>)}
                  </select>
                </div>
                <Input label="Section" value={form.section} onChange={e => setForm({ ...form, section: e.target.value.toUpperCase() })} placeholder="A/B/C" />
              </div>
            </div>
          </div>

          <div className="bg-blue-50/50 dark:bg-blue-900/10 p-4 rounded-xl border border-blue-100 dark:border-blue-900/30 flex items-start gap-3">
             <div className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 mt-0.5">!</div>
             <p className="text-xs leading-relaxed text-blue-700 dark:text-blue-400">
               <strong>Sync Notice:</strong> Modifying identity or academic details will automatically trigger an authoritative enrollment refresh for the active S.Y. period. Use caution when updating primary keys.
             </p>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" className="px-6" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button variant="primary" className="px-10 shadow-lg shadow-blue-500/10" onClick={saveUser}>Save Changes</Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={isTeacherStatsOpen} onClose={() => setIsTeacherStatsOpen(false)} title="Teacher Performance Overview" size="3xl">
        <TeacherStatsMap teachers={users.filter(u => u.role === 'teacher')} evaluations={evalData?.evaluations || []} />
      </Modal>

      <ConfirmPasswordModal isOpen={isConfirmPasswordOpen} onClose={() => setIsConfirmPasswordOpen(false)} onConfirm={pendingAction} {...confirmModalConfig} />
    </div>
  );
}
