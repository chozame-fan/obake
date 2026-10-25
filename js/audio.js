// 音：すべてその場で合成（音声ファイルなし）
let ctx, master, sfx, music, verb, noiseBuf;
let muted = false;
const live = {}; // 鳴りっぱなしの音（掃除機・環境音）

export function initAudio() {
  if (ctx) { ctx.resume(); return; }
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  master = ctx.createGain(); master.gain.value = muted ? 0 : 0.8;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -16; comp.ratio.value = 4;
  master.connect(comp).connect(ctx.destination);
  // 屋敷の響き（作った残響）
  verb = ctx.createConvolver();
  verb.buffer = impulse(2.6, 2.2);
  const wet = ctx.createGain(); wet.gain.value = 0.32;
  verb.connect(wet).connect(master);
  sfx = ctx.createGain(); sfx.gain.value = 0.9;
  sfx.connect(master); sfx.connect(verb);
  music = ctx.createGain(); music.gain.value = 0.5;
  music.connect(master); music.connect(verb);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  startAmbience();
}
export function setMuted(m) {
  muted = m;
  if (master) master.gain.setTargetAtTime(m ? 0 : 0.8, ctx.currentTime, 0.05);
}
export const isMuted = () => muted;

function impulse(sec, decay) {
  const n = ctx.sampleRate * sec;
  const b = ctx.createBuffer(2, n, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = b.getChannelData(c);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, decay);
  }
  return b;
}
const now = () => ctx.currentTime;
function env(g, t, a, peak, dec, sus = 0) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + a);
  g.gain.exponentialRampToValueAtTime(Math.max(sus, 0.0001), t + a + dec);
}
function osc(type, f, t, dur, peak, dest = sfx, a = 0.005) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t);
  env(g, t, a, peak, dur);
  o.connect(g).connect(dest);
  o.start(t); o.stop(t + a + dur + 0.05);
  return o;
}
function noise(t, dur, peak, type = 'bandpass', f = 1000, q = 1, dest = sfx) {
  const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
  const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(f, t); fl.Q.value = q;
  const g = ctx.createGain();
  env(g, t, 0.005, peak, dur);
  s.connect(fl).connect(g).connect(dest);
  s.start(t, Math.random()); s.stop(t + dur + 0.1);
  return fl;
}
// FMの鐘（きらっ・カギ・ファンファーレ）
function bell(f, t, dur = 1.2, peak = 0.18) {
  const c = ctx.createOscillator(), m = ctx.createOscillator(), mg = ctx.createGain(), g = ctx.createGain();
  c.frequency.value = f; m.frequency.value = f * 3.5; mg.gain.value = f * 1.2;
  mg.gain.setTargetAtTime(0, t, dur * 0.25);
  m.connect(mg).connect(c.frequency);
  env(g, t, 0.003, peak, dur);
  c.connect(g).connect(sfx);
  c.start(t); m.start(t); c.stop(t + dur + 0.1); m.stop(t + dur + 0.1);
}

// ---------- 環境音：低いうなり・風・きしみ ----------
function startAmbience() {
  const g = ctx.createGain(); g.gain.value = 0.0001;
  g.gain.exponentialRampToValueAtTime(0.12, now() + 3);
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 260;
  for (const f of [55, 55.4, 82.4]) {
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f;
    o.connect(lp); o.start();
  }
  const lfo = ctx.createOscillator(), lg = ctx.createGain();
  lfo.frequency.value = 0.07; lg.gain.value = 120;
  lfo.connect(lg).connect(lp.frequency); lfo.start();
  lp.connect(g).connect(music);
  // 風
  const ws = ctx.createBufferSource(); ws.buffer = noiseBuf; ws.loop = true;
  const wf = ctx.createBiquadFilter(); wf.type = 'bandpass'; wf.frequency.value = 500; wf.Q.value = 2;
  const wg = ctx.createGain(); wg.gain.value = 0.05;
  const wl = ctx.createOscillator(), wlg = ctx.createGain(); wl.frequency.value = 0.13; wlg.gain.value = 300;
  wl.connect(wlg).connect(wf.frequency); wl.start();
  ws.connect(wf).connect(wg).connect(music); ws.start();
  live.amb = g;
  // 戦いの時だけ鳴るドキドキ
  const bg = ctx.createGain(); bg.gain.value = 0.0001; bg.connect(music);
  live.battle = bg;
  scheduleLoop();
}
let loopT = 0, step = 0, battleOn = false;
const ARP = [0, 3, 7, 10, 12, 10, 7, 3, 0, 3, 8, 12, 15, 12, 8, 3];
function scheduleLoop() {
  // 1小節ずつ先に予約していく
  const tick = () => {
    if (!ctx) return;
    while (loopT < now() + 0.3) {
      if (loopT < now()) loopT = now() + 0.05;
      const t = loopT;
      if (battleOn) {
        if (step % 4 === 0) { // 心臓の音
          osc('sine', 62, t, 0.18, 0.5, live.battle);
          osc('sine', 55, t + 0.18, 0.2, 0.35, live.battle);
        }
        const root = (step >> 4) % 2 ? 233.1 : 220;
        const f = root * Math.pow(2, ARP[step % 16] / 12);
        osc('triangle', f, t, 0.22, 0.06, live.battle);
      } else if (step % 32 === 0 && Math.random() < 0.6) {
        // 静かな時のオルゴール
        const notes = [659, 622, 587, 554];
        notes.forEach((f, i) => bellQuiet(f * 0.5, t + i * 0.45));
      }
      step++;
      loopT += 0.15;
    }
  };
  setInterval(tick, 60);
}
function bellQuiet(f, t) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = 'sine'; o.frequency.value = f;
  env(g, t, 0.005, 0.035, 1.8);
  o.connect(g).connect(music); o.start(t); o.stop(t + 2);
}
export function setBattle(on) {
  if (!ctx) return;
  battleOn = on;
  live.battle.gain.setTargetAtTime(on ? 1 : 0.0001, now(), on ? 0.3 : 1.2);
}

// ---------- 効果音 ----------
export const S = {
  step(k = 1) {
    if (!ctx) return;
    noise(now(), 0.06, 0.05 * k, 'bandpass', 380 + Math.random() * 120, 3);
  },
  flash() {
    if (!ctx) return;
    const t = now();
    const o = osc('sawtooth', 1800, t, 0.25, 0.08);
    o.frequency.exponentialRampToValueAtTime(5200, t + 0.12);
    noise(t, 0.2, 0.16, 'highpass', 3000, 0.7);
    osc('square', 120, t, 0.05, 0.12);
  },
  click() { if (ctx) osc('square', 900, now(), 0.03, 0.05); },
  appear() {
    if (!ctx) return;
    const t = now();
    const o = ctx.createOscillator(), g = ctx.createGain(), v = ctx.createOscillator(), vg = ctx.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(700, t); o.frequency.exponentialRampToValueAtTime(220, t + 0.9);
    v.frequency.value = 7; vg.gain.value = 25; v.connect(vg).connect(o.frequency);
    env(g, t, 0.08, 0.16, 0.9);
    o.connect(g).connect(sfx); o.start(t); v.start(t); o.stop(t + 1.1); v.stop(t + 1.1);
  },
  giggle(pitch = 1) {
    if (!ctx) return;
    const t = now();
    for (let i = 0; i < 4; i++) {
      const tt = t + i * 0.11;
      const o = osc('square', (900 - i * 60) * pitch, tt, 0.07, 0.05);
      o.frequency.exponentialRampToValueAtTime((600 - i * 40) * pitch, tt + 0.07);
    }
  },
  stun() {
    if (!ctx) return;
    const t = now();
    for (let i = 0; i < 5; i++) osc('sine', 1200 + Math.sin(i * 2) * 300, t + i * 0.06, 0.12, 0.05);
  },
  hurt() {
    if (!ctx) return;
    const t = now();
    const o = osc('square', 520, t, 0.3, 0.12);
    o.frequency.exponentialRampToValueAtTime(180, t + 0.3);
    noise(t, 0.12, 0.2, 'lowpass', 800, 1);
  },
  ghostHit() { if (ctx) { const o = osc('sawtooth', 300, now(), 0.15, 0.06); o.frequency.exponentialRampToValueAtTime(120, now() + 0.15); } },
  capture() {
    if (!ctx) return;
    const t = now();
    const o = osc('sine', 200, t, 0.5, 0.2);
    o.frequency.exponentialRampToValueAtTime(1600, t + 0.45);
    noise(t, 0.4, 0.12, 'bandpass', 2000, 2).frequency.exponentialRampToValueAtTime(6000, t + 0.4);
    [784, 988, 1175, 1568].forEach((f, i) => bell(f, t + 0.45 + i * 0.08, 0.8, 0.12));
  },
  coin() { if (ctx) { const t = now(); bell(1976, t, 0.5, 0.08); bell(2637, t + 0.06, 0.6, 0.07); } },
  bill() { if (ctx) { const t = now(); noise(t, 0.12, 0.12, 'highpass', 4000, 1); bell(1568, t + 0.03, 0.4, 0.06); } },
  gem() { if (ctx) { const t = now(); [1568, 2093, 2637, 3136].forEach((f, i) => bell(f, t + i * 0.05, 0.9, 0.07)); } },
  heart() { if (ctx) { const t = now(); [523, 659, 784].forEach((f, i) => bell(f, t + i * 0.07, 0.6, 0.1)); } },
  key() { if (ctx) { const t = now(); [784, 1047, 1319, 1568, 2093].forEach((f, i) => bell(f, t + i * 0.09, 1.2, 0.12)); } },
  shake() { if (ctx) noise(now(), 0.18, 0.12, 'bandpass', 250 + Math.random() * 150, 2); },
  locked() { if (ctx) { const t = now(); osc('square', 140, t, 0.06, 0.12); osc('square', 120, t + 0.09, 0.08, 0.12); noise(t, 0.1, 0.1, 'bandpass', 1800, 4); } },
  door(close = false) {
    if (!ctx) return;
    const t = now();
    // きしむ音
    const o = ctx.createOscillator(), g = ctx.createGain(), bp = ctx.createBiquadFilter();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(close ? 90 : 70, t);
    for (let i = 1; i < 8; i++) o.frequency.linearRampToValueAtTime((close ? 90 : 70) + Math.random() * 80, t + i * 0.08);
    bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 6;
    env(g, t, 0.05, 0.12, close ? 0.4 : 0.7);
    o.connect(bp).connect(g).connect(sfx); o.start(t); o.stop(t + 0.9);
    if (close) { osc('sine', 70, t + 0.35, 0.3, 0.5); noise(t + 0.35, 0.2, 0.25, 'lowpass', 400, 1); }
  },
  lightsOn() {
    if (!ctx) return;
    const t = now();
    [392, 523, 659, 784, 1047].forEach((f, i) => bell(f, t + i * 0.12, 1.6, 0.13));
    [262, 330, 392].forEach(f => osc('triangle', f, t + 0.6, 1.8, 0.07, sfx, 0.3));
  },
  orb() { if (ctx) { const o = osc('sine', 500, now(), 0.4, 0.08); o.frequency.exponentialRampToValueAtTime(140, now() + 0.4); } },
  bossLaugh() {
    if (!ctx) return;
    const t = now();
    for (let i = 0; i < 5; i++) {
      const tt = t + i * 0.16;
      const o = osc('sawtooth', 180 - i * 8, tt, 0.13, 0.12);
      o.frequency.exponentialRampToValueAtTime(120 - i * 6, tt + 0.13);
    }
  },
  gameover() {
    if (!ctx) return;
    const t = now();
    [392, 370, 349, 330].forEach((f, i) => osc('triangle', f, t + i * 0.35, 0.5, 0.12));
  },
  win() {
    if (!ctx) return;
    const t = now();
    const mel = [523, 659, 784, 1047, 988, 784, 880, 1047];
    mel.forEach((f, i) => bell(f, t + i * 0.16, 1.4, 0.14));
    [262, 392, 523].forEach(f => osc('triangle', f, t + 1.3, 2.5, 0.08, sfx, 0.2));
  },
};

// ---------- 掃除機：吸っている間ずっと鳴る ----------
export function vacuum(on, strain = 0) {
  if (!ctx) return;
  if (!live.vac) {
    const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 800; bp.Q.value = 0.9;
    const g = ctx.createGain(); g.gain.value = 0.0001;
    const m = ctx.createOscillator(); m.type = 'sawtooth'; m.frequency.value = 110;
    const mlp = ctx.createBiquadFilter(); mlp.type = 'lowpass'; mlp.frequency.value = 500;
    const mg = ctx.createGain(); mg.gain.value = 0.25;
    m.connect(mlp).connect(mg).connect(g);
    s.connect(bp).connect(g).connect(sfx);
    s.start(); m.start();
    live.vac = { g, bp, m, level: 0 };
  }
  const v = live.vac;
  const t = now();
  v.g.gain.setTargetAtTime(on ? 0.22 + strain * 0.08 : 0.0001, t, on ? 0.08 : 0.12);
  v.bp.frequency.setTargetAtTime(on ? 1400 + strain * 900 : 500, t, 0.25);
  v.m.frequency.setTargetAtTime(on ? 140 + strain * 40 + Math.sin(t * 30) * strain * 8 : 60, t, 0.2);
}
