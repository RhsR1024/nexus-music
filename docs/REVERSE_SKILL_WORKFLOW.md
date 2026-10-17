# Sollin reverse-skill 强制工作流

2026-10-17 用户明确要求：先克隆、项目安装、完整阅读 README_AI.md 并检查当前环境；后续 Sollin IPA/APK 逆向和功能/UI/交互对齐全部使用此 skill，作为硬门禁。本文件与根 AGENTS.md 共同约束后续批次，不缩减 F01–F37/J01–J59。

## 安装与固定来源

- 来源：[zhaoxuya520/reverse-skill](https://github.com/zhaoxuya520/reverse-skill)，本机通过 `git clone https://github.com/zhaoxuya520/reverse-skill.git /Users/ningli/WorkSpace/reverse-skill` 完整取得。
- 固定提交 `cab634bd855fc287f6e420c1f36fd1a6b9245960`，VERSION `1.0.1`；升级须审阅差异、更新门禁固定值及本文件、刷新索引/路由，不默默追随 main。
- 项目安装为 `.agents/skills/reverse-skill-router -> ../../../reverse-skill/skills`，指向完整包的技能入口，保留 docs、脚本和 sidecar 相对结构。AGENTS 显式加载入口，因此不依赖本轮技能目录热刷新；下一轮可从项目技能入口读取。
- 通用 skill-installer 首次使用默认旧 Python3.7 下载因证书链校验失败，未关闭 TLS 校验。改用已成功克隆的固定源码和项目相对链接，未复制第三方源码进产品，也未写入全局 Codex/Claude 配置。
- 包主许可 MIT；CTF sidecar 为 GPLv3，其他工具各自许可。仅引用方法和工具路由，不给音枢或参考资产重新宣告统一许可。

迁移机器时在 NexusMusic 相邻目录克隆包，检出上述固定提交；相对链接随项目保留。若目录缺失，门禁失败，不能假称安装可用。

## 执行顺序与硬门

1. 读包根 `README_AI.md`、`RULES.md`、对应平台文档，以及 `skills/SKILL.md`、`MASTER-ROUTING.md`。查询 field-journal 索引；相似 Flutter 案例仅是方法参考，不是 Sollin 证据。
2. 使用包内 `skills/scripts/master-route.sh`（macOS）按具体任务路由；本轮 IPA 为 R2 `mobile-reverse/SKILL.md`，APK 为 R1 `apk-reverse/SKILL.md`。读取实际 PRIMARY，不能预设脚本输出。
3. 用 `case-init.sh --preset offline-sample --sample <明确本地文件>` 在项目 `work/<case>/` 建立 scope，注明用户本次授权和原文件，`case-guard.sh` 校验 auth=granted、offline、ready=true；分析不出网，不探测参考私有服务，不注入/签名安装。
4. 工具路径和状态以当前机器新生成的 `skills/tool-index.md/json` 为准；路径存在、CLI可执行、MCP注册/服务可用分别记录。不能照抄 APK SKILL.md 中作者机器的工具版本。
5. 先通过项目门禁，再执行 PRIMARY 的适用工作流。每个功能新建或追加工作项、不可变 Evidence、Finding、Path 和 timeline；原始字符串仅是静态线索，不等于数据关系或函数调用。
6. 采纳/提交前严格 review 当前案例，逐项核对该批功能的证据，而非复用本次安装检查。截图补充视觉，音枢本地回归/本地IPA/云端iOS27/真实服务/签名/真机分别记录。

```bash
source scripts/environment.sh
bash ../reverse-skill/skills/scripts/refresh-tool-index.sh
node scripts/sollin-reverse-gate.mjs ipa
node scripts/sollin-reverse-gate.mjs apk
# 本批 Evidence 和报告补齐后：
node scripts/sollin-reverse-gate.mjs ipa --review
node scripts/sollin-reverse-gate.mjs apk --review
```

门禁脚本校验：项目链接、固定提交、包内受控文件无修改、关键入口存在、macOS工具索引不超过7天、Python可用、样本SHA256、scope匹配PRIMARY/样本/离线以及原生 case-guard。`--review` 再调用包原生 `review_case.py --verify-hashes --strict`。脚本通过只证明这些前提，不能自动证明证据内容真实、某功能已完成或调用图已恢复；主代理仍亲读审查。任何前提失败阻止依赖它的对齐工作。

## 本机检查结果

2026-10-17 12:44–12:46（Asia/Shanghai），macOS Darwin24.6.0 / Intel。已完整阅读 README_AI 和 macOS 部署说明，按包内 Bash/Python 原生入口执行，没有运行通用大批工具安装或启动服务。

| 项目 | 实测 | 边界 |
| --- | --- | --- |
| 基础运行时 | Node24.14.0，npm/npx11.9.0，Python3.9.6，Java15.0.2 | Java现状不保证满足后续 jadx/新工具要求 |
| 高级工具 | jadx/apktool/adb/Frida/r2/rabin2/Ghidra/IDA/Binary Ninja均未检出 | 尚未具备完整反编译/动态链；按需补齐工具及验证，不为检查而全装 |
| MCP | 原始 bridge 文件存在；各逆向MCP均未ready | 文件存在不等于服务已启动/注册或工具可调用 |
| IPA案例 | R2；323个ZIP条目；CRC、固定SHA256、2.0.0/build60、App/Flutter framework存在 | 本次容器检查不恢复Dart对象/调用图，不替代已有更深静态记录 |
| APK案例 | R1；682个ZIP条目；CRC、固定SHA256、1个DEX、arm64 libapp/libflutter存在、二进制Manifest | Java/原生方法正文、双端功能等价仍待分析 |
| 严格review | 两案例均0错误/0警告，2条Evidence、1条candidate Finding、1条setup Path | 仅安装/路由/容器证据，功能分析工作项继续pending |
| 拒绝路径 | pending scope返回2；未知平台返回1 | 没有用force绕过 |

实际索引在外部包 `skills/tool-index.md/json`；路由在本机 `build/reverse-skill/routes/{ipa,apk}`；案例在 `work/sollin-{ipa,apk}`。这些均不提交、不打包。正式功能结论沿 [IPA分析](SOLLIN_IPA_ANALYSIS.md)、[对齐清单](SOLLIN_ALIGNMENT_PLAN.md)、[逐页矩阵](SOLLIN_UI_ALIGNMENT.md) 记录，保持 IPA首要、APK互补、截图辅助。

```mermaid
flowchart LR
  A[固定skill和本地样本] --> B[PRIMARY路由]
  B --> C[Scope与工具门禁]
  C --> D[Evidence Finding Path]
  D --> E[严格review与主代理核验]
  E --> F[音枢实现及分层验收]
```

后续先按 PRIMARY 补 A03/A04 设置/背景对象关系和A06–A09现有交互证据；继续保留 LX、Navidrome、WebDAV、汽水匹配、PCM/EQ、权威队列和数据安全。安装本包不增加功能完成度，不把此前未通过的云端运行改写为通过。

## 对象恢复工具增补的当前状态

已只读审阅 Blutter 固定提交及其下载/构建脚本，未执行安装器。当前上游仍按ELF提取，iOS PR204实验性且未合并，详见 [IPA分析](SOLLIN_IPA_ANALYSIS.md)。缺少的CMake/Ninja先准备独立环境脚本 `work/tooling/prepare-python-tools.sh`（忽略、不进入产品）：新建 `/Users/ningli/WorkSpace/Tools/Reverse/python-env`，从PyPI安装 cmake3.31.6、ninja1.11.1.3、pyelftools0.32并检查版本；拒绝覆盖已有目录，不启动服务或改全局配置。用户随后明确批准“批准独立工具安装”，已原样执行该脚本并exit0：cmake CLI3.31.6、ninja CLI1.11.1.git.kitware.jobserver-1（wheel1.11.1.3）、pyelftools0.32均验证通过。实际路径均在该venv/bin，安装日志build/logs/reverse-python-tools-install.log；无服务启动或全局配置变化。已刷新外部索引并补充这三项绝对路径、wheel/CLI版本、来源及验证命令（通用refresh仅检测内置34项，后续刷新需重新验证并登记这些补充项）。此请求不阻塞既有应用回归；DartVM/ICU/Capstone及iOS实验mapper仍需后续审阅与独立验收。

桌面依赖工具已只读确认另带Python3.12.14，路径`/Users/ningli/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3`；无需安装新解释器。当前工具索引主Python选此路径；隔离venv内仍是原已披露Python3.9.6，pyelftools在该venv使用。CMake/Ninja先决工具可用不等于Blutter/DartVM/ICU/Capstone已构建，更不等于对象图恢复。两离线案例严格review仍通过。
