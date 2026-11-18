# QQ 私人雷达完整列表与批量动作

平台推荐完整列表此前只提供整批播放、整批入队和逐曲操作。Sollin Android 动态证据明确支持私人雷达的长按多选与批量收藏、加歌单、下一首、下载，而每日推荐长按不进入多选；本批按实际 `kind` 只对 `tx_radar` 开放多选，日推、官方每日推荐和酷狗日推保持普通列表。

## 行为

| 场景 | 现在的行为 |
| --- | --- |
| `tx_radar` 歌曲行 | 长按进入多选并选中该行；再次点按切换选择，复选框与无障碍选中态同步 |
| 每日推荐/官方日推/酷狗日推 | 不提供长按多选，仍可播放全部、全部入队和逐曲下一首 |
| 批量收藏 | 按点选顺序写入本地收藏集合，保留音枢仅在本地处理收藏的边界 |
| 批量加歌单 | 使用现有 `PlaylistPicker`，把列表顺序的所选歌曲加入现有或新建本地歌单 |
| 批量下一首 | 按当前平台列表顺序一次插到当前曲后；没有当前曲时建立权威队列并把第一首设为当前曲 |
| 批量下载 | 复用现有下载提交服务，显示受理/已有/失败回执；未全部受理时保留选择 |
| 全选/取消 | 全选当前完整列表，取消后恢复逐曲播放按钮和单曲“下一首”入口 |

这些动作没有新增第二套队列、收藏或下载存储。列表仍是只读平台结果，不把雷达歌曲自动写入本地音乐库。

## 夹具与验证

正式 UI 用例 `testPlatformRadarBatchActions` 只在测试入口启用 `NEXUS_UI_ACCOUNT_RADAR_FIXTURE=1`。启动时清除已有网易云、QQ、酷狗平台账号，保存合成 QQ 账号 `qq:2:9000000000000000006` 和真实 `MusicAccounts`/Keychain 会话，并将权威队列清空以验证精确入队结果。

本机 HTTP 夹具模拟 QQ 私人雷达：

- 雷达两页返回 40 个候选，客户端按固定顺序去重并截取 30 首；
- 详情请求按 10 首分组，返回 `Synthetic Radar 1..30`；
- Cookie 必须包含 `qqmusic_key=synthetic-radar`，否则返回 401 并计入 `authFailures`；
- 控制接口只在 `testPlatformRadarBatchActions` 时启用。

用例断言：

- 完整列表显示“共 30 首”，绑定 `Synthetic QQ Radar`；
- 长按第 1 行后出现“已选 1 / 30 首”；
- 点第 2 行后出现“已选 2 / 30 首”；
- 批量下一首提示“已添加 2 首到下一首播放”；
- 权威队列准确为 `1. Synthetic Radar 1`、`2. Synthetic Radar 2`；
- `accountRadar.requests=5`、`authFailures=0`（两页雷达 + 三组详情）；
- 清理播放队列后退出，不为后续用例留下合成队列。

## 验证结果

- 产品与测试提交：`b1dc151`。
- `npm run check`：1108/1108，0 failed/cancelled/skipped；日志 SHA-256 `eb4113fd38fa5bb4db0119c6dd90576c396c3bb77c2ceb83b9ef017cb5164b37`。
- `node --check scripts/test-ui.mjs`、Swift parse、`git diff --check` 均通过。
- 正式 Release `build/SourceUITests-1794973754818.xcresult`：1 passed / 0 failed / 0 skipped，150.228 秒，iPhone 15 Pro Max / iOS 26.3.1 / x86_64，`sourceUnchanged=true`。
- source digest `d89b3c8081f1cb5ad60dd6dce59b99949e6fb6257b3fc9c0536bda2c4c04083d`；run manifest SHA-256 `b1bc602b1cd3e9e1bf5d13de81a0d1741161e9c9509f6f287f43fa9ba29e6bec`；ui-summary SHA-256 `cf2c3c2aff549ffcbd3f18cef73e988876ead1bc82c58a1d1af3970871c81a14`。

三张 1290×2796 截图已来源核验并亲看：

| 内容 | SHA-256 |
| --- | --- |
| 长按进入多选 | `e39aa108e32252f6e6a87f8535e818679ad63b26cafa4f34bfb33d146ec18d1d` |
| 两行已选 | `5a87ef232f313dee46b79df72d429deb95bf314b0253c78b424469c5e2985b17` |
| 下一首后权威队列 | `a2a91d5b1392eb364e67ab042eab0c7c016bbd8306ca9a3288e89d67ba2b8383` |

复现：

```bash
source /Users/ningli/WorkSpace/Tools/env.sh
NEXUS_UI_RUN_DIR=build/logs/platform-radar-batch-20261118-r2 \
  node scripts/test-ui.mjs NexusMusicUITests/SourceSettingsTests/testPlatformRadarBatchActions
```

## 保留的失败

首轮 `build/SourceUITests-1794973578072.xcresult` 已通过长按、两项选择、批量下一首、精确队列和鉴权断言，仅在清理阶段无条件点击“收起队列”时失败：清空队列后该按钮已随队列面板消失。失败原件、日志和截图保留；改为存在时才点击后第二轮通过，第一轮不计最终验收。

## 未完成

本批是合成 QQ 私人雷达，不代表真实 QQ 账号、真实雷达、实体机或签名已验收。公开推荐歌单已有“发现”入口，账号推荐歌单、心动模式和日推内多选仍未完成；私人 FM 低水位续批已由既有 `AccountFmStation` 实现并有专项测试，真实服务供曲仍待验。每日推荐继续按证据保持不可多选。J08 仍为 C，所有目标保持 active。
