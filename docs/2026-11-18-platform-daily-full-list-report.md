# 平台每日推荐与私人雷达完整列表

平台推荐卡片此前只显示前 5 首，虽然“播放全部”能使用整批歌曲，但没有可浏览、可逐首操作的完整列表。本批新增只读完整列表，按平台返回顺序展示全部行；播放、全部加入队列和下一首继续复用音枢唯一权威队列，不向本地音乐库写入平台数据。

## 行为与边界

| 场景 | 现在的行为 |
| --- | --- |
| 折叠区 | 继续显示前 5 首；平台返回超过 5 首时显示“查看全部 N 首” |
| 完整列表 | 标题绑定当前账号和日推类型（网易云日推、酷狗日推、QQ 官方日推或私人雷达），副标题明确按平台返回顺序 |
| 播放全部 | 用完整平台顺序替换权威队列并从第 1 首播放，不创建第二套队列 |
| 全部加入队列 | 按平台顺序一次追加到既有队列，并显示本地操作回执 |
| 逐曲操作 | 每行可播放该曲并把完整平台顺序设为权威队列，也可仅将这一首放到下一首 |
| 账号切换/空结果 | 关闭旧账号的完整列表；刷新为空时也不保留可打开的空壳 |
| 数据归属 | 完整列表只读取本次 `AccountDailyClient` 返回值，不写入收藏、歌单或本地推荐 |

网易云日推、酷狗日推、QQ 官方日推和 QQ 私人雷达共用同一个只读列表组件，但本批不把“全部加入队列”或逐曲下一首写成 Sollin 日推多选行为的等价实现。Sollin 动态证据只支持私人雷达/推荐歌单的批量多选；具体 kind 的多选动作、推荐歌单和心动模式仍按后续批次独立实施与验收。

## 模拟器夹具

正式 UI 用例 `testPlatformDailyFullList` 只在测试入口启用 `NEXUS_UI_ACCOUNT_DAILY_FIXTURE=1`。测试启动时先删除已有的网易云、QQ、酷狗平台账号，避免复用历史夹具账号；随后通过真实 `MusicAccounts`、Keychain 会话和 `AccountDailyClient` 保存合成网易云账号 `netease:9000000000000000005`，仅把 provider 传输改到本机 HTTP 服务。

本地服务返回 30 首 `Synthetic Daily 1..30`。缺少 `MUSIC_U=synthetic-daily` 的请求返回 401 并计入 `authFailures`；控制接口只在该 UI 用例启用。正式产品入口不含账号、Cookie 或控制接口。

测试严格验证：

- 折叠区第 5 行存在，第 6 行不存在；
- 完整列表显示“共 30 首”且绑定 `Synthetic NetEase Daily`；
- 滚动后第 30 行可达，按钮标签准确包含 `Synthetic Daily 30`；
- 运行时 `accountDaily.requests=1`、`authFailures=0`；
- 关闭完整列表后回到平台推荐卡片。

## 验证

- 产品与测试提交：`8858cb0`。
- `npm run check`：1108/1108，0 failed/cancelled/skipped；日志 SHA-256 `852f940e90820d71d4b82d4783a8f142d0d46022b04cef455d24118e0387244b`。
- `node --check scripts/test-ui.mjs`、加载 Xcode 26.3 工具链后的 Swift parse、`git diff --check` 均通过。
- 正式 Release `build/SourceUITests-1794972944246.xcresult`：1 passed / 0 failed / 0 skipped，152.256 秒，iPhone 15 Pro Max / iOS 26.3.1 / x86_64，`sourceUnchanged=true`。
- 运行清单 SHA-256 `48aaf2cf0f8590bf1bd5d22458d25a7f32464c58252cb35b35edb4314c22ac4b`，`resultInfo` SHA-256 `aa710ef87a86078f7a6b1fab17d3c9d0d885d26b5311df34ef09638a86bcc2f9`。
- 截图 `build/ui-screenshots/platform-daily-full-20261118-r3/001-Platform-daily-full-list-reaches-the-thirtieth-returned-row.png`，1290×2796，SHA-256 `8a13f93e66506f60ef9bf0410762cff000ceef8df089c115f77883285d079382`；已亲看账号、总数和第 30 行。

复现：

```bash
source /Users/ningli/WorkSpace/Tools/env.sh
NEXUS_UI_RUN_DIR=build/logs/platform-daily-full-20261118-r3 \
  node scripts/test-ui.mjs NexusMusicUITests/SourceSettingsTests/testPlatformDailyFullList
```

## 保留的失败

- r1 `build/SourceUITests-1794972460915.xcresult`：第 30 行按钮已经存在并可点击，但用例用 `staticTexts` 查询，失败于元素类型不匹配。改为按带完整歌曲标题的播放按钮断言后继续。
- r2 `build/SourceUITests-1794972677957.xcresult`：功能路径通过，但复用了遗留的 `Synthetic NetEase Favorite` 账号。随后补充启动清理、错误 Cookie 401 和鉴权失败计数，r2 不计为最终验收。
- 两轮失败原件、日志与运行清单位于 ignored `build/`，未删除。

## 未完成

本批只证明合成网易云日推的完整列表和通用队列动作，不等于真实平台账号、真实日推、QQ/酷狗列表、推荐歌单、心动模式、私人 FM 低水位续批或实体机验收。J08 仍为 C；真实账号、实体机、签名与 iOS27 云端继续开放，整体目标保持 active。
