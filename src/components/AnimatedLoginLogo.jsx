import React, { useId, useState } from 'react';
import Logo from '../assets/projeto-aprendiz-logo.png';

// Slanted regions isolate the connected lettering so a stroke cannot reveal
// the next letter where the original cursive letters touch each other.
const letters = [
    { name: 'A', from: -100, to: 94, delay: 1.2, duration: 1.25, width: 10,
        d: 'M57 91 C32 96 7 104 3 113 C1 122 37 105 65 88 L101 63 C94 76 71 108 75 122 C79 131 91 112 98 100' },
    { name: 'p', from: 94, to: 121, delay: 2.45, duration: 0.8, width: 11,
        d: 'M98 99 C111 86 120 91 111 101 C104 110 94 118 92 111 L69 146' },
    { name: 'r', from: 121, to: 148, delay: 3.25, duration: 0.5, width: 12,
        d: 'M109 118 C121 100 128 91 135 93 C141 97 126 110 130 114 L150 100' },
    { name: 'e', from: 148, to: 174, delay: 3.75, duration: 0.6, width: 12,
        d: 'M142 106 C160 101 172 88 161 94 C151 96 140 108 144 113 C149 121 170 106 177 99' },
    { name: 'n', from: 174, to: 205, delay: 4.35, duration: 0.65, width: 12,
        d: 'M173 102 L181 94 L172 113 C187 102 199 91 202 98 C201 104 188 113 195 114 L208 105' },
    { name: 'd', from: 205, to: 242, delay: 5, duration: 0.7, width: 12,
        d: 'M221 96 C210 93 196 112 206 113 C220 113 243 83 253 74 C244 83 221 105 221 113 C225 116 238 107 244 101' },
    { name: 'i', from: 242, to: 267, delay: 5.7, duration: 0.4, width: 12,
        d: 'M252 95 C241 106 235 116 245 112 L263 99', dot: 'M264 82 L260 86' },
    { name: 'z', from: 267, to: 400, delay: 6.1, duration: 0.8, width: 12,
        d: 'M260 98 C276 87 283 91 273 100 L259 112 C271 108 289 94 296 93 C280 106 257 135 256 141 C264 139 278 118 280 108' },
];

const notes = [
    { x: 130, y: 35, stem: 17 },
    { x: 151, y: 30, stem: 19 },
    { x: 173, y: 37, stem: 21 },
    { x: 195, y: 45, stem: 23 },
    { x: 216, y: 49, stem: 25 },
    { x: 241, y: 54, stem: 29 },
    { x: 262, y: 40, stem: 28 },
];

const letterRegion = ({ from, to }) =>
    `M${from + 37.8} 58 H${to + 37.8} L${to - 44.1} 149 H${from - 44.1} Z`;

export default function AnimatedLoginLogo() {
    const id = useId().replace(/:/g, '');
    const [ready, setReady] = useState(false);

    return (
        <span className="auth-logo auth-login-logo relative block" data-ready={ready}>
            <img src={Logo} width="300" height="149" alt="Projeto Aprendiz" className="login-logo-original block h-auto w-full" onLoad={() => setReady(true)} />
            {ready && <svg className="login-logo-performance pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 300 149" aria-hidden="true" focusable="false">
                <defs>
                    <clipPath id={`${id}-word`}><path d="M0 58 H140 V83 H211 V62 H300 V149 H0 Z" /></clipPath>
                    <clipPath id={`${id}-project`}><rect x="140" y="58" width="71" height="25" /></clipPath>
                    {letters.map(letter => <React.Fragment key={letter.name}>
                        <clipPath id={`${id}-letter-${letter.name}`}><path d={letterRegion(letter)} /></clipPath>
                        <mask id={`${id}-ink-${letter.name}`} maskUnits="userSpaceOnUse" x="0" y="0" width="300" height="149" style={{ maskType: 'luminance' }}>
                            <path d={letter.d} pathLength="1" fill="none" stroke="white" strokeWidth={letter.width} strokeLinecap="round" strokeLinejoin="round" className="login-logo-pen" style={{ '--delay': `${letter.delay}s`, '--duration': `${letter.duration}s` }} />
                            {letter.dot && <path d={letter.dot} pathLength="1" fill="none" stroke="white" strokeWidth="10" strokeLinecap="round" className="login-logo-pen" style={{ '--delay': `${letter.delay + letter.duration - 0.1}s`, '--duration': '0.1s' }} />}
                            {/* Complete only this letter's antialiased edges. */}
                            <rect width="300" height="149" fill="white" className="login-logo-letter-finish" style={{ '--delay': `${letter.delay + letter.duration - 0.05}s` }} />
                        </mask>
                    </React.Fragment>)}
                </defs>

                {/* Independent musical symbols remain the final artwork. */}
                <g transform="translate(-90 1) scale(1.35 1)" fill="none" stroke="#e9ab49" strokeLinecap="round">
                    {[0, 1, 2, 3, 4].map(line => <path key={line} d={`M108 ${47 - line * 4} C151 ${21 - line * 4} 172 ${33 - line * 4} 195 ${43 - line * 4} C224 ${57 - line * 4} 250 ${45 - line * 7} 281 ${42 - line * 10}`} pathLength="1" strokeWidth="1.6" className="login-logo-staff" style={{ '--delay': `${line * 0.08}s` }} />)}
                    {notes.map((note, index) => <g key={note.x} transform={`translate(${note.x} ${note.y})`}>
                        <g className="login-logo-note" style={{ '--delay': `${1.15 + index * 0.44}s` }}>
                            <ellipse rx="4.9" ry="2.9" transform="rotate(-24)" fill="#e9ab49" stroke="none" />
                            <path d={`M3.8 -1 V${-note.stem}`} strokeWidth="1.6" />
                            <path d={`M3.8 ${-note.stem} C4 ${5 - note.stem} 11 ${5 - note.stem} 9 ${11 - note.stem}`} strokeWidth="1.5" />
                        </g>
                    </g>)}
                </g>
                <image href={Logo} width="300" height="149" clipPath={`url(#${id}-project)`} className="login-logo-project" />
                <g clipPath={`url(#${id}-word)`}>
                    {letters.map(letter => <g key={letter.name} clipPath={`url(#${id}-letter-${letter.name})`}>
                        <image href={Logo} width="300" height="149" mask={`url(#${id}-ink-${letter.name})`} />
                    </g>)}
                </g>
            </svg>}
        </span>
    );
}
