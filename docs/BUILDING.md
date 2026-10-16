# 开发与构建

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

Release模拟器产物：`build/DerivedData/Build/Products/Release-iphonesimulator/app.app`；Debug运行可用 `npm run ios`，Metro用 `npm start`。目前还没有IPA打包/个人签名验收。

独立领域与竞态测试使用Node24内置TypeScript去类型执行，无依赖测试框架。没有安装全局React Native/Expo CLI；使用工程本地CLI。

## 验收区分

- `npm run check`：类型与契约测试，只覆盖代码逻辑。
- `npm run ios:build`：原生编译与Release JS bundle，不能证明网络、后台和音频正常。
- 安装/启动/截图：只证明该模拟器界面可运行。
- LX源/真实Navidrome/签名/后台播放：各自单独记录，真实手机不能由模拟器替代。

LX离线探针与进度见 [LX_HOST_PROGRESS.md](LX_HOST_PROGRESS.md)。

`modules/nexus-native/ios`保存原创Swift宿主与单一bootstrap资源，Expo默认扫描本地modules目录；新增/修改Podspec后运行ios:pods，不重新prebuild。原生工具测试在Mac上用同一Swift实现对照Node crypto/zlib及本地HTTP服务；不能替代iOS设备验证。

原生测试另覆盖原创C++EQ/FFT及生产AVPlayer引擎的合成WAV/HTTP播放。`source /Users/ningli/WorkSpace/Tools/env.sh; node scripts/test-ui.mjs`在本地18439端口提供无凭据的合成脚本，运行Release XCUITest导入/启停/删除；日志及xcresult保存在build，不提交。测试目标只在testing构建，不作为IPA内容。

`node --experimental-strip-types scripts/probe-online.mjs`对五平台真实搜索做小样本探测，报告只包含数量/字段保留标记。`scripts/probe-lx-resolve.py`使用本机私密样本，报告仅留状态及音频头验证，不输出URL或曲目。

实际脚本初始化（会执行脚本网络请求）：先运行test:native编译工具，再运行`python3 scripts/probe-lx-native.py`。仅在本机生成去除URL/原始异常的报告；resource、build和local-config保持Git排除。
