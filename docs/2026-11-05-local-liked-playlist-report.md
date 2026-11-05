# 本地“我喜欢的（仅本机）”收藏派生歌单

本批修复设备歌单域的默认歌单“我喜欢的（仅本机）”此前始终显示 0 首的问题。默认歌单现在直接投影本机音频的 `favorite` 标志：在本地歌曲列表收藏后进入默认歌单即可看到该曲，取消收藏会同步移出；自建设备歌单继续使用自己的持久化成员，不改变双歌单域隔离。

## 实现

- `src/domain/devicePlaylist.ts` 新增 `FavoriteDeviceAudio`、`favoriteDevicePlaylistEntries()` 和 `devicePlaylistDisplayEntries()`。默认歌单的条目由其当前本机收藏派生，自建歌单仍返回真实 `entries`。
- `src/ui/LocalAudioLibrary.tsx` 的歌单列表计数、封面、详情和批量选择均使用同一派生视图；默认歌单不显示改名或删除控件，并明确说明“自动显示本机收藏的歌曲；取消收藏会同步移出此歌单”。
- 默认歌单的逐曲“取消收藏”和批量“取消收藏”均调用既有 `services.localAudio.setFavorites(..., false)`；自建歌单的“移除”和“移出歌单”路径保持原样。
- 本机歌曲行的收藏反馈改为“已收藏（仅本机）”/“已取消收藏（仅本机）”，不再沿用可能被误读为云端收藏的旧提示。
- 未新增持久化成员副本、存储版本迁移、同步键或播放队列。默认歌单只投影当前可见的本机文件；底层收藏标志仍由既有本地音频存储保存，文件索引隐藏后恢复显示时可按原标志重新出现。

## 验证

`npm run check` 为 1026/1026 通过，0 失败、取消或跳过；完整 `npm run test:native` 退出 0，覆盖真实音视频解码、系统媒体、WebDAV、缓存和截图工具链；`git diff --check` 通过。

正式 Release 证据为 `build/SourceUITests-1793850809039.xcresult`，用例 `SourceSettingsTests/testLocalPlaylistDualSystem` 为 1 通过 / 0 失败 / 0 跳过，测试耗时 84.332 秒，`sourceUnchanged=true`，运行目录 `build/local-liked-playlist-20261105-r4/`。

- source commit：`b18d25968752d041eb5db28324ad2c0fc931227c`
- source diff SHA-256：`f2bd0a16ffd60510c4376482bc0a2a4360abfbd93151b60d7b49234bb98caad2`
- source digest：`a328cb8c3fe659de4943104575f8f2d28e246cf1c12f5c01a5fa23236315dcaf`
- installed bundle digest：`50b44eddc75397f2c756c23520bac8025b92eed45ef73f87f2a91e30fe31dcef`
- xcresult result info SHA-256：`7a67d636b5610af1e0309bda1645ce179fd4552b8916858db20cc15269393512`
- run manifest SHA-256：`297bd6f9c04ccbc99d42aa4832c9b1a722bf39fde6feceb066efe1c2659d34be`
- screenshot index SHA-256：`aabe54776c9efc5b7b5b9a7d59f7c0ec827872ed780627f8d7f31d7a4f05564f`

`testLocalPlaylistDualSystem` 使用合成本地 MP3 和正式本地歌单、收藏、选择器组件，覆盖：

- 先清理模拟器跨轮遗留的本地收藏，导入合成音频后收藏，默认歌单显示 1 首。
- 打开默认歌单，验证派生详情、真实曲目行、逐曲“取消收藏”和批量“取消收藏”入口。
- 单曲取消收藏后默认歌单进入空态；返回列表显示 0 首。
- 回到歌曲页重新收藏，确认“已收藏（仅本机）”反馈，再进入歌单确认恢复为 1 首。
- 保留原有新建/删除自建歌单、默认歌单不可删、选择器排除默认、提交关闭和音乐库双体系隔离断言。

6 张 1290×2796 截图已导出，均来自精确 r4 xcresult；已人工亲看收藏恢复、派生详情、取消收藏空态和歌单计数视图。关键截图为：

| 文件 | SHA-256 |
| --- | --- |
| `002-Local-picker-submitted-and-closed.png` | `82de2312544d8422881d3e18b621e569e51be706b413a568cf6497367b60a8bd` |
| `003-Local-favorite-projection-restored.png` | `da27d81cd4112d207ddfefebb71fc9f5c1b8c11b16adafdc668e66ba251b27dd` |
| `004-Local-liked-playlist-empty-after-unfavorite.png` | `cd6b392ef4aa2ea7ca6c2dfb2069e57c192b1e6f87978c411b9cb289700de749` |
| `005-Local-liked-playlist-derived-detail.png` | `8cb7e77619e48a724844d47982ecddf7bf2d4b89c689fd4224ff88db66d0d507` |
| `006-Local-playlists-default-list-with-derived-favorite.png` | `aefbfd71740fc7daec717d5631135fb91f5b314a8fac101f23c1c247c24c5bc9` |

失败轮次均保留且不计通过：r1 在“歌曲”页错误寻找歌单输入框；r2 在文件选择器已打开后才尝试清理旧收藏；r3 已通过但随后修正陈旧成功提示，由 r4 取代。

## 边界

本批关闭默认本机收藏歌单始终为空的缺陷，不关闭完整 F11/F23、实体机、Apple 签名、iOS27 云端终态或全部项目。`device.playlists.v1` 仍只在本机，默认歌单不是云同步收藏集合；隐藏索引、文件删除、真实多文件夹和弱网恢复继续按既有边界验收。无新增 Sollin 采集，沿用 E-1247–E-1251 的既有可见能力证据，不访问私人账号、私有接口或商业逻辑。
