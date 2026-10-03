import { joinVoiceSegments } from './supportAudio.js';

// Pausing stops the microphone and finalizes the current container. Resuming
// starts a new segment; only valid, complete containers reach the preview.
export default class VoiceRecorder {
  constructor({onChange, onStream, requestStream = () => navigator.mediaDevices.getUserMedia({audio: true}), Recorder = globalThis.MediaRecorder, prepare = joinVoiceSegments, now = () => performance.now(), setTimer = (fn, delay) => setTimeout(fn, delay), clearTimer = timer => clearTimeout(timer), maxMs = 300000}) {
    Object.assign(this, {onChange, onStream, requestStream, Recorder, prepare, now, setTimer, clearTimer, maxMs});
    this.phase = 'idle'; this.generation = 0; this.segments = []; this.activeMs = 0; this.blob = null; this.disposed = false;
  }
  change(phase, error = '') {
    this.phase = phase;
    if (!this.disposed) this.onChange({phase, blob: this.blob, seconds: this.activeMs / 1000, error});
  }
  elapsed() {
    return (this.activeMs + (this.phase === 'recording' ? this.now() - this.started : 0)) / 1000;
  }
  release() {
    this.clearTimer(this.timer);
    this.stream?.getTracks().forEach(track => track.stop());
    this.stream = null;
    this.onStream?.(null);
  }
  async start() {
    if (this.disposed || !['idle', 'paused'].includes(this.phase) || this.activeMs >= this.maxMs) return;
    const generation = ++this.generation;
    this.change('starting');
    let stream;
    try {
      stream = await this.requestStream();
      if (this.disposed || generation !== this.generation) { stream.getTracks().forEach(track => track.stop()); return; }
      this.stream = stream;
      const mime = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg;codecs=opus'].find(type => this.Recorder.isTypeSupported(type));
      if (!mime) throw new Error('Formato de gravação indisponível. Você pode anexar um áudio.');
      const recorder = new this.Recorder(stream, {mimeType: mime, audioBitsPerSecond: 64000});
      this.recorder = recorder;
      const chunks = [];
      let resolveStop;
      this.stopPromise = new Promise(resolve => { resolveStop = resolve; this.resolveStop = resolve; });
      const previousMs = this.activeMs;
      recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      recorder.onerror = () => {
        if (generation !== this.generation) return;
        ++this.generation; this.release();
        if (recorder.state !== 'inactive') recorder.stop();
        this.change(this.blob ? 'paused' : 'idle', 'A gravação falhou. Tente novamente.');
        resolveStop(null);
      };
      recorder.onstop = async () => {
        if (generation !== this.generation || this.disposed) return;
        this.release();
        try {
          const segment = new Blob(chunks, {type: mime.split(';')[0]});
          if (!segment.size) throw new Error('Nenhum áudio foi captado. Tente novamente.');
          const next = [...this.segments, segment];
          const blob = await this.prepare(next);
          if (generation !== this.generation || this.disposed) return;
          if (blob.size > 10 * 1024 * 1024) throw new Error('O áudio ultrapassa o limite de 10 MB.');
          this.segments = next; this.blob = blob; this.change('paused');
          resolveStop(blob);
        } catch (error) {
          if (generation === this.generation && !this.disposed) { this.activeMs = previousMs; this.change(this.blob ? 'paused' : 'idle', error.message); }
          resolveStop(null);
        }
      };
      recorder.start(250); this.started = this.now(); this.change('recording');
      this.onStream?.(stream);
      this.timer = this.setTimer(() => void this.pause(), this.maxMs - this.activeMs);
    } catch (error) {
      if (stream && stream !== this.stream) stream.getTracks().forEach(track => track.stop());
      if (generation !== this.generation || this.disposed) return;
      this.release();
      this.change(this.blob ? 'paused' : 'idle', error.name === 'NotAllowedError' ? 'Permita o microfone no navegador para gravar áudio.' : error.message || 'Não foi possível iniciar o microfone.');
    }
  }
  pause() {
    if (this.phase === 'processing') return this.stopPromise;
    if (this.phase !== 'recording') return Promise.resolve(this.blob);
    this.activeMs = Math.min(this.maxMs, this.activeMs + this.now() - this.started);
    this.change('processing');
    this.recorder.stop();
    this.release();
    return this.stopPromise;
  }
  discard() {
    ++this.generation; this.release();
    if (this.recorder?.state && this.recorder.state !== 'inactive') this.recorder.stop();
    this.resolveStop?.(null);
    this.segments = []; this.blob = null; this.activeMs = 0; this.change('idle');
  }
  dispose() { this.disposed = true; this.discard(); }
}
