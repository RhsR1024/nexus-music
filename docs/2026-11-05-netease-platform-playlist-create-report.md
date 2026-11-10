# 网易云平台歌单创建纵向切片

本批为 J10 增加网易云平台歌单创建：在网易云账号页中，用户可对当前选中的账号输入 1–40 字名称，选择私密（默认）或公开，向网易云创建歌单。平台歌单与音枢本地歌单分域；创建不会自动同步，也不修改现有平台歌单。

## 协议与许可

亲读 MIT [Sollin-Music-Desktop](https://github.com/Ryderwe/Sollin-Music-Desktop) 固定 `c9d446f6ad3b7ea1aff64bd5ce290b6e7f9712a8` 的 `src/services/neteaseAuth.ts`：

- `createPlaylist` 使用 `/api/playlist/create`，参数 `name`、`privacy`（`"0"`/`"10"`）和 `type:"NORMAL"`，仅在 `code:200` 且返回 `playlist` 时读取 `id/name`。
- `updatePlaylistTracks` 使用 `/api/playlist/manipulate/tracks`，本批未接入歌曲写入。

音枢只采用端点、参数和响应字段事实，自写严格账号绑定、单次创建、目录回读、取消和状态语义；没有复制运行时、UI、依赖或私有逻辑。匿名 `POST /weapi/playlist/create` 在 2026-11-05 返回 HTTP 200、`{"code":301,"message":"系统错误"}`，只证明端点存在且需要登录，不是真实创建验收。记录见 `build/netease-playlist-create-anonymous-20261105.json`，SHA-256 `684e596c47369ab81f87542c2fee97ea078533317eff50349f1d652814ad731d`。

## 实现

- 新增 `src/providers/neteasePlaylistCreate.ts` 的 `NeteasePlaylistCreateClient`。创建前严格核对账号平台、会话版本、账号 ID、`userId`、`netease:` 用户名和 Cookie；原始 Cookie/`csrf` 不进入结果、UI、日志或备份。
- 名称只接受 trim 后 1–40 个 Unicode 码点、无控制字符；隐私只接受 `0`（公开）或 `10`（私密）。UI 默认私密，避免一次误触公开歌单。
- 只发送一次 `/weapi/playlist/create`。响应 `code:200` 本身不代表成功；必须再以 `/weapi/user/playlist` 回读，确认同一账号下存在同 ID、同名、创建者等于当前 `userId` 的条目，并在响应提供隐私字段时确认与请求一致。
- 状态包括 `created`、`unconfirmed`、`rejected`、`unsupported`、`unavailable`、`login_required`、`account_changed`、`cancelled`。创建已发出但回读失败、取消或账号变化不能报告成功；结果最多带已返回的 ID，并提示重新读取账号歌单，不自动重试创建。
- 同一账号/名称/隐私并发请求共享一次任务；不同名称不错误共享。分页最多 20 页，遇到畸形响应立即停止，不猜测新歌单位置。
- `AccountPlaylistImport` 在网易云卡增加创建表单，并显示“已创建…并回读确认”。2026-11-10修正：创建后清空旧目录，由显式读取登记可预览条目；原先直接插入创建回读对象会因目录成员校验失败而无法预览。刷新开始也清空旧列表，失败/取消后重试可恢复。见[修正回执](2026-11-10-account-playlist-refresh-report.md)。账号 capability 仍保持 `[]`，没有虚构完整平台写能力。

## 验证

新增 `tests/netease-playlist-create.test.ts` 17 项，覆盖读取回确认、创建成功但目录缺失、标题/创建者/隐私不一致、畸形创建与目录响应、写入拒绝、鉴权拒绝、非法名称/隐私、身份/会话不匹配、取消前不写、创建或回读中取消、账号删除、并发同请求共享、19 位 ID、目录分页及加密请求体不泄露 Cookie。

- 专项：17/17，日志 `build/logs/netease-playlist-create-unit-r2-20261105.log`，SHA-256 `d411baa4d1db1256113889218fc2af81cd14d6c01831ef773a25a38f37c201f0`。
- 完整 `npm run check`：1107/1107，0 failed/skipped/cancelled，日志 `build/logs/check-netease-playlist-create-final-20261105.log`，SHA-256 `145ce899cd47d73f136149a7dd9a90f8c5a65f0a930887eeed05a9109abafa77`。
- `npm run test:native` 退出0，日志 `build/logs/native-netease-playlist-create-20261105.log`，SHA-256 `51bfcdb0fafaf187b1df72755f6af8b1f8c4ba434dc89b16c8b05945fd7c4e0d`（原生代码未变，与既有基线一致）。

正式 Release UI：`testNeteasePlaylistCreateFixture` 使用真实账号存储、Keychain 会话和 provider，仅将网易云 HTTP 传输指向本地合成夹具。

- 结果：`build/SourceUITests-1793887965443.xcresult`，Release 1 passed / 0 failed / 0 skipped，测试 25.446 秒，runner 75.467 秒，`sourceUnchanged=true`。
- 源码 digest：`9f6121060c26489486cb9fad09e7f2d4244ebb21237ebec580e0739ebd64b278`。
- 安装 bundle digest：`2fa291792677532d27d78aff5a2cdae384cebd8007203d793534d21f959dee3a`。
- result Info SHA-256：`11d71b7499a9fe83ef392dffb9ff8e9a87a09b82fc14cb46a09050607b7627a8`。
- 运行清单、summary、计数 SHA-256：`c799d4eda8d3f7c4c74ab3857f9af7dbc9d028795d0fa67a9af145f3d25cf93f`、`d5b6a9503fb15d615a12f9d1ce0f2152bf038adfcf96086d1a1a2d9ead3023e9`、`05d085b183b991624de2d8e7af9031bd842a9a22ec55bcb5b5ecc1027fe757a1`。
- 夹具：`reads=1`、`writes=1`、`created=true`、`invalid=0`；截图 `build/ui-netease-playlist-create-20261105-r3/screenshots/001-NetEase-playlist-creation-is-confirmed-by-reading-the-new-id-back.png`，1290×2796，SHA-256 `e9432aec0b49258de0e52ff2c163d3f397f056437bd052723550ea23ef8f8956`，已亲看名称输入、私密默认、创建结果和完整状态文字。场景与布局见[UI规格](ui-spec/netease-playlist-create-2026-11-05.md)。

较早 `r1` 已通过但截图使用旧说明；`r2` 在隐私回读字段补强后源码发生变化，`sourceUnchanged=false`，不作为最终证据；`r3` 为最终结果。测试只使用合成账号 `netease:9000000000000000004` 和合成服务，不代表真实网易云账号已创建歌单。

## 边界

- 真实网易云账号的创建、隐私、跨设备可见性和删除/重命名未验收；本批只有匿名端点核验和合成账号回读闭环。
- 未实现平台歌曲写入、平台歌单删除、QQ/酷狗平台建单；未把这些能力加入账号 capability。
- 实体机、Apple 签名、iOS27 云端终态仍未完成；本地 Release 证据仅覆盖 iOS 26.3.1 模拟器。
- 本批没有新增 Sollin IPA/APK 采集或 UI 对齐证据，不触发 reverse-skill 采集门禁，也不能据此宣称 Sollin UI 对齐通过。J10 继续保持 B，全部目标保持 active。
