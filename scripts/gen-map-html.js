#!/usr/bin/env node
// gen-map-html.js — 读 map.json 生成单文件 HTML（内嵌 SVG）可视化地图 map.html
//
// 用法:  node scripts/gen-map-html.js [--map <file>] [--out <file>]
//
// 表达内容：
//   1. 区域型地貌 —— terrain 采样格按 region 聚合为色块（rect），并沿外轮廓描边（闭合线圈）
//   2. 隔断型地貌 —— river 格画河床淡蓝 + 中心深蓝 polyline（河源端小圆点）；窄山脉画山脊线
//   3. 地点 —— 按类型分级圆点/三角 + 名称标签（字号随级别）
//   4. 可通行路径 —— routes 官道实线/乡道细线
//   附加：标题、图例、比例尺（1 格 = 5 km）
// 面积假设（输出声明）：城市≈200km²（8格）、关隘/领地≈100km²（4格）、集镇≈50km²（2格）

const fs = require('fs');
const path = require('path');

const idx = process.argv.indexOf('--map');
const MAP = path.resolve(idx >= 0 ? process.argv[idx + 1] : 'map.json');
const oi = process.argv.indexOf('--out');
const OUT = path.resolve(oi >= 0 ? process.argv[oi + 1] : 'map.html');
const m = JSON.parse(fs.readFileSync(MAP, 'utf8'));
const KM = m.meta.scaleKmPerCell || 5;

const X1 = 100, Y1 = 92; // 地图范围（含边界）

// ---------- 颜色 ----------
const C = {
  sea: '#9cc4dd', swamp: '#a58f6f', plain: '#d6e4c3', forest: '#7fa05c',
  hill: '#c9a86c', mountain: '#9a8672', river: '#4a7fb5',
  land: '#e8e4d8', outline: '#556'
};
const NAME_CN = { sea: '海洋', swamp: '沼泽/荒野', plain: '平原', forest: '森林', hill: '丘陵', mountain: '山脉', river: '河流' };

// ---------- 1. 区域色块（按 region 聚合；river 单独处理） ----------
const byRegion = {};
for (const t of m.terrain) {
  if (t.terrain === 'river') continue;
  (byRegion[t.region] ||= []).push(t);
}

const S = 4; // 采样格边长（步长 4）
const blocks = [];   // {region,name,type,x,y,areaCells}
const edges = [];    // {region,x1,y1,x2,y2}
const regMeta = {};
for (const [region, cells] of Object.entries(byRegion)) {
  const type = cells[0].terrain;
  const set = new Set(cells.map((c) => `${c.x},${c.y}`));
  let areaCells = 0;
  for (const c of cells) {
    const cx = c.x, cy = c.y;
    blocks.push({ region, type, x: cx, y: cy, w: S, h: S });
    areaCells += S * S;
    // 四边描边：相邻（±S）同 region 则不描
    for (const [dx, dy, ex1, ey1, ex2, ey2] of [
      [-S, 0, cx, cy, cx, cy + S], [S, 0, cx + S, cy, cx + S, cy + S],
      [0, -S, cx, cy, cx + S, cy], [0, S, cx, cy + S, cx + S, cy + S],
    ]) {
      if (!set.has(`${cx + dx},${cy + dy}`)) edges.push({ region, x1: ex1, y1: ey1, x2: ex2, y2: ey2 });
    }
  }
  regMeta[region] = { name: region, type, areaCells };
}

// ---------- 2. 河流（河床 + 中心线） ----------
const riverCells = m.terrain.filter((t) => t.terrain === 'river');
const riverByRegion = {};
for (const t of riverCells) (riverByRegion[t.region] ||= []).push(t);

function riverLine(cells) {
  if (cells.every((c) => c.y === cells[0].y)) {
    const y = cells[0].y + 0.5, xs = cells.map((c) => c.x).sort((a, b) => a - b);
    return [[xs[0] + 0.5, y], [xs[xs.length - 1] + 0.5, y]];
  }
  if (cells.every((c) => c.x === cells[0].x)) {
    const x = cells[0].x + 0.5, ys = cells.map((c) => c.y).sort((a, b) => a - b);
    return [[x, ys[0] + 0.5], [x, ys[ys.length - 1] + 0.5]];
  }
  return cells.sort((a, b) => a.x - b.x).map((c) => [c.x + 0.5, c.y + 0.5]);
}

// ---------- 3. 地点分级 ----------
const MARK = { 城市: 'circle', 关隘: 'square', 领地: 'circle', 集镇: 'circle', 森林: 'tri', 荒野: 'tri', 山脉: 'tri' };
const RADIUS = { 城市: 1.7, 关隘: 1.2, 领地: 1.15, 集镇: 0.75, 森林: 1.0, 荒野: 1.0, 山脉: 1.0 };
const FSIZE = { 城市: 1.5, 关隘: 1.1, 领地: 1.15, 集镇: 0.95, 森林: 0.95, 荒野: 0.95, 山脉: 0.95 };
const AREA_ASSUME = { 城市: '约200km²', 关隘: '约100km²', 领地: '约100km²', 集镇: '约50km²', 森林: '区域地貌', 荒野: '区域地貌', 山脉: '区域地貌' };

// ---------- 拼 SVG ----------
const parts = [];
// viewBox：地图 (0,0,100,92) 居中，四周留白放标题/图例/比例尺
parts.push(`<svg viewBox="-14 -20 158 132" xmlns="http://www.w3.org/2000/svg" font-family="Georgia,'Times New Roman',serif">`);

// 底图（未定义地形）
parts.push(`<rect x="0" y="0" width="100" height="92" fill="${C.land}"/>`);

// 主图形组（y 翻转：SVG y = 92 - map y）
parts.push(`<g transform="scale(1,-1) translate(0,-${Y1})">`);

// 绘制顺序：海洋 → 沼泽 → 平原 → 森林 → 丘陵 → 山脉
const ORDER = ['sea', 'swamp', 'plain', 'forest', 'hill', 'mountain'];
const regionsByType = {};
for (const r of Object.keys(regMeta)) (regionsByType[regMeta[r].type] ||= []).push(r);
for (const type of ORDER) {
  for (const region of regionsByType[type] || []) {
    const meta = regMeta[region];
    const cellFill = `${C[type]}`;
    const cellStroke = type === 'sea' ? 'none' : C[type];
    for (const b of blocks) {
      if (b.region !== region) continue;
      parts.push(`<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" fill="${cellFill}" stroke="${cellStroke}" stroke-width="0.05"><title>${region} · ${NAME_CN[type]} · 约 ${Math.round(meta.areaCells * KM * KM / 1000)} 千km² · ${meta.areaCells} 格</title></rect>`);
    }
    // 外轮廓描边（闭合线圈）
    const es = edges.filter((e) => e.region === region);
    if (es.length) {
      // 简单轮廓：所有外缘段合并为一条 path（M 线段拼接）
      const d = es.map((e) => `M${e.x1} ${e.y1} L${e.x2} ${e.y2}`).join(' ');
      parts.push(`<path d="${d}" fill="none" stroke="${C[type]}" stroke-width="0.35" opacity="0.9"/>`);
    }
  }
}

// 河床（半透明）+ 中心线
for (const [region, cells] of Object.entries(riverByRegion)) {
  for (const c of cells) {
    parts.push(`<rect x="${c.x}" y="${c.y}" width="1" height="1" fill="${C.river}" opacity="0.35"/>`);
  }
  const line = riverLine(cells);
  if (line.length >= 2) {
    const d = line.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x} ${y}`).join(' ');
    parts.push(`<path d="${d}" fill="none" stroke="${C.river}" stroke-width="0.55" stroke-linecap="round"><title>${region}</title></path>`);
    // 河源端小圆点
    parts.push(`<circle cx="${line[0][0]}" cy="${line[0][1]}" r="0.3" fill="${C.river}"/>`);
  }
}

// 白石山脉山脊线（窄山脉）
const ws = riverByRegion ? riverByRegion : {};
{
  const mts = byRegion['白石山脉'];
  if (mts) {
    const ys = mts.map((c) => c.y), yMid = Math.round(ys.reduce((a, b) => a + b, 0) / ys.length) + 0.5;
    const xs = mts.map((c) => c.x).sort((a, b) => a - b);
    const d = `M${xs[0] + 0.5} ${yMid} L${xs[xs.length - 1] + 0.5} ${yMid}`;
    parts.push(`<path d="${d}" fill="none" stroke="#6b5a48" stroke-width="0.5" stroke-dasharray="1.2 0.8"><title>白石山脉 · 山脊</title></path>`);
  }
}

// 路线（官道实线粗、乡道细线）
for (const r of m.routes) {
  const a = m.locations.find((l) => l.id === r.from), b = m.locations.find((l) => l.id === r.to);
  if (!a || !b) continue;
  const w = r.group === '官道' ? 0.35 : 0.18;
  const color = r.group === '官道' ? '#5a4a3a' : '#8a7a6a';
  const dash = r.group === '官道' ? '' : '';
  parts.push(`<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="${color}" stroke-width="${w}"${dash ? ` stroke-dasharray="${dash}"` : ''}><title>${a.name} ↔ ${b.name} · ${r.lengthKm} km · ${r.group}</title></line>`);
}

// 地点标记
for (const loc of m.locations) {
  const t = loc.type;
  const mark = MARK[t] || 'circle';
  const r = RADIUS[t] || 0.7;
  const fill = mark === 'tri' ? '#666' : '#3a3a3a';
  let el;
  if (mark === 'circle') el = `<circle cx="${loc.x}" cy="${loc.y}" r="${r}" fill="${fill}" stroke="#fff" stroke-width="0.25"/>`;
  else if (mark === 'square') el = `<rect x="${loc.x - r * 0.8}" y="${loc.y - r * 0.8}" width="${r * 1.6}" height="${r * 1.6}" fill="${fill}" stroke="#fff" stroke-width="0.25"/>`;
  else el = `<polygon points="${loc.x},${loc.y + r} ${loc.x - r},${loc.y - r} ${loc.x + r},${loc.y - r}" fill="${fill}" stroke="#fff" stroke-width="0.2"/>`;
  parts.push(`${el}<title>${loc.name} · ${t} · ${AREA_ASSUME[t]}</title>`);
}
parts.push(`</g>`);

// 地点名称标签（SVG 坐标，不翻转；带碰撞规避：右→左→上→下→四斜角）
parts.push(`<g fill="#222">`);
const SHORT = { 'protagonist-domain': '林德霍姆', 'dwarf-mine-town': '山民矿镇', 'east-march': '东境戍关', 'west-harbor': '西港', 'dwarf-mount': '山民山地' };
const placed = [];
for (const loc of m.locations) {
  const t = loc.type;
  const name = SHORT[loc.id] || loc.name;
  const fs = FSIZE[t] || 1.0;
  const w = name.length * fs * 0.95; // 宽度估计
  const isTri = MARK[t] === 'tri';
  const dy0 = fs * 0.35;
  const tries = [
    { dx: (isTri ? 1.6 : 2.2), dy: dy0, anchor: 'start' },                // 右
    { dx: -(isTri ? 1.6 : 2.2) - w, dy: dy0, anchor: 'end' },             // 左
    { dx: -w / 2, dy: -0.9, anchor: 'middle' },                           // 上
    { dx: -w / 2, dy: fs + 1.5, anchor: 'middle' },                       // 下
    { dx: (isTri ? 1.6 : 2.2), dy: -0.9, anchor: 'start' },               // 右上
    { dx: (isTri ? 1.6 : 2.2), dy: fs + 1.5, anchor: 'start' },           // 右下
    { dx: -(isTri ? 1.6 : 2.2) - w, dy: -0.9, anchor: 'end' },            // 左上
    { dx: -(isTri ? 1.6 : 2.2) - w, dy: fs + 1.5, anchor: 'end' },        // 左下
  ];
  let chosen = tries[0];
  for (const t2 of tries) {
    const bx = loc.x + t2.dx, by = Y1 - loc.y + t2.dy;
    const box = { x1: Math.min(bx, bx + w) - 0.4, x2: Math.max(bx, bx + w) + 0.4, y1: by - fs - 0.4, y2: by + 0.6 };
    const conflict = placed.some((p) => !(box.x2 < p.x1 || box.x1 > p.x2 || box.y2 < p.y1 || box.y1 > p.y2));
    if (!conflict) { chosen = t2; placed.push(box); break; }
  }
  if (chosen === tries[0]) {
    const bx = loc.x + chosen.dx, by = Y1 - loc.y + chosen.dy;
    placed.push({ x1: bx, x2: bx + w, y1: by - fs, y2: by });
  }
  parts.push(`<text x="${loc.x + chosen.dx}" y="${Y1 - loc.y + chosen.dy}" font-size="${fs}" fill="#1c1c1c" stroke="#fff" stroke-width="0.35" paint-order="stroke" text-anchor="${chosen.anchor}">${name}</text>`);
}
parts.push(`</g>`);

// 图例（地图右侧留白区，不遮挡地图）
const LX = 104, LY0 = -16, LH = 4.6;
parts.push(`<g font-size="1.6" fill="#1c1c1c">`);
parts.push(`<rect x="${LX - 2}" y="${LY0 - 2}" width="37" height="${LH * 9 + 3.5}" fill="#fdfbf4" stroke="#999" stroke-width="0.35" rx="1"/>`);
let ly = LY0;
parts.push(`<text x="${LX}" y="${ly}" font-size="2.0" font-weight="bold">图例</text>`); ly += LH;
for (const type of ORDER) {
  parts.push(`<rect x="${LX}" y="${ly - 1.1}" width="2.6" height="2.1" fill="${C[type]}" stroke="#666" stroke-width="0.15"/>`);
  parts.push(`<text x="${LX + 3.8}" y="${ly}">${NAME_CN[type]}</text>`); ly += LH;
}
parts.push(`<rect x="${LX}" y="${ly - 1.1}" width="2.6" height="2.1" fill="${C.river}" opacity="0.5"/>`);
parts.push(`<text x="${LX + 3.8}" y="${ly}">河流</text>`); ly += LH;
parts.push(`<circle cx="${LX + 1.3}" cy="${ly - 0.6}" r="1.05" fill="#3a3a3a"/>`);
parts.push(`<text x="${LX + 3.8}" y="${ly}">城市（约200km²）</text>`); ly += LH;
parts.push(`<circle cx="${LX + 1.3}" cy="${ly - 0.6}" r="0.55" fill="#3a3a3a"/>`);
parts.push(`<text x="${LX + 3.8}" y="${ly}">集镇/哨站</text>`); ly += LH;
parts.push(`<line x1="${LX}" y1="${ly - 0.4}" x2="${LX + 2.6}" y2="${ly - 0.4}" stroke="#5a4a3a" stroke-width="0.35"/>`);
parts.push(`<text x="${LX + 3.8}" y="${ly}">官道</text>`); ly += LH;
parts.push(`<line x1="${LX}" y1="${ly - 0.4}" x2="${LX + 2.6}" y2="${ly - 0.4}" stroke="#8a7a6a" stroke-width="0.18"/>`);
parts.push(`<text x="${LX + 3.8}" y="${ly}">乡道</text>`); ly += LH;
parts.push(`</g>`);

// 标题 + 注释（地图上方留白）
const kmPerCell = KM;
parts.push(`<text x="-12" y="-13" font-size="3.4" font-weight="bold" fill="#1c1c1c">${m.meta.title}</text>`);
parts.push(`<text x="-12" y="-6.5" font-size="1.8" fill="#555">1 格 = ${kmPerCell} km（每格 ${kmPerCell * kmPerCell} km²）· 地貌与地点面积为假设估计</text>`);
// 比例尺（地图下方留白）
{
  const sx = -12, sy = 100, len = 10; // 10 格 = 50km
  parts.push(`<rect x="${sx}" y="${sy}" width="${len}" height="1.8" fill="#fff" stroke="#333" stroke-width="0.3"/>`);
  for (let i = 1; i < len; i++) parts.push(`<line x1="${sx + i}" y1="${sy}" x2="${sx + i}" y2="${sy + 1.8}" stroke="#333" stroke-width="0.15"/>`);
  parts.push(`<text x="${sx}" y="${sy + 3.6}" font-size="1.7" fill="#333">0</text>`);
  parts.push(`<text x="${sx + len - 3}" y="${sy + 3.6}" font-size="1.7" fill="#333">${len * kmPerCell} km</text>`);
}
parts.push(`</svg>`);

const html = `<!doctype html><html lang="zh"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${m.meta.title}</title></head><body style="margin:0;background:#f2efe6"><div style="max-width:1200px;margin:0 auto;padding:12px">${parts.join('\n')}<p style="font-family:sans-serif;color:#777;font-size:12px">由 scripts/gen-map-html.js 生成 · 地貌面积/地点面积均为假设估计（见 world.md 地貌总览）</p></div></body></html>`;

fs.writeFileSync(OUT, html);
console.log(`已生成 ${OUT}`);
console.log(`  区域色块 ${blocks.length} 块 / 河流 ${riverCells.length} 格 / 地点 ${m.locations.length} / 路线 ${m.routes.length}`);
