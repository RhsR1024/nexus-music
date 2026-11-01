# 公开平台歌单链接导入鲁棒性与错误状态

2026-11-02。本批补强正式“发现”页的公开歌单链接导入：清理从分享文案复制的输入，限制网易官方短链展开，分隔取消与迟到响应，并对超时、连接、限流、服务异常、平台拒绝、不完整结果和空歌单给出固定脱敏状态。原有分页、刷新、完整导入和歌单操作继续复用同一页面与服务边界。

## 实现

- `parsePlaylistLink` 先解码常见 HTML `&amp;`、移除零宽字符并去掉复制常见的尾部标点；纯数字 ID 保持字符串，不经过 JavaScript 安全整数。
- 链接只接受 `http/https`，拒绝凭据、显式端口和平台不匹配；平台识别使用精确官方主机匹配，`music.163.com.attacker.invalid` 一类欺骗域不能通过。
- `resolvePlaylistLink` 仅对 `163cn.tv` 及 `*.163cn.tv` 执行一次受 12 秒上限约束的展开；生产 transport 使用 `credentials:'omit'`，展开结果必须再次匹配所选平台。直接链接或 ID 不发出网络请求。
- `Discovery` 的短链解析保留输入、加载态、取消入口和失败/重试；换输入、关闭页面或重新导航都会递增代次并中止旧请求，迟到结果不能改写当前页。
- 详情首屏读取新增“取消页面读取”；刷新/分页失败保留已加载歌曲、筛选和数量，重试继续原刷新或下一页目标。空歌单显示明确空态并禁用完整导入。
- `classifyDiscoveryFailure` 将超时、连接、429、5xx、拒绝、不完整和未知结果映射为固定中文提示；短链异常不输出 provider 原文、URL、令牌或凭据。完整导入失败明确保留原音乐库。
- 归档校验新增 `nexus-ui-test-playlist-link-expander`、`https://163cn.tv/AbCd` 和本机测试端点排除，避免测试短链 transport 进入生产包。

对应交互状态见 [UI 规格](ui-spec/playlist-link-import-2026-11-02.md)。

## 验证

- `npm run check`：类型检查通过，**958/958** 项测试通过，0 失败、0 取消、0 跳过。
- `npm run test:native`：完整原生契约、音频格式与 PCM、AVPlayer、系统媒体、WebDAV、下载、缓存、视觉资产检查通过；仅保留仓库既有的 Swift 并发/弱变量编译警告。
- `node --check scripts/test-ui.mjs`、`node --check scripts/verify-archive.mjs`、`xcrun swiftc -parse ios/NexusMusicUITests/SourceSettingsTests.swift`、工作流 YAML 解析和 `git diff --check` 通过。
- 最终 Release XCUITest `build/SourceUITests-1793571403934.xcresult`：**1 通过 / 0 失败 / 0 跳过**，测试区间 185.134 秒。设备为 iPhone 15 Pro Max / iOS 26.3.1 模拟器（x86_64）。
- 测试实际覆盖欺骗域拒绝、官方短链挂起/取消/迟到释放隔离、连接失败与恢复、空歌单禁用完整导入，以及原有刷新、分页失败保留、同页重试、完整导入取消、歌单创建、重复项和清理。
- 服务计数记录 `playlistLink.requests=3`、`discovery.held=1`、`pagerPages=[0,1,1,0,0,1]` 和 `pagerFailures=2`。

## 运行 provenance

最终运行目录为 `build/logs/discovery-link-r7-20261102/`：

- `exitCode=0`，`sourceUnchanged=true`；
- 运行前后源码 digest 均为 `c5ce5b3c785a171a779c2c6d2d11009438d44a7fe8b91ad31c7fba2ea2a0ef72`；
- 运行输入 diff SHA-256 为 `e6267d41db0c59b0303c519bae627e91ac894d468df094ddcb0e82bc48f7b701`；
- fixture `tests/e2e/entry.tsx` SHA-256 为 `58b48953521ea0c7d6a2737de2b31d92342ec5115e39255c9bfe7dade577b07c`；
- 安装 bundle digest 为 `8043ad221b3700efc813ca00b5f42d92a6822aacae80f48043fc939f9a0c8b1c`；
- `main.jsbundle` SHA-256 为 `98031c8f376454245b20fcd5af059eba3d43ee68d79e35a2d09cc684236ba72a`；
- xcresult `Info.plist` SHA-256 为 `da909dd2d2b8c811c499cb75a2229a9e0c5d7948420cc356a33676916231d814`；
- run manifest SHA-256 为 `429c6d7d4d39cd5e7a956ea5124c3a52a5d7f37ddaad4a9ab741838f359b8c5a`；
- UI 日志 SHA-256 为 `498bbd610044fed7f08ae522d68989689ca30d960ee142a3d3a17f17bf7241d5`；
- 服务计数 SHA-256 为 `2968d6bc1fd1cbcad50892ce9717f66a5182a9fd31ffdb1fe5f2b5e2781980ca`；
- summary SHA-256 为 `3b5643bbfa4bc0cf26400583ac5f6f0f64dad5c6592b0002e1e1e446fa0e2b24`。

## 截图

15 张 1290×2796 PNG 位于 `build/discovery-link-final-all-20261102/`，逐张 `verifyCaptureEvidence().ready=true` 并亲看。主状态已确认按钮可点、文字未被遮挡、错误与空态清晰。截图索引 SHA-256 为 `d1910209ec7fb483354d5bfcd0ca4908b9fa71ab0ad61c75878145efdbf5bd60`，provenance review SHA-256 为 `7e1b654c3f869efe16bf74910067be3fa543cf4d6d4c695fdfdcc2f123bc789a`。

| 文件 | SHA-256 |
| --- | --- |
| `001-Both-discovery-presentations-preserve-duplicate-playlist-entries.png` | `edf2b86f9f6bb112a559bf1ef32146f4bd62dcfda188a33df2e5007fc2531508` |
| `002-Embedded-discovery-owns-its-song-action-sheet-after-tab-return.png` | `789c8bb378570c9c1f4d8788ae9c9796f7806aeff0622cec0ae090f17a8769bf` |
| `003-Discovery-action-sheet-creates-a-local-playlist.png` | `1d700ca81c9f31f37051fc4bdb394d2b95eb9b61b770bc013ea29718139346ef` |
| `004-Embedded-discovery-song-actions.png` | `8b7f19791d1a3e7370ce140d0837256e44483fd3c45c42eacc63a3cfc12d464d` |
| `005-Discovery-compact-song-rows.png` | `466ec23df3d474f7c2195e8c35f09de728f5b445dd964491b9d6d252dde88eee` |
| `006-Successful-refresh-replaces-rows-and-resets-the-next-page.png` | `ee816bf2fba88dbc2677a4b3c261122090cde7061a9ab3e8ae176cbd14136e3f` |
| `007-Refresh-failure-retains-both-loaded-pages-and-the-active-filter.png` | `afb2df963429ca7ba1c2ded7e3ebfacd39b5cb92fd6c8c43b028cb230edb458f` |
| `008-Append-retries-the-same-page-without-duplicate-rows.png` | `8e413e465edf403b11209ce853e2d09109c925848f11eec2dedd597a6b71b227` |
| `009-Append-failure-preserves-loaded-count-and-filtered-songs.png` | `0928e9ad7715f1bb73c6970b5ac25a917b49ad4bdd6f458910753d7cac490e52` |
| `010-Truncated-provider-playlist-stays-visible-and-cannot-present-an-import-confirmat.png` | `675627d1d16ebb061e28aa5dacf78ea5c18fac68da1ce63adc863e24d0d5f336` |
| `011-Discovery-navigation-cancels-full-read-and-allows-a-fresh-import-preview.png` | `773360ac31df815e4294737962b4be1b050a79760f502e5dee28a549e4f6184a` |
| `012-Empty-public-playlist-is-explicit-and-full-import-is-disabled.png` | `79c7a96089d143be2f0ad6f260e88a1e6075d491bc3d0701ed1d913af6c162ba` |
| `013-Short-link-connection-failure-is-explicit,-redacted-and-retryable.png` | `785befb76ebabb06f646a430d5dfe5f2854a391f4a5dfeea6ba5c778601c5174` |
| `014-Official-short-link-is-resolving-and-can-be-cancelled.png` | `6dd3a3f80b672fe7ffe675fabe67aa0619e34522f0dbcaa6e5268a94751c11e6` |
| `015-Invalid-public-playlist-host-stays-on-the-discovery-page-with-safe-copy.png` | `e134a8dc3831eca034e6bed1218c6ed45b8a9e5d97eebb1872c12b035fc41980` |

## 失败与修正

以下原始 xcresult 与失败附件均保留，没有用最终成功覆盖：

- `1793569961842`：测试查找“歌单导入”，实际无障碍标签为“展开歌单导入”。
- `1793570248841`：在空输入框上调用全选替换，系统没有显示 Select All。
- `1793570400542`：释放短链后测试错误期待仍有一个 held 请求，实际应为 0。
- `1793570633033`：旧的不完整导入提示断言未包含“原音乐库保留。”。
- `1793570874759`：拼接后的中文标点不自然，增加统一的 `retainedCopy` 分隔。
- `1793571132868`：刷新失败已有旧内容，但未追加“已加载内容保留。”，修正已有内容判断。

最终 `1793571403934` 通过。测试结束后的 Xcode 诊断收集仍出现当前终端环境的 `simctl not found`，但 XCTest 明确 `TEST SUCCEEDED`，不属于业务失败。

## Sollin 对齐与边界

复用既有 IPA `E-053 → F-044 → P-044 / WI-018`：只采用解析器归属、显式错误与超时、官方主机/短链族和输入清理事实。IPA strict review 为 53 Evidence / 18 Work Items / 111 timeline / 44 Findings / 44 Paths，APK strict review 为 3 Evidence / 2 Work Items / 3 timeline / 2 Findings / 2 Paths，均为 0 错误、0 警告。没有新增 Sollin 采集或目标网络访问。

Sollin 的运行时重定向、完整协议状态机、精确重试时序和视觉表现仍未证明；未移植私有服务逻辑，也不声明视觉或动效等价。

## 清洁未签名归档

功能提交 `3afe63796219ad8fdd79b81db5f0841af96af115` 已正常 push。从该清洁提交生成的本地未签名设备归档为 arm64、`iphoneos26.2`、最低 iOS 15.1、设备族 `[1,2]`，manifest `dirty:false`/`workingTreeChanges:[]`、`signed:false`。

IPA 为 12,877,854 字节，SHA-256 `685be0e0457dc07a145863107c42aa2b7d05af74bc61566c1a34cf5c327cbae4`；manifest SHA-256 为 `17f4d950892f7ee3c150b75074d68603f4c2351e64f3eb4a4639b2464a275940`。164 个 ZIP 条目 CRC 通过，138 个 archive/IPA payload 文件逐文件 SHA-256 一致；`main.jsbundle`、可执行文件和 `Info.plist` 摘要分别为 `1a95c683…`、`a673bbdf…`、`dd9d3304…`。生产 bundle 含新解析器与导入状态标记，测试短链入口、测试服务器、夹具凭据和私有路径均未进入；包内没有签名或描述文件。机器可读回执为 `build/logs/public-playlist-link-archive-verification.json`，SHA-256 `1ea16e1a59413f54ce0ec1aea8b80eed4f51a375ce001c7e01215fae0b19a096`。

## T7 归档与云端队列

本批证据副本位于外置 `NexusMusic/BuildArchive/2026-11-02-public-playlist-link-3afe637/`，885 份 payload、199,117,764 字节逐文件 SHA-256 一致；收尾再次执行 `shasum -a 256 -c SHA256SUMS` 全部通过。`SHA256SUMS` SHA-256 为 `11df1d01db09d951334151a922086b79fe5b043a670d3f3559c829ca37770dd6`，`transfer-receipt.json` SHA-256 为 `d8de3e8046644f0b92a6a8971821e05fd8da423e79d6ee8e84fb3c2776e3097a`。原阶段副本是封存时的文档快照，后续收尾文档以 Git 为准；本地原始证据仍保留。

收尾实核 iOS27：`41347977881`（`8c6db6f`）运行中，`41357843854`（`3afe637`）为唯一 pending；没有取消运行中任务或重派旧版本。当前功能尚未取得云端终态，文档提交按路径过滤不增加构建。

## 空间维护

收尾确认 T7 为真实可写挂载且没有活动 Xcode 构建。将无进程使用、未被当前运行时挂载的模拟器安装下载镜像完整迁至外置 `NexusMusic/HostArchive/2026-11-02-tool-downloads/`，10,450,316,672 字节源/目标 SHA-256 均为 `5c27425b66988a566226db88a5360e64b76b54b7e498935489a43e17707a2e2c`；原下载路径保留符号链接，目标保留迁移回执与恢复方式。没有删除个人文件内容、当前运行时或受保护证据。

内盘收尾约33 GiB可用、T7约630 GiB可用；迁移字节是逻辑内容大小，`df` 未显示等额物理回收，原因未确定，不把9.7 GiB计作实际释放量。当前DerivedData保留。小型回执为忽略目录 `build/logs/cleanup-2026-11-02-public-playlist-link.json`。

## 未完成边界

本批关闭公开歌单链接清洗、官方网易短链、取消/迟到隔离、脱敏失败、空歌单和刷新/分页保留的本地纵向增量。真实 iPhone、Apple 签名/安装、真实弱网长时、限流、后台切换、可变/私有歌单、所有平台的真实分享文本矩阵、大字号/VoiceOver、动效录屏及 iOS 27 云端终态仍单独待验；不据此关闭 F12/F13 或全项目。
