# 软件图标选择与归档回执（2026-11-03）

## 结论

音枢已在“设置 → 外观与界面”加入“软件图标”正式入口，提供主图标“珊瑚”和暖橙、青柠、海蓝、暮紫、石墨五个原创替代图标。系统当前图标是唯一状态源；原生模块只接受一个明确白名单，在主队列执行切换，并在切换中拒绝重复请求。系统失败时保留原状态并显示错误，不把按钮点击或编译成功当作应用成功。

产品提交为 `73800796a420756c9015a2a3e77a02fb11fcf188`。本批只关闭图标选择器的实现、设置导航、资源与构建增量；替代图标实际切换、重启保持、主图标恢复、实体 SpringBoard 和签名安装仍开放。

## 实现

- 五份替代图标从项目已有珊瑚色主体标记生成，保持同尺寸和不透明 RGB，不复制参考 IPA 的 SVG、平台命名、通道名或偏好键。
- React 页展示六项三列选择器、当前系统状态、44pt 以上命中区、选中/忙碌/禁用语义和严格错误文本。切换完成后以原生返回值更新状态，不另建 JS 或云备份偏好。
- `NexusAppIconModule` 暴露 `snapshot()` 与白名单枚举 `setIcon(name)`；主图标使用 `nil`，替代图标只接受 `NexusAltOrange/Green/Blue/Purple/Graphite`。
- 原生调用全部在主队列执行；未知名称、不支持、重复请求、用户取消及其他系统错误均拒绝 Promise。仅对已知瞬态 `NSPOSIXErrorDomain` `EIO/EAGAIN` 做三次有限重试。
- Xcode alternate-icon 设置、五份 asset catalog 和 Expo module 注册进入产品工程。归档 plist 同时含主图标及五个替代图标声明。

## 验证

- `npm run check`：985/985，0 失败。
- `npm run test:native`：完整原生测试通过。既有 Swift `Sendable` 与测试弱变量警告仍存在，本批没有新增失败。
- `npm run ios:build`：Release 模拟器构建通过。
- 正式 Release `SourceUITests-1793638301715`：2 passed / 0 failed / 1 skipped。
- `testAppIconOnHomeScreen` 通过：SpringBoard 可见“音枢”标签并可从主图标进入应用。
- `testGroupedSettingsNavigationAndDrafts` 通过：设置分组、外观入口和草稿保持回归通过。
- `testAppIconSelectionPersistsAndRestoresPrimary` 在模拟器原生失败被证明后跳过。设备为 iPhone 15 Pro Max、iOS Simulator 26.3.1；`LaunchServices/CoreServicesUIUpcallEmbedded` 返回 POSIX `EIO/EAGAIN`，图标没有应用。应用显示严格失败态，没有乐观更新。
- 本批生成五张 1290×2796 PNG；主图标入口、严格失败状态和分组设置总览已完成人工视觉检查。切换成功、重启持久化与恢复主图标没有图像，不能由跳过的测试补齐。

## 逆向与证据边界

- 按项目门禁使用固定离线 IPA SHA-256 `c2ee2deba236ef1b9e097e1d8cdc0b816137aa57cf85d4c8e2811dae9924bc07`，沿用 `E-055 → F-046 → P-046 → WI-020`。
- 证据只确认参考侧六种样式、三列选择器、立即更新文案和失败反馈的静态边界。没有目标进程、系统确认/取消时序、重启持久化或真机 SpringBoard 观察。
- 最终 `ipa --review` 为 PASS：55 Evidence、20 WorkItems、118 timeline events、46 Findings、46 Paths，0 errors、0 warnings。
- 本批没有新增 Sollin 采集、运行时调用、私有接口探测或视觉等价声明，也不增加完整外观目标或 J43/J46 的完成量。

## 清洁归档

- clean unsigned archive 从产品提交生成；manifest `dirty:false`、`workingTreeChanges:[]`、`signed:false`。
- 归档为 arm64、`iphoneos26.2`、最低 iOS 15.1、设备族 `[1,2]`、bundle `com.nexusmusic.app`。
- IPA 为 17,811,639 字节，SHA-256 `8cf4607d2ccfb06421e16fe7a0afc6b70bf9a6a8c89120d1c432f0fba53f9344`。
- ZIP CRC 检查无错误；archive 与 IPA 的 133 个普通文件逐字节一致，另计 18 个 exFAT `._*` 元数据条目。
- `Assets.car` 和普通/iPad `CFBundleIcons` 均含五个替代图标；`AppIcon` 主图标声明保持。
- 未发现测试适配器、参考 SVG、签名材料、描述文件、凭据或替代图标私人资源。可执行文件/Hermes 中仍有 third-party 与构建溯源绝对路径，和既往归档边界一致，不能写成完全去标识化。

## 云端与后续

产品提交已正常 push 并实核 `origin/main=73800796a420756c9015a2a3e77a02fb11fcf188`。推送后 `41455717983`/`6785769` 继续运行，`41489113091`/`7380079` 成为唯一 pending，实核队列 1 运行 / 1 排队；没有手动取消、重派或重跑旧版本。

仍待实体 iPhone 或可用 iOS 27 环境验证六个替代图标的实际应用、弹簧进度、系统确认/取消、重启保持、恢复主图标和从改变后的 SpringBoard 图标启动；VoiceOver 实际手势、动态字号、长期状态、签名、安装和续签也继续开放。iOS 27 云端终态以 `41489113091` 的实际结果为唯一依据。

本批开始前活动构建为 0；内盘约 76 GiB、T7 约 583 GiB 可用，未达到需要清理的阈值。没有删除项目或用户文件，也没有迁移来源不明的个人文件。

