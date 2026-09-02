import React from 'react';

export default function PageSkeleton({ label = 'Carregando página' }) {
    return <div role="status" aria-label={label} className="space-y-6"><div className="skeleton h-8 w-64 max-w-full" /><div className="skeleton h-4 w-96 max-w-full" /><div className="skeleton h-24 rounded-2xl" /><div className="panel space-y-4 p-5">{[1, 2, 3, 4].map(item => <div key={item} className="skeleton h-12" />)}</div></div>;
}
