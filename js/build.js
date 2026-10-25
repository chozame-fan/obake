// 屋敷を組み立てる：床・壁・とびら・家具・窓・明かり
import * as THREE from 'three';
import * as T from './tex.js';
import { W, H, WALL_H, ROOMS, ROOM, DOORS, grid, roomAt, doorAt, boxes, cutRoomOf, cellX, KEY_COLOR } from './map.js';

const std = (o) => new THREE.MeshStandardMaterial(o);
export const M = {
  woodDark: std({ color: '#3b2416', roughness: 0.7 }),
  wood: std({ color: '#6b4129', roughness: 0.65 }),
  woodRed: std({ color: '#5a2418', roughness: 0.55 }),
  woodLight: std({ color: '#9a6a40', roughness: 0.7 }),
  metal: std({ color: '#8a8f99', metalness: 0.85, roughness: 0.35 }),
  iron: std({ color: '#2a2a30', metalness: 0.6, roughness: 0.6 }),
  gold: std({ color: '#c9a34a', metalness: 0.9, roughness: 0.3 }),
  cloth: std({ color: '#e8e2d4', roughness: 0.9 }),
  red: std({ color: '#7a1d24', roughness: 0.85 }),
  green: std({ color: '#2f5a3a', roughness: 0.85 }),
  purple: std({ color: '#5a3a7a', roughness: 0.85 }),
  blue: std({ color: '#2a3a6a', roughness: 0.85 }),
  stone: std({ color: '#8a8580', roughness: 0.9 }),
  marble: std({ color: '#d8d4cc', roughness: 0.4 }),
  plant: std({ color: '#2a3a20', roughness: 0.9 }),
  pot: std({ color: '#8a4a2a', roughness: 0.8 }),
  ceramic: std({ color: '#f0ece0', roughness: 0.3 }),
  black: std({ color: '#111', roughness: 0.6 }),
  flame: new THREE.MeshBasicMaterial({ color: '#ffc070' }),
  ember: new THREE.MeshBasicMaterial({ color: '#ff6a20' }),
  mirror: std({ color: '#b8c4d0', metalness: 1, roughness: 0.08 }),
  bread: std({ color: '#c08040', roughness: 0.8 }),
  cap: std({ color: '#1a120c', roughness: 0.9 }),
  trim: std({ color: '#2a1a10', roughness: 0.7 }),
};
M.flame.color.multiplyScalar(3); // 光りすぎるくらいにしてにじませる
M.ember.color.multiplyScalar(2.5);

const ROOM_STYLE = {
  F: { floor: () => T.woodFloor('#5a3020', 3), wall: () => T.wallpaper('#5a1820', '#7c2c30', '#3b2416', 'damask') },
  L: { floor: () => T.woodFloor('#6b4a2a', 8), wall: () => T.wallpaper('#22402c', '#2c5238', '#3b2416', 'stripe') },
  B: { floor: () => T.woodFloor('#5a3a40', 12), wall: () => T.wallpaper('#4a3a5a', '#6a5880', '#3a2420', 'flower') },
  D: { floor: () => T.woodFloor('#7a4a28', 21), wall: () => T.wallpaper('#2a3548', '#3c4a62', '#3b2416', 'damask') },
  K: { floor: () => T.checkerFloor('#cfc6b0', '#5a4a3a', 6, 4), wall: () => T.wallpaper('#c8bea0', '#000', '#4a3a28', 'tile') },
  G: { floor: () => T.checkerFloor('#d9d2c3', '#2a2430', 5, 6), wall: () => T.wallpaper('#2a1838', '#3e2650', '#2a1a10', 'damask') },
};

export const cutPlanes = {};   // 部屋ごとの「手前の壁を低くする」面
export const cutCaps = {};     // 低くした壁の天井ぶた
export const searchables = []; // 吸うとゆれて何か出てくる家具
export const flickers = [];    // ゆらめく火
export const roomLights = {};  // クリアすると点く明かり
export const decor = {};       // あとで変える物（肖像画など）
export const doorMeshes = {};
export let world;

export function buildWorld(scene) {
  world = new THREE.Group();
  scene.add(world);
  for (const r of ROOMS) cutPlanes[r.id] = new THREE.Plane(new THREE.Vector3(0, -1, 0), WALL_H);
  buildFloors();
  buildWalls();
  buildDoors();
  for (const r of ROOMS) FURNISH[r.id](roomKit(r));
  for (const r of ROOMS) {
    const L = new THREE.PointLight('#ffd9a0', 0, Math.max(r.b.w, r.b.d) * 1.25, 1.1);
    L.position.set(r.b.cx, 2.9, r.b.cz);
    world.add(L);
    roomLights[r.id] = L;
  }
  return world;
}

// ---------- 床 ----------
function buildFloors() {
  for (const r of ROOMS) {
    const t = ROOM_STYLE[r.id].floor();
    t.repeat.set(r.b.w / 2.5, r.b.d / 2.5);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(r.b.w, r.b.d), std({ map: t, roughness: r.id === 'G' || r.id === 'K' ? 0.35 : 0.7 }));
    m.rotation.x = -Math.PI / 2;
    m.position.set(r.b.cx, 0, r.b.cz);
    m.receiveShadow = true;
    world.add(m);
  }
  const dt = T.woodFloor('#3a2214', 1);
  for (const d of DOORS) for (const [x, z] of d.cells) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), std({ map: dt }));
    m.rotation.x = -Math.PI / 2;
    m.position.set(x - W / 2 + 0.5, 0.001, z - H / 2 + 0.5);
    m.receiveShadow = true;
    world.add(m);
  }
}

// ---------- 壁（床に面した面だけ作る） ----------
function buildWalls() {
  const mats = { trim: M.trim };
  for (const r of ROOMS) mats[r.id] = std({ map: ROOM_STYLE[r.id].wall(), roughness: 0.85 });
  const buckets = {}; // "cut|mat" -> {p,n,uv}
  const caps = {};    // cut -> {p,n,uv}
  const B = (o, k) => (o[k] ||= { p: [], n: [], uv: [] });
  const quad = (b, a, c, d, e, nrm, uvs) => {
    // 表の向きが nrm になるように並びを決める
    const v1 = new THREE.Vector3().subVectors(c, a), v2 = new THREE.Vector3().subVectors(d, a);
    const flip = v1.cross(v2).dot(nrm) < 0;
    const P = flip ? [a, e, d, c] : [a, c, d, e];
    const U = flip ? [uvs[0], uvs[3], uvs[2], uvs[1]] : uvs;
    for (const i of [0, 1, 2, 0, 2, 3]) {
      b.p.push(P[i].x, P[i].y, P[i].z);
      b.n.push(nrm.x, nrm.y, nrm.z);
      b.uv.push(U[i][0], U[i][1]);
    }
  };
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  for (let z = 0; z < H; z++) for (let x = 0; x < W; x++) {
    if (grid[z][x] !== 0) continue;
    const X0 = x - W / 2, X1 = X0 + 1, Z0 = z - H / 2, Z1 = Z0 + 1;
    let any = false;
    const cut = cutRoomOf(x, z) || '-';
    for (const [dx, dz] of dirs) {
      const nx = x + dx, nz = z + dz;
      if (nx < 0 || nz < 0 || nx >= W || nz >= H) continue;
      const g = grid[nz][nx];
      if (g === 0) continue;
      any = true;
      const mat = g === 1 ? ROOMS[roomAt[nz][nx]].id : 'trim';
      const b = B(buckets, cut + '|' + mat);
      const nrm = V(dx, 0, dz);
      let a, c, d, e, u0, u1;
      if (dx === 1) { a = V(X1, 0, Z0); c = V(X1, 0, Z1); d = V(X1, WALL_H, Z1); e = V(X1, WALL_H, Z0); u0 = Z0; u1 = Z1; }
      if (dx === -1) { a = V(X0, 0, Z1); c = V(X0, 0, Z0); d = V(X0, WALL_H, Z0); e = V(X0, WALL_H, Z1); u0 = -Z1; u1 = -Z0; }
      if (dz === 1) { a = V(X1, 0, Z1); c = V(X0, 0, Z1); d = V(X0, WALL_H, Z1); e = V(X1, WALL_H, Z1); u0 = -X1; u1 = -X0; }
      if (dz === -1) { a = V(X0, 0, Z0); c = V(X1, 0, Z0); d = V(X1, WALL_H, Z0); e = V(X0, WALL_H, Z0); u0 = X0; u1 = X1; }
      const s = 1 / 1.6;
      quad(b, a, c, d, e, nrm, [[u0 * s, 0], [u1 * s, 0], [u1 * s, 1], [u0 * s, 1]]);
    }
    // 中まで壁のかたまりでも、ふたは作る（上から見えるので）
    const cb = B(caps, cut);
    quad(cb, V(X0, WALL_H, Z1), V(X1, WALL_H, Z1), V(X1, WALL_H, Z0), V(X0, WALL_H, Z0), V(0, 1, 0), [[0, 0], [1, 0], [1, 1], [0, 1]]);
    void any;
  }
  const geo = (b) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(b.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(b.n, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(b.uv, 2));
    return g;
  };
  for (const [k, b] of Object.entries(buckets)) {
    const [cut, mk] = k.split('|');
    let mat = mats[mk];
    if (cut !== '-') {
      mat = mat.clone();
      mat.clippingPlanes = [cutPlanes[cut]];
      mat.clipShadows = true;
      mat.side = THREE.DoubleSide;
    }
    const m = new THREE.Mesh(geo(b), mat);
    m.castShadow = true; m.receiveShadow = true;
    world.add(m);
  }
  for (const [cut, b] of Object.entries(caps)) {
    const m = new THREE.Mesh(geo(b), M.cap);
    m.castShadow = cut === '-';
    world.add(m);
    if (cut !== '-') cutCaps[cut] = m;
  }
}

// ---------- とびら ----------
function buildDoors() {
  const tex = T.doorTex('#4a2a18');
  for (const d of DOORS) {
    const g = new THREE.Group();
    g.position.set(d.cx, 0, d.cz);
    const cut = cutRoomOf(d.cells[0][0], d.cells[0][1]);
    const mat = std({ map: tex, roughness: 0.6 });
    const brass = M.gold.clone();
    if (cut) for (const mm of [mat, brass]) { mm.clippingPlanes = [cutPlanes[cut]]; mm.clipShadows = true; }
    const half = d.width / 2;
    // 開く向き：rooms[1]（とびらの先の部屋）の側へ
    const r1 = ROOM[d.rooms[1]].b;
    const sgn = d.vertical ? Math.sign(r1.cx - d.cx) : -Math.sign(r1.cz - d.cz);
    const leaves = [];
    for (const side of [-1, 1]) {
      const pivot = new THREE.Group();
      const leaf = new THREE.Mesh(new THREE.BoxGeometry(half - 0.04, 2.6, 0.1), mat);
      leaf.castShadow = true; leaf.receiveShadow = true;
      const knob = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), brass);
      if (d.vertical) {
        pivot.position.set(0, 0, side * half);
        leaf.rotation.y = Math.PI / 2;
        leaf.position.set(0, 1.3, -side * half / 2);
        knob.position.set(0, 1.2, -side * (half - 0.18));
        knob.scale.set(2.2, 1, 1);
      } else {
        pivot.position.set(side * half, 0, 0);
        leaf.position.set(-side * half / 2, 1.3, 0);
        knob.position.set(-side * (half - 0.18), 1.2, 0);
        knob.scale.set(1, 1, 2.2);
      }
      pivot.add(leaf, knob);
      g.add(pivot);
      leaves.push({ pivot, side });
    }
    // 上の飾り板
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(d.vertical ? 1.02 : d.width, WALL_H - 2.65, d.vertical ? d.width : 1.02), M.trim);
    lintel.position.y = 2.65 + (WALL_H - 2.65) / 2;
    if (cut) { lintel.material = M.trim.clone(); lintel.material.clippingPlanes = [cutPlanes[cut]]; }
    lintel.castShadow = true;
    g.add(lintel);
    // カギの印
    const lock = makeLockSprite(KEY_COLOR[d.key]);
    lock.position.set(0, 2.2, 0);
    if (d.vertical) lock.position.x = -0.25 * Math.sign(r1.cx - d.cx); else lock.position.z = 0.6;
    g.add(lock);
    world.add(g);
    doorMeshes[d.id] = { group: g, leaves, sgn, lock };
  }
}
function makeLockSprite(col) {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = 'rgba(0,0,0,0.55)'; g.beginPath(); g.arc(64, 64, 58, 0, Math.PI * 2); g.fill();
  g.strokeStyle = col; g.lineWidth = 8; g.beginPath(); g.arc(64, 64, 54, 0, Math.PI * 2); g.stroke();
  g.lineWidth = 10; g.beginPath(); g.arc(64, 54, 18, Math.PI, 0); g.stroke();
  g.fillStyle = col; g.fillRect(38, 54, 52, 40);
  g.fillStyle = '#000'; g.beginPath(); g.arc(64, 70, 7, 0, Math.PI * 2); g.fill(); g.fillRect(61, 70, 6, 14);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true }));
  s.scale.set(0.55, 0.55, 1);
  s.renderOrder = 5;
  return s;
}

// ---------- 家具の道具 ----------
// 北の壁ぎわの物は、北の部屋にいる時に壁と一緒に低く切る
function clipFor(r, x) {
  const cut = cutRoomOf(cellX(x), r.z0 - 1);
  return cut ? cutPlanes[cut] : null;
}
function clipGroup(o, plane) {
  if (!plane) return;
  o.traverse(m => {
    if (!m.isMesh) return;
    m.material = m.material.clone();
    m.material.clippingPlanes = [plane];
    m.material.clipShadows = true;
  });
}
function shadowAll(o) { o.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } }); return o; }
const BOXG = new Map();
function bx(w, h, d, mat, x, y, z, parent) {
  const k = w + ',' + h + ',' + d;
  if (!BOXG.has(k)) BOXG.set(k, new THREE.BoxGeometry(w, h, d));
  const m = new THREE.Mesh(BOXG.get(k), mat);
  m.position.set(x, y, z);
  parent.add(m);
  return m;
}
function cy(rt, rb, h, mat, x, y, z, parent, seg = 16) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
  m.position.set(x, y, z);
  parent.add(m);
  return m;
}
function sp(r, mat, x, y, z, parent, sx = 1, sy = 1, sz = 1) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), mat);
  m.position.set(x, y, z); m.scale.set(sx, sy, sz);
  parent.add(m);
  return m;
}
function candle(parent, x, y, z, s = 1) {
  cy(0.035 * s, 0.035 * s, 0.22 * s, M.cloth, x, y + 0.11 * s, z, parent, 8);
  const f = sp(0.03 * s, M.flame, x, y + 0.26 * s, z, parent, 1, 1.8, 1);
  flickers.push({ mesh: f, base: f.scale.clone(), ph: Math.random() * 10 });
  return f;
}
function makePlane(w, h, mat) { return new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); }

// 部屋ごとの置き方。lx,lz は部屋の左奥（北西）のすみからのm
function roomKit(r) {
  const b = r.b;
  const at = (lx, lz) => [b.minX + lx, b.minZ + lz];
  return {
    r, b,
    // 家具を置く。solid=[幅,奥行き]、loot=吸うと出る物
    put(lx, lz, rot, build, opt = {}) {
      const g = new THREE.Group();
      build(g);
      shadowAll(g);
      const [x, z] = at(lx, lz);
      g.position.set(x, 0, z);
      g.rotation.y = rot * Math.PI / 2;
      world.add(g);
      if (lz < 1.6) clipGroup(g, clipFor(r, x));
      if (opt.solid) {
        let [sw, sd] = opt.solid;
        if (rot % 2) [sw, sd] = [sd, sw];
        boxes.push({ minX: x - sw / 2, maxX: x + sw / 2, minZ: z - sd / 2, maxZ: z + sd / 2 });
      }
      if (opt.loot) {
        searchables.push({ id: r.id + ':' + searchables.length, group: g, room: r.id, loot: opt.loot,
          x, z, rad: opt.rad || 0.8, shake: 0, suck: 0, searched: false, baseRot: g.rotation.y });
      }
      return g;
    },
    // 北の壁にかける（絵・窓）
    wallN(lx, y, mesh) { const [x] = at(lx, 0); mesh.position.set(x, y, b.minZ + 0.04); world.add(mesh); clipGroup(mesh, clipFor(r, x)); return mesh; },
    wallW(lz, y, mesh) { const [, z] = at(0, lz); mesh.position.set(b.minX + 0.04, y, z); mesh.rotation.y = Math.PI / 2; world.add(mesh); return mesh; },
    wallE(lz, y, mesh) { const [, z] = at(0, lz); mesh.position.set(b.maxX - 0.04, y, z); mesh.rotation.y = -Math.PI / 2; world.add(mesh); return mesh; },
    rug(lx, lz, w, d, tex) {
      const [x, z] = at(lx, lz);
      const m = makePlane(w, d, std({ map: tex, roughness: 0.95 }));
      m.rotation.x = -Math.PI / 2; m.position.set(x, 0.006, z); m.receiveShadow = true;
      world.add(m);
      return m;
    },
  };
}

// 額縁つきの絵
function painting(kind, w = 1.0, h = 1.25) {
  const g = new THREE.Group();
  const fr = bx(w + 0.2, h + 0.2, 0.08, M.gold, 0, 0, 0, g);
  fr.castShadow = false;
  const pic = makePlane(w, h, std({ map: T.portrait(kind), roughness: 0.6 }));
  pic.position.z = 0.045;
  g.add(pic);
  g.userData.pic = pic;
  return g;
}
const winTex = T.nightWindow();
function windowMesh(w = 1.4, h = 2.0) {
  const g = new THREE.Group();
  const glass = makePlane(w, h, new THREE.MeshBasicMaterial({ map: winTex, color: '#9ab0e0' }));
  glass.position.z = 0.01;
  g.add(glass);
  bx(w + 0.24, 0.12, 0.2, M.woodDark, 0, -h / 2 - 0.06, 0.06, g);
  bx(w + 0.24, 0.12, 0.12, M.woodDark, 0, h / 2 + 0.06, 0.02, g);
  return g;
}
function curtain(g, w, h, mat) {
  const geo = new THREE.PlaneGeometry(w, h, 6, 1);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) / w * Math.PI * 6) * 0.05);
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, mat);
  m.material.side = THREE.DoubleSide;
  g.add(m);
  return m;
}

// ---------- 家具いろいろ ----------
const F = {
  table(g, w, d, h = 0.78, mat = M.wood, clothMat = null) {
    bx(w, 0.07, d, mat, 0, h, 0, g);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) bx(0.08, h, 0.08, mat, sx * (w / 2 - 0.08), h / 2, sz * (d / 2 - 0.08), g);
    if (clothMat) {
      bx(w + 0.06, 0.02, d + 0.06, clothMat, 0, h + 0.045, 0, g);
      bx(w + 0.06, 0.3, 0.01, clothMat, 0, h - 0.1, d / 2 + 0.03, g);
      bx(w + 0.06, 0.3, 0.01, clothMat, 0, h - 0.1, -d / 2 - 0.03, g);
    }
  },
  chair(g, mat = M.wood, seat = M.red) {
    bx(0.46, 0.06, 0.46, mat, 0, 0.46, 0, g);
    bx(0.42, 0.04, 0.42, seat, 0, 0.5, 0, g);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) bx(0.05, 0.46, 0.05, mat, sx * 0.19, 0.23, sz * 0.19, g);
    bx(0.46, 0.6, 0.05, mat, 0, 0.8, -0.2, g);
  },
  armchair(g, mat) {
    bx(0.8, 0.45, 0.75, mat, 0, 0.22, 0, g);
    bx(0.8, 0.6, 0.18, mat, 0, 0.75, -0.3, g);
    bx(0.14, 0.25, 0.7, mat, -0.36, 0.55, 0, g);
    bx(0.14, 0.25, 0.7, mat, 0.36, 0.55, 0, g);
  },
  shelf(g, w = 2.4, h = 2.4) {
    bx(w, h, 0.4, M.woodDark, 0, h / 2, 0, g);
    const bm = makePlane(w - 0.16, h - 0.2, std({ map: T.books(w * 10 + h), roughness: 0.8 }));
    bm.position.set(0, h / 2, 0.205);
    g.add(bm);
    bx(w + 0.1, 0.08, 0.46, M.woodDark, 0, h + 0.04, 0, g);
  },
  clock(g) {
    bx(0.6, 2.3, 0.4, M.woodRed, 0, 1.15, 0, g);
    bx(0.7, 0.2, 0.46, M.woodRed, 0, 2.35, 0, g);
    const face = cy(0.22, 0.22, 0.04, M.ceramic, 0, 1.85, 0.21, g, 24);
    face.rotation.x = Math.PI / 2;
    const hand = bx(0.02, 0.18, 0.01, M.black, 0, 1.9, 0.235, g); hand.rotation.z = 0.6;
    bx(0.02, 0.13, 0.01, M.black, 0.03, 1.83, 0.235, g).rotation.z = -1.2;
    const pend = cy(0.09, 0.09, 0.02, M.gold, 0, 0.9, 0.21, g, 16); pend.rotation.x = Math.PI / 2;
    decor.pendulums = (decor.pendulums || []).concat([pend]);
  },
  armor(g) {
    cy(0.3, 0.34, 0.15, M.stone, 0, 0.075, 0, g);
    bx(0.12, 0.7, 0.14, M.metal, -0.1, 0.5, 0, g); bx(0.12, 0.7, 0.14, M.metal, 0.1, 0.5, 0, g);
    bx(0.42, 0.55, 0.26, M.metal, 0, 1.12, 0, g);
    sp(0.16, M.metal, 0, 1.55, 0, g, 1, 1.15, 1);
    bx(0.2, 0.03, 0.02, M.black, 0, 1.56, 0.15, g);
    bx(0.1, 0.55, 0.12, M.metal, -0.28, 1.05, 0.03, g); bx(0.1, 0.55, 0.12, M.metal, 0.28, 1.05, 0.03, g);
    bx(0.04, 1.6, 0.04, M.woodDark, 0.34, 0.9, 0.12, g);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.25, 8), M.metal); tip.position.set(0.34, 1.82, 0.12); g.add(tip);
    const pl = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.3, 6), M.red); pl.position.set(0, 1.78, -0.02); pl.rotation.x = -0.5; g.add(pl);
  },
  sideTable(g, withVase = true) {
    F.table(g, 0.6, 0.45, 0.75, M.woodRed);
    if (withVase) {
      cy(0.08, 0.12, 0.3, M.ceramic, 0, 0.94, 0, g);
      for (let i = 0; i < 4; i++) {
        const st = bx(0.015, 0.3, 0.015, M.plant, (i - 1.5) * 0.04, 1.2, 0, g);
        st.rotation.z = (i - 1.5) * 0.25;
      }
    } else candle(g, 0, 0.79, 0);
  },
  plant(g) {
    cy(0.22, 0.17, 0.4, M.pot, 0, 0.2, 0, g);
    for (let i = 0; i < 7; i++) {
      const a = i / 7 * Math.PI * 2;
      const l = sp(0.16, M.plant, Math.cos(a) * 0.16, 0.65 + (i % 2) * 0.15, Math.sin(a) * 0.16, g, 0.5, 1.4, 0.5);
      l.rotation.z = Math.cos(a) * 0.6; l.rotation.x = -Math.sin(a) * 0.6;
    }
  },
  coatRack(g) {
    cy(0.04, 0.04, 1.8, M.woodDark, 0, 0.9, 0, g, 8);
    cy(0.25, 0.28, 0.05, M.woodDark, 0, 0.03, 0, g, 12);
    const coat = sp(0.25, M.blue, 0.1, 1.3, 0, g, 0.8, 1.6, 0.6);
    const hat = cy(0.16, 0.16, 0.18, M.black, -0.05, 1.86, 0, g, 12); hat.rotation.z = 0.2;
    void coat;
  },
  fireplace(g) {
    bx(1.8, 1.3, 0.55, M.stone, 0, 0.65, 0, g);
    bx(2.0, 0.12, 0.65, M.woodDark, 0, 1.36, 0.02, g);
    bx(1.0, 0.75, 0.3, M.black, 0, 0.42, 0.14, g);
    const e = bx(0.7, 0.1, 0.2, M.ember, 0, 0.12, 0.2, g);
    for (let i = 0; i < 3; i++) {
      const f = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.36, 8), M.flame);
      f.position.set((i - 1) * 0.2, 0.32, 0.2);
      g.add(f);
      flickers.push({ mesh: f, base: f.scale.clone(), ph: i * 1.7 });
    }
    candle(g, -0.7, 1.42, 0.05); candle(g, 0.7, 1.42, 0.05);
    const L = new THREE.PointLight('#ff8a3a', 3, 6, 1.4);
    L.position.set(0, 0.6, 0.7);
    g.add(L);
    flickers.push({ light: L, base: 3, ph: 0 });
    void e;
  },
  globe(g) {
    cy(0.04, 0.2, 0.7, M.woodDark, 0, 0.35, 0, g, 10);
    const s = sp(0.3, std({ color: '#3a6a8a', roughness: 0.5 }), 0, 1.0, 0, g);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.02, 6, 24), M.gold);
    ring.position.y = 1.0; ring.rotation.y = 0.4; g.add(ring);
    sp(0.18, M.green, 0.12, 1.08, 0.18, g, 1, 0.6, 0.5);
    void s;
  },
  bookStack(g) {
    const cols = [M.red, M.green, M.blue, M.purple, M.woodRed];
    for (let i = 0; i < 5; i++) { const b = bx(0.32, 0.07, 0.24, cols[i], (Math.random() - 0.5) * 0.06, 0.035 + i * 0.07, 0, g); b.rotation.y = (Math.random() - 0.5) * 0.6; }
  },
  bed(g) {
    bx(1.8, 0.4, 2.4, M.woodDark, 0, 0.2, 0, g);
    bx(1.7, 0.2, 2.3, M.cloth, 0, 0.5, 0.02, g);
    bx(1.78, 0.08, 1.5, M.purple, 0, 0.62, 0.4, g);
    sp(0.25, M.cloth, -0.42, 0.66, -0.85, g, 1.3, 0.45, 0.8);
    sp(0.25, M.cloth, 0.42, 0.66, -0.85, g, 1.3, 0.45, 0.8);
    bx(1.9, 1.2, 0.12, M.woodDark, 0, 0.8, -1.2, g);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) cy(0.05, 0.05, 2.4, M.woodDark, sx * 0.88, 1.2, sz * 1.15, g, 8);
    bx(1.9, 0.1, 2.45, M.woodDark, 0, 2.42, 0, g);
    const cm = std({ color: '#6a3a8a', roughness: 0.9, transparent: true, opacity: 0.75, side: THREE.DoubleSide });
    for (const sx of [-1, 1]) {
      const c = curtain(g, 2.3, 1.8, cm); c.rotation.y = Math.PI / 2; c.position.set(sx * 0.92, 1.5, 0);
    }
  },
  nightstand(g) {
    bx(0.5, 0.6, 0.45, M.woodRed, 0, 0.3, 0, g);
    bx(0.4, 0.02, 0.01, M.gold, 0, 0.42, 0.23, g);
    candle(g, 0, 0.6, 0);
  },
  wardrobe(g) {
    bx(1.5, 2.4, 0.65, M.woodRed, 0, 1.2, 0, g);
    bx(1.6, 0.12, 0.7, M.woodDark, 0, 2.44, 0, g);
    bx(0.01, 2.2, 0.01, M.black, 0, 1.2, 0.33, g);
    sp(0.035, M.gold, -0.08, 1.2, 0.34, g); sp(0.035, M.gold, 0.08, 1.2, 0.34, g);
  },
  dresser(g) {
    bx(1.4, 0.85, 0.5, M.woodRed, 0, 0.425, 0, g);
    for (let i = 0; i < 3; i++) { bx(1.3, 0.22, 0.01, M.woodDark, 0, 0.17 + i * 0.26, 0.255, g); sp(0.03, M.gold, 0, 0.17 + i * 0.26, 0.27, g); }
    bx(0.9, 1.0, 0.06, M.gold, 0, 1.4, -0.2, g);
    const mr = makePlane(0.8, 0.9, M.mirror); mr.position.set(0, 1.4, -0.165); g.add(mr);
    cy(0.07, 0.09, 0.18, M.ceramic, 0.5, 0.94, 0.05, g);
  },
  rockingChair(g) {
    F.chair(g, M.woodLight, M.green);
    for (const sx of [-1, 1]) {
      const rk = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.025, 6, 20, 0.9), M.woodLight);
      rk.rotation.y = Math.PI / 2; rk.rotation.z = -Math.PI / 2 - 0.45; rk.position.set(sx * 0.2, 0.72, 0); g.add(rk);
    }
  },
  chest(g) {
    bx(0.9, 0.5, 0.55, M.woodLight, 0, 0.25, 0, g);
    const lid = cy(0.275, 0.275, 0.9, M.woodLight, 0, 0.5, 0, g, 12); lid.rotation.z = Math.PI / 2; lid.scale.set(1, 1, 0.6);
    bx(0.08, 0.15, 0.02, M.gold, 0, 0.45, 0.28, g);
  },
  cabinet(g, w = 1.6) {
    bx(w, 0.9, 0.5, M.woodRed, 0, 0.45, 0, g);
    bx(w, 1.2, 0.35, M.woodRed, 0, 1.5, -0.07, g);
    const gl = makePlane(w - 0.2, 1.0, std({ color: '#203040', metalness: 0.5, roughness: 0.1, transparent: true, opacity: 0.6 }));
    gl.position.set(0, 1.5, 0.11); g.add(gl);
    for (let i = 0; i < 4; i++) { const p = cy(0.14, 0.14, 0.02, M.ceramic, -w / 2 + 0.3 + i * (w - 0.6) / 3, 1.62, 0.02, g, 16); p.rotation.x = Math.PI / 2 - 0.2; }
    bx(w + 0.1, 0.08, 0.55, M.woodDark, 0, 2.14, -0.05, g);
  },
  longTable(g) {
    F.table(g, 1.6, 5.6, 0.78, M.woodRed, M.cloth);
    for (const z of [-2, 0, 2]) {
      // 燭台
      cy(0.06, 0.1, 0.3, M.gold, 0, 0.98, z, g, 10);
      bx(0.5, 0.025, 0.025, M.gold, 0, 1.08, z, g);
      for (const x of [-0.25, 0, 0.25]) candle(g, x, 1.09 + (x === 0 ? 0.08 : 0), z, 0.8);
    }
    for (const z of [-2.4, -1.2, 1.2, 2.4]) for (const x of [-0.5, 0.5]) {
      const p = cy(0.15, 0.12, 0.02, M.ceramic, x, 0.84, z, g, 16);
      void p;
    }
  },
  counter(g, w) {
    bx(w, 0.88, 0.62, M.woodLight, 0, 0.44, 0, g);
    bx(w + 0.04, 0.05, 0.66, M.marble, 0, 0.9, 0, g);
    for (let x = -w / 2 + 0.4; x < w / 2; x += 0.6) sp(0.025, M.metal, x, 0.7, 0.32, g);
  },
  stove(g) {
    bx(1.1, 0.85, 0.7, M.iron, 0, 0.425, 0, g);
    bx(0.5, 0.3, 0.02, M.ember, 0, 0.35, 0.36, g);
    cy(0.1, 0.1, 1.6, M.iron, 0, 1.6, -0.2, g, 10);
    const pot = cy(0.22, 0.2, 0.28, M.metal, -0.25, 1.0, 0, g, 16); void pot;
    cy(0.16, 0.13, 0.12, M.iron, 0.28, 0.92, 0.05, g, 16);
    const L = new THREE.PointLight('#ff6a2a', 1.6, 4, 1.5);
    L.position.set(0, 0.4, 0.8); g.add(L);
    flickers.push({ light: L, base: 1.6, ph: 3 });
  },
  sink(g, w) {
    F.counter(g, w);
    const s = bx(0.7, 0.1, 0.45, M.metal, 0, 0.88, 0, g); void s;
    cy(0.02, 0.02, 0.3, M.metal, 0, 1.05, -0.24, g, 8);
  },
  barrel(g) {
    const b = cy(0.3, 0.3, 0.85, M.woodLight, 0, 0.425, 0, g, 14); b.scale.set(1, 1, 1);
    for (const y of [0.15, 0.7]) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.305, 0.02, 6, 20), M.iron); r.rotation.x = Math.PI / 2; r.position.y = y; g.add(r); }
  },
  crate(g) {
    bx(0.7, 0.6, 0.7, M.woodLight, 0, 0.3, 0, g);
    for (const s of [-1, 1]) bx(0.72, 0.06, 0.72, M.wood, 0, 0.3 + s * 0.25, 0, g);
  },
  kitchenTable(g) {
    F.table(g, 1.8, 1.1, 0.78, M.woodLight);
    sp(0.16, M.bread, -0.4, 0.88, 0, g, 1.5, 0.7, 1);
    sp(0.12, M.bread, -0.1, 0.87, 0.2, g, 1.3, 0.7, 1);
    cy(0.2, 0.15, 0.2, M.metal, 0.45, 0.92, -0.1, g, 16);
    sp(0.07, std({ color: '#c02a2a', roughness: 0.4 }), 0.2, 0.86, 0.3, g);
    sp(0.07, std({ color: '#c02a2a', roughness: 0.4 }), 0.32, 0.86, 0.36, g);
  },
  wallShelf(g, w) {
    bx(w, 1.6, 0.35, M.woodDark, 0, 0.8, 0, g);
    for (const y of [0.6, 1.1]) for (let i = 0; i < 4; i++) cy(0.08, 0.08, 0.2, i % 2 ? M.ceramic : M.pot, -w / 2 + 0.3 + i * (w - 0.6) / 3, y + 0.12, 0.05, g, 10);
    for (const y of [0.5, 1.0, 1.55]) bx(w, 0.04, 0.37, M.wood, 0, y, 0, g);
  },
  pedestal(g, bustMat) {
    cy(0.28, 0.32, 1.1, M.marble, 0, 0.55, 0, g, 12);
    bx(0.6, 0.08, 0.6, M.marble, 0, 1.12, 0, g);
    sp(0.17, bustMat, 0, 1.45, 0, g, 1, 1.2, 1);
    sp(0.2, bustMat, 0, 1.24, 0, g, 1.4, 0.5, 0.9);
  },
  candelabra(g) {
    cy(0.04, 0.22, 1.5, M.gold, 0, 0.75, 0, g, 10);
    bx(0.7, 0.03, 0.03, M.gold, 0, 1.5, 0, g);
    for (const x of [-0.33, 0, 0.33]) candle(g, x, 1.52, 0, 1.2);
  },
  bench(g) {
    bx(1.6, 0.08, 0.45, M.woodRed, 0, 0.45, 0, g);
    bx(1.5, 0.06, 0.4, M.red, 0, 0.51, 0, g);
    for (const sx of [-1, 1]) bx(0.08, 0.45, 0.4, M.woodRed, sx * 0.7, 0.22, 0, g);
  },
};

// ---------- 部屋ごとの家具 ----------
const FURNISH = {
  F(k) {
    k.rug(6.5, 6.5, 7, 6, T.rug('#6a1820', '#c9a34a', '#3a0c12'));
    k.put(2.2, 0.35, 0, F.clock, { solid: [0.7, 0.45], loot: { coin: 6 } });
    k.put(4.3, 0.6, 0, F.armor, { solid: [0.6, 0.5], loot: { coin: 3, heart: 1 } });
    k.put(8.7, 0.6, 0, F.armor, { solid: [0.6, 0.5], loot: { bill: 1 } });
    k.put(0.4, 2.5, 1, g => F.sideTable(g, true), { solid: [0.6, 0.45], loot: { coin: 4 } });
    k.put(12.6, 2.5, 3, g => F.sideTable(g, false), { solid: [0.6, 0.45], loot: { coin: 4 } });
    k.put(0.4, 9.8, 1, g => F.sideTable(g, false), { solid: [0.6, 0.45], loot: { heart: 1 } });
    k.put(12.6, 9.8, 3, g => F.sideTable(g, true), { solid: [0.6, 0.45], loot: { coin: 5 } });
    k.put(11.2, 0.6, 0, F.coatRack, { solid: [0.4, 0.4], loot: { bill: 1 } });
    k.put(0.7, 11.2, 0, F.plant, { solid: [0.5, 0.5], loot: { coin: 3 } });
    k.put(12.3, 11.2, 0, F.plant, { solid: [0.5, 0.5], loot: { gem: 1 } });
    k.put(6.5, 10.9, 2, F.bench, { solid: [1.6, 0.45] });
    k.wallN(10.0, 1.9, painting(1));
    k.wallN(1.0, 1.9, painting(2, 0.7, 0.9));
  },
  L(k) {
    k.rug(5.5, 6.5, 6, 5, T.rug('#1f3a28', '#b89a50', '#14261a'));
    k.put(1.6, 0.25, 0, g => F.shelf(g, 2.8), { solid: [2.8, 0.45], loot: { coin: 5 } });
    k.put(8.6, 0.25, 0, g => F.shelf(g, 2.8), { solid: [2.8, 0.45], loot: { bill: 1 } });
    k.put(10.75, 2.5, 3, g => F.shelf(g, 2.6), { solid: [2.6, 0.45], loot: { coin: 4 } });
    k.put(10.75, 6.2, 3, g => F.shelf(g, 2.6), { solid: [2.6, 0.45], loot: { gem: 1 } });
    k.put(10.75, 9.9, 3, g => F.shelf(g, 2.6), { solid: [2.6, 0.45], loot: { coin: 5 } });
    k.put(0.35, 3.0, 1, F.fireplace, { solid: [2.0, 0.6], loot: { coin: 4 } });
    k.put(5.5, 6.4, 1, g => { F.table(g, 2.4, 1.2, 0.78, M.woodRed); candle(g, 0.6, 0.82, 0.2); bx(0.5, 0.03, 0.35, M.cloth, -0.3, 0.83, 0, g); }, { solid: [2.4, 1.2], loot: { bill: 1 } });
    k.put(2.3, 3.0, 3, g => F.armchair(g, M.red), { solid: [0.8, 0.8], loot: { heart: 1 } });
    k.put(7.8, 10.0, 2, g => F.armchair(g, M.green), { solid: [0.8, 0.8], loot: { coin: 4 } });
    k.put(8.0, 2.8, 0, F.globe, { solid: [0.5, 0.5], loot: { coin: 3 } });
    k.put(1.2, 10.8, 0, F.bookStack, { loot: { coin: 2 }, rad: 0.6 });
    k.put(4.0, 10.9, 0, F.bookStack, { loot: { heart: 1 }, rad: 0.6 });
  },
  B(k) {
    k.rug(5.5, 6.0, 5, 4, T.rug('#3a2050', '#c8a0e0', '#26143a'));
    k.put(2.0, 1.4, 0, F.bed, { solid: [1.9, 2.5], loot: { bill: 2 } });
    k.put(3.6, 0.4, 0, F.nightstand, { solid: [0.5, 0.45], loot: { coin: 4 } });
    k.put(9.6, 0.45, 0, F.wardrobe, { solid: [1.5, 0.65], loot: { gem: 1 } });
    k.put(10.7, 4.8, 3, F.dresser, { solid: [1.4, 0.5], loot: { coin: 5 } });
    k.put(7.0, 6.0, 1, F.rockingChair, { solid: [0.6, 0.6], loot: { heart: 1 } });
    k.put(1.0, 8.6, 1, F.chest, { solid: [0.9, 0.55], loot: { coin: 8 } });
    k.put(10.4, 9.0, 0, F.plant, { solid: [0.5, 0.5], loot: { coin: 3 } });
    const w = k.wallN(6.4, 1.6, windowMesh(1.4, 1.8));
    const cm = std({ color: '#7a2a4a', roughness: 0.9, side: THREE.DoubleSide });
    k.put(6.4, 0.12, 0, g => { for (const s of [-1, 1]) { const c = curtain(g, 0.6, 2.4, cm); c.position.set(s * 0.95, 1.6, 0); } }, { loot: { bill: 1 }, rad: 1.2 });
    void w;
  },
  D(k) {
    k.put(5.5, 6.4, 0, F.longTable, { solid: [1.7, 5.7], loot: { coin: 8 } });
    for (const z of [4.4, 6.4, 8.4]) {
      k.put(4.3, z, 1, g => F.chair(g, M.woodRed, M.blue), { solid: [0.5, 0.5] });
      k.put(6.7, z, 3, g => F.chair(g, M.woodRed, M.blue), { solid: [0.5, 0.5] });
    }
    k.put(5.5, 2.9, 0, g => F.chair(g, M.woodRed, M.red), { solid: [0.5, 0.5], loot: { coin: 2 } });
    k.put(1.6, 0.3, 0, g => F.cabinet(g, 1.8), { solid: [1.8, 0.55], loot: { bill: 1 } });
    k.put(9.4, 0.3, 0, g => F.cabinet(g, 1.8), { solid: [1.8, 0.55], loot: { coin: 6 } });
    k.put(0.3, 6.4, 1, g => { F.counter(g, 2.2); candle(g, -0.6, 0.93, 0); candle(g, 0.6, 0.93, 0); }, { solid: [2.2, 0.62], loot: { heart: 1 } });
    k.put(0.7, 11.2, 0, F.plant, { solid: [0.5, 0.5], loot: { coin: 3 } });
    k.put(10.3, 11.2, 0, F.plant, { solid: [0.5, 0.5], loot: { gem: 1 } });
    k.wallN(5.5, 1.9, painting(3, 1.4, 1.0));
    k.wallW(10.0, 1.9, painting(4, 0.8, 1.0));
  },
  K(k) {
    k.put(1.9, 0.35, 0, g => F.counter(g, 3.4), { solid: [3.4, 0.65], loot: { coin: 4 } });
    k.put(5.7, 0.4, 0, F.stove, { solid: [1.1, 0.7], loot: { coin: 5 } });
    k.put(8.9, 0.35, 0, g => F.sink(g, 3.2), { solid: [3.2, 0.65], loot: { bill: 1 } });
    k.wallN(8.9, 1.85, windowMesh(1.2, 1.1));
    k.put(5.5, 5.0, 0, F.kitchenTable, { solid: [1.8, 1.1], loot: { heart: 1 } });
    k.put(0.25, 4.8, 1, g => F.wallShelf(g, 2.4), { solid: [2.4, 0.4], loot: { coin: 5 } });
    k.put(0.6, 8.5, 0, F.barrel, { solid: [0.6, 0.6], loot: { coin: 4 } });
    k.put(1.4, 9.3, 0, F.barrel, { solid: [0.6, 0.6], loot: { gem: 1 } });
    k.put(10.2, 8.3, 0, F.crate, { solid: [0.7, 0.7], loot: { bill: 1 } });
    k.put(9.3, 9.2, 0, F.crate, { solid: [0.7, 0.7], loot: { heart: 1 } });
    k.put(10.4, 4.0, 0, F.barrel, { solid: [0.6, 0.6], loot: { coin: 4 } });
  },
  G(k) {
    k.rug(6.5, 6.5, 2.6, 11.5, T.rug('#6a0c18', '#c9a34a', '#6a0c18'));
    decor.bossPortrait = k.wallN(6.5, 1.85, painting(98, 1.6, 2.0));
    k.wallN(2.4, 1.9, painting(0)); k.wallN(10.6, 1.9, painting(5));
    k.wallW(3.5, 1.9, painting(6, 0.8, 1.0)); k.wallW(8.5, 1.9, painting(7, 0.8, 1.0));
    k.wallE(3.5, 1.9, painting(8, 0.8, 1.0)); k.wallE(8.5, 1.9, painting(9, 0.8, 1.0));
    k.put(1.6, 2.6, 0, g => F.pedestal(g, M.marble), { solid: [0.6, 0.6], loot: { coin: 6 } });
    k.put(11.4, 2.6, 0, g => F.pedestal(g, M.gold), { solid: [0.6, 0.6], loot: { gem: 1 } });
    k.put(1.6, 9.2, 0, g => F.pedestal(g, M.stone), { solid: [0.6, 0.6], loot: { heart: 1 } });
    k.put(11.4, 9.2, 0, g => F.pedestal(g, M.marble), { solid: [0.6, 0.6], loot: { heart: 1 } });
    k.put(4.2, 0.5, 0, F.candelabra, { solid: [0.4, 0.4] });
    k.put(8.8, 0.5, 0, F.candelabra, { solid: [0.4, 0.4] });
  },
};
