# 2026-11-02 系统音频输出路由入口

本批在正式“播放与歌词 → 播放控制”设置中加入“系统音频输出”，右侧嵌入 Apple `AVRoutePickerView`。AirPlay、蓝牙、耳机及当前可用设备列表由 iOS 提供；音枢不复制设备列表、不保存路由凭据、不创建第二个播放器，也不改变单一权威音乐队列。

## 实现边界

- `NexusRoutePickerView` 是 `AVRoutePickerView` 的薄封装，使用系统图标、颜色和路由面板，提供“选择音频输出”无障碍按钮、至少 44pt 的固有尺寸及 VoiceOver 激活转接。
- React 正式组件只在现有播放控制卡片中创建入口；视觉沿用设置页 token，没有新增截图专用页面、假设备或平台私有接口。
- `NexusNative` 同时登记 `tint`/`activeTint`，Podspec 增加系统 `AVKit` framework；Pods 已重装并更新 lock checksum。
- 本批没有新增账号、网络、存储、媒体 URL、Cookie 或路由凭据读取。Sollin 仅用于确认“存在系统输出入口”的交互语义；未移植其 DLNA、私网错误文案或其他商业能力。

## Sollin 反向证据门禁

按项目固定 reverse-skill 路由执行 mobile-reverse PRIMARY，固定提交为 `cab634bd855fc287f6e420c1f36fd1a6b9245960`。IPA/APK 离线样本 SHA、scope、case-guard 和原生工具索引均通过。本轮新增 E-054→F-045→P-045 与 WI-019，来源截图 `resource/reference-ui/sollin-2026-10-18/IMG_4862.PNG` 的 SHA-256 为 `f05829d5aefa97994c577c19821c8771eb00c131c7718771df1e708b2081edb4`；原始截图、反编译输出和完整案例只留在忽略目录，不进入仓库。

最终严格复核：

- IPA：54 Evidence、19 WorkItem、113 timeline events、45 Findings、45 Paths，**0 错误 / 0 警告**。
- APK：3 Evidence、2 WorkItem、3 timeline events、2 Findings、2 Paths，**0 错误 / 0 警告**。
- 该门禁只证明证据链与案例一致性，不替代 App、实体设备或路由切换验收。

## 自动化与模拟器验收

`npm run check` 通过 **967/967、0 失败**；完整 native 回归、Swift parse、Node 语法和 `git diff --check` 通过。完整 `npm run ios:build` 为 **BUILD SUCCEEDED**，`npm run ios:pods` 通过。

正式 Release XCUITest `build/SourceUITests-1793585640904.xcresult` 为 **1 通过 / 0 失败 / 0 跳过**，测试耗时 62.135 秒；设备为 iPhone 15 Pro Max、iOS 26.3.1、x86_64 模拟器。测试验证：

- 正常设置导航中可滚动到完整入口，原生控件以“选择音频输出”按钮暴露，宽高均不小于 44pt，且完整位于正式播放设置视口。
- 标题“系统音频输出”与“AirPlay、蓝牙和耳机设备由 iOS 提供。”可见。
- Home 后回前台仍可达；终止并重启 App 后仍可达。
- 没有选择或伪造任何模拟输出设备，也没有把控件渲染写成实际 AirPlay、蓝牙或耳机切换通过。

run manifest 的 `exitCode=0`、`sourceUnchanged=true`；源码 digest `5480bf2a6f8b40d14342b75c7253c9579aef4351e53ae269b4064034e3125e1a`，diff SHA-256 `ee90cdcb0759bbd4535b2a501806178535e33fcc050017c273f67a5a77479a25`，fixture SHA-256 `4994838b88689475102a36fc9ce4f49bfdd63ab3cd8a3870ead85b6197ed8a40`，安装 bundle digest `d000b37117e6a40a728f9ea19412dafd5abb1708fc916f0b74dbab2e96fd3c0d`，JS bundle `d73dc174e75cd30cc0d9292ecd4ceb0cef8993e0b0059f46703eb591e81b5760`，xcresult Info SHA-256 `ef216711ea138d0b92960f32fdbe91c7978b25cc36a71db1febf3ed6a662b1b1`。

三张 1290×2796 PNG 位于 `build/system-audio-output-route-20261102-r1/screenshots/`，逐张 provenance `ready=true` 并人工检查。截图可见完整路由行、系统 AirPlay 图标、正常滚动以及播放器/底栏布局：

| 场景 | PNG SHA-256 |
| --- | --- |
| 正常播放设置中的系统音频输出 | `12facc62c1e862b89140f7a9d2c23277408c7165e3c80fafaf4487e4fa8c4420` |
| 前台恢复后仍可达 | `0ab94340d8e83bab7e66abf3d59ebec516bcabfa4ef39e0a072b94680d24ae1e` |
| 终止重启后仍可达 | `ba512867b66b8ad142e3f8514b2db830197c93243af6a549e863416cadb896c4` |

## 未闭环边界

本机模拟器没有用于本批验收的真实 AirPlay、蓝牙或耳机接收端。因此实际打开系统面板后的设备列表、选择输出、切回扬声器、拔出/断开后的暂停或回退、来电/音频会话中断、实体 iPhone 声音路由、锁屏/控制中心交互和 iOS 27 行为均未验收。系统是否显示某些设备、面板布局及路由图标最终状态由 iOS 决定。

本地 SDK 26.2、iOS 26.3.1 模拟器、未签名构建和系统控件渲染不能替代 iOS 27 云端、签名/安装或实体设备结果。S10/F37/J59/J30 继续开放；本批只关闭正式 App 中的系统路由入口及其页面生命周期增量。

## 清洁未签名归档与远程交付

功能提交 `a5082efb4cb71a35b9c6cd80e2f4fcd42df9c490` 的归档对应同一清洁 HEAD，manifest 为 `dirty:false`、`workingTreeChanges:[]`。归档为 arm64 / iphoneos26.2 / 最低 iOS 15.1 / 设备族 `[1,2]` / `com.nexusmusic.app`，`signed:false`，包内没有 `_CodeSignature` 或 provisioning profile。IPA 为 **12,886,731 字节**，SHA-256 `c3c49b956723ea5fc74deca1162da5108719d20f43a937db098ccdbc76fbbe2f`。

机器验证位于 `build/logs/system-audio-output-route-archive-verification-a5082ef.json`，SHA-256 `2c678d81695ed05a644045f16317f193351992ba554fe79cb3d678874ac0a019`。164 个 ZIP 条目全部通过 CRC；archive 与 IPA 均有 138 个普通文件/链接条目，路径集合一致、0 缺失/0 额外/0 字节差异。`Info.plist`、可执行文件与 `main.jsbundle` 的 SHA-256 分别为 `dd9d3304202133385f743d3b89fc3af5f319faebaae0435cde36eb0b39e90452`、`d9d31b5945b4dffcdca2d18994d143cf8b06f2447f19ac3a34a6f98c31162a0c`、`97ee5063c6eb41626150e48d427a0fdc7cb0c59bc2647f35e36801b75694dfa1`。

生产包内验证到 Hermes UTF-16 的“系统音频输出”、AirPlay/蓝牙/耳机说明、“选择音频输出”原生字符串、`RoutePicker` 以及 `NexusRoutePickerView` / `AVRoutePickerView` native 标记。`fixture-secret`、`private.invalid`、`matching-audio`、`nexus-ui-test-online-adapter`、`PRIVATE_TOKEN`、Wayfarer 私有夹具和私人备份路径均未进入包。内容扫描仍发现 4 处既有绝对构建路径（`app` 3、`main.jsbundle` 1），归类为 `PASS_WITH_KNOWN_BUILD_METADATA`；没有私人资源路径或凭据。

内容快照为 `build/distribution-history/c3c49b956723ea5fc74deca1162da5108719d20f43a937db098ccdbc76fbbe2f/`，其中 IPA、checksum、manifest、验证回执逐份复核一致。T7 阶段归档为 `/Volumes/T7 Touch/NexusMusic/BuildArchive/2026-11-02-system-audio-output-route-c3c49b95/`：14 份 IPA、验证、构建日志、xcresult 摘要、UI manifest/index 与 3PNG 共 **20,401,184 字节**，逐份 SHA-256 一致；复本回执 SHA-256 为 `7ed5e174a6f484f35d74e4f0ce258b3c9e93cdfb1b1aa69df5d0cb2db997226b`，本机原始证据全部保留。

推送前远端同工作流/分支实测为 0 运行 / 1 pending（`41375349982`），未取消或重派旧运行。当前阶段收尾无活动构建/提取；内盘约 **53.95 GiB**、T7 约 **606.62 GiB** 可用，未删除或移动内容，清理决定见 `build/logs/cleanup-2026-11-02-system-audio-output-route.json`。正常 push 后的实际 HEAD、替换后的队列和新运行终态在交付收尾补录。
