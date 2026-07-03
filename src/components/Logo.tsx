import React from 'react';

interface LogoProps {
  className?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
}

export default function Logo({ className = '', size = 'md' }: LogoProps) {
  const sizeClasses = {
    xs: {
      text: 'text-base',
      stripe: 'h-0.5',
      gap: 'gap-[1px]',
      mb: 'mb-0.5'
    },
    sm: {
      text: 'text-lg',
      stripe: 'h-1',
      gap: 'gap-[1px]',
      mb: 'mb-0.5'
    },
    md: {
      text: 'text-2xl',
      stripe: 'h-1.5',
      gap: 'gap-[2px]',
      mb: 'mb-1'
    },
    lg: {
      text: 'text-4xl',
      stripe: 'h-2.5',
      gap: 'gap-[3px]',
      mb: 'mb-1.5'
    }
  };

  const s = sizeClasses[size];

  return (
    <div className={`flex flex-col items-start ${className}`}>
      <div className={`${s.text} font-bold text-[#6B6B6B] tracking-tight leading-none ${s.mb}`}>
        RQ OPERATIONS
      </div>
      <div className={`w-full flex flex-col ${s.gap}`}>
        <div className={`w-full ${s.stripe} bg-[#E2D670]`}></div>
        <div className={`w-full ${s.stripe} bg-[#4A4A4A]`}></div>
      </div>
    </div>
  );
}
