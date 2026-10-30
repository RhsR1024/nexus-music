## 2026-10-30 本地结果轮换

本次逐项复核并轮换19个旧成功结果包和一份损坏临时ZIP，保留摘要/文件树哈希；已清理路径不可继续当作当前可取。详见[精确清单](2026-10-30_build-retention.md)。失败包、原始逆向证据及最新有效阶段未清理。

# 开发与构建

## UI迭代与阶段验证（2026-10-21）

按 [UI_ALIGNMENT_WORKFLOW](UI_ALIGNMENT_WORKFLOW.md) 区分日常视觉快验与阶段集成：微调先采目标/受影响状态并核对图像，阶段再走正常导航、相关业务/原生测试、本地清洁归档及云端iOS27。不能用归档成功代替视觉验收，也不必为每次边距试验完整归档。文档-only只做链接/一致性和diff检查；当前CI忽略仅docs/Markdown的push，不重派旧任务。

正式视觉证据导出必须指定精确xcresult与新输出目录，不用latest/默认覆盖目录；截图、规格、工具和实际构建来源绑定哈希。旧日志/附件清理仍按下面引用保护规则。

## 本地临时产物保留与清理

2026-10-18用户要求定期清理诊断包、日志及缓存。每阶段结束及时去掉已使用且已核验的重复下载包、重复解压和临时导出；每天首次工作/自动跟进检查`du`、`df`及上次清理回执，空闲时执行保留期轮换：临时文件7天、普通日志14天、已解决故障的完整结果包30天。期限只针对已可清理的产物，不按年龄删除尚未解决故障的唯一证据。

始终保留最新两个有效阶段的IPA/manifest/摘要及所需回归摘要；未解决失败保留必要原始结果、关键截图/日志与来源摘要。reverse-skill样本、案例scope、不可变Evidence、门禁和哈希引用文件不属于可随意清理的缓存；`work/`及工具安装不做整目录自动删除。凭据、签名材料和用户数据也不纳入临时清单。

清理前列出候选路径、字节、使用者与保留依据，确认没有正在运行的Xcode/下载/提取进程使用它们。保留当前DerivedData增量缓存；旧的独立可重建缓存可在空闲时清理，磁盘可用空间不足30GB时优先处理重复导出和旧缓存。Pods/node_modules不做日常无差别删除。清理后在忽略目录`build/logs/cleanup-<日期>.json`记录删除项、原因、保留证据与清理前后空间；交接只记录简要结果。若删除了历史附件副本，说明已轮换及保留的收据，不再称其仍可直接下载/读取。

既有“音枢 iOS27 构建与计划接续”跟进任务负责每日首次可用运行的检查；电脑或应用未运行时顺延，次日启动工作再执行。清理期间如有构建活动则延后，不与构建争用或自动终止进程。

云端执行[最新队列规则](GITHUB_ACTIONS.md)：同工作流/分支保留运行中、仅最新一个pending（`queue: single`、`cancel-in-progress: false`）。阶段先完成本地验证再正常push，之后核对队列已收敛；旧pending由新提交替换，不重派旧版本。最新完整云端成功验证累计代码，取消的中间版本不能写为通过；本地SDK26.2、云端SDK27、签名/真机分别记证据。

基础候选：Expo 54.0.37 / React Native 0.81.5（新架构）/ React 19.1.0 / TypeScript 5.9.3，npm单锁文件。Node24.14.0 / npm11.9.0；Xcode26.3（17C529）；CocoaPods1.16.2。

## 本机命令

```sh
cd /Users/ningli/WorkSpace/NexusMusic
source /Users/ningli/WorkSpace/Tools/env.sh
npm ci
npm run check
npm run test:native
npm run ios:pods
npm run ios:build
```

系统xcode-select未改；本机Tools/env.sh选择完整Xcode并提供隔离的CocoaPods。脚本当前引用本机Tools绝对路径；迁移到另一台Mac时需替换或提供同等工具配置，不能声称跨机器零配置。

维护并提交 `ios/`，当前Xcode目标和scheme为 `app`，显示名为音枢，bundle ID为com.nexusmusic.app。初建仅使用一次 `expo prebuild --platform ios --no-install`；后续手工原生模块加入ios/受版本控制，**不执行clean prebuild覆盖**。没有Android工程，首期不交付Android。

Pods/DerivedData/IPA/构建日志不提交；提交npm lock与Podfile.lock。生成工程中的`.xcode.env`可提交，`.xcode.env.local`为本机Node位置，不提交。

Release模拟器产物：`build/DerivedData/Build/Products/Release-iphonesimulator/app.app`；Debug运行可用 `npm run ios`，Metro用 `npm start`。已有多批生产入口 unsigned IPA 打包及完整性校验；个人签名、续签和覆盖升级仍待独立验收，最新逐批结果见 [BUILD_STATUS](BUILD_STATUS.md)。

独立领域与竞态测试使用Node24内置TypeScript去类型执行，无依赖测试框架。没有安装全局React Native/Expo CLI；使用工程本地CLI。

## 验收区分

- `npm run check`：类型与契约测试，只覆盖代码逻辑。
- `npm run ios:build`：原生编译与Release JS bundle，不能证明网络、后台和音频正常。
- 安装/启动/截图：只证明该模拟器界面可运行。
- 截图导出统一走 `node scripts/export-ui-screenshots.mjs --xcresult <结果包|latest> --match <可读名子串> --output build/ui-screenshots [--clean]`：脚本内部完成附件导出、可读名清洗、`index.json` 记账与自身临时目录回收；`--clean` 只删除本目录index记录过的旧产物。清理范围限定为本次 staging 与本目录 index 记录的附件，执行前仍须核对引用和保留规则。`--list` 可先查看匹配项。
- LX源/真实Navidrome/签名/后台播放：各自单独记录，真实手机不能由模拟器替代。

LX离线探针与进度见 [LX_HOST_PROGRESS.md](LX_HOST_PROGRESS.md)。

`modules/nexus-native/ios`保存原创Swift宿主与单一bootstrap资源，Expo默认扫描本地modules目录；新增/修改Podspec后运行ios:pods，不重新prebuild。原生工具测试在Mac上用同一Swift实现对照Node crypto/zlib及本地HTTP服务；不能替代iOS设备验证。

原生测试另覆盖原创C++EQ/FFT及生产AVPlayer引擎的合成WAV/HTTP播放。`source /Users/ningli/WorkSpace/Tools/env.sh; node scripts/test-ui.mjs`在本地18439端口提供无凭据的合成脚本，运行Release XCUITest导入/启停/删除；日志及xcresult保存在build，不提交。测试目标只在testing构建，不作为IPA内容。

**本机 WorkBuddy 终端注意事项（2026-10-20）**：该终端给每个 node 进程注入了 `NODE_OPTIONS=--require .../node-language-shim.cjs`，Metro 打包阶段会因 broker IPC 断开报 `write EPIPE`，`PhaseScriptExecution Bundle React Native code and images` 失败（App 未编译）。在本机跑 `test-ui.mjs`/归档前先 `export NODE_OPTIONS= PYTHONPATH=`；这不改产品代码，云端 CI 不受影响。

**本机 RN 0.81 x86_64 预编译 Hermes 阻断（2026-10-21）**：Intel 模拟器 Release 的 `hermes-ios-0.81.5-release.tar.gz` 缺少 React 引用的 `facebook::hermes::inspector_modern::RuntimeAdapterD2Ev`，会在 App 启动前 dyld 失败；手工换成 Debug Hermes 虽含符号，但与预编译 Release React 组合出现 SIGBUS。不要据此判定业务代码或 UI 测试失败，也不要提交本机 Pods 替换。当前以云端 Xcode27 arm64 Release 验证；需另一台 ABI 正常的 Mac 或修复后的 RN 产物完成本机 Release UI 双击闭环。

`node --experimental-strip-types scripts/probe-online.mjs`对五平台真实搜索做小样本探测，报告只包含数量/字段保留标记。`scripts/probe-lx-resolve.py`使用本机私密样本，报告仅留状态及音频头验证，不输出URL或曲目。

实际脚本初始化（会执行脚本网络请求）：先运行test:native编译工具，再运行`python3 scripts/probe-lx-native.py`。仅在本机生成去除URL/原始异常的报告；resource、build和local-config保持Git排除。
