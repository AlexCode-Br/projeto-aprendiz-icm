import { createHash, randomUUID } from 'node:crypto';
import { extname } from 'node:path';
import { cleanText } from '../shared/validation.mjs';

const sha256 = value => createHash('sha256').update(value).digest('hex');

export const ANNOUNCEMENT_ATTACHMENT_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/heic', 'image/heif', 'application/pdf']);
export const ANNOUNCEMENT_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const ANNOUNCEMENT_PDF_MAX_BYTES = 10 * 1024 * 1024;
export const ANNOUNCEMENT_ATTACHMENT_TOTAL_BYTES = 20 * 1024 * 1024;
export const ANNOUNCEMENT_ATTACHMENT_MAX_COUNT = 5;
const attachmentExtensions = {
  'image/png': new Set(['.png']),
  'image/jpeg': new Set(['.jpg', '.jpeg']),
  'image/webp': new Set(['.webp']),
  'image/heic': new Set(['.heic']),
  'image/heif': new Set(['.heif']),
  'application/pdf': new Set(['.pdf']),
};

function detectedAttachmentMime(buffer) {
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]))) return 'image/png';
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  if (buffer.length >= 12 && buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
  if (buffer.length >= 12 && buffer.subarray(4, 8).toString('ascii') === 'ftyp') {
    const brand = buffer.subarray(8, 12).toString('ascii').toLowerCase();
    if (['heic','heix','hevc','hevx'].includes(brand)) return 'image/heic';
    if (['heif','mif1','msf1'].includes(brand)) return 'image/heif';
  }
  if (buffer.length >= 8 && buffer.subarray(0, 5).toString('ascii') === '%PDF-' && buffer.subarray(Math.max(0, buffer.length - 2048)).includes(Buffer.from('%%EOF'))) return 'application/pdf';
  return '';
}

function safeAttachmentFilename(value, mime) {
  const extension = extname(String(value || '')).toLowerCase();
  if (!attachmentExtensions[mime]?.has(extension)) return '';
  const withoutControls = String(value || '').replace(/[\u0000-\u001f\u007f]/g, '').replace(/[\\/:*?"<>|]/g, '_').trim();
  return cleanText(withoutControls, 180) || `anexo${extension}`;
}

export function normalizeAnnouncementAttachments(value, existingAttachments = new Map()) {
  const source = value == null ? [] : value;
  if (!Array.isArray(source)) return { error: 'Os anexos precisam ser uma lista de arquivos.' };
  if (source.length > ANNOUNCEMENT_ATTACHMENT_MAX_COUNT) return { error: `Adicione no máximo ${ANNOUNCEMENT_ATTACHMENT_MAX_COUNT} arquivos por informativo.` };
  const items = [];
  const fingerprints = new Set();
  const retainedIds = new Set();
  let totalBytes = 0;
  for (const item of source) {
    const mime = String(item?.tipo || '').trim().toLowerCase();
    const dataUrl = String(item?.dataUrl || '').trim();
    if (!dataUrl && item?.id != null) {
      const existing = existingAttachments.get(Number(item.id));
      if (existing) {
        if (retainedIds.has(Number(existing.id))) return { error: 'O mesmo anexo foi informado mais de uma vez.' };
        retainedIds.add(Number(existing.id));
        totalBytes += Number(existing.size_bytes);
        items.push({ ...existing, id: Number(existing.id), existing: true });
        continue;
      }
      return { error: 'Um dos anexos não pertence a este informativo.' };
    }
    const match = dataUrl.match(/^data:([a-z0-9.+/-]+);base64,([a-z0-9+/=\s]+)$/i);
    if (!ANNOUNCEMENT_ATTACHMENT_TYPES.has(mime) || !match || match[1].toLowerCase() !== mime) {
      return { error: 'Cada anexo precisa ser uma imagem PNG, JPG/JPEG, WEBP, HEIC/HEIF ou um PDF válido.' };
    }
    const base64 = match[2].replace(/\s/g, '');
    const buffer = Buffer.from(base64, 'base64');
    if (buffer.toString('base64').replace(/=+$/,'') !== base64.replace(/=+$/,'')) return { error: 'Um dos anexos possui conteúdo Base64 inválido.' };
    const detectedMime = detectedAttachmentMime(buffer);
    if (detectedMime !== mime) return { error: 'O conteúdo de um dos arquivos não corresponde ao tipo informado.' };
    const maxBytes = mime === 'application/pdf' ? ANNOUNCEMENT_PDF_MAX_BYTES : ANNOUNCEMENT_IMAGE_MAX_BYTES;
    if (!buffer.length || buffer.length > maxBytes) return { error: mime === 'application/pdf' ? 'Cada PDF deve ter no máximo 10 MB.' : 'Cada imagem deve ter no máximo 5 MB.' };
    const filename = safeAttachmentFilename(item?.nome, mime);
    if (!filename) return { error: 'A extensão de um dos arquivos não corresponde ao seu conteúdo.' };
    const fingerprint = sha256(buffer);
    if (fingerprints.has(fingerprint)) return { error: 'O mesmo arquivo foi selecionado mais de uma vez.' };
    fingerprints.add(fingerprint);
    totalBytes += buffer.length;
    items.push({ filename, mime_type: mime, size_bytes: buffer.length, data_url: dataUrl, buffer, fingerprint, existing: false });
  }
  if (totalBytes > ANNOUNCEMENT_ATTACHMENT_TOTAL_BYTES) return { error: 'O total dos anexos deve ter no máximo 20 MB.' };
  return { items, existingItems: items.filter(item => item.existing), newItems: items.filter(item => !item.existing) };
}

export function createAnnouncementStorage({ db, supabaseAdmin }) {
  const announcementStorageBucket = process.env.SUPABASE_ANNOUNCEMENT_BUCKET || 'announcement-attachments';
  const useSupabaseAttachmentStorage = Boolean(supabaseAdmin) && process.env.ANNOUNCEMENT_STORAGE_PROVIDER !== 'database';
  let announcementBucketPromise;

  async function ensureAnnouncementBucket() {
    if (!useSupabaseAttachmentStorage) return;
    announcementBucketPromise ||= (async () => {
      const { data, error } = await supabaseAdmin.storage.getBucket(announcementStorageBucket);
      if (data && !error) return;
      const { error: createError } = await supabaseAdmin.storage.createBucket(announcementStorageBucket, {
        public: false,
        fileSizeLimit: ANNOUNCEMENT_PDF_MAX_BYTES,
        allowedMimeTypes: [...ANNOUNCEMENT_ATTACHMENT_TYPES],
      });
      if (createError && !/already exists/i.test(createError.message || '')) throw createError;
    })();
    return announcementBucketPromise;
  }
  
  async function storeAnnouncementAttachment(announcementId, item) {
    if (!useSupabaseAttachmentStorage) return { data_url: item.data_url, storage_path: null };
    await ensureAnnouncementBucket();
    const extension = extname(item.filename).toLowerCase();
    const storagePath = `informativos/${announcementId}/${randomUUID()}${extension}`;
    const { error } = await supabaseAdmin.storage.from(announcementStorageBucket).upload(storagePath, item.buffer, {
      contentType: item.mime_type,
      upsert: false,
      cacheControl: '3600',
    });
    if (error) throw new Error(`Falha ao armazenar ${item.filename}: ${error.message}`);
    return { data_url: null, storage_path: storagePath };
  }
  
  async function removeStoredAttachments(paths) {
    const uniquePaths = [...new Set(paths.filter(Boolean))];
    if (!useSupabaseAttachmentStorage || !uniquePaths.length) return;
    const { error } = await supabaseAdmin.storage.from(announcementStorageBucket).remove(uniquePaths);
    if (error) throw new Error(`Falha ao remover anexos do storage: ${error.message}`);
  }
  
  async function prepareStoredAttachments(announcementId, items) {
    const stored = [];
    try {
      for (const item of items) {
        const location = await storeAnnouncementAttachment(announcementId, item);
        stored.push({ ...item, ...location });
      }
      return stored;
    } catch (error) {
      await removeStoredAttachments(stored.map(item => item.storage_path)).catch(cleanupError => console.error(cleanupError));
      throw error;
    }
  }
  
  async function insertAnnouncementAttachments(announcementId, items) {
    for (const item of items) {
      await db.prepare('INSERT INTO announcement_attachments (announcement_id,filename,mime_type,size_bytes,data_url,storage_path) VALUES (?,?,?,?,?,?)')
        .run(announcementId,item.filename,item.mime_type,item.size_bytes,item.data_url || null,item.storage_path || null);
    }
  }
  

  return {
    announcementStorageBucket,
    useSupabaseAttachmentStorage,
    prepareStoredAttachments,
    insertAnnouncementAttachments,
    removeStoredAttachments,
  };
}

