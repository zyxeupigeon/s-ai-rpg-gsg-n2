#!/usr/bin/env node
// geo-ascii.js — 用字符画渲染 map.json（与 geo.js 的 render 互补；geo.js 走 ASCII/HTML，本脚本专做紧凑字符画）
//
// 用法:
//   node scripts/geo-ascii.js                    全图（每格约 40km）
//   node scripts/geo-ascii.js --area 10 12 38 26 指定区域（每格约 20km）
//   node scripts/geo-ascii.js --step 1          指定缩放（每格 km = step × scaleKmPerCell）
//   node scripts/geo-ascii.js --map <file>      指定地图文件（默认 ./map.json）
//
// 输出：字符画网格 + 图例。y 上北下南；点用单字符符号（冲突时靠后覆盖靠前）。

const fs = require('fs');
const path = require('path');

// ---------- 参数 ----------
const args = process.argv.slice(2);
const get = (flag, dflt) => {
  const i = args.indexOf(flag);
  return i >= 0 && i + 1 < args.length ? args[i + 1] : dflt;
};
const has = (flag) => args.includes(flag);

const mapFile = path.resolve(get('--map', 'map.json'));
const area = has('--area') ? args.slice(args.indexOf('--area') + 1, args.indexOf('--area') + 5).map(Number) : null;
const step = has('--step') ? Number(get('--step')) : (area ? 1 : 2);

const m = JSON.parse(fs.readFileSync(mapFile, 'utf8'));
const cellKm = m.meta.scaleKmPerCell * step;

// ---------- 符号表（地点 id -> 单字符） ----------
const SYM = {
  waldburg: 'W', 'protagonist-domain': 'P', 'vard-forest': 'f', 'scourge-waste': 'X',
  'north-fjord': 'N', 'west-harbor': 'H', 'dwarf-mount': 'D', 'dwarf-mine-town': 'M',
  'east-march': 'E', 'valen-city': 'V', 'hagen-domain': 'G', 'stein-domain': 'S',
  'old-town': 'O', eichburg: 'I', westburg: 'T', frostburg: 'B',
  'velen-city': 'L', 'kalden-city': 'K'
};
const NAME = {
  W: '瓦德堡', P: '林德霍姆(主角)', f: '瓦德森林', X: '蚀荒', N: '北峡湾', H: '西港',
  D: '山民山地', M: '山民矿镇', E: '东境戍关', V: '瓦伦城', G: '哈根', S: '施泰因',
  O: '老镇', I: '艾希堡', T: '韦斯特堡', B: '霜堡', L: '维伦', K: '卡尔登'
};

// ---------- 区域范围 ----------
const xs = m.locations.map((l) => l.x);
const ys = m.locations.map((l) => l.y);
const x0 = area ? area[0] : 0;
const y1 = area ? area[3] : Math.max(...ys) + 2;
const x1 = area ? area[2] : Math.max(...xs) + 2;
const y0 = area ? area[1] : 0;

const cols = Math.ceil((x1 - x0) / step) + 1;
const rows = Math.ceil((y1 - y0) / step) + 1;
const grid = Array.from({ length: rows }, () => Array(cols).fill('.'));

for (const loc of m.locations) {
  const s = SYM[loc.id];
  if (!s) continue;
  const cx = Math.round((loc.x - x0) / step);
  const cy = Math.round((y1 - loc.y) / step);
  if (cx >= 0 && cx < cols && cy >= 0 && cy < rows) grid[cy][cx] = s;
}

console.log(`=== ${m.meta.title || '地图'}（每格约 ${cellKm}km，y 上北下南）===`);
for (const row of grid) console.log(row.join(''));

const used = [...new Set(grid.flat())].filter((c) => c !== '.' && NAME[c]);
console.log('图例: ' + used.map((c) => `${c}=${NAME[c]}`).join(' '));
