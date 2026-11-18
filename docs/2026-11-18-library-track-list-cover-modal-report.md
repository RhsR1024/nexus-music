# 音乐库歌单封面在歌曲列表弹层的纵向验收

本批补齐 2026-11-05 歌单封面批次遗留的 `track-list-cover` 实际弹层视觉缺口。既有证据已证明歌单列表和详情优先使用安全公开封面，但目标歌单为空，没有覆盖“歌单已有歌曲且首曲封面失败、歌单封面仍应胜出”的真实弹层路径。本批不改变产品逻辑，只增加合成夹具和正式 Release UI 证据，确认 `TrackListModal` 使用 `playlistCoverSource` 的结果而不是直接使用首曲封面。

## 实现边界

- `TrackListModal` 的头部本来就调用 `playlistCoverSource(coverUrl,tracks[0])`，安全公开歌单封面优先，缺失或不安全时回退首曲；本批没有修改该逻辑。
- 新增仅模拟器可用的 `NEXUS_UI_PLAYLIST_COVER_MODAL_FIXTURE=1`：通过正式 `LibraryStore.createPlaylist` 创建一个含单曲的歌单，歌单封面指向本机夹具 PNG，歌曲 `artwork` 故意指向不存在的地址。
- 新增 XCTest `testLibraryPlaylistCoverModal()`：打开音乐库 → 我的歌单 → 该歌单详情 → “全部歌曲与批量管理”，等待 `track-list-cover-image`。如果弹层错误地改用首曲封面，首曲封面会加载失败，断言不会通过。
- 夹具只影响主动指定的 Release UI 测试；正常构建、生产入口、真实音乐库数据和封面缓存策略不变。

## 验证

- `npm run check`：1156/1156，0 failed/skipped/cancelled；`typecheck` 通过。
- Xcode 26.3 工具链 `swiftc -parse -swift-version 5 ios/NexusMusicUITests/SourceSettingsTests.swift` 通过。
- `node --check scripts/test-ui.mjs`、`git diff --check` 通过。
- 正式 Release `build/SourceUITests-1794986935325.xcresult`：
  - `testLibraryPlaylistCoverModal()`：1 passed / 0 failed / 0 skipped，29.309 秒。
  - iPhone 15 Pro Max 模拟器、iOS 26.3.1、x86_64。
  - `sourceUnchanged=true`、`exitCode=0`。
  - 源码 digest `8df9aa8f89abddd10aca9cd4508927fb9de5e5266a95c254b37370e9a70be085`。
  - 安装 bundle digest `3d86f254d65f2f78d0e45de131ba768d29078d236d32585b1468f93918e19a7d`。
  - result `Info.plist` SHA-256 `b272d53cfa4b731f2bb15d7608c4d2f49d62637925192491fab8487c1912f2a6`。
  - 运行目录 `build/ui-playlist-cover-modal-20261118-r1/`。

## 截图

1 张 1290×2796 PNG 已导出到 `build/ui-playlist-cover-modal-screens-20261118-r1/` 并亲看：

| 状态 | 文件 | SHA-256 |
| --- | --- | --- |
| 弹层使用歌单封面 | `001-Track-list-modal-shows-the-saved-playlist-cover-instead-of-the-missing-first-tra.png` | `7fb294e02527e578e19bdaad4fde0da6bed1f67677b03146cd6bf9301e398d61` |

截图索引 `index.json` SHA-256 为 `47937fc8f88cd22a7d1ac029d12f72f356c1b621ef67c9db3287b1d71afbeeed`；`verifyCaptureEvidence` 返回 `ready:true`、`failures:[]`。截图中弹层头部显示红色歌单封面、标题“Playlist cover modal fixture”、`显示 1 / 1 首 · 已选 0 条`，下方单曲行完整可见，无横向裁切、重叠控件或假入口。

## 边界

本批只证明合成歌单在正式弹层中的封面优先级和失败回退路径。真实大歌单、真实封面 CDN、实体机、VoiceOver/动态字号/小屏、签名和 iOS27 云端终态仍开放；它也不增加 Sollin 页面像素或动效完成量。J24 与完整 F11/F23 不关闭，整体目标保持 active。
