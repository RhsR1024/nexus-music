# 账号推荐歌单纵切片

固定 Sollin IPA 的离线证据 `E-059` 只确认两个账号边界的静态标记：网易云命名 `/weapi/v1/discovery/recommend/resource`，QQ 命名 `music.playlist.PlaylistSquare` / `GetRecommendFeed`，并有“推荐歌单”“暂无推荐歌单”界面文案。本批据此实现独立的账号推荐歌单读取，不把公开歌单广场或每日推荐冒充账号推荐，也不推断目标响应字段、排序、分页或视觉等价。

证据链为 `E-059 → F-050 → P-050 / WI-024`。`ipa --review` 复核为 59 Evidence / 24 Work Items / 129 timeline / 50 Findings / 50 Paths，0 errors / 0 warnings；没有执行目标 App、发送真实账号 Cookie、访问私人服务或复用目标客户端逻辑。

## 行为

| 场景 | 现在的行为 |
| --- | --- |
| 网易云账号 | 使用当前账号的已保存 weapi 会话读取 `/weapi/v1/discovery/recommend/resource`，Cookie 为空、身份不符或 401/403 明确要求重新登录 |
| QQ 音乐账号 | 校验 `login_type`、QQ 号、`qqmusic_key` 和账号修订后，使用 `music.playlist.PlaylistSquare` / `GetRecommendFeed`，固定有界 `From:0` / `Size:30` |
| 酷狗账号 | 不显示推荐歌单区；现有固定证据没有等价账号推荐歌单标记，不猜测接口或复用酷狗日推 |
| 结果解析 | 只保留有界数字 ID、名称、公开封面、描述、作者和计数；按平台与 ID 去重、保留平台顺序，最多 30 项 |
| 空结果 | 显示“暂无推荐歌单”，不清空为错误，也不改用公开或本地内容替代 |
| 失败/鉴权 | 空结果、网络失败和登录失效分开；失败提供重试，登录失效提供去登录，不泄露 Cookie、令牌或传输错误正文 |
| 账号变化/取消 | 请求绑定账号修订；替换、删除、取消或 `clear` 后迟到结果不能发布或写缓存 |
| 缓存 | 每个账号修订独立缓存五分钟；显式刷新绕过缓存；账号订阅变化清理日推、推荐歌单和 FM 的相关状态 |
| 打开歌单 | 卡片只读打开现有 `Discovery` 公开歌单详情边界，返回按钮为“返回平台推荐”；不自动导入或写音乐库 |

UI 复用现有 `Cover`、主题调色板和 `Discovery`，没有新增账号体系、第二套详情读取、假入口或截图专用页面。切换账号或推荐结果清空时，旧详情会关闭。

## 夹具与验证

正式 Release 用例 `testAccountRecommendedPlaylists` 仅在测试入口启用 `NEXUS_UI_ACCOUNT_PLAYLISTS_FIXTURE=1`。启动清理已有平台账号，保存合成网易云账号 `netease:9000000000000000007` 与真实 `MusicAccounts` / Keychain 会话；产品 Provider、账号存储、公开详情和主题组件仍使用正式实现，仅 HTTP 传输进入本机夹具。

本机夹具覆盖：

- 推荐接口要求 `MUSIC_U=synthetic-account-playlists`、POST 和有效 weapi 加密表单，否则返回 401 并累计鉴权失败；
- 正常返回 4 张合成歌单，公开详情只接受对应 ID，并返回三首可展示曲目；
- `normal` / `empty` / `error` 控制状态，用于刷新、空态、失败和重试；
- 推荐请求、公开详情请求和鉴权失败分别计数。

用例断言账号文案绑定当前网易云账号、卡片标题与作者、点击进入公开详情、空态清除旧卡、失败出现重试、重试恢复卡片；最终为 `recommendRequests=4`、`detailRequests=1`、`authFailures=0`。

## 验证结果

- 推荐歌单专项：7/7。
- `npm run check`：1115/1115，0 failed/cancelled/skipped；日志 SHA-256 `2ea52f8bb9c5296685f3e5d5a82bfbffe1238bf7343835fc524da4272c9f1f01`。
- `node --check scripts/test-ui.mjs`、项目 Xcode 26.3 Swift parse、`git diff --check` 均通过。
- 正式 Release `build/SourceUITests-1794975071176.xcresult`：1 passed / 0 failed / 0 skipped，测试耗时 30.431 秒，iPhone 15 Pro Max / iOS 26.3.1 / x86_64，`sourceUnchanged=true`。
- source digest `f07908bc448ca8069ffcf8d981b847a1845ccd4fb7eae4885a6594624776e6d0`；安装 bundle `a79447b017c251cf3c327d6cbf39aaf837e23e40cce248196f17d56165ad8d2e`；run manifest SHA-256 `abdbc35760dbaf8d44214c4d507ee19e5318df8fa8024305175e9c6a1b2ab433`；ui-summary SHA-256 `6c79831cad51037becc0acc74068c654c220d6b186695fb88dfd56a12f75db78`；ui-server-counts SHA-256 `3a2914a4af5dfe8d6af7f360b2ef88d47598330c516794b462f5928b4804eecc`；ui-catalog SHA-256 `5341255ee515cc45bad75c75874d7cc86ca8cc2ffbd35274f1731277702ba5e1`。

五张 1290×2796 截图已来源核验并亲看：

| 内容 | SHA-256 |
| --- | --- |
| 账号推荐歌单卡片 | `d0128eefd96aed7eb6f7876c3932d3c834898d3c2d64cf463973edace658ecd6` |
| 公开歌单详情 | `1dc32ef50ac59997077bec1c79ef3d18d4a47fa3f0ccdf6ef8aa2548e81dfbd3` |
| 空态 | `c33e748994796292cf17ff152cacba38aec18193e4a4cf1af1660d62825e579f` |
| 失败与重试 | `27187d8e481ae59c94ef662601c82b826cd7ee16142b253c06bf10ed911b5398` |
| 重试恢复 | `487784d706612cef9ca4d37bed63614c9c92ccfcc33b6e5958024053af6b7226` |

复现：

```bash
source /Users/ningli/WorkSpace/Tools/env.sh
NEXUS_UI_RUN_DIR=build/logs/account-recommended-playlists-20261118-r2 \
  node scripts/test-ui.mjs NexusMusicUITests/SourceSettingsTests/testAccountRecommendedPlaylists
```

## 保留记录

首轮 `SourceUITests-1794974820844.xcresult` 为 1/0/0，产品断言均通过，但“账号推荐歌单卡片”附件只截到折叠线附近，未实际展示卡片。失败/替代证据未删除；只把真实卡片的可视滚动加入截图步骤后重跑 r2，r2 为最终视觉证据。

## 未完成

本批只验证合成网易云账号推荐歌单。QQ Provider 有独立传输/鉴权/解析单测，但没有 QQ 账号 UI 夹具或真实响应；真实网易云/QQ 账号、目标 App 的字段映射、排序、分页和服务可用性均未证明。心动模式、推荐歌单内批量动作、真实私人 FM 供曲、实体机、签名与 iOS27 云端终态仍开放。J08 保持 C，整体目标保持 active。
