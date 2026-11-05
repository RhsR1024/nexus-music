# J29 睡眠定时自然到期实音暂停

此前 J29 已覆盖原生计时启动、秒级倒计时、立即停止、重启取消和本曲后停绑定，但没有证明倒计时真正到期时会暂停仍在播放的音频。现有本地合成 MP3 约31秒，短于产品允许的最短1分钟，因此不能用它冒充计时到期。本批复用既有正式 Navidrome 合成音轨：真实120秒 WAV、生产 Navidrome client、唯一权威队列和原生 AVPlayer，不增加测试专用播放器或第二计时器。

产品代码没有改动。新增 `testSleepDurationExpiryPausesAudio`，经正式设置连接测试 Navidrome、播放全部、打开播放器，再从“更多播放控制→睡眠定时器→自定义”把分钟滚轮调到1分钟并开始。用例验证：

- 120秒音轨上出现真实播放、进度总长2:00和原生睡眠倒计时。
- 1分钟到期前音频未结束；到期后按钮恢复为“播放”，状态变为“未开启”。
- 到期后的播放进度在2秒内不再变化，证明真实播放时间线冻结，而不是只清除了界面状态。
- 关闭面板后可重新播放同一曲，进度继续前进，证明计时到期没有破坏播放器。
- 测试结束时只移除本用例的合成 Navidrome 连接。

## 验收证据

首轮 `SourceUITests-1793866040029` 在分钟滚轮处失败：滚轮初始为默认30分钟，一次上拖先到31，未到1。失败结果、层级和断言均保留；没有放宽或改写。修正操作先从真实滚轮回到0，再上拖一行到1，随后才进入计时到期验收。

最终单测 Release：

- xcresult：`build/SourceUITests-1793866321670.xcresult`。
- 结果：1通过/0失败/0跳过、183.663秒、exit0、`sourceUnchanged=true`。
- source digest：`75811874314f1adc6373b52470049e9524b61f19abf49ddda7c500d16c5f66a4`。
- 安装 bundle digest：`a78b569093a1b63d53b6d6e97800a9aea810eefdac60cde337b5cba288768e5e`。
- result Info：`f0e99d3bafbd245cb60378d15fd70d43796215478d630ffd8e07050d4ad17493`。
- run manifest：`93e5065fbe4a7f2235d495fb72a97f3ec959cf223027ba375f38994f737d2740`。
- ui summary：`3da316036ebfb519ce45e23bba4bdb4d6aab7be33837122439a8004e85dfa896`。
- server counts：`32c6d1a169988fef233b7237c8df5d90ae515eb5d4c2e71348f40c95841006c5`。
- screenshot index：`017f427f421afa1191f0419db953fedeb1e220f85fa61626a1f0160635ef7125`。

两张1290×2796截图均从精确xcresult导出并亲看：

| 文件 | SHA-256 |
| --- | --- |
| `001-Sleep-one-minute-timer-expired-before-audio-ended.png` | `d6ddfda099c40b5e69d708884c8ae2b19318e3cc446c1755f999a8f16a45d1e3` |
| `002-Sleep-one-minute-timer-with-120-second-audio-active.png` | `57df4f51361bf25dbb7a11c6f6662a98b8182b5d0f5c205abe946848c428e188` |

为匹配云端同一进程执行顺序，随后将三项睡眠回归一起运行：`build/SourceUITests-1793866852010.xcresult` 为3通过/0失败/0跳过、373.732秒、exit0、`sourceUnchanged=true`。三项耗时分别为72.344、120.527、180.861秒；安装bundle digest与单测相同，证明设置重启、滚轮和自然到期之间无状态串扰。run manifest `035c88fb…e7671`、summary `802e5241…584b`、result Info `d2bc7440…54d2`。

完整 `npm run check` 1035/1035通过；完整 `npm run test:native` 退出0，保留既有Sendable与WeakMutability警告。Swift解析和 `git diff --check` 通过。

## 范围边界

本批为音枢自有播放与UI测试，不新增Sollin采集、私有服务探测或参考代码移植。合成120秒音轨和模拟器只能证明生产播放链路下的前台自然到期；仍不能替代真实私人曲库、实体iPhone、锁屏/长时后台、手动切歌、实体手势、VoiceOver/动态字号、Apple签名和iOS27云端终态。J29继续保持B状态，播放中切歌与长后台组合是下一缺口。

复现：

```bash
source scripts/environment.sh
export NODE_OPTIONS= PYTHONPATH=
NEXUS_UI_RUN_DIR=build/sleep-expiry-20261105-r2 node scripts/test-ui.mjs \
  NexusMusicUITests/SourceSettingsTests/testSleepDurationExpiryPausesAudio
```
