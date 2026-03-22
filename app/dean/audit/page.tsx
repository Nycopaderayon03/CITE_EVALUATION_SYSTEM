'use client';

import { useState } from 'react';
import { DashboardSkeleton } from '@/components/loading/Skeletons';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { DataTable } from '@/components/DataTable';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useFetch } from '@/hooks';
import { formatDateTime } from '@/utils/helpers';
import { Search, Filter } from 'lucide-react';

export default function AuditLogs() {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterAction, setFilterAction] = useState('all');
  const [filterUser, setFilterUser] = useState('all');

  const { data: auditData, loading: auditLoading } = useFetch<any>('/audit');
  const logs = auditData?.logs || [];

  const getActionColor = (action: string) => {
    switch (action) {
      case 'login':
        return 'secondary';
      case 'submit':
        return 'success';
      case 'create':
        return 'warning';
      case 'delete':
        return 'destructive';
      default:
        return 'default';
    }
  };

  // Filter logs
  const filteredLogs = logs.filter((log: any) => {
    const matchSearch = searchTerm === '' ||
      (log.user?.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.action.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchAction = filterAction === 'all' || log.action === filterAction;
    const matchUser = filterUser === 'all' || log.user?.id === filterUser;
    
    return matchSearch && matchAction && matchUser;
  });


  const uniqueUsers = [...new Set(logs.map((log: any) => log.user?.id))].filter(Boolean);
  const uniqueActions = [...new Set(logs.map((log: any) => log.action))];

  if (auditLoading) return <DashboardSkeleton />;
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Audit Logs</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Track all system activities and user actions
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3">
          <Card>
        <CardHeader className="border-b">
          <CardTitle>Activity Log</CardTitle>
          <CardDescription>All system activities sorted by timestamp</CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="space-y-4">
            {/* Search and Filters */}
            <div className="flex gap-2 flex-col md:flex-row md:items-center flex-wrap">
              <div className="flex-1 min-w-48 relative">
                <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Search by user or action..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <select
                className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                value={filterAction}
                onChange={(e) => setFilterAction(e.target.value)}
              >
                <option value="all">All Actions</option>
                {uniqueActions.map((action: unknown) => (
                  <option key={String(action)} value={String(action)}>
                    {String(action).toUpperCase()}
                  </option>
                ))}
              </select>
            </div>

            {/* Results Count */}
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Showing {filteredLogs.length} of {logs.length} activities
            </p>

            {/* Logs Table */}
            <DataTable
              columns={[
                {
                  key: 'timestamp' as any,
                  label: 'Timestamp',
                  render: (_: any, log: any) => {
                    const ts = log.timestamp ?? log.createdAt;
                    if (!ts) return 'N/A';
                    const date = new Date(ts);
                    if (Number.isNaN(date.getTime())) return 'Invalid date';
                    return formatDateTime(date);
                  },
                },
                {
                  key: 'user' as any,
                  label: 'User',
                  render: (_, data: any) => (
                    <span className="font-medium text-gray-900 dark:text-white">
                      {data.user?.name}
                    </span>
                  ),
                },
                {
                  key: 'action' as any,
                  label: 'Action',
                  render: (action: any) => (
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {action}
                    </span>
                  ),
                },

              ]}
              data={filteredLogs.map((log: any) => ({ ...log, id: log.id }))}
            />
          </div>
          </CardContent>
        </Card>
        </div>

        <div className="lg:col-span-1 space-y-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-gray-600 dark:text-gray-400 text-sm mb-2">Total Activities</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white">{logs.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-gray-600 dark:text-gray-400 text-sm mb-2">Logins</p>
                <p className="text-3xl font-bold text-blue-600">
                  {logs.filter((l: any) => String(l.action ?? '').toLowerCase() === 'login').length}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
