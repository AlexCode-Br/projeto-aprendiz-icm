import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeProfilePhoto, PROFILE_PHOTO_MAX_BYTES } from './profile-photos.mjs';

const dataUrl = (mime, buffer) => `data:${mime};base64,${buffer.toString('base64')}`;

test('foto de perfil valida tipo real, Base64 e limite de tamanho', () => {
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2Zk8AAAAASUVORK5CYII=', 'base64');
  const valid = normalizeProfilePhoto(dataUrl('image/png', png));
  assert.equal(valid.error, undefined);
  assert.equal(valid.mimeType, 'image/png');
  assert.equal(valid.buffer.subarray(0, 8).equals(png.subarray(0, 8)), true);
  assert.match(normalizeProfilePhoto(dataUrl('image/jpeg', png)).error, /não corresponde/);
  assert.match(normalizeProfilePhoto('data:image/svg+xml;base64,PHN2Zz4=').error, /PNG/);
  const oversized = Buffer.concat([Buffer.from([0xff,0xd8,0xff]), Buffer.alloc(PROFILE_PHOTO_MAX_BYTES)]);
  assert.match(normalizeProfilePhoto(dataUrl('image/jpeg', oversized)).error, /5 MB/);
});
