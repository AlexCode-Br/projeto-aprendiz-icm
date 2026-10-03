import React from 'react';
import { Download, FileText } from 'lucide-react';
import { supportFileSize } from '../../../shared/support-media.mjs';
import VoiceMessage from './VoiceMessage';

export default function ChatMedia({ attachments=[],onReady,author }) {
  if(!attachments.length)return null;
  return <div className="mb-2 grid min-w-0 grid-cols-1 gap-2" aria-label="Arquivos da mensagem">{attachments.map(file=>{
    const image=file.tipo.startsWith('image/'),video=file.tipo.startsWith('video/'),audio=file.tipo.startsWith('audio/');
    const download=`${file.url}?download=1`;
    return <div key={file.id} className={`min-w-0 max-w-full ${audio||video?'w-72':''}`}>
      {image?<a href={file.url} target="_blank" rel="noreferrer" aria-label={`Abrir foto ${file.nome}`}><img src={file.url} alt={file.nome} onLoad={onReady} loading="lazy" className="max-h-72 w-full min-w-0 rounded-lg object-contain"/></a>
        :video?<video src={file.url} onLoadedMetadata={onReady} controls playsInline preload="metadata" aria-label={`Vídeo ${file.nome}`} className="max-h-72 w-full min-w-0 rounded-lg"/>
        :audio?<>{!file.audio_gravado&&<p className="mb-1 truncate text-[11px] font-semibold text-text-muted">{file.nome}</p>}<VoiceMessage src={file.url} author={author} name={file.audio_gravado?'Mensagem de voz':`Áudio ${file.nome}`}/></>
        :<a href={download} download={file.nome} className="flex min-w-0 items-center gap-2 rounded-lg border border-border/60 bg-surface/60 p-3 text-text-default"><FileText aria-hidden="true" className="!h-6 !w-6 shrink-0 text-primary"/><span className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold">{file.nome}</span><span className="text-[10px] text-text-muted">{supportFileSize(file.tamanho)}</span></span><Download aria-hidden="true" className="!h-4 !w-4 shrink-0"/></a>}
      {(image||video)&&<a href={download} download={file.nome} className="mt-1 inline-flex max-w-full items-center gap-1 text-[10px] text-text-muted hover:text-primary"><Download aria-hidden="true" className="!h-3 !w-3 shrink-0"/><span className="truncate">{supportFileSize(file.tamanho)} · Baixar</span></a>}
    </div>;
  })}</div>;
}
