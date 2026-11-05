# 歌单回归播放器皮肤前置条件

旧云端`41962294108/e6e5668`核心组24通过/1失败。compact日志显示唯一失败发生在`testPlaylistSearchSortAndDuplicateRemoval`打开播放器后查找“查看播放队列”：上一个用例保留photo皮肤，AX仅有“显示写真操作”，队列按钮尚未展开。修正是在启动后调用已有正式设置辅助器`selectClassicSourcePlayback(in:app)`，再执行原有全部歌单断言；没有改产品、隐藏失败或放宽断言。

## 正式回归

Release`build/SourceUITests-1793861686105.xcresult`为1通过/0失败/0跳过，测试202.196秒，exit0、`sourceUnchanged=true`。覆盖1,000首合成歌单导入、播放全部、单曲切随机、增量加载、搜索、排序与重复条目精确移除。两张1290×2796截图已来源核验ready并亲看：随机已选且单曲未选；移除后999/999且仅剩一个Duplicate fixture。

- source digest：`de84841d5cef0461093731cc09fe845d23ba5286ba375fea1b60d3f3ee81fdfc`。
- 安装bundle digest：`1791dc61e5cf5895a9a7a94092c69dc225ba8beb44a3086ad550eda2fe4d3cf2`，与上一F33批相同。
- result Info SHA-256：`4d67fc5b84cf410a64c90125a3dff1a71f09162cfd84f19e75e12761785f6732`。
- manifest SHA-256：`30bb508e063a187b9702c4c857fbf6ef34b8ad20dde8c2f617282bf7c8b7799f`。
- 截图索引SHA-256：`8e710f546e28c3030cb6cca745b6f113caef77285b4acf790888fc489c2fe5f9`。
- 最终歌单图：`0a159ce9764f88706f769dbce45105c30cb42bb72aad0ec2a67dbb5dafbe8df7`；随机图：`dc8bfbd4e60a6a9ae45cdf24eb61b3c42acf6e684d62b22320e96e2427362ce0`。

仅XCTest一行变更，正式Release已编译执行；不重复生成相同产品IPA。上批产品1030项检查/native及clean unsigned IPA仍见[同步回执](2026-11-05-sync-confirmation-report.md)。本地专项通过不改写旧云端失败；最新云端终态、实体大歌单、手势/无障碍及签名继续开放。

## 归档与恢复

正式运行目录、完整xcresult、runner日志、测试差异和报告保存到已挂载T7的`NexusMusic/BuildArchive/2026-11-05-playlist-layout-isolation`，逐文件清单与复制回执存于阶段根。保留源证据，零删除。依清单相对路径恢复到项目根；产品包复用`2026-11-05-sync-confirmation-ca38b9f`阶段。下一推进F33忙碌期间前台刷新请求的合并重试，保持显式确认与零自动PUT。
