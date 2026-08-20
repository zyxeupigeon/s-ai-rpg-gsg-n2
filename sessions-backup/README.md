# sessions-backup · Kimi Code 会话归档

> **新设备从零恢复的完整操作清单见仓库根 `RESTORE.md`**。本文件只说明归档本身与快速步骤。

## 归档内容

两个 Kimi Code 会话的**导出副本**（已剔除各会话诊断日志；疑似 API key 已替换为 `sk-REDACTED-KEY-REMOVED` 占位符；源会话文件未做任何改动）：

- **GSG-N2主窗口**：`session_7439ba46-12fd-4f1e-b79b-a622dbc28b0b`（wire 约 4.3M）
- **GSG-N2技能查询**：`session_c922b88f-216a-46ff-a60b-08980462b3f1`（wire 约 1.8M）

- 归档包：`gsg-n2-sessions.zip`（1.8M，顶层目录为 `wd_s-ai-rpg-gsg-n2_0801de24400c/`）
- 路径适配脚本：`adjust-session-paths.js`（新设备路径与源机不同时使用，已沙盒实测）

源会话位于源机 `~/.kimi-code/sessions/wd_s-ai-rpg-gsg-n2_0801de24400c/`。

## 快速恢复（两种场景）

**场景 A · 新设备路径与源机一致（`D:/Kimi/-s-AI-RPG-GSG-N2`）**

```bash
cd sessions-backup && unzip gsg-n2-sessions.zip -d ~/.kimi-code/sessions/
# 再往 ~/.kimi-code/session_index.jsonl 末尾追加两行（内容见 RESTORE.md §8）
kimi --session session_7439ba46-12fd-4f1e-b79b-a622dbc28b0b
```

**场景 B · 新设备路径不同（如只有 C 盘）**

```bash
cd sessions-backup && unzip gsg-n2-sessions.zip
node adjust-session-paths.js "C:/Kimi/-s-AI-RPG-GSG-N2"   # 换成你的实际路径
mv wd_s-ai-rpg-gsg-n2_<新hash> ~/.kimi-code/sessions/
kimi --session session_7439ba46-12fd-4f1e-b79b-a622dbc28b0b
```

## 注意

- `workDirKey = wd_<slug>_<sha256(工作目录绝对路径) 前12位>`；场景 A 依赖路径一致，场景 B 由脚本自动重算。
- `unzip` 解压会打印 "appears to use backslashes" 警告，解压成功，可忽略。
- 恢复入口用 `--session <id>`，不要用 `--continue`。
- 会话恢复是官方未明确背书的操作，**务必实测**；失败不影响存档，走 `RESTORE.md` §10 兜底（贴 `RESUME.md` 续玩）。
