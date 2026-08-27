import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRightIcon } from './icons/index.jsx';

/**
 * StatCard — cartão de indicador principal do Dashboard
 *
 * Antes: ícone decorativo colorido + número grande → visual inflado
 * Depois: número em destaque, label acima, ícone funcional, variante de trend opcional
 */
const StatCard = ({ to, title, value, icon: Icon, trend, trendLabel, colorClass = 'primary', delay }) => {
  const iconBg = {
    primary: 'bg-primary/8 text-primary',
    success:  'bg-success/8 text-success',
    warning:  'bg-warning/8 text-warning',
    danger:   'bg-danger/8 text-danger',
    info:     'bg-info/8 text-info',
  }[colorClass] || 'bg-primary/8 text-primary';

  return (
    <Link
      to={to}
      className={`group relative flex flex-col gap-3 rounded-xl border border-border bg-surface p-5 transition-all duration-200 hover:border-border-strong hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 fade-in-up delay-${delay}`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-medium text-text-muted leading-none">{title}</span>
        {Icon && (
          <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${iconBg}`} aria-hidden="true">
            <Icon className="w-4 h-4" />
          </span>
        )}
      </div>

      <div className="flex items-end justify-between gap-2">
        <span className="text-2xl font-bold text-text-default tabular-nums leading-none">
          {value ?? '—'}
        </span>

        {trend !== undefined && (
          <span className={`text-xs font-medium ${trend >= 0 ? 'text-success' : 'text-danger'}`}>
            {trend >= 0 ? '+' : ''}{trend}%
            {trendLabel && <span className="text-text-muted ml-1">{trendLabel}</span>}
          </span>
        )}
      </div>

      {/* Subtle "navigate" arrow visible on hover */}
      <ArrowUpRightIcon
        className="absolute right-3 top-3 w-3.5 h-3.5 text-text-muted opacity-0 group-hover:opacity-100 transition-opacity"
        aria-hidden="true"
      />
    </Link>
  );
};

export default StatCard;
