import { audioPeaks, joinVoiceSamples } from '../../shared/support-audio.mjs';

const decoded = new WeakMap();
export async function decodeVoice(blob) {
  if (decoded.has(blob)) return decoded.get(blob);
  const Context = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  if (!Context) throw new Error('Este navegador não permite preparar o áudio.');
  const context = new Context(1, 1, 16000);
  const buffer = await context.decodeAudioData(await blob.arrayBuffer());
  decoded.set(blob, buffer);
  return buffer;
}
export async function voiceDetails(blob) {
  const buffer = await decodeVoice(blob);
  return {duration: buffer.duration, peaks: audioPeaks(buffer)};
}
export async function joinVoiceSegments(segments) {
  if (segments.length === 1) return segments[0];
  const buffers = await Promise.all(segments.map(decodeVoice));
  return joinVoiceSamples(buffers);
}
