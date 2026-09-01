import React from 'react';
import { Link } from 'react-router-dom';

const StatCard = ({ to, title, value, detail, icon, colorClass = 'primary', delay, loading = false }) => {
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
                        <>
                            <p className={`${String(value ?? '').length > 8 ? 'text-xl' : 'text-3xl'} mt-1 font-bold tracking-tight text-text-default`}>{value}</p>
                            {detail && <p className="mt-2 text-xs leading-5 text-text-muted">{detail}</p>}
                        </>
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
