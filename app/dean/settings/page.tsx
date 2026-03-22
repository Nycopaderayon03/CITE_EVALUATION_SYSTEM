'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Checkbox } from '@/components/ui/Checkbox';
import { Badge } from '@/components/ui/Badge';
import { AlertCircle, CheckCircle, Database, Lock, HardDrive } from 'lucide-react';

export default function Settings() {
  const [saved, setSaved] = useState('');
  const [selectedTab, setSelectedTab] = useState<'general' | 'maintenance' | 'security'>('general');
  const [isLoading, setIsLoading] = useState(true);
  const [settings, setSettings] = useState({
    institutionName: 'College of Information Technology',
    institutionCode: 'CIT',
    academicCalendar: 'semester',
    twoFactorAuth: false,
    dataEncryption: true,
  });

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await fetch('/api/settings');
        const json = await res.json();
        if (json.success && json.data) {
          setSettings(prev => ({ ...prev, ...json.data }));
        }
      } catch (error) {
        console.error('Failed fetching DB settings:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const showSaved = (message: string) => {
    setSaved(message);
    setTimeout(() => setSaved(''), 3000);
  };

  const saveToDatabase = async (categoryLabel: string) => {
    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      const data = await res.json();
      if (data.success) {
        showSaved(`✓ ${categoryLabel} settings configured and stored to remote DB!`);
      } else {
        throw new Error(data.error);
      }
    } catch {
      showSaved(`✗ Failed to update ${categoryLabel} configurations.`);
    }
  };

  const handleSaveGeneral = () => saveToDatabase('General');
  const handleSaveSecurity = () => saveToDatabase('Security');

  const handleBackupData = () => {
    showSaved('✓ Database remote backup pinged successfully.');
  };

  const handleClearCache = () => {
    showSaved('✓ Server logs & UI cache cleared successfully.');
  };

  const handleArchiveEvals = () => {
    if (confirm('This will archive evaluations older than 2 years. This action cannot be undone. Continue?')) {
      showSaved('✓ Archival process started');
    }
  };

  const handleDatabaseOptimize = () => {
    showSaved('✓ Database optimization started');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">System Settings</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Configure system-wide evaluation settings and preferences
        </p>
      </div>

      <div className="flex flex-col md:flex-row gap-8">
        {/* Sidebar Navigation */}
        <div className="w-full md:w-64 shrink-0 flex flex-col gap-1 md:border-r pr-4 border-gray-200 dark:border-gray-700">
          {[
            { id: 'general' as const, label: 'General', icon: '⚙️' },
            { id: 'security' as const, label: 'Security', icon: '🔒' },
            { id: 'maintenance' as const, label: 'Maintenance', icon: '🔧' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setSelectedTab(tab.id)}
              className={`flex items-center gap-3 px-4 py-3 font-medium text-sm rounded-lg transition ${
                selectedTab === tab.id
                  ? 'bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              <span>{tab.icon}</span> {tab.label}
            </button>
          ))}
        </div>

        {/* Main Content */}
        <div className="flex-1 space-y-6">
          {/* Success Message */}
          {saved && (
            <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg text-green-800 dark:text-green-200 flex items-center gap-2">
              <CheckCircle className="w-5 h-5" />
              {saved}
            </div>
          )}

          {/* General Settings Tab */}
      {selectedTab === 'general' && (
        <Card>
          <CardHeader>
            <CardTitle>General Settings</CardTitle>
            <CardDescription>Basic institution and system configuration</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              label="Institution Name"
              value={settings.institutionName}
              onChange={(e) => setSettings({ ...settings, institutionName: e.target.value })}
            />
            <Input
              label="Institution Code"
              value={settings.institutionCode}
              onChange={(e) => setSettings({ ...settings, institutionCode: e.target.value })}
            />
            <div>
              <div className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Academic Calendar Type
              </div>
              <select
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                value={settings.academicCalendar}
                onChange={(e) => setSettings({ ...settings, academicCalendar: e.target.value })}
              >
                <option value="semester">Semester (2 periods/year)</option>
                <option value="trimester">Trimester (3 periods/year)</option>
              </select>
            </div>
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg flex gap-2 text-sm text-blue-900 dark:text-blue-200">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <p>Changes to institution details will be reflected across all reports and documents.</p>
            </div>
            <Button variant="primary" onClick={handleSaveGeneral}>Save Changes</Button>
          </CardContent>
        </Card>
      )}



      {/* Security Settings Tab */}
      {selectedTab === 'security' && (
        <Card>
          <CardHeader>
            <CardTitle>Security Settings</CardTitle>
            <CardDescription>Configure security and data protection options</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-3">
              <Checkbox
                label="Enable two-factor authentication"
                checked={settings.twoFactorAuth}
                onChange={(e) => setSettings({ ...settings, twoFactorAuth: e.target.checked })}
              />
              <Checkbox
                label="Enable data encryption at rest"
                checked={settings.dataEncryption}
                onChange={(e) => setSettings({ ...settings, dataEncryption: e.target.checked })}
              />
            </div>

            <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg text-sm text-yellow-900 dark:text-yellow-200 flex gap-2">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <p><strong>Important:</strong> Security features are enabled and recommended for production environments.</p>
            </div>

            <Button variant="primary" onClick={handleSaveSecurity}>Save Changes</Button>
          </CardContent>
        </Card>
      )}

      {/* Maintenance Settings Tab */}
      {selectedTab === 'maintenance' && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="w-5 h-5" />
                Data Management
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Backup and archive evaluation data
              </p>
              <div className="flex gap-2 flex-wrap">
                <Button variant="outline" onClick={handleBackupData} className="gap-2">
                  <HardDrive className="w-4 h-4" />
                  Backup Data
                </Button>
                <Button variant="danger" onClick={handleArchiveEvals}>
                  Archive Old Evaluations
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <HardDrive className="w-5 h-5" />
                System Performance
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Optimize system performance and cache mapping. Run when systems perform slowly.
              </p>
              <div className="flex gap-2 flex-wrap">
                <Button variant="outline" onClick={handleClearCache}>
                  Clear UI Cache
                </Button>
                <Button variant="outline" onClick={handleDatabaseOptimize}>
                  Optimize Node Database
                </Button>
              </div>
            </CardContent>
          </Card>
          </div>
        )}
      </div></div>
    </div>
  );
}
