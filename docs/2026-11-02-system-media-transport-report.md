# 2026-11-02 S10 系统媒体传输命令回执

本批修复系统 Now Playing 的播放恢复与定位命令只向 JS 发事件、但命令已返回成功时原生媒体尚未变化的问题。`NativePlaybackEngine` 现在对当前媒体项立即执行 `play`、从暂停态触发的 `toggle→play` 和 `seek`，随后保留原有带 `entryId`、媒体项 ID 与 generation 的 `remote` 事件，由 `nativeSession` 继续同步唯一 `PlaybackController` 队列。`next`、`previous` 仍只把身份绑定后的命令交给 JS 队列控制器，没有新增原生队列、第二播放器或并发状态源。

暂停、换曲/停止后的 `noSuchContent`、迟到解析不恢复播放、封面/收藏身份和音频会话路径保持原实现。直接媒体操作与 JS 同步事件可能形成同一 `play`/`seek` 的幂等重复调用，但目标媒体项、generation 和位置相同；队列推进仍只由 JS 控制器决定。

## 本地契约

`tests/native/SystemMediaCLI.swift` 现在先等待真实合成 WAV 到达 AVPlayer ready，再通过注册后的系统媒体中心读取 `MPNowPlayingInfoCenter`，实际断言：

- 系统 `play` 使播放速率和系统 playback state 进入播放态；
- `toggle` 从暂停恢复，再从播放暂停；
- 系统 `seek` 把实际媒体与 Now Playing elapsed position 移到目标位置；
- `next`/`previous` 仍携带当前媒体项身份，没有在原生层另建队列；
- 停止后 `play`、`toggle`、`seek`、`next`、`previous`、`favorite` 均返回 `noSuchContent`；
- 原有封面迟到隔离、收藏身份、系统状态清理和不泄露认证 URL/越界路径继续通过。

`tsconfig.json` 同时显式排除本机忽略的 `work/`。该目录保存官方站点原始/压缩逆向 bundle，不是产品 TypeScript 输入；此前 TypeScript 默认扫描到其中一份压缩文件，阻塞了完整检查。产品源码、测试与既有 `node_modules`/配置/原生工程排除范围未改变。

## 验证

- `npm run check`：类型检查通过，948/948。
- `npm run test:native`：完整 native 套件通过，包括真实合成媒体解码、AVPlayer、系统媒体中心、缓存、WebDAV、DSP 与图片边界。
- `npm run ios:build`：Xcode 26.3 / SDK 26.2 Release 模拟器构建成功，`BUILD SUCCEEDED`。

本机 SystemMediaCLI 运行于 macOS，不能证明 iOS 27 灵动岛界面、后台控制、蓝牙/耳机路由、来电中断或签名行为。仍需用户 iPhone 15 Pro Max / iOS 27 真机录屏与后台功耗验收；云端 iOS 27、清洁未签名 IPA 和 Sollin strict review 在本阶段收尾后补记。
