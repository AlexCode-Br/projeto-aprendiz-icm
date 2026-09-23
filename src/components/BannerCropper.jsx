import React, {useRef, useState} from 'react';
import {Minus, Plus, RotateCcw} from 'lucide-react';
import Modal from './Modal';
import {moveBannerCrop} from '../../shared/banner-crop.mjs';

export default function BannerCropper({source,initial,onApply,onClose}) {
  const [crop,setCrop]=useState({x:initial?.x??50,y:initial?.y??50,zoom:initial?.zoom??100});
  const [ready,setReady]=useState(false),[error,setError]=useState('');
  const frame=useRef(null),size=useRef({width:0,height:0}),pointers=useRef(new Map());
  const zoom=value=>setCrop(current=>({...current,zoom:Math.min(250,Math.max(100,value))}));
  const move=event=>{
    const old=pointers.current.get(event.pointerId);if(!old)return;
    const previous=[...pointers.current.values()],point={x:event.clientX,y:event.clientY};
    pointers.current.set(event.pointerId,point);
    if(pointers.current.size===2){
      const next=[...pointers.current.values()];
      const before=Math.hypot(previous[0].x-previous[1].x,previous[0].y-previous[1].y);
      const after=Math.hypot(next[0].x-next[1].x,next[0].y-next[1].y);
      if(before>0)setCrop(current=>({...current,zoom:Math.min(250,Math.max(100,current.zoom*after/before))}));
    }else if(pointers.current.size===1)setCrop(current=>moveBannerCrop(current,{x:point.x-old.x,y:point.y-old.y},size.current,frame.current.getBoundingClientRect()));
  };
  return <Modal isOpen onClose={onClose} title="Ajustar imagem do banner" maxWidth="max-w-4xl">
    <p id="banner-crop-help" className="mb-4 text-sm text-text-muted">Arraste a imagem para enquadrar. No celular, use dois dedos para ampliar ou reduzir. O quadro indica a área visível do banner.</p>
    <div ref={frame} role="group" aria-label="Área de recorte do banner" aria-describedby="banner-crop-help" tabIndex={0}
      className="relative w-full touch-none select-none overflow-hidden rounded-xl bg-slate-900 outline-none focus-visible:ring-2 focus-visible:ring-primary"
      style={{aspectRatio:'6.4 / 1',minHeight:120,cursor:ready?'grab':'wait'}}
      onPointerDown={event=>{if(!ready)return;event.currentTarget.setPointerCapture(event.pointerId);pointers.current.set(event.pointerId,{x:event.clientX,y:event.clientY});}}
      onPointerMove={move} onPointerUp={event=>pointers.current.delete(event.pointerId)} onPointerCancel={event=>pointers.current.delete(event.pointerId)} onLostPointerCapture={event=>pointers.current.delete(event.pointerId)}
      onKeyDown={event=>{const offsets={ArrowLeft:{x:-10,y:0},ArrowRight:{x:10,y:0},ArrowUp:{x:0,y:-10},ArrowDown:{x:0,y:10}};if(offsets[event.key]){event.preventDefault();setCrop(current=>moveBannerCrop(current,offsets[event.key],size.current,frame.current.getBoundingClientRect()));}}}>
      <img src={source} alt="Imagem escolhida para o banner" draggable={false} className="pointer-events-none absolute inset-0 h-full w-full object-cover"
        style={{objectPosition:`${crop.x}% ${crop.y}%`,transform:`scale(${crop.zoom/100})`,transformOrigin:`${crop.x}% ${crop.y}%`}}
        onLoad={event=>{size.current={width:event.currentTarget.naturalWidth,height:event.currentTarget.naturalHeight};setReady(true);}}
        onError={()=>setError('Não foi possível carregar a imagem. Escolha o arquivo novamente.')}/>
      <div className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3 border-2 border-white/80">{Array.from({length:9},(_,index)=><span key={index} className="border border-white/25"/>)}</div>
      {!ready&&!error&&<p className="relative p-4 text-sm text-white">Carregando imagem…</p>}
    </div>
    <div className="mt-5 flex items-center gap-3">
      <button type="button" className="icon-button" disabled={!ready||crop.zoom<=100} onClick={()=>zoom(crop.zoom-10)} aria-label="Reduzir imagem"><Minus/></button>
      <label className="min-w-0 flex-1"><span className="mb-2 flex justify-between text-sm"><span>Tamanho da imagem</span><span>{Math.round(crop.zoom)}%</span></span><input type="range" min={100} max={250} value={crop.zoom} disabled={!ready} onChange={event=>zoom(Number(event.target.value))} className="w-full accent-primary"/></label>
      <button type="button" className="icon-button" disabled={!ready||crop.zoom>=250} onClick={()=>zoom(crop.zoom+10)} aria-label="Ampliar imagem"><Plus/></button>
    </div>
    <p className="mt-3 text-xs text-text-muted">Também é possível mover a imagem com as setas do teclado.</p>
    {error&&<p role="alert" className="mt-3 text-danger">{error}</p>}
    <div className="mt-5 flex flex-wrap justify-between gap-3 border-t border-border pt-5"><button type="button" className="btn btn-secondary" onClick={()=>setCrop({x:50,y:50,zoom:100})}><RotateCcw className="h-4 w-4"/>Centralizar</button><button type="button" className="btn btn-primary" disabled={!ready||Boolean(error)} onClick={()=>onApply({x:Math.round(crop.x),y:Math.round(crop.y),zoom:Math.round(crop.zoom)})}>Usar este recorte</button></div>
  </Modal>;
}
