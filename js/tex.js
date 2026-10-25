// 絵の具：床・壁紙・本・絵などをすべてコードで描く（画像ファイルなし）
import * as THREE from 'three';

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}
function toTex(c, rx = 1, ry = 1) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rx, ry);
  t.anisotropy = 8;
  return t;
}
// 決まった並びの乱数（毎回同じ模様になる）
function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}
function shade(hex, k) {
  const c = new THREE.Color(hex);
  c.multiplyScalar(k);
  return '#' + c.getHexString();
}

// 木の床（板が並ぶ）。1枚が2m四方
export function woodFloor(base = '#6b4129', seed = 3) {
  const [c, g] = canvas(512, 512);
  const r = rng(seed);
  const rows = 8, ph = 512 / rows;
  for (let i = 0; i < rows; i++) {
    let x = -r() * 200;
    while (x < 512) {
      const len = 160 + r() * 200;
      g.fillStyle = shade(base, 0.8 + r() * 0.4);
      g.fillRect(x, i * ph, len, ph);
      // 木目
      g.globalAlpha = 0.18;
      for (let k = 0; k < 6; k++) {
        g.strokeStyle = r() < 0.5 ? '#000' : '#fff';
        g.lineWidth = 1 + r();
        g.beginPath();
        const y = i * ph + r() * ph;
        g.moveTo(x, y);
        g.bezierCurveTo(x + len * 0.3, y + (r() - 0.5) * 8, x + len * 0.6, y + (r() - 0.5) * 8, x + len, y + (r() - 0.5) * 4);
        g.stroke();
      }
      g.globalAlpha = 1;
      g.fillStyle = 'rgba(0,0,0,0.55)';
      g.fillRect(x, i * ph, 2, ph);
      x += len;
    }
    g.fillStyle = 'rgba(0,0,0,0.6)';
    g.fillRect(0, i * ph, 512, 2);
  }
  return toTex(c);
}

// 市松もよう（台所・肖像画の間）
export function checkerFloor(a = '#d9d2c3', b = '#3a3a44', n = 4, seed = 5) {
  const [c, g] = canvas(512, 512);
  const r = rng(seed);
  const s = 512 / n;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    g.fillStyle = shade((i + j) % 2 ? a : b, 0.9 + r() * 0.15);
    g.fillRect(i * s, j * s, s, s);
    // 大理石のすじ
    g.globalAlpha = 0.12;
    g.strokeStyle = (i + j) % 2 ? '#555' : '#aaa';
    for (let k = 0; k < 3; k++) {
      g.beginPath();
      g.moveTo(i * s + r() * s, j * s);
      g.quadraticCurveTo(i * s + r() * s, j * s + s / 2, i * s + r() * s, j * s + s);
      g.stroke();
    }
    g.globalAlpha = 1;
    g.strokeStyle = 'rgba(0,0,0,0.35)';
    g.lineWidth = 2;
    g.strokeRect(i * s, j * s, s, s);
  }
  return toTex(c);
}

// じゅうたん（ふち模様つき）。1枚をそのまま貼る
export function rug(base = '#7a1d24', border = '#c9a34a', inner = '#4a0f16') {
  const [c, g] = canvas(512, 512);
  g.fillStyle = base; g.fillRect(0, 0, 512, 512);
  g.strokeStyle = border; g.lineWidth = 14; g.strokeRect(26, 26, 460, 460);
  g.lineWidth = 4; g.strokeRect(52, 52, 408, 408);
  g.fillStyle = inner; g.fillRect(70, 70, 372, 372);
  g.fillStyle = border;
  // 真ん中のメダリオン
  g.save(); g.translate(256, 256);
  for (let k = 0; k < 8; k++) {
    g.rotate(Math.PI / 4);
    g.beginPath(); g.ellipse(0, -70, 22, 60, 0, 0, Math.PI * 2); g.fill();
  }
  g.fillStyle = base; g.beginPath(); g.arc(0, 0, 44, 0, Math.PI * 2); g.fill();
  g.fillStyle = border; g.beginPath(); g.arc(0, 0, 18, 0, Math.PI * 2); g.fill();
  g.restore();
  // ふちの小さな模様
  for (let i = 0; i < 16; i++) {
    const t = 40 + i * 28.8;
    for (const [x, y] of [[t, 39], [t, 473], [39, t], [473, t]]) {
      g.beginPath(); g.arc(x, y, 4, 0, Math.PI * 2); g.fill();
    }
  }
  // 毛の質感
  const r = rng(9);
  g.globalAlpha = 0.08;
  for (let i = 0; i < 4000; i++) {
    g.fillStyle = r() < 0.5 ? '#000' : '#fff';
    g.fillRect(r() * 512, r() * 512, 2, 2);
  }
  g.globalAlpha = 1;
  const t = toTex(c);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

// 壁紙。下30%は木の腰板、上はダマスク柄。高さ3.2mにそのまま合わせる
export function wallpaper(base = '#5a1820', pat = '#8a3a3a', wood = '#3b2416', style = 'damask') {
  const [c, g] = canvas(256, 512);
  const panelH = 512 * 0.3;
  g.fillStyle = base; g.fillRect(0, 0, 256, 512 - panelH);
  g.fillStyle = pat; g.strokeStyle = pat;
  if (style === 'damask') {
    for (let y = 30; y < 512 - panelH; y += 90) for (let x = 0; x <= 256; x += 128) {
      const ox = ((y / 90) | 0) % 2 ? 64 : 0;
      drawDamask(g, x + ox, y);
    }
  } else if (style === 'stripe') {
    for (let x = 0; x < 256; x += 64) {
      g.globalAlpha = 0.8; g.fillRect(x, 0, 22, 512 - panelH);
      g.globalAlpha = 0.4; g.fillRect(x + 30, 0, 4, 512 - panelH);
    }
    g.globalAlpha = 1;
  } else if (style === 'flower') {
    for (let y = 30; y < 512 - panelH; y += 70) for (let x = 0; x <= 256; x += 64) {
      const ox = ((y / 70) | 0) % 2 ? 32 : 0;
      for (let k = 0; k < 5; k++) {
        const a = k / 5 * Math.PI * 2;
        g.beginPath(); g.arc(x + ox + Math.cos(a) * 8, y + Math.sin(a) * 8, 6, 0, Math.PI * 2); g.fill();
      }
    }
  } else if (style === 'tile') {
    g.strokeStyle = 'rgba(0,0,0,0.25)';
    g.lineWidth = 2;
    for (let y = 0; y < 512 - panelH; y += 32) { g.beginPath(); g.moveTo(0, y); g.lineTo(256, y); g.stroke(); }
    for (let y = 0; y < 512 - panelH; y += 32) for (let x = ((y / 32) % 2) * 16; x < 256; x += 32) {
      g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 32); g.stroke();
    }
  }
  // 上のふち飾り
  g.fillStyle = shade(wood, 1.2); g.fillRect(0, 0, 256, 10);
  // 腰板
  const y0 = 512 - panelH;
  g.fillStyle = wood; g.fillRect(0, y0, 256, panelH);
  g.fillStyle = shade(wood, 1.35); g.fillRect(0, y0, 256, 10);
  g.fillStyle = shade(wood, 0.6); g.fillRect(0, y0 + 10, 256, 4);
  for (let x = 8; x < 256; x += 128) {
    g.strokeStyle = shade(wood, 0.6); g.lineWidth = 4;
    g.strokeRect(x + 6, y0 + 28, 108, panelH - 60);
    g.strokeStyle = shade(wood, 1.3); g.lineWidth = 2;
    g.strokeRect(x + 10, y0 + 32, 100, panelH - 68);
  }
  g.fillStyle = shade(wood, 0.45); g.fillRect(0, 512 - 20, 256, 20);
  // 古びたしみ
  const r = rng(base.length * 31 + pat.length);
  for (let i = 0; i < 18; i++) {
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, 40);
    gr.addColorStop(0, 'rgba(0,0,0,0.18)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.save(); g.translate(r() * 256, r() * (512 - panelH)); g.fillStyle = gr; g.fillRect(-40, -40, 80, 80); g.restore();
  }
  const t = toTex(c);
  t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}
function drawDamask(g, x, y) {
  g.save(); g.translate(x, y);
  g.beginPath(); g.ellipse(0, 0, 10, 26, 0, 0, Math.PI * 2); g.fill();
  for (const s of [-1, 1]) {
    g.beginPath();
    g.moveTo(0, 14);
    g.bezierCurveTo(s * 34, 6, s * 34, -30, s * 12, -26);
    g.bezierCurveTo(s * 26, -20, s * 22, 0, s * 4, 4);
    g.fill();
    g.beginPath(); g.arc(s * 26, 22, 5, 0, Math.PI * 2); g.fill();
  }
  g.beginPath(); g.moveTo(-6, -26); g.lineTo(0, -40); g.lineTo(6, -26); g.fill();
  g.restore();
}

// 本棚の本の背表紙
export function books(seed = 7) {
  const [c, g] = canvas(256, 256);
  const r = rng(seed);
  g.fillStyle = '#20140c'; g.fillRect(0, 0, 256, 256);
  const cols = ['#7a2020', '#204a2a', '#1e2e5a', '#6a5020', '#4a2050', '#8a6a3a', '#2a2a2a', '#5a3018'];
  for (let row = 0; row < 4; row++) {
    let x = 4;
    const by = row * 64;
    while (x < 250) {
      const w = 8 + r() * 14, h = 40 + r() * 20;
      const col = cols[(r() * cols.length) | 0];
      g.fillStyle = col; g.fillRect(x, by + 62 - h, w, h);
      g.fillStyle = 'rgba(255,220,140,0.55)';
      g.fillRect(x + 1, by + 62 - h + 6, w - 2, 2);
      g.fillRect(x + 1, by + 62 - 10, w - 2, 2);
      g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(x + w - 2, by + 62 - h, 2, h);
      x += w + 1 + (r() < 0.1 ? 10 : 0);
    }
    g.fillStyle = '#4a2e1a'; g.fillRect(0, by + 60, 256, 4);
  }
  return toTex(c);
}

// 窓の外（月夜と木）
export function nightWindow() {
  const [c, g] = canvas(256, 384);
  const gr = g.createLinearGradient(0, 0, 0, 384);
  gr.addColorStop(0, '#1b2a5a'); gr.addColorStop(1, '#0a1230');
  g.fillStyle = gr; g.fillRect(0, 0, 256, 384);
  const r = rng(11);
  g.fillStyle = '#fff';
  for (let i = 0; i < 40; i++) { g.globalAlpha = r(); g.fillRect(r() * 256, r() * 250, 2, 2); }
  g.globalAlpha = 1;
  const mg = g.createRadialGradient(170, 90, 10, 170, 90, 90);
  mg.addColorStop(0, '#fff8d8'); mg.addColorStop(0.35, '#ffe9a0'); mg.addColorStop(0.4, 'rgba(255,230,160,0.4)'); mg.addColorStop(1, 'rgba(255,230,160,0)');
  g.fillStyle = mg; g.fillRect(0, 0, 256, 256);
  // 枯れ木
  g.strokeStyle = '#05060c'; g.lineCap = 'round';
  const branch = (x, y, a, len, w) => {
    if (len < 6) return;
    const x2 = x + Math.cos(a) * len, y2 = y + Math.sin(a) * len;
    g.lineWidth = w; g.beginPath(); g.moveTo(x, y); g.lineTo(x2, y2); g.stroke();
    branch(x2, y2, a - 0.4 - r() * 0.3, len * 0.7, w * 0.65);
    branch(x2, y2, a + 0.3 + r() * 0.3, len * 0.66, w * 0.65);
  };
  branch(60, 384, -Math.PI / 2 - 0.1, 110, 14);
  g.fillStyle = '#05060c'; g.fillRect(0, 350, 256, 34);
  // 窓わく
  g.fillStyle = '#2a1a10';
  g.fillRect(0, 0, 256, 12); g.fillRect(0, 372, 256, 12); g.fillRect(0, 0, 12, 384); g.fillRect(244, 0, 12, 384);
  g.fillRect(122, 0, 12, 384); g.fillRect(0, 186, 256, 10);
  const t = toTex(c);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

// 肖像画（架空の人物）
export function portrait(kind = 0) {
  const [c, g] = canvas(256, 320);
  const r = rng(kind * 17 + 3);
  const bgs = ['#2a1f14', '#1a2420', '#24182a', '#2a1818', '#141c2a'];
  const gr = g.createRadialGradient(128, 130, 20, 128, 160, 200);
  gr.addColorStop(0, shade(bgs[kind % 5], 2.2)); gr.addColorStop(1, bgs[kind % 5]);
  g.fillStyle = gr; g.fillRect(0, 0, 256, 320);
  if (kind === 99) {
    // 主のいなくなった額（中は空っぽの闇）
    const vg = g.createRadialGradient(128, 160, 10, 128, 160, 160);
    vg.addColorStop(0, '#000'); vg.addColorStop(1, '#2a1640');
    g.fillStyle = vg; g.fillRect(0, 0, 256, 320);
  } else if (kind === 98) {
    // 館の主（紫のおばけの肖像）
    g.fillStyle = '#9a6ad8';
    g.beginPath(); g.ellipse(128, 160, 80, 95, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#e8c84a';
    g.beginPath(); g.moveTo(70, 80); g.lineTo(90, 40); g.lineTo(110, 72); g.lineTo(128, 30); g.lineTo(146, 72); g.lineTo(166, 40); g.lineTo(186, 80); g.closePath(); g.fill();
    g.fillStyle = '#1a0a2a';
    g.beginPath(); g.ellipse(100, 150, 12, 18, 0, 0, Math.PI * 2); g.ellipse(156, 150, 12, 18, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.moveTo(90, 195); g.quadraticCurveTo(128, 235, 166, 195); g.quadraticCurveTo(128, 210, 90, 195); g.fill();
    g.strokeStyle = '#e8c84a'; g.lineWidth = 3;
    g.beginPath(); g.arc(156, 150, 20, 0, Math.PI * 2); g.stroke();
  } else {
    const skin = ['#d8b090', '#c89878', '#e0c0a0'][kind % 3];
    const coat = ['#3a1a1a', '#1a2a3a', '#2a3a1a', '#3a2a10', '#301a3a'][kind % 5];
    g.fillStyle = coat;
    g.beginPath(); g.ellipse(128, 330, 110, 110, 0, Math.PI, 0); g.fill();
    g.fillStyle = '#eee'; g.beginPath(); g.moveTo(108, 222); g.lineTo(128, 270); g.lineTo(148, 222); g.fill();
    g.fillStyle = skin; g.beginPath(); g.ellipse(128, 150, 48, 60, 0, 0, Math.PI * 2); g.fill();
    const hair = ['#2a1a10', '#8a8a8a', '#5a3018', '#c8b070'][kind % 4];
    g.fillStyle = hair;
    if (kind % 2) { g.beginPath(); g.ellipse(128, 110, 54, 34, 0, Math.PI, 0); g.fill(); }
    else { g.beginPath(); g.ellipse(128, 150, 62, 80, 0, Math.PI * 1.05, Math.PI * 1.95); g.fill(); g.fillRect(70, 140, 16, 70); g.fillRect(170, 140, 16, 70); }
    g.fillStyle = '#1a1010';
    // 目が少しこっちを見ている（不気味）
    const lk = (r() - 0.5) * 6;
    g.beginPath(); g.arc(110 + lk, 148, 5, 0, Math.PI * 2); g.arc(146 + lk, 148, 5, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#6a3a2a'; g.lineWidth = 3;
    g.beginPath(); g.moveTo(114, 185); g.quadraticCurveTo(128, 190 + (kind % 3 - 1) * 4, 142, 185); g.stroke();
    if (kind % 3 === 0) { g.fillStyle = hair; g.beginPath(); g.moveTo(104, 172); g.quadraticCurveTo(128, 166, 152, 172); g.quadraticCurveTo(128, 180, 104, 172); g.fill(); }
  }
  // ひび割れたニス
  g.globalAlpha = 0.25; g.strokeStyle = '#000'; g.lineWidth = 1;
  for (let i = 0; i < 30; i++) { g.beginPath(); const x = r() * 256, y = r() * 320; g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 30, y + (r() - 0.5) * 30); g.stroke(); }
  g.globalAlpha = 1;
  const t = toTex(c);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

// とびらの板
export function doorTex(base = '#4a2a18') {
  const [c, g] = canvas(128, 256);
  g.fillStyle = base; g.fillRect(0, 0, 128, 256);
  g.strokeStyle = shade(base, 0.55); g.lineWidth = 6;
  g.strokeRect(16, 16, 96, 100); g.strokeRect(16, 136, 96, 104);
  g.strokeStyle = shade(base, 1.4); g.lineWidth = 2;
  g.strokeRect(22, 22, 84, 88); g.strokeRect(22, 142, 84, 92);
  const t = toTex(c);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

// ふんわり光る丸（光のにじみ・影・粒）
export function glow(inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)') {
  const [c, g] = canvas(128, 128);
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, inner); gr.addColorStop(1, outer);
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// おばけの顔（表情ごとに描き分け）
export function ghostFace(kind = 'normal', eyeCol = '#1a0f22') {
  const [c, g] = canvas(256, 256);
  g.clearRect(0, 0, 256, 256);
  g.fillStyle = eyeCol; g.strokeStyle = eyeCol; g.lineCap = 'round'; g.lineJoin = 'round';
  const L = 92, R = 164, Y = 104;
  const pupil = (x, y, rx, ry, glowCol) => {
    g.fillStyle = glowCol || eyeCol;
    g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#fff';
    g.beginPath(); g.arc(x - rx * 0.35, y - ry * 0.4, rx * 0.32, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.arc(x + rx * 0.3, y + ry * 0.3, rx * 0.14, 0, Math.PI * 2); g.fill();
    g.fillStyle = eyeCol;
  };
  if (kind === 'normal') {
    pupil(L, Y, 15, 21); pupil(R, Y, 15, 21);
    g.lineWidth = 7;
    g.beginPath(); g.moveTo(96, 156); g.quadraticCurveTo(128, 178, 160, 150); g.stroke();
    g.fillStyle = '#fff'; g.beginPath(); g.moveTo(140, 160); g.lineTo(148, 174); g.lineTo(152, 157); g.fill();
  } else if (kind === 'angry') {
    pupil(L, Y + 4, 14, 16, '#ff2a2a'); pupil(R, Y + 4, 14, 16, '#ff2a2a');
    g.lineWidth = 9;
    g.beginPath(); g.moveTo(66, 70); g.lineTo(112, 88); g.moveTo(190, 70); g.lineTo(144, 88); g.stroke();
    g.beginPath(); g.moveTo(92, 168); g.quadraticCurveTo(128, 140, 164, 168); g.stroke();
  } else if (kind === 'stun') {
    g.lineWidth = 6;
    for (const x of [L, R]) {
      g.beginPath();
      for (let a = 0; a < Math.PI * 5; a += 0.2) {
        const rr = a * 1.6;
        const px = x + Math.cos(a) * rr, py = Y + Math.sin(a) * rr;
        a === 0 ? g.moveTo(px, py) : g.lineTo(px, py);
      }
      g.stroke();
    }
    g.beginPath(); g.ellipse(128, 166, 18, 22, 0, 0, Math.PI * 2); g.fill();
  } else if (kind === 'laugh') {
    g.lineWidth = 8;
    g.beginPath(); g.arc(L, Y + 8, 16, Math.PI * 1.1, Math.PI * 1.9); g.stroke();
    g.beginPath(); g.arc(R, Y + 8, 16, Math.PI * 1.1, Math.PI * 1.9); g.stroke();
    g.beginPath(); g.moveTo(84, 140); g.quadraticCurveTo(128, 220, 172, 140); g.closePath(); g.fill();
    g.fillStyle = '#ff6a8a'; g.beginPath(); g.ellipse(128, 176, 18, 12, 0, 0, Math.PI * 2); g.fill();
  } else if (kind === 'hurt') {
    g.lineWidth = 8;
    for (const [x, s] of [[L, 1], [R, -1]]) {
      g.beginPath(); g.moveTo(x - 14 * s, Y - 14); g.lineTo(x + 12 * s, Y); g.lineTo(x - 14 * s, Y + 14); g.stroke();
    }
    g.lineWidth = 6;
    g.beginPath(); g.moveTo(96, 166);
    for (let i = 1; i <= 8; i++) g.lineTo(96 + i * 8, 166 + (i % 2 ? -8 : 8));
    g.stroke();
  } else if (kind === 'boss') {
    pupil(L - 4, Y, 17, 24, '#2a0a3a'); pupil(R + 4, Y, 17, 24, '#2a0a3a');
    g.lineWidth = 7;
    g.beginPath(); g.moveTo(60, 70); g.lineTo(110, 82); g.moveTo(196, 70); g.lineTo(146, 82); g.stroke();
    g.beginPath(); g.moveTo(84, 150); g.quadraticCurveTo(128, 196, 172, 150); g.quadraticCurveTo(128, 168, 84, 150); g.fill();
    // ひげ
    g.lineWidth = 6;
    g.beginPath(); g.moveTo(128, 146); g.quadraticCurveTo(96, 128, 74, 146); g.moveTo(128, 146); g.quadraticCurveTo(160, 128, 182, 146); g.stroke();
    g.strokeStyle = '#e8c84a'; g.lineWidth = 4;
    g.beginPath(); g.arc(R + 4, Y, 28, 0, Math.PI * 2); g.stroke();
  } else if (kind === 'bossOpen') {
    pupil(L - 4, Y - 4, 20, 26, '#ff3aff'); pupil(R + 4, Y - 4, 20, 26, '#ff3aff');
    g.beginPath(); g.ellipse(128, 168, 40, 36, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#ff6a8a'; g.beginPath(); g.ellipse(128, 186, 24, 14, 0, 0, Math.PI * 2); g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
