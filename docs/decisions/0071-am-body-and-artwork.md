# 0071 AM 完整封面与正文切换

2026-10-18。固定IPA的新E040→F039→P039经reverse-skill R2/mobile-reverse、原offline scope/门禁及40E/39F/39P严格review后，采纳AM封面/歌词/队列三态互斥，重复选择当前歌词/队列回封面。字段0xa7的初始化、捕获写入和toggle读相互对应，竖排独立节点及控制区分离已核；1830原始指令/160BL/128池引用。完整手势、动画、精确几何和参考运行未恢复；报告见[AM证据](../2026-10-18_reverse-sollin-am-content-report.md)。

截图4859/4861/4863/4866只补视觉。固定IPA枚举未证明评论为第四正文态，原猜测工具回调实际打开音质选择，故本批保留已有评论入口，评论正文另行取证。封面占正文主体、歌词/队列用紧凑头和独立可滚动正文，进度/主控固定在下方；隐藏正文不挂载，避免AX/触摸和异步会话争用。切换不操作控制器、队列或播放意图。采用自身可用宽高/大字/横屏预算；不宣称照搬参考像素。

五固定参考已逐一核对HEAD并亲读：悦音d6f1af7 LyricsView.tsx154–178当前行/容器；Q547ccfe Horizontal/index.tsx55–78封面控制与歌词分栏；wtf6624ab5 Vertical/index.tsx80–99 pager子页flex防iOS塌缩；Cybf0d469 components/lyric/index.tsx40–65状态与当前行；自有Wayferar8e47cdc StageLyricLayout.java17–47宽度/Unicode。只参考职责，音枢原创复用Cover/Lyrics/QueuePanel，无源码、资产、依赖、旧RN pager或原生补丁移植。悦音根MIT/README限制冲突、Q/wtf Apache2与逐文件头、Cy Apache2/RNTP独立、自有Wayferar与第三方边界沿既有记录。TS呈现可供未来Android，实际触摸/窗口/原生歌词仍需各平台验收。

本批保留音枢原曲收藏/评论、匹配录音封面歌词、唯一播放意图与权威队列、LX/Navidrome/WebDAV/来源诊断/PCM/EQ。测试要求实际大封面方形/父框包含、正文互斥/重复返回、暂停切换不定位、原歌词来源和队列可用，并保留原八布局/PCM/统计/重启/凭据清理。小屏、大字、横屏另验；业务、App、clean archive和对应iOS27分别记实，不提高开发百分比。

实际大字图暴露当前行高于列表视口时，viewPosition=.35会滚入长行中部。仅AM系统fontScale>1.8使用viewPosition=0，保留用户字体/字号/滚动阅读；普通字号/AM2保持.35。新增真实列表和行首frame断言，最终复验单独记录，不把前轮操作通过冒称完整大字视觉成功。

292e076清洁SDK26.2 unsigned归档/CRC/正式入口/私人资源排除通过，IPA SHA256 bc907d15342c30c7ab8cd82a2d0013f3be24dd135491934f09935a44bcbbf7e9。正常push/远程main实核一致；对应iOS27新39142704842唯一pending，b492261继续运行，旧3385605pending自动替换。云端终态/真实服务/签名/真机仍待。
