import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Camera, FileText, LoaderCircle, Mic, Paperclip, Send, Smile, Pause, Trash2, X } from 'lucide-react';
import { SUPPORT_FILE_TYPES, SUPPORT_FILE_MAX_COUNT, SUPPORT_FILE_TOTAL_BYTES, supportFileType, supportFileLimit, supportFileSize } from '../../../shared/support-media.mjs';

import VoiceRecorder from '../../utils/voiceRecorder';
import VoiceMessage from './VoiceMessage';
import VoiceWaveform from './VoiceWaveform';
import { voiceClock } from '../../../shared/support-audio.mjs';

const emojis=['😀','😃','😄','😁','😅','😂','🤣','😊','🥰','😍','😘','😎','🤔','🙃','😉','😌','😔','😢','😭','😮','😬','😴','🙏','🙌','👏','👍','👎','👋','🤝','💪','❤️','💛','💙','💚','🤍','✨','🎉','🎵','🎶','🎹','🎸','🥁','📚','📅','✅','❌','📍','💬'];
const readFile=file=>new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error('Não foi possível ler o arquivo.'));reader.readAsDataURL(file);});

function MediaPreview({ file }) {
  const [url,setUrl]=useState('');
  const [blob,setBlob]=useState(null);
  useEffect(()=>{
    const bytes=Uint8Array.from(atob(file.dataUrl.split(',')[1]),character=>character.charCodeAt(0));
    const media=new Blob([bytes],{type:file.tipo});setBlob(media);
    const next=URL.createObjectURL(media);setUrl(next);
    return()=>URL.revokeObjectURL(next);
  },[file.dataUrl,file.tipo]);
  return file.tipo.startsWith('audio/')?<div className="mt-6">{blob&&<VoiceMessage blob={blob} compact name="Ouvir áudio antes de enviar"/>}</div>:<video controls playsInline src={url||undefined} aria-label="Prévia do vídeo" className="h-20 w-full rounded-lg"/>;
}

export default function ChatComposer({ id,drafts,disabled,onSend,onSent }) {
  const saved=drafts.current.get(id);
  const [draft,setDraft]=useState(saved?.text||'');
  const [files,setFiles]=useState(saved?.files||[]);
  const [sending,setSending]=useState(false);
  const [reading,setReading]=useState(false);
  const [error,setError]=useState('');
  const [emojiOpen,setEmojiOpen]=useState(false);
  const [voice,setVoice]=useState({phase:'idle',blob:null,seconds:0});
  const [liveStream,setLiveStream]=useState(null);
  const [livePeaks,setLivePeaks]=useState([]);
  const recording=voice.phase==='recording';
  const starting=voice.phase==='starting';
  const voiceOpen=voice.phase!=='idle';
  const [elapsed,setElapsed]=useState(0);
  const input=useRef(null),camera=useRef(null),composer=useRef(null),popover=useRef(null);
  const pending=useRef(false),voicePending=useRef(false),clientId=useRef(saved?.clientId||'');
  const recorder=useRef(null),mounted=useRef(true);
  const filesRef=useRef(files),draftRef=useRef(draft);
  useLayoutEffect(()=>{filesRef.current=files;draftRef.current=draft;},[files,draft]);
  const save=(text,attachments,key='')=>{clientId.current=key;drafts.current.set(id,{text,files:attachments,clientId:key});};
  useLayoutEffect(()=>{if(composer.current){composer.current.style.height='48px';composer.current.style.height=`${Math.min(128,Math.max(48,composer.current.scrollHeight))}px`;}},[draft]);
  useEffect(()=>{
    mounted.current=true;
    recorder.current=new VoiceRecorder({
      onChange:state=>{if(mounted.current){setVoice(state);setElapsed(state.seconds);if(state.error)setError(state.error);}},
      onStream:value=>{if(mounted.current)setLiveStream(value);},
    });
    return()=>{mounted.current=false;recorder.current?.dispose();};
  },[]);
  useEffect(()=>{
    if(!emojiOpen)return undefined;
    const close=event=>{if(event.key==='Escape')setEmojiOpen(false);else if(event.type==='pointerdown'&&!popover.current?.contains(event.target))setEmojiOpen(false);};
    document.addEventListener('keydown',close);document.addEventListener('pointerdown',close);
    return()=>{document.removeEventListener('keydown',close);document.removeEventListener('pointerdown',close);};
  },[emojiOpen]);
  useEffect(()=>{
    if(!liveStream)return undefined;
    const Context=window.AudioContext||window.webkitAudioContext;
    let context,source,analyser;
    try{if(Context){context=new Context();source=context.createMediaStreamSource(liveStream);analyser=context.createAnalyser();analyser.fftSize=1024;source.connect(analyser);void context.resume().catch(()=>{});}}catch{/* Recording remains available without a live waveform. */}
    const samples=new Uint8Array(1024);
    const interval=setInterval(()=>{
      setElapsed(recorder.current?.elapsed()||0);
      if(analyser){analyser.getByteTimeDomainData(samples);const peak=samples.reduce((maximum,value)=>Math.max(maximum,Math.abs(value-128)/128),0);setLivePeaks(values=>[...values.slice(-47),Math.min(1,peak*3)]);}
    },100);
    return()=>{clearInterval(interval);source?.disconnect();analyser?.disconnect();void context?.close().catch(()=>{});};
  },[liveStream]);
  const addFiles=async selected=>{
    if(reading||sending)return;
    setError('');setReading(true);
    try{
      const current=filesRef.current;
      if(current.length+selected.length>SUPPORT_FILE_MAX_COUNT)throw new Error('Selecione até 5 arquivos por mensagem.');
      let total=current.reduce((sum,item)=>sum+item.tamanho,0);
      const next=[];
      for(const file of selected){
        const type=supportFileType(file.name,file.type);
        if(!type)throw new Error('Use fotos PNG/JPG/WEBP, vídeos MP4/WEBM, áudios, PDF, Word, Excel, PowerPoint ou TXT.');
        if(!file.size||file.size>supportFileLimit(type))throw new Error(`${file.name}: o limite é ${supportFileSize(supportFileLimit(type))}.`);
        total+=file.size;if(total>SUPPORT_FILE_TOTAL_BYTES)throw new Error('Os arquivos devem somar até 20 MB por mensagem.');
        const original=await readFile(file);
        next.push({key:crypto.randomUUID(),nome:file.name,tipo:type,tamanho:file.size,dataUrl:`data:${type};base64,${String(original).split(',')[1]}`});
      }
      if(mounted.current){const all=[...current,...next];setFiles(all);save(draftRef.current,all);}
    }catch(cause){if(mounted.current)setError(cause.message);}
    finally{if(mounted.current)setReading(false);if(input.current)input.current.value='';if(camera.current)camera.current.value='';}
  };
  const startRecording=async()=>{
    setError('');setEmojiOpen(false);
    if(!navigator.mediaDevices?.getUserMedia||typeof MediaRecorder==='undefined'){setError('Este navegador não permite gravar áudio. Você pode anexar um arquivo de áudio.');return;}
    if(filesRef.current.length>=SUPPORT_FILE_MAX_COUNT){setError('Remova um arquivo antes de gravar.');return;}
    if(recorder.current?.phase==='idle')setLivePeaks([]);
    await recorder.current?.start();
  };
  const discard=()=>{recorder.current?.discard();setLivePeaks([]);};
  const sendFiles=async attachments=>{
    if(pending.current||disabled)return;
    pending.current=true;setSending(true);setError('');setEmojiOpen(false);
    const text=draftRef.current.trim();
    clientId.current ||= crypto.randomUUID();save(draftRef.current,attachments,clientId.current);
    try{await onSend(id,text,clientId.current,attachments);drafts.current.delete(id);if(mounted.current){setDraft('');setFiles([]);clientId.current='';onSent();}}
    catch(cause){if(mounted.current)setError(cause.response?.data?.errors?.anexos||cause.response?.data?.errors?.mensagem||cause.message||'Não foi possível enviar.');}
    finally{pending.current=false;if(mounted.current)setSending(false);}
  };
  const sendVoice=async()=>{
    if(pending.current||voicePending.current||reading||sending||disabled)return;
    voicePending.current=true;
    const blob=await recorder.current?.pause();
    if(!blob||!mounted.current){voicePending.current=false;return;}
    setReading(true);setError('');
    try{
      const current=filesRef.current;
      if(current.length>=SUPPORT_FILE_MAX_COUNT||current.reduce((sum,file)=>sum+file.tamanho,blob.size)>SUPPORT_FILE_TOTAL_BYTES)throw new Error('O áudio ultrapassa o limite de arquivos da mensagem.');
      const extension=blob.type==='audio/wav'?'wav':blob.type==='audio/mp4'?'m4a':blob.type==='audio/ogg'?'ogg':'webm';
      const dataUrl=await readFile(blob);
      if(!mounted.current)return;
      const all=[...current,{key:crypto.randomUUID(),nome:`audio-${Date.now()}.${extension}`,tipo:blob.type,tamanho:blob.size,dataUrl,audio_gravado:true}];
      setFiles(all);save(draftRef.current,all);recorder.current.discard();setLivePeaks([]);
      await sendFiles(all);
    }catch(cause){if(mounted.current)setError(cause.message);}
    finally{voicePending.current=false;if(mounted.current)setReading(false);}
  };
  const submit=async event=>{
    event.preventDefault();
    if(pending.current||reading||voiceOpen||disabled||(!draft.trim()&&!files.length))return;
    await sendFiles(filesRef.current);
  };
  const busy=disabled||sending||reading||starting||voice.phase==='processing';
  const hasPayload=!!draft.trim()||!!files.length;
  const audioAction=!hasPayload||files.some(file=>file.tipo.startsWith('audio/'));
  return <form onSubmit={submit} className="relative shrink-0 bg-surface-muted px-2 pb-2 pt-2 sm:px-4 sm:pb-3">
    {error&&<p role="alert" className="mb-2 text-xs text-danger">{error}</p>}
    {!!files.length&&<div className="mb-3 flex max-h-40 gap-2 overflow-x-auto pb-1" aria-label="Arquivos prontos para enviar">{files.map(file=><div key={file.key} className={`relative ${file.tipo.startsWith('audio/')?'w-64':'w-36'} shrink-0 rounded-xl border border-border bg-surface-muted p-2`}>
      <button type="button" aria-label={`Remover ${file.nome}`} onClick={()=>{const next=files.filter(item=>item.key!==file.key);setFiles(next);save(draft,next);}} disabled={busy} className="absolute right-1 top-1 z-10 rounded-full bg-surface p-1.5 text-text-muted"><X aria-hidden="true" className="!h-3.5 !w-3.5"/></button>
      {file.tipo.startsWith('image/')?<img src={file.dataUrl} alt={`Prévia de ${file.nome}`} className="h-16 w-full rounded-lg object-cover"/>:/^(audio|video)\//.test(file.tipo)?<MediaPreview file={file}/>:<FileText aria-hidden="true" className="mb-2 mt-3 !h-7 !w-7 text-primary"/>}
      <p className="mt-1 truncate pr-1 text-[10px] font-medium text-text-default">{file.audio_gravado?'Mensagem de voz':file.nome}</p><p className="text-[10px] text-text-muted">{supportFileSize(file.tamanho)}</p>
    </div>)}</div>}
    <input ref={input} type="file" multiple accept={Object.values(SUPPORT_FILE_TYPES).flat().join(',')} className="hidden" aria-label="Selecionar arquivos" onChange={event=>void addFiles(Array.from(event.target.files||[]))}/>
    <input ref={camera} type="file" accept="image/png,image/jpeg,image/webp" capture="environment" className="hidden" aria-label="Selecionar foto da câmera" onChange={event=>void addFiles(Array.from(event.target.files||[]))}/>
    {voiceOpen?<div className="rounded-2xl border border-border/60 bg-surface px-3 py-2 shadow-sm sm:px-4">
      <div className="mb-2 flex min-h-12 min-w-0 items-center gap-3">
        {voice.phase==='paused'&&voice.blob?<div className="min-w-0 flex-1"><VoiceMessage key={voice.seconds} blob={voice.blob} compact name="Revisar gravação"/></div>:<>
          <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-primary" aria-hidden="true"/>
          <span role="status" className="w-10 shrink-0 text-sm tabular-nums text-text-default">{voiceClock(elapsed)}</span>
          <div className="min-w-0 flex-1">{recording?<VoiceWaveform peaks={[...Array(Math.max(0,48-livePeaks.length)).fill(0),...livePeaks]} live/>:<span role="status" className="text-sm text-text-muted">{starting?'Abrindo microfone…':'Preparando áudio…'}</span>}</div>
        </>}
      </div>
      <div className="flex items-center gap-3">
        <button type="button" onClick={discard} disabled={reading||sending} aria-label="Descartar gravação" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface-muted text-text-muted hover:text-danger disabled:opacity-40"><Trash2 aria-hidden="true" className="!h-5 !w-5"/></button>
        <button type="button" disabled={busy||voice.seconds>=300} onClick={()=>{if(recording)void recorder.current?.pause();else void startRecording();}} aria-label={recording?'Pausar gravação':'Continuar gravação'} className="flex h-11 min-w-0 flex-1 items-center justify-center gap-2 rounded-full bg-surface-muted text-sm font-medium text-text-default hover:bg-surface-hover disabled:opacity-40">{recording?<Pause aria-hidden="true" className="!h-5 !w-5"/>:<Mic aria-hidden="true" className="!h-5 !w-5"/>}{recording?'Pausar':'Continuar'}</button>
        <button type="button" onClick={()=>void sendVoice()} disabled={busy} aria-label="Enviar áudio" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary text-white hover:bg-primary-dark disabled:opacity-40"><Send aria-hidden="true" className="!h-5 !w-5"/></button>
      </div>
      {voice.seconds>=300&&<p role="status" className="mt-2 text-xs text-text-muted">Limite de cinco minutos. Revise e envie seu áudio.</p>}
    </div>:<div className="flex items-end gap-2">
      <div className="flex min-w-0 flex-1 items-end rounded-[1.75rem] border border-border/40 bg-surface pl-1 pr-1 shadow-sm focus-within:ring-2 focus-within:ring-primary/20"><div ref={popover} className="shrink-0">
        <button type="button" aria-label="Escolher emoji" aria-expanded={emojiOpen} aria-controls="chat-emoji-picker" disabled={busy} onClick={()=>setEmojiOpen(value=>!value)} className="my-1 flex h-10 w-9 items-center justify-center rounded-full text-text-muted hover:bg-surface-hover disabled:opacity-40 sm:w-10"><Smile aria-hidden="true" className="!h-6 !w-6"/></button>
        {emojiOpen&&<div id="chat-emoji-picker" role="dialog" aria-label="Emojis" className="absolute bottom-full left-3 z-20 mb-2 w-72 max-w-[calc(100%-1.5rem)] rounded-2xl border border-border bg-surface p-3 shadow-xl"><div className="mb-2 flex items-center justify-between"><p className="text-xs font-semibold text-text-default">Emojis</p><button type="button" aria-label="Fechar emojis" onClick={()=>setEmojiOpen(false)} className="p-1 text-text-muted"><X className="!h-4 !w-4"/></button></div><div className="grid grid-cols-8 gap-1">{emojis.map(emoji=><button key={emoji} type="button" aria-label={`Adicionar emoji ${emoji}`} onClick={()=>{const start=composer.current?.selectionStart??draft.length,end=composer.current?.selectionEnd??start;const next=draft.slice(0,start)+emoji+draft.slice(end);if(next.length>4000)return;setDraft(next);save(next,files);composer.current?.focus();}} className="rounded-lg p-1 text-xl hover:bg-surface-hover">{emoji}</button>)}</div></div>}
      </div>
        <label className="min-w-0 flex-1"><span className="sr-only">Mensagem</span><textarea ref={composer} value={draft} onChange={event=>{setDraft(event.target.value);save(event.target.value,files);setError('');}} onKeyDown={event=>{if(event.key==='Enter'&&!event.shiftKey&&!event.nativeEvent.isComposing){event.preventDefault();event.currentTarget.form.requestSubmit();}}} rows={1} maxLength={4000} placeholder="Mensagem" className="block min-h-12 max-h-32 w-full resize-none border-0 bg-transparent py-3 text-sm leading-6 text-text-default outline-none placeholder:text-text-muted" disabled={busy}/></label>
        <button type="button" aria-label="Anexar arquivo" disabled={busy} onClick={()=>input.current?.click()} className="my-1 flex h-10 w-9 shrink-0 items-center justify-center rounded-full text-text-muted hover:bg-surface-hover disabled:opacity-40 sm:w-10"><Paperclip aria-hidden="true" className="!h-5 !w-5"/></button>
        <button type="button" aria-label="Enviar foto pela câmera" disabled={busy} onClick={()=>camera.current?.click()} className="my-1 flex h-10 w-9 shrink-0 items-center justify-center rounded-full text-text-muted hover:bg-surface-hover disabled:opacity-40 sm:w-10"><Camera aria-hidden="true" className="!h-5 !w-5"/></button>
      </div>
      <button type={hasPayload?'submit':'button'} aria-label={sending?'Enviando mensagem':reading?'Preparando arquivos':starting?'Abrindo microfone':hasPayload?'Enviar mensagem':'Gravar áudio'} disabled={busy} onClick={hasPayload?undefined:()=>void startRecording()} className={`flex h-[3.25rem] w-[3.25rem] shrink-0 items-center justify-center rounded-full text-white transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${audioAction?'bg-primary hover:bg-primary-dark':'bg-emerald-600 hover:bg-emerald-700'}`}>{sending||reading||starting?<LoaderCircle aria-hidden="true" className="!h-6 !w-6 animate-spin"/>:hasPayload?<Send aria-hidden="true" className="!h-5 !w-5"/>:<Mic aria-hidden="true" className="!h-6 !w-6"/>}</button>
    </div>}
    {(reading||sending||starting)&&<p role="status" className="sr-only">{reading?'Preparando arquivos':sending?'Enviando mensagem':'Abrindo microfone'}</p>}
  </form>;
}
