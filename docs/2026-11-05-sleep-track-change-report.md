# J29 手动切歌取消本曲后停绑定

此前“播完当前歌曲再停止”已有原生曲末暂停和正式 UI 绑定，但没有回归证明用户在播放中手动切歌会取消旧曲绑定，而不是误停新曲。本批使用正式 Navidrome client、8 首合成队列、唯一权威播放器和原生睡眠计时，不增加测试播放器或第二计时状态。

`testSleepTrackBindingClearsOnManualTrackChange` 通过正式设置连接测试 Navidrome，播放全部后打开播放器并开启“播完当前歌曲再停止”。确认状态为“本曲播放结束后停止”后返回播放器，点击“下一首”，验证当前曲实际变为 `Synthetic tone 2` 且音频继续播放。重开睡眠面板后，状态必须为“未开启”，绑定开关必须为 `0`。测试结束恢复队列控制并移除本用例的合成连接。

产品代码没有改动；本批只新增正式 UI 回归并将其纳入云端睡眠专项。

## 验收证据

单测 Release `build/SourceUITests-1793867402621.xcresult`：

- 结果：1通过/0失败/0跳过、106.890秒、exit0、`sourceUnchanged=true`。
- source digest：`a739a3cb67ba835877db8aa2b83194380cfd39bdee4e59c8590ce90e24f3f98e`。
- 安装 bundle digest：`a78b569093a1b63d53b6d6e97800a9aea810eefdac60cde337b5cba288768e5e`。
- result Info：`097e045a16499379e5195c355a2ed296e7ed21cb44df0ad4460ff390fcf5d7f7`。
- run manifest：`d1b43669df0b440d4ec3d5afdfdfd47fcce21bf09094ea85b1dbe6adf47ad523`。
- ui summary：`48eb0e4543317dc18380e1876964c908d94838b9a9ed1090ae3e15c2ffbb24ce`。
- server counts：`67bd73fe356caf33c7a9bde16fc94e2f65b98140e00a038501670d6e83a84b74`。

单测导出的两张1290×2796截图均亲看：绑定中开关为开且状态为本曲结束后停止；切到 `Synthetic tone 2` 后状态为“未开启”、开关关闭。

| 文件 | SHA-256 |
| --- | --- |
| `Sleep track binding before manual track change` | `42ed1798ec288c56173d9d67e4ba6260b99d2f5d4ebecd8eaad64cde16a11189` |
| `Sleep binding cleared after manual track change` | `80ffadb2df702c4001528d9d9dae037b045607587d973b92b2cb501b88c2156a` |

为核对与既有睡眠用例的顺序隔离，随后在同一进程执行自定义计时、滚轮、自然到期和手动切歌四项：`build/SourceUITests-1793867675973.xcresult` 为4通过/0失败/0跳过。四项耗时分别为70.373、118.938、183.302、106.023秒，合计478.636秒；runner从启动到结束588.282秒。`sourceUnchanged=true`，安装 bundle digest 与单测相同，证明四项之间无状态串扰。

组合 run manifest `e2b32b906ce695346b4e8afec1024a6fca745888ae9e503c1a89b4cea8a892f1`、ui summary `bf03860a9fd8891dfa84a568f7f36a075c9620b1acbb00f21e0a250438b67e65`、server counts `457ed998dab7a429ad972e6f4da7e2a712e5541ebb2ab9232b5a45ab3b3e6133`、result Info `e4e6327440263223fda37a095993faeabe46e74510bb59abe9c398b5257699b0`。10张睡眠截图从组合结果导出，截图索引 `f8cf3db17ae5e1272353619f48ebe3bf395097df74a56c23160a71f4a50a8599`；本批两张新图为1290×2796并亲看：

| 组合导出文件 | SHA-256 |
| --- | --- |
| `009-Sleep-binding-cleared-after-manual-track-change.png` | `b9689a09b6eb9c637d33ae0bef9f513af7938d3f966af00a6c8f6460b2e10dfa` |
| `010-Sleep-track-binding-before-manual-track-change.png` | `b520451ecdd32e9c95ee82c6427eef57bba1bf7bb58e7d96a7c8e034ee625ecc` |

完整 `npm run check` 为1035/1035通过，日志SHA-256 `4e0fff7b5a0728d5f3eb2e26c6a6acfcd91cb6831ecd23d981f2e6cfb40bc8fb`；Swift解析、workflow YAML解析和 `git diff --check` 通过。产品二进制与前批相同，不重复生成IPA。完整native上批已通过，本批未改产品/原生源，未重复运行。

## 范围边界

本批只证明模拟器正式播放链路下的前台手动切歌。仍不能替代长时后台/锁屏、实体手势、VoiceOver、动态字号/小屏、真实私人曲库、Apple签名和iOS27云端终态；J29继续保持B状态，不关闭。

复现：

```bash
source scripts/environment.sh
export NODE_OPTIONS= PYTHONPATH=
NEXUS_UI_RUN_DIR=build/sleep-track-change-20261105-r1 node scripts/test-ui.mjs \
  NexusMusicUITests/SourceSettingsTests/testSleepTrackBindingClearsOnManualTrackChange
```
