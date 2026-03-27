'use client';

import { useState, useEffect } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { Input } from './Input';
import { Alert } from './Alert';
import { ShieldCheck, Loader2 } from 'lucide-react';

interface ConfirmPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  message?: string;
  confirmText?: string;
  variant?: 'danger' | 'primary';
}

export function ConfirmPasswordModal({
  isOpen,
  onClose,
  onConfirm,
  title = 'Confirm Action',
  message = 'Please enter your administrator password to proceed with this sensitive action.',
  confirmText = 'Confirm Action',
  variant = 'primary'
}: ConfirmPasswordModalProps) {
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Clear password when modal opens
  useEffect(() => {
    if (isOpen) {
      setPassword('');
      setError('');
    }
  }, [isOpen]);

  const handleConfirm = async () => {
    if (!password) {
      setError('Password is required');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const token = sessionStorage.getItem('auth_token');
      const res = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ password })
      });

      const data = await res.json();
      if (!data.success || !data.isValid) {
        throw new Error(data.error || 'Incorrect administrator password');
      }

      // Success
      setPassword('');
      onConfirm();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Verification failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="md">
      <div className="space-y-4">
        <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg text-blue-800 dark:text-blue-200">
          <ShieldCheck className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm font-medium">{message}</p>
        </div>

        {error && (
          <Alert variant="error" className="py-2.5">
            {error}
          </Alert>
        )}

        <form 
          onSubmit={(e) => { e.preventDefault(); handleConfirm(); }}
          className="space-y-4 pt-2"
          autoComplete="off"
        >
          <Input
            label="Administrator Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoFocus
            autoComplete="new-password"
            name="verification_security_challenge_key"
          />

          <div className="flex gap-2 pt-2">
            <Button type="button" variant="secondary" className="flex-1" onClick={onClose} disabled={isLoading}>
              Cancel
            </Button>
            <Button 
              type="submit"
              variant={variant} 
              className="flex-1 gap-2" 
              disabled={isLoading}
              isLoading={isLoading}
            >
              Confirm Now
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  );
}
