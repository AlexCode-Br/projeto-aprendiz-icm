import React,{useCallback,useEffect,useRef,useState} from 'react';
import {Bold,Italic,Link2,List,ListOrdered,Underline} from 'lucide-react';

const initialFormatState={bold:false,italic:false,underline:false,unorderedList:false,orderedList:false,link:false};

const escapeHtml=value=>String(value||'')
  .replace(/&/g,'&amp;')
  .replace(/</g,'&lt;')
  .replace(/>/g,'&gt;')
  .replace(/"/g,'&quot;')
  .replace(/'/g,'&#39;');

export const richTextToPlainText=value=>{
  if(typeof document==='undefined')return String(value||'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
  const container=document.createElement('div');
  container.innerHTML=String(value||'');
  return String(container.textContent||'').replace(/\s+/g,' ').trim();
};

export default function RichTextEditor({id,value,onChange,label='Conteúdo',placeholder='',disabled=false,invalid=false,minHeightClass='min-h-40'}){
  const editorRef=useRef(null),savedSelectionRef=useRef(null);
  const [formatState,setFormatState]=useState(initialFormatState);
  const [linkDialogOpen,setLinkDialogOpen]=useState(false),[linkText,setLinkText]=useState(''),[linkUrl,setLinkUrl]=useState(''),[linkError,setLinkError]=useState('');

  useEffect(()=>{
    const editor=editorRef.current,next=String(value||'');
    if(editor&&editor.innerHTML!==next)editor.innerHTML=next;
  },[value]);

  const updateFormatState=useCallback(()=>{
    const editor=editorRef.current,selection=window.getSelection?.();
    if(!editor||!selection?.rangeCount||!editor.contains(selection.anchorNode))return;
    savedSelectionRef.current=selection.getRangeAt(0).cloneRange();
    const commandState=command=>{try{return document.queryCommandState(command);}catch{return false;}};
    const anchorElement=selection.anchorNode?.nodeType===1?selection.anchorNode:selection.anchorNode?.parentElement;
    setFormatState({
      bold:commandState('bold'),italic:commandState('italic'),underline:commandState('underline'),
      unorderedList:commandState('insertUnorderedList'),orderedList:commandState('insertOrderedList'),
      link:Boolean(anchorElement?.closest('a')),
    });
  },[]);

  useEffect(()=>{
    document.addEventListener('selectionchange',updateFormatState);
    return()=>document.removeEventListener('selectionchange',updateFormatState);
  },[updateFormatState]);

  const saveSelection=()=>{
    const selection=window.getSelection();
    if(selection?.rangeCount&&editorRef.current?.contains(selection.anchorNode))savedSelectionRef.current=selection.getRangeAt(0).cloneRange();
  };
  const restoreSelection=()=>{
    const editor=editorRef.current;
    if(!editor)return;
    editor.focus();
    const selection=window.getSelection();
    if(!selection)return;
    const savedRange=savedSelectionRef.current,savedContainer=savedRange?.commonAncestorContainer;
    const valid=savedContainer&&(savedContainer===editor||editor.contains(savedContainer));
    selection.removeAllRanges();
    if(valid){selection.addRange(savedRange);return;}
    const range=document.createRange();
    range.selectNodeContents(editor);range.collapse(false);selection.addRange(range);savedSelectionRef.current=range.cloneRange();
  };
  const syncEditor=()=>onChange(editorRef.current?.innerHTML||'');
  const format=command=>{
    const selection=window.getSelection();
    if(!selection?.rangeCount||!editorRef.current?.contains(selection.anchorNode))restoreSelection();
    document.execCommand(command,false);
    saveSelection();syncEditor();updateFormatState();
  };
  const openLinkDialog=()=>{
    saveSelection();
    setLinkText(window.getSelection()?.toString().trim()||'');setLinkUrl('');setLinkError('');setLinkDialogOpen(true);
  };
  const applyLink=event=>{
    event.preventDefault();
    const rawUrl=linkUrl.trim();
    if(!rawUrl)return setLinkError('Informe o endereço do link.');
    const normalized=/^[a-z][a-z\d+.-]*:\/\//i.test(rawUrl)?rawUrl:`https://${rawUrl}`;
    let parsedUrl;
    try{parsedUrl=new URL(normalized);}catch{return setLinkError('Informe uma URL válida, como google.com.');}
    if(parsedUrl.protocol!=='https:'||!parsedUrl.hostname)return setLinkError('Use uma URL HTTPS válida.');
    restoreSelection();
    const selectedText=window.getSelection()?.toString().trim()||'';
    const displayText=linkText.trim()||selectedText||parsedUrl.hostname.replace(/^www\./i,'');
    document.execCommand('insertHTML',false,`<a href="${escapeHtml(parsedUrl.toString())}" target="_blank" rel="noopener noreferrer">${escapeHtml(displayText)}</a>`);
    syncEditor();updateFormatState();setLinkDialogOpen(false);setLinkText('');setLinkUrl('');
  };
  const pastePlainText=event=>{
    event.preventDefault();
    document.execCommand('insertText',false,event.clipboardData.getData('text/plain'));
    syncEditor();updateFormatState();
  };
  const toolbarMouseDown=event=>{event.preventDefault();saveSelection();};

  return <div>
    <div className="editor-toolbar" role="toolbar" aria-label={`Formatação de ${label.toLowerCase()}`}>
      {[["bold","Negrito",Bold],["italic","Itálico",Italic],["underline","Sublinhado",Underline]].map(([command,toolLabel,icon])=><button key={command} type="button" disabled={disabled} onMouseDown={toolbarMouseDown} onClick={()=>format(command)} className="editor-tool" title={toolLabel} aria-label={toolLabel} aria-pressed={formatState[command]}>{React.createElement(icon,{'aria-hidden':true})}</button>)}
      <button type="button" disabled={disabled} onMouseDown={toolbarMouseDown} onClick={()=>format('insertUnorderedList')} className="editor-tool" aria-label="Lista com marcadores" aria-pressed={formatState.unorderedList} title="Lista com marcadores"><List aria-hidden="true"/><span className="sr-only sm:not-sr-only">Lista</span></button>
      <button type="button" disabled={disabled} onMouseDown={toolbarMouseDown} onClick={()=>format('insertOrderedList')} className="editor-tool" aria-label="Lista numerada" aria-pressed={formatState.orderedList} title="Lista numerada"><ListOrdered aria-hidden="true"/><span className="sr-only sm:not-sr-only">Lista</span></button>
      <button type="button" disabled={disabled} onMouseDown={toolbarMouseDown} onClick={openLinkDialog} className="editor-tool" aria-label="Inserir link" aria-pressed={formatState.link} title="Inserir ou editar link"><Link2 aria-hidden="true"/>Link</button>
    </div>
    <div id={id} ref={editorRef} contentEditable={!disabled} role="textbox" aria-label={label} aria-multiline="true" aria-disabled={disabled} aria-invalid={invalid} data-placeholder={placeholder} suppressContentEditableWarning onInput={()=>{syncEditor();updateFormatState();}} onPaste={pastePlainText} onFocus={updateFormatState} onBlur={saveSelection} onKeyUp={updateFormatState} onMouseUp={updateFormatState} onSelect={updateFormatState} className={`form-control rich-text-editor announcement-content overflow-y-auto rounded-t-none ${minHeightClass} ${invalid?'border-danger':''}`}/>
    {linkDialogOpen&&<div className="mt-3 rounded-lg border border-border bg-surface-muted p-3"><div className="grid gap-3 sm:grid-cols-2"><label><span className="form-label">Texto do link</span><input autoFocus type="text" value={linkText} onChange={event=>{setLinkText(event.target.value);setLinkError('');}} placeholder="Texto visível (opcional)" className={`form-control ${linkError?'border-danger':''}`}/></label><label><span className="form-label">Link</span><input type="text" value={linkUrl} onChange={event=>{setLinkUrl(event.target.value);setLinkError('');}} placeholder="google.com" className={`form-control ${linkError?'border-danger':''}`}/></label></div><p className="mt-2 text-xs text-text-muted">Você pode digitar google.com; o endereço será convertido para HTTPS automaticamente.</p>{linkError&&<p className="mt-2 text-xs text-danger">{linkError}</p>}<div className="mt-3 flex flex-wrap justify-end gap-2"><button type="button" onClick={applyLink} className="btn btn-primary">Aplicar</button><button type="button" onClick={()=>setLinkDialogOpen(false)} className="btn btn-secondary">Cancelar</button></div></div>}
  </div>;
}
