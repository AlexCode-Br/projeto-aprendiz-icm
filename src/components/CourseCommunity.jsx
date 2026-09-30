import React,{useCallback,useContext,useEffect,useRef,useState} from 'react';
import {CheckCheck,Heart,MessageCircle,Paperclip,Pencil,Pin,Send,Trash2,Users} from 'lucide-react';
import {AuthContext} from '../contexts/AuthContext';
import api from '../services/api';
import {CourseWallFormModal} from './CourseAnnouncementsModal';
import AnnouncementAttachments from './AnnouncementAttachments';
import ConfirmationModal from './ConfirmationModal';
import Pagination from './Pagination';
import AnnouncementAttachmentPicker from './AnnouncementAttachmentPicker';
import ProfileAvatar from './ProfileAvatar';
import KebabMenu,{KebabMenuItem} from './KebabMenu';
import useLiveRefresh from '../hooks/useLiveRefresh';
import RichTextEditor,{richTextToPlainText} from './RichTextEditor';

const WALL_REFRESH_MS=5000;
const defaultPermissions={mode:'teacher_only',publicar:false,comentar:false,reagir:false};
const plural=(value,singular,pluralLabel)=>`${value} ${value===1?singular:pluralLabel}`;

function ViewedPost({enabled,postId,onViewed,children}){
  const element=useRef(null),reported=useRef(false);
  useEffect(()=>{
    if(!enabled||reported.current||!element.current)return undefined;
    let timer;
    const observer=new IntersectionObserver(entries=>{
      if(entries[0]?.isIntersecting)timer=window.setTimeout(()=>{reported.current=true;observer.disconnect();onViewed(postId);},900);
      else window.clearTimeout(timer);
    },{threshold:0.35});
    observer.observe(element.current);
    return()=>{window.clearTimeout(timer);observer.disconnect();};
  },[enabled,onViewed,postId]);
  return <div ref={element}>{children}</div>;
}

function Comments({base,onChange,canComment,readOnly=false}){
  const [data,setData]=useState({items:[],total:0}),[page,setPage]=useState(1),[text,setText]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[deleting,setDeleting]=useState(null);
  const requestId=useRef(0);
  const load=useCallback(async(silent=false)=>{
    const current=++requestId.current;
    try{const result=await api.get(`${base}/comentarios`,{params:{page}});if(current===requestId.current){setData(result.data);setError('');}}
    catch(reason){if(!silent&&current===requestId.current)setError(reason.message);}
  },[base,page]);
  useEffect(()=>{const active=requestId;void load();return()=>{active.current++;};},[load]);
  useLiveRefresh(()=>load(true),{intervalMs:WALL_REFRESH_MS});
  const submit=async event=>{
    event.preventDefault();setBusy(true);setError('');
    try{await api.post(`${base}/comentarios`,{conteudo:text.trim()});setText('');if(page===1)await load();else setPage(1);await onChange();}
    catch(reason){setError(reason.message);}finally{setBusy(false);}
  };
  const remove=async()=>{
    if(!deleting)return;
    setBusy(true);setError('');
    try{await api.delete(`${base}/comentarios/${deleting.id}`);setDeleting(null);await load();await onChange();}
    catch(reason){setError(reason.message);}finally{setBusy(false);}
  };
  return <section className="mt-4 space-y-3 border-t border-border pt-4" aria-label="Comentários">
    <div className="flex items-center justify-between gap-3"><h3 className="text-sm font-semibold">Conversa</h3><span className="text-xs text-text-muted">{plural(data.total,'comentário','comentários')}</span></div>
    {error&&<p role="alert" className="rounded-lg bg-danger/10 p-3 text-sm text-danger">{error}</p>}
    {data.items.map(item=><div key={item.id} className="flex gap-3 rounded-xl bg-surface-muted p-3"><ProfileAvatar name={item.autor} src={item.fotoUrl} className="h-8 w-8" textClassName="text-xs"/><div className="min-w-0 flex-1 [overflow-wrap:anywhere]"><div className="flex justify-between gap-2"><div className="min-w-0"><strong className="text-sm">{item.autor}</strong>{item.role==='professor'&&<span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-[0.68rem] font-semibold text-primary">Professor</span>}</div>{item.podeExcluir&&<button type="button" className="icon-button" aria-label={`Excluir comentário de ${item.autor}`} onClick={()=>setDeleting(item)}><Trash2 className="h-4 w-4"/></button>}</div><p className="mt-1 whitespace-pre-wrap break-words text-sm">{item.conteudo}</p><time className="mt-1 block text-xs text-text-muted">{new Date(item.data).toLocaleString('pt-BR')}</time></div></div>)}
    {!data.items.length&&<p className="rounded-xl bg-surface-muted p-4 text-sm text-text-muted">Ainda não há comentários nesta publicação.</p>}
    <Pagination currentPage={page} totalItems={data.total} itemsPerPage={20} onPageChange={setPage}/>
    {canComment?<form onSubmit={submit} className="flex flex-col gap-2 sm:flex-row"><textarea rows={2} aria-label="Seu comentário" className="form-control min-w-0 flex-1" value={text} maxLength={2000} required disabled={busy} onChange={event=>setText(event.target.value)} placeholder="Escreva um comentário…"/><button className="btn btn-primary" disabled={busy||!text.trim()}>{busy?'Enviando…':'Comentar'}</button></form>:<p className="text-sm text-text-muted">{readOnly?'A gestão acompanha esta conversa em modo somente leitura.':'Os comentários estão desativados pelo professor nesta turma.'}</p>}
    <ConfirmationModal isOpen={Boolean(deleting)} onClose={()=>setDeleting(null)} onConfirm={remove} title="Excluir comentário" message="Deseja remover este comentário da turma?" confirmLabel="Excluir" loading={busy}/>
  </section>;
}

export default function CourseCommunity({course}){
  const {user}=useContext(AuthContext),isStudent=user?.role==='aluno',isTeacher=user?.role==='professor',isManager=user?.role==='gestor';
  const [composer,setComposer]=useState({conteudo:'',fixarNoTopo:false}),[attachments,setAttachments]=useState([]),[attachOpen,setAttachOpen]=useState(false);
  const [data,setData]=useState({items:[],total:0,permissoes:null}),[page,setPage]=useState(1),[error,setError]=useState(''),[loading,setLoading]=useState(true),[editor,setEditor]=useState(null),[deleting,setDeleting]=useState(null),[publishing,setPublishing]=useState(false),[liking,setLiking]=useState(null),[comments,setComments]=useState({});
  const base=`/api/turmas/${course.id}/mural`,requestId=useRef(0),versionRef=useRef(''),permissions=data.permissoes||(isTeacher?{mode:'teacher_only',publicar:true,comentar:true,reagir:true}:defaultPermissions);
  const load=useCallback(async(silent=false)=>{
    const current=++requestId.current;
    try{const result=await api.get(base,{params:{page}});if(current===requestId.current){versionRef.current=result.data.version||'';setData(result.data);setError('');}}
    catch(reason){if(!silent&&current===requestId.current)setError(reason.message);}
    finally{if(current===requestId.current)setLoading(false);}
  },[base,page]);
  useEffect(()=>{const active=requestId;setLoading(true);void load();return()=>{active.current++;};},[load]);
  const refreshIfChanged=useCallback(async()=>{
    const result=await api.get(`${base}/versao`);
    if(!versionRef.current||result.data.version!==versionRef.current)await load(true);
  },[base,load]);
  useLiveRefresh(refreshIfChanged,{intervalMs:WALL_REFRESH_MS});

  const markRead=useCallback(async postId=>{
    setData(current=>({...current,items:current.items.map(item=>item.id===postId?{...item,lido:true}:item)}));
    try{await api.post(`/api/aluno/informativos/${postId}/lido`,{});}
    catch(reason){setData(current=>({...current,items:current.items.map(item=>item.id===postId?{...item,lido:false}:item)}));setError(reason.message);}
  },[]);
  const like=async item=>{
    if(liking||!permissions.reagir)return;
    const next=!item.curtiu;setLiking(item.id);setError('');
    setData(current=>({...current,items:current.items.map(post=>post.id===item.id?{...post,curtiu:next,curtidas:Math.max(0,post.curtidas+(next?1:-1))}:post)}));
    try{await (next?api.put(`${base}/${item.id}/curtida`,{}):api.delete(`${base}/${item.id}/curtida`));}
    catch(reason){setData(current=>({...current,items:current.items.map(post=>post.id===item.id?{...post,curtiu:item.curtiu,curtidas:item.curtidas}:post)}));setError(reason.message);}
    finally{setLiking(null);}
  };
  const remove=async()=>{
    if(!deleting)return;
    setPublishing(true);setError('');
    try{await api.delete(`${base}/${deleting.id}`);setDeleting(null);await load();}
    catch(reason){setError(reason.message);}finally{setPublishing(false);}
  };
  const publish=async event=>{
    event.preventDefault();if(publishing)return;setPublishing(true);setError('');
    const content=composer.conteudo.trim(),plainContent=richTextToPlainText(content);
    if(plainContent.length<10){setPublishing(false);return;}
    try{
      await api.post(base,{titulo:plainContent.slice(0,100),conteudo:content,categoria:'Aviso',anexos:attachments,fixarNoTopo:isTeacher&&composer.fixarNoTopo,solicitarConfirmacao:false});
      setComposer({conteudo:'',fixarNoTopo:false});setAttachments([]);setAttachOpen(false);
      if(page===1)await load();else setPage(1);
    }catch(reason){setError(reason.message);}finally{setPublishing(false);}
  };

  return <div className="space-y-4">
    {permissions.publicar?<form onSubmit={publish} className="panel min-w-0 p-3 sm:p-5" aria-label="Criar publicação">
      <div className="mb-3 flex items-center gap-3 sm:mb-4">
        <ProfileAvatar name={user?.nome||user?.name||'Você'} src="/api/profile-photo" className="h-9 w-9 shrink-0 sm:h-10 sm:w-10"/>
        <div className="min-w-0"><h2 className="font-semibold">Compartilhe com a turma</h2><p className="mt-0.5 text-xs text-text-muted">Mensagens, materiais e conversas em um só lugar.</p></div>
      </div>
      <RichTextEditor id={`course-wall-composer-${course.id}`} value={composer.conteudo} onChange={value=>setComposer(current=>({...current,conteudo:value}))} label="Mensagem para a turma" placeholder="O que você gostaria de compartilhar?" disabled={publishing} minHeightClass="min-h-24 sm:min-h-28"/>
      {attachOpen&&<div id={`wall-attachments-${course.id}`} className="mt-4 min-w-0"><AnnouncementAttachmentPicker value={attachments} onChange={setAttachments} disabled={publishing}/></div>}
      <div className="mt-2 flex flex-wrap items-center gap-x-2 sm:mt-3 sm:gap-x-3">
        <button type="button" className="inline-flex min-h-10 items-center gap-2 rounded-lg px-1.5 text-xs font-medium text-text-muted hover:bg-surface-hover hover:text-primary sm:min-h-11 sm:px-2 sm:text-sm" aria-expanded={attachOpen} aria-controls={`wall-attachments-${course.id}`} disabled={publishing} onClick={()=>setAttachOpen(value=>!value)}><Paperclip aria-hidden="true" className="h-4 w-4 shrink-0"/>Fotos e arquivos{attachments.length?` (${attachments.length})`:''}</button>
        {isTeacher&&<label className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-lg px-1.5 text-xs text-text-muted sm:min-h-11 sm:px-2 sm:text-sm"><input type="checkbox" className="h-4 w-4 accent-primary" checked={composer.fixarNoTopo} disabled={publishing} onChange={event=>setComposer(current=>({...current,fixarNoTopo:event.target.checked}))}/><Pin aria-hidden="true" className="h-4 w-4"/>Fixar no topo</label>}
      </div>
      <div className="mt-2 flex flex-col gap-2 border-t border-border pt-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        <p className="min-w-0 flex-1 text-xs leading-5 text-text-muted">{richTextToPlainText(composer.conteudo).length>0&&richTextToPlainText(composer.conteudo).length<10?'Escreva ao menos 10 caracteres para publicar.':'Visível somente para os participantes da turma.'}</p>
        <button className="btn btn-primary w-full shrink-0 sm:w-auto" disabled={publishing||richTextToPlainText(composer.conteudo).length<10}><Send aria-hidden="true" className="h-4 w-4"/>{publishing?'Publicando…':'Publicar'}</button>
      </div>
    </form>:<div className="panel flex items-start gap-3 p-4 text-sm text-text-muted"><Users aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-primary"/><p>Este mural recebe publicações do professor.{permissions.comentar?' Você pode participar nos comentários.':' Acompanhe aqui as novidades da turma.'}</p></div>}
    <div className="flex items-center justify-between gap-3 px-1"><h2 className="text-sm font-semibold">Publicações da turma</h2><span className="text-xs text-text-muted">{plural(data.total,'publicação','publicações')}</span></div>
    {error&&<p role="alert" className="rounded-xl bg-danger/10 p-3 text-sm text-danger">{error}</p>}
    {loading?<div className="panel p-8 text-center text-sm text-text-muted" role="status">Carregando mural…</div>:data.items.map(item=><ViewedPost key={item.id} postId={item.id} enabled={isStudent&&!item.lido&&!item.requerConfirmacao} onViewed={markRead}><article className={`panel p-3 sm:p-5 ${item.fixado?'border-primary/40':''}`}>
      <header className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3"><ProfileAvatar name={item.autor} src={item.fotoUrl} className="h-9 w-9 shrink-0 sm:h-10 sm:w-10"/><div className="min-w-0">
          <strong className="block break-words text-sm [overflow-wrap:anywhere]">{item.autor}</strong>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-text-muted">{item.autorRole==='professor'&&<span className="font-medium text-primary">Professor</span>}<time>{new Date(item.data).toLocaleString('pt-BR',{dateStyle:'medium',timeStyle:'short'})}</time></div>
        </div></div>
        {(item.podeEditar||item.podeExcluir)&&<KebabMenu label={`Ações da publicação de ${item.autor}`}>{item.podeEditar&&<KebabMenuItem icon={Pencil} onClick={()=>setEditor({item})}>Editar publicação</KebabMenuItem>}{item.podeExcluir&&<KebabMenuItem icon={Trash2} tone="danger" onClick={()=>setDeleting(item)}>Excluir publicação</KebabMenuItem>}</KebabMenu>}
      </header>
      {item.fixado&&<p className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-primary"><Pin aria-hidden="true" className="h-3.5 w-3.5"/>Publicação fixada</p>}
      {item.titulo!==richTextToPlainText(item.conteudo).slice(0,100)&&<h2 className="mt-3 break-words font-semibold">{item.titulo}</h2>}<div className="announcement-content mt-3 break-words text-sm leading-6" dangerouslySetInnerHTML={{__html:item.conteudo}}/>
      {item.anexos.some(file=>file.tipo.startsWith('image/'))&&<div className="mt-4 grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2">{item.anexos.filter(file=>file.tipo.startsWith('image/')).map((file,index,images)=><figure key={file.id} className={images.length===1?'min-w-0 sm:col-span-2':'min-w-0'}><a href={file.url} target="_blank" rel="noreferrer" aria-label={`Abrir imagem: ${file.nome}`} className="block overflow-hidden rounded-xl border border-border bg-surface-muted"><img src={file.url} alt={file.nome} loading="lazy" className={images.length===1?'max-h-96 w-full object-contain':'aspect-[4/3] w-full object-contain'}/></a><figcaption className="mt-1 flex min-w-0 items-center justify-between gap-2 text-xs text-text-muted"><span className="truncate">{file.nome}</span><a href={`${file.url}${file.url.includes('?')?'&':'?'}download=1`} download={file.nome} className="inline-flex min-h-11 shrink-0 items-center px-2 font-medium text-primary" aria-label={`Baixar ${file.nome}`}>Baixar</a></figcaption></figure>)}</div>}
      <AnnouncementAttachments attachments={item.anexos.filter(file=>!file.tipo.startsWith('image/'))}/>
      <div className="mt-4 grid grid-cols-2 items-center gap-1 border-t border-border pt-2 sm:flex sm:flex-wrap sm:gap-x-3 sm:gap-y-2 sm:pt-3"><button type="button" disabled={liking===item.id||!permissions.reagir} className={`flex min-h-10 items-center justify-center gap-2 rounded-lg px-2 text-xs font-medium hover:bg-surface-hover sm:min-h-11 sm:justify-start sm:text-sm ${item.curtiu?'text-primary':'text-text-muted'} disabled:cursor-not-allowed disabled:opacity-50`} aria-pressed={item.curtiu} title={!permissions.reagir?(isManager?'Acompanhamento administrativo somente leitura':'Reações desativadas pelo professor'):undefined} onClick={()=>like(item)}><Heart className="h-5 w-5" fill={item.curtiu?'currentColor':'none'}/>{plural(item.curtidas,'curtida','curtidas')}</button><button type="button" className="flex min-h-10 items-center justify-center gap-2 rounded-lg px-2 text-xs font-medium text-text-muted hover:bg-surface-hover hover:text-primary sm:min-h-11 sm:justify-start sm:text-sm" aria-expanded={Boolean(comments[item.id])} onClick={()=>setComments(current=>({...current,[item.id]:!current[item.id]}))}><MessageCircle className="h-5 w-5"/>{plural(item.comentarios,'comentário','comentários')}</button>{isStudent&&item.requerConfirmacao&&!item.lido&&<button type="button" className="col-span-2 inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-2 text-sm font-semibold text-primary hover:bg-primary/10 sm:ml-auto sm:min-h-11" onClick={()=>markRead(item.id)}><CheckCheck className="h-5 w-5"/>Confirmar leitura</button>}{isStudent&&item.requerConfirmacao&&item.lido&&<span className="col-span-2 inline-flex items-center justify-center gap-2 text-sm font-semibold text-success sm:ml-auto"><CheckCheck className="h-5 w-5"/>Leitura confirmada</span>}</div>
      {isTeacher&&<details className="mt-4 rounded-xl bg-surface-muted px-3 py-2 text-sm"><summary className="flex cursor-pointer list-none items-center gap-2 font-semibold"><Users className="h-4 w-4 text-primary"/>{item.requerConfirmacao?'Confirmações':'Visualizações'}: {item.visualizacoes?.length||0} de {item.totalAlunos}</summary>{item.visualizacoes?.length?<ul className="mt-2 divide-y divide-border">{item.visualizacoes.map(view=><li key={view.alunoId} className="flex flex-col gap-0.5 py-2 sm:flex-row sm:justify-between"><span>{view.nome}</span><time className="text-xs text-text-muted">{new Date(view.data).toLocaleString('pt-BR')}</time></li>)}</ul>:<p className="mt-2 text-text-muted">Nenhum aluno registrou a leitura ainda.</p>}</details>}
      {comments[item.id]&&<Comments base={`${base}/${item.id}`} canComment={permissions.comentar} readOnly={isManager} onChange={()=>load(true)}/>} 
    </article></ViewedPost>)}
    {!loading&&!data.items.length&&<div className="panel flex flex-col items-center gap-3 px-5 py-12 text-center"><MessageCircle aria-hidden="true" className="h-9 w-9 text-primary/60"/><h3 className="font-semibold">A conversa começa aqui</h3><p className="max-w-sm text-sm leading-6 text-text-muted">{permissions.publicar?'Compartilhe a primeira mensagem ou material com a turma.':'As publicações do professor aparecerão neste espaço.'}</p></div>}
    <Pagination currentPage={page} totalItems={data.total} itemsPerPage={5} onPageChange={setPage}/>
    {editor&&<CourseWallFormModal course={course} item={editor.item} student={isStudent} onClose={()=>setEditor(null)} onSaved={async()=>{setEditor(null);await load();}}/>}
    <ConfirmationModal isOpen={Boolean(deleting)} onClose={()=>setDeleting(null)} onConfirm={remove} title="Excluir publicação" message="A publicação e seus comentários serão removidos da turma." confirmLabel="Excluir" loading={publishing}/>
  </div>;
}
