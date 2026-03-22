import React from 'react';

interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function Checkbox({ label, error, id, className = '', ...props }: CheckboxProps) {
  const checkboxId = id || `checkbox-${Date.now().toString(36)}`;

  return (
    <div className="flex items-center">
      <input
        id={checkboxId}
        type="checkbox"
        className={`w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-2 focus:ring-purple-500 dark:focus:ring-purple-400 dark:bg-gray-700 dark:border-gray-600 cursor-pointer ${className}`}
        {...props}
      />
      {label && (
        <label htmlFor={checkboxId} className="ml-2 text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer">
          {label}
        </label>
      )}
      {error && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
