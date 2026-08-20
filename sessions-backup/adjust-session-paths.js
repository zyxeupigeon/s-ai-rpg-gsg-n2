#!/usr/bin/env node
// 新设备会话路径适配脚本：把归档会话调整到目标设备的实际路径
//
// 用法:
//   node adjust-session-paths.mjs <新项目绝对路径> [新会话根目录]
// 例:
//   node adjust-session-paths.mjs "C:/Kimi/-s-AI-RPG-GSG-N2"
//   node adjust-session-paths.mjs "C:/Users/me/-s-AI-RPG-GSG-N2" "C:/Users/me/.kimi-code/sessions"
//
// 前提: 已把 gsg-n2-sessions.zip 解压，脚本所在目录下存在 wd_s-ai-rpg-gsg-n2_0801de24400c/
//
// 脚本自动完成:
//   1) 计算新路径的 sha256 前 12 位 → 新桶目录名
//   2) 重命名桶目录（hash 不变则跳过）
//   3) 更新两个会话 state.json 的 cwd 与 agents.main.homedir
//   4) 备份并追加 ~/.kimi-code/session_index.jsonl 两行记录
// 然后在新设备项目目录运行: kimi --session session_7439ba46-12fd-4f1e-b79b-a622dbc28b0b

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const SCRIPT_DIR = __dirname;
const OLD_BUCKET = 'wd_s-ai-rpg-gsg-n2_0801de24400c';
const SESSION_IDS = [
  'session_7439ba46-12fd-4f1e-b79b-a622dbc28b0b', // GSG-N2主窗口
  'session_c922b88f-216a-46ff-a60b-08980462b3f1', // GSG-N2技能查询
];
const OLD_WORK_DIR = 'D:/Kimi/-s-AI-RPG-GSG-N2'; // 源机工作目录（归档时固定）
const OLD_SESSIONS_ROOT = 'C:/Users/yxzhu30/.kimi-code/sessions'; // 源机会话根目录（归档时固定）

function toSlash(p) { return p.replace(/\\/g, '/'); }
function sha12(s) { return crypto.createHash('sha256').update(s).digest('hex').slice(0, 12); }

const newWorkDir = toSlash((process.argv[2] || '').trim().replace(/\/+$/, ''));
if (!newWorkDir) {
  console.error('用法: node adjust-session-paths.mjs <新项目绝对路径> [新会话根目录]');
  process.exit(1);
}
const home = process.env.USERPROFILE || process.env.HOME;
const newSessionsRoot = toSlash(
  (process.argv[3] || path.join(home, '.kimi-code', 'sessions')).replace(/\/+$/, '')
);
const newIndexPath = toSlash(path.join(newSessionsRoot, '..', 'session_index.jsonl'));

const newBucket = 'wd_s-ai-rpg-gsg-n2_' + sha12(newWorkDir);
const oldDir = path.join(SCRIPT_DIR, OLD_BUCKET);
const newDir = path.join(SCRIPT_DIR, newBucket);

if (!fs.existsSync(oldDir)) {
  console.error('未找到归档目录: ' + oldDir);
  console.error('请先解压 gsg-n2-sessions.zip 到本脚本同目录。');
  process.exit(1);
}
if (newBucket !== OLD_BUCKET && fs.existsSync(newDir)) {
  console.error('目标桶目录已存在: ' + newDir);
  process.exit(1);
}
if (!fs.existsSync(newIndexPath)) {
  console.error('找不到会话索引（应位于会话根目录的上一级）: ' + newIndexPath);
  process.exit(1);
}

// 1. 重命名桶目录
if (newBucket !== OLD_BUCKET) {
  fs.renameSync(oldDir, newDir);
  console.log('桶目录重命名: ' + OLD_BUCKET + ' -> ' + newBucket);
} else {
  console.log('桶目录名一致，无需重命名: ' + newBucket);
}

// 2. 更新各会话 state.json 的绝对路径
for (const sid of SESSION_IDS) {
  const stPath = path.join(newDir, sid, 'state.json');
  if (!fs.existsSync(stPath)) {
    console.error('跳过（缺 state.json）: ' + sid);
    continue;
  }
  let st = fs.readFileSync(stPath, 'utf8');
  const oldHomedir = OLD_SESSIONS_ROOT + '/' + OLD_BUCKET + '/' + sid + '/agents/main';
  const newHomedir = newSessionsRoot + '/' + newBucket + '/' + sid + '/agents/main';
  st = st.split(OLD_WORK_DIR).join(newWorkDir);
  st = st.split(oldHomedir).join(newHomedir);
  fs.writeFileSync(stPath, st);
  console.log('已更新 state.json: ' + sid);
}

// 3. 备份并追加 session_index.jsonl
const records = SESSION_IDS
  .map((sid) => ({
    sessionId: sid,
    sessionDir: newSessionsRoot + '/' + newBucket + '/' + sid,
    workDir: newWorkDir,
  }))
  .map((r) => JSON.stringify(r))
  .join('\n');
fs.copyFileSync(newIndexPath, newIndexPath + '.bak-adjust');
fs.appendFileSync(newIndexPath, '\n' + records + '\n');
console.log('已备份索引并追加 2 行记录: ' + newIndexPath);

console.log('\n完成。请确认两处路径正确:');
console.log('  新项目路径: ' + newWorkDir);
console.log('  新会话根目录: ' + newSessionsRoot);
console.log('然后在新设备项目目录下验证:');
console.log('  kimi --session ' + SESSION_IDS[0]);
