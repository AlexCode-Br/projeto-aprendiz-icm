import assert from 'node:assert/strict';
import test from 'node:test';
import { sanitizeImageBuffer, unsafePdfReason } from './media-security.mjs';
import { normalizeAnnouncementAttachments } from './storage.mjs';
import { normalizeProfilePhoto } from './profile-photos.mjs';

const png1x1 = () => Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2Zk8AAAAASUVORK5CYII=',
  'base64',
);

test('imagens válidas são aceitas e metadados textuais do PNG são removidos', () => {
  const source = png1x1();
  const iendOffset = source.indexOf(Buffer.from('IEND')) - 4;
  const text = Buffer.from('author\0sensitive metadata');
  const textChunk = Buffer.alloc(12 + text.length);
  textChunk.writeUInt32BE(text.length, 0);
  textChunk.write('tEXt', 4, 'ascii');
  text.copy(textChunk, 8);
  const withMetadata = Buffer.concat([source.subarray(0, iendOffset), textChunk, source.subarray(iendOffset)]);

  const normalized = sanitizeImageBuffer(withMetadata, 'image/png');
  assert.equal(normalized.error, undefined);
  assert.equal(normalized.width, 1);
  assert.equal(normalized.height, 1);
  assert.equal(normalized.buffer.includes(Buffer.from('sensitive metadata')), false);

  const profile = normalizeProfilePhoto(`data:image/png;base64,${withMetadata.toString('base64')}`);
  assert.equal(profile.error, undefined);
  assert.equal(profile.buffer.includes(Buffer.from('sensitive metadata')), false);
});

test('imagens excessivas, conteúdo disfarçado e PDFs ativos são rejeitados', () => {
  const oversized = png1x1();
  oversized.writeUInt32BE(10_001, 16);
  assert.match(sanitizeImageBuffer(oversized, 'image/png').error, /dimensões inválidas/i);

  const disguised = normalizeAnnouncementAttachments([{
    nome: 'foto.png',
    tipo: 'image/png',
    dataUrl: `data:image/png;base64,${Buffer.from('%PDF-1.7\n%%EOF').toString('base64')}`,
  }]);
  assert.match(disguised.error, /não corresponde ao tipo/i);

  const activePdf = Buffer.from('%PDF-1.7\n1 0 obj << /OpenAction 2 0 R /JavaScript true >>\nendobj\n%%EOF');
  assert.match(unsafePdfReason(activePdf), /recursos ativos/i);
  const attachment = normalizeAnnouncementAttachments([{
    nome: 'documento.pdf',
    tipo: 'application/pdf',
    dataUrl: `data:application/pdf;base64,${activePdf.toString('base64')}`,
  }]);
  assert.match(attachment.error, /recursos ativos/i);
});
