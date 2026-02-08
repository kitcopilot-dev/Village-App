import React from 'react';

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  color?: 'primary' | 'secondary' | 'white';
}

export function Spinner({ size = 'md', color = 'primary' }: SpinnerProps) {
  const sizes = {
    sm: 'w-4 h-4 border-2',
    md: 'w-8 h-8 border-3',
    lg: 'w-12 h-12 border-4'
  };

  const colors = {
    primary: 'border-primary border-t-transparent',
    secondary: 'border-secondary border-t-transparent',
    white: 'border-white border-t-transparent'
  };

  return (
    <div
      className={`${sizes[size]} ${colors[color]} rounded-full animate-spin`}
      role="status"
      aria-label="Loading"
    />
  );
}

export function LoadingScreen({ message = 'Loading...' }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <Spinner size="lg" />
      <p className="mt-4 text-text-muted">{message}</p>
    </div>
  );
}
