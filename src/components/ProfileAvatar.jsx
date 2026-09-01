import React, { useEffect, useState } from 'react';

export default function ProfileAvatar({ name = '', src = '', className = 'h-10 w-10', textClassName = 'text-sm' }) {
    const [failed, setFailed] = useState(false);
    useEffect(() => setFailed(false), [src]);
    const initial = name.trim().charAt(0).toUpperCase() || 'U';
    if (src && !failed) return <img src={src} alt={`Foto de ${name || 'perfil'}`} onError={() => setFailed(true)} className={`${className} rounded-full object-cover ring-2 ring-primary/20`} />;
    return <span aria-label={`Sem foto para ${name || 'este perfil'}`} className={`${className} ${textClassName} inline-flex shrink-0 items-center justify-center rounded-full bg-primary font-bold text-white ring-2 ring-primary/20`}>{initial}</span>;
}
