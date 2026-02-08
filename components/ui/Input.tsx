import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export function Input({ label, className = '', ...props }: InputProps) {
  return (
    <div className="mb-5">
      {label && (
        <label className="block text-xs font-bold mb-2 uppercase tracking-wide text-primary">
          {label}
        </label>
      )}
      <input
        className={`w-full px-5 py-4 mb-0 border-2 border-border rounded-[1.25rem] font-body text-base transition-all bg-bg focus:outline-none focus:border-primary focus:bg-white focus:shadow-[0_0_0_4px_rgba(75,99,68,0.1)] disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
        {...props}
      />
    </div>
  );
}

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
}

export function Textarea({ label, className = '', ...props }: TextareaProps) {
  return (
    <div className="mb-5">
      {label && (
        <label className="block text-xs font-bold mb-2 uppercase tracking-wide text-primary">
          {label}
        </label>
      )}
      <textarea
        className={`w-full px-5 py-4 mb-0 border-2 border-border rounded-[1.25rem] font-body text-base transition-all bg-bg min-h-32 focus:outline-none focus:border-primary focus:bg-white focus:shadow-[0_0_0_4px_rgba(75,99,68,0.1)] disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
        {...props}
      />
    </div>
  );
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
}

export function Select({ label, className = '', children, ...props }: SelectProps) {
  return (
    <div className="mb-5">
      {label && (
        <label className="block text-xs font-bold mb-2 uppercase tracking-wide text-primary">
          {label}
        </label>
      )}
      <select
        className={`
          w-full px-5 py-4 mb-0 border-2 border-border rounded-[1.25rem] 
          font-body text-base transition-all bg-bg
          focus:outline-none focus:border-primary focus:bg-white focus:shadow-[0_0_0_4px_rgba(75,99,68,0.1)]
          disabled:opacity-50 disabled:cursor-not-allowed
          ${className}
        `}
        {...props}
      >
        {children}
      </select>
    </div>
  );
}
