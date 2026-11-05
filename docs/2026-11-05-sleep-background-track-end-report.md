# J29 后台跨曲终时按绑定暂停

手动切歌已证明旧曲绑定会清除，但尚未证明绑定在第一首自然结束时仍有效，尤其是 App 处于后台、系统可能延迟 UI 回调的路径。本批使用正式 Navidrome 8 首合成队列、唯一权威播放器和原生睡眠计时，不增加测试播放器或第二计时状态。

`testSleepTrackBindingPausesAtTrackEndInBackground` 先通过正式设置连接测试 Navidrome，播放全部后打开播放器。为在可接受的验收时长内跨过真实曲终，用例从正式“播放倍速”面板选择3x；120秒合成音轨因此约40秒结束。随后开启“播完当前歌曲再停止”，按下Home让 App 进入后台并停留50秒，再回前台。

回到前台后必须同时满足：

- 真实播放按钮恢复为“播放”，不存在“暂停”按钮。
- 睡眠状态为“未开启”，绑定开关已关闭。
- 当前曲仍为第一首 `Synthetic tone`，没有因自然结束推进到 `Synthetic tone 2`。
- 真实进度停在 `02:00 / 02:00`。
- 测试最后恢复1x率、关闭长队列并移除合成 Navidrome 连接。

产品代码没有改动；本批只新增正式 UI 回归、纳入云端睡眠专项并记录证据。

## 验收证据

单测 Release `build/SourceUITests-1793868612781.xcresult`：

- 结果：1通过/0失败/0跳过、163.263秒、exit0、`sourceUnchanged=true`。
- source digest：`1f79d93550504705da024d6df9bfe75d4b3f2691ee29380f03cd83d4c415d148`。
- 安装 bundle digest：`a78b569093a1b63d53b6d6e97800a9aea810eefdac60cde337b5cba288768e5e`。
- result Info：`313823a183abdb97fa5704643ae2348f5bd478e9e83fe4000f0b2cbfd58da7d8`。
- run manifest：`9adcdf7dbfff414a200fa040a966adac5262773bf6dfc7a8d475d2b90d31e759`。
- ui summary：`0f59a24896a34d6c3b139797f38618695dcad14f4d9bd039e4789c24b06a1f0e`。
- server counts：`32c6d1a169988fef233b7237c8df5d90ae515eb5d4c2e71348f40c95841006c5`。
- screenshot index：`288a75e6c891cdc1876865fb93f4349608649dfc775985f106def700dc83e8a8`。

三张1290×2796截图均亲看：

| 文件 | SHA-256 |
| --- | --- |
| `Sleep track binding before background track end` | `b6f4fd32bee802bba90c2b915af9652057050caeccae5482a615aa02566dd24c` |
| `Sleep binding cleared after background track end` | `1b487d62514005e54a215f643337ff899d19afbbf7008f39ef39b18c52bccb47` |
| `Sleep-bound first track paused at natural end after background` | `ab181a43b0906170f6959c8c16cdedadeb4e78b3047b407903486ff530a17ebb` |

为核对与既有睡眠用例的顺序隔离，随后在同一进程执行自定义计时、滚轮、自然到期、手动切歌和后台曲终五项：`build/SourceUITests-1793868909601.xcresult` 为5通过/0失败/0跳过。五项耗时分别为68.646、119.671、183.058、105.831、164.523秒，合计641.729秒；runner从启动到结束692.380秒。`sourceUnchanged=true`，安装 bundle digest 与单测相同，证明五项之间无状态串扰。

组合 run manifest `ec1cc94fa32edd78cf32bf261ad7429ffdba3b67b26012f9a9cd43546035e8e1`、ui summary `f6a94b9731912c136fbeb6592f2cb353ebb0a53043dc0a897ac0110145664bff`、server counts `6e7f4e54dd6a8982a6f7bfd26a1d2826032e703244a37fb91e1ab96899b53635`、result Info `379c9a40196c6907c85061f4b1ea6c68b3590020008de32d7933c39a72640937`。13张睡眠截图从组合结果导出，索引 `b4c018613c0cf82164a22dc8a98e5fcdcbe4db1d759f17028a5124f2cb1397f8`；本批三张新图仍为1290×2796并再次亲看：

| 组合导出文件 | SHA-256 |
| --- | --- |
| `011-Sleep-bound-first-track-paused-at-natural-end-after-background.png` | `921bfc1f2fed8b5334d73ee57d6dcdb80c4ce291d18f5e0280ce48b832f16b67` |
| `012-Sleep-binding-cleared-after-background-track-end.png` | `9fc2d9ed2b34bf83ea18bf885bdf855fbc8267fb8ab78ecb786031894fd1ac1a` |
| `013-Sleep-track-binding-before-background-track-end.png` | `40fa4dc71056ce31173b81d29d6f4e152e9ccea3f999b65d930cb197a7629f0b` |

完整 `npm run check` 为1035/1035通过，日志SHA-256 `f64dea03a318f15d3dc6e5ed9305bf71d744fcccb1154344f9ccf6005e68520f`；Swift解析、workflow YAML解析和 `git diff --check` 通过。产品二进制与前批相同，不重复生成IPA。完整native上批已通过，本批未改产品/原生源，未重复运行。

## 范围边界

本批证明模拟器中的普通 Home 后台跨过真实曲终，并验证回前台后的暂停、绑定清除、曲目身份和进度。它不能替代实体 iPhone 锁屏、更长后台挂起/进程回收、来电/耳机/蓝牙路由、实体手势、VoiceOver、动态字号/小屏、真实私人曲库、Apple签名和iOS27云端终态；J29继续保持B状态。

复现：

```bash
source scripts/environment.sh
export NODE_OPTIONS= PYTHONPATH=
NEXUS_UI_RUN_DIR=build/sleep-background-track-end-20261105-r2 node scripts/test-ui.mjs \
  NexusMusicUITests/SourceSettingsTests/testSleepTrackBindingPausesAtTrackEndInBackground
```
