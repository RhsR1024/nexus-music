# 网易云音乐平台歌单删歌纵向切片

本批把既有 `NeteasePlaylistTracksClient` 的 `del` 状态机接入正式歌曲操作 UI：网易云在线歌曲在恰好一个网易云账号登录时，新增“从网易云歌单移除”。流程仍只列当前账号创建的歌单，写入前后核对歌单创建者，先读成员关系，目标存在才单次写入，随后最多两次回读确认缺席。平台歌单与音枢本地歌单、唯一权威队列和下载边界保持分离。

## 协议与许可

复用固定 MIT [Sollin-Music-Desktop](https://github.com/Ryderwe/Sollin-Music-Desktop) `c9d446f6ad3b7ea1aff64bd5ce290b6e7f9712a8` 的 `src/services/neteaseAuth.ts` `updatePlaylistTracks` 协议事实：`/api/playlist/manipulate/tracks` 的 `op` 支持 `add`/`del`，请求参数为 `pid`、JSON 字符串 `trackIds` 和 `imme:"true"`。参考实现只读取响应 `code`，没有创建者绑定、先读、幂等、写后回读或取消状态机。

音枢继续只采用端点、操作名和字段事实，自行实现：

- 当前账号、会话版本、`userId`、`netease:` 用户名和 Cookie 的严格绑定；
- 写前和每次回读都核对 `creator.userId`；
- 已存在 add / 不存在 del 的零写幂等；
- 一次写入、最多两次回读、`code:200` 不单独视为成功；
- 拒绝、未确认、未知、登录失效、账号变化、取消和不支持分别隔离。

本批没有新增 Sollin 采集、运行时观察或私有服务探测。`node scripts/sollin-reverse-gate.mjs ipa --review` 复核既有离线证据为 60 Evidence / 25 Work Items / 130 timeline / 51 Findings / 51 Paths，0 错误、0 警告。该复核不等于真实网易云账号或跨设备验收。

## 实现

- 将 `PlatformPlaylistAdd` 重构为 `PlatformPlaylistUpdate`，以 `operation: "add" | "remove"` 复用同一账号歌单目录、加载、空态、读取失败/重试、取消和主题布局。
- 歌曲操作 Sheet 保留“添加到网易云歌单”，新增“从网易云歌单移除”；两者只在当前唯一网易云账号下显示，不自动猜多账号归属。
- 移除成功回到父 Sheet 显示“已从「…」移除”；目标不存在时显示“这首歌不在「…」中”，且不增加写入。拒绝时显示“网易云音乐拒绝从歌单移除，请检查账号权限”。
- Provider 原有 `del` 状态机不变；专项测试补上重复成员被移除和拒绝移除，防止只覆盖加歌路径。
- 合成夹具新增 `remove-success`、`remove-error` 和 `present=1` 播种；每次控制请求把当时的 profile/list/detail/write/invalid/membership/mode 快照写入 `ui-server-counts.json`，保留完整检查点。

## 验证

### 单元与静态检查

- 专项 `tests/netease-playlist-tracks.test.ts`：16/16，覆盖加歌、删歌、重复成员、零写幂等、拒绝、未确认、写后读失败、身份不匹配、取消、账号替换、非法输入和凭据不外泄。
- 完整 `npm run check`：1139/1139，0 failed/skipped/cancelled，`typecheck` 通过。
- 完整 `npm run test:native`：退出 0；仅出现既有 Sendable/weak 测试警告。
- `node --check scripts/test-ui.mjs`、Xcode 26.3 工具链下 `swiftc -parse ios/NexusMusicUITests/SourceSettingsTests.swift`、`git diff --check` 通过。
- IPA 严格复核 PASS：60 Evidence / 25 Work Items / 130 timeline / 51 Findings / 51 Paths，0 错误、0 警告；无新增 Sollin 证据。

### 正式 Release UI

最终证据为 `build/SourceUITests-1794984241898.xcresult`：

- `testNeteasePlaylistTrackFixture`：Release 1 passed / 0 failed / 0 skipped。
- XCTest 耗时 69.640924 秒；iPhone 15 Pro Max 模拟器、iOS 26.3.1、x86_64。
- `sourceUnchanged=true`、`exitCode=0`；源码 digest `9a061f67b804bd5ecacd4946964434fa29220d1c41fff7870b21ba98ebb90012`，安装 bundle digest `17c14cb033b96a9d91ebd74de07d290de27b541a0164a2fcbebd8b2e5511e675`。
- result `Info.plist` SHA-256 `be84394df00adbe995b55ef760ac1b4d158bbe4544416b8cd1626ea00303f2c0`。
- 运行目录 `build/ui-netease-playlist-tracks-20261118-r9/`：manifest `5993d74b85a7904f5f030ca2d11fee57565b55bee2aba95f2a3fc8463c12a993`、summary `33b25f78698988934c27eddc56b80f9c222e75025c4202f15bb0282063f500b0`、server counts `bfb8ef0267efc734a68f8c0c3c32fbe2ef233f271f644bdc435bf57da2ad27c8`、catalog log `95a1f54daa62048e17ec5a297936fe93ff0960b15aa48f7d43805b09833e4e4b`。

控制历史中的关键检查点：

| 阶段 | profile | list | detail | writes | invalid | trackPresent |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| 首次加歌确认 | 1 | 1 | 2 | 1 | 0 | true |
| 重复加歌 | 2 | 2 | 3 | 1 | 0 | true |
| 加歌拒绝后重试 | 1 | 1 | 3 | 2 | 0 | true |
| 首次删歌确认 | 2 | 2 | 5 | 3 | 0 | false |
| 重复删歌 | 3 | 3 | 6 | 3 | 0 | false |
| 删歌拒绝后重试 | 1 | 1 | 3 | 2 | 0 | false |

首次删歌的两次额外 detail 读取来自删除前的成员读取与删除后的缺席确认；重复删歌只增加一次成员读取，不增加写入。拒绝后重试仍是一拒一成的两次写入，最终由回读确认缺席。

### 截图

11 张 1290×2796 PNG 已导出到 `build/ui-netease-playlist-tracks-screens-20261118-r9/` 并亲看，索引 SHA-256 为 `9c82fd7c90a51251fa0af5bb97cdeb9804fdb0797e0ac641f0c141f1a223288f`：

| 状态 | 文件 | SHA-256 |
| --- | --- | --- |
| 删歌拒绝后重试 | `001-Retry-after-a-rejected-NetEase-playlist-remove-restores-the-intended-absence.png` | `979a5ecd861a92d7f8a83c9a91f9e71c8312d39983d3e29b26ded2761d225a63` |
| 删歌拒绝 | `002-A-rejected-NetEase-playlist-remove-remains-an-explicit-error.png` | `f89c6120e9d1bbde9747480b4dd8f6389c2287646e46e142e8e77e15263dcd9c` |
| 重复删歌幂等 | `003-Repeating-the-NetEase-playlist-remove-stays-idempotent.png` | `2736fd8b87bc0cef6363e3e030cebeb0044fa56f4ce76ca98d771e8c81839cbf` |
| 删歌回读确认 | `004-NetEase-playlist-remove-is-confirmed-by-reading-the-track-membership-back.png` | `1153288c3d401316217738bd02e084311ad7f307fe10787dac0cb471d3327f2d` |
| 删歌入口 | `005-NetEase-online-track-exposes-a-separate-platform-playlist-remove-action.png` | `68f968506dccdd2ec955116457dd0d8d36eb50558ca30046fc880b4d58bd16a9` |
| 加歌拒绝后重试 | `006-Retry-after-a-rejected-NetEase-playlist-write-restores-the-membership.png` | `fb073bc54dfa9fb2399597a4daced1ecba23e03221db24adb74b1f68f0aa2a62` |
| 加歌拒绝 | `007-A-rejected-NetEase-playlist-write-remains-an-explicit-error.png` | `7f371e5c066569f5e21197669d557ccc2c84f1dfd009c3b6e06d0bc68e51780a` |
| 重复加歌幂等 | `008-Repeating-the-NetEase-playlist-add-stays-idempotent.png` | `15a3f8f0de9fbe82f90b1381e3416f1b8783f374500a436b2f785f2a57a25f6b` |
| 加歌回读确认 | `009-NetEase-playlist-add-is-confirmed-by-reading-the-track-membership-back.png` | `fb073bc54dfa9fb2399597a4daced1ecba23e03221db24adb74b1f68f0aa2a62` |
| 目标歌单列表 | `010-NetEase-platform-playlist-targets-are-loaded-from-the-current-account.png` | `dec585a27540d2153849e53f7e5a52d9957c30a34b6aaae64af6dfb0814d54ce` |
| 加歌入口 | `011-NetEase-online-track-exposes-a-separate-platform-playlist-action.png` | `41ddec333723c7914d164c6422360eca071624cf006ba67eb105d8e638d74c73` |

`006` 与 `009` 字节相同，是同一加歌重试/确认状态的重复断言附件；不作为两个独立视觉状态。其余关键状态均完整可见，无横向裁切、空窗或假入口。

## 证据历史

- `1794984241898` 为本批最终正式证据。
- `1794983764153` 已 1/0/0 通过，但随后为保留夹具检查点加入只影响测试服务器的快照记录，故由 r9 取代；不是产品失败，原件保留。
- 加歌批次的 `1794981898872`、`1794981969097`、`1794982065423`、`1794982288054`、`1794982460446` 失败原件及 r6/r7 历史继续保留。

## 边界

- 只验证合成网易云账号、本机 HTTP 夹具和正式 App 状态机；真实网易云账号、真实删歌、服务限流、弱网和跨设备可见性未验收。
- 未新增平台歌单重命名/删除、QQ/酷狗平台歌单写操作、酷狗收藏写入或真实 FM。
- 平台写操作仍与音枢本地歌单、唯一权威队列、下载和备份分域；不自动同步。
- J10 保持 B，整体目标保持 active；不在本回执关闭全部平台账号能力或项目。
