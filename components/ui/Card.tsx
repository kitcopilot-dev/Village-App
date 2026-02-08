import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  hoverable?: boolean;
  accent?: 'sage' | 'terracotta' | 'mustard' | 'none';
  style?: React.CSSProperties;
}

export function Card({ children, className = '', hoverable = false, accent = 'none', style }: CardProps) {
  const accentColors = {
    sage: 'before:bg-primary-light',
    terracotta: 'before:bg-secondary',
    mustard: 'before:bg-accent',
    none: ''
  };

  const accentBar = accent !== 'none' 
    ? `before:content-[''] before:absolute before:top-0 before:left-0 before:w-full before:h-1.5 before:rounded-t-3xl ${accentColors[accent]}`
    : '';

  return (
    <div 
      className={`
        bg-card rounded-[1.5rem] md:rounded-[2rem] p-6 md:p-12 shadow-[0_10px_30px_-10px_rgba(75,99,68,0.12)] 
        border border-border relative overflow-hidden
        ${hoverable ? 'transition-all duration-400 hover:-translate-y-2 hover:shadow-[0_20px_40px_-15px_rgba(75,99,68,0.2)] hover:border-primary-light' : ''}
        ${accentBar}
        ${className}
      `}
      style={style}
    >
      {children}
    </div>
  );
}
