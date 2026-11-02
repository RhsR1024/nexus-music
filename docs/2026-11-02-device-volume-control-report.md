# 2026-11-02 设备音量与 App 音量分离

正式播放设置现在同时提供音枢的 App 相对音量和当前 iOS 输出设备的系统音量。App 音量继续修改同一个 `AVPlayer` 的相对音量；系统音量由 Apple `MPVolumeView` 管理。此实现不持久化系统音量副本、不枚举或保存输出设备、不创建第二音频会话，也不改变单一权威队列和播放意图。

## 实现

- `PlaybackSettings` 明确说明 App 音量不修改系统输出，并在原“系统音频输出”入口前增加“设备音量 / 系统输出”卡片。
- `NexusDeviceVolumeView` 嵌入公共 `MPVolumeView`，真机由 iOS 显示当前路由的系统滑块。外层是“设备音量” adjustable 无障碍元素，增减操作转发到当前系统滑块。
- `NexusNative` 注册 `DeviceVolume` view 和主题色；没有新增网络、账号、路由凭据或媒体 URL 读取。
- 模拟器没有可使用的系统音量滑块，因此显示“当前环境未提供系统音量滑块”，同时把该说明暴露给无障碍树；不再从不可见内部 slider 读取或显示伪 0%。
- 播放选项行把副值作为按钮的 `accessibilityValue` 暴露，修复“1 首”只显示为普通子文本时 VoiceOver 和 XCUITest 无法读取的问题。

本批使用 Apple 文档化公共控件，没有新增 Sollin 原始采集、反编译或视觉结论，因而不增加 Sollin Evidence/Finding/Path 或 strict-review 完成量。既有系统输出路由的 reverse-skill 证据边界保持有效。

## 正式 App 验收

最终 Release XCUITest 为 `build/SourceUITests-1793598879537.xcresult`，在 iPhone 15 Pro Max、iOS 26.3.1、x86_64 模拟器上执行 **1 通过 / 0 失败 / 0 跳过**，测试耗时 169.709 秒。run manifest 的 `exitCode=0`、`sourceUnchanged=true`：

| 证据 | 值 |
| --- | --- |
| 源码 digest | `ababbd4fcd596e1ed75a6f4fa9ff331279d248f0cdd66ab6acba6b59b8e20eb4` |
| diff SHA-256 | `9525102ebede06ec65afc23b6a66318e8979f7e534d5a97d2876e9ec0b86faf0` |
| 安装 bundle digest | `cbeac737fdb29ba410862ffb55164d21727505003c802bf07aaad4108cb382f0` |
| `main.jsbundle` SHA-256 | `8d6d51e2f2ac20cdf1f4f36cfec6f5e89e6fa4aac7e294cbbfa0045b821e872f` |
| xcresult Info SHA-256 | `85c372b3ba36eb0104bf33584db391bfb108da9d67f02038322332eaf451c86a` |
| fixture SHA-256 | `d71e68a072adfbe2df130e50b43102d445d4defbbbcfd6839472ca187bda264f` |

场景用正式 Navidrome 夹具播放并解码合成音轨，然后暂停；验证 App 音量从 80% 调到 30%、Home 后恢复及终止重启后仍为 30%。重新进入播放器后暂停按钮、播放时间和权威队列“1 首”保持，最后把 App 音量恢复为 100% 并移除唯一夹具连接。模拟器上的系统音量元素满足至少 44pt，触摸命中不会导致页面导航或播放状态变化；测试把该动作明确记录为模拟器不可用态，不声称实体输出音量已改变。

两张最终 PNG 为 1290×2796，已逐张亲看；系统不可用说明取代了原先无反馈的空白，卡片、系统输出入口和底栏没有遮挡：

| 场景 | PNG SHA-256 |
| --- | --- |
| App 音量 30% 且系统滑块不可用 | `b9ce0360edd9a59ce2372e14529328721d0ba6bfbef3c8864e370a7aabed111d` |
| App 音量 100% 且系统滑块不可用 | `2ac5185b6b60b1f4e0896675f5a9f2a46403fe4f4e6681a2e1c3c21e5fc762f1` |

截图位于 `build/device-volume-control-20261102-r3/`，索引中的 result bundle、Info.plist SHA、附件名及 PNG SHA 相互绑定。

## 验证与失败历史

- `npm run check`：978/978，0 失败。
- `npm run test:native`：完整通过，包括实际 AVPlayer 多格式解码/PCM、系统媒体、DSP、WebDAV 和视觉原生契约。
- `npm run ios:pods`、项目 Xcode 26.3 下的 Swift parse、Node 语法和 `git diff --check` 通过。
- 最终 `npm run ios:build`：**BUILD SUCCEEDED**，日志为 `build/logs/j26-build-final-r2.log`。
- 先行 r7 `SourceUITests-1793598350996` 虽为 1/0/0，但人工检查截图发现 `MPVolumeView` 在模拟器存在不可见内部 slider，导致说明被过早隐藏并留下空白。该通过结果与原附件保留，不作为最终 UI 证据。
- 修正为对模拟器明确呈现不可用态后，r8 重新执行并通过；没有放宽暂停、持久化、队列或系统控件尺寸断言。

## 清洁未签名归档

功能提交 `02e96bd64bc96ccb2d9c1a7524b3a0a2b6de3a9e` 的归档对应同一清洁 HEAD，manifest 为 `dirty:false`、`workingTreeChanges:[]`。归档为 arm64 / iphoneos26.2 / 最低 iOS 15.1 / 设备族 `[1,2]` / `com.nexusmusic.app`，`signed:false`，没有 `_CodeSignature` 或 provisioning profile。

IPA 为 **12,894,336 字节**，SHA-256 `2a404ba8cfbce0fba73647f8f624c397eedb7f0c23aedcb5d696c87769715d9e`；build manifest SHA-256 为 `ed965ca277fa9147c834a104446d3312e58ca98bc8768f66934207c67c51eb19`。机器回执 `build/logs/device-volume-archive-verification.json` 通过：

- 164 个 ZIP 条目全部通过 CRC。
- archive 与 IPA 均有 138 个普通文件/链接条目，路径集合一致，0 缺失、0 额外、0 字节差异。
- 生产 JS 含 `DeviceVolume`、设备音量说明和 `device-volume-control`；设备可执行文件含 `NexusDeviceVolumeView`、`device-volume-slider` 及模拟器明确不可用文案。
- `fixture-secret`、`fixture-password`、`private.invalid`、测试入口、Wayfarer 私有夹具和私人备份路径均未进入包。
- 包内只有 4 处既有绝对构建路径元数据（`app` 3、`main.jsbundle` 1），归类为 `PASS_WITH_KNOWN_BUILD_METADATA`；没有私人资源路径或凭据。

## T7 阶段归档与空间维护

阶段内容复制到 `/Volumes/T7 Touch/NexusMusic/BuildArchive/2026-11-02-device-volume-control-02e96bd/`，包含 IPA、build manifest、归档验证回执、构建与归档日志、最终及已解决视觉问题的两份 xcresult、最终截图、UI 日志、本报告与规格。复制后逐文件比较大小与 SHA-256，`STAGE_RECEIPT.json` 记录全部路径、字节数和摘要；本机原始证据全部保留。

阶段收尾实测内盘约 52.3 GiB、T7 约 606 GiB 可用，未发现活动 Xcode、Pods、归档或提取进程。最末有效 r8、r7 已解决视觉问题和 IPA 均保留，`build/DeviceDerivedData` 是当前可重建增量缓存且剩余空间高于 30 GiB；本轮删除 0 字节、个人文件搬移 0 字节。精确空间、候选与保留理由见 `build/logs/cleanup-2026-11-02-device-volume-control.json`。

## 未闭环边界

当前没有实体 iPhone、耳机、蓝牙或 AirPlay 接收端。以下均未验收：实体输出音量数值变化、VoiceOver 实际上滑/下滑调整、路由切换/断开、音频会话中断、静音开关行为、iOS 27 云端运行、Apple 签名和覆盖安装。

本批只关闭正式设置中的 App/系统音量分离、模拟器集成、无可用系统滑块时的诚实降级、页面生命周期和清洁未签名构建增量。J26/F29、S10/F37 和全项目仍未完成。
