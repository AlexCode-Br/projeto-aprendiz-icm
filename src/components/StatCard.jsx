import React from 'react';
import { Link } from 'react-router-dom';

const StatCard = ({ to, title, value, icon, colorClass = 'primary', delay, loading = false }) => {
    const iconColorClass = {
        primary: 'bg-primary/10 text-primary',
        success: 'bg-success/10 text-success',
        warning: 'bg-warning/10 text-warning',
        neutral: 'bg-gray-500/10 text-text-muted',
    };

    return (
        <Link
            to={to}
            className={`interactive-card fade-in-up block rounded-xl border border-border bg-surface p-5 shadow-sm delay-${delay}`}
            aria-busy={loading}
        >
            <div className="grid grid-cols-[1fr,auto] items-center gap-4">
                <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-text-muted">{title}</p>
                    {loading ? (
                        <div className="skeleton mt-2 h-8 w-16" aria-hidden="true" />
                    ) : (
                        <p className="mt-1 text-3xl font-bold tracking-tight text-text-default">{value}</p>
                    )}
                </div>
                <div className={`rounded-xl p-3 ${iconColorClass[colorClass] || iconColorClass.primary}`}>
                    {icon}
                </div>
            </div>
        </Link>
    );
};

export default StatCard;
