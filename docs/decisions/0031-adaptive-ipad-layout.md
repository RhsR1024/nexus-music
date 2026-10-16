# 决策 0031：iPad 与横屏自适应布局

日期：2026-10-16

2026-10-16复核更正：主App的Debug/Release在`ios/app.xcodeproj/project.pbxproj`仍为`TARGETED_DEVICE_FAMILY = 1`；已构建App的UIDeviceFamily也只有1。app.json声明尚未落到维护中的原生工程，因此此前iPad窄窗口截图不能证明Stage Manager/分屏或原生平板布局。需要修正两个主App配置，再验证宽屏侧栏/旋转及分屏。此前构建成功保留为事实，平板验收和进度权重向下修正。

音枢继续使用同一套 React Native 页面和播放队列，根据可用窗口尺寸自适应，不为 iPad 建第二套业务导航或播放器。窄屏保留底部悬浮导航；宽度达到平板级别且可用高度足够时，使用安全区域内的侧栏导航、居中的内容列和隐藏底部导航，发现页按可用宽度自动计算 1–4 列卡片。

已实现：`app.json` 允许横屏并声明支持平板，iOS `Info.plist` 增加横屏方向；主壳使用 `useWindowDimensions` 和 `fontScale` 处理安全区域、侧栏、最大内容宽度和大字缩放；发现页卡片网格按宽度和字体比例自适应。该实现不改变播放器、队列、音频原生模块或数据模型。

本批本地 TypeScript、269 项业务测试、iOS26.2 Release 模拟器构建和 arm64 unsigned IPA 通过。尚未有 iPad 模拟器/真机旋转、大字、键盘、分屏和无障碍实机证据；因此 F35/J56 只记录为代码阶段部分完成，不能写成 iPad 验收完成。云端 iOS27 结果以本批提交对应运行的实际结果为准。

## 原生设备族与弹窗修正批次

维护中的主 App Debug/Release 改为设备族 `1,2`，归档脚本实际读取生成的 Info.plist 并要求同时包含 iPhone/iPad，避免只修改 Expo 配置而原生工程未生效。共享 Modal 显式允许四个方向，所有现有弹窗继续保留原来的属性和生命周期；发现网格按实际内容容器宽度计算，侧栏出现时不再按整机宽度分配封面。

本批修改前亲读的固定参考如下；提交与完整许可边界沿 [参考对比](../REFERENCE_COMPARISON.md)，本批没有复制第三方代码、图片、依赖或原生补丁。

| 固定参考 | 文件与证据 | 采纳/维护与平台边界 |
| --- | --- | --- |
| 悦音 d6f1af7 | `app.json:6,27` 为 portrait 和 supportsTablet | Expo 声明需要核对维护原生工程，不将声明当验收 |
| Q-1515 547ccfe | `src/utils/hooks/useDeviceOrientation.js:1–36` 订阅窗口尺寸并清理 | 使用当前 RN 的窗口 hook，不搬 RN0.73 导航/原生工程 |
| wtfdelphia 6624ab | `src/utils/ciSelfTest.ts:1730–1772` 实际尺寸旋转断言，另有缓存重同步兜底 | 测真实窗口和 RN 布局，不采用修改尺寸缓存让断言通过的路径 |
| CyMusic bf0d46 | `ios/CyMusic.xcodeproj/project.pbxproj:439,466,493,515` 设备族1,2；`src/app/_layout.tsx` SafeAreaProvider/Stack | 同时维护原生配置与安全区域，不引入 Expo57/RNTP 或第二播放器 |
| Wayferar 8e47cdc | `docs/SETTINGS_POLISH.md:6–8` 可用宽度网格/横屏键盘；`docs/releases/2026-10-13-287.md:9,31` 宽高门槛/过期回调 | 共享响应式原则，不移植 Android 布局、权限或车机资源 |
| Sollin c9d446f | `src/components/Layout.tsx` 分离 Sidebar、Player 与 MiniPlayer | 参考职责，Electron/DOM 不能当 RN iPad 实现 |

TS 窗口布局/Modal 属性可以供未来 Android 复用；设备族和方向属于 iOS 工程配置，Android 仍需独立系统验证。测试只能操作系统真实窗口控制，不修改生产尺寸、不使用私有旋转接口或新增生产测试入口。初次专项二进制 UIDeviceFamily 已实读为1,2，但系统保留635点窄窗口，因此宽屏断言失败；这是有价值的前置失败，不标记整项通过。后续结果见 BUILD_STATUS；真正分屏切换、键盘、大字/无障碍和用户设备仍分别验收。
