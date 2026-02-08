import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
}

export function Button({ 
  variant = 'primary', 
  size = 'md', 
  children, 
  className = '',
  ...props 
}: ButtonProps) {
  const baseStyles = 'font-bold rounded-full border-none cursor-pointer transition-all inline-flex items-center justify-center tracking-wide disabled:opacity-50 disabled:cursor-not-allowed';
  
  const variants = {
    primary: 'bg-primary text-white hover:bg-primary-dark hover:shadow-hover hover:-translate-y-1 hover:scale-105 active:translate-y-0 active:scale-95',
    secondary: 'bg-secondary text-white hover:bg-secondary-hover hover:shadow-hover hover:-translate-y-1 hover:scale-105 active:translate-y-0 active:scale-95',
    outline: 'bg-transparent text-text-muted border-2 border-border hover:bg-bg-alt hover:text-text active:scale-95',
    ghost: 'bg-bg-alt text-text border-2 border-border hover:bg-white hover:border-primary active:scale-95'
  };
  
  const sizes = {
    sm: 'px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm',
    md: 'px-5 py-3 sm:px-8 sm:py-4 text-sm sm:text-base',
    lg: 'px-8 py-4 sm:px-10 sm:py-5 text-base sm:text-lg'
  };
  
  return (
    <button 
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
