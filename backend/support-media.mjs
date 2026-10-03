import { createHash, randomUUID } from 'node:crypto';
import { cleanText } from '../shared/validation.mjs';
import { SUPPORT_FILE_MAX_COUNT, SUPPORT_FILE_TOTAL_BYTES, SUPPORT_FILE_TYPES, supportFileLimit, supportFileType } from '../shared/support-media.mjs';
import { normalizeAnnouncementAttachments } from './storage.mjs';

function officeDocument(buffer,mime) {
  const expected=mime.includes('wordprocessing')?'word/document.xml':mime.includes('spreadsheet')?'xl/workbook.xml':'ppt/presentation.xml';
  const end=buffer.lastIndexOf(Buffer.from([0x50,0x4b,0x05,0x06]));
  if(end<0||end+22>buffer.length)return false;
  const count=buffer.readUInt16LE(end+10),offset=buffer.readUInt32LE(end+16);
  if(count<2||count>2000||offset>=end)return false;
  const names=[];let position=offset,total=0;
  for(let i=0;i<count;i++){
    if(position+46>end||buffer.readUInt32LE(position)!==0x02014b50)return false;
    const length=buffer.readUInt16LE(position+28),extra=buffer.readUInt16LE(position+30),comment=buffer.readUInt16LE(position+32);
    if(position+46+length+extra+comment>end||buffer.readUInt16LE(position+8)&1)return false;
    const name=buffer.subarray(position+46,position+46+length).toString('utf8');
    if(/(?:^|\/)\.\.(?:\/|$)|\\|^\/|vbaProject|embeddings\//i.test(name))return false;
    total+=buffer.readUInt32LE(position+24);if(total>40*1024*1024)return false;
    names.push(name);position+=46+length+extra+comment;
  }
  return names.includes('[Content_Types].xml')&&names.includes(expected);
}
function containerMatches(buffer,type) {
  if(type==='text/plain'){try{new TextDecoder('utf-8',{fatal:true}).decode(buffer);return !buffer.includes(0);}catch{return false;}}
  if(type.includes('openxmlformats'))return officeDocument(buffer,type);
  if(type.endsWith('/webm'))return buffer.length>16&&buffer.readUInt32BE(0)===0x1a45dfa3&&buffer.subarray(0,4096).includes(Buffer.from('webm'));
  if(type==='audio/ogg')return buffer.length>27&&buffer.subarray(0,4).toString()==='OggS';
  if(type==='audio/wav')return buffer.length>=44&&buffer.subarray(0,4).toString()==='RIFF'&&buffer.subarray(8,12).toString()==='WAVE';
  if(type==='audio/mpeg')return buffer.length>10&&(buffer.subarray(0,3).toString()==='ID3'||buffer[0]===255&&(buffer[1]&0xe0)===0xe0);
  if(type.endsWith('/mp4'))return buffer.length>=24&&buffer.subarray(4,8).toString()==='ftyp';
  return false;
}

export function normalizeSupportAttachments(value) {
  if(value==null)return {items:[]};
  if(!Array.isArray(value)||value.length>SUPPORT_FILE_MAX_COUNT)return {error:'Envie até 5 arquivos por mensagem.'};
  const items=[],fingerprints=new Set();let total=0;
  for(const file of value){
    const type=supportFileType(file?.nome,file?.tipo),match=String(file?.dataUrl||'').match(/^data:([^;,]+);base64,([A-Za-z0-9+/=]+)$/);
    if(!type||!match||match[1]!==type)return {error:'Arquivo inválido ou formato não suportado.'};
    let buffer=Buffer.from(match[2],'base64');
    if(!buffer.length||buffer.toString('base64')!==match[2]||buffer.length>supportFileLimit(type))return {error:'Arquivo inválido ou acima do limite permitido.'};
    let filename=cleanText(String(file.nome).replace(/[\\/:*?"<>|]/g,'_'),180);
    if(!supportFileType(filename,type))return {error:'Nome de arquivo inválido.'};
    if(type.startsWith('image/')||type==='application/pdf'){
      const normalized=normalizeAnnouncementAttachments([{nome:filename,tipo:type,dataUrl:file.dataUrl}]);
      if(normalized.error)return {error:normalized.error};
      buffer=normalized.newItems[0].buffer;filename=normalized.newItems[0].filename;
    }else if(!containerMatches(buffer,type))return {error:'O conteúdo do arquivo não corresponde ao formato informado.'};
    const fingerprint=createHash('sha256').update(buffer).digest('hex');
    if(fingerprints.has(fingerprint))return {error:'Este arquivo já foi selecionado.'};
    fingerprints.add(fingerprint);total+=buffer.length;
    if(total>SUPPORT_FILE_TOTAL_BYTES)return {error:'O total de arquivos deve ter até 20 MB por mensagem.'};
    items.push({filename,mime_type:type,size_bytes:buffer.length,buffer,
      voice_message:file.audio_gravado===true&&type.startsWith('audio/')?1:0});
  }
  return {items};
}

export function createSupportStorage({supabaseAdmin,isProduction,logger=console}) {
  const bucket='support-attachments';let ready;
  const ensure=async()=>{
    if(!supabaseAdmin){if(isProduction)throw new Error('Storage de suporte indisponível.');return;}
    ready ||= (async()=>{
      const {data,error}=await supabaseAdmin.storage.getBucket(bucket);
      if(data&&!error){if(data.public)throw new Error('O bucket de suporte deve ser privado.');return;}
      if(error&&!['404','not_found'].includes(String(error.statusCode||error.code)))throw error;
      const created=await supabaseAdmin.storage.createBucket(bucket,{public:false,fileSizeLimit:SUPPORT_FILE_TOTAL_BYTES,allowedMimeTypes:Object.keys(SUPPORT_FILE_TYPES)});
      if(created.error&&!/already exists/i.test(created.error.message||''))throw created.error;
      const verified=await supabaseAdmin.storage.getBucket(bucket);
      if(verified.error||verified.data?.public!==false)throw new Error('Não foi possível validar o storage privado.');
    })().catch(error=>{ready=null;throw error;});
    await ready;
  };
  const remove=async paths=>{
    const unique=[...new Set(paths.filter(Boolean))];if(!supabaseAdmin||!unique.length)return;
    const result=await supabaseAdmin.storage.from(bucket).remove(unique);if(result.error)throw result.error;
  };
  const cleanup=paths=>remove(paths).catch(error=>logger.error('support_storage_cleanup_failed',error));
  const store=async(professorId,items)=>{
    if(!items.length)return [];
    await ensure();const stored=[];
    try{
      for(const item of items){
        if(!supabaseAdmin){stored.push({...item,data_url:`data:${item.mime_type};base64,${item.buffer.toString('base64')}`,storage_path:null});continue;}
        const extension=item.filename.match(/\.[^.]+$/)[0].toLowerCase();
        const path=`conversas/${professorId}/${randomUUID()}${extension}`;
        const result=await supabaseAdmin.storage.from(bucket).upload(path,item.buffer,{contentType:item.mime_type,upsert:false});
        if(result.error)throw result.error;
        stored.push({...item,data_url:null,storage_path:path});
      }
      return stored;
    }catch(error){await cleanup(stored.map(item=>item.storage_path));throw error;}
  };
  const download=async item=>{
    if(!item.storage_path)return Buffer.from(item.data_url.split(',')[1],'base64');
    if(!supabaseAdmin)throw new Error('Storage de suporte indisponível.');
    const result=await supabaseAdmin.storage.from(bucket).download(item.storage_path);
    if(result.error||!result.data)throw new Error('Não foi possível carregar o arquivo.');
    return Buffer.from(await result.data.arrayBuffer());
  };
  return {store,download,cleanup};
}
