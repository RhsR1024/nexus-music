# WebDAV 同步保留歌单元信息

修复首次 WebDAV 同步会丢弃本地歌单描述和安全公开封面 URL 的问题。

## 根因与实现

`LocalPlaylist` 已包含 `description` 与 `coverUrl`，本地备份清洗也保留合法值；但 `multiDeviceSync` 的歌单记录重建只写 `id/title/createdAt/updatedAt/entries`。WebDAV 首次提交后，本机从缺字段的合并结果重建音乐库，导致原始描述和封面被清空。带公开范围说明的咪咕导入副本同样受影响。

同步清洗现保留描述，并沿用 `safePublicURL` 只保留无凭据、无敏感查询参数的 HTTP(S) 封面；不安全封面被剥离而不是写入同步文档。同步格式仍为 v1。旧客户端按其白名单读取时会忽略新增字段，后续设备再同步仍可能剥离它们；因此这不是混合版本长期兼容方案，降级保护需要未来的强版本策略独立决策。

## 验证

- 修复前复现为空目录首次同步后描述/封面均为空，日志 `build/sync-playlist-metadata-before-20261105.log`。
- `build/multi-device-sync-metadata-20261105.log`：16/16，覆盖首次应用、编码/解码往返、双端恢复及带用户信息的封面剥离。
- `build/webdav-sync-metadata-r2-20261105.log`：14/14，覆盖两个合成 WebDAV 客户端提交、读回、回环同步及持久化后的元信息。
- `build/search-session-all-fixes-check-r2-20261105.log`：最终源码1025/1025类型/业务检查通过。

无真实账号、私人服务器或实体机参与；混合版本降级、强同步版本与真实设备验收仍开放。
