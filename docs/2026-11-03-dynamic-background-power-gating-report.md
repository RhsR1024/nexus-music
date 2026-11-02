# 动态背景低电量模式门控（2026-11-03）

## 结论

本批补齐动态背景生命周期中的 Low Power Mode 缺口。原生 Ambient 与 Mesh 背景、React 端两份原生背景以及模糊封面位移共用同一策略：只有动画被请求、原生视图已挂载、App 位于前台、Reduce Motion 关闭并且系统 Low Power Mode 关闭时才继续运动。任一条件关闭都会停住当前相位，条件恢复后从停住位置继续，避免跳回墙钟位置。

门控由产品提交 `e3666a1e229aa8d6ed24646d802a9458ea8977b4` 引入。后续回归发现停车路径仍会清零 Ambient 与 React 模糊封面的相位；本批再由 `430754d22853348aab5852442284877fdb19e878` 完成真实的停车/恢复生命周期，并改正一个错误假设内部动画时钟会跨进程持久化的测试。最终证明门控、同一进程内的相位保留、正式 Release 回归、清洁未签名设备 IPA 和离线逆向门禁；iOS 26.3.1 模拟器没有可用的 Battery/Low Power Mode 开关，因此真实系统 Low Power Mode 切换、跨进程保持及功耗仍未验收，不能把单元测试或编译成功写成真机通过。

## 实现

- [MeshField.swift](../modules/nexus-native/ios/MeshField.swift) 新增纯值 `MotionPolicy`，集中要求 `requested && attached && appActive && !reduceMotion && !lowPowerMode`。
- [NexusAmbientView.swift](../modules/nexus-native/ios/NexusAmbientView.swift) 与 [NexusMeshView.swift](../modules/nexus-native/ios/NexusMeshView.swift) 同时观察前后台、Reduce Motion 和 `NSProcessInfoPowerStateDidChange`；两者现在共用 `MotionTimeline`。Ambient 在停车时冻结累计相位，恢复后从该位置继续；Mesh 保持相同语义。
- [NexusNativeModule.swift](../modules/nexus-native/ios/NexusNativeModule.swift) 暴露只读 `isLowPowerModeEnabled()` 与 `onPowerStateChange`，按 Expo 订阅生命周期启停通知观察，并在模块销毁时清理。
- [useLowPowerMode.ts](../src/ui/useLowPowerMode.ts) 读取原生初始值并订阅系统变化；[VisualBackground.tsx](../src/ui/VisualBackground.tsx) 将其同时接入 Ambient、Mesh 和模糊封面 `Animated` 位移。
- React 模糊封面在停车时只停止当前 `Animated` 序列，保留值、方向和剩余时长；恢复后完成原方向剩余弧段，只有封面 URI 身份变化才重置相位。
- 原生和 React 层都保留同一门控；任一层的通知到达或卸载都会停止运动。实现没有增加第二播放器、逐帧 PCM 到 React 的传递、常驻轮询、远程请求或持久化镜像状态。

## 自动检查与正式 App 回归

- `npm run check`：**990/990**，TypeScript 类型检查通过。
- `npm run test:native`：通过；[MeshFieldTests.swift](../tests/native/MeshFieldTests.swift) 枚举六种门控组合，覆盖请求、挂载、前台、Reduce Motion 和 Low Power Mode 的独立拒绝分支，并保留时间相位停车/恢复测试。
- Swift 解析、Node 测试语法与 `git diff --check` 通过。
- 最终正式 Release `build/SourceUITests-1793656409883.xcresult`：**2 passed / 0 failed / 0 skipped**，iPhone 15 Pro Max / iOS 26.3.1 Simulator / x86_64。
  - `testBackgroundMotionSwitchRoundTrip`：61.158 秒。
  - `testGlobalCoverThemeChangesAcrossPages`：579.942 秒。
  - run manifest 记录 `sourceUnchanged=true`，源码摘要 `2c1fa3a6be4895195bf09caf1f86e3fea7df919ce6ffa2bbed0d3d685c1eaf07`，源码 diff SHA-256 `2c8ed596c383c5982c8134d740fadfdf1e560c0810eb69f5c3e2aa073d278e2d`，安装 bundle 摘要 `37dfe129d3c2b8227b347f29b27405af6594cc3a8503c06732fc090050479eb8`。
  - xcresult `Info.plist` SHA-256：`427520e4865dc8245d8b83704b8e52fc587dd823a5c4779d636ac2c15e62bca2`。
- 同一进程内暂停后，14 个 RGBA 采样点仍逐字节相等。跨进程测试验证同一播放器、曲目身份、红绿蓝调色、暗亮度和稳定冻结画面；它不再要求未持久化的内部动画时钟跨进程一致。

本轮共导出 25 张 1290×2796 PNG，逐文件字节与 `index.json` SHA-256 全部一致。人工亲看四张代表图：

- `001-Softened-light-flow-restored-paused.png`
- `002-Softened-dark-flow-restored-paused.png`
- `003-Dark-paused-scene-before-restart.png`
- `013-Visible-global-background-restored-after-player-and-pause.png`

其余 21 张只完成哈希、尺寸和关联检查，不声明逐张人工验收。机器回执为 `build/logs/dynamic-background-power-gating-screenshot-verification-1793656409883.json`，SHA-256 为 `d9603d4a0ba624c12d793707544ad58f22bc4a85248a6f71e337a8c5d723f602`，`ready=true`。现有人工证据覆盖动态背景开关往返、全局封面切歌、暂停/重启及播放器收起后的可见背景；它没有覆盖系统 Low Power Mode 切换。

## 清洁归档与隐私

产品提交后的 `npm run ios:archive` 成功。`build/distribution/build-manifest.json` 记录：

- `commit=430754d22853348aab5852442284877fdb19e878`
- `dirty=false`、`workingTreeChanges=[]`
- arm64、`iphoneos26.2`、最低 iOS 15.1、设备族 `[1,2]`
- `signed=false`

manifest SHA-256 为 `909d596439fb48d8a812cc635827f649eef7b14c534d53b0236db4f57f00135f`。IPA 为 `build/distribution/NexusMusic-unsigned.ipa`，17,827,501 字节，SHA-256 `d18dac5a70e3b9ca5ebc2846f906238642cbba09944d1534719fc30a92b12c3e`。

独立核验器
`build/logs/dynamic-background-power-gating-archive-verification-430754d.json`
返回 `ready=true`：

- 178 个 ZIP entry、151 个 archive/IPA 文件 entry 逐项字节一致，0 missing、0 extra、0 mismatch；其中 63 个非元数据文件、88 个 AppleDouble 元数据文件，另有 27 个目录 entry，ZIP CRC 无错误。
- `codesign` 明确返回 `code object is not signed at all`；未发现 provisioning profile、签名材料、UI test bundle、测试入口或私人 fixture。
- 生产 `main.jsbundle` 包含 `onPowerStateChange`、`isLowPowerModeEnabled`、`ambient-motion-` 与 `ambient-mesh-`；原生可执行文件包含 `onPowerStateChange`、`isLowPowerModeEnabled` 和 `NSProcessInfoPowerStateDidChange`。
- `Info.plist`、`main.jsbundle` 与 arm64 可执行文件的 SHA-256 分别为 `c5bcc0f6b7d2a16498e899a69aea4d2016428587eec6181356b665944e5a9c09`、`867f78dc337594785c35e9d9fd392727607488c3c36869fc51b310b7143c290b`、`5724bccb839f0936338c8eb8d80c332fcf06494d569929f3a484fdadff687c53`。
- 核验回执 SHA-256 为 `f60849abc56261ef40d325a89a5230720bfe8c015fbe98ff083b59e3ca1ea459`，manifest clean、ZIP CRC、archive/IPA 逐文件字节、生产标记、私人/测试/签名排除全部通过。

## Sollin 离线证据边界

本批继续使用固定 IPA 的离线 scope，没有新增采集、目标运行、私有请求、凭据访问或目标观察。严格 `ipa --review` 为 **PASS**：56 Evidence / 21 Work Items / 119 timeline / 47 Finding / 47 Path，0 errors / 0 warnings。

动态背景实现链路沿用 `E-024 → F-023 → P-023` 的生命周期、当前封面身份和共享调色边界，以及 `E-032 → F-031 → P-031` 的软化调色与有限颜色合成边界。Low Power Mode 是音枢自身生命周期质量门控，不宣称已从参考 App 观测到相同的私有实现或计时器。

## 证据边界

已证明：

- 五项独立条件均被单一原生策略约束，任一关闭都会停止运动。
- 原生背景观察系统电量状态变化，React Ambient/Mesh/模糊封面共享原生状态。
- Ambient、Mesh 与 React 模糊封面均在同一进程内从停车位置继续；正式 Release 的动态背景与全局封面行为在模拟器中保持通过。
- 代码在 clean unsigned arm64 archive 中生效。
- clean manifest、ZIP/app 字节、架构、最低系统、生产标记、隐私/测试/签名排除通过。

仍未验收：

- 实体 iPhone 或可用模拟器上的系统 Low Power Mode 开启、关闭及前后台恢复。
- 内部动画计时是否跨进程持久化不属于当前产品契约，未作声明。
- 真实设备的帧率、CPU/GPU/电量收益、发热和长时间后台行为。
- VoiceOver、动态字号、小屏、连续动效及真实私人封面。
- 已连接到 iOS 27.0（build `24A437`）的实体 iPhone 15 Pro Max，Developer Mode 已开启，但本机没有有效 Apple 签名身份或描述文件，`com.nexusmusic.app` 尚未安装，因此无法完成签名安装、系统 Low Power Mode 实机切换与续签验证。
- iOS 27 GitHub Actions 终态。

本批不关闭 J47、完整动态背景、F/J 总表或项目。产品提交已正常 push；Actions 终态与最终 T7 归档在后续持续跟进中补充。
