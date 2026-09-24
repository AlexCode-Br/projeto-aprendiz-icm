import React,{useCallback,useContext,useEffect,useRef,useState} from 'react';
import {CheckCheck,Heart,MessageCircle,Paperclip,Pencil,Pin,Send,Trash2,Users} from 'lucide-react';
import {AuthContext} from '../contexts/AuthContext';
import api from '../services/api';
import {COURSE_WALL_CATEGORIES} from '../../shared/course-wall.mjs';
import {CourseWallFormModal} from './CourseAnnouncementsModal';
import AnnouncementAttachments from './AnnouncementAttachments';
import ConfirmationModal from './ConfirmationModal';
import Pagination from './Pagination';
import AnnouncementAttachmentPicker from './AnnouncementAttachmentPicker';
import ProfileAvatar from './ProfileAvatar';
import FormSelect from './FormSelect';
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
    {data.items.map(item=><div key={item.id} className="flex gap-3 rounded-xl bg-surface-muted p-3"><ProfileAvatar name={item.autor} src={item.fotoUrl} className="h-8 w-8" textClassName="text-xs"/><div className="min-w-0 flex-1"><div className="flex justify-between gap-2"><div><strong className="text-sm">{item.autor}</strong>{item.role==='professor'&&<span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-[0.68rem] font-semibold text-primary">Professor</span>}</div>{item.podeExcluir&&<button type="button" className="icon-button" aria-label={`Excluir comentário de ${item.autor}`} onClick={()=>setDeleting(item)}><Trash2 className="h-4 w-4"/></button>}</div><p className="mt-1 whitespace-pre-wrap break-words text-sm">{item.conteudo}</p><time className="mt-1 block text-xs text-text-muted">{new Date(item.data).toLocaleString('pt-BR')}</time></div></div>)}
    {!data.items.length&&<p className="rounded-xl bg-surface-muted p-4 text-sm text-text-muted">Ainda não há comentários nesta publicação.</p>}
    <Pagination currentPage={page} totalItems={data.total} itemsPerPage={20} onPageChange={setPage}/>
    {canComment?<form onSubmit={submit} className="flex flex-col gap-2 sm:flex-row"><input aria-label="Seu comentário" className="form-control min-w-0 flex-1" value={text} maxLength={2000} required disabled={busy} onChange={event=>setText(event.target.value)} placeholder="Escreva um comentário…"/><button className="btn btn-primary" disabled={busy||!text.trim()}>{busy?'Enviando…':'Comentar'}</button></form>:<p className="text-sm text-text-muted">{readOnly?'A gestão acompanha esta conversa em modo somente leitura.':'Os comentários estão desativados pelo professor nesta turma.'}</p>}
    <ConfirmationModal isOpen={Boolean(deleting)} onClose={()=>setDeleting(null)} onConfirm={remove} title="Excluir comentário" message="Deseja remover este comentário da turma?" confirmLabel="Excluir" loading={busy}/>
  </section>;
}

export default function CourseCommunity({course}){
  const {user}=useContext(AuthContext),isStudent=user?.role==='aluno',isTeacher=user?.role==='professor',isManager=user?.role==='gestor';
  const [composer,setComposer]=useState({conteudo:'',categoria:'Aviso',fixarNoTopo:false,solicitarConfirmacao:false}),[attachments,setAttachments]=useState([]),[attachOpen,setAttachOpen]=useState(false);
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
      await api.post(base,{titulo:plainContent.slice(0,100),conteudo:content,categoria:composer.categoria,anexos:attachments,fixarNoTopo:isTeacher&&composer.fixarNoTopo,solicitarConfirmacao:isTeacher&&composer.solicitarConfirmacao});
      setComposer({conteudo:'',categoria:'Aviso',fixarNoTopo:false,solicitarConfirmacao:false});setAttachments([]);setAttachOpen(false);
      if(page===1)await load();else setPage(1);
    }catch(reason){setError(reason.message);}finally{setPublishing(false);}
  };

  return <div className="space-y-4">
    {permissions.publicar?<form onSubmit={publish} className="panel p-4 sm:p-5">
      <div className="flex items-start gap-3"><ProfileAvatar name={user?.nome||user?.name||'Você'} src="/api/profile-photo" className="h-10 w-10"/><div className="min-w-0 flex-1"><RichTextEditor id={`course-wall-composer-${course.id}`} value={composer.conteudo} onChange={value=>setComposer(current=>({...current,conteudo:value}))} label="Mensagem para a turma" placeholder="Compartilhe uma mensagem, atividade ou material com a turma…" disabled={publishing} minHeightClass="min-h-24"/></div></div>
      {isTeacher&&<div className="mt-3 grid gap-3 pl-0 sm:grid-cols-[minmax(0,15rem)_1fr] sm:pl-[3.25rem]"><label><span className="form-label">Tipo de publicação</span><FormSelect value={composer.categoria} options={COURSE_WALL_CATEGORIES} isClearable={false} isSearchable={false} isDisabled={publishing} onChange={event=>setComposer(current=>({...current,categoria:event.target.value}))}/></label><div className="grid gap-2 sm:grid-cols-2"><label className="flex cursor-pointer items-start gap-2 rounded-xl border border-border p-3 text-sm"><input type="checkbox" className="mt-0.5 h-4 w-4 accent-primary" checked={composer.fixarNoTopo} disabled={publishing} onChange={event=>setComposer(current=>({...current,fixarNoTopo:event.target.checked}))}/><span><strong className="block">Fixar no topo</strong><span className="text-xs text-text-muted">Destaque permanente</span></span></label><label className="flex cursor-pointer items-start gap-2 rounded-xl border border-border p-3 text-sm"><input type="checkbox" className="mt-0.5 h-4 w-4 accent-primary" checked={composer.solicitarConfirmacao} disabled={publishing} onChange={event=>setComposer(current=>({...current,solicitarConfirmacao:event.target.checked}))}/><span><strong className="block">Pedir confirmação</strong><span className="text-xs text-text-muted">Exige ação do aluno</span></span></label></div></div>}
      {attachOpen&&<div className="mt-3 sm:pl-[3.25rem]"><AnnouncementAttachmentPicker value={attachments} onChange={setAttachments} disabled={publishing}/></div>}
      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:pl-[3.25rem]"><button type="button" className="flex items-center gap-2 text-sm font-medium text-text-muted hover:text-primary" disabled={publishing} onClick={()=>setAttachOpen(value=>!value)}><Paperclip className="h-4 w-4"/>Fotos e arquivos{attachments.length?` (${attachments.length})`:''}</button><button className="btn btn-primary" disabled={publishing||richTextToPlainText(composer.conteudo).length<10}><Send className="h-4 w-4"/>{publishing?'Publicando…':'Publicar'}</button></div>
      <p className="mt-2 text-xs text-text-muted sm:pl-[3.25rem]">Visível somente para professor e alunos desta turma.</p>
    </form>:<div className="panel flex items-start gap-3 p-4 text-sm text-text-muted"><Users className="mt-0.5 h-5 w-5 shrink-0 text-primary"/><p>{isManager?'Visualização administrativa do mural. Publicações e interações permanecem sob responsabilidade do professor e dos alunos da turma.':<>O professor configurou este mural para publicações exclusivas dele. Você ainda pode acompanhar todo o conteúdo{permissions.comentar?' e participar dos comentários':''}.</>}</p></div>}
    {error&&<p role="alert" className="rounded-xl bg-danger/10 p-3 text-sm text-danger">{error}</p>}
    {loading?<div className="panel p-8 text-center text-sm text-text-muted" role="status">Carregando mural…</div>:data.items.map(item=><ViewedPost key={item.id} postId={item.id} enabled={isStudent&&!item.lido&&!item.requerConfirmacao} onViewed={markRead}><article className={`panel p-4 sm:p-5 ${item.fixado?'border-primary/40':''}`}>
      <div className="flex items-start justify-between gap-3"><div className="flex min-w-0 items-center gap-3"><ProfileAvatar name={item.autor} src={item.fotoUrl} className="h-10 w-10"/><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><strong className="truncate text-sm">{item.autor}</strong>{item.autorRole==='professor'&&<span className="rounded-full bg-primary/10 px-2 py-0.5 text-[0.68rem] font-semibold text-primary">Professor</span>}</div><time className="mt-1 block text-xs text-text-muted">{new Date(item.data).toLocaleString('pt-BR')}</time></div></div><div className="flex shrink-0">{item.podeEditar&&<button type="button" className="icon-button" aria-label="Editar publicação" onClick={()=>setEditor({item})}><Pencil className="h-4 w-4"/></button>}{item.podeExcluir&&<button type="button" className="icon-button text-danger" aria-label="Excluir publicação" onClick={()=>setDeleting(item)}><Trash2 className="h-4 w-4"/></button>}</div></div>
      <div className="mt-3 flex flex-wrap gap-2"><span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">{item.categoria}</span>{item.fixado&&<span className="inline-flex items-center gap-1 rounded-full bg-surface-muted px-2.5 py-1 text-xs font-semibold text-text-muted"><Pin className="h-3.5 w-3.5"/>Fixado</span>}{item.requerConfirmacao&&<span className="inline-flex items-center gap-1 rounded-full bg-warning/10 px-2.5 py-1 text-xs font-semibold text-warning"><CheckCheck className="h-3.5 w-3.5"/>Confirmação solicitada</span>}</div>
      {item.titulo!==item.conteudo.replace(/<[^>]+>/g,'').trim().slice(0,100)&&<h2 className="mt-3 break-words font-semibold">{item.titulo}</h2>}<div className="announcement-content mt-3 break-words text-sm leading-6" dangerouslySetInnerHTML={{__html:item.conteudo}}/>
      {item.anexos.filter(file=>file.tipo.startsWith('image/')).map(file=><a key={file.id} href={file.url} target="_blank" rel="noreferrer" className="block"><img src={file.url} alt={file.nome} loading="lazy" className="mt-3 max-h-[32rem] w-full rounded-xl bg-surface-muted object-contain"/></a>)}
      <AnnouncementAttachments attachments={item.anexos}/>
      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-3 border-t border-border pt-3"><button type="button" disabled={liking===item.id||!permissions.reagir} className={`flex items-center gap-2 text-sm font-medium ${item.curtiu?'text-primary':'text-text-muted'} disabled:cursor-not-allowed disabled:opacity-50`} aria-pressed={item.curtiu} title={!permissions.reagir?(isManager?'Acompanhamento administrativo somente leitura':'Reações desativadas pelo professor'):undefined} onClick={()=>like(item)}><Heart className="h-5 w-5" fill={item.curtiu?'currentColor':'none'}/>{plural(item.curtidas,'curtida','curtidas')}</button><button type="button" className="flex items-center gap-2 text-sm font-medium text-text-muted hover:text-primary" aria-expanded={Boolean(comments[item.id])} onClick={()=>setComments(current=>({...current,[item.id]:!current[item.id]}))}><MessageCircle className="h-5 w-5"/>{plural(item.comentarios,'comentário','comentários')}</button>{isStudent&&item.requerConfirmacao&&!item.lido&&<button type="button" className="ml-auto inline-flex items-center gap-2 text-sm font-semibold text-primary" onClick={()=>markRead(item.id)}><CheckCheck className="h-5 w-5"/>Confirmar leitura</button>}{isStudent&&item.requerConfirmacao&&item.lido&&<span className="ml-auto inline-flex items-center gap-2 text-sm font-semibold text-success"><CheckCheck className="h-5 w-5"/>Leitura confirmada</span>}</div>
      {isTeacher&&<details className="mt-4 rounded-xl bg-surface-muted px-3 py-2 text-sm"><summary className="flex cursor-pointer list-none items-center gap-2 font-semibold"><Users className="h-4 w-4 text-primary"/>{item.requerConfirmacao?'Confirmações':'Visualizações'}: {item.visualizacoes?.length||0} de {item.totalAlunos}</summary>{item.visualizacoes?.length?<ul className="mt-2 divide-y divide-border">{item.visualizacoes.map(view=><li key={view.alunoId} className="flex flex-col gap-0.5 py-2 sm:flex-row sm:justify-between"><span>{view.nome}</span><time className="text-xs text-text-muted">{new Date(view.data).toLocaleString('pt-BR')}</time></li>)}</ul>:<p className="mt-2 text-text-muted">Nenhum aluno registrou a leitura ainda.</p>}</details>}
      {comments[item.id]&&<Comments base={`${base}/${item.id}`} canComment={permissions.comentar} readOnly={isManager} onChange={()=>load(true)}/>} 
    </article></ViewedPost>)}
    {!loading&&!data.items.length&&<div className="panel p-8 text-center text-text-muted">O mural desta turma ainda não possui publicações.</div>}
    <Pagination currentPage={page} totalItems={data.total} itemsPerPage={5} onPageChange={setPage}/>
    {editor&&<CourseWallFormModal course={course} item={editor.item} student={isStudent} onClose={()=>setEditor(null)} onSaved={async()=>{setEditor(null);await load();}}/>}
    <ConfirmationModal isOpen={Boolean(deleting)} onClose={()=>setDeleting(null)} onConfirm={remove} title="Excluir publicação" message="A publicação e seus comentários serão removidos da turma." confirmLabel="Excluir" loading={publishing}/>
  </div>;
}
