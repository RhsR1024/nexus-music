# 本地六字段排序：真实音频验收场景

本批遵守0079/0080：使用已完成的Sollin可见功能资料，不增加参考采集，不设置全局像素相似度门槛。功能依据E-706–E-746→F015→P012、E-788/E-790/E-792/E-794→F019→P017及E-932/E-934/E-936；当前动态case严格复核395E/101F/99P/3WI/117events，0错误0警告，APK gate与--review通过。

## 实施前状态与锚点

- 正式音乐库→本地音频→Files导入两首完整真实公开MP3。来源为用户指定resources/V261020的原始脚本；不改音频字节、不补造标签、封面或歌词，不用合成数据截图验收。
- 独立iPhone 15 Pro Max模拟器，目标430×932pt、3x截图。沿用safe-area-context与spacing令牌；排序字段、方向和选项的点击区至少44pt。展开面板允许换行，列表占剩余高度；无遮罩或缩小包含区。
- 先验名称正倒序、时长、文件修改时间、添加时间、艺术家、专辑，再验关闭重启保持和搜索过滤后真实PCM播放。截图记录排序列表、展开面板、持久状态及播放；转场和真机动效另验，不用静态截图宣称通过。
- 文件修改时间来自文件选择器实际交付的导入输入，不能保证各第三方FileProvider保留源设备原始mtime。旧条目无时间则保留未知，两方向均排已知时间后并明确提示；不以导入当前时间回填历史文件修改时间。
- 缺少同平台同真实内容Sollin截图baseline，不生成像素分数；依据正常导航、可达性、层次、文本换行与列表空间亲看质量。

## 结果

最终Release `SourceUITests-1792914501755.xcresult`，`testLiveLocalSorting` 1通过/0失败/0跳过、106.473秒；sourceUnchanged=true、两首外部输入前后哈希一致、四附件provenance均ready。SDK26.2、iOS26.3.1独立模拟器，430×932pt、1290×2796px（3x）。首次空库导入完整流程另见第二轮157.042秒成功；最终轮复验相同内容跳过不新增与原排序时间保留。

正常导航→Files两首完整真实MP3→六字段正倒序实际首行断言→添加时间倒序→关闭重启仍保持→展开六选项→Perfect过滤1/2→正式播放器PCM解码/暂停。两首均缺艺术家/专辑标签，实际验证未知项保留及名称次级排序；不同主键用六种互异排列的逻辑测试覆盖。没有编辑标签或音频字节。大字号、紧凑屏与真机未在本批重验。

四张最终附件均亲看：名称倒序为Shape→Perfect，添加时间倒序及重启后为Perfect→Shape；展开选项自然换两行，无水平截断，歌曲列表保持滚动。排序选项/方向以controls.hit保证至少44pt；圆角/间距引用radius.md/space令牌。播放器真实进度、暂停及原始MP3文案可读；未知封面/歌词如实回退。展开时第二首末尾动作需要滚动，不把截图外区域视作已验完。无同平台同真实内容baseline，未运行像素比较或生成相似度分数，亦不宣称动效一致。

| 最终附件 | SHA256 |
|---|---|

| 001-Real-sorted-audio-PCM-playback.png | `0894a6b77daab08e56ecbcb62f76cb5a673202ba74b2ad9c8b0cf6c7bd4306a0` |
| 002-Real-audio-six-field-sort-after-restart.png | `7cc3b975018362c33473b10d9b5c5204491af591bf1992674a0801e2fc092197` |
| 003-Real-audio-added-descending.png | `3b5225dcd3b2e1e72eb07235ec2e6cb70240f879ec527ede2bc5f0fcfe87ef44` |
| 004-Real-audio-name-descending.png | `b92f1b6c620726bb78e54e32f32d5a047a4476bcc8aa4aeccdc88fbd20d69186` |

确切manifest、source/installed bundle与工具哈希见[实施回执](../2026-10-25_implementation-local-sort-report.md)。原件位于本机忽略build/local-sort-live-20261025/r4，未提交截图或音频。
