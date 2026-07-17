// Notification sound utility — supports custom uploaded sounds from DB + fallback synthesis

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return audioCtx;
}

// Cache loaded audio buffers
const audioBuffers: Record<string, AudioBuffer | null> = {};

async function loadAudioBuffer(url: string): Promise<AudioBuffer | null> {
  if (audioBuffers[url] !== undefined) return audioBuffers[url];
  try {
    const ctx = getAudioContext();
    const res = await fetch(url);
    const arrayBuffer = await res.arrayBuffer();
    const buffer = await ctx.decodeAudioData(arrayBuffer);
    audioBuffers[url] = buffer;
    return buffer;
  } catch {
    audioBuffers[url] = null;
    return null;
  }
}

async function playCustomSound(url: string, volume = 0.7) {
  try {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') await ctx.resume();
    const buffer = await loadAudioBuffer(url);
    if (!buffer) return false;
    const source = ctx.createBufferSource();
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    source.buffer = buffer;
    source.connect(gain);
    gain.connect(ctx.destination);
    source.start(0);
    return true;
  } catch {
    return false;
  }
}

// Sound URLs cached from DB
let cachedSounds: { notification?: string; messenger?: string; viproom?: string; signal?: string } = {};
let soundsLoaded = false;

export async function loadSoundSettings() {
  try {
    const { supabase } = await import('@/lib/supabase');
    const { data } = await supabase.rpc('get_sound_settings');
    if (data) {
      cachedSounds = {
        notification: (data as any).sound_notification || undefined,
        messenger: (data as any).sound_messenger || undefined,
        viproom: (data as any).sound_viproom || undefined,
        signal: (data as any).sound_signal || undefined,
      };
    }
    soundsLoaded = true;
  } catch {}
}

// Synthesized iPhone-style tri-tone
function playSynthNotification() {
  try {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') ctx.resume();
    const tones = [
      { freq: 1046.5, start: 0, dur: 0.12 },
      { freq: 1318.5, start: 0.1, dur: 0.12 },
      { freq: 1567.98, start: 0.2, dur: 0.18 },
    ];
    tones.forEach(({ freq, start, dur }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
      gain.gain.setValueAtTime(0, ctx.currentTime + start);
      gain.gain.linearRampToValueAtTime(0.18, ctx.currentTime + start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + dur);
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + dur + 0.05);
    });
  } catch {}
}

// Synthesized single ping
function playSynthMessage() {
  try {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') ctx.resume();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1200, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.25);
  } catch {}
}

// Synthesized signal alert — aggressive ascending trading alert
function playSynthSignal() {
  try {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') ctx.resume();
    const tones = [
      { freq: 587.33, start: 0.0, dur: 0.12 },
      { freq: 739.99, start: 0.12, dur: 0.12 },
      { freq: 880.00, start: 0.24, dur: 0.22 },
      { freq: 1174.66, start: 0.24, dur: 0.18 },
    ];
    tones.forEach(({ freq, start, dur }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
      gain.gain.setValueAtTime(0, ctx.currentTime + start);
      gain.gain.linearRampToValueAtTime(0.22, ctx.currentTime + start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + dur);
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + dur + 0.05);
    });
  } catch {}
}

export async function playNotificationSound() {
  if (!soundsLoaded) await loadSoundSettings();
  if (cachedSounds.notification) {
    const played = await playCustomSound(cachedSounds.notification);
    if (played) return;
  }
  playSynthNotification();
}

export async function playMessageSound() {
  if (!soundsLoaded) await loadSoundSettings();
  if (cachedSounds.messenger) {
    const played = await playCustomSound(cachedSounds.messenger);
    if (played) return;
  }
  playSynthMessage();
}

export async function playVIPRoomSound() {
  if (!soundsLoaded) await loadSoundSettings();
  if (cachedSounds.viproom) {
    const played = await playCustomSound(cachedSounds.viproom);
    if (played) return;
  }
  try {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') ctx.resume();
    const tones = [
      { freq: 880, start: 0, dur: 0.1 },
      { freq: 1100, start: 0.08, dur: 0.15 },
    ];
    tones.forEach(({ freq, start, dur }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
      gain.gain.setValueAtTime(0.15, ctx.currentTime + start);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + dur);
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + dur + 0.05);
    });
  } catch {}
}

export async function playSignalSound() {
  if (!soundsLoaded) await loadSoundSettings();
  if (cachedSounds.signal) {
    const played = await playCustomSound(cachedSounds.signal);
    if (played) return;
  }
  playSynthSignal();
}

// Invalidate sound cache (call after admin changes sounds)
export function invalidateSoundCache() {
  soundsLoaded = false;
  Object.keys(audioBuffers).forEach(k => delete audioBuffers[k]);
}
