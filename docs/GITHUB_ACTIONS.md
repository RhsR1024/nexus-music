# 本地与GitHub Actions双构建

本地Intel MBP继续用于开发、类型/契约检查、Xcode26.3模拟器和设备IPA构建；GitHub Actions另外执行Apple Silicon/iOS27构建。两条路径共享维护中的ios工程和archive脚本，不运行覆盖性prebuild。

2026-10-15核实官方[runner列表](https://docs.github.com/en/actions/reference/runners/github-hosted-runners)与[xcode-27镜像](https://github.com/actions/runner-images/blob/main/images/macos/xcode-27-arm64-Readme.md)：`xcode-27`为arm64 Public Preview，列有Xcode27.0和iOS27.0 SDK。工作流明确选择此标签和Xcode27.0路径，检查host架构和SDK主版本。镜像标签不是不可变快照，环境可能更新/下线；实际版本以产物build-manifest.json和当次日志为准，不把macos-latest视为固定SDK。

## 自动执行

main推送、PR及手动Run workflow都会触发 `.github/workflows/ios.yml`：

1. Linux锁定Node24.14.0、npm ci、类型与合成契约检查。
2. Apple Silicon选择Xcode27/iOS27，Ruby3.3、Bundler2.4.22及Gemfile.lock中的CocoaPods1.16.2；npm ci、Pods deployment检查。
3. 原生宿主/HTTP/加密/DSP/缓存检查，以及iOS27模拟器的合成源管理、合成Navidrome登录/播放/PCM/歌词测试。不会向云端上传resource、真实音源/备份或局域网账号。
4. 同一脚本生成设备arm64 unsigned IPA，上传IPA和build-manifest作为14天Artifacts；构建日志保存7天。Actions使用固定提交SHA、只读contents权限；同分支按下文设置保留阶段运行并排队。

首次云端运行结果仍须实际检查。不能以YAML存在宣称云端验收成功。Public Preview可用性和账户Actions限制也以实际运行结果为准。

首次运行发现并修复CFPropertyList3.0.9的Ruby上限，固定跨Ruby版本可用的3.0.8。第二次进入Pods，Yoga本地生成podspec在Intel和Apple Silicon出现已识别的checksum差异。CI在pod install后逐项比较锁文件，只接受两种已验证Yoga checksum之间的变化，任何依赖版本、其他checksum或配置变化仍失败；不会运行pod update或忽略整份锁文件。

运行38691008776的原生检查及Release模拟器编译通过，但App启动被iOS27终止。下载诊断产物11953711775并导出xcresult，App标准错误明确报告`UIScene life cycle is required for apps built with this SDK`，崩溃主线程为`UIApplicationEvaluateRuntimeIssueForNoSceneLifecycleAdoption`。这不是签名、依赖编译或音源网络错误。按[Apple迁移说明](https://developer.apple.com/documentation/uikit/transitioning-to-the-uikit-scene-based-life-cycle)在维护的AppDelegate.swift内增加单场景SceneDelegate和Info.plist场景声明：场景创建window并启动React，AppDelegate继续持有factory/window，重连复用同一React surface，转发URL、用户活动及前后台回调到Expo订阅者。Expo54没有新版ExpoAppSceneDelegate，故采用项目内适配，不升级整套依赖或覆盖prebuild。修复后的本地和云端结果需分别记录，不把此前编译成功算作启动通过。

迁移后本机Xcode26.3/iOS26.3.1 Release回归通过：`build/SourceUITests-1792047430065.xcresult`，音源导入/启停/删除、合成Navidrome登录/解码/PCM频谱/歌词/暂停/移除凭据两项测试均成功；97项TS检查通过。该本地证据不替代iOS27云端复验。

提交2e7da07的[云端运行38695984346](https://github.com/RhsR1024/nexus-music/actions/runs/38695984346)已全部成功：Linux、原生检查、iOS27两个App测试及设备IPA归档/上传通过。IPA产物11956175468保留至2026-10-29。此运行的Node20提示来自upload-artifact v4自带运行时，不是项目Node24配置或IPA错误；上传已成功。现两处上传步骤升级到官方[v7.0.2](https://github.com/actions/upload-artifact/releases/tag/v7.0.2)，固定SHA cf430e030ddbb5b0abf93d22962f4752f3646cd9，action.yml原生使用node24，保留默认ZIP与多文件上传方式。新版本仍需下一轮实际上传复验。

升级已实际验收：[2b78e43运行38700544730](https://github.com/RhsR1024/nexus-music/actions/runs/38700544730)全部成功，两个v7.0.2上传步骤成功，IPA产物11957042787、诊断11957302431；日志无Node20弃用警告，设备归档仍为arm64/iphoneos27.0。

## 获取包

在仓库Actions选择对应成功运行，下载 `NexusMusic-iOS27-unsigned-<commit>`；解压后包含NexusMusic-unsigned.ipa与build-manifest.json。清单记录commit、是否有本地未提交修改、主机架构、Xcode、iOS SDK、Node和Pods版本。未签名包需个人签名后安装，本工作流不要求Apple密码、证书或GitHub Secrets，也不会自动发布Release。

同一源码、SDK、依赖、编译配置、签名/entitlements可获得等价的平台支持；不能承诺二进制字节完全一致。使用新SDK不会自动实现iOS27新功能，也不等于最低系统版本升为27。UI/系统行为、后台、实际音频和签名升级保留真机验收，见DEVICE_ACCEPTANCE。

## 本地命令

`npm ci` → `npm run check` → `npm run ios:pods` → `npm run ios:archive`。脚本使用相邻Tools/env.sh（若存在），也支持NEXUS_TOOLS_ENV；CI使用runner工具链。显式DEVELOPER_DIR优先。所有构建产物仍在build内，不提交Git。没有iOS27 SDK的本机继续正常编译26.2 SDK，不伪造清单中的SDK版本。

## 阶段构建排队（2026-10-15）

为保留阶段验收，concurrency 同分支设置 cancel-in-progress: false、queue: max：新的阶段 push 进入队列，不中断当前构建，也不以最新 pending 替换前一个 pending。GitHub 当前官方文档支持最多100个等待运行，达到上限后新的运行会取消；不能承诺无限排队或严格按提交时间排序。依据：https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency 。

S1 2cb91a6 对应运行38728228483仍在验证iOS App。五皮肤功能提交b7d7226本地Release UI通过，并生成未签名IPA：build/distribution/NexusMusic-unsigned.ipa，arm64/iphoneos26.2，清洁构建清单记录b7d7226，SHA256 a5fb7627e40ab3ae403241b6dee7b99461126c08d227cf8b0ee46a429efdc644。此包不冒充云端iOS27包，云端后续运行状态另行记录。

## S1 云端失败定位（38728228483）

2cb91a6：Linux/原生检查/Release编译通过；外观持久化测试通过、Navidrome真实合成流/PCM/歌词/暂停/删凭据通过，只有SourceManager失败。诊断产物11971211239已下载到忽略的build/s1-ios27-diagnostics（未提交）。ui-catalog.log:68351 为源启用按钮不存在；68260附近显示“从地址导入”点击点{-1,-1}，最终AX树F39BFE1E显示意外进入tab-library，源未导入。iPhone17视口402×874，按钮y771附近被悬浮底栏覆盖。日志之后的600秒诊断收集超时是额外耗时，不是唯一测试失败原因，不应归因为普遍模拟器坏掉。

修复：根内容区按底部chrome的实际onLayout高度+安全区收缩可滚动视口，保留浮动视觉；移除原来仅靠内容尾部大padding的方案。UI测试新增导入后仍在设置tab的断言，并在本地iPhone17紧凑视口复验源管理和五皮肤/播放回归。4db78c4运行38732185670在定位时已启动，仍包含旧布局；修复将正常提交push并排队，不将旧运行结果冒充修复验收。

WebDAV云端38826891584（258772e）最终成功：checks、native、7项App UI步骤、arm64/iOS27归档与上传全部通过。下载产物12016923864已校验IPA SHA256 3d19c67ffdc5f1cd3b1078aa82318e2e377a46a93a5d949dfb6eda79d1fad99b，manifest为arm64/macOS27.0.1/Xcode27.0 27A266a/iphoneos27.0/min15.1/signed=false。dirty=true如实保留；日志确认已知Intel/ARM Yoga podspec checksum差异且Pod锁版本比较通过，不称清洁云端工作树。本批构建清单新增workingTreeChanges，后续可直接定位变化文件，不隐藏dirty。S7匹配代码仍待新运行。

## 2026-10-16 08:54 运行失败

38832172978的完整诊断产物12019301035定位为WebDAV测试关闭页面后，iOS系统Save Password?远程sheet遮挡mini播放器；旧Swift第73行频谱等待失败，点击hit point为{-1,-1}。不是匹配组、原生编译或IPA归档失败；详细日志/AX证据与定向修复见BUILD_STATUS最新记录。测试必须识别对应系统标题并选择Not Now，再验证播放页打开和PCM/歌词，不降低断言。用户要求每次本地打包后继续实际云端测试，待新修复commit对应运行确认。
