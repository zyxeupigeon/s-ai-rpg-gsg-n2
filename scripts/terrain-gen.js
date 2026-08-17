#!/usr/bin/env node
// terrain-gen.js — 为 map.json 生成地形格（terrain 数组）并输出面积/地点构成统计
//
// 用法:  node scripts/terrain-gen.js          （读 map.json，写入 terrain，输出统计表）
//        node scripts/terrain-gen.js --dry    （只输出统计，不写入）
//
// 地貌定义见 REGIONS：区域型用 rect [x0,y0,x1,y1]（含边界），隔断型可用 path 点序列（每点 1 格）。
// 每格 = scaleKmPerCell × scaleKmPerCell km²。优先级=数组顺序（先定义者优先）。

const fs = require('fs');
const path = require('path');

const DRY = process.argv.includes('--dry');
const idx = process.argv.indexOf('--map');
const MAP = path.resolve(idx >= 0 ? process.argv[idx + 1] : 'map.json');
const m = JSON.parse(fs.readFileSync(MAP, 'utf8'));
const CELL = m.meta.scaleKmPerCell || 20;
const AREA = CELL * CELL; // km² / 格

// ---------- 地貌定义（世界内命名，类型值对齐 geo.js terrainCost key） ----------
// 优先级 = 数组顺序（先定义者优先）；海/山/河/沼 在前，森林/丘陵 居中，平原 最后
const REGIONS = [
  // 隔断型
  { id: 'west-sea', name: '西海', type: 'sea', rect: [0, 8, 3, 45] },
  { id: 'fjord-sea', name: '峡湾海', type: 'sea', rect: [26, 90, 44, 92] },
  { id: 'white-stone-mountains', name: '白石山脉', type: 'mountain', rect: [28, 7, 50, 10] },
  { id: 'white-stone-river', name: '白石河（界河）', type: 'river', rect: [28, 11, 52, 11] },
  { id: 'zhu-shu-river', name: '椴树河', type: 'river', path: [[20, 21], [21, 19], [23, 18], [25, 17]] },
  { id: 'shu-river', name: '戍河（东境大河）', type: 'river', rect: [84, 12, 88, 48] },
  { id: 'east-swamp', name: '东境泥沼', type: 'swamp', rect: [70, 15, 80, 45] },
  { id: 'scourge-wasteland', name: '蚀荒', type: 'swamp', rect: [89, 15, 100, 48] },
  // 区域型（森林/丘陵/山地）
  { id: 'north-taiga', name: '北境针叶林', type: 'forest', rect: [25, 78, 50, 92] },
  { id: 'wald-forest', name: '瓦德森林', type: 'forest', rect: [20, 22, 37, 50] },
  { id: 'linden-hill', name: '椴树丘地', type: 'hill', rect: [18, 17, 28, 23] },
  { id: 'hagen-valley', name: '上游河谷', type: 'plain', rect: [14, 20, 19, 24] },
  { id: 'dwarf-mountains', name: '山民山地', type: 'mountain', rect: [45, 60, 65, 80] },
  { id: 'east-hill-pasture', name: '东丘牧场', type: 'hill', rect: [45, 26, 70, 42] },
  { id: 'west-cliff-hill', name: '西岸崖丘', type: 'hill', rect: [2, 18, 10, 32] },
  { id: 'kalden-hill', name: '东南丘陵', type: 'hill', rect: [55, 0, 78, 14] },
  // 区域型（平原）
  { id: 'velen-lowland', name: '维伦低地', type: 'plain', rect: [30, 0, 60, 6] },
  { id: 'south-lowland', name: '南部低地', type: 'plain', rect: [30, 15, 55, 32] },
  { id: 'southwest-plain', name: '西南原野', type: 'plain', rect: [3, 14, 15, 26] },
  { id: 'north-pasture', name: '北境牧场', type: 'plain', rect: [28, 44, 52, 77] },
  { id: 'west-wine-plain', name: '西境酒乡', type: 'plain', rect: [12, 28, 28, 42] },
];

// ---------- 判定：格点 (x,y) 属于哪个地貌 ----------
function regionAt(x, y) {
  for (const r of REGIONS) {
    if (r.rect) {
      const [x0, y0, x1, y1] = r.rect;
      if (x >= x0 && x <= x1 && y >= y0 && y <= y1) return r;
    }
    if (r.path) {
      if (r.path.some(([px, py]) => px === x && py === y)) return r;
    }
  }
  return null;
}

// ---------- 面积统计（全格，不采样） ----------
console.log('=== 地貌面积（每格 ' + AREA + ' km²）===');
const counts = {};
for (const r of REGIONS) counts[r.id] = 0;
for (let x = 0; x <= 100; x++) {
  for (let y = 0; y <= 92; y++) {
    const r = regionAt(x, y);
    if (r) counts[r.id]++;
  }
}
for (const r of REGIONS) {
  console.log(`  ${r.name}（${r.type}）: ${counts[r.id]} 格 ≈ ${(counts[r.id] * AREA / 1000).toFixed(0)} 千km²`);
}

// ---------- 地点辖区地形构成 ----------
const CITY_SPAN = 2, TOWN_SPAN = 1; // 城市 ±2 格（5×5），领地/集镇 ±1 格（3×3）
const CITY_TYPES = new Set(['城市', '关隘']);
function spanOf(loc) { return CITY_TYPES.has(loc.type) ? CITY_SPAN : TOWN_SPAN; }

console.log('\n=== 地点 × 地形构成（辖区 = 以坐标为中心 ±span 格）===');
const comp = {};
for (const loc of m.locations) {
  const s = spanOf(loc);
  const t = {};
  let n = 0;
  for (let dx = -s; dx <= s; dx++) for (let dy = -s; dy <= s; dy++) {
    const r = regionAt(loc.x + dx, loc.y + dy);
    const key = r ? r.type : '未定义';
    t[key] = (t[key] || 0) + 1; n++;
  }
  comp[loc.name] = t;
  const parts = Object.entries(t).sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `${k}${Math.round(v / n * 100)}%`).join('、');
  console.log(`  ${loc.name}: ${parts}`);
}

// ---------- 写入 terrain（采样：区域型每 4 格一点；path 河全写） ----------
if (DRY) { console.log('\n(--dry 未写入)'); process.exit(0); }

const terrain = [];
for (let x = 0; x <= 100; x += 4) {
  for (let y = 0; y <= 92; y += 4) {
    const r = regionAt(x, y);
    if (r) terrain.push({ x, y, terrain: r.type, controllerId: null, region: r.name });
  }
}
for (const r of REGIONS) {
  if (!r.path) continue;
  for (const [px, py] of r.path) terrain.push({ x: px, y: py, terrain: r.type, controllerId: null, region: r.name });
}
// 去重
const seen = new Set();
const uniq = terrain.filter((t) => {
  const k = `${t.x},${t.y}`;
  if (seen.has(k)) return false;
  seen.add(k);
  return true;
});

m.terrain = uniq;
fs.writeFileSync(MAP, JSON.stringify(m, null, 2));
console.log(`\n已写入 ${uniq.length} 个地形采样格到 map.json（terrain 数组，含 region 名称标注）`);
