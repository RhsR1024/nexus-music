# 睡眠定时器秒级倒计时与立即停止

J29 此前的睡眠面板只显示分钟倒计时，缺少“立即停止播放”。本批补齐两个用户可见缺口：活动定时器显示秒级倒计时；用户可立即取消原生计时并暂停真实播放。原生 `PlaybackSleepTimer` 仍是唯一计时权威，没有新增第二计时器、第二播放器或 React 逐帧音频通路。

## 实现

- `src/playback/sleep.ts` 新增 `sleepCountdown(deadline, now)`，按秒向上取整，输出 `m:ss` 或 `h:mm:ss`；非正剩余时间显示“即将停止”，不产生负时间。
- `src/playback/nativeSession.ts` 的睡眠服务新增 `stopNow()`：先调用原生 `configureSleep(0, false)` 原子取消计时并刷新 `SleepStore`，再通过权威 `PlaybackController.pause()` 暂停当前播放。
- `src/ui/PlaybackSheets.tsx` 的 SleepPanel 每秒只更新显示时间；新增 48pt“立即停止播放”按钮，无当前队列时禁用。状态、取消按钮及本曲后停止继续共用既有原生睡眠服务。
- `src/ui/PlaybackSettings.tsx` 同步改用秒级倒计时，避免播放选项面板与完整设置显示不同精度。
- `tests/sleep.test.ts` 增加秒级、小时格式、零值及负值边界。
- `ios/NexusMusicUITests/SourceSettingsTests.swift` 在真实合成音频播放后验证秒级倒计时、立即停止、计时清除及回到播放器后的播放按钮；没有放宽成“播放或暂停均可”。

## 正式回归

最终 Release `build/SourceUITests-1793854177801.xcresult` 的 `testZNavidromePlaybackAndCredentials` 为 1 通过 / 0 失败 / 0 跳过，用例 631.892 秒，exit 0，`sourceUnchanged=true`。运行目录为 `build/sleep-immediate-20261105-r4/`。

- source commit：`8c4cffe05872cc3a1bbaefeefcb213beed654a54`
- source digest：`3dd9e8c17c3764c8e7f50ad917620995346ff6791a55a2381f468f6d265f0154`
- source diff SHA-256：`458f5bfd5e88e809b4929c6374d5579ef8cdee5c913fc54fe03f5b572744178a`
- 实际安装 bundle digest：`01ceefd48fc1dfcef199f13d286b441decb7e8077c412e8c7462090df83453e4`
- xcresult Info.plist SHA-256：`1fba60df8c118dbdc00c086eaf6a4544891f4deedf974e8a99304036c234439d`
- run manifest SHA-256：`467c76fd78ad5dcc84510f587d49b0372c14bc62b0c1a2de6dd61cd2ad0b8cbf`
- UI summary SHA-256：`5d0c690b2190a4bb391c35d92b0e9cf54029e77765e173a30d0e54e7fe8c5437`
- UI log SHA-256：`c27b40e07f1787887f2f6789d450202917ae5da65e7801712bf0f9c33c8bb0a8`

测试先确认真实播放按钮已变为“暂停”，再打开睡眠面板、选择 15 分钟，读取形如“剩余 14:59”的秒级状态，点击“立即停止播放”。随后必须出现真实“播放”按钮，且 `sleep-status` 精确恢复“未开启”。播放选项关闭并切回 vinyl 后，`Vinyl reference composition` 截图仍显示播放三角，复核暂停意图没有被后续样式切换重建。

服务计数为 8 次鉴权成功、0 次鉴权失败；实际请求为 ping 1、扩展 1、专辑列表 1、专辑详情 1、歌词 4。没有访问私人服务、真实账号或外部凭据。

## 截图核验

最终结果导出 4 张睡眠面板截图和 1 张暂停状态截图，均为 1290×2796：

- `build/sleep-immediate-20261105-r4/attachments/002-Sleep-timer-countdown-and-immediate-stop.png`，SHA-256 `48a266edc8e5eb810f3b427c2d6aca68414ce41732850bf0314f1b5f50e8d81a`。人工亲看“剩余 14:59”、15/30/45/60/90 分钟、本曲后停止、立即停止与取消入口。
- `build/sleep-immediate-20261105-r4/attachments/001-Sleep-timer-stopped-immediately.png`，SHA-256 `6ec4a4bca7fc2b6bacfa55cef820092813d40a730dedc41fe0d79541246eea1d`。人工亲看状态已为“未开启”，取消入口消失。
- `build/sleep-immediate-20261105-r4/attachments/003-Sleep-timer-custom.png`，SHA-256 `cebbc6fee4e61f1a74ef4b66be22fe4498e84d1bbca4867a05ada3d55719fc33`。人工亲看自定义小时/分钟轮盘和开始定时入口可达。
- `build/sleep-immediate-20261105-r4/attachments/004-Sleep-timer-sheet.png`，SHA-256 `954a7d4a76606c8a83c4ea05f481834d924ee17b09b910d2f4d7cae05d393a1a`。
- `build/sleep-immediate-20261105-r4/attachments-paused/001-Vinyl-reference-composition.png`，SHA-256 `877bdf80bf0ca9c1ff8a25a57b069d0a5d1a4180a27474a9002362827b23af00`。人工亲看 vinyl 界面中央为播放三角。

两张索引入口的 SHA-256 分别为 `37227f426a50888487b4cefb5ccc1fdc2407c2ae41e685ebac94bd98b601fa83` 和 `3e129a55aa470ded51140cfb1f0089b0e7a1b0327b10c898c0f66bb1852ec4c0`。

## 失败与修正

- `SourceUITests-1793852247024` / r1：0/1/0。测试在遍历所有皮肤前启动真实播放，photo 分支没有恢复暂停，切回 vinyl 后仍处于播放态而断言“播放”失败。产品未改。
- `SourceUITests-1793852819150` / r2：0/1/0。播放启动被移到“更多播放控制”弹层之后，底层 photo 播放器被弹层遮挡，日志命中点为 `{-1,-1}`。改为在打开弹层前启动真实播放。
- `SourceUITests-1793853401546` / r3：1/0/0。断言通过，随后补充停止后截图，因此最终证据采用同源 r4，避免只保留文字断言。

两轮失败 xcresult 与 failure-evidence 均保留，没有用成功结果覆盖；原始断言没有放宽。

## 检查

- `npm run check`：1027 通过 / 0 失败 / 0 跳过。
- `npm run test:native`：通过；包含 stale expiry/cancel/replace/track binding/once/dispose/invalid input 的睡眠计时器检查，以及真实 AVPlayer 的定时到点/本曲后暂停。
- `git diff --check`：通过。

## 边界

本批只补齐 J29 的秒级倒计时与立即停止，不把 J29、完整 F/J 或项目标记完成。自定义轮盘的实际计时启动、本曲结束后停止的正式 UI 实音、进程重启/前后台/切换歌曲组合、实体 iPhone、VoiceOver/动态字号/小屏、签名安装及 iOS 27 云端终态仍需分别验收。模拟器合成音频不能替代实体设备、真实个人曲库或后台长时播放。
