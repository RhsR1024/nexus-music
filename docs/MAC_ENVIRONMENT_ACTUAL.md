# 本机环境实测

日期：2026-10-14（Asia/Shanghai）。仓库基线 b0f0803。

## 结论

基础 iOS 编译工具链已安装并通过 SDK 编译检查。Expo54/RN0.81候选工程已通过Release模拟器构建和首屏启动；签名与真实播放尚未验证。

| 项目 | 实测 |
| --- | --- |
| 目录 | /Users/ningli/WorkSpace/NexusMusic，本机 SSD |
| Git 拉取 | 最初SSH认证失败，以HTTPS克隆；2026-10-15已验证SSH认证与push，origin切为SSH |
| 硬件 | MacBookPro15,1，Intel 六核 i7 2.6 GHz，16 GB RAM，x86_64 |
| macOS | 15.8.1，24H32 |
| 磁盘 | 可用约 120 GiB（安装工具前） |
| Git | /usr/bin/git，2.21.0 Apple Git-122.2，可用 |
| Node / npm | /usr/local/bin/node，24.14.0 / 11.9.0，可用；项目版本待锁定 |
| Homebrew | 已有 5.0.16；未使用它批量升级系统工具 |
| Command Line Tools | /Library/Developer/CommandLineTools；clang 11.0.0，工具较旧 |
| 完整 Xcode / iOS SDK | Tools/Xcode/Xcode.app，Xcode 26.3（17C529），iOS 26.2 SDK；首次启动检查通过 |
| Ruby | 系统 2.6.10；未改系统 Ruby |
| Bundler | 2.3.26 与 2.4.22 隔离安装在 Tools/gems；2.4.22 在旧 RubyGems 下有兼容警告，后续使用 2.3.26 |
| CocoaPods | 1.16.2，Tools/gems 隔离安装；bundle check 与 pod --version 通过；Tools/Gemfile.lock 已生成 |
| Watchman / Yarn / pnpm | 未检测到；工程未锁版本，暂不安装这些可选工具 |
| 真机 / 签名 / 后台播放 | 未验证，手机系统沿用用户报告 iOS 27.0 |

## 工具目录与下一步

已创建 `/Users/ningli/WorkSpace/Tools`，有 env.sh、Gemfile、隔离 gems、downloads、Xcode 目录和 README。现有 Git、Node 不迁移或重复安装。

1. 已从用户下载的 Xcode_26.3_Universal.xip 解压到 Tools/Xcode/Xcode.app；codesign 深度校验通过，用户完成许可及首次启动授权。
2. `source /Users/ningli/WorkSpace/Tools/env.sh` 后，xcodebuild 26.3、Clang 17.0.0、iphoneos 26.2 SDK 可用。系统 xcode-select 仍保留原命令行工具配置；使用本项目环境脚本选择完整 Xcode。
3. CocoaPods 1.16.2 已可用。为避开慢速大索引，按 RubyGems 官方 API 解析依赖并以官方 SHA256 核验下载，最后用 Bundler 本地解析生成锁文件。ffi 使用 x86_64-darwin 预编译包；nkf/json 编译时通过仅本次构建生效的 ruby-sdk-headers.rb 选择 SDK 中的 universal-darwin25 Ruby 2.6 头文件，未修改系统 Ruby 或 SDK。
4. 实测：UIKit / AVFoundation / MediaPlayer 的 Swift 类型检查和 arm64 iOS 对象文件编译通过；xcodeproj 创建/读取工程通过；CocoaPods/ffi/json/nkf 加载通过。检查文件在 Tools/checks，不是应用实现。
5. iOS26.3.1 Universal Simulator（23D8133）已下载到Tools/downloads，并重新注册消除重复运行时问题；iPhone15ProMax模拟器已启动，App安装与首屏截图通过。
6. Expo54.0.37 / RN0.81.5 / Node24.14.0 / Pods1.16.2的候选基线已实际Release构建通过；具体记录见 [BUILD_STATUS.md](BUILD_STATUS.md)。播放器及其他原生依赖仍逐项验证，iOS27手机和免费签名未验收。

Apple 官方系统要求（本次直接打开核对，而非仅用搜索摘要）：Xcode 26.3 支持 macOS 15.6 起、包含 iOS 26.2 SDK；Xcode 26.4.1/26.5/26.6 要求 macOS 26.2 起；Xcode 27 要求 macOS 26.6 起。

来源：https://developer.apple.com/xcode/system-requirements
下载：https://developer.apple.com/download/all/?q=Xcode%2026.3

旧 SDK 构建的常规应用能否满足目标机需要实际测试；未承诺 iOS 27 专有 API 或完整调试可用。模拟器和 Apple 组件可能位于系统/用户 Library，无法将所有文件强制集中到 Tools。
