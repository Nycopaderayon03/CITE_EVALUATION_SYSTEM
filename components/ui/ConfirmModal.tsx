import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Modal } from './Modal';
import { Button } from './Button';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'default';
  loading?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl';
}

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title = 'Confirm Action',
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  loading = false,
  size = 'md',
}: ConfirmModalProps) {
  const iconColor = variant === 'danger'
    ? 'text-red-600 bg-red-100 dark:bg-red-900/30'
    : variant === 'warning'
    ? 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30'
    : 'text-blue-600 bg-blue-100 dark:bg-blue-900/30';

  const buttonVariant = variant === 'danger' ? 'danger' : 'primary';

  return (
    <Modal isOpen={isOpen} onClose={onClose} size={size}>
      <div className="flex flex-col items-center text-center">
        <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 ${iconColor}`}>
          <AlertTriangle className="w-6 h-6" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{title}</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-line">{message}</p>
        <div className="flex gap-3 mt-6 w-full">
          <Button variant="outline" className="flex-1" onClick={onClose} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button variant={buttonVariant} className="flex-1" onClick={onConfirm} disabled={loading} isLoading={loading}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// Hook for simple confirm/cancel flows
export function useConfirmModal() {
  const [state, setState] = React.useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel: string;
    variant: 'danger' | 'warning' | 'default';
    size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl';
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: 'Confirm Action',
    message: '',
    confirmLabel: 'Confirm',
    variant: 'danger',
    size: 'md',
    onConfirm: () => {},
  });

  const confirm = (options: {
    title?: string;
    message: string;
    confirmLabel?: string;
    variant?: 'danger' | 'warning' | 'default';
    size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl';
    onConfirm: () => void;
  }) => {
    setState({
      isOpen: true,
      title: options.title || 'Confirm Action',
      message: options.message,
      confirmLabel: options.confirmLabel || 'Confirm',
      variant: options.variant || 'danger',
      size: options.size || 'md',
      onConfirm: options.onConfirm,
    });
  };

  const close = () => setState(prev => ({ ...prev, isOpen: false }));

  const modalProps = {
    isOpen: state.isOpen,
    onClose: close,
    onConfirm: () => { state.onConfirm(); close(); },
    title: state.title,
    message: state.message,
    confirmLabel: state.confirmLabel,
    variant: state.variant,
    size: state.size,
  };

  return { confirm, modalProps, ConfirmModal };
}
