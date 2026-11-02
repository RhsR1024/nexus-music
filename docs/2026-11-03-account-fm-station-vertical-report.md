# 合成授权网易云私人FM正式App纵向验收（2026-11-03）

## 结论

本批补齐 `platform-fm-station` 先前留下的正式 App 纵向缺口：使用合成网易云账号、合成 Keychain 会话、合成 FM 响应和合成 WAV，经过生产 `MusicAccounts`、`AccountFmClient`、`AccountFmStation`、权威 `PlaybackController` 队列及原生 AVPlayer/PCM 通路，验证私人 FM 首次起播、低水位续批、暂停保持、去重追加、进程终止后的迟到隔离、重启恢复、空批次和失败重试保留当前曲，以及账号与测试音源清理。

本批只修改测试入口、同步测试服务器和 XCUITest，不修改生产 `index.ts` 或产品功能。它证明合成授权下的正式纵向路径；不证明真实网易账号、真实个性化 FM、真实网络服务、后台/锁屏、实体 iPhone 或签名安装。

## 实现与隔离

- [entry.tsx](../tests/e2e/entry.tsx) 仅在 `NEXUS_UI_ACCOUNT_FM_FIXTURE=1` 时保存固定合成账号与 Keychain 会话，随后使用正式 `createServices()`。生产入口没有导入该测试模块。
- [test-ui.mjs](../scripts/test-ui.mjs) 仅在精确运行 `testAccountFmStationContinuation` 时启用本地夹具服务器，提供网易云日推、FM、歌曲详情及 WAV；控制端点可切换 `normal/empty/error`、挂起下一响应并记录请求、释放和鉴权失败。
- [SourceSettingsTests.swift](../ios/NexusMusicUITests/SourceSettingsTests.swift) 新增正式 Release UI 纵向用例。它先清理旧夹具账号/音源，使用正式 UI 导入合成 LX 音源并选择 128k，再通过正式账号推荐入口开始 FM。
- 首轮响应为 `1/2/3/4`；低水位挂起后释放 `5/6/3/5`，只追加身份去重后的 `5/6`；终止进程期间再持有一个迟到响应，释放并重启后只保留六项，迟到响应不能发布。
- 所有鉴权请求只携带测试值 `MUSIC_U=synthetic-fm` 与 `__csrf=synthetic-csrf`。仓库和夹具中没有真实用户 Cookie、token、账号、歌单或媒体。

## 正式 App 验收流程

最终 Release `build/SourceUITests-1793646248544.xcresult` 为 **1 passed / 0 failed / 0 skipped**，`testAccountFmStationContinuation` 用时 **222.427 秒**，`sourceUnchanged=true`。测试设备为 iPhone 15 Pro Max / iOS 26.3.1 模拟器，源码摘要 `8af4b122…`、安装 bundle 摘要 `e997b570…`、fixture SHA-256 `e8c11330…`。

覆盖状态：

1. 合成账号保存在正式账号仓库，会话保存在 Keychain；FM 1 进入原生 PCM，播放进度实际前进。
2. 切到 FM 2、FM 3 后挂起低水位请求，暂停状态和当前曲保持；释放后权威队列从四项去重追加为六项，当前项仍为 `3/6`。
3. FM 4、FM 5 后终止 App，再释放响应并重启；队列保持 `5/6`，无第 7 首迟到发布。
4. 空批次显示合法空态，当前曲仍为 FM 5。
5. 失败重试显示受控错误，当前曲仍为 FM 5。
6. 正式 UI 删除账号和测试音源，最终服务记录 5 次 FM 请求、2 次释放、0 次鉴权失败；日推 2 次，播放仍为 128k 实际请求。

6 张 1290×2796 PNG 已逐张亲看，覆盖首次播放、低水位暂停、追加队列、终止后恢复、空批次保留和失败重试保留。截图与 run manifest 经 provenance 校验为 `ready=true`：

- run manifest SHA-256 `7e1ece047bfc04b090d6cf09f79e8796a43ff6d89381290dac0175a2142ec843`
- screenshot index SHA-256 `cdf2f43ba1241a681441980b6bdd5db9c4d7d8e98868feeb4e9f2b3d2f2dc568`
- xcresult Info.plist SHA-256 `7e4a031dbabb5e9cacaea57b6c27e395d22b9748681a099b30955f330f3afce8`

## 失败定位记录

- r1：Swift 可选值与比较类型不匹配，修正测试表达式。
- r2：只打开播放选项而没进入完整队列，修正正式队列入口。
- r3：iOS 模拟器没有暴露长按全选菜单，改为直接文本输入并保留精确值断言。
- r4：播放详情层有嵌套同名元素，改为限定到可见 `player-details-scroll`。
- r5：关闭全屏队列后仍处于播放选项层，导航前先关闭详情层。
- r6：音乐库/迷你播放器的 AX 层级不暴露当前曲标题；先打开正式播放页再断言 FM 5，未放宽行为。
- r7：失败截图后仍停留在播放页，设置 Tab 不可达；先回音乐库再移除账号。
- r8：最终通过。r1–r7 失败日志、`xcresult` 和失败层级均保留，不用最终通过覆盖失败历史。

## 检查与构建

- `npm run check`：**990/990**，typecheck 通过；日志 SHA-256 `3279b1ae…`。
- `npm run test:native`：通过，包含真实 AVPlayer 解码、PCM、HTTP Range、缓存、自然结束等既有原生套件；日志 SHA-256 `45db4e24…`。
- `npm run ios:build`：Release iPhone Simulator build succeeded；日志 SHA-256 `927313bc…`。
- 提交前 `npm run ios:archive`：unsigned device archive succeeded，arm64 / iphoneos26.2 / 最低 iOS 15.1 / 设备族 `[1,2]`；因代码与文档尚未提交，manifest 如实记录 `dirty=true`。
- 提交前 IPA 为 17,825,520 字节、SHA-256 `c1fbe5eeae35c9d082b631efa30d76eb6c0dfff878af4907d998e042ac560d37`。ZIP 178 项 CRC、151 项 archive/IPA 普通文件逐字节比较、主 JS 与可执行哈希、无测试/私人标记和无签名材料检查通过；核验回执 SHA-256 `bb4bdafb…`。
- `node scripts/sollin-reverse-gate.mjs ipa --review`：PASS，**56 Evidence / 21 Work Items / 119 timeline / 47 Finding / 47 Path，0 errors / 0 warnings**；日志 SHA-256 `80c14300…`。本批复用既有离线 scope，没有新增采集、真实账号或私有服务探测。

清洁提交后的 manifest、IPA 哈希、T7 阶段副本和 Actions 队列在阶段收尾回填。

## 证据边界

已证明：

- 合成网易云账号和会话能通过正式账号存储/选择路径驱动正式 FM 客户端。
- 正式低水位协调器只向唯一权威队列追加、去重并保持当前项与暂停意图。
- 正式原生播放通路能播放合成 WAV 并推进播放进度。
- 进程终止隔离、重启持久化、空批次、失败重试和清理路径在模拟器 Release 中通过。

仍需独立验收：

- 真实网易账号授权、真实个性化 FM、真实服务响应、配额、限流和弱网恢复。
- 自然曲尾连续续批、后台/锁屏、来电/音频中断、长时后台与功耗。
- 实体 iPhone、VoiceOver、动态字号、小屏与连续动效。
- Apple 签名、描述文件、安装、续签与商店分发。
- 完整平台 FM、F/J 总表或项目全部完成。
