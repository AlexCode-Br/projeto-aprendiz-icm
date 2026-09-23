import React,{useEffect,useState} from 'react';
import ClassSettingsModal from './ClassSettingsModal';
import api from '../services/api';

export default function TeacherClassSetup(){
  const [items,setItems]=useState([]),[open,setOpen]=useState(true);
  useEffect(()=>{
    let active=true;
    const refresh=()=>api.get('/api/turmas/configuracao-pendente').then(({data})=>{if(active)setItems(data.items);}).catch(()=>{});
    refresh();
    window.addEventListener('class-presentation:updated',refresh);
    return()=>{active=false;window.removeEventListener('class-presentation:updated',refresh);};
  },[]);
  if(!items.length)return null;
  return <>
    {!open&&<div className="alert-warning mb-5"><p>Configure o endereço e o banner das suas turmas.</p><button className="btn btn-secondary mt-2" onClick={()=>setOpen(true)}>Configurar turma</button></div>}
    {open&&<ClassSettingsModal key={items[0].id} course={items[0]} onClose={()=>setOpen(false)} onSaved={async()=>{setItems(current=>current.slice(1));window.dispatchEvent(new Event('class-presentation:updated'));}}/>}
  </>;
}
