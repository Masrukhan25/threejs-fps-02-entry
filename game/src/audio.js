// Procedural audio: every sound is synthesized with WebAudio (oscillators + filtered
// noise), so the game makes no network requests. One AudioContext, created on the first
// user gesture; all calls before that are no-ops.
export function createAudio() {
  let ctx = null;
  let master = null;
  let lastStep = 0;

  function ensure() {
    if (ctx) return true;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = 0.32;
      master.connect(ctx.destination);
      return true;
    } catch {
      return false;
    }
  }

  function noiseBuffer(seconds) {
    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  function burst(dur, freq, gain, type = 'lowpass', when = 0) {
    if (!ensure()) return;
    const t = ctx.currentTime + when;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(dur + 0.05);
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(master);
    src.start(t);
    src.stop(t + dur + 0.05);
  }

  function tone(freq, dur, gain, type = 'sine', slide = 0, when = 0) {
    if (!ensure()) return;
    const t = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g);
    g.connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  return {
    unlock() {
      ensure();
      if (ctx && ctx.state === 'suspended') ctx.resume();
    },
    shot(kind) {
      const loud = kind === 'sniper' || kind === 'shotgun';
      burst(loud ? 0.22 : 0.12, loud ? 900 : 1600, loud ? 0.9 : 0.55);
      tone(loud ? 90 : 140, 0.1, 0.4, 'triangle', -60);
    },
    dryFire() {
      tone(1800, 0.03, 0.12, 'square');
    },
    reload() {
      tone(900, 0.05, 0.15, 'square');
      tone(600, 0.05, 0.15, 'square', 0, 0.28);
      tone(1200, 0.05, 0.15, 'square', 0, 0.55);
    },
    hit() {
      tone(2400, 0.05, 0.18, 'sine');
    },
    kill() {
      tone(1800, 0.07, 0.2, 'sine');
      tone(2600, 0.09, 0.2, 'sine', 0, 0.07);
    },
    hurt() {
      tone(220, 0.18, 0.3, 'sawtooth', -120);
    },
    step() {
      const now = performance.now();
      if (now - lastStep < 300) return;
      lastStep = now;
      burst(0.07, 500, 0.1);
    },
    explosion() {
      burst(0.7, 300, 1.0);
      tone(60, 0.6, 0.7, 'sine', -30);
    },
    beep() {
      tone(1200, 0.09, 0.2, 'sine');
    },
    plant() {
      tone(1000, 0.12, 0.2, 'sine');
      tone(1000, 0.12, 0.2, 'sine', 0, 0.2);
    },
    roundStart() {
      tone(440, 0.12, 0.25, 'triangle');
      tone(660, 0.12, 0.25, 'triangle', 0, 0.14);
      tone(880, 0.2, 0.25, 'triangle', 0, 0.28);
    },
    roundWin() {
      tone(523, 0.14, 0.25, 'triangle');
      tone(659, 0.14, 0.25, 'triangle', 0, 0.14);
      tone(784, 0.3, 0.3, 'triangle', 0, 0.28);
    },
    roundLose() {
      tone(392, 0.16, 0.25, 'triangle');
      tone(330, 0.16, 0.25, 'triangle', 0, 0.16);
      tone(262, 0.34, 0.3, 'triangle', 0, 0.32);
    },
    buy() {
      tone(1500, 0.05, 0.15, 'sine');
      tone(2000, 0.07, 0.15, 'sine', 0, 0.06);
    },
    denied() {
      tone(300, 0.12, 0.2, 'square');
    },
  };
}
