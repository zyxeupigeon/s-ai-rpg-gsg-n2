# RESTORE.md · 新设备恢复手册（一条龙）

> 在新设备上**从零恢复** GSG-N2 战役：项目本体 + 全部存档 + Kimi Code 会话（GSG-N2主窗口 / GSG-N2技能查询）。
> 照着下面的步骤顺序做即可。环境细节参考 `INSTALL.md`，本文件是完整操作清单。

---

## 0. 你需要的东西

- GitHub 私有仓库：`zyxeupigeon/s-ai-rpg-gsg-n2`（需有访问权限）
- **你自己的模型 API key**（DeepSeek / GLM 等）。绝不借用别人的 key，也绝不把 key 提交进仓库。
- 一台 Windows 电脑。

## 1. 先决定项目放哪个路径（最重要的一步）

源机（当前机器）的项目路径是 `D:/Kimi/-s-AI-RPG-GSG-N2`。
Kimi Code 的会话目录名由**工作目录绝对路径的 sha256 前 12 位**决定，所以：

- **场景 A（推荐，最省事）**：新设备也克隆到 `D:/Kimi/-s-AI-RPG-GSG-N2`。会话解压后**直接用，零改动**。
- **场景 B（例如新设备只有 C 盘）**：克隆到任意路径（如 `C:/Kimi/-s-AI-RPG-GSG-N2`），用仓库自带的适配脚本自动调整（第 8 步）。

> 如果 D 盘实在建不了、又想要场景 A 的省事：可用 `subst D: C:\你的目录` 把 C 盘目录临时映射成 D: 盘（注意 Kimi Code 是否解析真实路径未验证，首选还是场景 B 脚本）。

## 2. 安装运行环境

| 项 | 版本要求 | 安装方式 |
|---|---|---|
| Node.js | ≥ 22.5 | https://nodejs.org |
| Git（含 Git Bash） | 任意新版本 | https://git-scm.com |
| uv（Python 包管理器） | 任意新版本 | `winget install astral-sh.uv` 或 https://docs.astral.sh/uv/ |
| Kimi Code CLI | 最新 | 官方渠道安装 |

## 3. Kimi Code 登录与模型

- 启动 `kimi` 完成登录，或在 `~/.kimi-code/config.toml` 里配置你自己的模型 API key。
- **key 只写在这台机器的配置文件里，不要放进任何会提交到仓库的文件。**

## 4. 克隆项目

```bash
# 场景 A
git clone https://github.com/zyxeupigeon/s-ai-rpg-gsg-n2.git "D:/Kimi/-s-AI-RPG-GSG-N2"

# 场景 B（换成你的目标路径，下面都记为 <项目路径>）
git clone https://github.com/zyxeupigeon/s-ai-rpg-gsg-n2.git "C:/Kimi/-s-AI-RPG-GSG-N2"
cd "C:/Kimi/-s-AI-RPG-GSG-N2"
```

## 5. 配置 MCP（memory / alchemy / qdrant / sequential-thinking）

- 把仓库根目录 `.mcp.json` 的内容复制到 `~/.kimi-code/mcp.json`，**把里面的路径全部改成新设备的绝对路径**（模板见 `INSTALL.md` §3）。
- 首次启动 MCP 会自动创建 `campaign.db` 与 `.qdrant/`（本地库，不入 git）。

## 6. 配置 skills

任选其一：

```bash
# 方式一：Kimi Code 配置里指向克隆出的 skills
# 在 ~/.kimi-code/config.toml 增加：
#   extra_skill_dirs = [ "<项目路径>/skills" ]
# 方式二：拷贝到全局 skills 目录
cp -r "<项目路径>/skills/"* ~/.claude/skills/   # 合并/覆盖
```

## 7. 首次自检

```bash
cd "<项目路径>"
node scripts/save-verify.js    # 关键文件存在性与引用断裂检查
node scripts/check-memory.js   # memory.json 格式
git log --oneline -3           # 确认存档历史完整
```

## 8. 恢复 Kimi Code 会话

会话归档在仓库 `sessions-backup/gsg-n2-sessions.zip`，包含：

- **GSG-N2主窗口**：`session_7439ba46-12fd-4f1e-b79b-a622dbc28b0b`
- **GSG-N2技能查询**：`session_c922b88f-216a-46ff-a60b-08980462b3f1`

### 场景 A：路径一致（D:/Kimi/-s-AI-RPG-GSG-N2）

```bash
cd "<项目路径>/sessions-backup"
unzip gsg-n2-sessions.zip -d ~/.kimi-code/sessions/
```

> `unzip` 会打印一条 "appears to use backslashes" 的警告，**解压是成功的，可忽略**。

然后在 `~/.kimi-code/session_index.jsonl` **末尾追加**两行（先备份原文件；`<你的用户目录>` 换成新设备用户名）：

```json
{"sessionId":"session_7439ba46-12fd-4f1e-b79b-a622dbc28b0b","sessionDir":"C:/<你的用户目录>/.kimi-code/sessions/wd_s-ai-rpg-gsg-n2_0801de24400c/session_7439ba46-12fd-4f1e-b79b-a622dbc28b0b","workDir":"D:/Kimi/-s-AI-RPG-GSG-N2"}
{"sessionId":"session_c922b88f-216a-46ff-a60b-08980462b3f1","sessionDir":"C:/<你的用户目录>/.kimi-code/sessions/wd_s-ai-rpg-gsg-n2_0801de24400c/session_c922b88f-216a-46ff-a60b-08980462b3f1","workDir":"D:/Kimi/-s-AI-RPG-GSG-N2"}
```

### 场景 B：路径不同（如只有 C 盘）

```bash
cd "<项目路径>/sessions-backup"
unzip gsg-n2-sessions.zip          # 解出 wd_s-ai-rpg-gsg-n2_0801de24400c/
node adjust-session-paths.js "<项目路径>"   # 例: node adjust-session-paths.js "C:/Kimi/-s-AI-RPG-GSG-N2"
mv wd_s-ai-rpg-gsg-n2_<新hash> ~/.kimi-code/sessions/
```

脚本自动完成：重算桶名（sha256 前 12 位）→ 重命名目录 → 更新两个 `state.json` 的 `cwd`/`homedir` → 备份并追加 `session_index.jsonl`。完成后确认输出里的两处路径正确即可。

### 验证恢复（两种场景通用）

```bash
cd "<项目路径>"
kimi --session session_7439ba46-12fd-4f1e-b79b-a622dbc28b0b
```

应恢复「GSG-N2主窗口」。也可 `kimi --session` 浏览列表选择。

> **重要**：恢复入口用 `--session <id>`（按 ID 全局查找会话）；**不要用 `--continue`**（它只找当前目录的 hash 桶）。
> 会话恢复属官方未明确背书的操作（官方警告勿手动编辑 sessions/ 内文件），**务必实测**。

## 9. 进入游戏

- 恢复「GSG-N2主窗口」后直接继续；或
- 开新会话，把仓库根 `RESUME.md` 的内容贴进去即可无缝续玩（游戏状态全部固化在 git 存档里，不依赖会话文件）。

## 10. 会话恢复失败怎么办（兜底）

存档不受影响，两条路：

1. **直接续玩**：新会话里贴 `RESUME.md`，按 `START_HERE.md` 继续。这是官方路径，100% 可用。
2. **重新导出会话**：在源机上用 `kimi export <sessionId>` 打包（导出前检查并替换敏感信息），再按第 8 步流程恢复。

## 常见问题

- **Q：campaign.db / .qdrant 不在仓库里？** 是的，它们被 `.gitignore` 排除、首次启动自动重建。若想保留旧数据，可把源机的 `campaign.db` 和 `.qdrant/` 单独拷贝到新设备同位置（如只有 C 盘就拷到对应路径），不影响其它文件。
- **Q：解压后会话列表里看不到？** 先确认 `session_index.jsonl` 两行已追加且路径正确；再直接 `kimi --session <id>` 试恢复。
- **Q：改完路径还是恢复失败？** 执行 `node scripts/save-verify.js` 确认项目完整，然后走第 10 步兜底。
