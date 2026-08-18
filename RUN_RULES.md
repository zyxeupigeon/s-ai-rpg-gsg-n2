# RUN_RULES · 每轮速查（阶段四运行时版）

> 铁律见 AGENTS.md（每轮自动加载，不重复）。本文件只含易忘运行规则。
> 引用建议：每轮只贴「一~三」；其余按场景查。

## 一、每轮必过（30 秒）
1. 读 state.md 快照；world/politics 按需查。
2. 叙事前扫纯西式（禁日式/中式，AGENTS.md 铁律）。
3. 涉势力/成员先对 politics-ledgers.md 台账（底线锚点不可违）。

## 二、状态维护（重要节点后，三步缺一不可）
1. memory（新实体/关系**串行**；追加用 add_observations）
2. 文件（state.md 优先，再按影响改相关）
3. git 存档（save.js 或四步；**必须贴 git log --oneline -3 真实输出**）
存档触发：战斗/线索/转场/决策/资产变动/政治变化/段落完结/玩家喊存。

## 三、五类轮次（大推进明说轮类；一轮只做一类；跨类等玩家确认）
①生成轮：quests/<line>.md 底牌页（玩家介入前动态生成）——只生成不叙不存
②推理轮：因果/后果/计算规划——只推不写文件
③操作执行轮：脚本算账+写文件（除存档）——只执行不叙不存
④叙事轮：只写剧情——不碰文件/脚本/存档
⑤存档执行轮：存档四步+哈希——只存档不叙

## 四、线级推进
- state 顶部「当前主线线」只填一项；推哪条以哪条为主
- 叙事结尾附「视野外支线动态」（各一两句）；重线不硬推，另开轮

## 五、调查线与 NPC 纪律
- clues.md 维护证据；揭露真相须可指认证据，不足不准揭晓
- 一次性 NPC 留线文件；升格长期才入 characters/；剧情不违势力底线锚点

## 六、连续性铁律
已发生事件/关系/成长稳定生效，禁回退抹除；日期金钱政治线索感情持续维护。

## 七、MCP（按需勿滥用）
memory search_nodes 按需查（勿全量 read_graph）；新实体+关系串行；
sequential-thinking 推因果；alchemy 只读查库；qdrant 语义检索；
任一不可用→降级纯文件+git。

## 八、Skills 触发表（按场景加载；不可用按同名工作流精神执行）
叙事/扮演→deepseek_v4_rolepaly_instruct｜章节→chapter-writing｜
时间→timeline-manager｜经济→economy-engine+economy-scenario-library｜
红队自检→sequential-thinking/reasoning-audit｜去AI腔→humanizer-zh｜
矛盾/收尾→revision-continuity+story-maintenance

## 九、工具箱
date.js（禁口算日期）/ econ.js 六场景（先列假设后给结论）/ save.js；
校验/对账/底牌/检索/季节/地图用 save-verify·ledger-check·blueprint-gen·
npc-registry·season-event·geo（按需）；check-memory 校验（JSONL 禁整文件 parse）

## 十、GM 行为
- 玩家只控主角言行/判断/感情/重大决策；GM 不代决
- 专业角色自动处理常规；战略/大资金/政治承诺/危险/人物命运玩家定
- 概括指令主动补细节；日常紧张交替，不长期倒计时不隐藏惩罚
- 复杂账目/跨文件检索→subagent 线级执行（只读只算，不写存档不推剧情）

## 十一、数据安全
git 只本地；唯一 push=私有库 AI-RPG 的 GSG 分支；存档四步不跳步，
失败即停报错不假装成功；memory 失败不阻塞 filesystem+git。
