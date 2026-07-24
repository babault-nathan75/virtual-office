'use client';

import { forwardRef, ButtonHTMLAttributes } from 'react';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
};

const variants = {
  primary: 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-200 dark:shadow-blue-900/30',
  secondary: 'bg-slate-100 dark:bg-gray-700 text-slate-700 dark:text-gray-200 hover:bg-slate-200 dark:hover:bg-gray-600',
  danger: 'bg-red-500 text-white hover:bg-red-600 shadow-lg shadow-red-200 dark:shadow-red-900/30',
  ghost: 'bg-transparent text-slate-600 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-gray-700',
};

const sizes = {
  sm: 'px-3 py-1.5 text-xs rounded-lg min-h-[32px]',
  md: 'px-4 py-2.5 text-sm rounded-xl min-h-[40px]',
  lg: 'px-6 py-3 text-base rounded-xl min-h-[48px]',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', className = '', children, ...props }, ref) => (
    <button ref={ref} className={`font-bold transition inline-flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed ${variants[variant]} ${sizes[size]} ${className}`} {...props}>
      {children}
    </button>
  )
);
Button.displayName = 'Button';

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & { label?: string; error?: string };

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className = '', ...props }, ref) => (
    <div className="space-y-1">
      {label && <label className="text-xs font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider">{label}</label>}
      <input ref={ref} className={`w-full px-4 py-3 bg-slate-50 dark:bg-gray-700 border border-slate-200 dark:border-gray-600 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition text-slate-900 dark:text-white min-h-[44px] ${error ? 'border-red-400 focus:ring-red-500' : ''} ${className}`} {...props} />
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
);
Input.displayName = 'Input';

export function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-white dark:bg-gray-800 rounded-2xl border border-slate-100 dark:border-gray-700 shadow-sm ${className}`}>{children}</div>;
}

export function Badge({ children, variant = 'default', className = '' }: { children: React.ReactNode; variant?: 'default' | 'success' | 'warning' | 'danger' | 'info'; className?: string }) {
  const styles = {
    default: 'bg-slate-100 dark:bg-gray-700 text-slate-600 dark:text-gray-300',
    success: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400',
    warning: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
    danger: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
    info: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
  };
  return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold ${styles[variant]} ${className}`}>{children}</span>;
}

const AVATAR_SIZES: Record<number, string> = { 8: 'w-8 h-8', 10: 'w-10 h-10', 12: 'w-12 h-12', 14: 'w-14 h-14', 16: 'w-16 h-16', 20: 'w-20 h-20' };

export function Avatar({ src, name, size = 10, className = '' }: { src?: string | null; name: string; size?: number; className?: string }) {
  const initials = name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  const sizeClass = AVATAR_SIZES[size] || 'w-10 h-10';
  if (src) {
    return <img src={src} alt={name} className={`${sizeClass} rounded-full object-cover border border-slate-200 dark:border-gray-600 shrink-0 ${className}`} />;
  }
  return (
    <div className={`${sizeClass} rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center text-xs font-bold shrink-0 ${className}`}>
      {initials}
    </div>
  );
}

export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-slate-100 dark:border-gray-700 max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-black text-slate-900 dark:text-white">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-gray-200 text-xl leading-none">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function EmptyState({ icon, title, description, action }: { icon: string; title: string; description: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="w-20 h-20 rounded-full bg-slate-100 dark:bg-gray-700 flex items-center justify-center text-4xl mb-4">{icon}</div>
      <p className="font-bold text-slate-500 dark:text-gray-300 text-lg">{title}</p>
      <p className="text-sm text-slate-400 dark:text-gray-500 mt-1 max-w-sm">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
