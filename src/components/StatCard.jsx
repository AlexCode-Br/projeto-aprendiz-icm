import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';

const StatCard = ({ to, title, value, detail, icon, colorClass = 'primary', delay = 0, loading = false }) => {
    const iconColorClass = {
        primary: 'bg-primary/10 text-primary',
        success: 'bg-success/10 text-success',
        warning: 'bg-warning/10 text-warning',
        neutral: 'bg-gray-500/10 text-text-muted',
    };

    return (
        <Link
            to={to}
            className="interactive-card fade-in-up group block min-h-36 rounded-2xl border border-border bg-surface p-5 shadow-sm"
            style={{ animationDelay: `${Number(delay) || 0}ms` }}
            aria-busy={loading}
        >
            <div className="mb-4 flex items-center justify-between"><div className={`flex h-10 w-10 items-center justify-center rounded-xl ${iconColorClass[colorClass] || iconColorClass.primary}`}>{icon}</div><ArrowUpRight aria-hidden="true" className="text-text-muted opacity-50 transition group-hover:text-primary group-hover:opacity-100" /></div>
            <div className="grid grid-cols-1 items-center gap-4">
                <div className="min-w-0">
                    <p className="text-xs font-medium text-text-muted">{title}</p>
                    {loading ? (
                        <div className="skeleton mt-2 h-8 w-16" aria-hidden="true" />
                    ) : (
                        <>
                            <p className={`${String(value ?? '').length > 8 ? 'text-xl' : 'text-3xl'} mt-1 font-bold tracking-tight text-text-default`}>{value}</p>
                            {detail && <p className="mt-2 text-xs leading-5 text-text-muted">{detail}</p>}
                        </>
                    )}
                </div>
            </div>
        </Link>
    );
};

export default StatCard;
