import { randomUUID } from 'node:crypto';

export const PROFILE_PHOTO_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);
export const PROFILE_PHOTO_MAX_BYTES = 5 * 1024 * 1024;

function detectedMime(buffer) {
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  if (buffer.length >= 12 && buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
  return '';
}

export function normalizeProfilePhoto(value) {
  const dataUrl = String(value || '').trim();
  const match = dataUrl.match(/^data:([a-z0-9.+/-]+);base64,([a-z0-9+/=\s]+)$/i);
  const declaredMime = String(match?.[1] || '').toLowerCase();
  if (!match || !PROFILE_PHOTO_TYPES.has(declaredMime)) return { error: 'Selecione uma foto PNG, JPG/JPEG ou WEBP.' };
  const base64 = match[2].replace(/\s/g, '');
  const buffer = Buffer.from(base64, 'base64');
  if (!buffer.length || buffer.toString('base64').replace(/=+$/, '') !== base64.replace(/=+$/, '')) return { error: 'O arquivo da foto está corrompido ou é inválido.' };
  if (buffer.length > PROFILE_PHOTO_MAX_BYTES) return { error: 'A foto deve ter no máximo 5 MB.' };
  const mimeType = detectedMime(buffer);
  if (mimeType !== declaredMime) return { error: 'O conteúdo da foto não corresponde ao tipo do arquivo.' };
  return { buffer, dataUrl, mimeType, sizeBytes: buffer.length, extension: mimeType === 'image/png' ? '.png' : mimeType === 'image/webp' ? '.webp' : '.jpg' };
}

export function createProfilePhotoStorage({ db, supabaseAdmin, logger = console }) {
  const bucket = process.env.SUPABASE_PROFILE_PHOTO_BUCKET || 'profile-photos';
  const useStorage = Boolean(supabaseAdmin) && process.env.PROFILE_PHOTO_STORAGE_PROVIDER !== 'database';
  let bucketPromise;

  async function ensureBucket() {
    if (!useStorage) return;
    bucketPromise ||= (async () => {
      const { data, error } = await supabaseAdmin.storage.getBucket(bucket);
      if (data && !error) return;
      const { error: createError } = await supabaseAdmin.storage.createBucket(bucket, { public: false, fileSizeLimit: PROFILE_PHOTO_MAX_BYTES, allowedMimeTypes: [...PROFILE_PHOTO_TYPES] });
      if (createError && !/already exists/i.test(createError.message || '')) throw createError;
    })();
    return bucketPromise;
  }

  async function removePath(path) {
    if (!useStorage || !path) return;
    const { error } = await supabaseAdmin.storage.from(bucket).remove([path]);
    if (error) logger.error('profile_photo_storage_cleanup_failed', error, { path });
  }

  async function save(ownerType, ownerId, normalized) {
    const current = await db.prepare('SELECT storage_path FROM profile_photos WHERE owner_type=? AND owner_id=?').get(ownerType, ownerId);
    let storagePath = null;
    if (useStorage) {
      await ensureBucket();
      storagePath = `${ownerType}/${ownerId}/${randomUUID()}${normalized.extension}`;
      const { error } = await supabaseAdmin.storage.from(bucket).upload(storagePath, normalized.buffer, { contentType: normalized.mimeType, upsert: false, cacheControl: '3600' });
      if (error) throw new Error(`Não foi possível armazenar a foto: ${error.message}`);
    }
    try {
      await db.prepare(`INSERT INTO profile_photos (owner_type,owner_id,mime_type,size_bytes,data_url,storage_path,updated_at)
        VALUES (?,?,?,?,?,?,CURRENT_TIMESTAMP)
        ON CONFLICT(owner_type,owner_id) DO UPDATE SET mime_type=excluded.mime_type,size_bytes=excluded.size_bytes,data_url=excluded.data_url,storage_path=excluded.storage_path,updated_at=CURRENT_TIMESTAMP`)
        .run(ownerType, ownerId, normalized.mimeType, normalized.sizeBytes, useStorage ? null : normalized.dataUrl, storagePath);
    } catch (error) {
      await removePath(storagePath);
      throw error;
    }
    if (current?.storage_path && current.storage_path !== storagePath) await removePath(current.storage_path);
    return db.prepare('SELECT updated_at FROM profile_photos WHERE owner_type=? AND owner_id=?').get(ownerType, ownerId);
  }

  async function remove(ownerType, ownerId) {
    const current = await db.prepare('SELECT storage_path FROM profile_photos WHERE owner_type=? AND owner_id=?').get(ownerType, ownerId);
    const result = await db.prepare('DELETE FROM profile_photos WHERE owner_type=? AND owner_id=?').run(ownerType, ownerId);
    await removePath(current?.storage_path);
    return Boolean(result.changes);
  }

  async function load(ownerType, ownerId) {
    const photo = await db.prepare('SELECT mime_type,size_bytes,data_url,storage_path,updated_at FROM profile_photos WHERE owner_type=? AND owner_id=?').get(ownerType, ownerId);
    if (!photo) return null;
    if (!photo.storage_path) return { ...photo, buffer: Buffer.from(String(photo.data_url || '').split(',')[1] || '', 'base64') };
    if (!supabaseAdmin) throw new Error('O armazenamento de fotos não está disponível.');
    const { data, error } = await supabaseAdmin.storage.from(bucket).download(photo.storage_path);
    if (error || !data) throw new Error('Não foi possível carregar a foto.');
    return { ...photo, buffer: Buffer.from(await data.arrayBuffer()) };
  }

  return { save, remove, load };
}
