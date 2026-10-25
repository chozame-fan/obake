// ゆうれい屋敷のおそうじ係 ─ 本体
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import * as MAP from './map.js';
import { ROOMS, ROOM, DOORS, WALL_H, KEY_NAME, KEY_COLOR, collide, roomOfPoint, lineClear, solidCell, cellX, cellZ } from './map.js';
import { buildWorld, cutPlanes, cutCaps, searchables, flickers, roomLights, decor, doorMeshes } from './build.js';
import { makePlayer, makeGhost, GHOST_TYPES, GLOW_TEX } from './actors.js';
import * as T from './tex.js';
import { initAudio, S, vacuum, setBattle, setMuted, isMuted } from './audio.js';

const $ = (id) => document.getElementById(id);
const isTouch = matchMedia('(pointer: coarse)').matches;
document.body.classList.toggle('touch', isTouch);
const SAVE_KEY = 'obake-mansion-v1';
const TEST = new URLSearchParams(location.search).has('test');

// ---------- 描画の準備 ----------
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, isTouch ? 1.5 : 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.25;
renderer.localClippingEnabled = true;
$('game').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color('#040308');
const camera = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, 0.1, 120);
const hemi = new THREE.HemisphereLight('#8090c8', '#2a1c24', 0.6);
scene.add(hemi);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth / 2, innerHeight / 2), 0.6, 0.5, 0.92);
composer.addPass(bloom);
composer.addPass(new OutputPass());

function resize() {
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.fov = camera.aspect < 1 ? 58 : 42;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

buildWorld(scene);

// ---------- 主人公 ----------
const P = makePlayer();
P.root.scale.setScalar(1.25);
scene.add(P.root);
const player = {
  pos: new THREE.Vector3(), vel: new THREE.Vector3(), facing: Math.PI, hp: 100, maxHp: 100, inv: 0,
  vac: false, flashCD: 0, caught: null, keys: new Set(), money: 0, room: null, stepT: 0,
};
// ライト（いつも点いている懐中電灯）
const spot = new THREE.SpotLight('#fff0c8', 34, 17, 0.5, 0.55, 1.15);
spot.castShadow = true;
spot.shadow.mapSize.set(1024, 1024);
spot.shadow.camera.near = 0.2; spot.shadow.camera.far = 17;
spot.shadow.bias = -0.0004; spot.shadow.normalBias = 0.03;
scene.add(spot, spot.target);
// 自分のまわりのほんのり明かり（真っ暗で迷わないように）
const selfLight = new THREE.PointLight('#ffe0c0', 2.5, 5, 1.2);
scene.add(selfLight);
// 光の筋（見える光の円すい）
const BEAM_L = 7;
const beamGeo = new THREE.ConeGeometry(Math.tan(0.4) * BEAM_L, BEAM_L, 32, 1, true);
beamGeo.translate(0, -BEAM_L / 2, 0);
beamGeo.rotateX(-Math.PI / 2);
const beamMat = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  uniforms: { uI: { value: 0.09 }, uC: { value: new THREE.Color('#ffe8b0') } },
  vertexShader: `varying vec2 vUv; varying vec3 vN; varying vec3 vV;
    void main(){ vUv=uv; vec4 mv=modelViewMatrix*vec4(position,1.); vN=normalize(normalMatrix*normal); vV=normalize(-mv.xyz); gl_Position=projectionMatrix*mv; }`,
  fragmentShader: `uniform float uI; uniform vec3 uC; varying vec2 vUv; varying vec3 vN; varying vec3 vV;
    void main(){ float a = pow(vUv.y, 1.6) * smoothstep(1.0, 0.8, vUv.y); float e = pow(abs(dot(normalize(vN), normalize(vV))), 1.8);
      gl_FragColor = vec4(uC * a * e * uI, 1.0); }`,
});
const beam = new THREE.Mesh(beamGeo, beamMat);
beam.renderOrder = 4;
scene.add(beam);

// ---------- 小物：お金・ハート・カギ ----------
const coinGeo = new THREE.CylinderGeometry(0.13, 0.13, 0.035, 18);
const coinMat = new THREE.MeshStandardMaterial({ color: '#ffd24a', metalness: 0.9, roughness: 0.25, emissive: '#8a5a00', emissiveIntensity: 0.6 });
const billGeo = new THREE.BoxGeometry(0.34, 0.02, 0.17);
const billMat = new THREE.MeshStandardMaterial({ color: '#5ac878', roughness: 0.6, emissive: '#0a4a1a', emissiveIntensity: 0.6 });
const gemGeo = new THREE.OctahedronGeometry(0.17);
const gemMat = new THREE.MeshStandardMaterial({ color: '#7ad8ff', metalness: 0.3, roughness: 0.05, emissive: '#2a8aff', emissiveIntensity: 1.2 });
const heartShape = new THREE.Shape();
heartShape.moveTo(0, -0.12);
heartShape.bezierCurveTo(-0.02, -0.08, -0.2, 0.0, -0.17, 0.09);
heartShape.bezierCurveTo(-0.14, 0.18, -0.04, 0.17, 0, 0.09);
heartShape.bezierCurveTo(0.04, 0.17, 0.14, 0.18, 0.17, 0.09);
heartShape.bezierCurveTo(0.2, 0.0, 0.02, -0.08, 0, -0.12);
const heartGeo = new THREE.ExtrudeGeometry(heartShape, { depth: 0.06, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 2 });
heartGeo.center();
const heartMat = new THREE.MeshStandardMaterial({ color: '#ff4a6a', roughness: 0.3, emissive: '#c0103a', emissiveIntensity: 1 });
const LOOT = {
  coin: { geo: coinGeo, mat: coinMat, val: 10, snd: 'coin' },
  bill: { geo: billGeo, mat: billMat, val: 50, snd: 'bill' },
  gem: { geo: gemGeo, mat: gemMat, val: 500, snd: 'gem' },
  heart: { geo: heartGeo, mat: heartMat, val: 0, snd: 'heart' },
};
const loots = [];
function spawnLoot(kind, x, y, z, n = 1) {
  for (let i = 0; i < n; i++) {
    const L = LOOT[kind];
    const m = new THREE.Mesh(L.geo, L.mat);
    m.castShadow = true;
    scene.add(m);
    const a = Math.random() * Math.PI * 2, sp = 1 + Math.random() * 2.2;
    loots.push({ kind, mesh: m, pos: new THREE.Vector3(x, y, z), vel: new THREE.Vector3(Math.cos(a) * sp, 3 + Math.random() * 2.5, Math.sin(a) * sp), t: 0, spin: Math.random() * 6 });
  }
}
function dropMoney(amount, x, y, z) {
  let gems = 0;
  if (amount >= 1000) { gems = Math.floor(amount / 500); amount -= gems * 500; }
  const bills = Math.floor(amount / 50), coins = Math.round((amount - bills * 50) / 10);
  spawnLoot('gem', x, y, z, gems); spawnLoot('bill', x, y, z, bills); spawnLoot('coin', x, y, z, coins);
}

function makeKeyMesh(col) {
  const g = new THREE.Group();
  const m = new THREE.MeshStandardMaterial({ color: col, metalness: 0.8, roughness: 0.25, emissive: col, emissiveIntensity: 0.9 });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.05, 10, 24), m);
  ring.position.y = 0.25; g.add(ring);
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.5, 10), m);
  shaft.position.y = -0.15; g.add(shaft);
  for (const [y, w] of [[-0.32, 0.16], [-0.2, 0.11]]) {
    const t = new THREE.Mesh(new THREE.BoxGeometry(w, 0.06, 0.05), m);
    t.position.set(w / 2, y, 0); g.add(t);
  }
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW_TEX, color: col, transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending }));
  halo.scale.setScalar(1.6); g.add(halo);
  return g;
}
let keyItem = null; // { id, mesh, pos, t }
// 家具とかさならない、近くの空いた場所
function freeSpot(x, z, m = 0.9) {
  for (let r = 0; r < 6; r += 0.5) for (let k = 0; k < 12; k++) {
    const a = k / 12 * Math.PI * 2, px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
    if (solidCell(cellX(px), cellZ(pz))) continue;
    if (!MAP.boxes.some(b => px > b.minX - m && px < b.maxX + m && pz > b.minZ - m && pz < b.maxZ + m)) return [px, pz];
  }
  return [x, z];
}
function spawnKey(id, x, z) {
  [x, z] = freeSpot(x, z);
  const mesh = makeKeyMesh(KEY_COLOR[id]);
  scene.add(mesh);
  keyItem = { id, mesh, pos: new THREE.Vector3(x, 4, z), t: 0 };
}

// ---------- 掃除機の粒・ひも ----------
const PN = 160;
const pGeo = new THREE.BufferGeometry();
const pPos = new Float32Array(PN * 3), pCol = new Float32Array(PN * 3);
pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
const parts = Array.from({ length: PN }, () => ({ life: 0, p: new THREE.Vector3(), v: new THREE.Vector3(), c: new THREE.Color() }));
const pMat = new THREE.PointsMaterial({ size: 0.13, map: GLOW_TEX, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
const points = new THREE.Points(pGeo, pMat);
points.frustumCulled = false;
scene.add(points);
let pNext = 0;
function emit(pos, col, vel) {
  const q = parts[pNext]; pNext = (pNext + 1) % PN;
  q.life = 1; q.p.copy(pos); q.v.copy(vel || new THREE.Vector3()); q.c.set(col);
}
const beads = [];
for (let i = 0; i < 14; i++) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW_TEX, color: '#9affe0', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  s.scale.setScalar(0.28); s.visible = false; scene.add(s); beads.push(s);
}
// ボスの闇の玉
const orbs = [];
const orbMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#d070ff').multiplyScalar(2.2) });
const orbGeo = new THREE.SphereGeometry(0.22, 16, 12);

// ---------- おばけ ----------
const ghosts = [];
let curBattle = null;
function spawnGhosts(room) {
  room.ghosts.forEach((kind, i) => {
    const G = makeGhost(kind);
    scene.add(G.root);
    G.setAlpha(0);
    const g = {
      ...G, room, state: 'wait', t: 0, delay: 0.8 + i * 2.2, hp: G.type.hp, pos: new THREE.Vector3(),
      tgt: new THREE.Vector3(), lunge: new THREE.Vector3(), turned: false, turnT: 1 + Math.random() * 2,
      caughtT: 0, flee: new THREE.Vector3(), alpha: 0, bob: Math.random() * 6, label: null, phase2: false, yaw: 0, cooldown: 0,
    };
    if (kind === 'boss') g.delay = 1.2;
    ghosts.push(g);
  });
}
function spawnMinion(room, x, z) {
  const G = makeGhost('futsu');
  scene.add(G.root);
  G.setAlpha(0);
  const g = { ...G, room, state: 'appear', t: 0, delay: 0, hp: G.type.hp, pos: new THREE.Vector3(x, 0, z), tgt: new THREE.Vector3(), lunge: new THREE.Vector3(),
    turned: false, turnT: 2, caughtT: 0, flee: new THREE.Vector3(), alpha: 0, bob: Math.random() * 6, label: null, minion: true, yaw: 0, cooldown: 0 };
  ghosts.push(g);
  S.appear();
}
function randomPointIn(room, inset = 1.2, awayFrom = null, minD = 0) {
  const b = room.b;
  for (let k = 0; k < 30; k++) {
    const x = b.minX + inset + Math.random() * (b.w - inset * 2), z = b.minZ + inset + Math.random() * (b.d - inset * 2);
    if (!awayFrom || Math.hypot(x - awayFrom.x, z - awayFrom.z) >= minD) return new THREE.Vector3(x, 0, z);
  }
  return new THREE.Vector3(b.cx, 0, b.cz);
}
function setState(g, s) { g.state = s; g.t = 0; }
function ghostVulnerable(g) {
  if (['wait', 'appear', 'flee', 'captured', 'intro', 'caught', 'stunned'].includes(g.state)) return false;
  if (g.kind === 'boss') return g.state === 'laugh';
  if (g.kind === 'chikara') return g.state === 'windup' || g.state === 'recover';
  if (g.kind === 'hayai') return !g.turned;
  return true;
}

// ---------- 入力 ----------
const keys = {};
const mouse = { x: 0, y: 0, has: false, aim: new THREE.Vector3() };
let vacHeld = false;
addEventListener('keydown', (e) => {
  if (e.repeat) return;
  keys[e.code] = true;
  initAudio();
  if (e.code === 'Space' || e.code === 'KeyF') { e.preventDefault(); doFlash(); }
  if (e.code === 'KeyJ' || e.code === 'ShiftLeft') vacHeld = true;
  if (e.code === 'Escape' || e.code === 'KeyP') togglePause();
  if (e.code === 'KeyM') toggleMute();
});
addEventListener('keyup', (e) => {
  keys[e.code] = false;
  if (e.code === 'KeyJ' || e.code === 'ShiftLeft') vacHeld = false;
});
const cvs = renderer.domElement;
cvs.addEventListener('mousemove', (e) => { mouse.x = e.clientX; mouse.y = e.clientY; mouse.has = true; });
cvs.addEventListener('mousedown', (e) => {
  initAudio();
  if (e.button === 0) vacHeld = true;
  if (e.button === 2) doFlash();
});
addEventListener('mouseup', (e) => { if (e.button === 0 && !keys.KeyJ) vacHeld = false; });
cvs.addEventListener('contextmenu', (e) => e.preventDefault());
addEventListener('blur', () => { vacHeld = false; for (const k in keys) keys[k] = false; if (game.state === 'play') togglePause(true); });

// スマホ：左でスティック、右にボタン
const stick = { id: null, ox: 0, oy: 0, x: 0, y: 0 };
const stickEl = $('stick'), knobEl = $('knob');
$('touchpad').addEventListener('pointerdown', (e) => {
  initAudio();
  if (stick.id !== null) return;
  stick.id = e.pointerId; stick.ox = e.clientX; stick.oy = e.clientY; stick.x = stick.y = 0;
  stickEl.style.display = 'block';
  stickEl.style.left = e.clientX + 'px'; stickEl.style.top = e.clientY + 'px';
  knobEl.style.transform = 'translate(-50%,-50%)';
  try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* なし */ }
});
$('touchpad').addEventListener('pointermove', (e) => {
  if (e.pointerId !== stick.id) return;
  let dx = e.clientX - stick.ox, dy = e.clientY - stick.oy;
  const d = Math.hypot(dx, dy), R = 55;
  if (d > R) { dx *= R / d; dy *= R / d; }
  stick.x = dx / R; stick.y = dy / R;
  knobEl.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
});
const stickEnd = (e) => { if (e.pointerId !== stick.id) return; stick.id = null; stick.x = stick.y = 0; stickEl.style.display = 'none'; };
$('touchpad').addEventListener('pointerup', stickEnd);
$('touchpad').addEventListener('pointercancel', stickEnd);
$('btnFlash').addEventListener('pointerdown', (e) => { e.preventDefault(); initAudio(); doFlash(); });
const vb = $('btnVac');
vb.addEventListener('pointerdown', (e) => { e.preventDefault(); initAudio(); vacHeld = true; vb.classList.add('on'); try { vb.setPointerCapture(e.pointerId); } catch { /* なし */ } });
const vacUp = () => { vacHeld = false; vb.classList.remove('on'); };
vb.addEventListener('pointerup', vacUp); vb.addEventListener('pointercancel', vacUp);

// ---------- 画面のことば ----------
let bannerT = 0;
function banner(text, sub = '', dur = 2.6) {
  $('banner').innerHTML = `<div class="b1">${text}</div>${sub ? `<div class="b2">${sub}</div>` : ''}`;
  $('banner').classList.add('show');
  bannerT = dur;
}
let hintT = 0;
const hintsShown = new Set();
function hint(key, pc, touch, dur = 5) {
  if (key && hintsShown.has(key)) return;
  if (key) hintsShown.add(key);
  $('hint').innerHTML = isTouch ? touch : pc;
  $('hint').classList.add('show');
  hintT = dur;
}
const pv = new THREE.Vector3();
function toScreen(v) {
  pv.copy(v).project(camera);
  return [(pv.x + 1) / 2 * innerWidth, (1 - pv.y) / 2 * innerHeight, pv.z < 1];
}
function popText(text, pos, cls = '') {
  const el = document.createElement('div');
  el.className = 'pop ' + cls;
  el.textContent = text;
  const [x, y] = toScreen(pos);
  el.style.left = x + 'px'; el.style.top = y + 'px';
  $('labels').appendChild(el);
  setTimeout(() => el.remove(), 1100);
}

// ---------- ゲームの進み具合 ----------
const game = { state: 'title', time: 0, captured: 0, shake: 0, flash: 0, ended: false };
const roomState = Object.fromEntries(ROOMS.map(r => [r.id, { cleared: false, active: false, lit: 0 }]));

function save() {
  if (TEST) return;
  const data = {
    v: 1, cleared: ROOMS.filter(r => roomState[r.id].cleared).map(r => r.id),
    unlocked: DOORS.filter(d => !d.locked).map(d => d.id), keys: [...player.keys], money: player.money,
    searched: searchables.filter(s => s.searched).map(s => s.id), lastRoom: player.room ? player.room.id : 'F',
    captured: game.captured, time: game.time, keyItem: keyItem ? keyItem.id : null,
  };
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch { /* 保存できなくても遊べる */ }
}
function loadSave() {
  try { return JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); } catch { return null; }
}
function applySave(d) {
  for (const id of d.cleared || []) { roomState[id].cleared = true; roomState[id].lit = 1; }
  for (const id of d.unlocked || []) { const dr = DOORS.find(x => x.id === id); if (dr) { dr.locked = false; dr.open = 1; } }
  for (const k of d.keys || []) player.keys.add(k);
  player.money = d.money || 0;
  game.captured = d.captured || 0;
  game.time = d.time || 0;
  const done = new Set(d.searched || []);
  for (const s of searchables) if (done.has(s.id)) s.searched = true;
  const r = ROOM[d.lastRoom] && roomState[d.lastRoom].cleared ? ROOM[d.lastRoom] : ROOM.F;
  placePlayerIn(r);
  // 拾い忘れたカギは部屋の真ん中に置き直す
  if (d.keyItem) { const kr = ROOMS.find(x => x.key === d.keyItem); spawnKey(d.keyItem, kr.b.cx, kr.b.cz); keyItem.pos.y = 0.9; }
}
function placePlayerIn(r) {
  if (r.id === 'F' && !roomState.F.cleared) player.pos.set(r.b.cx, 0, r.b.maxZ - 2.2);
  else player.pos.set(r.b.cx + 1.5, 0, r.b.maxZ - 1.5);
  collide(player.pos, 0.35);
  player.facing = Math.PI;
  player.room = r;
}

// ---------- ピカッ（ライトを強く光らせて、おばけをひるませる） ----------
const FLASH_RANGE = 7.5;
function doFlash() {
  if (game.state !== 'play' || player.flashCD > 0 || player.caught) return;
  player.flashCD = 0.9;
  game.flash = 1;
  S.flash();
  $('flash').animate([{ opacity: 0.55 }, { opacity: 0 }], { duration: 350, easing: 'ease-out' });
  const ang = isTouch ? 0.85 : 0.6;
  // スマホは近くのおばけへ自動で向く
  if (isTouch) {
    let best = null, bd = 1e9;
    for (const g of ghosts) {
      if (!g.root.visible || g.state === 'captured') continue;
      const d = Math.hypot(g.pos.x - player.pos.x, g.pos.z - player.pos.z);
      const da = Math.abs(angDiff(Math.atan2(g.pos.x - player.pos.x, g.pos.z - player.pos.z), player.facing));
      if (d < FLASH_RANGE && da < 1.4 && d < bd) { bd = d; best = g; }
    }
    if (best) player.facing = Math.atan2(best.pos.x - player.pos.x, best.pos.z - player.pos.z);
  }
  for (const g of ghosts) {
    if (!g.root.visible) continue;
    const dx = g.pos.x - player.pos.x, dz = g.pos.z - player.pos.z;
    const d = Math.hypot(dx, dz);
    if (d > FLASH_RANGE + g.type.size * 0.4) continue;
    if (Math.abs(angDiff(Math.atan2(dx, dz), player.facing)) > ang + 0.3 / Math.max(d, 1)) continue;
    if (!lineClear(player.pos.x, player.pos.z, g.pos.x, g.pos.z)) continue;
    if (ghostVulnerable(g)) {
      setState(g, 'stunned');
      g.setFace(g.kind === 'boss' ? 'stun' : 'stun');
      S.stun();
      hint('stun', 'いまだ！ <b>左クリック長押し</b>で吸いこめ！（おばけと<b>反対に歩く</b>と早く吸える）',
        'いまだ！ <b>🌀すう</b>を長押し！（おばけと<b>反対にスティック</b>を倒すと早く吸える）', 7);
    } else if (['roam', 'chase', 'float', 'volley', 'attack'].includes(g.state)) {
      if (g.kind === 'chikara') { popText('きかない！', g.root.position.clone().setY(2.2), 'nope'); hint('chikara', '赤いおばけは<b>なぐりかかってくる瞬間</b>（目が赤く光る時）か、なぐった<b>あと</b>にピカッ！', '赤いおばけは<b>なぐりかかる瞬間</b>か<b>なぐったあと</b>にピカッ！', 7); }
      if (g.kind === 'hayai' && g.turned) { popText('うしろ向き…', g.root.position.clone().setY(2.0), 'nope'); hint('hayai', '青いおばけは<b>こっちを向いた時</b>にピカッ！', '青いおばけは<b>こっちを向いた時</b>にピカッ！', 6); }
      if (g.kind === 'boss') { popText('ふん！', g.root.position.clone().setY(3.6), 'nope'); hint('boss', '伯爵が<b>大笑いして口を開けた時</b>がチャンス！', '伯爵が<b>大笑いして口を開けた時</b>がチャンス！', 7); }
    }
  }
}

function angDiff(a, b) { let d = a - b; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; }

// ---------- けが ----------
function hurt(dmg, fx, fz) {
  if (player.inv > 0 || game.state !== 'play') return;
  player.hp = Math.max(0, player.hp - dmg);
  player.inv = 1.4;
  const dx = player.pos.x - fx, dz = player.pos.z - fz, d = Math.hypot(dx, dz) || 1;
  player.vel.set(dx / d * 7, 0, dz / d * 7);
  game.shake = 0.5;
  S.hurt();
  $('hurt').animate([{ opacity: 1 }, { opacity: 0 }], { duration: 600, easing: 'ease-out' });
  popText('-' + dmg, player.pos.clone().setY(1.8), 'dmg');
  if (player.caught) releaseGhost(true);
  if (player.hp <= 0) gameOver();
}

function releaseGhost(escape) {
  const g = player.caught;
  if (!g) return;
  player.caught = null;
  if (escape && g.state === 'caught') {
    setState(g, 'flee');
    const dx = g.pos.x - player.pos.x, dz = g.pos.z - player.pos.z, d = Math.hypot(dx, dz) || 1;
    g.flee.set(dx / d, 0, dz / d);
    g.setFace(g.kind === 'boss' ? 'boss' : 'laugh');
    S.giggle(g.kind === 'boss' ? 0.6 : 1);
  }
}

// ---------- 部屋の出入り・戦い・クリア ----------
function nearDoor(pos, dist) {
  return DOORS.some(d => Math.hypot(pos.x - d.cx, pos.z - d.cz) < dist);
}
function startBattle(r) {
  const st = roomState[r.id];
  st.active = true;
  curBattle = r;
  let closed = false;
  for (const d of DOORS) if (d.rooms.includes(r.id) && !d.locked) { d.battle = true; closed = true; }
  if (closed) S.door(true);
  setBattle(true);
  spawnGhosts(r);
  if (r.id === 'F') hint('move', '<b>WASD / 矢印キー</b>で歩く・<b>マウス</b>でライトの向き', '<b>左側をなぞって</b>歩く（向いた方をライトが照らす）', 6);
}
function clearRoom(r) {
  const st = roomState[r.id];
  st.cleared = true; st.active = false;
  curBattle = null;
  setBattle(false);
  for (const d of DOORS) if (d.battle) d.battle = false;
  S.lightsOn();
  if (r.id === 'G') return;
  banner(`${r.name}が 明るくなった！`, r.key ? '光るカギが あらわれた…！' : '');
  if (r.key) spawnKey(r.key, r.b.cx, r.b.cz);
  save();
}

// ---------- おばけの動き ----------
const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3();
const tipW = new THREE.Vector3(), torchW = new THREE.Vector3();
function updateGhost(g, dt) {
  g.t += dt;
  g.bob += dt;
  const ty = g.type;
  const dx = player.pos.x - g.pos.x, dz = player.pos.z - g.pos.z;
  const dist = Math.hypot(dx, dz) || 0.001;
  const toP = Math.atan2(dx, dz);
  let faceYaw = toP;
  let alphaT = 1;
  const boss = g.kind === 'boss';
  switch (g.state) {
    case 'wait':
      alphaT = 0;
      if (g.t > g.delay) {
        if (boss) {
          g.pos.set(g.room.b.cx, 0, g.room.b.minZ + 1.3);
          setState(g, 'intro');
          decor.bossPortrait.userData.pic.material.map = T.portrait(99);
          decor.bossPortrait.userData.pic.material.needsUpdate = true;
          banner('ヨルノスケ伯爵', '「わしの屋敷を そうじするとは… なまいきな！」', 3.2);
          S.bossLaugh();
        } else {
          g.pos.copy(randomPointIn(g.room, 1.4, player.pos, 3.5));
          setState(g, 'appear');
        }
        S.appear();
      }
      break;
    case 'appear':
      alphaT = Math.min(1, g.t / 0.8);
      if (g.t > 0.9) {
        setState(g, 'roam');
        hint('flash', '<b>右クリック</b>（または<b>スペース</b>）でライトを<b>ピカッ</b>！ おばけをひるませよう', '<b>⚡ピカッ</b>ボタンでおばけをひるませよう', 6);
      }
      break;
    case 'intro':
      alphaT = Math.min(1, g.t / 1.5);
      g.pos.z += dt * 1.2;
      g.setFace('boss');
      if (g.t > 3) setState(g, 'float');
      break;
    case 'roam': {
      if (g.t < 0.05 || tmp.copy(g.tgt).sub(g.pos).setY(0).length() < 0.4) g.tgt.copy(randomPointIn(g.room, 1.2));
      moveToward(g, g.tgt, ty.speed * 0.7, dt);
      if (g.t > (g.kind === 'hayai' ? 1.2 : 1.8)) setState(g, 'chase');
      break;
    }
    case 'chase':
      if (dist > 1.25) moveToward(g, player.pos, ty.speed, dt);
      if (dist < 1.9 && g.cooldown <= 0) { setState(g, 'windup'); g.setFace(g.kind === 'chikara' ? 'angry' : 'laugh'); }
      if (g.t > 6) setState(g, 'roam');
      break;
    case 'windup': {
      const wt = g.kind === 'chikara' ? 0.9 : 0.75;
      g.inner.position.x = Math.sin(g.t * 60) * 0.04;
      if (g.t > wt) {
        setState(g, 'attack');
        g.lunge.set(dx / dist, 0, dz / dist);
        if (g.kind === 'futsu' || g.kind === 'hayai') S.giggle(g.kind === 'hayai' ? 1.3 : 1);
      }
      break;
    }
    case 'attack': {
      const sp = g.kind === 'chikara' ? 8 : 6.5;
      g.pos.addScaledVector(g.lunge, sp * dt);
      faceYaw = Math.atan2(g.lunge.x, g.lunge.z);
      if (dist < 0.45 + 0.45 * ty.size) { hurt(ty.dmg, g.pos.x, g.pos.z); setState(g, 'recover'); g.setFace('laugh'); }
      if (g.t > 0.35) { setState(g, 'recover'); g.setFace(g.kind === 'chikara' ? 'hurt' : 'laugh'); }
      break;
    }
    case 'recover':
      g.pos.addScaledVector(g.lunge, -0.8 * dt);
      if (g.t > (g.kind === 'chikara' ? 1.4 : 1.0)) { setState(g, 'roam'); g.setFace('normal'); g.cooldown = 2.2 + Math.random() * 2; }
      break;
    case 'stunned':
      g.inner.rotation.z = Math.sin(g.t * 9) * 0.18;
      faceYaw = toP + Math.sin(g.t * 3) * 0.3;
      if (g.t > (boss ? 2.6 : 2.3)) { setState(g, boss ? 'float' : 'roam'); g.setFace(boss ? 'boss' : 'normal'); g.inner.rotation.z = 0; }
      break;
    case 'caught': {
      g.caughtT += dt;
      g.setFace('hurt');
      // 逃げようとする向きは時々変わる
      if (g.t > 0.9 || g.t < 0.02) {
        g.t = 0.03;
        const away = Math.atan2(-dx, -dz) + (Math.random() - 0.5) * 2.2;
        g.flee.set(Math.sin(away), 0, Math.cos(away));
      }
      const resist = player.resist || 0;
      g.pos.addScaledVector(g.flee, ty.speed * (boss ? 0.8 : 0.9) * dt);
      g.pos.x += dx / dist * resist * 2.6 * dt;
      g.pos.z += dz / dist * resist * 2.6 * dt;
      g.inner.rotation.z = Math.sin(g.bob * 22) * 0.12;
      faceYaw = toP + Math.PI * 0.85;
      g.hp -= ty.drain * (1 + 2.6 * resist) * dt;
      if (Math.random() < dt * 4) S.ghostHit();
      if (g.hp <= 0) { g.hp = 0; captureGhost(g); }
      else if (dist > 6.2) { releaseGhost(true); }
      else if (boss && g.caughtT > 5.5) {
        // 伯爵はしばらくすると振りほどく
        releaseGhost(true);
        hurt(10, g.pos.x, g.pos.z);
      }
      break;
    }
    case 'flee':
      g.pos.addScaledVector(g.flee, ty.speed * 2.2 * dt);
      alphaT = 0.5 + Math.sin(g.t * 30) * 0.3;
      if (g.t > 1.3) { setState(g, boss ? 'float' : 'roam'); g.setFace(boss ? 'boss' : 'normal'); }
      break;
    case 'captured': {
      const k = Math.min(1, g.t / 0.55);
      g.pos.lerp(tmp.set(tipW.x, 0, tipW.z), k * 0.4);
      g.inner.scale.setScalar(ty.size * (1 - k) + 0.01);
      g.inner.rotation.y += dt * 25;
      if (g.t > 0.6) finishCapture(g);
      return;
    }
    // ---- 伯爵 ----
    case 'float':
      if (g.t < 0.05 || tmp.copy(g.tgt).sub(g.pos).setY(0).length() < 0.5) {
        g.tgt.copy(randomPointIn(g.room, 2.2));
        g.tgt.z = Math.min(g.tgt.z, g.room.b.cz + 1);
      }
      moveToward(g, g.tgt, ty.speed * (g.phase2 ? 1.5 : 1), dt);
      if (g.t > (g.phase2 ? 1.8 : 2.6)) setState(g, 'volley');
      break;
    case 'volley': {
      const n = g.phase2 ? 5 : 3;
      const times = Array.from({ length: n }, (_, i) => 0.25 + i * (g.phase2 ? 0.28 : 0.4));
      for (const tt of times) if (g.t - dt < tt && g.t >= tt) shootOrb(g, (Math.random() - 0.5) * 0.5);
      g.setFace('boss');
      if (g.t > times[n - 1] + 0.5) { setState(g, 'laugh'); g.setFace('bossOpen'); S.bossLaugh(); }
      break;
    }
    case 'laugh':
      if (g.t > 1.9) { setState(g, 'float'); g.setFace('boss'); }
      break;
  }
  if (g.cooldown > 0) g.cooldown -= dt;
  // 伯爵は体力が半分になると子分を呼ぶ
  if (boss && !g.phase2 && g.hp < ty.hp / 2) {
    g.phase2 = true;
    banner('ええい、子分ども！', '伯爵がおばけを呼んだ', 2.2);
    for (const sx of [-3, 3]) spawnMinion(g.room, g.room.b.cx + sx, g.room.b.cz + 1);
  }
  // 青いおばけはときどき後ろを向く（その間はピカッがきかない）
  if (g.kind === 'hayai' && ['roam', 'chase'].includes(g.state)) {
    g.turnT -= dt;
    if (g.turnT <= 0) { g.turned = !g.turned; g.turnT = g.turned ? 1.2 + Math.random() : 1.4 + Math.random() * 1.2; }
  } else if (g.state !== 'roam' && g.state !== 'chase') g.turned = false;
  if (g.turned) faceYaw += Math.PI;
  // 部屋から出ない
  const b = g.room.b, m = 0.5 * ty.size + 0.2;
  g.pos.x = Math.max(b.minX + m, Math.min(b.maxX - m, g.pos.x));
  g.pos.z = Math.max(b.minZ + m, Math.min(b.maxZ - m, g.pos.z));
  // 見た目
  g.alpha += (alphaT - g.alpha) * Math.min(1, dt * 6);
  g.setAlpha(g.alpha);
  g.yaw += angDiff(faceYaw, g.yaw) * Math.min(1, dt * 7);
  g.inner.rotation.y = g.yaw;
  const hover = 0.25 + 0.6 * ty.size + Math.sin(g.bob * 2.2) * 0.12 * ty.size;
  g.root.position.set(g.pos.x, 0, g.pos.z);
  g.inner.position.y = hover + (g.state === 'appear' ? (1 - g.alpha) * -0.8 : 0) + (g.state === 'laugh' ? Math.abs(Math.sin(g.t * 14)) * 0.12 : 0);
  if (g.state !== 'windup') g.inner.position.x *= 0.8;
  g.halo.position.y = hover;
  g.shadow.scale.setScalar(1 - Math.sin(g.bob * 2.2) * 0.1);
  g.mat.userData.time.value = g.bob;
  for (let i = 0; i < 2; i++) {
    const a = g.arms[i];
    const sd = i ? 1 : -1;
    const wave = g.state === 'caught' ? Math.sin(g.bob * 20 + i) * 0.15 : Math.sin(g.bob * 3 + i * 2) * 0.06;
    const up = g.state === 'windup' ? 0.3 : g.state === 'attack' ? 0.15 : 0;
    a.position.set(sd * (0.5 + (g.state === 'attack' ? -0.1 : 0)), -0.05 + wave + up, 0.12 + (g.state === 'attack' ? 0.3 : 0));
  }
}
function moveToward(g, p, sp, dt) {
  tmp.copy(p).sub(g.pos).setY(0);
  const d = tmp.length();
  if (d < 0.01) return;
  g.pos.addScaledVector(tmp.divideScalar(d), Math.min(d, sp * dt));
}
function shootOrb(g, spread) {
  const a = Math.atan2(player.pos.x - g.pos.x, player.pos.z - g.pos.z) + spread;
  const m = new THREE.Mesh(orbGeo, orbMat);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW_TEX, color: '#c050ff', transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending }));
  halo.scale.setScalar(1.3); m.add(halo);
  m.position.set(g.pos.x, 1.0, g.pos.z);
  scene.add(m);
  orbs.push({ mesh: m, v: new THREE.Vector3(Math.sin(a) * 5.2, 0, Math.cos(a) * 5.2), t: 0 });
  S.orb();
}
function captureGhost(g) {
  if (player.caught === g) player.caught = null;
  setState(g, 'captured');
  S.capture();
  game.shake = 0.25;
  if (g.label) { g.label.remove(); g.label = null; }
}
function finishCapture(g) {
  scene.remove(g.root);
  ghosts.splice(ghosts.indexOf(g), 1);
  game.captured++;
  const [a, b] = g.type.money;
  const amt = Math.round((a + Math.random() * (b - a)) / 10) * 10;
  dropMoney(amt, g.pos.x, 1.0, g.pos.z);
  if (Math.random() < 0.35 && g.kind !== 'boss') spawnLoot('heart', g.pos.x, 1.0, g.pos.z);
  popText(`${g.type.name}を つかまえた！`, new THREE.Vector3(g.pos.x, 2.4, g.pos.z), 'catch');
  if (g.kind === 'boss') {
    for (const o of ghosts.slice()) { scene.remove(o.root); if (o.label) o.label.remove(); }
    ghosts.length = 0;
    clearRoom(g.room);
    setTimeout(ending, 2600);
    return;
  }
  if (curBattle && !ghosts.some(o => o.room === curBattle)) clearRoom(curBattle);
}

// ---------- 主人公の動き ----------
const raycaster = new THREE.Raycaster();
const aimPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.8);
const ndc = new THREE.Vector2();
let lastFacingFromMouse = false;
function updatePlayer(dt) {
  // 移動の入力
  let mx = 0, mz = 0;
  if (keys.KeyA || keys.ArrowLeft) mx -= 1;
  if (keys.KeyD || keys.ArrowRight) mx += 1;
  if (keys.KeyW || keys.ArrowUp) mz -= 1;
  if (keys.KeyS || keys.ArrowDown) mz += 1;
  if (stick.id !== null) { mx = stick.x; mz = stick.y; }
  let ml = Math.hypot(mx, mz);
  if (ml > 1) { mx /= ml; mz /= ml; ml = 1; }
  if (ml < 0.12) { mx = mz = 0; ml = 0; }
  player.vac = vacHeld;
  const speed = player.vac ? 2.3 : 4.3;
  player.vel.x += (mx * speed - player.vel.x) * Math.min(1, dt * 10);
  player.vel.z += (mz * speed - player.vel.z) * Math.min(1, dt * 10);
  // 吸っているおばけに引っぱられる
  player.resist = 0;
  const g = player.caught;
  if (g) {
    const dx = g.pos.x - player.pos.x, dz = g.pos.z - player.pos.z, d = Math.hypot(dx, dz) || 1;
    if (ml > 0) player.resist = Math.max(0, -(mx * dx + mz * dz) / (d * ml)) * ml;
    player.pos.x += dx / d * g.type.pull * (1 - player.resist * 0.75) * dt;
    player.pos.z += dz / d * g.type.pull * (1 - player.resist * 0.75) * dt;
    if (!player.vac) releaseGhost(true);
  }
  player.pos.addScaledVector(player.vel, dt);
  collide(player.pos, 0.35);
  // 向き
  let want = player.facing;
  if (player.caught) {
    want = Math.atan2(player.caught.pos.x - player.pos.x, player.caught.pos.z - player.pos.z);
  } else if (mouse.has && !isTouch) {
    ndc.set(mouse.x / innerWidth * 2 - 1, -(mouse.y / innerHeight) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    if (raycaster.ray.intersectPlane(aimPlane, mouse.aim)) {
      want = Math.atan2(mouse.aim.x - player.pos.x, mouse.aim.z - player.pos.z);
      lastFacingFromMouse = true;
    }
  } else if (ml > 0.2) {
    // 吸っている最中にひるんだおばけが近くにいる時は、向きを変えない（後ろに下がりながら吸える）
    const holdAim = player.vac && ghosts.some(o => o.state === 'stunned' && Math.hypot(o.pos.x - player.pos.x, o.pos.z - player.pos.z) < 6);
    if (!holdAim) want = Math.atan2(mx, mz);
  }
  player.facing += angDiff(want, player.facing) * Math.min(1, dt * (player.caught ? 8 : 14));
  if (player.flashCD > 0) player.flashCD -= dt;
  if (player.inv > 0) player.inv -= dt;
  // 体の動き
  const sp = Math.hypot(player.vel.x, player.vel.z);
  P.walk += sp * dt * 3.2;
  P.root.position.copy(player.pos);
  P.root.rotation.y = player.facing;
  const w = Math.min(1, sp / 3);
  P.legs[0].rotation.x = Math.sin(P.walk) * 0.7 * w;
  P.legs[1].rotation.x = -Math.sin(P.walk) * 0.7 * w;
  P.body.position.y = Math.abs(Math.sin(P.walk)) * 0.05 * w;
  // おばけが近いとびくびく
  const scared = ghosts.some(o => o.root.visible && o.state !== 'captured' && Math.hypot(o.pos.x - player.pos.x, o.pos.z - player.pos.z) < 3);
  const shiver = scared && sp < 0.5 ? Math.sin(game.time * 50) * 0.012 : 0;
  P.body.position.x = shiver + (player.caught ? Math.sin(game.time * 40) * 0.02 : 0);
  P.body.rotation.x += ((player.caught ? -0.28 : player.vac ? -0.08 : 0.06 * w) - P.body.rotation.x) * Math.min(1, dt * 8);
  P.nozzle.rotation.z = player.vac ? Math.sin(game.time * 45) * 0.06 : 0;
  P.gauge.material.color.set(player.caught ? '#ff7a5a' : player.vac ? '#7affff' : '#7dffb0');
  P.root.visible = player.inv <= 0 || Math.floor(player.inv * 14) % 2 === 0;
  if (sp > 1) {
    player.stepT -= dt * sp;
    if (player.stepT <= 0) { player.stepT = 1.5; S.step(player.vac ? 0.6 : 1); }
  }
  player.room = roomOfPoint(player.pos.x, player.pos.z) || player.room;
}

// ---------- 掃除機：吸う ----------
const VAC_RANGE = 4.6, VAC_ANG = isTouch ? 0.6 : 0.5;
function inVacCone(x, z, extra = 0) {
  const dx = x - player.pos.x, dz = z - player.pos.z;
  const d = Math.hypot(dx, dz);
  if (d > VAC_RANGE + extra) return false;
  return d < 0.7 || Math.abs(angDiff(Math.atan2(dx, dz), player.facing)) < VAC_ANG + extra * 0.1;
}
function updateVacuum(dt) {
  const on = player.vac && game.state === 'play';
  vacuum(on, player.caught ? 1 : 0);
  if (!on) return;
  // おばけをつかまえる
  if (!player.caught) {
    for (const g of ghosts) {
      const near = isTouch && Math.hypot(g.pos.x - player.pos.x, g.pos.z - player.pos.z) < VAC_RANGE;
      if (g.state === 'stunned' && (near || inVacCone(g.pos.x, g.pos.z, g.type.size * 0.4)) && lineClear(player.pos.x, player.pos.z, g.pos.x, g.pos.z)) {
        player.caught = g;
        setState(g, 'caught');
        g.t = 1;
        g.caughtT = 0;
        g.inner.rotation.z = 0;
        break;
      }
    }
  }
  // 粒
  const n = Math.random() < 0.5 ? 2 : 3;
  for (let i = 0; i < n; i++) {
    if (player.caught) {
      const g = player.caught;
      tmp.set(g.pos.x + (Math.random() - 0.5) * 0.8, g.inner.position.y + (Math.random() - 0.5) * 0.6, g.pos.z + (Math.random() - 0.5) * 0.8);
      emit(tmp, g.type.emissive);
    } else {
      const a = player.facing + (Math.random() - 0.5) * VAC_ANG * 2, d = 1.2 + Math.random() * (VAC_RANGE - 1.2);
      tmp.set(player.pos.x + Math.sin(a) * d, 0.2 + Math.random() * 1.2, player.pos.z + Math.cos(a) * d);
      if (lineClear(player.pos.x, player.pos.z, tmp.x, tmp.z)) emit(tmp, Math.random() < 0.5 ? '#cfe8ff' : '#fff2c0');
    }
  }
  // 家具をゆらす → 中から何か出てくる
  for (const s of searchables) {
    if (s.room !== player.room?.id) continue;
    if (!inVacCone(s.x, s.z, s.rad) || Math.hypot(s.x - player.pos.x, s.z - player.pos.z) > 3.4 + s.rad) continue;
    s.shake = 0.35;
    s.suck += dt;
    if (!s.searched && s.suck > 0.7) {
      s.searched = true;
      S.shake();
      for (const [k, n2] of Object.entries(s.loot)) spawnLoot(k, s.x, 1.1, s.z, n2);
      if (!TEST) save();
    }
  }
}

// ---------- 毎フレーム ----------
const clock = new THREE.Clock();
const camPos = new THREE.Vector3(), camTgt = new THREE.Vector3();
let camInit = false;
function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 1 / 20);
  step(dt);
  render();
}
function step(dt) {
  const playing = game.state === 'play';
  if (playing) {
    game.time += dt;
    updatePlayer(dt);
    updateVacuum(dt);
    for (const g of ghosts.slice()) updateGhost(g, dt);
    updateRooms(dt);
  }
  updateWorld(dt, playing);
  updateCamera(dt);
  updateHUD(dt);
}
function updateRooms(dt) {
  const r = player.room;
  if (!r) return;
  const st = roomState[r.id];
  if (!st.cleared && !st.active && !curBattle && !nearDoor(player.pos, 1.8)) startBattle(r);
  if (r !== updateRooms.last) {
    updateRooms.last = r;
    if (!st.cleared) banner(r.name, r.id === 'G' ? '…なにかの気配がする' : 'まっくらだ…', 2);
  }
  // とびら
  for (const d of DOORS) {
    const near = Math.hypot(player.pos.x - d.cx, player.pos.z - d.cz) < 1.9;
    if (d.locked && near) {
      if (player.keys.has(d.key)) {
        d.locked = false;
        player.keys.delete(d.key);
        banner('ガチャッ', `${KEY_NAME[d.key]}で とびらが開いた`, 1.8);
        save();
      } else if (!d.warned) {
        d.warned = true;
        S.locked();
        popText('カギがかかっている', new THREE.Vector3(d.cx, 2.4, d.cz), 'nope');
      }
    }
    if (!near) d.warned = false;
    const want = !d.locked && !d.battle ? 1 : 0;
    if (want && d.open < 0.01 && !d.locked && !d.battle && d.wasClosed) S.door();
    d.wasClosed = want === 0;
    d.open += Math.sign(want - d.open) * Math.min(Math.abs(want - d.open), dt * 2.2);
  }
  // カギ
  if (keyItem) {
    const k = keyItem;
    k.t += dt;
    k.pos.y = Math.max(0.9, k.pos.y - dt * 3);
    k.mesh.position.set(k.pos.x, k.pos.y + Math.sin(k.t * 3) * 0.1, k.pos.z);
    k.mesh.rotation.y += dt * 2;
    if (Math.random() < dt * 8) emit(tmp.set(k.pos.x + (Math.random() - 0.5) * 0.6, k.pos.y, k.pos.z + (Math.random() - 0.5) * 0.6), KEY_COLOR[k.id], tmp2.set(0, 0.8, 0));
    const pull = player.vac && inVacCone(k.pos.x, k.pos.z);
    const d = Math.hypot(k.pos.x - player.pos.x, k.pos.z - player.pos.z);
    if (pull && d > 0.4) { k.pos.x += (player.pos.x - k.pos.x) / d * 5 * dt; k.pos.z += (player.pos.z - k.pos.z) / d * 5 * dt; }
    if (d < 0.8 && k.pos.y < 1.5) {
      player.keys.add(k.id);
      scene.remove(k.mesh);
      keyItem = null;
      S.key();
      banner(`🔑 ${KEY_NAME[k.id]}を 手に入れた！`, `${ROOM[k.id].name}の とびらを開けよう`, 3);
      save();
    }
  }
}
function updateWorld(dt, playing) {
  // 壁の切りぬき：今いる部屋の手前の壁を低く
  for (const r of ROOMS) {
    const pl = cutPlanes[r.id];
    const want = player.room === r ? 1.0 : WALL_H;
    pl.constant += (want - pl.constant) * Math.min(1, dt * 6);
    if (cutCaps[r.id]) cutCaps[r.id].position.y = pl.constant - WALL_H;
    const st = roomState[r.id];
    st.lit += ((st.cleared ? 1 : 0) - st.lit) * Math.min(1, dt * 1.2);
    roomLights[r.id].intensity = st.lit * 14 * (0.97 + Math.random() * 0.03);
  }
  const litHere = player.room ? roomState[player.room.id].lit : 0;
  hemi.intensity = 0.6 + litHere * 0.6;
  selfLight.intensity = 2.5 * (1 - litHere * 0.6);
  selfLight.position.set(player.pos.x, 2.2, player.pos.z);
  // とびらの開き
  for (const d of DOORS) {
    const dm = doorMeshes[d.id];
    const e = d.open * d.open * (3 - 2 * d.open);
    for (const lf of dm.leaves) lf.pivot.rotation.y = -e * Math.PI / 2 * dm.sgn * lf.side;
    dm.lock.visible = d.locked;
    dm.lock.material.opacity = 0.7 + Math.sin(game.time * 4) * 0.3;
  }
  // 火のゆらめき
  for (const f of flickers) {
    const n = Math.sin(game.time * 13 + f.ph) * 0.5 + Math.sin(game.time * 29 + f.ph * 2) * 0.3 + Math.random() * 0.2;
    if (f.mesh) f.mesh.scale.set(f.base.x * (0.85 + n * 0.15), f.base.y * (0.8 + n * 0.35), f.base.z * (0.85 + n * 0.15));
    if (f.light) f.light.intensity = f.base * (0.75 + n * 0.35);
  }
  // 家具のゆれ
  for (const s of searchables) {
    if (s.shake > 0) {
      s.shake -= dt;
      s.group.rotation.z = Math.sin(game.time * 45) * 0.035 * Math.min(1, s.shake * 4);
      s.group.rotation.x = Math.cos(game.time * 39) * 0.02 * Math.min(1, s.shake * 4);
    } else if (s.group.rotation.z) { s.group.rotation.z = 0; s.group.rotation.x = 0; }
  }
  // お金などの小物
  P.root.updateMatrixWorld(true);
  P.tip.getWorldPosition(tipW);
  P.torch.getWorldPosition(torchW);
  for (let i = loots.length - 1; i >= 0; i--) {
    const L = loots[i];
    L.t += dt;
    const dx = player.pos.x - L.pos.x, dz = player.pos.z - L.pos.z, d = Math.hypot(dx, dz);
    const sucked = playing && player.vac && L.t > 0.4 && inVacCone(L.pos.x, L.pos.z);
    if (sucked) {
      tmp.copy(tipW).sub(L.pos);
      const dd = tmp.length();
      L.vel.lerp(tmp.multiplyScalar(9 / Math.max(dd, 0.1)), Math.min(1, dt * 8));
      L.pos.addScaledVector(L.vel, dt);
    } else {
      L.vel.y -= 14 * dt;
      L.pos.addScaledVector(L.vel, dt);
      const fy = L.kind === 'bill' ? 0.03 : 0.14;
      if (L.pos.y < fy) { L.pos.y = fy; L.vel.y = Math.abs(L.vel.y) > 1.2 ? -L.vel.y * 0.4 : 0; L.vel.x *= 0.7; L.vel.z *= 0.7; }
      collide(L.pos, 0.12);
    }
    L.mesh.position.copy(L.pos);
    if (L.kind === 'coin') { L.mesh.rotation.x = Math.PI / 2; L.mesh.rotation.z = L.t * 5 + L.spin; L.mesh.position.y += 0.02; }
    else if (L.kind === 'gem' || L.kind === 'heart') { L.mesh.rotation.y = L.t * 2.5; L.mesh.position.y += 0.15 + Math.sin(L.t * 3) * 0.05; }
    else L.mesh.rotation.y = L.spin + Math.sin(L.t * 2) * 0.3;
    if (playing && L.t > 0.5 && (d < 0.6 || (sucked && tmp2.copy(tipW).sub(L.pos).length() < 0.35))) {
      collectLoot(L);
      scene.remove(L.mesh);
      loots.splice(i, 1);
    }
  }
  // ボスの玉
  for (let i = orbs.length - 1; i >= 0; i--) {
    const o = orbs[i];
    o.t += dt;
    if (playing) o.mesh.position.addScaledVector(o.v, dt);
    o.mesh.scale.setScalar(1 + Math.sin(o.t * 20) * 0.1);
    const p = o.mesh.position;
    let dead = o.t > 3.5 || solidCell(cellX(p.x), cellZ(p.z));
    if (playing && Math.hypot(p.x - player.pos.x, p.z - player.pos.z) < 0.55) { hurt(15, p.x, p.z); dead = true; }
    if (dead) { scene.remove(o.mesh); orbs.splice(i, 1); }
  }
  // 粒
  for (let i = 0; i < PN; i++) {
    const q = parts[i];
    if (q.life > 0) {
      if (player.vac && playing) {
        tmp.copy(tipW).sub(q.p);
        const d = tmp.length();
        q.v.lerp(tmp.multiplyScalar(7 / Math.max(d, 0.2)), Math.min(1, dt * 5));
        if (d < 0.25) q.life = 0;
      } else q.v.multiplyScalar(0.96);
      q.p.addScaledVector(q.v, dt);
      q.life -= dt * 0.9;
    }
    const a = Math.max(0, q.life);
    pPos[i * 3] = q.p.x; pPos[i * 3 + 1] = a > 0 ? q.p.y : -50; pPos[i * 3 + 2] = q.p.z;
    pCol[i * 3] = q.c.r * a; pCol[i * 3 + 1] = q.c.g * a; pCol[i * 3 + 2] = q.c.b * a;
  }
  pGeo.attributes.position.needsUpdate = true;
  pGeo.attributes.color.needsUpdate = true;
  // おばけとノズルをつなぐ光のひも
  const cg = player.caught;
  for (let i = 0; i < beads.length; i++) {
    const s = beads[i];
    s.visible = !!cg;
    if (!cg) continue;
    const t = (i + 1) / (beads.length + 1);
    tmp.set(cg.pos.x, cg.inner.position.y, cg.pos.z);
    s.position.lerpVectors(tipW, tmp, t);
    const wig = Math.sin(t * Math.PI) * 0.25;
    s.position.y += Math.sin(game.time * 18 + t * 12) * wig;
    s.position.x += Math.cos(game.time * 15 + t * 10) * wig * 0.6;
    s.material.color.set(cg.type.emissive);
    s.scale.setScalar(0.18 + Math.sin(game.time * 30 + i) * 0.05);
  }
  // ライト
  const dirx = Math.sin(player.facing), dirz = Math.cos(player.facing);
  spot.position.copy(torchW);
  spot.target.position.set(player.pos.x + dirx * 6, 0.1, player.pos.z + dirz * 6);
  if (game.flash > 0) game.flash = Math.max(0, game.flash - dt * 5);
  spot.intensity = 34 + game.flash * 260;
  spot.angle = 0.5 + game.flash * 0.15;
  // 光の筋は壁まで
  let wallD = BEAM_L;
  for (let s2 = 0.5; s2 < BEAM_L; s2 += 0.25) {
    if (solidCell(cellX(player.pos.x + dirx * s2), cellZ(player.pos.z + dirz * s2))) { wallD = s2 + 0.3; break; }
  }
  beam.position.copy(torchW);
  beam.lookAt(spot.target.position);
  beam.scale.setScalar(Math.min(1, wallD / BEAM_L));
  beamMat.uniforms.uI.value = 0.08 + game.flash * 0.6;
  P.root.visible = P.root.visible && game.state !== 'title';
}
function collectLoot(L) {
  const def = LOOT[L.kind];
  S[def.snd]();
  if (L.kind === 'heart') {
    player.hp = Math.min(player.maxHp, player.hp + 20);
    popText('+20 ❤', player.pos.clone().setY(1.9), 'heal');
  } else {
    player.money += def.val;
    popText('+' + def.val, player.pos.clone().setY(1.9), 'money');
  }
}
function updateCamera(dt) {
  const portrait = camera.aspect < 1;
  camTgt.set(player.pos.x, 0.6, player.pos.z - (portrait ? 0.3 : 0.9));
  const off = portrait ? [0, 12, 8.8] : [0, 9.6, 7.4];
  const want = tmp.set(camTgt.x + off[0], camTgt.y + off[1], camTgt.z + off[2]);
  if (!camInit) { camPos.copy(want); camInit = true; }
  camPos.lerp(want, Math.min(1, dt * 5));
  camera.position.copy(camPos);
  if (game.shake > 0) {
    game.shake = Math.max(0, game.shake - dt);
    const s = game.shake * 0.35;
    camera.position.x += (Math.random() - 0.5) * s; camera.position.y += (Math.random() - 0.5) * s;
  }
  camera.lookAt(camPos.x - off[0], camTgt.y, camPos.z - off[2]);
}
function render() { composer.render(); }

// ---------- 画面表示（HUD） ----------
let mapT = 0;
const hudCache = {};
function setText(id, v, html = false) {
  if (hudCache[id] === v) return;
  hudCache[id] = v;
  if (html) $(id).innerHTML = v; else $(id).textContent = v;
}
function updateHUD(dt) {
  if (bannerT > 0) { bannerT -= dt; if (bannerT <= 0) $('banner').classList.remove('show'); }
  if (hintT > 0) { hintT -= dt; if (hintT <= 0) $('hint').classList.remove('show'); }
  setText('hpNum', Math.ceil(player.hp));
  $('hpBar').style.width = (player.hp / player.maxHp * 100) + '%';
  $('hpBar').classList.toggle('low', player.hp <= 30);
  setText('money', player.money.toLocaleString());
  const r = player.room;
  setText('roomName', r ? r.name : '');
  const left = curBattle ? ghosts.filter(g => g.room === curBattle && !g.minion).length : 0;
  setText('ghostLeft', curBattle ? `👻 のこり ${left}` : (r && roomState[r.id].cleared ? '✨ 明るい' : ''));
  const keyArr = [...player.keys];
  setText('keys', keyArr.map(k => `<span class="key" style="--c:${KEY_COLOR[k]}">🔑 ${KEY_NAME[k]}</span>`).join(''), true);
  setText('goal', goalText());
  // おばけの体力表示
  for (const g of ghosts) {
    const show = (g.state === 'stunned' || g.state === 'caught') && game.state === 'play';
    if (show && !g.label) {
      g.label = document.createElement('div');
      g.label.className = 'ghp';
      $('labels').appendChild(g.label);
    }
    if (!show && g.label) { g.label.remove(); g.label = null; }
    if (g.label) {
      const [x, y] = toScreen(tmp.set(g.pos.x, g.inner.position.y + 0.75 * g.type.size + 0.3, g.pos.z));
      g.label.style.left = x + 'px'; g.label.style.top = y + 'px';
      g.label.innerHTML = `<b>❤ ${Math.ceil(g.hp)}</b>`;
      g.label.classList.toggle('pull', g.state === 'caught' && player.resist > 0.3);
    }
  }
  mapT -= dt;
  if (mapT <= 0) { mapT = 0.15; drawMap(); }
}
function goalText() {
  if (game.state !== 'play') return '';
  if (curBattle) return curBattle.id === 'G' ? '伯爵をつかまえろ！' : 'おばけを全部つかまえて、部屋を明るくしよう';
  if (keyItem) return '光るカギを拾おう';
  if (player.keys.size) { const k = [...player.keys][0]; return `${KEY_NAME[k]}で ${ROOM[k].name}の とびらを開けよう`; }
  return 'まだ暗い部屋を さがそう';
}
const mapCtx = $('map').getContext('2d');
function drawMap() {
  const c = mapCtx, s = 4;
  c.clearRect(0, 0, 160, 112);
  for (const r of ROOMS) {
    const st = roomState[r.id];
    c.fillStyle = st.cleared ? '#e8c86a' : st.active ? '#7a3a5a' : '#2a2638';
    c.fillRect(r.x0 * s + 2, r.z0 * s + 2, (r.x1 - r.x0 + 1) * s, (r.z1 - r.z0 + 1) * s);
    if (player.room === r) { c.strokeStyle = '#fff'; c.lineWidth = 1.5; c.strokeRect(r.x0 * s + 2.5, r.z0 * s + 2.5, (r.x1 - r.x0 + 1) * s - 1, (r.z1 - r.z0 + 1) * s - 1); }
  }
  for (const d of DOORS) {
    c.fillStyle = d.locked ? KEY_COLOR[d.key] : '#8a7a5a';
    for (const [x, z] of d.cells) c.fillRect(x * s + 2, z * s + 2, s, s);
  }
  const px = (player.pos.x + MAP.W / 2) * s + 2, pz = (player.pos.z + MAP.H / 2) * s + 2;
  c.fillStyle = '#ffd23a';
  c.beginPath(); c.arc(px, pz, 3, 0, Math.PI * 2); c.fill();
  c.strokeStyle = '#ffd23a'; c.lineWidth = 1.5;
  c.beginPath(); c.moveTo(px, pz); c.lineTo(px + Math.sin(player.facing) * 7, pz + Math.cos(player.facing) * 7); c.stroke();
  if (keyItem) { c.fillStyle = KEY_COLOR[keyItem.id]; c.beginPath(); c.arc((keyItem.pos.x + MAP.W / 2) * s + 2, (keyItem.pos.z + MAP.H / 2) * s + 2, 2.5, 0, Math.PI * 2); c.fill(); }
}

// ---------- 画面の切りかえ ----------
function show(id) { for (const el of document.querySelectorAll('.screen')) el.classList.toggle('show', el.id === id); }
function startGame(cont) {
  initAudio();
  S.click();
  if (cont) { const d = loadSave(); if (d) applySave(d); }
  else { try { localStorage.removeItem(SAVE_KEY); } catch { /* なし */ } placePlayerIn(ROOM.F); }
  updateRooms.last = player.room;
  game.state = 'play';
  show(null);
  $('hud').classList.add('show');
  if (!cont) banner('ゆうれい屋敷のおそうじ係', 'おじいちゃんの屋敷を、ひと晩でピカピカにしよう', 3.4);
  else banner('つづきから', player.room.name, 2);
}
function togglePause(force) {
  if (game.state === 'play' || force === true) {
    if (game.state !== 'play') return;
    game.state = 'pause'; vacuum(false); show('pause');
  } else if (game.state === 'pause') { game.state = 'play'; show(null); clock.getDelta(); }
}
function toggleMute() {
  setMuted(!isMuted());
  $('btnMute').textContent = isMuted() ? '🔇' : '🔊';
  $('pMute').textContent = isMuted() ? '🔇 音：オフ' : '🔊 音：オン';
}
function gameOver() {
  game.state = 'over';
  vacuum(false); setBattle(false);
  S.gameover();
  setTimeout(() => show('over'), 900);
}
function ending() {
  game.state = 'end';
  vacuum(false);
  S.win();
  // 床に残ったお金も数える（伯爵の宝石など）
  for (const L of loots) if (L.kind !== 'heart') player.money += LOOT[L.kind].val;
  const m = player.money;
  const rank = m >= 9000 ? 'S' : m >= 7500 ? 'A' : m >= 6000 ? 'B' : m >= 4500 ? 'C' : 'D';
  const min = Math.floor(game.time / 60), sec = Math.floor(game.time % 60);
  $('endStats').innerHTML = `
    <div>集めたお金 <b>${m.toLocaleString()}</b> 円</div>
    <div>つかまえたおばけ <b>${game.captured}</b> ひき</div>
    <div>かかった時間 <b>${min}分${sec}秒</b></div>
    <div class="rank">ランク <span>${rank}</span></div>`;
  try { localStorage.removeItem(SAVE_KEY); } catch { /* なし */ }
  show('end');
  $('hud').classList.remove('show');
}

$('btnNew').onclick = () => startGame(false);
$('btnCont').onclick = () => startGame(true);
$('btnCont').style.display = loadSave() ? '' : 'none';
$('btnRetry').onclick = () => { try { sessionStorage.setItem('obake-auto', '1'); } catch { /* なし */ } location.reload(); };
$('btnTitle').onclick = () => location.reload();
$('btnEndTitle').onclick = () => location.reload();
$('pResume').onclick = () => togglePause();
$('pMute').onclick = () => toggleMute();
$('pTitle').onclick = () => location.reload();
$('btnPause').onclick = () => togglePause();
$('btnMute').onclick = () => toggleMute();

// タイトル画面のうしろは玄関ホールをゆっくり見せる
placePlayerIn(ROOM.F);
let autoRetry = false;
try { autoRetry = !!sessionStorage.getItem('obake-auto'); sessionStorage.removeItem('obake-auto'); } catch { /* なし */ }
if (autoRetry) {
  if (loadSave()) startGame(true); else startGame(false);
} else show('title');
frame();

// 確認用
window.__om = { get keyItem() { return keyItem; }, game, player, ghosts, roomState, ROOM, DOORS, step, render, startGame, spawnKey, clearRoom, camera, scene, renderer,
  stun: () => ghosts.forEach(g => { if (g.root.visible) setState(g, 'stunned'); }),
  warp: (id) => { placePlayerIn(ROOM[id]); },
  skipTo: (id) => { for (const r of ROOMS) { if (r.id === id) break; roomState[r.id].cleared = true; roomState[r.id].lit = 1; } for (const d of DOORS) { d.locked = false; d.open = 1; } placePlayerIn(ROOM[id]); },
};
