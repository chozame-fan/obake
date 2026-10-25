// 屋敷の間取り：1マス=1m。部屋・とびら・当たり判定
export const W = 39, H = 27;
export const WALL_H = 3.2;

// x0..x1, z0..z1 は床のマス（両端を含む）
export const ROOMS = [
  { id: 'F', name: '玄関ホール', x0: 13, x1: 25, z0: 14, z1: 25,
    ghosts: ['futsu', 'futsu'], key: 'L' },
  { id: 'L', name: '図書室', x0: 27, x1: 37, z0: 12, z1: 23,
    ghosts: ['futsu', 'hayai', 'futsu'], key: 'B' },
  { id: 'B', name: '寝室', x0: 27, x1: 37, z0: 1, z1: 10,
    ghosts: ['hayai', 'futsu', 'hayai'], key: 'D' },
  { id: 'D', name: '食堂', x0: 1, x1: 11, z0: 12, z1: 23,
    ghosts: ['chikara', 'futsu', 'futsu'], key: 'K' },
  { id: 'K', name: '台所', x0: 1, x1: 11, z0: 1, z1: 10,
    ghosts: ['chikara', 'hayai', 'chikara'], key: 'G' },
  { id: 'G', name: '肖像画の間', x0: 13, x1: 25, z0: 1, z1: 12,
    ghosts: ['boss'], key: null },
];
export const ROOM = Object.fromEntries(ROOMS.map((r, i) => [r.id, Object.assign(r, { index: i })]));

// とびら：key＝開けるのに必要なカギ（部屋をクリアすると手に入る）
export const DOORS = [
  { id: 'FL', cells: [[26, 19], [26, 20]], rooms: ['F', 'L'], key: 'L' },
  { id: 'LB', cells: [[31, 11], [32, 11]], rooms: ['L', 'B'], key: 'B' },
  { id: 'FD', cells: [[12, 19], [12, 20]], rooms: ['F', 'D'], key: 'D' },
  { id: 'DK', cells: [[5, 11], [6, 11]], rooms: ['D', 'K'], key: 'K' },
  { id: 'FG', cells: [[18, 13], [19, 13], [20, 13]], rooms: ['F', 'G'], key: 'G' },
];
export const KEY_NAME = { L: '図書室のカギ', B: '寝室のカギ', D: '食堂のカギ', K: '台所のカギ', G: '肖像画の間のカギ' };
export const KEY_COLOR = { L: '#5fd38a', B: '#c88aff', D: '#5fb0ff', K: '#ffb04a', G: '#ff5a7a' };

// 0=壁 1=床 2=とびら
export const grid = [];
export const roomAt = [];
export const doorAt = [];
for (let z = 0; z < H; z++) {
  grid.push(new Array(W).fill(0));
  roomAt.push(new Array(W).fill(-1));
  doorAt.push(new Array(W).fill(null));
}
for (const r of ROOMS) {
  for (let z = r.z0; z <= r.z1; z++) for (let x = r.x0; x <= r.x1; x++) {
    grid[z][x] = 1; roomAt[z][x] = r.index;
  }
}
for (const d of DOORS) {
  d.open = 0; // 0〜1 開き具合
  d.locked = true; // カギがかかっている
  d.battle = false; // 戦い中で閉じている
  for (const [x, z] of d.cells) { grid[z][x] = 2; doorAt[z][x] = d; }
  const xs = d.cells.map(c => c[0]), zs = d.cells.map(c => c[1]);
  d.vertical = xs[0] === xs[xs.length - 1]; // 縦の壁（x一定）にあるとびら
  d.cx = (Math.min(...xs) + Math.max(...xs) + 1) / 2 - W / 2;
  d.cz = (Math.min(...zs) + Math.max(...zs) + 1) / 2 - H / 2;
  d.width = d.cells.length;
}

export const cellX = wx => Math.floor(wx + W / 2);
export const cellZ = wz => Math.floor(wz + H / 2);
export const worldX = x => x - W / 2 + 0.5;
export const worldZ = z => z - H / 2 + 0.5;

export function roomBounds(r) {
  return { minX: r.x0 - W / 2, maxX: r.x1 + 1 - W / 2, minZ: r.z0 - H / 2, maxZ: r.z1 + 1 - H / 2,
    cx: (r.x0 + r.x1 + 1) / 2 - W / 2, cz: (r.z0 + r.z1 + 1) / 2 - H / 2,
    w: r.x1 - r.x0 + 1, d: r.z1 - r.z0 + 1 };
}
for (const r of ROOMS) r.b = roomBounds(r);

export function roomOfPoint(wx, wz) {
  const x = cellX(wx), z = cellZ(wz);
  if (x < 0 || z < 0 || x >= W || z >= H) return null;
  const i = roomAt[z][x];
  return i >= 0 ? ROOMS[i] : null;
}

export function solidCell(x, z) {
  if (x < 0 || z < 0 || x >= W || z >= H) return true;
  const g = grid[z][x];
  if (g === 0) return true;
  if (g === 2) { const d = doorAt[z][x]; return d.open < 0.95; }
  return false;
}

// 家具などの当たり（ワールド座標の箱）
export const boxes = [];

// 円を壁・家具から押し出す
export function collide(p, r) {
  for (let it = 0; it < 3; it++) {
    const cx = cellX(p.x), cz = cellZ(p.z);
    for (let z = cz - 1; z <= cz + 1; z++) for (let x = cx - 1; x <= cx + 1; x++) {
      if (!solidCell(x, z)) continue;
      pushOut(p, r, x - W / 2, z - H / 2, x + 1 - W / 2, z + 1 - H / 2);
    }
    for (const b of boxes) {
      if (p.x + r < b.minX || p.x - r > b.maxX || p.z + r < b.minZ || p.z - r > b.maxZ) continue;
      pushOut(p, r, b.minX, b.minZ, b.maxX, b.maxZ);
    }
  }
}
function pushOut(p, r, x0, z0, x1, z1) {
  const nx = Math.max(x0, Math.min(p.x, x1));
  const nz = Math.max(z0, Math.min(p.z, z1));
  let dx = p.x - nx, dz = p.z - nz;
  const d2 = dx * dx + dz * dz;
  if (d2 >= r * r) return;
  if (d2 < 1e-8) {
    // 中心が箱の中：一番近い辺へ出す
    const opts = [[p.x - x0, -1, 0], [x1 - p.x, 1, 0], [p.z - z0, 0, -1], [z1 - p.z, 0, 1]];
    opts.sort((a, b) => a[0] - b[0]);
    const [m, sx, sz] = opts[0];
    p.x += sx * (m + r); p.z += sz * (m + r);
    return;
  }
  const d = Math.sqrt(d2);
  p.x += dx / d * (r - d); p.z += dz / d * (r - d);
}

// 2点の間に壁があるか（ライトの光が届くか）
export function lineClear(ax, az, bx, bz) {
  const d = Math.hypot(bx - ax, bz - az);
  const n = Math.ceil(d / 0.25);
  for (let i = 1; i < n; i++) {
    const t = i / n;
    if (solidCell(cellX(ax + (bx - ax) * t), cellZ(az + (bz - az) * t))) return false;
  }
  return true;
}

// 壁を低くする（カメラ側の壁を切る）とき、どの部屋に属するか：
// その壁のマスから北（奥）へ壁だけをたどって最初に当たる床の部屋
export function cutRoomOf(x, z) {
  for (let k = z - 1; k >= 0; k--) {
    const g = grid[k][x];
    if (g === 1) return ROOMS[roomAt[k][x]].id;
    if (g === 2) return null;
  }
  return null;
}
