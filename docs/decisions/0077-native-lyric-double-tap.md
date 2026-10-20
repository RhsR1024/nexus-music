# 0077 歌词双击定位的原生手势识别

- 日期：2026-10-21
- 状态：生效
- 关联：0015、0043

## 问题

AM/AM2 歌词行原有 JavaScript 触摸序列无法稳定识别 XCUITest 的系统双击。失败证据 `SourceUITests-1792526810680.xcresult` 中，控件和两行歌词均存在，但双击后进度保持 `0:02 / 2:00`；合成事件记录包含两条 pointer path，而 React Native/Fabric 只向 JS 交付一次 `onTouchStart`。继续扩大 350ms 窗口不会产生第二次触摸。

该问题属于既有“双击同一行定位、长按打开设置”交互的实现缺陷，不新增参考功能，也不改变 0015/0043/0076 的范围或逆向结论。

## 决定

- 在现有 `NexusNative` Expo View 中增加小型 `LyricGesture` 容器。
- UIKit 使用 `UITapGestureRecognizer(numberOfTapsRequired: 2)` 识别双击，使用 `UILongPressGestureRecognizer(0.55s)` 识别长按。
- 手势容器保持 `accessibilityRole="button"`、歌词标签和提示；VoiceOver 激活复用双击事件。
- JavaScript 继续调用既有 seek 守卫和权威播放控制器，不新增队列、播放器或平台状态。
- FlatList 滚动、切歌、空歌词、来源/偏移和全部歌词入口不变。

## 验收

- `npm run typecheck`、Swift parse、`npm run check` 407/407 和完整原生测试通过。
- Files 双用例本地 2/0/0 通过，证明同批测试基础设施未回归。
- 本机 RN 0.81 x86_64 Release 预编译 Hermes 存在 `RuntimeAdapterD2Ev` 缺失/SIGBUS，应用在测试启动前退出；该环境问题不归因于本改动。
- 双击、长按、VoiceOver 和 AM/AM2 Release 实际运行必须由云端 iOS 27 或另一台无该预编译 ABI 问题的 Mac 证明；在此之前不记为交互完成。
