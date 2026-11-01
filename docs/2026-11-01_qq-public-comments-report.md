# QQ 音乐公开评论：原曲身份、热门/最新分页与真实服务

2026-11-01。本批为 F31 评论能力的 QQ 音乐纵向切片：在既有 Sollin 评论 Sheet、网易公开评论和统一会话控制上，新增匿名只读 QQ 公开评论适配。它不是 F31 的整体完成，也不包含点赞、发评、账号专属评论或酷狗/酷我/咪咕评论。

## 来源与门禁

后端协议继续按 [Q-music 安卓接入记录](Q_MUSIC_ANDROID_REFERENCE.md) 的固定提交 `5db858f32695d10c5e9ef0f7037d586aef6a8c4b` 核对。UI 语义复用既有 E-033 → F-032 → P-032，不新增 Sollin 采集，不把参考源码存在写成真实服务通过。

执行 `source scripts/environment.sh && node scripts/sollin-reverse-gate.mjs ipa` 和 `ipa --review` 均 PASS。严格 review 为 52 Evidence / 17 Work Items / 103 timeline events / 43 Findings / 43 Paths，0 errors、0 warnings。原始样本、索引和完整证据继续留在本机忽略目录。

## 实现

- `src/providers/qqComments.ts` 只接受平台为 QQ、身份符合 songmid 白名单的在线原曲。公开评论请求固定使用 HTTPS、无 Cookie、`uin=0`，不读取或传递登录态。
- 评论端点以数值 `topid` 查询，20 条一页；优先使用当前 Track 上已绑定且与 songmid 一致的数值 ID，否则通过官方公开歌曲详情解析一次，只在进程内有界缓存 100 个 songmid→数值 ID 映射。
- 严格校验响应 `code`、回传 `topid`、非负总数、数组边界和行数上限。服务错误、身份不符、畸形行与真实空列表分开处理，不把失败伪装成空态。
- 首屏热门评论与最新评论分区展示；后续页面只追加最新评论。评论 ID 保留 QQ 的不透明根评论/子评论身份，回复保留原评论归属；长文本、时间、点赞、`\n` 和表情标记在展示前有界规范化。
- `PublicComments` 按原曲平台分流网易/QQ。播放换源或匹配实际录音不改变评论查询对象；网易现有游标/会话逻辑保持。
- `CommentsModal` 增加稳定的 `comments-item-*` test ID，并以 accessibility value 暴露“已显示 N 条最新评论”；未支持来源文案更新为网易云、QQ音乐。此批没有改评论 Sheet 的视觉规格或动效，不增加 UI 对齐完成量。

## 真实接口与 App 验收

本机匿名只读请求实际返回正数总数与热门/最新两段；一次实测首屏热门 15 条、普通最新 20 条，`nextOffset=20`，第二页再追加 20 条且 ID 无重复。真实 App 专项从正常搜索选择 QQ 平台、打开公开歌曲操作、进入评论，看到公开歌曲的正数总数（本轮为 4078），热门/最新均可读，加载更多后最新列表追加第二页。未记录真实昵称、评论正文、Cookie、播放 URL 或账号资料到仓库。

正式 Release 运行环境：专用 iPhone 15 Pro Max 模拟器，iOS 26.3.1 / 23D8133，430×932pt / @3x。

| 验收 | 结果 | 精确结果 |
| --- | --- | --- |
| `npm run check` | typecheck 通过；893/893 业务检查通过，0 失败/跳过 | 本轮最终执行 |
| `testPublicComments` + `testPublicQQComments` | 2 通过 / 0 失败 / 0 跳过，测试组执行 81.289 秒 | `build/SourceUITests-1793512318523.xcresult` |
| QQ 合成协议专项 | 1 通过 / 0 失败 / 0 跳过 | `build/SourceUITests-1793510736297.xcresult` |
| QQ 真实公开服务专项 | 1 通过 / 0 失败 / 0 跳过，165.353 秒 | `build/SourceUITests-1793511454891.xcresult` |
| `git diff --check` | 通过 | 本轮最终执行 |

合成夹具覆盖热门/最新、总数变化、第二页首次失败后同游标重试、刷新失败保留、真实空列表、回复根文本、长文本、身份缓存与取消。最终三条合成截图和三张真实服务截图均已亲看；截图只存本机忽略目录，不能提交或作为仓库夹具。

| 证据目录 | PNG | SHA-256 |
| --- | ---: | --- |
| `build/qq-comments-fixture-r3-attachments-1793510899` | 3 | `f4f3279d…`、`5838e29c…`、`935f34a0…` |
| `build/qq-comments-live-r3-attachments-1793511636` | 3 | `f32d9acf…`、`3e95df8a…`、`ab5c4404…` |

本轮候选源码 run manifest 为 `build/logs/run-manifest.json`，源码 digest `490bf1401686dc1772ee38dacd5aae54ca2f3cb42422924cc20dbc1c9441be25`，diff SHA-256 `6e8bd1884d1a5cb69d8e5f5c9a77320ff470f24d1052b613c58a2d32ac398d39`，执行前后源码未变。

## 失败与修正

- 合成夹具首次使用含连字符的 QQ MID，被生产白名单拒绝；改为合法 songmid 后重跑。失败结果不计通过。
- React Native 文本在无障碍树中存在重复节点；测试改为精确 label predicate 加 `firstMatch`，保留产品文本结构。
- 真实服务首轮中热门评论占满首屏，“最新评论”尚未进入无障碍树；测试按真实列表滚动后断言，没有删除分区或放宽产品要求。
- 合并回归首次失败在既有网易评论横屏窗口谓词；现场显示 `XCUIDevice` 已报告 Landscape Left，但模拟器画面和窗口仍为竖屏。重启该专用模拟器后原用例 1/0/0，随后合并回归 2/0/0。这是设备方向状态恢复，不是 QQ 解析或评论产品回归；失败包继续保留。

## 隐私、许可与未验范围

- Q-music 固定提交的 Apache-2.0/NOTICE、酷狗部分 MIT 归属和本机参考路径继续按既有记录保留；本轮没有复制参考产品代码、图片、依赖或 Android 存储实现。
- 真实服务证据包含公开用户的昵称与评论正文，只允许留在本机 `build/` 忽略目录。仓库回执不复制正文、不记录 Cookie、令牌、账号、播放 URL 或私有元数据。
- 未验：酷狗/酷我/咪咕评论、回复展开全矩阵、点赞与发评写入、账号评论、真实弱网/限流/服务变更、Android/实体机/签名、精确 Sollin 视觉/动效及性能。合成截图和真实服务截图不替代这些验收。
- 本批不关闭 F31，不增加全项目功能/UI 完成百分比；总目标 F01–F37/J01–J59 仍 active，云端需按实际提交另核对。

## 本机复现

```bash
source scripts/environment.sh
node scripts/sollin-reverse-gate.mjs ipa
node scripts/sollin-reverse-gate.mjs ipa --review
npm run check
node scripts/test-ui.mjs NexusMusicUITests/SourceSettingsTests/testPublicComments NexusMusicUITests/SourceSettingsTests/testPublicQQComments
node scripts/test-ui.mjs NexusMusicUITests/SourceSettingsTests/testLiveQQPublicComments
```
