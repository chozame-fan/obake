// 登場キャラ：主人公トトと、おばけたち（すべて図形で組み立て）
import * as THREE from 'three';
import * as T from './tex.js';

const std = (o) => new THREE.MeshStandardMaterial(o);

// ---------- 主人公：黄色いレインコートの見習いそうじ係「トト」 ----------
export function makePlayer() {
  const root = new THREE.Group();
  const body = new THREE.Group(); // 揺れる・傾く部分
  root.add(body);
  const coat = std({ color: '#f2c230', roughness: 0.45 });
  const coatDark = std({ color: '#c8961a', roughness: 0.5 });
  const skin = std({ color: '#f5d2b0', roughness: 0.7 });
  const boot = std({ color: '#c0392b', roughness: 0.4 });
  const tank = std({ color: '#5fa8a0', metalness: 0.5, roughness: 0.35 });
  const steel = std({ color: '#b8bcc4', metalness: 0.9, roughness: 0.25 });
  const dark = std({ color: '#222', roughness: 0.5 });

  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.24, 0.3, 6, 16), coat);
  torso.position.y = 0.62; torso.scale.set(1, 1, 0.9);
  body.add(torso);
  const hem = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.31, 0.2, 18), coat);
  hem.position.y = 0.42; body.add(hem);
  for (let i = 0; i < 3; i++) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6), coatDark);
    b.position.set(0, 0.78 - i * 0.12, 0.225); body.add(b);
  }
  const head = new THREE.Group();
  head.position.y = 1.08;
  body.add(head);
  const face = new THREE.Mesh(new THREE.SphereGeometry(0.22, 24, 18), skin);
  head.add(face);
  const hood = new THREE.Mesh(new THREE.SphereGeometry(0.255, 24, 18, 0, Math.PI * 2, 0, Math.PI * 0.62), coat);
  hood.rotation.x = -0.5; hood.position.set(0, 0.02, -0.04);
  head.add(hood);
  const brim = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.035, 8, 24, Math.PI * 1.25), coat);
  brim.rotation.set(-0.55, 0, Math.PI * -0.125 + Math.PI); brim.position.set(0, 0.08, 0.07);
  brim.rotation.z = Math.PI * 0.875;
  head.add(brim);
  const hair = std({ color: '#5a3018', roughness: 0.8 });
  const tuft = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), hair);
  tuft.position.set(0.02, 0.15, 0.13); tuft.scale.set(1.4, 0.5, 0.7); head.add(tuft);
  const eyeM = std({ color: '#1a1a22', roughness: 0.2 });
  const whiteM = new THREE.MeshBasicMaterial({ color: '#ffffff' });
  for (const s of [-1, 1]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.042, 12, 10), eyeM);
    e.position.set(s * 0.075, 0.01, 0.195); e.scale.set(0.85, 1.25, 0.5); head.add(e);
    const hl = new THREE.Mesh(new THREE.SphereGeometry(0.012, 6, 6), whiteM);
    hl.position.set(s * 0.075 - 0.012, 0.03, 0.215); head.add(hl);
    const ck = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), std({ color: '#f59a9a', roughness: 0.8, transparent: true, opacity: 0.7 }));
    ck.position.set(s * 0.13, -0.06, 0.16); ck.scale.set(1, 0.6, 0.4); head.add(ck);
  }
  const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.008, 6, 12, Math.PI), std({ color: '#7a2a2a' }));
  mouth.position.set(0, -0.08, 0.205); mouth.rotation.z = Math.PI; head.add(mouth);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6), skin);
  nose.position.set(0, -0.025, 0.22); head.add(nose);

  // うで（右手＝ノズル、左手＝ライト）
  const mkArm = (s) => {
    const sh = new THREE.Group();
    sh.position.set(s * 0.27, 0.86, 0);
    const a = new THREE.Mesh(new THREE.CapsuleGeometry(0.065, 0.26, 4, 10), coat);
    a.position.y = -0.17; sh.add(a);
    const h = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), std({ color: '#f0f0f0', roughness: 0.6 }));
    h.position.y = -0.36; sh.add(h);
    body.add(sh);
    return { sh, hand: h };
  };
  const armR = mkArm(-1), armL = mkArm(1);
  armR.sh.rotation.x = -1.2; armL.sh.rotation.x = -1.1;
  // ライト
  const torch = new THREE.Group();
  const tb = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.035, 0.22, 10), dark);
  tb.rotation.x = Math.PI / 2; torch.add(tb);
  const th = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.045, 0.06, 12), steel);
  th.rotation.x = Math.PI / 2; th.position.z = 0.13; torch.add(th);
  const lens = new THREE.Mesh(new THREE.CircleGeometry(0.05, 14), new THREE.MeshBasicMaterial({ color: '#d8d0a8' }));
  lens.position.z = 0.161; torch.add(lens);
  torch.position.set(0, -0.38, 0.04); torch.rotation.x = Math.PI / 2;
  armL.sh.add(torch);
  // 背中の掃除機タンク
  const pack = new THREE.Group();
  pack.position.set(0, 0.72, -0.3);
  body.add(pack);
  const tk = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.36, 6, 16), tank);
  pack.add(tk);
  for (const y of [-0.15, 0.15]) {
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.172, 0.02, 6, 20), steel);
    band.rotation.x = Math.PI / 2; band.position.y = y; pack.add(band);
  }
  const gauge = new THREE.Mesh(new THREE.CircleGeometry(0.06, 16), new THREE.MeshBasicMaterial({ color: '#7dffb0' }));
  gauge.position.set(0, 0.05, -0.172); gauge.rotation.y = Math.PI; pack.add(gauge);
  const motor = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 0.12, 14), steel);
  motor.position.y = 0.36; pack.add(motor);
  // ノズル（右手の先）
  const nozzle = new THREE.Group();
  const nz1 = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.36, 12), steel);
  nz1.rotation.x = Math.PI / 2; nz1.position.z = 0.14; nozzle.add(nz1);
  const nz2 = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.06, 0.16, 14, 1, true), std({ color: '#3a3a44', metalness: 0.6, roughness: 0.4, side: THREE.DoubleSide }));
  nz2.rotation.x = Math.PI / 2; nz2.position.z = 0.38; nozzle.add(nz2);
  const tip = new THREE.Object3D(); tip.position.z = 0.46; nozzle.add(tip);
  nozzle.position.set(-0.22, 0.62, 0.28);
  body.add(nozzle);
  // ホース（タンク→ノズル）を毎回作り直す
  const hoseMat = std({ color: '#3a3a44', roughness: 0.6 });
  const hose = new THREE.Mesh(new THREE.BufferGeometry(), hoseMat);
  body.add(hose);
  const legs = [];
  for (const s of [-1, 1]) {
    const hip = new THREE.Group();
    hip.position.set(s * 0.11, 0.36, 0);
    const lg = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.16, 4, 10), std({ color: '#3a4a6a' }));
    lg.position.y = -0.12; hip.add(lg);
    const bt = new THREE.Mesh(new THREE.CapsuleGeometry(0.085, 0.1, 4, 10), boot);
    bt.position.set(0, -0.28, 0.03); bt.rotation.x = Math.PI / 2; hip.add(bt);
    body.add(hip);
    legs.push(hip);
  }
  root.traverse(m => { if (m.isMesh) { m.castShadow = true; } });
  lens.castShadow = false;
  const shadow = blobShadow(0.42);
  root.add(shadow);

  const P = { root, body, head, armR, armL, torch, nozzle, tip, legs, hose, mouth, pack, gauge, walk: 0 };
  P.updateHose = () => {
    const a = new THREE.Vector3(-0.1, 0.55, -0.42);
    const b = new THREE.Vector3().copy(nozzle.position).add(new THREE.Vector3(0, 0, -0.04));
    const c1 = new THREE.Vector3(-0.35, 0.3, -0.35), c2 = new THREE.Vector3(-0.35, 0.4, 0.1);
    const curve = new THREE.CubicBezierCurve3(a, c1, c2, b);
    hose.geometry.dispose();
    hose.geometry = new THREE.TubeGeometry(curve, 12, 0.035, 6, false);
  };
  P.updateHose();
  return P;
}

export function blobShadow(r) {
  const s = new THREE.Mesh(new THREE.PlaneGeometry(r * 2, r * 2), new THREE.MeshBasicMaterial({
    map: SHADOW_TEX, transparent: true, depthWrite: false, opacity: 0.6,
  }));
  s.rotation.x = -Math.PI / 2; s.position.y = 0.012;
  s.renderOrder = 1;
  return s;
}
const SHADOW_TEX = T.glow('rgba(0,0,0,0.8)', 'rgba(0,0,0,0)');
export const GLOW_TEX = T.glow('rgba(255,255,255,1)', 'rgba(255,255,255,0)');

// ---------- おばけ ----------
export const GHOST_TYPES = {
  futsu: { name: 'ふわりん', color: '#c8ffe8', emissive: '#4affb0', size: 1.0, hp: 40, speed: 1.4, pull: 1.3, drain: 7, dmg: 8, money: [60, 120] },
  hayai: { name: 'ひゅるる', color: '#a8d8ff', emissive: '#3aa0ff', size: 0.8, hp: 50, speed: 3.0, pull: 1.7, drain: 7, dmg: 10, money: [80, 150] },
  chikara: { name: 'ドスコイ', color: '#ffb0a0', emissive: '#ff4a2a', size: 1.35, hp: 90, speed: 1.1, pull: 2.4, drain: 6, dmg: 20, money: [150, 250] },
  boss: { name: 'ヨルノスケ伯爵', color: '#d0b0ff', emissive: '#9a4aff', size: 2.4, hp: 260, speed: 1.4, pull: 2.8, drain: 5, dmg: 15, money: [3000, 3000] },
};

const FACES = {};
function faceTex(k) { return FACES[k] ||= T.ghostFace(k); }

// 下のすそがゆらゆらする体（シェーダーで動かす）
function ghostBodyMaterial(type) {
  const m = std({
    color: new THREE.Color(type.color).multiplyScalar(0.42), emissive: type.emissive, emissiveIntensity: 0.3,
    roughness: 0.35, transparent: true, opacity: 0.86, side: THREE.DoubleSide,
  });
  m.userData.time = { value: 0 };
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = m.userData.time;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        float bm = smoothstep(-0.05, -0.55, position.y);
        float ang = atan(position.z, position.x);
        transformed.y += sin(ang * 7.0 + uTime * 3.0) * 0.07 * bm;
        transformed.xz *= 1.0 + 0.07 * sin(position.y * 9.0 - uTime * 5.0) * bm;
        transformed.x += sin(uTime * 2.3 + position.y * 3.0) * 0.05 * bm;`);
  };
  return m;
}

// 頭が丸く、下が広がった形
function ghostBodyGeometry() {
  const pts = [];
  for (let i = 0; i <= 12; i++) {
    const a = i / 12 * Math.PI / 2;
    pts.push(new THREE.Vector2(Math.sin(a) * 0.45, 0.1 + Math.cos(a) * 0.45));
  }
  pts.push(new THREE.Vector2(0.45, -0.1));
  pts.push(new THREE.Vector2(0.47, -0.3));
  pts.push(new THREE.Vector2(0.53, -0.5));
  pts.push(new THREE.Vector2(0.56, -0.6));
  return new THREE.LatheGeometry(pts, 40);
}
const BODY_GEO = ghostBodyGeometry();
const FACE_GEO = new THREE.SphereGeometry(0.462, 24, 16, Math.PI / 2 - 0.85, 1.7, 0.5, 1.25);
FACE_GEO.translate(0, 0.1, 0);

export function makeGhost(kind) {
  const type = GHOST_TYPES[kind];
  const root = new THREE.Group();
  const inner = new THREE.Group(); // ふわふわ上下・向き
  root.add(inner);
  const s = type.size;
  inner.scale.setScalar(s);
  const mat = ghostBodyMaterial(type);
  const body = new THREE.Mesh(BODY_GEO, mat);
  inner.add(body);
  const faceMat = new THREE.MeshBasicMaterial({ map: faceTex(kind === 'boss' ? 'boss' : 'normal'), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
  const face = new THREE.Mesh(FACE_GEO, faceMat);
  face.renderOrder = 3;
  inner.add(face);
  // うで
  const arms = [];
  const armMat = mat.clone(); armMat.onBeforeCompile = () => {};
  armMat.side = THREE.FrontSide;
  for (const sd of [-1, 1]) {
    const a = new THREE.Mesh(new THREE.SphereGeometry(kind === 'chikara' ? 0.17 : 0.11, 12, 10), armMat);
    a.position.set(sd * 0.5, -0.05, 0.12);
    inner.add(a);
    arms.push(a);
  }
  if (kind === 'boss') {
    const gold = std({ color: '#e8c84a', metalness: 0.9, roughness: 0.25, emissive: '#6a4a00', emissiveIntensity: 0.5 });
    const crown = new THREE.Group();
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.24, 0.1, 20, 1, true), gold);
    band.material.side = THREE.DoubleSide;
    crown.add(band);
    for (let i = 0; i < 5; i++) {
      const sp = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.16, 6), gold);
      const a = i / 5 * Math.PI * 2;
      sp.position.set(Math.cos(a) * 0.22, 0.12, Math.sin(a) * 0.22);
      crown.add(sp);
      const gem = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6), new THREE.MeshBasicMaterial({ color: '#ff3a6a' }));
      gem.position.set(Math.cos(a) * 0.235, 0.01, Math.sin(a) * 0.235);
      crown.add(gem);
    }
    crown.position.y = 0.58; crown.rotation.z = 0.12;
    inner.add(crown);
    // マント
    const cape = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.6, 0.85, 24, 1, true, Math.PI * 0.6, Math.PI * 0.8),
      std({ color: '#3a0a4a', roughness: 0.6, side: THREE.DoubleSide, emissive: '#1a0020', emissiveIntensity: 0.4 }));
    cape.position.set(0, -0.12, -0.04);
    cape.rotation.y = Math.PI;
    inner.add(cape);
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.05, 6, 24, Math.PI), std({ color: '#c02040', roughness: 0.6 }));
    collar.rotation.x = Math.PI / 2; collar.rotation.z = Math.PI; collar.position.y = 0.2;
    inner.add(collar);
  }
  // 光のにじみ
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW_TEX, color: type.emissive, transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending }));
  halo.scale.setScalar(2.0 * s);
  root.add(halo);
  const shadow = blobShadow(0.5 * s);
  root.add(shadow);
  return {
    kind, type, root, inner, body, face, faceMat, arms, halo, shadow, mat, armMat,
    setFace(k) { const t = faceTex(k); if (faceMat.map !== t) { faceMat.map = t; faceMat.needsUpdate = true; } },
    setAlpha(a) {
      mat.opacity = 0.86 * a; armMat.opacity = 0.86 * a; faceMat.opacity = a; halo.material.opacity = 0.22 * a; shadow.material.opacity = 0.5 * a;
      root.visible = a > 0.01;
    },
  };
}
