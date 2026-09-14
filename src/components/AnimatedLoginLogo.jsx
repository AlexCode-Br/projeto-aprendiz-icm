import React, { useId, useState } from 'react';
import Logo from '../assets/projeto-aprendiz-logo.png';

// These pen guides reveal the original lettering, rather than replacing its font.
const penStrokes = [
    { d: 'M4 115 C17 98 70 94 102 63 C91 80 68 116 74 125 C79 132 94 112 107 96', width: 13, delay: 0.15, duration: 1.15 },
    { d: 'M7 115 C38 119 72 77 99 66', width: 10, delay: 0.65, duration: 0.55 },
    { d: 'M75 96 C91 92 99 91 109 94 C117 99 107 112 94 111 L66 149 C86 123 116 96 125 94 C139 86 128 106 122 114 C136 106 146 96 151 96', width: 15, delay: 1.05, duration: 0.8 },
    { d: 'M144 101 C169 82 173 98 154 108 C138 120 162 114 176 100 C189 88 182 109 177 115 C193 105 199 94 205 98 C211 103 196 113 207 113', width: 16, delay: 1.75, duration: 0.7 },
    { d: 'M214 97 C197 109 206 119 219 107 L253 73 C238 84 219 106 216 114 C232 112 247 98 252 94 C240 103 238 116 249 111', width: 15, delay: 2.4, duration: 0.7 },
    { d: 'M264 82 L260 86', width: 11, delay: 2.85, duration: 0.2 },
    { d: 'M254 99 C269 89 281 87 268 101 C254 116 277 108 294 93 C279 104 263 127 252 139 C266 134 278 115 280 103', width: 16, delay: 3.05, duration: 0.9 },
];

const notes = [
    { x: 153, y: 28, delay: 0.65 },
    { x: 176, y: 37, delay: 0.85 },
    { x: 194, y: 46, delay: 1.05 },
    { x: 214, y: 49, delay: 1.25 },
    { x: 243, y: 55, delay: 1.45 },
];

export default function AnimatedLoginLogo() {
    const id = useId().replace(/:/g, '');
    const [ready, setReady] = useState(false);
    return (
        <span className="auth-logo auth-login-logo relative block w-48 sm:w-56" data-ready={ready}>
            <img src={Logo} width="300" height="149" alt="Projeto Aprendiz" className="login-logo-original block h-auto w-full" onLoad={() => setReady(true)} />
            {ready && <svg className="login-logo-performance pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 300 149" aria-hidden="true" focusable="false">
                <defs>
                    <clipPath id={`${id}-word`}><path d="M0 58 H140 V83 H211 V62 H300 V149 H0 Z" /></clipPath>
                    <clipPath id={`${id}-project`}><rect x="140" y="58" width="71" height="25" /></clipPath>
                    <clipPath id={`${id}-score`}><path d="M0 0 H300 V62 H211 V58 H0 Z" /></clipPath>
                    {notes.map((note, index) => <clipPath key={index} id={`${id}-note-${index}`}>
                        <ellipse cx={note.x} cy={note.y} rx="5" ry="3" />
                    </clipPath>)}
                    <mask id={`${id}-score-base`} maskUnits="userSpaceOnUse" x="0" y="0" width="300" height="149" style={{ maskType: 'luminance' }}>
                        <rect width="300" height="149" fill="white" />
                        {notes.map(note => <ellipse key={note.x} cx={note.x} cy={note.y} rx="5" ry="3" fill="black" />)}
                    </mask>
                    <mask id={`${id}-score-reveal`} maskUnits="userSpaceOnUse" x="0" y="0" width="300" height="149" style={{ maskType: 'luminance' }}>
                        <path d="M95 35 H305" pathLength="1" fill="none" stroke="white" strokeWidth="130" className="login-logo-staff" />
                    </mask>
                    <mask id={`${id}-ink`} maskUnits="userSpaceOnUse" x="0" y="0" width="300" height="149" style={{ maskType: 'luminance' }}>
                        {penStrokes.map((stroke, index) => <path key={index} d={stroke.d} pathLength="1" fill="none" stroke="white" strokeWidth={stroke.width} strokeLinecap="round" strokeLinejoin="round" className="login-logo-pen" style={{ '--delay': `${stroke.delay}s`, '--duration': `${stroke.duration}s` }} />)}
                        <rect width="300" height="149" fill="white" className="login-logo-ink-complete" />
                    </mask>
                </defs>
                {/* Every animated part uses the same original artwork. Nothing is
                    replaced with a differently drawn logo when motion ends. */}
                <g clipPath={`url(#${id}-score)`}>
                    <g mask={`url(#${id}-score-reveal)`}>
                        <image href={Logo} width="300" height="149" mask={`url(#${id}-score-base)`} />
                        {notes.map((note, index) => <g key={note.x} className="login-logo-note" style={{ '--delay': `${note.delay}s` }}>
                            <image href={Logo} width="300" height="149" clipPath={`url(#${id}-note-${index})`} />
                        </g>)}
                    </g>
                </g>
                <image href={Logo} width="300" height="149" clipPath={`url(#${id}-project)`} className="login-logo-project" />
                <g clipPath={`url(#${id}-word)`}>
                    <image href={Logo} width="300" height="149" mask={`url(#${id}-ink)`} />
                </g>
            </svg>}
        </span>
    );
}
