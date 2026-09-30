import React, { useRef, useState } from 'react';
import { FileText, Image, Paperclip, Trash2 } from 'lucide-react';

const MAX_FILES=5;
const TOTAL_LIMIT=20*1024*1024;
const IMAGE_LIMIT=5*1024*1024;
const PDF_LIMIT=10*1024*1024;
const MIME_BY_EXTENSION={png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp',pdf:'application/pdf'};

const sizeLabel=bytes=>{
  const size=Number(bytes)||0;
  if(size<1024)return `${size} B`;
  if(size<1024*1024)return `${Math.ceil(size/1024)} KB`;
  return `${(size/(1024*1024)).toFixed(1)} MB`;
};

const fileMime=file=>file.type||MIME_BY_EXTENSION[String(file.name).split('.').pop().toLowerCase()]||'';
const readFile=file=>new Promise((resolve,reject)=>{
  const reader=new FileReader();
  reader.onload=()=>resolve(reader.result);
  reader.onerror=()=>reject(new Error(`Não foi possível ler ${file.name}.`));
  reader.readAsDataURL(file);
});

export default function AnnouncementAttachmentPicker({value,onChange,disabled=false}){
  const inputRef=useRef(null),[error,setError]=useState('');
  const attachments=Array.isArray(value)?value:[];
  const addFiles=async event=>{
    const files=[...(event.target.files||[])];event.target.value='';setError('');
    if(!files.length)return;
    if(attachments.length+files.length>MAX_FILES){setError(`Adicione no máximo ${MAX_FILES} arquivos.`);return;}
    const next=[];
    try{
      for(const file of files){
        const tipo=fileMime(file),isImage=tipo.startsWith('image/'),isPdf=tipo==='application/pdf';
        if(!isImage&&!isPdf)throw new Error('Use imagens PNG, JPG, WEBP ou arquivos PDF.');
        if(file.size>(isPdf?PDF_LIMIT:IMAGE_LIMIT))throw new Error(isPdf?'Cada PDF deve ter no máximo 10 MB.':'Cada imagem deve ter no máximo 5 MB.');
        if(attachments.some(item=>item.nome===file.name&&Number(item.tamanho)===file.size)||next.some(item=>item.nome===file.name&&item.tamanho===file.size))throw new Error(`${file.name} já foi adicionado.`);
        next.push({localId:`${Date.now()}-${crypto.randomUUID?.()||Math.random()}`,nome:file.name,tipo,tamanho:file.size,dataUrl:await readFile(file)});
      }
      if([...attachments,...next].reduce((total,item)=>total+Number(item.tamanho||0),0)>TOTAL_LIMIT)throw new Error('O total dos anexos deve ter no máximo 20 MB.');
      onChange([...attachments,...next]);
    }catch(reason){setError(reason.message||'Não foi possível adicionar o arquivo.');}
  };
  return <div>
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div><span className="form-label">Anexos</span><p className="text-xs text-text-muted">Até 5 imagens ou PDFs, total de 20 MB.</p></div>
      <button type="button" className="btn btn-secondary w-full sm:w-auto" onClick={()=>inputRef.current?.click()} disabled={disabled||attachments.length>=MAX_FILES}><Paperclip aria-hidden="true"/>Adicionar arquivos</button>
      <input ref={inputRef} className="sr-only" type="file" multiple accept="image/png,image/jpeg,image/webp,application/pdf" onChange={addFiles} disabled={disabled}/>
    </div>
    {error&&<p className="mt-2 text-sm text-danger" role="alert">{error}</p>}
    {attachments.length>0&&<ul className="mt-3 grid gap-2 sm:grid-cols-2">
      {attachments.map((item,index)=><li key={item.id||item.localId||`${item.nome}-${index}`} className="flex min-w-0 items-center gap-3 rounded-xl border border-border bg-surface-muted p-3">
        {String(item.tipo).startsWith('image/')?<Image className="h-5 w-5 shrink-0 text-primary" aria-hidden="true"/>:<FileText className="h-5 w-5 shrink-0 text-primary" aria-hidden="true"/>}
        <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium" title={item.nome}>{item.nome}</span><span className="text-xs text-text-muted">{sizeLabel(item.tamanho)}</span></span>
        <button type="button" className="icon-button h-9 w-9 shrink-0 text-danger" onClick={()=>onChange(attachments.filter((_,position)=>position!==index))} disabled={disabled} aria-label={`Remover ${item.nome}`}><Trash2 aria-hidden="true" className="h-4 w-4"/></button>
      </li>)}
    </ul>}
  </div>;
}
