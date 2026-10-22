# 经典播放器快速场景实施前规格

目的：遵守UI_ALIGNMENT_WORKFLOW，使用正式MusicApplication/Player/ClassicLyrics缩短日常截图；阶段出口仍走综合Navidrome正常导航，快速入口不等于交互验收。

当前两行根因：test-ui.mjs getLyricsBySongId只有0/6s两行，ClassicLyrics默认visibleLines=3、slice从active−1取至+3，没有第三行可呈现。本批不改歌词产品布局。

计划独立tests/e2e/classic.tsx，以真实createServices和localhost合成Navidrome connect/songs建立规范Track及唯一队列；默认blush/rose、light、fontScale1、classic、gradient、封面取色/动效关闭、字体/偏移归零。通过正式mini展开，不增加产品假入口或专用截图页。

独立XCTest testVisualLabClassicDirect显式选择测试entry；正式index.ts不导入，其他测试显式skip该目标。独立曲目id使旧歌词缓存不污染；服务端仅该目标返回三行（0/100/116s），112s处中行高亮、前后灰，文本长度匹配参考密度但不冒称原素材已取得。保留综合两行夹具和其压力断言。

先通过真实播放/ready/媒体duration，再seek约93.66%，等待字体、封面、三行歌词、几何稳定后截图；记录entry及test-ui.mjs完整哈希、安装包/JS/源码/xcresult、明确内容差异。至少两次独立采集确认噪声；同ROI和门槛复算，不通过不计完成。新夹具与r23内容不同，指标变化不能归因于产品代码。

首次r24独立场景27.120秒通过（旧综合610.411秒），但尚未固定lyricStyle/rate/shuffle/repeat，不能声称完全同态。补齐重置后用r24b/r24c两次独立采集建立正式基线。r24量测：歌词墨迹535/570.33/606.67参考，对候选558/593.67/630pt（下移23–23.67）；播放中心766→778（+12），后续先修歌词块前后空间分配，不能直接改所有下方控件。
