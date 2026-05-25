import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

const cn = (...inputs) => twMerge(clsx(inputs));

export const Button = ({ className, variant = 'primary', size = 'md', children, ...props }) => {
  const variants = {
    primary: 'kura-primary-button',
    secondary: 'kura-secondary-button',
    outline:
      'rounded-xl border border-premium-lilac/40 bg-transparent text-premium-purple-plum transition-colors duration-200 hover:bg-premium-lilac-light',
    ghost:
      'rounded-xl bg-transparent text-premium-purple-plum/70 transition-colors duration-200 hover:bg-premium-lilac-light hover:text-premium-purple-plum',
    pearl:
      'rounded-xl border border-premium-lilac/40 bg-premium-pearl text-premium-purple-plum transition-colors duration-200 hover:bg-premium-lilac-light',
    gold: 'rounded-xl border border-premium-champagne-gold/30 bg-premium-champagne-soft text-premium-purple-plum transition-colors duration-200 hover:bg-premium-champagne',
    danger: 'kura-danger-button',
  };

  const sizes = {
    sm: 'rounded-lg px-3 py-1.5 text-xs',
    md: 'rounded-lg px-4 py-2.5 text-sm',
    lg: 'rounded-xl px-6 py-3 text-base',
  };

  return (
    <button
      className={cn(
        'flex items-center justify-center gap-2 font-semibold transition-colors duration-200',
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
};

export const Badge = ({ children, variant = 'info', className }) => {
  const variants = {
    info: 'kura-badge',
    success: 'bg-emerald-50/80 text-emerald-700 border-emerald-100/50',
    warning: 'bg-amber-50/80 text-amber-700 border-amber-100/50',
    error: 'bg-rose-50/80 text-rose-700 border-rose-100/50',
    premium: 'kura-badge',
    gold: 'kura-gold-badge',
  };

  return (
    <span
      className={cn(
        'rounded-lg border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em]',
        variants[variant],
        className
      )}
    >
      {children}
    </span>
  );
};

export const Card = ({
  children,
  className,
  title,
  subtitle,
  footer,
  headerAction,
  tone = 'light',
}) => {
  const isDark = tone === 'dark';

  return (
    <div
      className={cn(
        isDark
          ? 'overflow-hidden rounded-2xl border border-white/10 bg-premium-indigo-deep/80 text-premium-lilac-light shadow-premium-ambient backdrop-blur-xl'
          : 'kura-card',
        className
      )}
    >
      {(title || subtitle || headerAction) && (
        <div
          className={cn(
            'flex items-center justify-between border-b px-6 py-4',
            isDark ? 'border-white/10' : 'border-premium-lilac/25'
          )}
        >
          <div>
            {title && (
              <h3
                className={cn(
                  'text-lg font-semibold leading-tight',
                  isDark ? 'text-white' : 'kura-heading'
                )}
              >
                {title}
              </h3>
            )}
            {subtitle && (
              <p
                className={cn(
                  'mt-1 text-[11px] font-semibold uppercase tracking-[0.1em]',
                  isDark ? 'text-premium-lilac-light/80' : 'text-premium-champagne-gold/90'
                )}
              >
                {subtitle}
              </p>
            )}
          </div>
          {headerAction && <div className="ml-4">{headerAction}</div>}
        </div>
      )}
      <div className={cn('px-6 py-5', isDark && 'text-premium-lilac-light')}>{children}</div>
      {footer && (
        <div
          className={cn(
            'border-t px-6 py-4',
            isDark
              ? 'border-white/10 bg-white/5'
              : 'border-premium-lilac/25 bg-premium-lilac-light/40'
          )}
        >
          {footer}
        </div>
      )}
    </div>
  );
};

export const Input = ({ label, error, tone = 'light', className, labelClassName, ...props }) => {
  const isDark = tone === 'dark';

  return (
    <div className="space-y-2">
      {label && (
        <label
          className={cn(
            'ml-1 text-[11px] font-semibold uppercase tracking-[0.08em]',
            isDark ? 'text-premium-lilac-light/80' : 'kura-label',
            labelClassName
          )}
        >
          {label}
        </label>
      )}
      <input
        className={cn(
          isDark
            ? 'w-full rounded-xl border border-white/10 bg-premium-indigo-deep/70 px-4 py-3 text-sm text-white transition-all duration-200 placeholder:text-premium-lilac-light/35 focus:border-premium-champagne-gold/40 focus:outline-none focus:ring-2 focus:ring-premium-champagne-gold/20'
            : 'kura-input',
          className
        )}
        {...props}
      />
      {error && (
        <p
          className={cn(
            'ml-1 text-[10px] font-semibold uppercase tracking-[0.08em]',
            isDark ? 'text-rose-300' : 'text-rose-500'
          )}
        >
          {error}
        </p>
      )}
    </div>
  );
};

const getInitials = (name = 'Doctor') => {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) {
    return 'DR';
  }

  return (
    parts
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() || '')
      .join('') || 'DR'
  );
};

export const Avatar = ({ src, name = 'Doctor', className, textClassName, alt }) => {
  const [imageFailed, setImageFailed] = React.useState(false);
  const initials = React.useMemo(() => getInitials(name), [name]);

  return (
    <div
      className={cn(
        'flex items-center justify-center overflow-hidden rounded-full border border-premium-lilac/30 bg-premium-royal text-white shadow-premium-soft',
        className
      )}
    >
      {src && !imageFailed ? (
        <img
          src={src}
          alt={alt || `${name} profile photo`}
          className="h-full w-full object-cover"
          onError={() => setImageFailed(true)}
        />
      ) : (
        <span className={cn('font-semibold tracking-[0.04em] text-white', textClassName)}>
          {initials}
        </span>
      )}
    </div>
  );
};

export const Table = ({ headers, children, className }) => {
  return (
    <div className={cn('overflow-x-auto rounded-2xl border border-premium-lilac/25', className)}>
      <table className="w-full border-collapse">
        <thead className="border-b border-premium-lilac/20 bg-premium-lilac-light/50">
          <tr>
            {headers.map((header, i) => (
              <th
                key={i}
                className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-premium-purple-plum/55"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-premium-lilac/10">{children}</tbody>
      </table>
    </div>
  );
};

export const LoadingState = ({
  className,
  title = 'Loading secure session',
  message = 'Synchronizing Data...',
  tone = 'light',
}) => {
  const isDark = tone === 'dark';

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center space-y-3 p-10',
        isDark && 'text-premium-lilac-light',
        className
      )}
    >
      <div className="relative h-12 w-12">
        <div
          className={cn(
            'absolute inset-0 rounded-full border-4',
            isDark ? 'border-white/15' : 'border-premium-lilac/30'
          )}
        />
        <div
          className={cn(
            'absolute inset-0 animate-spin rounded-full border-4 border-t-transparent',
            isDark ? 'border-premium-champagne-gold' : 'border-premium-purple-plum'
          )}
        />
      </div>
      <div className="space-y-1 text-center">
        <p
          className={cn(
            'text-sm font-semibold',
            isDark ? 'text-white' : 'text-premium-purple-plum'
          )}
        >
          {title}
        </p>
        <p
          className={cn(
            'animate-pulse text-[11px] font-semibold uppercase tracking-[0.08em]',
            isDark ? 'text-premium-lilac-light/70' : 'text-premium-purple-plum/45'
          )}
        >
          {message}
        </p>
      </div>
    </div>
  );
};

export const SkeletonBlock = ({ className }) => (
  <div className={cn('animate-pulse rounded-2xl bg-premium-lilac/20', className)} />
);

export const EmptyState = ({ icon: Icon, title, message, actionLabel, onAction }) => (
  <div className="flex flex-col items-center justify-center p-12 text-center">
    <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-premium-lilac/20 bg-premium-lilac-light text-premium-purple-plum/30 shadow-premium-soft">
      <Icon className="h-10 w-10" />
    </div>
    <h3 className="mb-2 text-lg font-semibold text-premium-purple-plum">{title}</h3>
    <p className="mb-8 max-w-sm text-sm leading-relaxed text-premium-purple-plum/60">{message}</p>
    {actionLabel && (
      <Button variant="pearl" onClick={onAction}>
        {actionLabel}
      </Button>
    )}
  </div>
);

export const ErrorState = ({
  icon: Icon,
  title = 'Something went wrong',
  message = 'Something went wrong. Please try again.',
  actionLabel = 'Try again',
  onAction,
}) => (
  <div className="flex flex-col items-center justify-center rounded-2xl border border-rose-100 bg-rose-50/70 p-8 text-center">
    <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-rose-100 bg-white text-rose-600 shadow-premium-soft">
      {Icon ? <Icon className="h-8 w-8" /> : <span className="text-xl font-bold">!</span>}
    </div>
    <h3 className="mb-2 text-lg font-semibold text-premium-purple-plum">{title}</h3>
    <p className="mb-6 max-w-md text-sm leading-relaxed text-premium-purple-plum/65">{message}</p>
    {onAction && (
      <Button variant="secondary" onClick={onAction}>
        {actionLabel}
      </Button>
    )}
  </div>
);
