# sessions-backup · Kimi Code 会话归档

本目录保存 GSG-N2 战役的两个 Kimi Code 会话（**导出副本**：已剔除各会话诊断日志，已把疑似 API key 替换为占位符；源会话文件未做任何改动）：

- **GSG-N2主窗口**：`session_7439ba46-12fd-4f1e-b79b-a622dbc28b0b`（wire 约 4.3M）
- **GSG-N2技能查询**：`session_c922b88f-216a-46ff-a60b-08980462b3f1`（wire 约 1.8M）

源会话位于源机 `~/.kimi-code/sessions/wd_s-ai-rpg-gsg-n2_0801de24400c/`。

## 目录名与路径的关系（重要）

`workDirKey = wd_<slug>_<sha256(工作目录绝对路径) 前12位>`。实测 `D:/Kimi/-s-AI-RPG-GSG-N2` 的 sha256 前 12 位正是 `0801de24400c`。
**只有把仓库克隆到与源机相同的绝对路径 `D:/Kimi/-s-AI-RPG-GSG-N2` 时**，新设备上的 workDirKey 才会一致，归档解压后可直接使用。

## 目标设备路径不同（例如新设备只有 C 盘）

路径一致不是硬性前提——但会话桶目录名（workDirKey）和 `state.json` 里的绝对路径都按源机路径生成，新设备路径不同时需要调整。仓库提供了自动化脚本，一条命令完成：

```bash
# 1. 解压归档，得到 wd_s-ai-rpg-gsg-n2_0801de24400c/ 目录
cd sessions-backup && unzip gsg-n2-sessions.zip

# 2. 运行适配脚本：参数1 = 新设备上的项目绝对路径（正斜杠）；参数2可省略（默认 ~/.kimi-code/sessions）
node adjust-session-paths.js "C:/Kimi/-s-AI-RPG-GSG-N2"
# 装在用户目录下则如: node adjust-session-paths.js "C:/Users/<你>/-s-AI-RPG-GSG-N2"

# 3. 把新桶目录移进会话目录（脚本输出会显示新桶名）
mv wd_s-ai-rpg-gsg-n2_<新hash> ~/.kimi-code/sessions/
```

脚本自动完成：算新路径 sha256 前 12 位 → 重命名桶目录 → 更新两个 `state.json` 的 `cwd` 与 `homedir` → 备份并追加 `session_index.jsonl`。完成后验证：

```bash
kimi --session session_7439ba46-12fd-4f1e-b79b-a622dbc28b0b
```

> 恢复入口务必用 `--session <id>`（按 ID 全局查找会话）；不要用 `--continue`（它只找当前目录的 hash 桶）。
> 此类调整属官方未明确背书的操作（官方警告勿手动编辑 sessions/ 内文件），**务必实测**；失败不影响存档，按 `RESUME.md` 开新会话即可续玩。

## 恢复步骤（新设备，路径与源机一致时）

1. clone 到与源机相同路径：
   ```bash
   git clone <私有仓库URL> "D:/Kimi/-s-AI-RPG-GSG-N2" && cd "D:/Kimi/-s-AI-RPG-GSG-N2"
   ```
2. 按 `INSTALL.md` 完成环境配置（MCP、skills、自检）。
3. 解压归档到会话目录：
   ```bash
   cd sessions-backup && unzip gsg-n2-sessions.zip -d ~/.kimi-code/sessions/
   ```
   （Windows 无 unzip 时：右键「全部解压」，把解出的 `wd_s-ai-rpg-gsg-n2_0801de24400c/` 整体移到 `~/.kimi-code/sessions/` 下。）
4. 在 `~/.kimi-code/session_index.jsonl` 末尾追加两行（先备份原文件；`<你的用户目录>` 换成新设备实际值）：
   ```json
   {"sessionId":"session_7439ba46-12fd-4f1e-b79b-a622dbc28b0b","sessionDir":"C:/<你的用户目录>/.kimi-code/sessions/wd_s-ai-rpg-gsg-n2_0801de24400c/session_7439ba46-12fd-4f1e-b79b-a622dbc28b0b","workDir":"D:/Kimi/-s-AI-RPG-GSG-N2"}
   {"sessionId":"session_c922b88f-216a-46ff-a60b-08980462b3f1","sessionDir":"C:/<你的用户目录>/.kimi-code/sessions/wd_s-ai-rpg-gsg-n2_0801de24400c/session_c922b88f-216a-46ff-a60b-08980462b3f1","workDir":"D:/Kimi/-s-AI-RPG-GSG-N2"}
   ```
5. 验证恢复：在项目目录运行
   ```bash
   kimi --session session_7439ba46-12fd-4f1e-b79b-a622dbc28b0b
   ```
   应恢复「GSG-N2主窗口」；或 `kimi --session` 浏览会话列表选择。

## 注意

- 官方文档警告：**不要手动编辑 `sessions/` 内文件**，否则可能无法正确恢复。本归档是原样拷贝（仅剔除日志、替换 key 占位符），未改动任何会话结构。
- 归档中 `sk-bb4abd…` 已替换为 `sk-REDACTED-KEY-REMOVED` 占位符，不影响 JSON 结构与会话恢复。
- 会话恢复属「结构上成立、官方未明确背书」的操作，**务必在步骤 5 实测**；若失败：
  - 兜底方案 A：游戏状态全部在 git 中（`state.md`/`chronicle.md`/`ledger.md`/`memory.json` 等），按 `RESUME.md` 协议开新会话贴内容即可无缝续玩；
  - 兜底方案 B：在新设备上用 `kimi export` 从源机重新导出（需在源机执行，注意先替换 key 再分享）。
- 若新设备使用**不同路径**克隆：先跑 `sessions-backup/adjust-session-paths.js`（见「目标设备路径不同」一节）自动调整桶名与绝对路径，不要手工改。
