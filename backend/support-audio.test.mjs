import test from 'node:test';
import assert from 'node:assert/strict';
import { audioPeaks, joinVoiceSamples, voiceClock } from '../shared/support-audio.mjs';
import VoiceRecorder from '../src/utils/voiceRecorder.js';
import { normalizeSupportAttachments } from './support-media.mjs';

const buffer = (channels, sampleRate=4) => ({
  numberOfChannels: channels.length, sampleRate, length: channels[0].length,
  duration: channels[0].length/sampleRate, getChannelData: index => Float32Array.from(channels[index]),
});
function harness(overrides={}) {
  let now=0;
  const states=[], tracks=[], timers=[], prepared=[];
  class Recorder {
    static isTypeSupported(type) { return type.startsWith('audio/webm'); }
    constructor() { this.state='inactive'; }
    start() { this.state='recording'; }
    stop() { assert.equal(this.state,'recording'); this.state='inactive'; queueMicrotask(()=>{this.ondataavailable({data:new Blob(['segment'],{type:'audio/webm'})});void this.onstop();}); }
  }
  const engine=new VoiceRecorder({
    onChange: state=>states.push(state), Recorder,
    requestStream: async()=>{const track={stopped:false,stop(){this.stopped=true;}};tracks.push(track);return {getTracks:()=>[track]};},
    now:()=>now, setTimer:(fn,delay)=>{const timer={fn,delay,cancelled:false};timers.push(timer);return timer;},clearTimer:timer=>{if(timer)timer.cancelled=true;},
    prepare:async segments=>{prepared.push(segments);return new Blob(['voice'],{type:'audio/wav'});},
    ...overrides,
  });
  return {engine,states,tracks,timers,prepared,advance:ms=>{now+=ms;}};
}

test('waveform preserves silence and uses peaks from every channel',()=>{
  assert.deepEqual(audioPeaks(buffer([[0,0,0,0]]),4),[0,0,0,0]);
  assert.deepEqual(audioPeaks(buffer([[0,.25,0,0],[0,0,-.5,0]]),4),[0,.5,1,0]);
  assert.equal(voiceClock(Infinity),'0:00');
  assert.equal(voiceClock(65.7),'1:05');
});
test('resumed segments produce one valid WAV in order without adding paused time',async()=>{
  const voice=joinVoiceSamples([buffer([[1,.5]]),buffer([[-1,-.5],[1,-.5]])],4);
  const bytes=Buffer.from(await voice.arrayBuffer()),view=new DataView(bytes.buffer,bytes.byteOffset,bytes.length);
  assert.equal(bytes.toString('ascii',0,4),'RIFF');
  assert.equal(bytes.toString('ascii',8,12),'WAVE');
  assert.equal(view.getUint32(40,true),8);
  assert.deepEqual([0,1,2,3].map(index=>view.getInt16(44+index*2,true)),[32767,16384,0,-16384]);
  assert.equal(normalizeSupportAttachments([{nome:'voz.wav',tipo:'audio/wav',dataUrl:`data:audio/wav;base64,${bytes.toString('base64')}`,audio_gravado:true}]).items.length,1);
  assert.throws(()=>joinVoiceSamples([]),/cinco minutos/);
});
test('pausing releases the microphone, resumes into a new segment and excludes pause time',async()=>{
  const {engine,tracks,prepared,advance}=harness();
  await engine.start();advance(1100);
  const first=await engine.pause();
  assert.equal(engine.phase,'paused');assert.equal(first.type,'audio/wav');assert.equal(tracks[0].stopped,true);
  advance(50000);assert.equal(engine.elapsed(),1.1);
  await engine.start();advance(900);await engine.pause();
  assert.equal(tracks.length,2);assert.ok(tracks.every(track=>track.stopped));
  assert.equal(engine.elapsed(),2);assert.deepEqual(prepared.map(items=>items.length),[1,2]);
});
test('five-minute limit is cumulative across resumed recordings',async()=>{
  const {engine,timers,advance}=harness({maxMs:3000});
  await engine.start();assert.equal(timers[0].delay,3000);
  advance(1000);await engine.pause();await engine.start();
  assert.equal(timers[1].delay,2000);
  advance(2000);timers[1].fn();await engine.stopPromise;
  assert.equal(engine.phase,'paused');assert.equal(engine.elapsed(),3);
  await engine.start();assert.equal(timers.length,2);
});
test('discard during pending microphone permission stops a late stream without recording',async()=>{
  let resolve;
  const track={stopped:false,stop(){this.stopped=true;}};
  const {engine,states}=harness({requestStream:()=>new Promise(done=>{resolve=done;})});
  const pending=engine.start();engine.discard();
  resolve({getTracks:()=>[track]});await pending;
  assert.equal(track.stopped,true);assert.equal(engine.phase,'idle');assert.equal(engine.blob,null);
  assert.ok(!states.some(state=>state.phase==='recording'));
});
test('discard during preparation cannot restore or send a stale recording',async()=>{
  let resolve;
  const {engine,advance}=harness({prepare:()=>new Promise(done=>{resolve=done;})});
  await engine.start();advance(100);const pending=engine.pause();
  await new Promise(done=>setImmediate(done));engine.discard();
  resolve(new Blob(['voice']));assert.equal(await pending,null);
  await new Promise(done=>setImmediate(done));
  assert.equal(engine.phase,'idle');assert.equal(engine.blob,null);assert.equal(engine.segments.length,0);
});
test('failed continuation retains the previous preview and disposal releases active tracks',async()=>{
  let count=0;
  const {engine,tracks,advance,states}=harness({prepare:async()=>{if(++count===2)throw new Error('falha de preparação');return new Blob(['first']);}});
  await engine.start();advance(1000);const original=await engine.pause();
  await engine.start();advance(500);assert.equal(await engine.pause(),null);
  assert.equal(engine.blob,original);assert.equal(engine.elapsed(),1);assert.match(states.at(-1).error,/preparação/);
  await engine.start();engine.dispose();assert.ok(tracks.every(track=>track.stopped));
});
