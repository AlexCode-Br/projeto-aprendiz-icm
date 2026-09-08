import React, { useState } from 'react';

const loadedProfilePhotos = new Set();

export default function ProfileAvatar({ name = '', src = '', className = 'h-10 w-10', textClassName = 'text-sm' }) {
    const [imageState, setImageState] = useState(() => ({ src, loaded: Boolean(src && loadedProfilePhotos.has(src)), failed: false }));
    const loaded = imageState.src === src && imageState.loaded;
    const failed = imageState.src === src && imageState.failed;
    const initial = name.trim().charAt(0).toUpperCase() || 'U';
    return <span role="img" aria-label={`${loaded ? 'Foto de' : 'Perfil de'} ${name || 'usuário'}`} className={`${className} ${textClassName} relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full ${loaded ? 'bg-surface-muted' : 'bg-primary'} font-bold text-white ring-2 ring-primary/20`}>
        {!loaded && <span aria-hidden="true">{initial}</span>}
        {src && !failed && <img key={src} src={src} alt="" aria-hidden="true" draggable={false}
            decoding="async"
            onLoad={() => { loadedProfilePhotos.add(src); setImageState({ src, loaded: true, failed: false }); }}
            onError={() => setImageState({ src, loaded: false, failed: true })}
            className={`absolute inset-0 h-full w-full object-cover ${loaded ? 'opacity-100' : 'opacity-0'}`} />}
    </span>;
}
