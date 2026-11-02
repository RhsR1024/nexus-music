# 统一搜索五平台矩阵阶段回执

2026-11-02。本批在 J25 统一歌曲/专辑/艺术家搜索的既有入口上补齐五平台确定性 UI 矩阵、真实匿名公开契约探针和清洁设备归档。统一页仍只复用歌曲、专辑、艺术家三个现有协调器：平台切换后每类各自加载并保留总数、分页、失败与重试；歌曲预览使用现有权威队列，专辑/艺术家预览打开既有 `Discovery`。本批没有新增详情页、第二播放器或私人目录到公开搜索的通道。

功能提交为 `ac11314a3c0a13a79336f3a0ca623f51e0b0f380`（`test(search): verify unified results across five platforms`）。

## 实现

- `scripts/probe-online.mjs` 扩展为网易云、QQ、酷我、酷狗、咪咕五平台各自的歌曲、专辑、艺术家匿名公开搜索契约探针，只保留平台、类型、数量、身份字段、总数和是否有更多等去标识结果。
- `scripts/test-ui.mjs` 增加 `testUnifiedSearchAggregateFivePlatformMatrix` 路由与 fixture 生命周期，并为五平台歌曲、专辑、艺术家返回确定性、平台可区分的响应；QQ 同时兼容 `req.module` 与直接 service 封装。
- `ios/NexusMusicUITests/SourceSettingsTests.swift` 新增五平台聚合预览矩阵用例：检查五个来源、15 个预览、咪咕艺术家身份文本，以及 QQ 歌曲通过权威队列打开。
- `src/app/services.ts` 给 `createServices` 增加可选 `onlineTextHTTP` 并传入专辑、艺术家 provider；生产仍未注入时继续使用 `requestText`，测试可同时注入 JSON 与文本传输。
- `tests/e2e/entry.tsx` 让 JSON 与文本请求共用 `/nexus-ui-test-online-adapter`，覆盖酷我专辑/艺术家的文本请求，避免测试请求绕过 fixture。

## 自动检查

| 检查 | 最终结果 | 证据 |
| --- | --- | --- |
| 业务与类型检查 | **978/978，0 失败/0 取消/0 跳过** | `build/logs/j25-check-final.log`，SHA-256 `52cc8d27e82f73b6c7740efe481667f349557c7a94e798112c4d038014c8c435` |
| 完整原生测试 | 真实 AVPlayer/PCM、缓存/Range、系统媒体、WebDAV、下载和视觉资产通过；保留既有 Swift `Sendable`/弱引用警告 | `build/logs/j25-native-20261102-145357.log`，SHA-256 `db1f370f1d4a2cb432531530bffa87a9bfad1a91708096256b0e0376c942ba17` |
| 完整 Release build | **BUILD SUCCEEDED** | `build/logs/j25-build-final-20261102-151502.log`，SHA-256 `a94d87d100d167820a2914d8206162efd1342f611042185fb8c98a8c2e066ba8` |
| 五平台 UI 矩阵 | **1/0/0，131.4598 秒** | `build/SourceUITests-1793605506843.xcresult` |
| 原单平台统一搜索回归 | **1/0/0，110.7723 秒** | `build/SourceUITests-1793605767609.xcresult` |

最终两次 UI 运行均使用 iPhone 15 Pro Max、iOS 26.3.1 / 23D8133、x86_64 模拟器、430×932pt、Release。共同源码 digest 为 `981904c27f0aaea8d15f57ee5dc3806565971306b8ad33fe1393b2554e67196e`，diff SHA-256 为 `d0ea8f798b9654d2919186a5c9644a4733d20ef9562b7e399a2a94bc9701f646`，fixture SHA-256 为 `162a33a07579e25c2931cf893ce4e70994c9711ada2d2de04f2f6fc5efa6d9a3`，安装 bundle digest 为 `75ac9e7852bd943df3fece36fd32fb747b6a478fab0553b6b8d53883ea5bb6b5`；两次 `sourceUnchanged=true`、`exitCode=0`。

五平台矩阵用例从正式底栏进入搜索，使用 `Unified aggregate fixture` 查询，逐个滚动核对网易云、QQ、酷我、酷狗和咪咕的歌曲、专辑、艺术家预览；随后验证咪咕艺术家身份和 QQ 歌曲进入现有权威队列。两个关键帧共同覆盖首屏与末平台，末帧路径可见酷狗艺术家、咪咕歌曲/专辑/艺术家和滚动可达性。

| 场景 | PNG | SHA-256 |
| --- | --- | --- |
| 五平台聚合结果首屏 | `1BC8CFA4-155C-48A7-9921-D1AAC6394A06.png` | `ddd77c818f7c5c13a8d789f24f333278150dac6cb9cc98b332bafaeec534145c` |
| 滚动到末平台与咪咕三类结果 | `4270A224-FCA6-4BB0-8692-53790AA8A4DA.png` | `0c9d4ea030a21d8f3bf7784a4573fb0c111b33d63990087521dbd35bc4dc832a` |

两张均为 1290×2796 PNG，附件清单与 provenance 为 `ready`，已亲看来源、类型标题、封面/类型图标、两行标题限制、滚动位置和正常底栏。r4 另导出 5 张回归 PNG，附件清单 SHA-256 为 `a00b271ae026422b6ed614ee99de3422f7e05f4183388c279ed2dd1cb3c39f04`，逐张亲看正式详情、分页保留和统一页返回。

## 真实公开契约抽查

本机匿名公开探针使用查询 `Taylor Swift`，15 个“平台 × 类型”组合全部通过且不保留 URL、Cookie 或账号：

| 平台 | 歌曲 | 专辑 | 艺术家 |
| --- | ---: | ---: | ---: |
| 网易云 | 3 / 283 | 3 / 539 | 3 / 38 |
| QQ | 3 / 1012 | 3 / 600 | 3 / 38 |
| 酷我 | 3 / 695 | 3 / 349 | 3 / 57 |
| 酷狗 | 11 / 480 | 3 / 500 | 3 / 总数缺失，无更多 |
| 咪咕 | 13 / 141 | 3 / 150 | 1 / 1 |

每行“本页身份数 / 目录总数”；酷狗艺术家总数明确为空，探针没有伪造总数。机器可读回执为 `build/logs/online-search.json`，SHA-256 `8c58bfbcbd2e69b0b1482d5eb5f88982b2201e26d8f770e1c642a1efe43a31a0`。

这项结果证明五个公开 provider 的匿名搜索契约当前可读，不等同于在真实五平台网络上逐页操作完整 UI。五平台 UI 通过来自无凭据确定性 fixture 矩阵；两者在本批分别取证，不能互相代替。

## 失败与修正

失败原件均保留，没有用最终通过覆盖：

- r1 `SourceUITests-1793604893251.xcresult` 在手动停止前暴露 QQ 专辑/艺术家 `req.module` 被旧 fixture 拒绝。run metadata 为 `build/logs/j27-matrix-20261102-r1/run-manifest.json`，SHA-256 `2a6482fda03aa4b339f3681f9a75ac19acb0d2d0151ff5a29b91437c5db713fe`。
- r2 `SourceUITests-1793605207057.xcresult` 为 0/1/0、`sourceUnchanged=true`；酷我专辑/艺术家走 `textHTTP`，而当时只注入了 JSON 传输。修复为双传输注入后由独立 r3 重跑，r2 原件与 `build/failure-evidence/SourceUITests-1793605207057` 保留。
- 归档验证首轮把 Hermes 字节码里的中文生产文案按 UTF-8 查找，导致候选回执错误地报告生产标记缺失。复核确认 ASCII 测试 ID 为 UTF-8、中文字面量为 UTF-16LE；首轮机器回执原样保留，修正编码策略后重跑。该问题属于验证脚本探针，未触发产品代码或归档重建。

## 清洁未签名归档

功能提交 `ac11314` 后，在工作区清洁状态生成设备归档：

- archive：`build/distribution/NexusMusic.xcarchive`；IPA：`build/distribution/NexusMusic-unsigned.ipa`。
- IPA **12,899,335 字节**，SHA-256 `098da9d615004e35cbd04cc2694c047fd8a7d6453e7e4d1286024e7c6a3f0032`。
- manifest SHA-256 `081d1118cdd0be37b7a3e6010cb63238970a9212b87d42c24b762f7909226593`；`commit=ac11314…`、`dirty:false`、`workingTreeChanges:[]`。
- arm64、`iphoneos26.2`、最低 iOS 15.1、设备族 `[1,2]`、bundle ID `com.nexusmusic.app`、`signed:false`。
- 164 个 ZIP 条目 CRC 0 错误；archive/IPA 的 138 个普通文件/链接路径集合一致，逐项 SHA-256 或链接目标 0 字节差异。
- 生产字节码含 `unified-search-results`、`unified-view-all`、`跨类型结果` 和“搜索歌曲、专辑或艺术家”；测试 adapter、fixture 名称、测试服务器、私人主机、Wayfarer 夹具、签名目录和描述文件均未进入。
- 正式验证为 `build/logs/j27-archive-verification.json`，SHA-256 `a64e1d61f86ec251fec8a792ea1d8a476e3477ad90c3b61868d9c66203cba766`；编码探针首轮失败原件为 `build/logs/j27-archive-verification-initial-marker-probe-failure.json`，SHA-256 `ad428cbb140f62a9522e2bd49ad1986b312b23ff56346d7f5c974cfeaab4c223`。归档日志 SHA-256 为 `c09ec588474116e992a9e1abfad93d1b2e801ec624d8e8c57584fec8089e7407`。

未签名 IPA 只证明清洁构建、结构、生产标记和排除项；不证明 Apple 签名、安装、TestFlight 或实体 iPhone 运行。

## T7 归档与空间

T7 阶段副本位于 `/Volumes/T7 Touch/NexusMusic/BuildArchive/2026-11-02-unified-search-matrix-ac11314/`。复制范围包括 r3/r4 的 xcresult、run metadata、截图与清单，r1/r2 必要失败原件，公开探针、清洁 IPA/manifest、归档验证、构建/检查/native 日志、阶段报告和 UI 规格。源原件全部保留；完成后将逐普通文件 SHA-256 复核，并把 exFAT 自动生成的 `._*` 元数据单独计数。

主阶段复制核验：

- 289 个源 payload、105,199,379 逻辑字节；加入提交元数据与可审阅 patch 后共 291 个普通 payload、105,229,347 字节，源/目标逐文件 SHA-256 一致。
- exFAT 自动生成 326 个 `._*` 元数据文件、1,335,296 字节，单独计数，不冒充源 payload。
- `SHA256SUMS` SHA-256 为 `53e4ba1828ce1d6bced4352df61a966cd18c7845218688cf5cd168aad4b5e2f9`，291 行；`payload-index.json` SHA-256 为 `29da28c7b3c1d1754efb0ecebc2aae3ae02eb35a9c7e0859e471fcc8e32a3e0f`；`transfer-receipt.json` SHA-256 为 `a9c500c3da3d6260023accb1ec510e953c6a1990b09ac5e63886a3090a07c01b`。
- 源原件全部保留；本批没有删除项目内容或迁移项目外个人文件。

## 远程交付与 CI

`df9972f..73f975e` 已按正常 fast-forward 推送到 `origin/main`；推送后 `git ls-remote origin refs/heads/main` 与本地交付提交均为 `73f975eaa97bd1e69d549df5f6eb73ca392da435`。提交链包含功能提交 `ac11314` 与阶段文档提交 `73f975e`。

iOS 27 工作流实核：

- 最新 `41411187417` / `73f975e` 为唯一 pending。
- `41406504201` / `a279581` 仍在运行。
- 队列为 **1 running / 1 pending**，符合 `queue: single` 与 `cancel-in-progress: false`；没有取消运行中任务、手动重派或提前宣称 iOS 27 通过。
- 机器可读快照为 `build/logs/j27-ci-queue.json`。

同一观察窗口内，旧运行 `41390545740` / `cfac30c` 已自然结束为失败。失败作业为 `Verify matched playback, lyrics, source health and discovery actions`，前置 checks、iOS 27 工具链、native、首个 App 来源/Navidrome 测试组均成功，后续下载/归档步骤跳过；Workflow 页面已给出失败步骤和 artifact digest，但未登录页面不提供精确步骤日志/artifact 内容，当时 GitHub API 公共限额已耗尽。该证据已保留为后续诊断入口，不把旧 pending/失败或当前进度写成通过。

## 边界

J25 来源为用户功能清单 `U`。本批没有新增 Sollin IPA/APK 分析、原始采集、Evidence、Finding、Path 或 strict-review 申请，因此不声明新增 reverse-skill 证据链，也不声明参考版像素或动效一致。

本批关闭五平台确定性统一预览矩阵、匿名公开搜索契约抽查和当前功能提交的清洁未签名归档。真实五平台逐页网络 UI、真实 iPhone、VoiceOver 实际操作、动态字号/小屏、弱网/限流、连续转场录屏、iOS 27 终态、Apple 签名/安装及完整 J25/F/J 继续开放。
