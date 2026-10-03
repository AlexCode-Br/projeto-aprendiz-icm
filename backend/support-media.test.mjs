import assert from 'node:assert/strict';
import test from 'node:test';
import { createSupportStorage, normalizeSupportAttachments } from './support-media.mjs';
import { supportFileType } from '../shared/support-media.mjs';
const attachment=(name,type,buffer)=>({nome:name,tipo:type,dataUrl:`data:${type};base64,${buffer.toString('base64')}`});

test('validação de mídia rejeita formatos falsos, repetidos, excesso e PDFs ativos',()=>{
  const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2Zk8AAAAASUVORK5CYII=','base64');
  const photo=attachment('foto.png','image/png',png);
  assert.equal(normalizeSupportAttachments([photo]).items[0].mime_type,'image/png');
  assert.match(normalizeSupportAttachments([photo,photo]).error,/já foi selecionado/);
  assert.ok(normalizeSupportAttachments(Array(6).fill(photo)).error);
  assert.ok(normalizeSupportAttachments([attachment('foto.png','image/png',Buffer.from('<html>'))]).error);
  assert.ok(normalizeSupportAttachments([attachment('pagina.html','text/plain',Buffer.from('<html>'))]).error);
  assert.ok(normalizeSupportAttachments([attachment('arquivo.pdf','application/pdf',Buffer.from('%PDF-1.4 /JavaScript (alert) %%EOF'))]).error);
  assert.ok(normalizeSupportAttachments([attachment('texto.txt','text/plain',Buffer.from([0xff]))]).error);
  assert.ok(normalizeSupportAttachments([attachment('documento.docx','application/vnd.openxmlformats-officedocument.wordprocessingml.document',Buffer.from('PKfake'))]).error);
  assert.ok(normalizeSupportAttachments([attachment('grande.txt','text/plain',Buffer.alloc(10*1024*1024+1,65))]).error);
  assert.equal(supportFileType('audio.webm','audio/webm;codecs=opus'),'audio/webm');
  assert.equal(supportFileType('documento.pdf','application/octet-stream'),'application/pdf');
  const video=Buffer.alloc(32);video.writeUInt32BE(24);video.write('ftypisom',4);
  assert.equal(normalizeSupportAttachments([attachment('video.mp4','video/mp4',video)]).items.length,1);
});

test('storage recusa bucket público e compensa uploads parcialmente concluídos',async()=>{
  const forbidden=createSupportStorage({isProduction:true,supabaseAdmin:{storage:{getBucket:async()=>({data:{public:true}})}}});
  await assert.rejects(forbidden.store(1,[{filename:'arquivo.txt'}]),/privado/);
  await assert.rejects(createSupportStorage({isProduction:true}).store(1,[{}]),/indisponível/);
  const removed=[];let calls=0;
  const storage=createSupportStorage({supabaseAdmin:{storage:{getBucket:async()=>({data:{public:false}}),from:()=>({
    upload:async()=>++calls===1?{}:{error:new Error('falha simulada')},remove:async paths=>{removed.push(...paths);return {};},
  })}}});
  await assert.rejects(storage.store(1,[{filename:'um.txt',buffer:Buffer.from('a'),mime_type:'text/plain'},{filename:'dois.txt',buffer:Buffer.from('b'),mime_type:'text/plain'}]),/falha simulada/);
  assert.equal(removed.length,1);assert.match(removed[0],/^conversas\/1\//);
});
