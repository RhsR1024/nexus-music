# 酷狗平台收藏与建单边界

本批目标为 J10 酷狗平台收藏纵向切片。只核对固定公开源码与本机参考，不请求真实账号服务，不逆向新增 Sollin 采集，也没有据此新增入口或宣称写入成功。

## 已核对来源

- Q-music Android 固定 `5db858f32695d10c5e9ef0f7037d586aef6a8c4b`，根 `LICENSE` Apache-2.0，`NOTICE` 保留 Nshpiter/LX；`src/core/musicAccount/kugouApi.ts` 和 `playlists.ts` 只提供账号歌单目录及曲目读取。
- Sollin-Music-Desktop 固定 `c9d446f6ad3b7ea1aff64bd5ce290b6e7f9712a8`，MIT；其账号收藏、`likeSongIds` 和创建歌单均属于本地或网易云路径，没有酷狗平台收藏写入。
- MakcRe/KuGouMusicApi 固定 `7ac64e1cdd333ad9bfff644ded82a0ffeef002d1`，MIT / Copyright (c) 2023 MakcRe；`module/playlist_tracks_add.js`、`module/playlist_add.js`、`module/user_playlist.js`、`module/playlist_detail.js` 提供歌单目录、向已有 listid 添加歌曲及创建/收藏歌单的参数事实。
- 来源清单 `build/kugou-platform-write-source-review-20261105.json` 记录8个文件的 Git blob SHA-256；没有复制运行时、服务器、依赖、凭据或Android桥。

## 结论

- 账号目录与曲目读取已有音枢只读实现，可先读成员 hash。
- 目录项没有稳定字段能证明某一 listid 就是系统“我喜欢”，源码也明确把自建与“我喜欢”共用 `type:0`；按名称猜测不安全。
- `playlist/tracks/add` 的目标是显式 listid，不能据此证明已写入“我喜欢”。
- `playlist/add` 的 `type:0` 可创建自建设定，但名称/隐私/来源参数和创建后返回身份、归属及可见性没有可靠验收；缺少可保守绑定的合成服务。
- 因此当前不能实现“先读收藏→一次写入→回读确认”的酷狗收藏闭环，也不把“向任意歌单加歌”冒充为平台收藏。没有新增 UI、账号 capability 或真实服务结论。

## 后续门槛

需要独立、可复核的协议证据同时给出：系统喜欢歌单的稳定身份、歌曲身份字段、单次写入语义、写后读取目标及可见性延迟。满足后再按网易云/QQ批次方式实现账号绑定、取消、并发和回读确认；真实酷狗账号验收另行记录。本批不关闭 J10。
