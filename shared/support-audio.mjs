export const voiceClock = seconds => {
  const value = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`;
};

// Peaks come from decoded samples, including silence; no decorative waveform.
export function audioPeaks(buffer, count = 48) {
  const peaks = Array(count).fill(0);
  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const samples = buffer.getChannelData(channel);
    for (let bar = 0; bar < count; bar++) {
      const start = Math.floor(bar * samples.length / count);
      const end = Math.max(start + 1, Math.floor((bar + 1) * samples.length / count));
      for (let index = start; index < Math.min(end, samples.length); index++) {
        peaks[bar] = Math.max(peaks[bar], Math.abs(samples[index]));
      }
    }
  }
  const maximum = Math.max(...peaks);
  return maximum ? peaks.map(value => value / maximum) : peaks;
}

// Each paused segment is a complete container. Joining encoded WebM/MP4 bytes
// would produce an invalid recording, so multiple segments become mono PCM WAV.
export function joinVoiceSamples(buffers, sampleRate = 16000) {
  const lengths = buffers.map(buffer => Math.round(buffer.duration * sampleRate));
  const length = lengths.reduce((sum, value) => sum + value, 0);
  if (!length || length > sampleRate * 301) throw new Error('O áudio deve ter até cinco minutos.');
  const bytes = new ArrayBuffer(44 + length * 2);
  const view = new DataView(bytes);
  const write = (offset, value) => Array.from(value).forEach((char, index) => view.setUint8(offset + index, char.charCodeAt(0)));
  write(0, 'RIFF'); view.setUint32(4, 36 + length * 2, true);
  write(8, 'WAVE'); write(12, 'fmt '); view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  write(36, 'data'); view.setUint32(40, length * 2, true);
  let offset = 0;
  buffers.forEach((buffer, segment) => {
    const channels = Array.from({length: buffer.numberOfChannels}, (_, index) => buffer.getChannelData(index));
    for (let index = 0; index < lengths[segment]; index++) {
      const position = index * buffer.sampleRate / sampleRate;
      const left = Math.min(Math.floor(position), buffer.length - 1);
      const right = Math.min(left + 1, buffer.length - 1);
      const fraction = position - left;
      const sample = channels.reduce((sum, channel) => sum + channel[left] * (1 - fraction) + channel[right] * fraction, 0) / channels.length;
      const clipped = Math.max(-1, Math.min(1, sample));
      view.setInt16(44 + (offset + index) * 2, Math.round(clipped * (clipped < 0 ? 32768 : 32767)), true);
    }
    offset += lengths[segment];
  });
  return new Blob([bytes], {type: 'audio/wav'});
}
