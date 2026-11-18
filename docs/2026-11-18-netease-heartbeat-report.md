# 网易云心动模式纵切片

固定 Sollin IPA 的离线证据 `E-060` 确认网易云专属“心动模式”链路：账号喜欢歌单与 likelist 回退、当前歌曲或喜欢歌曲种子、`/weapi/playmode/intelligence/list`、`type=fromPlayOne`、`count=300`、500 首详情分批，以及种子优先且去重的权威队列。证据链为 `E-060 → F-051 → P-051 / WI-025`。本批独立实现账号读取与现有播放器接线，不移植目标客户端，不执行目标 App，不使用真实账号或私人服务。

`ipa --review` 为 60 Evidence / 25 Work Items / 130 timeline / 51 Findings / 51 Paths，0 errors / 0 warnings。固定 IPA SHA-256 仍为 `c2ee2deba236ef1b9e097e1d8cdc0b816137aa57cf85d4c8e2811dae9924bc07`。

## 行为

| 场景 | 现在的行为 |
| --- | --- |
| 平台入口 | 仅网易云账号显示“心动模式”；QQ、酷狗没有等价静态证据，不显示或猜测接口 |
| 账号绑定 | 先核对当前账号对象、修订、`accountId`、`userId`、`netease:` 用户名、`MUSIC_U` 和 weapi 会话；不符时要求重新登录 |
| 喜欢歌单 | 读取 `/weapi/user/playlist`，只接受 `specialType == 10` 且 creator user ID 等于当前账号的网易云歌单 |
| 喜欢顺序 | 优先 `/weapi/v3/playlist/detail` 的 `trackIds`；不可用时回退 `/weapi/song/like/get`，喜欢详情失败不能伪装为空成功 |
| 种子 | 当前曲属于喜欢集合时使用当前曲；否则从喜欢歌曲中选择种子；空喜欢或详情不可用返回明确失败 |
| 推荐请求 | `/weapi/playmode/intelligence/list` 固定 `type:'fromPlayOne'`、`count:300`，并发送种子、喜欢歌单和 `startMusicId` |
| 推荐解析 | 只接受 `data.list`；`songInfo` 优先于 `song`；推荐 ID 去重并剔除种子，空成功列表返回明确错误 |
| 详情分批 | 每批 500 首；推荐详情中单个批次失败只省略该批，其他成功批次保留；登录失效仍终止 |
| 权威队列 | 通过现有 `services.playTracks` 从索引 0 建立 `[种子, ...推荐]`，整体替换旧队列，不建立第二套队列 |
| 失败状态 | 歌单缺失、喜欢为空、种子不可用、推荐为空和服务失败分别显示；登录失效提供“去登录”，其他失败提供“重试” |
| 取消/替换 | 新操作、组件卸载、账号删除/替换或 `clear` 后，迟到响应不能发布；不泄露 Cookie、令牌或响应正文 |
| 关闭/恢复原队列 | 固定证据没有建立该行为，因此本批不增加假关闭按钮或自动恢复旧队列 |

## Provider 与测试

- `src/providers/accountHeartbeat.ts`：账号校验、喜歌单查找、likelist 回退、种子选择、推荐请求、500 首详情分批、去重与稳定错误。
- `src/app/services.ts`：创建并清理账号级 heartbeat 操作，暴露 `accountHeartbeat`。
- `src/ui/AccountRecommendations.tsx`：网易云专属入口、加载态、成功摘要、失败/登录/重试和现有权威队列接线。
- `tests/account-heartbeat.test.ts`：8 项测试覆盖当前曲种子、likelist 随机种子、空/缺歌单、畸形响应、鉴权、取消、账号替换、批次部分失败与种子优先去重。
- `tests/e2e/entry.tsx` / `scripts/test-ui.mjs`：合成网易云账号和本机 HTTP 夹具；产品账号存储、Keychain、Provider、队列与主题组件仍走正式实现。

UI 专项覆盖当前曲成功、喜欢曲种子、推荐队列替换、歌单缺失、喜欢为空、推荐为空、服务失败与重试、登录失效与去登录、账号删除后入口消失。删除前先重启 App 隔离嵌套播放器 Modal，并以真实 App 重启复用已保存的网易云会话。

合成歌曲没有真实媒体地址，播放器会按既有解析失败逻辑继续尝试后续条目；本批 UI 断言因此验证权威队列顺序、替换、成功/失败状态与账号入口，不宣称原生实音播放通过。

## 验证结果

- 心跳 Provider：8/8。
- `npm run check`：1123/1123，0 failed/cancelled/skipped。
- 提交前最终复跑日志 `build/logs/check-netease-heartbeat-final-20261118.log` SHA-256 `018ee138d1fd802a60c4ceb3b11ad29ec305f15c8b68b1cf4f273bb9527521a2`。
- `npm run typecheck`、完整 `npm run test:native`、`node --check scripts/test-ui.mjs`、`git diff --check` 均通过。
- 正式 Release `build/SourceUITests-1794979905602.xcresult`：1 passed / 0 failed / 0 skipped，`testAccountHeartbeat()` 172.222 秒，iPhone 15 Pro Max / iOS 26.3.1 / x86_64，`sourceUnchanged=true`。
- source digest `d2aea0592f4acb132117f4258c8ed8581dd7689d5baa4b94a11f6a9ea20af8ce`；安装 bundle `9a994a7ef59dd49b36c8f5bca7e79418598fd0a4c40fcfc3a03dd37d538faf97`。
- run manifest SHA-256 `5a53d787a96d12b881bb060f83e11a93bfd9968097cf198561122afb4da3d858`；ui-summary SHA-256 `470e51485649c5328650de82d5e8d61508dff2338878364c62a1968fe391b548`；ui-server-counts SHA-256 `f2a783c9c843f2e79bc5b2d9c5fd0484e9cad800f48e3b2c56a9f5abefe1ce36`；ui-catalog SHA-256 `6e439490e3586636d709a88be60c85453f63f61711cb186cdde2fca93036bf6e`。
- 最终 tee 日志 `build/logs/ui-netease-heartbeat-20261118-r2.log` SHA-256 `00cd128df5fcff8f2999d0e07272a5bdbd89d90f0b9de9bedd62bcf9ab1cd2d1`。
- 心跳夹具计数：`requests=20`、`playlistRequests=4`、`likeRequests=1`、`detailRequests=5`、`intelligenceRequests=3`、`authFailures=0`。
- IPA strict review 日志 SHA-256 `9d891e71a19aac403226641f52452a7ef791b32350926d77b92b9dd146f070cf`。

七张 1290×2796 截图已来源核验并亲看：

| 内容 | SHA-256 |
| --- | --- |
| 当前曲成功与 3 首摘要 | `8190668ac96dfc8ceb1ff9af38f528d7cd42e3da1c35a44bec5f794ae9fabecc` |
| 权威队列替换为 3 首 | `97dbc3394c7dea7aed0b67f9a630fde9552738d201178fb01569879558745d79` |
| 喜欢曲种子成功与 4 首摘要 | `ed923f0fe0f81c88d7208b732f21817994d06ca763c7593eb9b0d9ef627ed36a` |
| 喜欢曲种子完整 4 首队列 | `e566cf2736f906b4b6baaf2a8c062f24b9ec3e5dff00be4de861248bd72b9a7a` |
| 喜欢歌单缺失 | `332d75db8659af203e0f02314dfcd16ea0fc2b40a4d8851c7345d67c4c69139a` |
| 服务失败与重试 | `5e0d44db3116005ec64a8ab626a652f5b9768e6c5b53d769116109f0825b37e6` |
| 登录失效与去登录 | `d2f204925508306e012fbbf9e4dd465504944200549eceba52c9d7b0ee46e9a9` |

七张 PNG 已复制到 `build/logs/netease-heartbeat-20261118-r2/`，附件清单为同目录 `screenshot-manifest.json`，逐文件哈希为 `screenshots.sha256`。

复现：

```bash
source /Users/ningli/WorkSpace/Tools/env.sh
node scripts/test-ui.mjs NexusMusicUITests/SourceSettingsTests/testAccountHeartbeat
```

## 保留记录

前五次失败或替代 `.xcresult` 均保留：

- `build/SourceUITests-1794977714027.xcresult`
- `build/SourceUITests-1794977935211.xcresult`
- `build/SourceUITests-1794978238615.xcresult`
- `build/SourceUITests-1794978590599.xcresult`
- `build/SourceUITests-1794978836163.xcresult`

r1 `build/SourceUITests-1794979165515.xcresult` 已经通过（1/0/0、173.219 秒、sourceUnchanged），随后仅因 `scripts/test-ui.mjs` 增加心跳测试的非在线夹具隔离行而产生源码变化；因此保留 r1 原件，并以最终脚本对应的 r2 `1794979905602` 作为本回执验收证据。r1 不是失败运行。

最后一次失败已确认不是产品队列错误：`liked_single` 的种子 `9901` 不属于推荐列表，推荐 `[9902,9904,9905,9904]` 去重后为 `[9902,9904,9905]`，正确队列是 4 首而不是 3 首。本批只修正测试预期，并增加第二个成功场景后的 App 重启以隔离嵌套 Modal；没有改写或删除失败证据。

## 未完成

本批证明的是合成网易云账号下的 Provider、正式 UI 和权威队列接线。真实网易云账号、真实心动推荐服务、关闭/恢复原队列语义、QQ/酷狗等价能力、完整音频供源、实体机、签名、iOS27 云端终态和真实 FM 仍未验收。J08 保持 C，整体目标保持 active。
