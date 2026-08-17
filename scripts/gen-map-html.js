#!/usr/bin/env node
// gen-map-html.js — 读 map.json 生成单文件 HTML（内嵌 SVG）可视化地图 map.html
//
// 用法:  node scripts/gen-map-html.js [--map <file>] [--out <file>]
//
// 主图（全图）：区域型地貌色块+闭合线圈、河流/山脊流畅线条、地点分级标记+标签（8方向避让）、路线、图例、比例尺
// 放大图：林德霍姆周边局部放大（第二个 SVG）
// 面积假设：城市≈200km²（8格）、关隘/领地≈100km²（4格）、集镇≈50km²（2格）

const fs = require('fs');
const path = require('path');

const idx = process.argv.indexOf('--map');
const MAP = path.resolve(idx >= 0 ? process.argv[idx + 1] : 'map.json');
const oi = process.argv.indexOf('--out');
const OUT = path.resolve(oi >= 0 ? process.argv[oi + 1] : 'map.html');
const m = JSON.parse(fs.readFileSync(MAP, 'utf8'));
const KM = m.meta.scaleKmPerCell || 5;

// ---------- 颜色 ----------
const C = {
  sea: '#9cc4dd', swamp: '#8f7048', plain: '#d6e4c3', forest: '#6e9e4f',
  hill: '#c9a86c', mountain: '#a096a8', river: '#4a7fb5',
  land: '#e8e4d8',
};
const NAME_CN = { sea: '海洋', swamp: '沼泽/荒野', plain: '平原', forest: '森林', hill: '丘陵', mountain: '山脉', river: '河流' };
const ORDER = ['sea', 'swamp', 'plain', 'forest', 'hill', 'mountain'];

// ---------- 地点 ----------
const MARK = { 城市: 'circle', 关隘: 'square', 领地: 'circle', 集镇: 'circle', 森林: 'tri', 荒野: 'tri', 山脉: 'tri' };
const RADIUS = { 城市: 1.7, 关隘: 1.2, 领地: 1.15, 集镇: 0.75, 森林: 1.0, 荒野: 1.0, 山脉: 1.0 };
const FSIZE = { 城市: 1.4, 关隘: 1.05, 领地: 1.1, 集镇: 0.9, 森林: 0.9, 荒野: 0.9, 山脉: 0.9 };
const AREA_ASSUME = { 城市: '约200km²', 关隘: '约100km²', 领地: '约100km²', 集镇: '约50km²', 森林: '区域地貌', 荒野: '区域地貌', 山脉: '区域地貌' };
const SHORT = { 'protagonist-domain': '林德霍姆', 'dwarf-mine-town': '山民矿镇', 'east-march': '东境戍关', 'west-harbor': '西港', 'dwarf-mount': '山民山地' };

// ---------- 地形预处理 ----------
const S = 4;
const byRegion = {};
for (const t of m.terrain) {
  if (t.terrain === 'river') continue;
  (byRegion[t.region] ||= []).push(t);
}
const blocks = [], edges = [], regMeta = {};
for (const [region, cells] of Object.entries(byRegion)) {
  const type = cells[0].terrain;
  const set = new Set(cells.map((c) => `${c.x},${c.y}`));
  let areaCells = 0;
  for (const c of cells) {
    blocks.push({ region, type, x: c.x, y: c.y });
    areaCells += S * S;
    for (const [dx, dy, ex1, ey1, ex2, ey2] of [
      [-S, 0, c.x, c.y, c.x, c.y + S], [S, 0, c.x + S, c.y, c.x + S, c.y + S],
      [0, -S, c.x, c.y, c.x + S, c.y], [0, S, c.x, c.y + S, c.x + S, c.y + S],
    ]) {
      if (!set.has(`${c.x + dx},${c.y + dy}`)) edges.push({ region, x1: ex1, y1: ey1, x2: ex2, y2: ey2 });
    }
  }
  regMeta[region] = { name: region, type, areaCells };
}
const riverByRegion = {};
for (const t of m.terrain) {
  if (t.terrain === 'river') (riverByRegion[t.region] ||= []).push(t);
}

// 河线：按 y（竖河）或 x（横河）分组取中心，排序成折线
function riverLine(cells) {
  const byY = {};
  for (const c of cells) (byY[c.y] ||= []).push(c.x);
  const ys = Object.keys(byY).map(Number);
  const ySpan = Math.max(...ys) - Math.min(...ys);
  const byX = {};
  for (const c of cells) (byX[c.x] ||= []).push(c.y);
  const xs = Object.keys(byX).map(Number);
  const xSpan = Math.max(...xs) - Math.min(...xs);
  if (ySpan >= xSpan) { // 竖河：按 y 排序
    return Object.entries(byY).sort((a, b) => a[0] - b[0])
      .map(([y, arr]) => [arr.reduce((a, b) => a + b, 0) / arr.length + 0.5, +y + 0.5]);
  }
  return Object.entries(byX).sort((a, b) => a[0] - b[0])
    .map(([x, arr]) => [+x + 0.5, arr.reduce((a, b) => a + b, 0) / arr.length + 0.5]);
}

// ---------- 区域地图绘制（可复用于主图与放大图） ----------
function drawMap(area, opts = {}) {
  const { labelScale = 1, showRoutes = true, showTitle = false, title = '', showOutline = true } = opts;
  const X0 = area.x0, Y0 = area.y0, X1 = area.x1, Y1 = area.y1;
  const W = X1 - X0, H = Y1 - Y0;
  const P = [];

  // 底图（区域内未定义土地 = 默认平原，作为底色）
  P.push(`<rect x="0" y="0" width="${W}" height="${H}" fill="${C.plain}"/>`);

  // 图形组（y 翻转：SVG y = H - (mapY - Y0)）
  P.push(`<g transform="scale(1,-1) translate(0,-${H})">`);

  // 区域色块（裁剪到区域 + 边缘不溢出）
  for (const type of ORDER) {
    const regions = [...new Set(blocks.filter((b) => b.type === type).map((b) => b.region))];
    for (const region of regions) {
      const meta = regMeta[region];
      const inRegion = blocks.filter((b) => b.region === region);
      for (const b of inRegion) {
        const bx = Math.max(b.x, X0), by = Math.max(b.y, Y0);
        if (bx >= X1 || by >= Y1) continue;
        const bw = Math.min(b.x + S, X1) - bx, bh = Math.min(b.y + S, Y1) - by;
        if (bw <= 0 || bh <= 0) continue;
        P.push(`<rect x="${bx - X0}" y="${by - Y0}" width="${bw}" height="${bh}" fill="${C[type]}" stroke="${C[type]}" stroke-width="0.05"><title>${region} · ${NAME_CN[type]} · 约 ${Math.round(meta.areaCells * KM * KM / 1000)} 千km²</title></rect>`);
      }
      const es = edges.filter((e) => e.region === region && e.x1 >= X0 && e.x1 <= X1 && e.y1 >= Y0 && e.y1 <= Y1);
      if (es.length && showOutline) {
        const d = es.map((e) => `M${e.x1 - X0} ${e.y1 - Y0} L${e.x2 - X0} ${e.y2 - Y0}`).join(' ');
        P.push(`<path d="${d}" fill="none" stroke="${C[type]}" stroke-width="0.3" opacity="0.85"/>`);
      }
    }
  }

  // 河流（宽淡床线 + 实心线 + 源点）
  for (const [region, cells] of Object.entries(riverByRegion)) {
    const inArea = cells.filter((c) => c.x >= X0 && c.x <= X1 && c.y >= Y0 && c.y <= Y1);
    if (!inArea.length) continue;
    const line = riverLine(inArea);
    if (line.length >= 2) {
      const d = line.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x - X0} ${y - Y0}`).join(' ');
      P.push(`<path d="${d}" fill="none" stroke="${C.river}" stroke-width="1.15" opacity="0.3" stroke-linecap="round"/>`);
      P.push(`<path d="${d}" fill="none" stroke="${C.river}" stroke-width="0.55" stroke-linecap="round"><title>${region}</title></path>`);
      // 源点：横河取 x 小端，竖河取 y 大端（上游）
      const [lx1, ly1] = line[0], [lx2, ly2] = line[line.length - 1];
      const src = Math.abs(lx1 - lx2) > Math.abs(ly1 - ly2)
        ? (lx1 < lx2 ? line[0] : line[line.length - 1])
        : (ly1 > ly2 ? line[0] : line[line.length - 1]);
      P.push(`<circle cx="${src[0] - X0}" cy="${src[1] - Y0}" r="0.32" fill="${C.river}"/>`);
    }
  }

  // 白石山脉山脊线（窄山脉 -> 流畅折线）
  const ws = byRegion['白石山脉'];
  if (ws) {
    const inArea = ws.filter((c) => c.x >= X0 && c.x <= X1 && c.y >= Y0 && c.y <= Y1);
    if (inArea.length) {
      const line = riverLine(inArea);
      if (line.length >= 2) {
        const d = line.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x - X0} ${y - Y0}`).join(' ');
        P.push(`<path d="${d}" fill="none" stroke="#6b5a48" stroke-width="0.8" stroke-linecap="round" opacity="0.85"><title>白石山脉 · 山脊</title></path>`);
      }
    }
  }

  // 路线（官道=深赭粗实线，乡道=浅灰细虚线；有 waypoints 时画折线）
  if (showRoutes) {
    for (const r of m.routes) {
      const a = m.locations.find((l) => l.id === r.from), b = m.locations.find((l) => l.id === r.to);
      if (!a || !b) continue;
      if (a.x < X0 || a.x > X1 || b.x < X0 || b.x > X1 || a.y < Y0 || a.y > Y1 || b.y < Y0 || b.y > Y1) continue;
      const isRoad = r.group === '官道';
      const w = isRoad ? 0.4 : 0.16;
      const color = isRoad ? '#7a4a2a' : '#b0a898';
      const dash = isRoad ? '' : ' stroke-dasharray="0.6 0.45"';
      const pts = [[a.x, a.y], ...(r.waypoints || []), [b.x, b.y]];
      if (pts.length === 2) {
        P.push(`<line x1="${a.x - X0}" y1="${a.y - Y0}" x2="${b.x - X0}" y2="${b.y - Y0}" stroke="${color}" stroke-width="${w}"${dash}><title>${a.name} ↔ ${b.name} · ${r.lengthKm} km · ${r.group}</title></line>`);
      } else {
        const d = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x - X0} ${y - Y0}`).join(' ');
        P.push(`<path d="${d}" fill="none" stroke="${color}" stroke-width="${w}"${dash}><title>${a.name} ↔ ${b.name} · ${r.lengthKm} km · ${r.group}</title></path>`);
      }
    }
  }

  // 地点标记
  for (const loc of m.locations) {
    if (loc.x < X0 || loc.x > X1 || loc.y < Y0 || loc.y > Y1) continue;
    const t = loc.type, mark = MARK[t] || 'circle', r = (RADIUS[t] || 0.7) * labelScale;
    const fill = mark === 'tri' ? '#666' : '#3a3a3a';
    const cx = loc.x - X0, cy = loc.y - Y0;
    let el;
    if (mark === 'circle') el = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" stroke="#fff" stroke-width="0.25"/>`;
    else if (mark === 'square') el = `<rect x="${cx - r * 0.8}" y="${cy - r * 0.8}" width="${r * 1.6}" height="${r * 1.6}" fill="${fill}" stroke="#fff" stroke-width="0.25"/>`;
    else el = `<polygon points="${cx},${cy + r} ${cx - r},${cy - r} ${cx + r},${cy - r}" fill="${fill}" stroke="#fff" stroke-width="0.2"/>`;
    P.push(`${el}<title>${loc.name} · ${t} · ${AREA_ASSUME[t]}</title>`);
  }
  P.push('</g>');

  // 地点标签（SVG 坐标，8 方向避让）
  P.push('<g fill="#222">');
  const placed = [];
  for (const loc of m.locations) {
    if (loc.x < X0 || loc.x > X1 || loc.y < Y0 || loc.y > Y1) continue;
    const t = loc.type;
    const name = SHORT[loc.id] || loc.name;
    const fs = (FSIZE[t] || 1.0) * labelScale;
    const w = name.length * fs * 0.95;
    const isTri = MARK[t] === 'tri';
    const dy0 = fs * 0.35;
    const tries = [
      { dx: (isTri ? 1.6 : 2.2) * labelScale, dy: dy0, anchor: 'start' },
      { dx: -((isTri ? 1.6 : 2.2) * labelScale) - w, dy: dy0, anchor: 'end' },
      { dx: -w / 2, dy: -0.9 * labelScale, anchor: 'middle' },
      { dx: -w / 2, dy: fs + 1.5 * labelScale, anchor: 'middle' },
      { dx: (isTri ? 1.6 : 2.2) * labelScale, dy: -0.9 * labelScale, anchor: 'start' },
      { dx: (isTri ? 1.6 : 2.2) * labelScale, dy: fs + 1.5 * labelScale, anchor: 'start' },
      { dx: -((isTri ? 1.6 : 2.2) * labelScale) - w, dy: -0.9 * labelScale, anchor: 'end' },
      { dx: -((isTri ? 1.6 : 2.2) * labelScale) - w, dy: fs + 1.5 * labelScale, anchor: 'end' },
    ];
    let chosen = tries[0];
    for (const t2 of tries) {
      const bx = loc.x - X0 + t2.dx, by = H - (loc.y - Y0) + t2.dy;
      const box = { x1: Math.min(bx, bx + w) - 0.4, x2: Math.max(bx, bx + w) + 0.4, y1: by - fs - 0.4, y2: by + 0.6 };
      if (box.x1 < 0.4 || box.x2 > W - 0.4 || box.y1 < 0.4 || box.y2 > H - 0.4) continue; // 超出视图边界则跳过
      const conflict = placed.some((p) => !(box.x2 < p.x1 || box.x1 > p.x2 || box.y2 < p.y1 || box.y1 > p.y2));
      if (!conflict) { chosen = t2; placed.push(box); break; }
    }
    if (chosen === tries[0]) {
      // 全候选冲突/出界时的兜底：钳制坐标到视图内，保证标签完整显示
      let bx = loc.x - X0 + chosen.dx, by = H - (loc.y - Y0) + chosen.dy;
      bx = Math.min(Math.max(bx, 0.4), W - w - 0.4);
      by = Math.min(Math.max(by, fs + 0.4), H - 0.6);
      chosen = { dx: bx - (loc.x - X0), dy: by - (H - (loc.y - Y0)), anchor: chosen.anchor };
      placed.push({ x1: bx, x2: bx + w, y1: by - fs, y2: by });
    }
    P.push(`<text x="${loc.x - X0 + chosen.dx}" y="${H - (loc.y - Y0) + chosen.dy}" font-size="${fs}" fill="#1c1c1c" stroke="#fff" stroke-width="0.35" paint-order="stroke" text-anchor="${chosen.anchor}">${name}</text>`);
  }
  P.push('</g>');

  if (showTitle) {
    P.push(`<text x="0.6" y="1.4" font-size="${(2.4 * labelScale).toFixed(2)}" font-weight="bold" fill="#1c1c1c">${title}</text>`);
  }
  return P;
}

// ---------- 主图 ----------
const FULL = { x0: 0, y0: 0, x1: 100, y1: 92 };
let main = [];
main.push(`<svg viewBox="-14 -20 158 132" xmlns="http://www.w3.org/2000/svg" font-family="Georgia,'Times New Roman',serif">`);
main.push(...drawMap(FULL, { labelScale: 1, showRoutes: true }));

// 图例（右侧留白）
const LX = 104, LY0 = -16, LH = 4.6;
main.push(`<g font-size="1.6" fill="#1c1c1c">`);
main.push(`<rect x="${LX - 2}" y="${LY0 - 2}" width="37" height="${LH * 9 + 3.5}" fill="#fdfbf4" stroke="#999" stroke-width="0.35" rx="1"/>`);
let ly = LY0;
main.push(`<text x="${LX}" y="${ly}" font-size="2.0" font-weight="bold">图例</text>`); ly += LH;
for (const type of ORDER) {
  main.push(`<rect x="${LX}" y="${ly - 1.1}" width="2.6" height="2.1" fill="${C[type]}" stroke="#666" stroke-width="0.15"/>`);
  main.push(`<text x="${LX + 3.8}" y="${ly}">${NAME_CN[type]}</text>`); ly += LH;
}
main.push(`<rect x="${LX}" y="${ly - 1.1}" width="2.6" height="2.1" fill="${C.river}" opacity="0.5"/>`);
main.push(`<text x="${LX + 3.8}" y="${ly}">河流</text>`); ly += LH;
main.push(`<circle cx="${LX + 1.3}" cy="${ly - 0.6}" r="1.05" fill="#3a3a3a"/>`);
main.push(`<text x="${LX + 3.8}" y="${ly}">城市（约200km²）</text>`); ly += LH;
main.push(`<circle cx="${LX + 1.3}" cy="${ly - 0.6}" r="0.55" fill="#3a3a3a"/>`);
main.push(`<text x="${LX + 3.8}" y="${ly}">集镇/哨站</text>`); ly += LH;
main.push(`<line x1="${LX}" y1="${ly - 0.4}" x2="${LX + 2.6}" y2="${ly - 0.4}" stroke="#7a4a2a" stroke-width="0.4"/>`);
main.push(`<text x="${LX + 3.8}" y="${ly}">官道</text>`); ly += LH;
main.push(`<line x1="${LX}" y1="${ly - 0.4}" x2="${LX + 2.6}" y2="${ly - 0.4}" stroke="#b0a898" stroke-width="0.16" stroke-dasharray="0.6 0.45"/>`);
main.push(`<text x="${LX + 3.8}" y="${ly}">乡道</text>`); ly += LH;
main.push('</g>');

// 标题 + 注释
main.push(`<text x="-12" y="-13" font-size="3.4" font-weight="bold" fill="#1c1c1c">${m.meta.title}</text>`);
main.push(`<text x="-12" y="-6.5" font-size="1.8" fill="#555">1 格 = ${KM} km（每格 ${KM * KM} km²）· 地貌与地点面积为假设估计</text>`);
// 比例尺
{
  const sx = -12, sy = 100, len = 10;
  main.push(`<rect x="${sx}" y="${sy}" width="${len}" height="1.8" fill="#fff" stroke="#333" stroke-width="0.3"/>`);
  for (let i = 1; i < len; i++) main.push(`<line x1="${sx + i}" y1="${sy}" x2="${sx + i}" y2="${sy + 1.8}" stroke="#333" stroke-width="0.15"/>`);
  main.push(`<text x="${sx}" y="${sy + 3.6}" font-size="1.7" fill="#333">0</text>`);
  main.push(`<text x="${sx + len - 3}" y="${sy + 3.6}" font-size="1.7" fill="#333">${len * KM} km</text>`);
}
main.push('</svg>');

// ---------- 林德霍姆周边放大图 ----------
const ZOOM = { x0: 12, y0: 14, x1: 32, y1: 26 };
let zoom = [];
zoom.push(`<svg viewBox="0 0 20 12" xmlns="http://www.w3.org/2000/svg" font-family="Georgia,'Times New Roman',serif" style="border:1px solid #bbb;border-radius:4px">`);
zoom.push(...drawMap(ZOOM, { labelScale: 0.4, showRoutes: true, showTitle: true, title: '林德霍姆周边', showOutline: false }));
zoom.push('</svg>');

// ---------- 瓦德堡—林德霍姆走廊放大图（最小范围） ----------
const CORRIDOR = { x0: 20, y0: 18, x1: 42, y1: 32 };
let corr = [];
corr.push(`<svg viewBox="0 0 22 14" xmlns="http://www.w3.org/2000/svg" font-family="Georgia,'Times New Roman',serif" style="border:1px solid #bbb;border-radius:4px">`);
corr.push(...drawMap(CORRIDOR, { labelScale: 0.4, showRoutes: true, showTitle: true, title: '瓦德堡—林德霍姆走廊', showOutline: false }));
corr.push('</svg>');

// ---------- 页面 ----------
const html = `<!doctype html><html lang="zh"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${m.meta.title}</title></head><body style="margin:0;background:#f2efe6;font-family:sans-serif"><div style="max-width:1300px;margin:0 auto;padding:14px">
${main.join('\n')}
<div style="margin-top:16px;display:flex;flex-wrap:wrap;gap:24px">
  <div style="flex:1;min-width:340px"><h3 style="color:#444;margin:8px 0">林德霍姆周边 · 放大</h3>
  ${zoom.join('\n')}
  </div>
  <div style="flex:1;min-width:340px"><h3 style="color:#444;margin:8px 0">瓦德堡—林德霍姆走廊</h3>
  ${corr.join('\n')}
  </div>
</div>
<p style="color:#888;font-size:12px;margin-top:12px">由 scripts/gen-map-html.js 生成 · 地貌面积/地点面积为假设估计（见 world.md 地貌总览）</p>
</div></body></html>`;

fs.writeFileSync(OUT, html);
console.log(`已生成 ${OUT}`);
console.log(`  区域色块 ${blocks.length} 块 / 河流格 ${m.terrain.filter((t) => t.terrain === 'river').length} / 地点 ${m.locations.length} / 路线 ${m.routes.length} / 放大图区域 x${ZOOM.x0}-${ZOOM.x1}, y${ZOOM.y0}-${ZOOM.y1}`);
