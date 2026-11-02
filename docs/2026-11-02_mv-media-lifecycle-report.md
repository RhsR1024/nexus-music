# 2026-11-02 公开 MV 媒体与全屏生命周期

本批补强公开 MV 独立 WebKit 页面的真实媒体可观察结果。原生 `NexusPublicMVView` 现在只在页面可见且 App 处于前台、页面已提交并有规则可用时轮询有界的 `WKMediaPlaybackState`，停止活动时停止轮询；文档 generation 隔离导航后的迟到回调。媒体状态与 `WKWebView.fullscreenState` 通过现有 `onState` 事件交给 `MVDetail` 显示，不暴露媒体 URL、DOM 内容、Cookie 或第二个播放队列。

## 实现与交互边界

- 页面加载后状态由 `none` 进入 `playing`、`paused` 或 `suspended`；暂停、隐藏、后台或音乐重新进入 playing 时停止轮询，回到可见状态只请求当前媒体状态，不主动恢复网页播放。
- 原生实例销毁时取消轮询、全屏观察和网页加载；导航、规则和源变化重置状态，generation 检查阻止旧页面的回调覆盖新页。
- `MVDetail` 只显示明确的 MV 状态提示；权威音乐播放意图保持原逻辑，网页 MV 不进入音乐队列，也不改写音乐进度、播放列表或持久状态。
- 本批没有新增 Sollin 采集或第三方实现移植。既有 IPA/APK `--review` 门禁在本批候选上均 PASS、0 错误/0 警告；产品改动为音枢现有匿名公开页面适配的原创生命周期补强。

实际 iOS 验证发现一个必须保留的 API 边界：酷狗公开页面播放视频后进入的是系统原生媒体全屏层，可用系统 `Close Button` 进入/退出，但 `WKWebView.fullscreenState` 在此期间仍报告 `inline`。本批用系统全屏控件证据验收“原生全屏打开/退出”，没有把该结果写成 WebKit API 已跟踪全屏；WebKit `fullscreenState` 的 `entering/fullscreen/exiting` 分支仍需页面实际触发 WebKit 全屏才能单独验收。

## 自动化与真实验收

完整 `npm run check` 通过 **967/967、0 失败**。完整 native 测试、全部 Node 脚本语法、修改 Swift 文件 parse、iOS workflow YAML parse 与 `git diff --check` 均通过；既有 Swift Sendable/weak 变量警告未新增或隐藏。

正式 Release XCUITest `build/SourceUITests-1793583694048.xcresult` 为 **1 通过 / 0 失败 / 0 跳过**，118.932 秒；设备为 iPhone 15 Pro Max、iOS 26.3.1、x86_64 模拟器。run manifest `sourceUnchanged=true`、`exitCode=0`。源码 digest `514105ba5a3c2cdf5808a7fdc6b578548e9181269079a6b2e8eb998b45eef4c6`，diff SHA-256 `869452281efd8ff27ec7e5c610c4ccf743a3703157cd4e0a88f11a5e74866e33`，fixture SHA-256 `4994838b88689475102a36fc9ce4f49bfdd63ab3cd8a3870ead85b6197ed8a40`；安装 bundle digest `c933f02281d35e75188c48bd4ef2f573555a1c501a713b5c334e025a9ec3f450`，JS bundle `7bfd8294863891f834b22b4c5cacb0e0a60082e89c606ba35e3a7891f668fde0`。

正式 App 先以合成本地曲达到实际播放，再暂停并进入酷狗公开 MV “Shape of You(官方中字版)”。页面真实加载后，点击可见原生播放控件使 WebKit 返回 `media:playing,fullscreen:inline`；随后系统原生视频全屏打开，返回 `media:paused,fullscreen:inline`。按 Home 后 App 回到前台，状态稳定为 `media:suspended` 或 `media:paused`，继续等待不自动续播；退出全屏后状态仍为 `paused,inline`。返回原音乐页时播放按钮仍显示、队列仍在、进度保持测试暂停时的同一值，证明网页生命周期没有推进权威音乐。

四张 1290×2796 PNG 位于 `build/ui-screenshots-mv-kugou-lifecycle-final4-20261102-r2/`，逐张 `verifyCaptureEvidence().ready=true` 并人工检查。截图索引 SHA-256 `67bd0fd35b8d7b916593a37a08ccff08e265ecb2936f1f3b5254c8f13fa6d902`，provenance review SHA-256 `43bbba50f066a72b0e8074afbeb796962b41a6312e307baa13b9dbb07bf5016f`：

| 场景 | PNG SHA-256 |
| --- | --- |
| 暂停音乐及队列保持 | `dde45ceb29215f1d05c79a0d55453b03a8677d26186e7835b81158b917786970` |
| 后台后 MV 挂起 | `4941b6089328c82d52a7f48e76d1e64b937b88602e57009872247575f9a0f522` |
| 原生视频全屏 | `fed856000ef8f7ac586c7aef3c06231763c73cd097c049d2f02f2a263f0b5a7a` |
| WebKit 媒体实际播放 | `de49839239a1d53eea35a968d07386517df58779a7cdaea91a84c1d0c597df80` |

来源摘要：run manifest `565ca9017e7cbc0eb88d661cca55c15e4d646e38b781b26dd5fb98ea898d4312`、catalog log `8be2e2d2ebd8bfbabacc15ae4839f4e556ed453821bbc8c24aed35ba5ca77f90`、xcresult summary `0ae652e167bfbbe8f1f5ce6537f603c9e43f054d28ac0834733e0ba4bbb809fd`、xcresult Info `4b86d045d81a62acb1b9b464ae2829f874f9b6befc8061880da30268870a1aa0`，附件 manifest `f02a81a15a0e3779ae40ae1e78dea0ae55bc290af5bc370db4ec964594a2bd0d`。

## 失败保留

首次 r2 之前的尝试 `build/logs/mv-lifecycle-ui-final-20261102/` 在启动 App 前失败，未产生 XCTest 结果。当时 shell 未加载项目工具环境，`xcode-select -p` 指向 `/Library/Developer/CommandLineTools`，`/usr/bin/xcodebuild -version` 返回 `xcode-select: error: tool 'xcodebuild' requires Xcode`；这不计产品失败。原 manifest、空 catalog log 与服务器计数保留作诊断；随后显式 `source /Users/ningli/WorkSpace/Tools/env.sh` 的 r2 成功，未用 r2 覆盖 r1。

## 开放边界

真实 iPhone 的扬声器/耳机/蓝牙路由、锁屏控制、来电/音频会话中断、系统画中画与长时间后台调度仍未验收；WebKit 自身全屏状态、其他四平台真实可播放 MV、页面反嵌入/站点行为变化、失败网络与自动播放策略矩阵也未闭环。模拟器内 WebKit 播放、合成音乐和未签名构建不能替代实体机、签名/安装、iOS 27 或完整公网 MV 全平台验收。全项目、F/J 总范围与完整 MV 能力仍未完成。

## 清洁未签名归档

功能提交 `b512848c92827939d71769d845eafbde2e5cd0d1` 已从清洁工作区生成未签名归档。manifest `dirty:false`、`workingTreeChanges:[]`、commit 与 HEAD 一致；机器核验记录保存在 `build/logs/mv-lifecycle-archive-verification-b512848.json`，SHA-256 `3d3c016f78ebb5bb0fbd503b338b3ff9f5c9654f894683f6817634dd25a78037`，`ready:true`、0 failures。

IPA 为 12,884,632 字节、SHA-256 `b3bb9d4bc7659817fa6ac2b58f358896639466d07738d62623be9c5facf03b20`；build manifest SHA-256 `675f15e225bd6cab3997a9468a999756d29c01279441eec0f4048389566abdd3`。归档为 arm64、iphoneos26.2、最低 iOS 15.1、设备族 `[1,2]`、bundle `com.nexusmusic.app`；`codesign` 明确返回“code object is not signed at all”，无 `_CodeSignature`、`.mobileprovision` 或 `.provisionprofile`。

ZIP 共 164 项，其中 138 个普通文件、57 个规范 payload 与 81 个 exFAT `._*` 旁文件；CRC 0 错误，archive/IPA 的 138 项逐文件字节比较 0 缺失、0 额外、0 差异。Hermes 产物含 `mv-media-status`、`mv-native-page` 生产标记；固定测试适配器、合成/私人端点及既有夹具标记均未命中。精确 archive Info、主程序和 JS bundle SHA-256 分别为 `dd9d3304…`、`05d4dfe6…`、`a2471239…`。

首轮深度核验误把 Swift 类名 `NexusPublicMVView` 当作 Hermes JS 标记，因原生类名不出现在 JS bundle 而正确返回失败；该回执保留为 `mv-lifecycle-archive-verification-b512848-attempt1-invalid-native-marker.json`。修正为正式 React Native 组件标记 `mv-media-status`/`mv-native-page` 后重跑全部结构与字节检查并通过，并非放宽 CRC、签名或 payload 比较。

阶段副本位于 T7 `NexusMusic/BuildArchive/2026-11-02-mv-lifecycle-b512848/`，包含 IPA、manifest、两份核验回执、构建日志、精确 xcresult、四张截图、UI 摘要与清理预检；69 份文件、27,110,741 字节全部源/目标 SHA-256 一致，copy manifest SHA-256 `e7e84307522c32a0034f330c63eb5c6ded26e461c436a246c4437f2ff8fa2d7c`。本机原证据仍保留。收尾空间复核不删除任何内容，内盘约 55.3GiB、T7 约 606.7GiB 可用；活动构建为 0，`build/logs/cleanup-2026-11-02-mv-lifecycle-postflight.json` SHA-256 `5e509b808808ec7c9c5d125b3c0dfd2b52b1b60bdf98b997dc652634e958ede7`，恢复无需操作。

## 远程交付与 CI

功能提交 `b512848` 与首批文档提交 `7547851` 已按正常 fast-forward push 到 `origin/main`；push 后核对时本地 HEAD 与 `git ls-remote origin refs/heads/main` 均为 `75478512a068356586a2964286c1e0d91160b5c7`，工作区清洁。iOS 27 workflow `iOS checks and unsigned IPA` 已创建运行 [`41375349982`](https://github.com/RhsR1024/nexus-music/actions/runs/41375349982)，创建时与核对时为 `pending`，同工作流/分支当前 0 运行、1 排队。旧排队运行由 `queue: single` 自动替换，未手动重派或取消旧版本；旧运行中验证仍保留给 `cancel-in-progress:false`。本条回执使用 docs/Markdown-only 后续提交，workflow 的 `paths-ignore` 会排除它，因此不会替换上述代码运行；该运行终态返回后再补录，不把排队或本地模拟器结果当作 iOS 27 已通过。
