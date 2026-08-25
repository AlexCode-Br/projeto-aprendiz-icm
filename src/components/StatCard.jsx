import React from 'react';
import { Link } from 'react-router-dom';

const StatCard = ({ to, title, value, icon, colorClass, delay }) => {
    const iconColorClass = {
        primary: 'bg-primary/10 text-primary-light',
        success: 'bg-success/10 text-success',
        warning: 'bg-warning/10 text-yellow-500',
    };

    return (
        <Link 
            to={to} 
            className={`block p-5 bg-surface rounded-lg shadow-sm interactive-card fade-in-up border border-border delay-${delay}`}
        >
            <div className="grid grid-cols-[1fr,auto] items-center gap-4">
                <div className="min-w-0">
                    <p className="text-sm font-medium text-text-muted truncate">{title}</p>
                    <p className="text-3xl font-bold text-text-default">{value}</p>
                </div>
                <div className={`p-3 rounded-full ${iconColorClass[colorClass]}`}>
                    {icon}
                </div>
            </div>
        </Link>
    );
};

export default StatCard;