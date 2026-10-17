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


## 2026-10-17 已批准独立构建与离线提取，进行中

用户明确回复“批准独立构建并离线提取”后，已执行审阅过的`work/tooling/build-blutter-offline.sh`，最多2个编译任务，与App构建错开。脚本SHA256为`0faf45688d54d3bfac40c766d8d3794b43c3975531a2fbebd72c71709ccdc17a`，Python提取助手为`c6a3e4ff3b0c75ccf161d9902c719c3d8b66197ce59c7e7ebe5c976434bf3871`。固定ICU75.1、Capstone5.0.3、pkgconf2.3.0、Blutter实验iOS PR204提交`0039efb1b29d68ca6e5caece4d412d15e6f49428`与Dart3.12.2；工具源码/构建仅留本机Tools/Reverse，原始输出留忽略work目录。依赖下载允许联网；目标snapshot恢复在禁止网络的子进程内执行，不启动目标App、不访问Sollin服务、不上传样本。

构建成功、CLI帮助、目标解析和语义核验是不同验收；现阶段仅已启动构建，不能据此新增对象关系或函数结论。助手要求固定Dart提交及原始schema文件生成的snapshot格式摘要匹配，检查输出非空并额外拒绝上游吞异常后返回0的情况。后续仍须建立功能Evidence→Finding→Path、更新workitems/timeline并严格review后，才可采纳A03/A04结论。

首次构建在ICU固定checkout的懒加载下载阶段遭遇GitHub连接重置、early EOF，脚本exit128，未进入工具编译或样本解析。原日志保留；已仅对同一固定提交用单次`git -c http.version=HTTP/1.1`重试checkout，不修改全局配置、不切换来源/版本。App复测期间只允许该下载重试并行，工具编译仍与Xcode错开。

### 2026-10-17 固定源码下载恢复与 EQ 批次

ICU固定Git checkout在单次重试和批量对象下载中仍遇到连接重置/不完整对象，日志分别为 `build/logs/blutter-icu-fixed-checkout-retry.log` 和 `blutter-icu-batched-git-fetch.log`。现从GitHub官方codeload下载**同一提交**归档至Tools/Reverse/downloads；完成后必须检查tar完整性/路径并按固定Git树逐文件核对blob，不能把下载中字节视为完整源码。原批准构建脚本尚未恢复编译，App测试/归档与工具编译继续错开；其他三个固定依赖仅预取源码，不运行其代码。没有改变工具版本、全局配置或目标scope，仍无对象恢复结论。

本批mobile-reverse的IPA E-007→F-006→P-006用于A07既有EQ卡片，采纳前严格review通过7E/6F/6P（零错误/警告），记录见 [EQ专项报告](2026-10-17_reverse-sollin-eq-report.md)。只确认静态模块词汇，截图02/07补视觉；对象/调用关系仍待恢复。依赖独立工具的A03/A04结论继续门禁，不受本批UI实现影响。

预取补充：首个Capstone固定Git clone因Operation timed out退出，`build/logs/blutter-other-fixed-sources.log`保留；pkgconf/Blutter尚未进入该脚本后续步骤。没有把超时或不完整checkout登记为工具可用。

ICU恢复进展：官方同提交归档中所需的icu4c及根文件共6,972项已逐一匹配固定Git树blob SHA1（5,995个独立blob），由Git写入对象库并以原生Git2.50.1恢复为固定HEAD/干净稀疏工作树。复核脚本 `work/tooling/restore-icu-fixed-blobs.py`、收据 `icu-verified-source.json` 和日志 `blutter-icu-source-verify.log` 保留本机。归档其余ICU4J字节仍可下载，未称整包完整；本次使用范围只限逐文件完整核验的ICU4c。手动恢复初次命中了旧CommandLineTools Git（不支持restore），失败日志已单独保留；已改用environment.sh及索引Python3.12，无全局配置变化。设备归档结束后开始原批准参数的ICU隔离编译（make -j2），不与Xcode重叠；尚未宣称工具或对象恢复成功。其余固定源码转用同一GitHub仓库SSH、原生Git预取，提交/许可不变。

### 2026-10-17 隔离依赖构建与 Dart 源码格式核验

ICU75.1 首次编译/安装完成，但 `icuinfo` 因裸 dylib install name 无法加载；原失败日志保留。仅增加 `--enable-rpath` 后清理重建，`icu-config --version` 为75.1、`icuinfo` 初始化 `U_ZERO_ERROR`，`otool -L` 逐项指向隔离prefix，不依赖临时DYLD覆盖。原批准scope继续有效；构建脚本的新SHA256为 `0090ddbb23fb63be60144bfa0f744bd3aca6fee56eaf655171b21d351e58a279`，修复过程记入本机批准收据，没有换版本/全局配置。官方ICU全归档最终1800秒超时，已改名partial-timeout；仅采用此前逐blob核验的完整ICU4c子树，未称全归档完整。

Capstone5.0.3、pkgconf2.3.0和Blutter固定源已由同一官方GitHub仓库SSH取得并核对HEAD/干净受控文件；隔离pkgconf CLI2.3.0、Capstone pkg版本5.0.3及ARM64 `1f2003d5`→`nop`通过。四个依赖CLI二进制摘要及来源收据在 `work/tooling/isolated-dependency-receipt.json`，工具索引同步绝对路径。Dart3.12.2固定 `d684a576a6aa954ae107a03b2b4e1d61c3bebe93` 源码已准备；按官方15文件顺序本地重算格式MD5为 `ace654289f5abc240509fc941453ebc5`，与样本匹配，再用原版 `tools/make_version.py` 生成version.cc。SDK保留独立目录，通过本地链接接入Blutter；CMake canonical path产生的隔离packages目录也已链接。

恢复首轮在Capstone头文件include路径失败，改用pkgconf的CAPSTONE_INCLUDE_DIRS后，两平台VM及解析器均构建完成，`build/logs/blutter-objectpool-resume.log` exit0；补丁留隔离工具logs，辅助脚本SHA256为 `4b510d27ba5a981ca89706572e7adcafa78d99c31adda9b8ac798d9fee593691`。全程ninja -j2、无Xcode重叠；7项上游合成Mach-O Python测试通过。两样本在deny-network sandbox离线生成对象池/骨架，未运行App/服务，Frida/IDA生成脚本未执行。格式摘要匹配是必要兼容条件，不能替代对象解析正确性。当前 `NO_CODE_ANALYSIS=true` 的 `asm/*.dart` 只包含对象/函数骨架，不能写成已取得机器指令反汇编、完整反编译或调用图；后续必须独立核对FAT raw/slice/VA以及功能对象关系，再建立功能证据并严格review。

IPA独立FAT/segment/snapshot检查覆盖24,298个非零函数入口，全部落在可执行文件段；另进程重放1,455个骨架逐字节一致，仅证明重复性。限定原始ARM64 BL核查支持E-008设置分类/EQ关系，严格review通过8E/7F/7P、7工作项、12事件、零错误/警告。完整语义、动态调用与A04全局背景仍待，详见[本批报告](2026-10-17_reverse-sollin-settings-objects-report.md)。
