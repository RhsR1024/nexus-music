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

## 2026-11-02 扩展到全部歌词、舞台与经典歌词

有效顺序 TTML 的正式 App 测试 `SourceUITests-1793589888184` 已取得歌词并找到第二段，但展开层实际双击后仍停在 `0:17 / 2:00`，没有到达派生的 `0:30 / 2:00`。展开层仍使用 JavaScript `Pressable` 两次点击守卫，与 AM/AM2 的原生识别路径不同。经典行和舞台活动组也存在相同路径。本批将三处复用既有原生容器，包装名统一为 `LyricGesture`；不修改 Swift 识别器、时间解析、偏移、权威队列或播放意图，不新增 Sollin 功能或逆向结论。

最终 Release `SourceUITests-1793590412749` 为 1通过/0失败/0跳过、176.862秒，验证有效seq优选、舞台单击不定位/双击回0、全部歌词单击不定位/第二段双击到30秒、经典单击不定位/双击回0/长按展开，始终保持暂停。旧坏TTML→LRC回退独立运行 `SourceUITests-1793590732249`，1/0/0、157.240秒。均为本机SDK26.2模拟器、sourceUnchanged=true；5PNG来源校验通过并亲看。973/973检查通过，原失败证据保留。VoiceOver实际操作、实体机、真实TTML库和iOS27继续独立验收，不能由这些结果推定完成。
