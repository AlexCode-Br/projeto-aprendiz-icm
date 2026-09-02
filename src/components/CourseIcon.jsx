import React from 'react';
import { BookOpenText, Drum, Guitar, MicVocal, Music2, Piano } from 'lucide-react';
import { courseIconKind } from '../../shared/catalog-options.mjs';

const icons = { drums: Drum, guitar: Guitar, piano: Piano, choir: MicVocal, theory: BookOpenText, music: Music2 };

// Instrument outlines share Lucide's 24px grid and rounded strokes.
export default function CourseIcon({ name, className = 'h-5 w-5' }) {
    const kind = courseIconKind(name);
    const Icon = icons[kind];
    if (Icon) return <Icon aria-hidden="true" className={className} data-course-icon={kind} />;
    return <svg aria-hidden="true" data-course-icon={kind} className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        {kind === 'flute' && <g transform="rotate(-35 12 12)"><rect x="2" y="10" width="20" height="4" rx="1.5" /><path d="M6 10v4M18 10v4M9 12h.1M12 12h.1M15 12h.1" /></g>}
        {kind === 'saxophone' && <><path d="M8 3h3l2 3v10a2 2 0 0 0 4 0v-4M9 6v10a6 6 0 0 0 12 0v-4" /><path d="m16 10 6-2-1 4-4 1M9 9h3M9 12h3M9 15h3" /></>}
        {kind === 'violin' && <><path d="m14 8 5-5 2 2-5 5M11 8c-3-2-6 1-4 4-4 0-6 4-3 7s7 1 7-3c3 2 6-1 4-4M7 17l8-8M18 12l-7 9M9 12l3 3" /><path d="m18 3 3 3" /></>}
        {kind === 'bass' && <><path d="m13 11 5-8 3 2-6 8M12 10c-3-3-4 0-4 2-4-1-7 3-5 6 2 4 8 3 9-1 3 1 5-1 3-4M7 17l11-12M6 18l3 1M18 4l3 2M17 7l2 1" /></>}
        {kind === 'harmonica' && <><rect x="2" y="7" width="20" height="10" rx="2" /><path d="M2 10h20M6 10v4M10 10v4M14 10v4M18 10v4M4 17h16" /></>}
    </svg>;
}
