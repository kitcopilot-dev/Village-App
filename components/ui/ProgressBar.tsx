import React from 'react';

interface ProgressBarProps {
  label?: string;
  sublabel?: string;
  percentage: number;
  showPercentage?: boolean;
  color?: 'primary' | 'secondary' | 'accent';
  className?: string;
}

export function ProgressBar({ 
  label,
  sublabel, 
  percentage, 
  showPercentage = true,
  color = 'primary',
  className = ''
}: ProgressBarProps) {
  const colors = {
    primary: 'bg-gradient-to-r from-primary to-primary-light',
    secondary: 'bg-gradient-to-r from-secondary to-secondary-hover',
    accent: 'bg-gradient-to-r from-accent to-accent-soft'
  };

  return (
    <div className={`mb-8 ${className}`}>
      {(label || showPercentage) && (
        <div className="flex justify-between items-center mb-3">
          <div>
            {label && <span className="text-sm font-semibold text-text-main">{label}</span>}
            {sublabel && <span className="text-xs text-text-muted ml-2">{sublabel}</span>}
          </div>
          {showPercentage && <span className="text-sm font-bold text-primary">{Math.round(percentage)}%</span>}
        </div>
      )}
      <div className="h-3.5 bg-bg-alt rounded-full overflow-hidden border border-border">
        <div 
          className={`h-full rounded-full transition-all duration-500 ${colors[color]}`}
          style={{ width: `${Math.min(100, Math.max(0, percentage))}%` }}
        />
      </div>
    </div>
  );
}
