# 音乐库歌曲列表弹层封面 UI 场景

日期：2026-11-18。场景：音乐库 → 我的歌单 → 歌单详情 → “全部歌曲与批量管理”弹层头部。该页面是音枢自有功能 UI，不是 Sollin 参考页面的像素对齐项；按层级、可达、反馈、无裁切和正常操作验收。

## 环境与几何

| 项 | 值 |
| --- | --- |
| 主参考环境 | 1290×2796 截图、430×932pt、3x；iPhone 15 Pro Max 模拟器 iOS 26.3.1 |
| 弹层 | 正式 `TrackListModal`；全屏 `Modal`，`paddingHorizontal:24`、`paddingTop:64` |
| 头部 | 横向 `flexDirection:'row'`、`gap:16`、`alignItems:'center'`；封面 `88×88pt`、圆角取主题 `coverRadius` |
| 标题 | 24pt header，位于封面右侧；计数为 caption 色，`marginTop:7` |
| 封面来源 | `playlistCoverSource(coverUrl,tracks[0])`：安全公开歌单封面优先；缺失/不安全时回退首曲 |
| 歌曲行 | 单曲行完整显示序号、标题、歌手/专辑与操作按钮，不依赖封面是否加载 |

## 验收状态

| 状态 | 期望 |
| --- | --- |
| 歌单封面可用、首曲封面不可用 | 弹层头部显示歌单封面图片，不显示首曲失败占位 |
| 歌单封面缺失/不安全 | 回退首曲封面；首曲也不可用时显示主题占位字，不崩溃 |
| 标题与计数 | 标题为歌单名；计数准确显示当前结果数和已选数 |
| 歌曲内容 | 歌曲行完整可读，无横向裁切或重叠 |
| 关闭与清理 | “收起歌曲列表”返回歌单详情；测试夹具删除后不残留歌单 |

## 验收方法

- 合成夹具 `NEXUS_UI_PLAYLIST_COVER_MODAL_FIXTURE=1`，通过正式 `LibraryStore.createPlaylist` 创建 `Playlist cover modal fixture`，含一首 `Synthetic cover track`。
- 歌单封面为 `http://127.0.0.1:18439/playlist-cover.png`；歌曲 `artwork` 为不存在的 `http://127.0.0.1:18439/missing-track-cover.png`，因此弹层出现图片只能来自歌单封面。
- XCTest 先确认详情页 `library-playlist-detail-cover-image` 可见，再打开批量弹层并等待 `track-list-cover-image`；随后校验 `track-list-count` 并关闭、删除夹具。
- 截图统一为 1290×2796，逐张亲看标题、封面、计数和歌曲行。

## 最终截图

最终 Release `SourceUITests-1794986935325` 为 1/0/0、29.309 秒、`sourceUnchanged=true`；1 张 1290×2796 截图位于 `build/ui-playlist-cover-modal-screens-20261118-r1/`，索引 SHA-256 为 `47937fc8f88cd22a7d1ac029d12f72f356c1b621ef67c9db3287b1d71afbeeed`：

- `001`：弹层头部显示红色歌单封面，标题、`1 / 1` 计数和单曲行同屏可见。

逐张亲看通过，无横向裁切、重叠控件、空窗或假入口。截图只证明音枢功能 UI 质量，不增加 Sollin 像素/动效完成量。

## 边界

真实大歌单、真实封面 CDN、实体机、VoiceOver/动态字号/小屏、签名和 iOS27 云端终态仍开放。合成夹具与模拟器截图不替代这些验收。
