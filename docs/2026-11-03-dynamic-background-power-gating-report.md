# 动态背景低电量模式门控（2026-11-03）

## 结论

本批补齐动态背景生命周期中的 Low Power Mode 缺口。原生 Ambient 与 Mesh 背景、React 端两份原生背景以及模糊封面位移共用同一策略：只有动画被请求、原生视图已挂载、App 位于前台、Reduce Motion 关闭并且系统 Low Power Mode 关闭时才继续运动。任一条件关闭都会停住当前相位，条件恢复后从停住位置继续，避免跳回墙钟位置。

产品提交为 `e3666a1e229aa8d6ed24646d802a9458ea8977b4`，包含 7 个文件、`+114/-8`。本批证明门控代码、正式 Release 的既有动态背景回归、清洁未签名设备 IPA 和离线逆向门禁；iOS 26.3.1 模拟器没有可用的 Battery/Low Power Mode 开关，因此真实系统 Low Power Mode 切换、恢复、持久化及功耗仍未验收，不能把单元测试或编译成功写成真机通过。

## 实现

- [MeshField.swift](../modules/nexus-native/ios/MeshField.swift) 新增纯值 `MotionPolicy`，集中要求 `requested && attached && appActive && !reduceMotion && !lowPowerMode`。
- [NexusAmbientView.swift](../modules/nexus-native/ios/NexusAmbientView.swift) 与 [NexusMeshView.swift](../modules/nexus-native/ios/NexusMeshView.swift) 同时观察前后台、Reduce Motion 和 `NSProcessInfoPowerStateDidChange`；状态变化重新求值并停止或恢复 `CADisplayLink` / `TimelineView`。
- [NexusNativeModule.swift](../modules/nexus-native/ios/NexusNativeModule.swift) 暴露只读 `isLowPowerModeEnabled()` 与 `onPowerStateChange`，按 Expo 订阅生命周期启停通知观察，并在模块销毁时清理。
- [useLowPowerMode.ts](../src/ui/useLowPowerMode.ts) 读取原生初始值并订阅系统变化；[VisualBackground.tsx](../src/ui/VisualBackground.tsx) 将其同时接入 Ambient、Mesh 和模糊封面 `Animated` 位移。
- 原生和 React 层都保留同一门控；任一层的通知到达或卸载都会停止运动。实现没有增加第二播放器、逐帧 PCM 到 React 的传递、常驻轮询、远程请求或持久化镜像状态。

## 自动检查与正式 App 回归

- `npm run check`：**990/990**，TypeScript 类型检查通过。
- `npm run test:native`：通过；[MeshFieldTests.swift](../tests/native/MeshFieldTests.swift) 枚举六种门控组合，覆盖请求、挂载、前台、Reduce Motion 和 Low Power Mode 的独立拒绝分支，并保留时间相位停车/恢复测试。
- `git diff --check`：通过。
- 正式 Release `build/SourceUITests-1793649933674.xcresult`：**2 passed / 0 failed / 0 skipped**，iPhone 15 Pro Max / iOS 26.3.1 Simulator / x86_64。
  - `testBackgroundMotionSwitchRoundTrip`：61.118 秒。
  - `testGlobalCoverThemeChangesAcrossPages`：575.506 秒。
  - run manifest 记录 `sourceUnchanged=true`，源码摘要 `4b18a055e7e4128cb267180c32558adb836d897c0ec073502ee1afba49d7481c`，安装 bundle 摘要 `4467ca8aad44f12d619bd73b7ea34716eb2f94f02ee51b83b1532138d17f87f2`。
  - xcresult `Info.plist` SHA-256：`35c7c58aebac5d9febd54017d2526717ed56034479728501e5f628ed912296eb`。

本轮共导出 25 张 1290×2796 PNG，逐文件字节与 `index.json` SHA-256 全部一致。人工亲看四张代表图：

- `006-Three-color-flow-actual-discovery-pixels.png`
- `015-Classic-foreground-background-with-native-PCM.png`
- `003-Dark-paused-scene-before-restart.png`
- `013-Visible-global-background-restored-after-player-and-pause.png`

其余 21 张只完成哈希、尺寸和关联检查，不声明逐张人工验收。现有人工证据覆盖动态背景开关往返、全局封面切歌、暂停/重启、经典页与原生 PCM；它没有覆盖系统 Low Power Mode 切换。

## 清洁归档与隐私

产品提交后的 `npm run ios:archive` 成功。`build/distribution/build-manifest.json` 记录：

- `commit=e3666a1e229aa8d6ed24646d802a9458ea8977b4`
- `dirty=false`、`workingTreeChanges=[]`
- arm64、`iphoneos26.2`、最低 iOS 15.1、设备族 `[1,2]`
- `signed=false`

manifest SHA-256 为 `fff361d09b06588ca3dbcd6139d6a368bea8268f95fc355b3f4ea2c79f94f4b1`。IPA 为 `build/distribution/NexusMusic-unsigned.ipa`，17,826,862 字节，SHA-256 `8030f37b04a8332394a7794cdc554395f2fea5ed7e3f2208814c125b7929f895`。

独立核验器
`build/logs/dynamic-background-power-gating-archive-verification-e3666a1.json`
返回 `ready=true`：

- 178 个 ZIP entry、151 个 archive/IPA 普通文件逐项字节一致，0 missing、0 extra、0 mismatch；88 个 AppleDouble 元数据与 27 个目录 entry 另计，ZIP CRC 无错误。
- `codesign` 明确返回 `code object is not signed at all`；未发现 provisioning profile、签名材料、UI test bundle、测试入口或私人 fixture。
- 生产 `main.jsbundle` 包含 `onPowerStateChange`、`isLowPowerModeEnabled`、`ambient-motion-` 与 `ambient-mesh-`；原生可执行文件包含 `onPowerStateChange`、`isLowPowerModeEnabled` 和 `NSProcessInfoPowerStateDidChange`。
- `main.jsbundle` SHA-256 为 `aa5b601f87de772fb75ed130addc56a5caced4e78dfbe6b6b327b1158486a08a`，arm64 可执行文件 SHA-256 为 `19fc2f0a8be39f7924eb8687f70bfe518288d3a30b7437cfe0e4e8f63aad91d7`。

## Sollin 离线证据边界

本批继续使用固定 IPA 的离线 scope，没有新增采集、目标运行、私有请求、凭据访问或目标观察。严格 `ipa --review` 为 **PASS**：56 Evidence / 21 Work Items / 119 timeline / 47 Finding / 47 Path，0 errors / 0 warnings。

动态背景实现链路沿用 `E-024 → F-023 → P-023` 的生命周期、当前封面身份和共享调色边界，以及 `E-032 → F-031 → P-031` 的软化调色与有限颜色合成边界。Low Power Mode 是音枢自身生命周期质量门控，不宣称已从参考 App 观测到相同的私有实现或计时器。

## 证据边界

已证明：

- 五项独立条件均被单一原生策略约束，任一关闭都会停止运动。
- 原生背景观察系统电量状态变化，React Ambient/Mesh/模糊封面共享原生状态。
- 既有正式 Release 动态背景与全局封面行为在模拟器中保持通过；代码在 clean unsigned arm64 archive 中生效。
- clean manifest、ZIP/app 字节、架构、最低系统、生产标记、隐私/测试/签名排除通过。

仍未验收：

- 实体 iPhone 或可用模拟器上的系统 Low Power Mode 开启、关闭、前后台恢复和进程重启保持。
- 真实设备的帧率、CPU/GPU/电量收益、发热和长时间后台行为。
- VoiceOver、动态字号、小屏、连续动效及真实私人封面。
- Apple 签名、描述文件、安装、续签、iOS 27 终态。

本批不关闭 J47、完整动态背景、F/J 总表或项目。阶段 push、Actions 与最终 T7 归档在后续持续跟进中补充。
