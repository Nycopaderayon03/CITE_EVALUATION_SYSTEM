'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Alert } from '@/components/ui/Alert';
import { Mail, Save, Lock, CheckCircle, Shield, User } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';

export default function DeanProfile() {
  const { user, token, setUserFromApi } = useAuth();
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);

  const [profileData, setProfileData] = useState({
    fullName: '',
    email: '',
  });

  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordData, setPasswordData] = useState({ old: '', new: '', confirm: '' });
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');

  // Sync state when user loads
  useEffect(() => {
    if (user) {
      setProfileData({
        fullName: user.name || '',
        email: user.email || '',
      });
    }
  }, [user]);

  const handleEditProfile = () => {
    setIsEditingProfile(true);
    setProfileSaved(false);
  };

  const handleSaveProfile = async () => {
    try {
      const res = await fetch('/api/users', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: profileData.fullName }),
      });
      const data = await res.json();
      if (data.success && data.user) {
        setUserFromApi(data.user);
      }
      setIsEditingProfile(false);
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 3000);
    } catch (error) {
      console.error('Failed to save profile:', error);
    }
  };

  const handleSavePassword = async () => {
    if (!passwordData.old) { setPasswordError('Old password is required'); return; }
    if (passwordData.new.length < 8) { setPasswordError('Password must be at least 8 characters'); return; }
    if (passwordData.new !== passwordData.confirm) { setPasswordError('Passwords do not match'); return; }
    setPasswordError('');

    try {
      const res = await fetch('/api/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ password: passwordData.new, oldPassword: passwordData.old }),
      });
      const data = await res.json();
      if (data.success) {
        setPasswordSuccess('Password changed successfully!');
        setTimeout(() => { setIsChangingPassword(false); setPasswordSuccess(''); setPasswordData({ old: '', new: '', confirm: '' }); }, 2000);
      } else {
        setPasswordError(data.error || 'Failed to change password. Please try again.');
      }
    } catch {
      setPasswordError('Server error.');
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Admin Profile</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          View and manage your personal administrator information and security settings
        </p>
      </div>

      {profileSaved && (
        <Alert variant="success" title="Success">
          Profile updated successfully!
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Avatar & ID Card (Sidebar) */}
        <div className="lg:col-span-1">
          <Card className="h-full">
            <CardContent className="pt-8 pb-8 flex flex-col items-center justify-center text-center space-y-4">
              <div className="w-24 h-24 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center shadow-inner">
                <span className="text-4xl font-bold text-blue-600 dark:text-blue-400">
                  {user?.name?.charAt(0) || 'A'}
                </span>
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">{user?.name}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">{user?.email}</p>
                <div className="flex justify-center flex-wrap">
                  <Badge variant="success">Active Administrator</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Details & Actions (Main Column) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Personal Information */}
          <Card>
            <CardHeader className="pb-4 border-b border-gray-100 dark:border-gray-800">
              <CardTitle className="flex items-center gap-2 text-lg">
                <User className="w-5 h-5 text-blue-600" />
                Personal Information
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              {!isEditingProfile ? (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-2">
                        <User className="w-4 h-4" /> Full Name
                      </p>
                      <p className="font-semibold text-gray-900 dark:text-white">
                        {user?.name}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-2">
                        <Mail className="w-4 h-4" /> Email Address
                      </p>
                      <p className="font-semibold text-gray-900 dark:text-white">
                        {user?.email}
                      </p>
                    </div>
                  </div>

                  <div className="mt-8 pt-6 border-t border-gray-100 dark:border-gray-800">
                    <Button variant="outline" onClick={handleEditProfile} className="gap-2">
                      <CheckCircle className="w-4 h-4" />
                      Edit Profile
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-4">
                    <div>
                      <div className="text-sm font-semibold text-gray-900 dark:text-white block mb-2">Full Name</div>
                      <Input
                        value={profileData.fullName}
                        onChange={(e) => setProfileData({ ...profileData, fullName: e.target.value })}
                        placeholder="Your full name"
                      />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-gray-900 dark:text-white block mb-2">Email</div>
                      <Input
                        value={profileData.email}
                        disabled
                        type="email"
                        placeholder="Your email"
                      />
                      <p className="text-xs text-gray-500 mt-1">Contact your system administrator to change your core email.</p>
                    </div>
                  </div>

                  <div className="mt-8 pt-6 border-t border-gray-100 dark:border-gray-800 flex gap-3">
                    <Button variant="primary" onClick={handleSaveProfile} className="gap-2">
                      <Save className="w-4 h-4" />
                      Save Changes
                    </Button>
                    <Button variant="outline" onClick={() => setIsEditingProfile(false)}>
                      Cancel
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Account Security */}
          <Card>
            <CardHeader className="pb-4 border-b border-gray-100 dark:border-gray-800">
              <CardTitle className="flex items-center gap-2 text-lg text-red-900 dark:text-red-400">
                <Shield className="w-5 h-5" />
                Account Security
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">Password Authentication</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 max-w-sm">
                    Ensure your account is using a long, random password to stay secure.
                  </p>
                </div>
                <Button variant="outline" onClick={() => setIsChangingPassword(true)} className="gap-2 shrink-0">
                  <Lock className="w-4 h-4" />
                  Change Password
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Change Password Modal */}
      <Modal 
        isOpen={isChangingPassword} 
        onClose={() => setIsChangingPassword(false)} 
        title="Change Password"
      >
        <div className="space-y-4">
          {passwordError && <Alert variant="error" title="Error">{passwordError}</Alert>}
          {passwordSuccess && <Alert variant="success" title="Success">{passwordSuccess}</Alert>}
          <Input
            label="Old Password"
            type="password"
            value={passwordData.old}
            onChange={(e) => setPasswordData({ ...passwordData, old: e.target.value })}
            placeholder="••••••••"
          />
          <Input
            label="New Password"
            type="password"
            value={passwordData.new}
            onChange={(e) => setPasswordData({ ...passwordData, new: e.target.value })}
            placeholder="••••••••"
          />
          <Input
            label="Confirm Password"
            type="password"
            value={passwordData.confirm}
            onChange={(e) => setPasswordData({ ...passwordData, confirm: e.target.value })}
            placeholder="••••••••"
          />
          <div className="flex justify-end gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
            <Button variant="secondary" onClick={() => setIsChangingPassword(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleSavePassword}>Save Password</Button>
          </div>
        </div>
      </Modal>

    </div>
  );
}
