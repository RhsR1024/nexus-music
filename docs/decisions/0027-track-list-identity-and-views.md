# 0027 歌曲列表搜索、排序与稳定条目操作

日期：2026-10-16。对应S2/J19/J23/J24/J25，范围为歌单/收藏/历史及公开详情的列表操作，本批不宣称完整在线歌手/专辑实体搜索完成。

## 需求与现状

当前TrackListModal用数组index保存勾选，列表数据变化后可能指向另一条歌曲；LibraryHome仅20条预览、完整列表虚拟化已有，缺搜索/排序/首曲封面与滑动操作。公开发现详情保留平台分页，不能把已加载排序宣传成完整服务端排序。排序只改变展示，不能改写原歌单、当前播放队列或启动音频；点击显示条目必须按显示序列与准确位置建队列。重复歌曲按playlist entryID操作，删除一条不能连带相同录音另一条。

## 五参考比较（沿REFERENCE_COMPARISON固定提交）

| 参考 | 亲读证据 | 采纳/放弃与维护 |
| --- | --- | --- |
| 悦音d6f1af7 | src/screens/Playlist/index.tsx:432–476 detailProcessedTracks搜索title/artist/album与副本排序、detailVisibleTrackCount | 参考视图变换，不复制分页渲染实现；音枢使用FlatList虚拟化，未知时长不当0秒排前 |
| Q547ccfe | src/screens/SonglistDetail/MusicList.tsx:25–104，listAction.ts:12–37；components/OnlineList/List.tsx:98–136 | 参考分页/原歌单与临时播放列表职责；不用track.id代替重复条目身份，不把未加载全曲声称完整搜索 |
| wtf6624ab | 同名MusicList和components/OnlineList/List.tsx:66–138、201，多选保存对象、刷新清理 | 原创稳定键选择与有效条目裁剪，不用对象引用/索引追踪；失败保留原库与已加载数据 |
| Cybf0d46 | src/components/PlaylistTracksList.tsx:16–98封面、多选、selectedTracks Set<string> | 参考封面与批量职责，列表外层不嵌套同方向全量滚动；不采用按媒体ID删除所有重复项 |
| 自有Wayferar8e47cdc | docs/releases/2026-10-08-284.md:25–33准确项/重复项/排序不重播和不改原歌单 | 保留身份与播放边界，Android手势/Smali不搬iOS。本批不是重新实现队列跨屏拖动 |

原创TS视图模型与RN组件，不复制第三方源代码/依赖/资产，许可仍按原参考记录；TS可共享Android，RN横向手势需两端体验验收。

## 行为与验证计划

- 搜索覆盖标题/歌手/专辑（Unicode规范化）；排序提供原顺序、歌名、歌手、专辑、时长长/短，稳定同值，未知时长始终末尾。
- 本地条目key为entryID，收藏/历史为来源身份；勾选跨排序/外部插入不漂移，外部移除裁剪；所有删除与上移重查ID，不使用旧显示index。
- 筛选全选只选当前结果；批量动作明确选择数量，重复条目按ID删除；失败保持选中与原库。
- 横向滑动只露出删除按钮，点击后确认；纵向滚动不触发删除，VoiceOver保留显式删除入口。
- 公开详情搜索/排序明确“已加载”；完整导入仍用原provider全量路径与原顺序。虚拟列表与封面缓存有界。
- 领域回归覆盖10,000条、稳定排序/重复/长ID、筛选及原始数组不可变、外部修改与准确批量删除；本地App真实UI及两套构建、手机手势/大字另验。

本地证据：242项业务与类型检查通过；`build/SourceUITests-1792141013648.xcresult`千首Files/UI专项92.293秒通过，含准确重复项删除、排序不丢选择、重启和左滑确认。六排序选项折叠展示，避免常驻挤占列表；大字/手机实际触控继续。
