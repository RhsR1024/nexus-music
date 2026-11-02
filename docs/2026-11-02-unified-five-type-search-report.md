# 统一搜索五类结果回执

2026-11-02。本批在既有“全部”搜索页上补齐歌单和 MV：歌曲、歌单、专辑、艺术家、MV 现在都使用各自既有协调器，在所选公开平台或聚合平台中并列预览。歌曲继续进入唯一权威播放队列，歌单、专辑、艺术家和 MV 分别打开既有详情；“查看全部”仍切到对应独立页签。本批没有新增第二套结果缓存、详情页或播放器。

## 实现

- `src/ui/Search.tsx` 将统一实体列表从歌曲/专辑/艺术家扩为五类；每类卡片继续读取对应协调器的 `groups`、`loading`、`error`、总数、重试和分页状态。
- 歌单预览复用既有公开歌单详情与返回路径；MV 预览复用既有公开 MV 详情与 `mv-back`，不把 MV 混入音乐播放队列。
- 统一重试按实体类型选择既有 `search`、`playlistSearch`、`albumSearch`、`artistSearch` 或 `videoSearch` 协调器；空结果判断覆盖五类，不再只看三类。
- 输入提示、标题、分组范围说明及图标同步覆盖五类；切换独立页签再返回“全部”时，加载后的歌单和 MV 结果继续保留。
- `scripts/test-ui.mjs` 增加网易云歌单详情和 MV 搜索/封面本地协议夹具；`ios/NexusMusicUITests/SourceSettingsTests.swift` 验证五类预览、歌单/MV 详情、返回、独立页签和结果保留。

产品、夹具与 UI 测试合计 `53+ / 17-`。对应场景和验收边界见 [UI 规格](ui-spec/unified-search-2026-11-02.md)。

## 本地 UI 验收

最终 Release 使用 iPhone 15 Pro Max、iOS 26.3.1 / 23D8133、x86_64 模拟器、430×932pt：

| 精确 xcresult | 结果 | 用例耗时 | 关键来源摘要 |
| --- | ---: | ---: | --- |
| `build/SourceUITests-1793615533426.xcresult` | 1/0/0 | 144.687 秒 | `exitCode=0`、`sourceUnchanged=true` |

最终 run manifest：

- 源码 digest：`3cae8317fcc1146d6cdd080b7e3b6d1129f443afe0048b9e37fb1f12ef5c610d`。
- 输入 diff SHA-256：`4ad6d81caae49161d4ed37c27ea15bf91f508bb008542813743c6c3d6992edf1`。
- 安装 bundle digest：`efd73f396bd36c642664b44a4112c820b983d9aa8f0cb63849fc5e748ce927f6`。
- xcresult `Info.plist` SHA-256：`c15313ec7188b8b4b733e3b5986e6e445fe1035787311e340757c8589c53a713`。

正式生产入口从正常底栏进入搜索，网易云“全部”查询同时显示五类卡片及“来源：网易云”。验证内容包括：

- 歌曲预览打开现有播放页并驱动唯一权威队列。
- 歌单预览打开现有公开歌单详情并可从“返回搜索结果”返回。
- 专辑和艺术家预览打开既有详情并返回原搜索结果。
- MV 预览打开既有公开 MV 页并由 `mv-back` 返回。
- 五类的“查看全部”分别进入对应独立页签；歌曲独立页显式加载第二页后回到“全部”，五类加载结果均保留。
- 用例末尾清理本轮 LX 测试音源，不改变私人 Navidrome 边界。

## 截图与错误态

最终 7 张 1290×2796 PNG 位于 `build/ui-screenshots-unified-five-types-1793615533426/`，逐张 provenance `ready=true` 并人工检查。覆盖艺术家、专辑、歌单、MV 的既有详情、五类首屏、滚动可达性和独立歌曲分页保留状态。

最终导出索引 SHA-256 为 `466fb28d3819a3fc38964e88d8718ef99a04c6d8efe5262375a899315c9fe6b6`。首屏总览中的标题、五类卡片、平台来源、正式底栏和触控可达性均已亲看。

首个有效运行 `build/SourceUITests-1793615144965.xcresult` 为 1/0/0，用例耗时 141.170 秒。其截图 `build/ui-screenshots-unified-five-types-1793615144965/` 保留了既有歌单详情在匿名读取成功前显示的“无法读取此公开歌单 / 重试”错误态；该错误态证明详情页失败和重试入口可达，不表示该通过用例失败。该截图索引 SHA-256 为 `8b866c89aad2afcd0302ea15938834d95728c19882745e7e70a0733afaad1650`。

更早的 `build/SourceUITests-1793615102531.xcresult` 因重复传入 `-only-testing:`，实际执行 0 个测试并以 runner exit 70 结束。该 0/0 结果保留为调用错误证据，不能改写为通过，也不替代上述正式 1/0/0。

## 自动检查

- `npm run check`：980/980。
- `node --check scripts/test-ui.mjs`：通过。
- Swift parse：通过。
- `git diff --check`：通过。
- 完整 `npm run test:native`：通过；只有既有 Swift Sendable 和 weak variable 警告。
- 最终 Release AOT build 与 UI 运行：通过。

本批只改产品代码与测试，不新增音频管线或原生逐帧路径，因此播放、状态竞态等原有原生覆盖继续按既有套件执行。

## 清洁未签名归档

从清洁 `90a0ecb93f166dc81e30e3b195b859280d117179` 生成 unsigned device archive，归档日志 `build/logs/archive-unified-five-types-20261102-184412.log` 含 `** ARCHIVE SUCCEEDED **`，日志 SHA-256 为 `1715d098939a0e4890eb934bac401b4503788280b40290119f9b41be87c8a6c4`。

- IPA：12,900,214 字节，SHA-256 `6791673c7c80ef867be73b47f0b5362b754f524f0a4480e702491a03547787d9`。
- manifest SHA-256：`fe41886212ae32bb6358790eb56b3f970b384db87bbbc021133925d92f20778e`；commit 为 `90a0ecb`，`dirty=false`、`workingTreeChanges=[]`。
- bundle：`com.nexusmusic.app`，arm64、`iphoneos26.2`、最低 iOS 15.1、设备族 `[1,2]`。
- ZIP：164 项，其中 138 普通文件、26 目录；138 个 archive/IPA 文件路径集合和逐文件字节一致，CRC 0 失败，0 缺失、0 额外、0 差异。
- 顶层无 `_CodeSignature`、无 provisioning profile；`codesign --verify` 如实返回 `code object is not signed at all`。
- 生产 `unifiedEntityHeader`、`unifiedEntityTitle`、`unifiedRetry`、`unifiedStatus` 标记存在。
- UI 测试适配器、`fixture-secret`、`private.invalid`、UITest、`NEXUS_UI_RUN_DIR`、`V261008` 及签名文件均排除。
- 独立回执 `build/ipa-verify-unified-five-types-90a0ecb/ipa-verification.json` 为 `ready=true`，SHA-256 `18bf9f2c627d2fc74a9ac45d238bfc978a069a9650317b1ff80cbb1396307d8a`。

可执行文件和 Hermes `main.jsbundle` 仍含本机绝对构建路径，定位到 third-party `EXReactLogHandler.m`、`propsConversions.h`、`RCTModuleProviders.mm` 与 Hermes 输出路径。复核未发现凭据、测试夹具、签名或 provisioning 材料；该构建溯源路径是已知例外，不能宣称 IPA 完全去标识化。

未签名包只证明清洁构建、结构和静态排除，不证明 Apple 签名、安装、升级、后台、功耗或实体 iPhone 运行。

## Sollin 证据门禁

本批按项目要求使用 `reverse-skill`，路由为 R2，PRIMARY 为 `mobile-reverse/SKILL.md`，离线 scope 继续使用既有 `work/sollin-ipa`。`case-guard`、IPA prerequisite gate 与 `ipa --review` 均 PASS；strict review 为 0 错误/0 警告、54 Evidence、19 WorkItems、116 timeline、45 Finding、45 Path。

Review 日志 `build/logs/sollin-ipa-review-unified-five-types-20261102-184916.log` SHA-256 为 `e1c8d80f6cdf5df91379ed3d0476e64006e5cb36be060889aaf0784968a34cdc`。本批没有新增 Sollin 采集、参考 App 运行、私有服务探测或新的像素/动效等价声明；歌单和 MV 复用既有审查边界与音枢正式详情交互。

## T7 阶段归档

阶段目录为 `/Volumes/T7 Touch/NexusMusic/BuildArchive/2026-11-02-unified-five-type-search-90a0ecb/`。归档包含 142 个普通 payload，其中 138 个来自本机原始证据的逐文件复制副本，另有产品/文档 diff、commit 元数据和阶段清理回执；并含最终 IPA/manifest/校验、archive/review 日志、最终与错误态 xcresult/截图、0/0 调用错误回执、run 日志、报告/UI 规格/计划文档及逐文件 `SHA256SUMS`。

138 个源文件逐份 SHA-256 与目标一致，`SHA256SUMS` 全量复核 0 失败。`transfer-receipt.json` 记录实际 payload、逻辑字节、exFAT `._*` 元数据、`SHA256SUMS` 摘要以及 `deleted=0/moved=0`；源证据全部保留。

阶段收尾检查时没有 Xcode、XCTest、archive 或提取进程。内盘约 48.99 GiB、T7 约 604.57 GiB 可用，高于 30 GiB 阈值；按用户“不确定内容优先迁移、不要删除”的要求，本批未删除或迁出旧构建内容。清理回执 `build/logs/cleanup-2026-11-02-unified-five-types.json` SHA-256 为 `e209ba48f2594abbc9b7b33b71d3a6840ae9e91d23bba3c7c98673870c6776a3`，记录 `deletedFiles=0/deletedBytes=0/movedFiles=0/movedBytes=0`。

## 云端交付与边界

功能提交 `90a0ecb93f166dc81e30e3b195b859280d117179` 已 push，本地 HEAD、`origin/main` 与该提交一致。当前同工作流/分支为旧运行 `41415230222` / `51e517a` 执行中、最新 `41430990767` / `90a0ecb` 唯一 pending，实核 1 运行/1 排队；旧 `41426350992` / `ad1cf1c` 已由 `queue:single` 自动取消，没有手动取消或重派。

本批关闭统一搜索五类入口、既有详情复用、五类状态独立和返回后结果保留这一纵向增量。真实五平台逐页网络 UI、真实 iPhone、VoiceOver、动态字号/小屏、弱网/限流、连续动效录屏、真实私有服务与授权账号、Apple 签名/安装/续签、真机后台/功耗和 iOS 27 云端终态仍独立待验；不得用模拟器、本地通过或未签名 IPA 替代。
