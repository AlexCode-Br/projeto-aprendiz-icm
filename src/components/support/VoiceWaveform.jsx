import React from 'react';

export default function VoiceWaveform({ peaks = [], progress = 0, live = false }) {
  return <svg aria-hidden="true" viewBox="0 0 192 32" preserveAspectRatio="none" className="h-8 w-full overflow-visible">
    {Array.from({length:48}, (_, index) => {
      const level = peaks[index] || 0;
      const height = Math.max(3, level * 28);
      const played = live || index / 48 < progress;
      return <rect key={index} x={index * 4 + 1} y={(32 - height) / 2} width="2" height={height} rx="1" opacity={played?1:0.4} className={played ? 'fill-primary' : 'fill-text-muted'}/>;
    })}
    {!live && <circle cx={Math.max(3, Math.min(189, progress * 192))} cy="16" r="3" className="fill-primary"/>}
  </svg>;
}
