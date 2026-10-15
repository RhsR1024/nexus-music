# 本地与GitHub Actions双构建

本地Intel MBP继续用于开发、类型/契约检查、Xcode26.3模拟器和设备IPA构建；GitHub Actions另外执行Apple Silicon/iOS27构建。两条路径共享维护中的ios工程和archive脚本，不运行覆盖性prebuild。

2026-10-15核实官方[runner列表](https://docs.github.com/en/actions/reference/runners/github-hosted-runners)与[xcode-27镜像](https://github.com/actions/runner-images/blob/main/images/macos/xcode-27-arm64-Readme.md)：`xcode-27`为arm64 Public Preview，列有Xcode27.0和iOS27.0 SDK。工作流明确选择此标签和Xcode27.0路径，检查host架构和SDK主版本。镜像标签不是不可变快照，环境可能更新/下线；实际版本以产物build-manifest.json和当次日志为准，不把macos-latest视为固定SDK。

## 自动执行

main推送、PR及手动Run workflow都会触发 `.github/workflows/ios.yml`：

1. Linux锁定Node24.14.0、npm ci、类型与合成契约检查。
2. Apple Silicon选择Xcode27/iOS27，Ruby3.3、Bundler2.4.22及Gemfile.lock中的CocoaPods1.16.2；npm ci、Pods deployment检查。
3. 原生宿主/HTTP/加密/DSP/缓存检查，以及iOS27模拟器的合成源管理、合成Navidrome登录/播放/PCM/歌词测试。不会向云端上传resource、真实音源/备份或局域网账号。
4. 同一脚本生成设备arm64 unsigned IPA，上传IPA和build-manifest作为14天Artifacts；构建日志保存7天。Actions使用固定提交SHA、只读contents权限，取消同分支过期构建。

首次云端运行结果仍须实际检查。不能以YAML存在宣称云端验收成功。Public Preview可用性和账户Actions限制也以实际运行结果为准。

首次运行发现并修复CFPropertyList3.0.9的Ruby上限，固定跨Ruby版本可用的3.0.8。第二次进入Pods，Yoga本地生成podspec在Intel和Apple Silicon出现已识别的checksum差异。CI在pod install后逐项比较锁文件，只接受两种已验证Yoga checksum之间的变化，任何依赖版本、其他checksum或配置变化仍失败；不会运行pod update或忽略整份锁文件。

运行38691008776的原生检查及Release模拟器编译通过，但App启动被iOS27终止。下载诊断产物11953711775并导出xcresult，App标准错误明确报告`UIScene life cycle is required for apps built with this SDK`，崩溃主线程为`UIApplicationEvaluateRuntimeIssueForNoSceneLifecycleAdoption`。这不是签名、依赖编译或音源网络错误。按[Apple迁移说明](https://developer.apple.com/documentation/uikit/transitioning-to-the-uikit-scene-based-life-cycle)在维护的AppDelegate.swift内增加单场景SceneDelegate和Info.plist场景声明：场景创建window并启动React，AppDelegate继续持有factory/window，重连复用同一React surface，转发URL、用户活动及前后台回调到Expo订阅者。Expo54没有新版ExpoAppSceneDelegate，故采用项目内适配，不升级整套依赖或覆盖prebuild。修复后的本地和云端结果需分别记录，不把此前编译成功算作启动通过。

迁移后本机Xcode26.3/iOS26.3.1 Release回归通过：`build/SourceUITests-1792047430065.xcresult`，音源导入/启停/删除、合成Navidrome登录/解码/PCM频谱/歌词/暂停/移除凭据两项测试均成功；97项TS检查通过。该本地证据不替代iOS27云端复验。

## 获取包

在仓库Actions选择对应成功运行，下载 `NexusMusic-iOS27-unsigned-<commit>`；解压后包含NexusMusic-unsigned.ipa与build-manifest.json。清单记录commit、是否有本地未提交修改、主机架构、Xcode、iOS SDK、Node和Pods版本。未签名包需个人签名后安装，本工作流不要求Apple密码、证书或GitHub Secrets，也不会自动发布Release。

同一源码、SDK、依赖、编译配置、签名/entitlements可获得等价的平台支持；不能承诺二进制字节完全一致。使用新SDK不会自动实现iOS27新功能，也不等于最低系统版本升为27。UI/系统行为、后台、实际音频和签名升级保留真机验收，见DEVICE_ACCEPTANCE。

## 本地命令

`npm ci` → `npm run check` → `npm run ios:pods` → `npm run ios:archive`。脚本使用相邻Tools/env.sh（若存在），也支持NEXUS_TOOLS_ENV；CI使用runner工具链。显式DEVELOPER_DIR优先。所有构建产物仍在build内，不提交Git。没有iOS27 SDK的本机继续正常编译26.2 SDK，不伪造清单中的SDK版本。
