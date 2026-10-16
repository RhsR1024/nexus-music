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

## 2026-10-16 最新云端失败复核与统计增量

最新已结束运行 38846783693（2ff7557）中 Linux、完整原生检查及八项核心 App UI（含 WebDAV）均通过，失败发生在第二组 `testSourceHealth`。诊断产物12025830936已下载至忽略目录 `build/ci-38846783693`；`diagnostics/logs/ui-catalog.log` 和附件 `3FEB8190-2597-41AC-815A-140539B5FCA7.txt:98–110` 显示 iOS27 分享为 Popover，并存在 `PopoverDismissRegion`，ActivityListView 的远程子层不可执行下滑。失败为测试第57行的滑动定位，匹配和评论通过；未执行本次 IPA 归档，不归因为原生编译/音频/密码窗口。修正为核对JSON预览后点击实际弹出面板上方的关闭区域并断言返回原报告。d67fe40 的后续运行38848961113仍在核心App验证，不包含此分享修正，不提前标通过。

工作区继承的F34/J55播放统计已继续完善：原生playing区间的单调时钟累计、会话ID、原曲归属、暂停/切歌末段、清空与备份恢复；共享串行写队列防止恢复和聆听/历史写入互相覆盖。205项TS/类型检查通过（`build/logs/check-statistics.log`）；新增实际AVPlayer暂停/定位/会话测试与本地App复验仍在执行。统计与识曲分开，识曲、其余S2/S3/S4/S7/S8/S9及真机/个人服务仍未完成。完整目标保持active，本机仍为Xcode26.3/SDK26.2，云端为Xcode27/iOS27；不称本机有iOS27工具链。

模拟器UI测试显式ONLY_ACTIVE_ARCH=YES：本地Intel测试x86_64，云端Apple Silicon测试arm64，避免在一次本地Release测试中编译未运行的架构；设备IPA仍按原脚本单独归档arm64，构建清单分别记录。

源健康最终修正版 `build/SourceUITests-1792127036156.xcresult` 82.956秒通过，包含取消/六项逐档结果/JSON分享与返回报告/删除测试源；本地旧SDK使用可命中的常规sheet关闭分支。iOS27 Popover分支仍必须由新提交对应云端实测，不以本地结果代替。完整native、205项TS、正式入口WebDAV/ND与统计重启已全部通过；本批开始归档/提交push。

播放统计/分享修复阶段901954ac1dc1e54ddc444e9f1cfc0a7e4e8cd0f9已正常push并核对远端main一致。本地 `archive-statistics.log` 归档通过，manifest为dirty=false/workingTreeChanges=[]/arm64/iphoneos26.2/min15.1/signed=false，正式JS bundle通过测试adapter隔离校验。IPA位于build/distribution/NexusMusic-unsigned.ipa，SHA256 `44320925583c882859fb7621906b183531b93c0c7cde251aa80da8f1b1533612`，重新校验通过。新云端[38854140339](https://github.com/RhsR1024/nexus-music/actions/runs/38854140339)对应901954a，已创建排队；不把旧d67fe40/38848961113结果作为本批结果。接着推进S4跨平台歌词候选/人工选择等剩余并集，完整目标保持active。

最终正式入口 `build/SourceUITests-1792128987602.xcresult` 127.277秒通过：五皮肤暂停/定位、声波核当前歌词可点、私人曲目无自动公开匹配且主动搜索确认可取消、原生逐字/偏移、统计重启。已查看最终声波核截图，当前行完整显示。最新218项类型/业务检查通过；额外覆盖WebDAV/设备文件版本变化废弃旧选择/原歌词缓存，以及WebDAV跨实例临时版本不重复。新歌词显式搜索与WebDAV最后联合复验仍在执行。
云端901954a/38854140339已通过checks、iOS27完整native检查（含统计/DSP），目前核心App UI。旧d67fe40/38848961113已结束失败，job116813728363日志明确旧第74行ActivityListView为空可见区无法Swipe down，testSourceHealth 62.777秒失败；诊断产物12026707975。与2ff已定位分享问题一致，不归因本次歌词。901的修复分支仍等待实际云端通过。

S4/J38阶段已正常push `92f4836eaa29c4196c3f1de0b6e75831f96eeed2` 并核对远端main一致。本地`archive-lyric-selection.log`为ARCHIVE SUCCEEDED，manifest commit=92f4836/dirty=false/workingTreeChanges=[]/arm64/iphoneos26.2/min15.1/signed=false，正式bundle无测试adapter。IPA SHA256 `67f280d3eefcfa6a1f7793521bb18b6476b8c61f40e6f2623afa9b0f26b24d77`，重新校验通过，产物仍为build/distribution/NexusMusic-unsigned.ipa。网页已确认本批新运行[38857771291](https://github.com/RhsR1024/nexus-music/actions/runs/38857771291)对应92f4836、Pending；不把排队写成云端已通过，未重复派发或重启已有构建。901954a/38854140339当前已过完整native，核心App继续。接下来继续S4深度歌词样式/实际字体导入及全局字体，保留S2/S3/S7/S8/S9等全部剩余目标与手机/真实个人服务验收，goal active。

## 2026-10-16 云端统计批次通过与歌词批次运行

网页实际确认：901954a 对应运行38854140339全部成功，checks 28秒、iOS任务54分25秒，包含原生检查、核心App、匹配/评论/源健康及设备归档上传。IPA产物12029158092为9.24MB，ZIP摘要7849f97a0c9af63e33611bfd5fd69b99f20f7585492085faed2f00757856078c；此摘要不是内部IPA校验值。诊断产物12029310935为207MB。旧分享Popover失败已由本次实际云端回归闭环，不再把旧失败作为当前修复状态。

92f4836对应运行38857771291现已从排队进入执行：checks 30秒通过，原生检查1分28秒通过，iOS27核心App UI运行中，后续歌词选择/匹配组及IPA尚待实际结束。未取消、重启或重复派发。字体/样式批次工作树仍未提交，不能把这两个运行计作字体批次通过。本机Xcode26.3/SDK26.2与云端iOS27结果继续分别记录。

成功运行38854140339的IPA已实际下载至忽略目录build/ci-38854140339/ipa，ZIP摘要与网页一致，内部IPA校验文件匹配，SHA256 8c82be090b0099aae1bfc29e7f9d534cf5ffb849696ad75dc61fd3495173199c。manifest为arm64/macOS27.0.1/Xcode27.0 27A266a/iphoneos27.0/min15.1/signed=false；dirty=true明确仅列M ios/Podfile.lock（已知Intel/ARM Yoga校验差异），不称清洁云端工作树。Info.plist/JS包与正式入口隔离已复核。

## 2026-10-16 92f4836 云端图标失败根因与字体批次归档

38857771291/116843765747实际八项核心UI中7通过、1失败（图标），不是“8项通过”。下载诊断12030142597因大文件慢，采用带校验的ZIP分段读取取得ui-catalog、完整小对象元数据及图标录屏对象；每项核对中央目录长度与CRC，未将不完整ZIP当作全包SHA256通过。证据在忽略目录build/ci-38857771291。ui-catalog.log:44348–44390为第26行isHittable失败；xcresult summary为passedTests=7/failedTests=1。

录屏icon-7.png清晰显示音枢黑金图标及正确中文名；icon-11.png显示测试盲滑入App Library。对应UISystemShellApplication AX快照只有根元素无图标子节点，不能归因图标丢失或显示名错误。定向修正为保留AX定位并按实际截图Vision识别精确“音枢”标签（置信度>=0.8），通过观察到的位置点击并必须回到App；不用固定坐标/直接activate/跳过。OCR已在失败录屏识别到精确标签且置信度1.0，本地修正版测试与新云端继续验收。

字体/深度样式本地工作树归档archive-fonts.log已ARCHIVE SUCCEEDED并验证arm64/iphoneos26.2/正式入口隔离。IPA SHA256为34589848b516f7e1ad154fa80b18b5fac31dd1bfd0ee1984e5b447f0472d435e；manifest commit=cbd80f6/dirty=true如实包含本批未提交文件，不能称最终清洁交付包，提交后再清洁归档。F37/J59计划已加入，但系统封面/收藏尚未实施，见决策0026。

本批最终本地检查：check-fonts-delivery.log为228/228通过；字体481.115秒专项/五皮肤/删除回退与重启、歌词/WebDAV回归及完整native结果保持通过。图标修正版build/SourceUITests-1792137331968.xcresult于15:56通过12.002秒，本地走AX分支；云端录屏精确OCR置信度1.0已离线核验，iOS27实际回调点击仍待新运行。准备本批阶段提交、清洁本地IPA和新云端；无系统灵动岛实现完成声明。

## 2026-10-16 字体批次清洁交付与新云端

字体/歌词样式与图标测试修复已提交并正常push `78e482785a50fdb9da01507f1f95ed50dc30431c`，远端main已核对一致。`build/logs/archive-fonts-clean.log`归档成功，`build/distribution/build-manifest.json`为commit=78e4827、dirty=false、workingTreeChanges=[]、arm64、iphoneos26.2、min15.1、signed=false；正式JS入口隔离和IPA重新校验通过。IPA SHA256 `ca6b2cd381c733bee12135df2d62106ce2f099657dc53041509a65dcf8bfd8d6`。此前dirty工作树包仅作历史证据，以此清洁包为准。

对应云端[38871835008](https://github.com/RhsR1024/nexus-music/actions/runs/38871835008)已于16:09（Asia/Shanghai）触发，16:15核对checks 28秒通过、iOS任务执行中，未提前标通过、未重复派发/取消。iOS27图标OCR分支、字体专项与IPA以本次实际结束结果为准。接着实施S10系统媒体封面/收藏；用户手机、真实私人服务与其他未完成并集继续保留，目标active。
