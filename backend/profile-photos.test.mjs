import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeProfilePhoto, PROFILE_PHOTO_MAX_BYTES } from './profile-photos.mjs';

const dataUrl = (mime, buffer) => `data:${mime};base64,${buffer.toString('base64')}`;

test('foto de perfil valida tipo real, Base64 e limite de tamanho', () => {
  const png = Buffer.concat([Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]), Buffer.from('profile')]);
  const valid = normalizeProfilePhoto(dataUrl('image/png', png));
  assert.equal(valid.error, undefined);
  assert.equal(valid.mimeType, 'image/png');
  assert.deepEqual(valid.buffer, png);
  assert.match(normalizeProfilePhoto(dataUrl('image/jpeg', png)).error, /não corresponde/);
  assert.match(normalizeProfilePhoto('data:image/svg+xml;base64,PHN2Zz4=').error, /PNG/);
  const oversized = Buffer.concat([Buffer.from([0xff,0xd8,0xff]), Buffer.alloc(PROFILE_PHOTO_MAX_BYTES)]);
  assert.match(normalizeProfilePhoto(dataUrl('image/jpeg', oversized)).error, /5 MB/);
});
