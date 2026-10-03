import React, { useEffect, useRef, useState } from 'react';
import { LoaderCircle, Mic, Pause, Play } from 'lucide-react';
import api from '../../services/api';
import { voiceDetails } from '../../utils/supportAudio';
import { voiceClock } from '../../../shared/support-audio.mjs';
import VoiceWaveform from './VoiceWaveform';

export default function VoiceMessage({ src, blob, name = 'Mensagem de voz', author = '', compact = false }) {
  const audio = useRef(null), container = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [peaks, setPeaks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [playUrl, setPlayUrl] = useState('');
  const [speed, setSpeed] = useState(1);
  useEffect(() => {
    let active = true, url = '', started = false;
    const controller = new AbortController();
    setLoading(true); setError(''); setPlaying(false); setTime(0); setDuration(0); setPeaks([]); setPlayUrl('');
    const prepare = async () => {
      if (started) return;
      started = true;
      try {
        const file = blob || await api.getMedia(src, {signal: controller.signal});
        if (!active) return;
        url = URL.createObjectURL(file); setPlayUrl(url);
        try {
          const details = await voiceDetails(file);
          if (active) { setDuration(details.duration); setPeaks(details.peaks); }
        } catch { /* Playback can still work when Web Audio cannot decode a codec. */ }
      } catch (cause) {
        if (active && cause.name !== 'AbortError') setError('Áudio indisponível. Tente abrir novamente.');
      } finally { if (active) setLoading(false); }
    };
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { observer.disconnect(); void prepare(); }
    });
    if (blob) void prepare(); else if (container.current) observer.observe(container.current);
    return () => { active = false; observer.disconnect(); controller.abort(); if (url) URL.revokeObjectURL(url); };
  }, [src, blob]);
  const toggle = async () => {
    if (!audio.current || loading) return;
    if (!audio.current.paused) { audio.current.pause(); return; }
    try {
      setError('');
      // Starting another voice message stops the previous one.
      document.querySelectorAll('audio[data-chat-voice]').forEach(item => { if (item !== audio.current) item.pause(); });
      await audio.current.play();
    } catch { setError('Não foi possível reproduzir este áudio.'); }
  };
  const progress = duration ? Math.min(1, time / duration) : 0;
  const initials = author.split(/\s+/).filter(Boolean).slice(0,2).map(part => part[0]).join('');
  return <div ref={container} className="min-w-0" aria-label={name}>
    <audio ref={audio} data-chat-voice src={playUrl || src || undefined} preload={playUrl?'metadata':'none'} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => {setPlaying(false);setTime(0);}} onTimeUpdate={event => setTime(event.currentTarget.currentTime)} onDurationChange={event => {const value=event.currentTarget.duration;if(Number.isFinite(value)&&value>0)setDuration(value);}} onError={() => {if(!loading)setError('Não foi possível reproduzir este áudio.');}}/>
    <div className="flex min-w-0 items-center gap-2">
      {!compact && <span aria-hidden="true" className="relative mr-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">{initials || <Mic className="!h-5 !w-5"/>}<span className="absolute -bottom-1 -right-1 rounded-full bg-surface p-0.5"><Mic className="!h-3.5 !w-3.5 text-primary"/></span></span>}
      <button type="button" onClick={() => void toggle()} disabled={loading || !!error} aria-label={playing?'Pausar áudio':'Reproduzir áudio'} className="flex h-11 w-9 shrink-0 items-center justify-center rounded-full text-text-muted hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-40">{loading?<LoaderCircle aria-hidden="true" className="!h-5 !w-5 animate-spin"/>:playing?<Pause aria-hidden="true" className="!h-6 !w-6 fill-current"/>:<Play aria-hidden="true" className="!h-6 !w-6 fill-current"/>}</button>
      <div className="min-w-0 flex-1">
        <div className="relative flex h-9 items-center rounded-sm focus-within:ring-2 focus-within:ring-primary/40">
          <VoiceWaveform peaks={peaks} progress={progress}/>
          <input type="range" aria-label="Posição do áudio" aria-valuetext={`${voiceClock(time)} de ${voiceClock(duration)}`} min="0" max={duration || 1} step="0.01" value={Math.min(time, duration || 1)} disabled={!duration || loading} onChange={event => {const value=Number(event.target.value);if(audio.current){audio.current.currentTime=value;setTime(value);}}} className="absolute inset-0 h-full w-full cursor-pointer opacity-0"/>
        </div>
        <div className="flex items-center justify-between gap-2 text-[11px] text-text-muted"><span>{voiceClock(time || duration)}</span><button type="button" aria-label={`Velocidade do áudio: ${speed} vezes`} onClick={() => {const next=speed===1?1.5:speed===1.5?2:1;setSpeed(next);if(audio.current)audio.current.playbackRate=next;}} className="rounded-full bg-surface/60 px-2 py-0.5 font-semibold hover:text-primary">{speed}×</button></div>
      </div>
    </div>
    {error && <p role="alert" className="mt-1 text-xs text-danger">{error}</p>}
  </div>;
}
