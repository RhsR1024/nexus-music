# 网易云音乐平台歌单删除纵向切片

本批在设置 → 账号 → 网易云账号歌单中开放“删除”当前账号创建的网易云歌单。删除与既有平台歌单创建、加歌、删歌共用账号目录和主题，但使用独立 `NeteasePlaylistDeleteClient`：严格绑定当前账号、会话、`userId`、`netease:` 用户名、Cookie 与目录中的歌单创建者；先读取账号目录，目标存在才发送一次删除写入，随后最多两次回读，只有确认目标缺席才显示成功。平台歌单重命名仍明确不开放。

## 协议与许可

基于固定 IPA `c2ee2deba236ef1b9e097e1d8cdc0b816137aa57cf85d4c8e2811dae9924bc07` 的证据 `E-061 → F-052 → P-052 / WI-026`，并亲读固定 MIT [Sollin-Music-Desktop](https://github.com/Ryderwe/Sollin-Music-Desktop) `c9d446f6ad3b7ea1aff64bd5ce290b6e7f9712a8`：

- IPA `App.framework` 包含 `/weapi/playlist/remove`（raw offset `0xe429e0`）、`/weapi/playlist/update/name`（`0xe01930`）、`/weapi/playlist/create`（`0xeb1480`）与既有 `/api/playlist/manipulate/tracks`（`0xe4b900`）。
- 固定桌面参考的删除路径调用 `/api/playlist/remove`，请求体为 `ids: [id]`，且只读取响应 `code`；该参考没有账号/创建者绑定、先读、幂等、写后回读或取消状态机。
- 同一参考的重命名路径调用 eAPI batch，并同时写入描述、标签和名称。没有可靠的现有描述/标签副本时，音枢不使用猜测值覆盖平台元数据，因此本批只开放删除，重命名保持关闭。

音枢只采用端点和字段事实，自行实现账号绑定、目录回读和状态机，没有复制参考运行时、UI、依赖或私有逻辑。原始 JSON 证据 SHA-256 为 `f8368acee1a4d5cc9301d7aa955f89b5f9aa874f42966d6bbe946e7570bb5594`。

## 实现

- 新增 `src/providers/neteasePlaylistDelete.ts`：只接受 `kind === 'created'` 且 ID 为 1–19 位十进制数字的歌单；会话版本必须为 1，平台、`accountId`、`userId`、`netease:` 用户名与 Cookie 必须同时匹配。
- 写前读取 `/weapi/user/playlist`，按页核对目标 ID 和 `creator.userId`。目标不存在返回 `absent` 且零写入；存在才调用一次 `/weapi/playlist/remove`，请求体为 JSON 字符串单 ID 数组 `ids: "[\"<id>\"]"`。
- 写入后最多两次回读，间隔 800ms；只有回读确认目标缺席才返回 `deleted`。`code:200`、HTTP 成功或单次可疑响应都不单独构成成功。
- 写前响应拒绝/不可用、写入拒绝、写后回读失败、登录失效、账号变化、取消、畸形数据和目标缺席分别返回稳定状态；写后失败一律降级为 `unconfirmed`，不自动重试。
- 设置页账号歌单卡片新增仅对创建歌单显示的“删除”按钮，确认弹窗明确“将从当前网易云账号删除”，并说明歌单与歌曲不会复制到音枢；成功后只移除当前目录行，不删除音枢本地歌单或歌曲。
- 修正共用账号卡片说明文案：只有网易云平台提示“新建与删除会直接修改平台数据”；QQ/酷狗仍提示“导入不会修改平台歌单，也不会同步”，避免把仅网易云可用的写操作描述成所有平台通用。
- 新建区持续显示“重命名暂未开放：现有协议需要同时写入描述和标签，音枢不会用猜测值覆盖平台资料。”没有新增假入口。

## 验证

### 单元与静态检查

- 新增 `tests/netease-playlist-delete.test.ts` 17/17：成功单写与回读、零写幂等、拒绝、`code:200` 未确认、写后鉴权/HTTP 失败、畸形目录与创建者不符、身份/会话不匹配、写前/写中/回读/延迟取消、账号替换、非法 kind/ID、19 位 ID 与分页、并发共享、加密 weapi 封装和 pending 清理。
- 完整 `npm run check`：1156/1156，0 failed/skipped/cancelled，`typecheck` 通过。
- 完整 `npm run test:native`：退出 0；仅既有 Sendable/weak 测试警告。
- Xcode 26.3 工具链下 `swiftc -parse ios/NexusMusicUITests/SourceSettingsTests.swift`、`node --check scripts/test-ui.mjs`、`git diff --check` 通过。
- IPA strict review：61 Evidence / 26 Work Items / 131 timeline / 52 Findings / 52 Paths，0 错误、0 警告。

### 正式 Release UI

最终证据为 `build/SourceUITests-1794986259141.xcresult`：

- `testNeteasePlaylistDeleteFixture()`：Release 1 passed / 0 failed / 0 skipped，48.533 秒。
- iPhone 15 Pro Max 模拟器、iOS 26.3.1、x86_64。
- `sourceUnchanged=true`、`exitCode=0`。
- 源码 digest `c218e28347d42e144f2b56a12f4cedd6b643cf85439049e5ca3b4753b34c3d4e`。
- 安装 bundle digest `42740e6d349cbd4a275245eee1d4b44aff07c8f1ce8b9e1ad18499e86f5dc2b3`。
- result `Info.plist` SHA-256 `320307bb9208bb47b173b137ea26e27396abf8c6cfc2f02759a4a3023e71df26`。
- 运行目录 `build/ui-netease-playlist-delete-20261118-r4/`。

控制历史：

| 阶段 | reads | writes | invalid | present |
| --- | ---: | ---: | ---: | ---: |
| 初始读取 | 1 | 0 | 0 | 1 |
| 确认取消 | 1 | 0 | 0 | 1 |
| 删除拒绝 | 2 | 1 | 0 | 1 |
| 恢复后重试成功 | 4 | 2 | 0 | 0 |
| 重新读取 | 1 | 0 | 0 | 1 |
| 未确认（保留目标） | 4 | 1 | 0 | 1 |

删除拒绝只增加一次写前读取和一次写入；成功重试在写后再读两次确认目标缺席。未确认场景保留目标并提示不要重复删除，证明 `code:200` 不会被当作成功。

### 截图

5 张 1290×2796 PNG 已导出到 `build/ui-netease-playlist-delete-screens-20261118-r4/` 并逐张亲看，索引 SHA-256 为 `1f849e8ae3040b276fab95839da8e7b698d9b766c563d1e410d5d4692df7fd73`：

| 状态 | 文件 | SHA-256 |
| --- | --- | --- |
| 未确认 | `001-An-unconfirmed-NetEase-playlist-deletion-keeps-the-row-and-warns-against-repeati.png` | `4856069cd9d2a1afaef6f434f2c3777a40a7c467561029cc347474ed024ec066` |
| 回读确认成功 | `002-NetEase-playlist-deletion-is-confirmed-only-after-the-catalog-reread.png` | `de1427673e884fd98ee95a376a2c3003c2999c30f2da29b9665cd8ca743a6f34` |
| 写入拒绝 | `003-A-rejected-NetEase-playlist-deletion-keeps-the-row-and-offers-a-retry.png` | `63c69047194d41e44a34997e8c7749e2e6c22ccb017de7f0e0a3083735831928` |
| 删除确认 | `004-Deleting-a-NetEase-playlist-requires-a-destructive-confirmation.png` | `d7d955c1ed5d65d9e7e5f54f52a20f126f0934720a62cfb7fd87ad00e6173a06` |
| 目标列表与重命名说明 | `005-Created-NetEase-playlist-row-exposes-delete-while-the-favorite-row-does-not.png` | `f27419605103d090aee4d77fb7a9717fb80bec53a406684de70be85b4e0ccf22` |

截图中创建歌单有独立“删除”按钮，收藏歌单没有；确认弹窗、拒绝、成功和未确认状态均完整可见，无横向裁切、重叠控件或假入口。

## 证据历史

- r1 `build/SourceUITests-1794985224159.xcresult`：首次运行失败。测试把合成歌单查询写成 `900…`，夹具实际为 `910…`；失败附件与原件保留，未改写为通过。
- r2 `build/SourceUITests-1794985475538.xcresult`：1/0/0，49.4 秒；6 张截图，但其中两张为同一加载状态的重复附件，且控制状态未保留完整历史，故由 r3 取代。r2 是已通过运行，不记为失败。
- r3 `build/SourceUITests-1794985695909.xcresult`：1/0/0、49.401 秒；5 张截图，完整控制历史，`sourceUnchanged=true`。复核发现共用说明文案把网易云专属的写操作描述成所有平台通用，故仅修正文案后以同源 r4 重采；r3 是已通过运行，不记为失败。
- r4 `build/SourceUITests-1794986259141.xcresult`：最终证据；1/0/0、48.533 秒，5 张截图，完整控制历史，`sourceUnchanged=true`。相对 r3 仅改变平台说明文案，删除协议、状态机和断言未放宽。

## 边界

真实网易云账号、真实服务、跨设备可见性、平台歌单重命名、QQ/酷狗等价写操作、实体机、签名和 iOS27 云端终态仍开放。合成夹具、本地回读和模拟器截图不替代这些验收。J10 保持 B，整体目标保持 active。
