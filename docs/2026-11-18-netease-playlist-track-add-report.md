# 网易云音乐平台歌单加歌纵向切片

本批为 J10 增加网易云平台歌单加歌：网易云在线歌曲的操作 Sheet 在恰好一个网易云账号已登录时显示“添加到网易云歌单”，只列出当前账号创建的歌单，选择后先读取成员关系，未存在才发送一次写入，并通过重新读取歌单确认成员变化。平台歌单与音枢本地歌单、唯一权威队列和下载边界保持分离。

> 同日后续批次已把同一 UI 扩展为加歌/删歌共用组件并开放“从网易云歌单移除”；本回执保留加歌批次的协议、实现和历史证据，最新删歌验收见[删歌回执](2026-11-18-netease-playlist-track-remove-report.md)。

## 协议与许可

亲读 MIT [Sollin-Music-Desktop](https://github.com/Ryderwe/Sollin-Music-Desktop) 固定 `c9d446f6ad3b7ea1aff64bd5ce290b6e7f9712a8` 的 `src/services/neteaseAuth.ts`：

- `updatePlaylistTracks` 使用 `/api/playlist/manipulate/tracks`，参数为 `op`、`pid`、JSON 字符串 `trackIds` 与 `imme:"true"`。
- 该实现只读取响应 `code`，没有写后回读，也没有账号归属、幂等或取消状态机。
- `/api/v6/playlist/detail` 的 `playlist.trackIds`、`trackCount` 与 `creator.userId` 是可读取的公开字段事实。

2026-11-18 的匿名公开详情核验使用 `GET /api/v6/playlist/detail?id=3778678&n=100000&s=8`，返回 `code:200`、`creator.userId:1`、`trackCount:200`、`trackIds:200`；响应保存在 `build/netease-playlist-detail-public-20261118.json`，SHA-256 `b097413e0870c892058da45565e91705063dab7dc415ca4d447c4dae59b7c027`。该探针只证明公开字段可读，不证明当前账号可写或跨设备可见。

音枢只采用端点、参数和响应字段事实，自行实现严格账号/会话绑定、创建者核对、先读后写、单次写入、最多两次回读确认、取消和明确失败状态。没有复制 Sollin 的运行时、UI、依赖或私有逻辑。本批复用固定 IPA 的既有严格复核结果：60 Evidence、25 Work Items、130 timeline、51 Findings、51 Paths，0 错误/0 警告；这不是新的 UI 或真实服务验收。

## 实现

- 新增 `src/providers/neteasePlaylistTracks.ts`。写入前核对 `platform === "wy"`、会话版本/平台/账号 ID、`userId`、`netease:` 用户名和 CSRF/Cookie 是否存在；原始 Cookie、CSRF 和加密表单不进入结果、UI 或日志。
- 歌单只接受 `kind === "created"` 且 ID 为 1–19 位十进制字符串；歌曲 ID 同样按不透明字符串校验。详情必须返回同一歌单 ID，并在写入前后都核对 `creator.userId` 等于当前账号。现有协议证据没有提供“成员 ID 必须唯一”的约束，因此读取只逐个校验 ID，重复成员不阻止幂等判断；这不宣称重复曲序已由真实账号验证。
- 先读取 `/weapi/v6/playlist/detail` 的成员。已存在时 add 返回 `already`，不存在时 del 返回 `absent`，均不写入。
- 需要变更时只发送一次 `/weapi/playlist/manipulate/tracks`。响应 `code:200` 本身不表示成功；随后最多两次重新读取 `/weapi/v6/playlist/detail`，只有成员关系实际变化才返回 `added` 或 `removed`。
- 状态包括 `added`、`already`、`removed`、`absent`、`unconfirmed`、`unknown`、`rejected`、`unsupported`、`unavailable`、`login_required`、`account_changed`、`cancelled`。写后回读失败、取消或账号变化不能报告成功，也不会自动重发写入。
- 相同账号/歌单/歌曲/操作共享一个进行中任务；不同目标不错误共享。Provider 支持 `add`/`del`，但本批产品 UI 只开放加歌，未新增删除入口。
- 新增 `src/ui/PlatformPlaylistAdd.tsx`。复用正式 `MusicAccounts`、`AccountPlaylists`、主题和 Sheet；只显示当前账号创建的列表。多账号时继续要求先在设置中收敛为一个，不自动猜归属。
- `TrackActions` 新增“添加到网易云歌单”，成功和幂等结果在父 Sheet 中显示；`PlatformPlaylistAdd` 自身覆盖加载、空列表、读取失败/重试、写入拒绝、未确认、登录失效、账号变化与取消。列表使用带底部安全留白的 `ScrollView`，不新增假入口或截图专用页面。

## 验证

### 单元与静态检查

- 专项 `tests/netease-playlist-tracks.test.ts`：14/14，覆盖写前/写后读、已存在/不存在幂等、重复成员、创建者不符、写请求体、`code:200` 但未回读、写拒绝、写后读失败、畸形响应、鉴权失败、身份不匹配、取消、账号替换、非法歌单/歌曲与凭据不外泄。
- 完整 `npm run check`：1137/1137，0 failed/skipped/cancelled，`typecheck` 通过。
- 完整 `npm run test:native`：退出 0。仅出现既有 Sendable/weak 测试警告，无新增原生代码或失败。
- `node --check scripts/test-ui.mjs`、Xcode 26.3 工具链下 `swiftc -parse ios/NexusMusicUITests/SourceSettingsTests.swift`、`git diff --check` 均通过。
- `node scripts/sollin-reverse-gate.mjs ipa --review`：PASS；60E/25WI/130 timeline/51F/51P、0 错误/0 警告。

### 正式 Release UI

最终证据为 `build/SourceUITests-1794983029561.xcresult`：

- `testNeteasePlaylistTrackFixture`：Release 1 passed / 0 failed / 0 skipped。
- XCTest 耗时 47.537 秒；iPhone 15 Pro Max 模拟器、iOS 26.3.1、x86_64。
- `sourceUnchanged=true`、`exitCode=0`；源码 digest `e44c0271b5639c365a7333d88ffbe03f76dea30d9b96fbd2e70518bcf85310f4`，安装 bundle digest `a55b1616e435683decf2d4a3e80edaf69590aeccd918820a6d5e3a4e045054fa`。
- result `Info.plist` SHA-256 `26bd6b72ea5861e6fcef67342728347e63ff2082b463b4410464b3236d23acff`。
- 运行目录 `build/ui-netease-playlist-tracks-20261118-r7/`：manifest `c82f901d62d2c0d003cee7bfde83e8ae63210cacdb62b4a945681fe882009770`、summary `cdd6aa3c1bb876ae06ea5f8f88b1e98f07432cdc8c283aca56692d74ede504c1`、server counts `562d6def9c5468f6699aa7df9a8bd62d08a4139f67efab5b7d75205bffcfa71a`、catalog log `45190c4dbdcf7a0a5091e540d372c889b2bf0caffc0c81e262273ac939404c01`。
- 夹具首次确认：`profileReads=1`、`listReads=1`、`detailReads=2`、`writes=1`、`invalid=0`、`trackPresent=1`。
- 重复点击：`profileReads=2`、`listReads=2`、`detailReads=3`、`writes=1`，证明幂等且不重复写入。
- 拒绝后重试：重置计数并以拒绝写进入，再恢复；最终 `profileReads=1`、`writes=2`、`detailReads=3`、`invalid=0`、`trackPresent=1`，证明一次拒绝和一次成功写入后仍以回读确认。

6 张 1290×2796 PNG 已导出到 `build/ui-netease-playlist-tracks-screens-20261118-r7/` 并亲看：

| 状态 | 文件 | SHA-256 |
| --- | --- | --- |
| 重试成功 | `001-Retry-after-a-rejected-NetEase-playlist-write-restores-the-membership.png` | `d0aecbfa685343f2e44c49ec645a619fbb7bf62afdab7b14b79ab271800b3b3d` |
| 写入拒绝 | `002-A-rejected-NetEase-playlist-write-remains-an-explicit-error.png` | `59dbc2218187ce79e204e537a172c09007dc3efa7ba64f89455a04955f0cf201` |
| 幂等重复 | `003-Repeating-the-NetEase-playlist-add-stays-idempotent.png` | `e7a1f5df1a13f0c9c5e99519c018c7324e7a7f1926a3830bbf73311bfada6fbe` |
| 回读确认 | `004-NetEase-playlist-add-is-confirmed-by-reading-the-track-membership-back.png` | `d0aecbfa685343f2e44c49ec645a619fbb7bf62afdab7b14b79ab271800b3b3d` |
| 目标歌单列表 | `005-NetEase-platform-playlist-targets-are-loaded-from-the-current-account.png` | `a5ed7c87da91a961302c1214d649f9d6084f8abb29acef99ca7b0cb0531f5885` |
| 歌曲操作入口 | `006-NetEase-online-track-exposes-a-separate-platform-playlist-action.png` | `8a64d1d5a175ce50a8235cd7448d49966e12c71149d73496a680bea7c03d48ca` |

`001` 与 `004` 内容相同，因为最终滚动位置和父 Sheet 成功状态一致；这是同一视觉证据的两个断言附件，不冒充两个不同画面。导出索引 SHA-256 为 `a679fa0cfe303be9fbee808474964e5043d171ebb3ce622a6245aa9808680704`。状态、pt 量测和验收清单见[UI 规格](ui-spec/netease-playlist-track-add-2026-11-18.md)。

## 证据历史

以下失败或已被取代的运行全部保留，未改写为通过：

- `1794981898872`：Swift 编译失败，局部 `let add` 遮蔽 XCTest `add(shot)`。
- `1794981969097`：同一问题，补丁位置不正确。
- `1794982065423`：真实产品校验暴露出合成夹具缺少 `/api/nuser/account/get` 资料响应。
- `1794982288054`：预期资料读取次数错误；重新打开账号页会再次运行真实资料校验。
- `1794982460446`：功能通过，但截图暴露横向裁切；已由带内边距的滚动布局取代。
- `1794982727314`：r6 已通过（47 秒级）；随后补上详情创建者核对和重复成员回归，源码变化后以 `1794983029561` 为最终证据。r6 不是失败，但其截图和源码不覆盖最终归属校验。

## 边界

- 只验证合成网易云账号、本机 HTTP 夹具和正式 App 状态机；真实网易云账号、真实歌单写入、服务限流、弱网和跨设备可见性未验收。
- UI 只开放加歌；Provider 的 `del` 没有产品入口，不能据此声明平台删歌完成。
- QQ/酷狗平台歌单创建与加歌、酷狗收藏写入、真实心动/FM、实体机、Apple 签名和 iOS27 云端终态仍未完成。
- 账号 capability 不因该入口扩充；登录成功、合成写入或本地回读都不能替代真实平台与跨设备验收。
- J10 保持 B，整体目标保持 active；下一批继续选择具备可靠协议和目标身份的未完成功能，不用本回执关闭全部计划。
