export const SUPPORT_FILE_MAX_COUNT = 5;
export const SUPPORT_FILE_TOTAL_BYTES = 20 * 1024 * 1024;
export const SUPPORT_FILE_TYPES = {
  'image/png':['.png'], 'image/jpeg':['.jpg','.jpeg'], 'image/webp':['.webp'],
  'video/mp4':['.mp4'], 'video/webm':['.webm'],
  'audio/webm':['.webm'], 'audio/ogg':['.ogg','.opus'], 'audio/mp4':['.m4a','.mp4'],
  'audio/mpeg':['.mp3'], 'audio/wav':['.wav'],
  'application/pdf':['.pdf'], 'text/plain':['.txt'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document':['.docx'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':['.xlsx'],
  'application/vnd.openxmlformats-officedocument.presentationml.presentation':['.pptx'],
};
export const supportFileLimit = type => type.startsWith('image/')?5*1024*1024:type.startsWith('video/')?SUPPORT_FILE_TOTAL_BYTES:10*1024*1024;
export const supportFileType = (name,type) => {
  const normalized=String(type||'').split(';')[0].toLowerCase().replace('audio/x-wav','audio/wav');
  const extension=String(name||'').toLowerCase().match(/\.[^.]+$/)?.[0];
  if(SUPPORT_FILE_TYPES[normalized]?.includes(extension))return normalized;
  if(!normalized||normalized==='application/octet-stream')return Object.entries(SUPPORT_FILE_TYPES).find(([,extensions])=>extensions.includes(extension))?.[0]||'';
  return '';
};
export const supportFileSize = bytes => bytes<1024*1024?`${Math.max(1,Math.round(bytes/1024))} KB`:`${(bytes/(1024*1024)).toFixed(1)} MB`;
