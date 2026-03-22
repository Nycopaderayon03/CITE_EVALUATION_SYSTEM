import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export function Input({
  label,
  error,
  helperText,
  className = '',
  id,
  ...props
}: InputProps) {
  const inputId = id || `input-${Date.now().toString(36)}`;

  return (
    <div className="w-full">
      {label && (
        <label htmlFor={inputId} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={`w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 border-gray-300 dark:border-gray-600 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 dark:focus:ring-purple-900/50 transition-colors ${error ? 'border-red-500 focus:border-red-500 focus:ring-red-200' : ''} ${className}`}
        {...props}
      />
      {error && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{error}</p>}
      {helperText && !error && <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{helperText}</p>}
    </div>
  );
}
