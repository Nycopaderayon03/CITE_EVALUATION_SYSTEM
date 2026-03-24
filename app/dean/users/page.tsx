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
import type { User } from '@/types';
import { Search, Plus, Trash2, Edit2, ChevronDown, ChevronUp } from 'lucide-react';

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
          // Calculate score
          if (ev.responses && ev.responses.length > 0) {
            const sum = ev.responses.reduce((acc: number, r: any) => acc + Number(r.rating), 0);
            totalScore += sum / ev.responses.length;
            count++;
          }

          // Segregate comments
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
            >
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">{teacher.name}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">{teacherEvals.length} total evaluations</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Avg Score</p>
                  <p className="text-xl font-bold text-blue-600 dark:text-blue-400">{avgScore}</p>
                </div>
                {isExpanded ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
              </div>
            </div>

            {isExpanded && (
              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 space-y-4">
                <div>
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Student Comments ({studentComments.length})</h4>
                  {studentComments.length > 0 ? (
                    <ul className="list-disc pl-5 space-y-1">
                      {studentComments.map((c, i) => <li key={i} className="text-sm text-gray-600 dark:text-gray-400 italic">"{c}"</li>)}
                    </ul>
                  ) : <p className="text-sm text-gray-500 italic">No feedback</p>}
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Peer Comments ({peerComments.length})</h4>
                  {peerComments.length > 0 ? (
                    <ul className="list-disc pl-5 space-y-1">
                      {peerComments.map((c, i) => <li key={i} className="text-sm text-gray-600 dark:text-gray-400 italic">"{c}"</li>)}
                    </ul>
                  ) : <p className="text-sm text-gray-500 italic">No feedback</p>}
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Administrator Comments ({adminComments.length})</h4>
                  {adminComments.length > 0 ? (
                    <ul className="list-disc pl-5 space-y-1">
                      {adminComments.map((c, i) => <li key={i} className="text-sm text-gray-600 dark:text-gray-400 italic">"{c}"</li>)}
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

// users are loaded from the backend via API


export default function Users() {
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

  const displaySuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  const displayError = (msg: string) => {
    setErrorMsg(msg);
    setTimeout(() => setErrorMsg(''), 3000);
  };

  // Debug log for API response
  useEffect(() => {
    console.log('Raw usersData from API:', usersData);
    if (usersError) {
      console.error('Error fetching users:', usersError);
    }
  }, [usersData, usersError]);
  useEffect(() => {
    if (usersData?.users) {
      setUsers(usersData.users);
    }
  }, [usersData]);

  // users state is managed based on API response (this effect is now merged above)

  if (usersLoading) return <DashboardSkeleton />;


  // Filter users based on search and role filter
  const filteredUsers = users.filter(user => {
    const matchSearch = searchTerm === '' || 
      user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (user.course?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false);
    const matchRole = roleFilter === 'all' || user.role === roleFilter;
    return matchSearch && matchRole;
  });

  // Debug log for duplicate key error
  console.log('Filtered User IDs:', filteredUsers.map(u => u.id));

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
      password: '', // Blank by default, only sent if typed
      role: user.role,
      course: user.course || '',
      year_level: (user as any).year_level || 0,
      section: (user as any).section || ''
    });
    setIsModalOpen(true);
  };

  const saveUser = async () => {
    if (!form.name?.trim() || !form.email?.trim()) {
      return displayError('Name and email are required');
    }
    if (!editingUser && !form.password?.trim()) {
      return displayError('Password is required for new users');
    }

    try {
      const token = sessionStorage.getItem('auth_token');
      const url = '/api/users';
      const payload: any = {
        name: form.name,
        email: form.email,
        role: form.role,
        course: form.course || null,
        year_level: form.year_level || null,
        section: form.section || null,
        password: form.password || undefined // Only send if set
      };

      if (editingUser) {
        payload.id = editingUser.id;
        const res = await fetch(url, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.error);

        setUsers(prev => prev.map(u => (u.id === editingUser.id ? { ...u, ...payload } : u)));
        displaySuccess('User updated successfully!');
      } else {
        const res = await fetch(url, {
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

  const deleteUser = async (id: string) => {
    if (!id || !confirm('Delete this user? This action cannot be undone.')) return;
    
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
  };

  const bulkDelete = () => {
    if (!selectedUsers || selectedUsers.length === 0) {
      displayError('Please select users to delete');
      return;
    }
    if (!confirm(`Delete ${selectedUsers.length} users? This cannot be undone.`)) return;
    setUsers((prev) => prev.filter((u) => !selectedUsers.includes(u.id)));
    setSelectedUsers([]);
    displaySuccess('Users deleted successfully!');
  };

  const bulkChangeRole = (newRole: User['role']) => {
    if (!selectedUsers || selectedUsers.length === 0) {
      displayError('Please select users');
      return;
    }
    setUsers((prev) =>
      prev.map((u) => (selectedUsers.includes(u.id) ? { ...u, role: newRole } : u))
    );
    setSelectedUsers([]);
    displaySuccess(`Role updated for ${selectedUsers.length} users!`);
  };

  const toggleUserSelection = (userId: string) => {
    setSelectedUsers(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const stats = {
    total: users.length,
    students: users.filter(u => u.role === 'student').length,
    teachers: users.filter(u => u.role === 'teacher').length,
    admins: users.filter(u => u.role === 'dean').length,
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">User Management</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">Manage system users and assign roles</p>
        </div>
        <div className="flex gap-2">

          <Button variant="primary" size="lg" className="gap-2 text-lg shadow-md hover:shadow-lg transition-shadow" onClick={openAdd}>
            <Plus className="w-5 h-5" />
            Add User
          </Button>
        </div>
      </div>

      {successMsg && (
        <Alert variant="success" className="animate-in fade-in slide-in-from-top-4">
          {successMsg}
        </Alert>
      )}

      {errorMsg && (
        <Alert variant="error" className="animate-in fade-in slide-in-from-top-4">
          {errorMsg}
        </Alert>
      )}

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-gray-600 dark:text-gray-400 text-sm mb-2">Total Users</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">{stats.total}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-gray-600 dark:text-gray-400 text-sm mb-2">Students</p>
              <p className="text-3xl font-bold text-blue-600">{stats.students}</p>
            </div>
          </CardContent>
        </Card>
        <Card 
          className="cursor-pointer hover:shadow-lg transition-transform hover:-translate-y-1 ring-1 ring-transparent hover:ring-green-500/50"
          onClick={() => setIsTeacherStatsOpen(true)}
        >
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-gray-600 dark:text-gray-400 text-sm mb-2">Teachers</p>
              <p className="text-3xl font-bold text-green-600">{stats.teachers}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-gray-600 dark:text-gray-400 text-sm mb-2">Administrators</p>
              <p className="text-3xl font-bold text-purple-600">{stats.admins}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Users List */}
      <Card>
        <CardHeader className="border-b">
          <CardTitle>All Users</CardTitle>
          <CardDescription>Manage system users and their roles</CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="space-y-4">
            {/* Search and Filter */}
            <div className="flex gap-2 flex-col md:flex-row md:items-center">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Search by name or email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <select
                className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
              >
                <option value="all">All Roles</option>
                <option value="student">Students</option>
                <option value="teacher">Teachers</option>
                <option value="dean">Administrators</option>
              </select>
            </div>

            {/* Bulk Actions */}
            {selectedUsers && selectedUsers.length > 0 && (
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg flex justify-between items-center">
                <p className="text-sm font-semibold text-blue-900 dark:text-blue-200">
                  {selectedUsers.length} user{selectedUsers.length !== 1 ? 's' : ''} selected
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => bulkChangeRole('student')}
                  >
                    Make Student
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => bulkChangeRole('teacher')}
                  >
                    Make Teacher
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    className="gap-2"
                    onClick={bulkDelete}
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </Button>
                </div>
              </div>
            )}

            {/* Results Count */}
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Showing {filteredUsers.length} of {users.length} users
            </p>

            {/* Users Table */}
            <DataTable
              columns={[
                {
                  key: 'checkbox' as any,
                  label: '',
                  render: (_, user: User) => (
                    <Checkbox
                      checked={selectedUsers.includes(user.id)}
                      onChange={() => toggleUserSelection(user.id)}
                    />
                  ),
                },
                { key: 'name' as any, label: 'Name' },
                { key: 'email' as any, label: 'Email' },
                {
                  key: 'role' as any,
                  label: 'Role',
                  render: (value: any) => {
                    const role = String(value || 'student');
                    let variant: any = 'secondary';
                    if (role === 'student') variant = 'default';
                    else if (role === 'teacher') variant = 'success';
                    else if (role === 'dean') variant = 'warning';
                    return (
                      <Badge variant={variant}>
                        {role.charAt(0).toUpperCase() + role.slice(1)}
                      </Badge>
                    );
                  },
                },
                {
                  key: 'course' as any,
                  label: 'Course',
                  render: (_: any, user: User) => (
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {user.course || 'N/A'}
                    </span>
                  ),
                },
                {
                  key: 'year_level' as any,
                  label: 'Year',
                  render: (_: any, user: any) => (
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {user.year_level || 'N/A'}
                    </span>
                  ),
                },
                {
                  key: 'section' as any,
                  label: 'Section',
                  render: (_: any, user: any) => (
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {user.section || 'N/A'}
                    </span>
                  ),
                },

                {
                  key: 'actions' as any,
                  label: 'Actions',
                  render: (_: any, row: User) => (
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        onClick={(e) => {
                          e.stopPropagation();
                          openEdit(row);
                        }}
                      >
                        <Edit2 className="w-4 h-4" />
                        Edit
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        className="gap-2"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteUser(row.id);
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete
                      </Button>
                    </div>
                  ),
                },
              ]}
              data={filteredUsers.map((u) => ({ ...u, id: u.id }))}
            />
          </div>
        </CardContent>
      </Card>

      {/* Add/Edit User Modal */}
      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title={editingUser ? 'Edit User' : 'Add User'}
        size="2xl"
      >
        <div className="space-y-4">
          <Input
            label="Full Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Enter full name"
          />
          <Input
            label="Email"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="Enter email address"
          />
          <Input
            label={editingUser ? "Password (leave blank to keep current)" : "Password"}
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            placeholder={editingUser ? "••••••••" : "Enter temporary password"}
          />
          <div>
            <div className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Role
            </div>
            <select
              className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value as User['role'] })}
            >
              <option value="student">Student</option>
              <option value="teacher">Teacher</option>
            </select>
          </div>


        {form.role === 'student' && (
            <div className="space-y-4">
              <div>
                <div className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Course
                </div>
                <select
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  value={form.course}
                  onChange={(e) => setForm({ ...form, course: e.target.value })}
                >
                  <option value="">Select course</option>
                  <option value="BSIT">BSIT</option>
                  <option value="BSEMC">BSEMC</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    Year Level
                  </div>
                  <select
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    value={form.year_level || 0}
                    onChange={(e) => setForm({ ...form, year_level: Number(e.target.value) })}
                  >
                    <option value={0}>Select year</option>
                    <option value={1}>1st Year</option>
                    <option value={2}>2nd Year</option>
                    <option value={3}>3rd Year</option>
                    <option value={4}>4th Year</option>
                  </select>
                </div>
                <div>
                  <div className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    Section
                  </div>
                  <select
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    value={form.section || ''}
                    onChange={(e) => setForm({ ...form, section: e.target.value })}
                  >
                    <option value="">Select section</option>
                    <option value="A">A</option>
                    <option value="B">B</option>
                    <option value="C">C</option>
                    <option value="D">D</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
            <Button variant="secondary" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={saveUser}>
              {editingUser ? 'Save Changes' : 'Create User'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Teacher Stats Modal */}
      <Modal 
        isOpen={isTeacherStatsOpen} 
        onClose={() => setIsTeacherStatsOpen(false)} 
        title="Instructor Analytics & Feedback"
        size="3xl"
      >
        <TeacherStatsMap 
          teachers={users.filter(u => String(u.role).toLowerCase() === 'teacher')} 
          evaluations={evalData?.evaluations || []} 
        />
        <div className="flex justify-end pt-4 mt-6 border-t border-gray-200 dark:border-gray-700">
          <Button variant="secondary" onClick={() => setIsTeacherStatsOpen(false)}>Close</Button>
        </div>
      </Modal>
    </div>
  );
}
