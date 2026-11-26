# 0083：Android 双端同构架构与外置存储开发规范

日期：2026-11-26。状态：已由用户明确批准并进入实施（覆盖此前“Android 不在本期交付范围”的历史边界）。

## 决定

1. **单主干同构目录（禁止长期分叉分支）**：
   - 在 `main` 分支上统一维护 iOS 与 Android，不拉长期独立 `android` 分支（短期特性/阶段分支验收后并回 `main`）。
   - `App.tsx`、`src/**`、`assets/**` 为双端 100% 共享层，Android 不做产品功能与界面的定制化分叉，逻辑、视觉与交互保持与 iOS 一致，后续缺陷修复与体验优化双端同步生效。
   - 仓库根目录新增 `android/`（与现有 `ios/` 平级，仅执行一次 `expo prebuild --platform android` 后纳入版本控制，禁止覆盖性 `clean prebuild`）。
   - 唯一自定义本地原生包 `modules/nexus-native/` 扩展为 `common/`（双端共用的 C++ `AudioDSP.hpp` 与 LX 引导脚本 `bootstrap.js`）+ `ios/` + `android/`，并在 `expo-module.config.json` 中同时注册 `apple` 与 `android`。

2. **原生契约 1:1 对齐**：
   - Android 侧 9 个 Kotlin Expo Module（`NexusNative`、`NexusAppIcon`、`NexusPlayback`、`NexusLyrics`、`NexusMusicAuth`、`NexusFiles`、`NexusMediaLibrary`、`NexusWebDAV`、`NexusDownloads`）与 11 个原生视图严格沿用 iOS 的模块名、方法名、参数/返回结构、事件名与视图属性名，尽量减少 `src/` 中平台分支。
   - C++ `AudioDSP.hpp` 通过 Android NDK JNI 直接复用，确保 10 段 EQ 滤波、自动 headroom 与 32 段 FFT 频谱与 iOS 数学一致；LX 隔离宿主通过嵌入式 QuickJS 复用同一份 `bootstrap.js`。

3. **系统基线与客观平台差异边界**：
   - 最低支持版本：**Android 10（API 29）及以上**（兼容 Scoped Storage、MediaStore 免权限写图与系统 ICU 简繁转换）。
   - 保留 4 处系统底层客观差异并如实标注（不视为定制分叉）：① Android 12+ 实时模糊 / Android 10–11 雾面半透明材质降级；② 系统音频路由选择器与系统 `MediaStore` 本地曲库自然映射替代 AirPlay / Apple Music 曲库；③ `activity-alias` 动态换图标时部分厂商 ROM 的桌面刷新特性；④ 标准 `MediaSession` 锁屏/通知栏同步（不接入各厂商私有状态栏 Hook 歌词）。

4. **双端 CI 隔离与联动**：
   - 新增独立 `.github/workflows/android.yml`（Ubuntu runner，遵循 `queue: single`、`cancel-in-progress: false`）。
   - `ios.yml` 忽略 `android/**` 与 `modules/nexus-native/android/**`；`android.yml` 忽略 `ios/**` 与 `modules/nexus-native/ios/**`；共享层（`src/**`、`App.tsx`、`package.json`、`modules/nexus-native/common/**`）改动同时触发双端 CI。

5. **磁盘保护与 T7 Touch 外置工具链/中间产物规范**：
   - T7 Touch 物理分区为 ExFAT，不支持 JDK/NDK/Gradle 所需的 POSIX 符号链接与文件锁；因此在外置盘创建按需扩容的 APFS 稀疏磁盘映像 `/Volumes/T7 Touch/NexusMusic/AndroidWorkspace/nexus-android-dev.sparsebundle`（挂载点 `/Volumes/NexusAndroid`），集中存放 JDK 17、Android SDK/NDK/CMake、`GRADLE_USER_HOME` 缓存与中间构建目录，Mac 内盘接近零新增占用。
   - 每次构建前核验 `/Volumes/T7 Touch` 真实挂载与可写性；未挂载时停止写入，严禁在 `/Volumes` 下创建同名目录回退至内盘。验证完成的 APK 归档同步保存至 `/Volumes/T7 Touch/NexusMusic/BuildArchive/android/`。

## 分阶段实施里程碑

- **Phase 0**：决策与规范落盘、抽离 `common/` 共享资产并验 iOS 零回归、T7 Touch 外置工具链就绪、生成 `android/` 工程壳、搭建 9 模块 + 11 视图安全底座与 JNI C++ DSP 编通、产出首个可启动 Debug APK 并建立双端隔离 CI。
- **Phase 1**：核心听歌闭环（QuickJS 隔离 LX 运行时、Media3 + `MediaSessionService` 后台播放、JNI 实时 10 段 EQ/32 段 FFT 频谱、睡眠定时器与渐入渐出）。
- **Phase 2**：全站视觉与交互 1:1 对齐 iOS（`NexusLyrics` 逐字/双语/Ruby/TTML 渲染、AGSL 3×3 Mesh/流光/材质/黑胶/写真/路由/音量/手势原生视图及 RN 7 处跨平台细节抹平）。
- **Phase 3**：全外围能力补齐（SAF 目录扫描与保存、`NexusFiles`、`NexusDownloads` 断点续传、`NexusWebDAV`、`NexusMusicAuth`、`NexusPublicMVView`、`NexusMediaLibrary`、`NexusAppIcon`、简繁转换）。
- **Phase 4**：Kotlin/C++ 单元测试、真机实测验收、Release APK 签名归档与双端同步开发守则固化。
