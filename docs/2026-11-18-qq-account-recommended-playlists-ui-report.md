# QQ 账号推荐歌单 UI 纵切片

本批在既有账号推荐歌单 Product/Provider 基础上，仅补合成 QQ 账号的正式 UI 纵向验收，不改变推荐协议、账号能力或详情边界。固定证据仍为 `E-059 → F-050 → P-050 / WI-024`：QQ 账号使用 `music.playlist.PlaylistSquare / GetRecommendFeed`，卡片只读打开现有公开歌单详情。没有访问真实 QQ 账号、私人服务或目标 App，也没有把合成夹具写成真实平台验收。

## 覆盖

| 场景 | 行为 |
| --- | --- |
| 账号绑定 | 启动仅清理已有音乐平台账号，保存合成 QQ 账号 `qq:2:9000000000000000010`，Keychain 会话含 `qqmusic_key=synthetic-qq-account-playlists` |
| 推荐请求 | 校验 `comm.uin`、Cookie、`From:0` 与 `Size:30`；不符合即计鉴权失败并返回 401 |
| 推荐卡片 | 返回 4 张合成歌单；UI 断言当前账号文案、标题、作者，并滚动到真实卡片后再截图 |
| 公开详情 | 卡片进入现有公开歌单详情，断言标题和曲目，并验证签名 `uniform_get_Dissinfo` 请求 |
| 空态 | 返回显式空 `FeedRsp.List` 后显示“暂无推荐歌单”，旧卡片消失 |
| 失败/重试 | 返回服务错误后显示“推荐歌单暂时不可用，请稍后重试”；恢复后重试重新发布卡片 |
| 雷达隔离 | 同一 QQ 夹具显式返回空 `GetRadarSong`，避免 QQ 雷达错误态污染本批截图 |
| 队列隔离 | 测试入口启动时清空权威播放队列，移除上一场景残留的 mini 播放器 |

UI 仍走正式 `MusicAccounts`、Keychain、`AccountRecommendedPlaylists`、`DiscoveryProvider`、`Cover` 与主题组件；只有 HTTP 传输进入本机夹具。未新增假入口、第二套详情或本地写入。

## 夹具

- `NEXUS_UI_ACCOUNT_PLAYLISTS_FIXTURE=qq`
- 推荐控制：`/account-playlists-fixture-control` 的 `reset`、`mode=normal|empty|error`
- 计数：`recommendRequests`、`qqDetailRequests`、`detailRequests`、`authFailures`
- 详情签名：仅接受 `zzc` 前缀的签名和 `9101...9104` 四个合成 ID

本批同时把 `testQQAccountRecommendedPlaylists` 纳入测试脚本的非在线夹具隔离列表，并为网易云与 QQ 两种夹具共同清空播放队列；该基础设施变化不改变产品行为。

## 验证

- 最终 Release `build/SourceUITests-1794980861756.xcresult`：1 passed / 0 failed / 0 skipped，`testQQAccountRecommendedPlaylists()` 29.948 秒，iPhone 15 Pro Max / iOS 26.3.1 / x86_64，`sourceUnchanged=true`。
- source digest `7c786e86f8109ffbfb198c9ab734469f59ff591a8fcea9708e1bb679e023ed05`；安装 bundle `0546200f4e9e00b99f805fc2957316a599136405ffc711468ddec12b52b0b050`；resultInfo SHA-256 `1403bb9a4a1bf83e45705626495cede31cbe31fceae58f5d372476a7f0ba9888`。
- 夹具计数：`recommendRequests=4`、`qqDetailRequests=1`、`detailRequests=0`、`authFailures=0`。
- `npm run check`：1123/1123，0 failed/cancelled/skipped；日志 SHA-256 `9b68f5585b0932271d63057292109d03c1fe0dca002c015509325405be8478b1`。
- IPA strict review：60 Evidence / 25 Work Items / 130 timeline / 51 Findings / 51 Paths，0 errors / 0 warnings；日志 SHA-256 `5450b3837d494d834eb1f32ef4207f316abafec8033039a085af94eb5cb1d7c8`。
- `node --check scripts/test-ui.mjs`、Swift parse、`git diff --check` 通过。
- 网易云同用例回归 `build/SourceUITests-1794981130985.xcresult`：1/0/0，`testAccountRecommendedPlaylists()` 40.477 秒，`sourceUnchanged=true`；推荐 4 / 公开详情 1 / 鉴权失败 0，同 source digest 与安装 bundle，证明共享清队列接入未破坏网易云夹具。

运行目录 `build/logs/qq-account-recommended-playlists-20261118-r2/`：

| 文件 | SHA-256 |
| --- | --- |
| `run-manifest.json` | `8425150a0328cf7757341d22e4c8b4f16ed5ac25c6608c20674d90fd3a2595b3` |
| `ui-summary.json` | `461da7cfbf928d252386d0456bfd0e7b1422ee0e96a2e62da57eefdc8bca5353` |
| `ui-server-counts.json` | `7e6ae43c8f433f2765c51b066f3b2ace99aebbea6ef6d799ed99758e2048c1f6` |
| `ui-catalog.log` | `92912a04ccf80d60d7c2b4a35c2d5aa4b476d0e300f732b9ad28a2eaf96d9b9b` |
| `build/logs/ui-qq-account-recommended-playlists-20261118-r2.log` | `8742fd21790d9035707a0ada6b4fe12f0ced176fc0816cb13c486c9c0e7b73ac` |

五张 `1290×2796` 截图已来源核验并亲看：

| 内容 | SHA-256 |
| --- | --- |
| QQ 账号推荐歌单卡片 | `cf700372da0efaa7c7cf01a81459edb0727ba58795ead29b7794ce98dde073a2` |
| 公开歌单详情 | `08bcea2851ae50d566958134e23c2e25d9a271e89094534f3da223a1ca1a5c36` |
| 空态 | `6aae76b4f7ef95b106626a2757027aa0440f8f0082c8a22214913363d7a31868` |
| 失败与重试 | `be53179c7922565fd64463e5fb3c8fdcd3ea23a461316079c1a74894717fefdb` |
| 重试恢复 | `9e613c086937a6f6bda19c4e27ae91b9724b52569f4b6a1a3536055275d475ea` |

复现：

```bash
source /Users/ningli/WorkSpace/Tools/env.sh
NEXUS_UI_RUN_DIR=build/logs/qq-account-recommended-playlists-20261118-r2 \
  node scripts/test-ui.mjs NexusMusicUITests/SourceSettingsTests/testQQAccountRecommendedPlaylists
```

## 保留记录

r1 `build/SourceUITests-1794980571681.xcresult` 已通过（1/0/0、28.938 秒），但截图含残留的 `Synthetic Heartbeat 9902` mini 播放器，QQ 雷达区域也因未显式隔离显示错误态，因此保留原件但不作为最终视觉证据。r2 在夹具启动时清空权威队列，并让 QQ 雷达返回显式空结果，重新取得五张干净截图。

## 未完成

本批只验证合成 QQ 账号下的推荐歌单读取与正式 UI。真实 QQ 账号、真实推荐服务、目标 App 的字段映射/排序/分页、酷狗等价推荐、真实心动服务、真实 FM、实体机、签名与 iOS27 云端终态仍未验收。J08 保持 C，整体目标保持 active。
