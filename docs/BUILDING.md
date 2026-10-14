# 开发与构建

基础候选：Expo 54.0.37 / React Native 0.81.5（新架构）/ React 19.1.0 / TypeScript 5.9.3，npm单锁文件。Node24.14.0 / npm11.9.0；Xcode26.3（17C529）；CocoaPods1.16.2。

## 本机命令

```sh
cd /Users/ningli/WorkSpace/NexusMusic
source /Users/ningli/WorkSpace/Tools/env.sh
npm ci
npm run check
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
