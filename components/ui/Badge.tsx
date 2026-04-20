import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'accent' | 'outline' | 'success' | 'warning' | 'error';
  className?: string;
}

export function Badge({ 
  children, 
  variant = 'primary', 
  className = '' 
}: BadgeProps) {
  const variants = {
    primary: 'bg-primary/10 text-primary border-primary/20',
    secondary: 'bg-secondary/10 text-secondary border-secondary/20',
    accent: 'bg-accent/10 text-accent border-accent/20',
    outline: 'bg-transparent text-text-muted border-border',
    success: 'bg-green-500/10 text-green-600 border-green-200',
    warning: 'bg-yellow-500/10 text-yellow-600 border-yellow-200',
    error: 'bg-red-500/10 text-red-600 border-red-200',
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${variants[variant]} ${className}`}>
      {children}
    </span>
  );
}
