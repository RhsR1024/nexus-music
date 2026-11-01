# 酷狗公开评论回复展开

2026-11-01。F31 增量在既有酷狗匿名公开评论和共享评论 Sheet 上增加只读回复线程。此批完成根评论计数、首批展开、同 offset 重试、20 条分页、去重、500 条显示上限、取消与迟到隔离；不增加点赞、发评、账号评论或写操作。

## 实现与请求边界

固定 Q-music Android 提交 `5db858f32695d10c5e9ef0f7037d586aef6a8c4b` 的 `src/utils/musicSdk/kg/comment.js` 中 `getReplyComment` 路径及既有 Apache-2.0、Nshpiter/LX/lyswhut、MakcRe/KuGouMusicApi MIT 归属继续适用。iOS 端使用独立 `KugouPublicComments` 实现，没有复制参考模块、Android 存储、全局取消句柄或依赖。

回复读取使用匿名官方 HTTPS `https://gateway.kugou.com/index.php`、`r=commentsv2/getReplyWithLike` 和既有 `x-router: m.comment.service.kugou.com`。请求只携带公开 `childrenid`、根评论 `tid`、页码/页大小与固定公开协议参数，`credentials: omit`；不使用 Cookie、账号、播放地址或私人 metadata。回包严格校验 `err_code`、当前页、歌曲 `childrenid`、根评论 `tid`、总数、20 条数组上限和分页边界。缓存中的根评论身份同时绑定产生它的原曲，换源或其他歌曲不能复用该缓存。

`SongComment.replyCount` 来自公开 `reply_num`；只有正数才显示“查看 N 条回复”。每个根评论维护独立展开、载入、错误、offset、`hasMore` 和上限状态。切换歌曲、刷新、关闭及重新载入会取消在途回复；旧结果不能写回新会话。失败保留已有回复并按原 offset 重试，重复 ID 不追加，零推进或达到 500 条后停止。

共享 Sheet 保持原有固定标题、下拉关闭、热门/最新分区、评论分页和播放器状态。回复区沿用当前配色与字体，使用 14pt 缩进和 2pt 左边框；所有操作按钮最小高度 44pt。预先登记的交互和布局场景见[UI 规格](ui-spec/comments-kugou-replies-2026-11-01.md)。

## 已验证

- `npm run check`：类型检查及 923 项测试通过，0 失败、0 跳过。评论专项最终增加 2 项并发回归，原 20/20 通过，新增覆盖支持范围、分页去重、失败保留/同游标重试、收起取消、换歌迟到隔离、原曲绑定、严格回包 schema、取消和非法请求。
- 合成 Release UI `SourceUITests-1793531941479`：1 通过/0 失败/0 跳过，测试本体 50.322 秒。覆盖回复计数、展开首批、第二页首次失败时保留已有两项、重试追加、评论分页、刷新失败保留、空态、关闭后未开始播放。6 张截图逐张亲看并通过来源/摘要门禁。
- 真实匿名 Release UI `SourceUITests-1793532092155`：1 通过/0 失败/0 跳过，测试本体 100.522 秒。生产搜索和酷狗公开服务实际显示正评论总数、真实回复计数、展开回复、回到最新区及第二页评论；4 张截图逐张亲看并通过来源/摘要门禁。真实昵称/正文截图只保留本机忽略目录，不提交。
- 两轮 `run-manifest` 的产品源码摘要均为 `4135c20421fd4995fd4f79aea5b60854a88795d9af5331ea5720350192ba50f9`，运行前后未变化；截图 index、精确 xcresult、安装 bundle、fixture 和源码摘要均通过 `verifyCaptureEvidence`，合成 6/6、真实 4/4 ready。真实截图含公开用户内容，仓库只记录数量、哈希和结论。
- 首次合成失败是夹具第 1 页只回 2/4 却声明完整总数 4，`hasMore` 正确为 false；改为服务式总数 41 后通过，失败结果保留。首次真实失败是测试查询绑定第一个离屏匹配元素，截图中实际已存在多个可见回复按钮；改为选择当前可见元素后通过。组合复跑出现一次真实搜索空结果，未计通过；随后独立真实 Release 1/0/0 通过，失败包保留。

## 反向证据与剩余范围

复用 mobile-reverse `E-033 → F-032 → P-032` 的评论 Sheet、固定头部、列表分区和刷新证据，无新增 Sollin 采集。IPA prerequisite 与 case-guard 通过；采纳前严格 review 为 52 Evidence / 17 Work items / 106 timeline events / 43 Findings / 43 Paths、0 错误、0 警告。

本批不关闭 F31。真实弱网/限流矩阵、全歌曲身份矩阵、点赞/发评/账号评论、可视 emoji 字形、Android、实体机、签名、录屏/动效及云端终态继续。模拟器成功、未签名 IPA 和匿名公开读取均不能替代真机、签名或账号能力。

## 复现

```bash
source scripts/environment.sh
npm run check
node scripts/sollin-reverse-gate.mjs ipa
node scripts/sollin-reverse-gate.mjs ipa --review
node scripts/test-ui.mjs NexusMusicUITests/SourceSettingsTests/testPublicKugouComments
node scripts/test-ui.mjs NexusMusicUITests/SourceSettingsTests/testLiveKugouPublicComments
```

每轮使用新的精确 xcresult 和截图目录。真实测试截图仅留本机忽略目录；提交前复查源码、截图、凭据、私人内容、固定来源和许可归属。

## 最终复核补充

发现并修正评论翻页与回复载入并发时恢复旧 `threads` 快照，以及刷新失败后已取消线程残留 `loading` 的问题。普通评论翻页不使回复会话失效，成功/失败都合并当前线程状态；刷新仍取消旧请求并清除其载入标记。新增延迟 Promise 回归覆盖两种完成顺序、同页重复回复及刷新失败后重新展开。`npm run check` 最终 923/923，0 失败/跳过。真实 Release 测试新增实际 `comment-reply-` 行断言，空的展开容器不再足以证明真实接口成功。前述两次截图对应补丁前源码，最终候选另行复验并记录，不能混用源码摘要。

旧 iOS 27 run `41290756098` / `8d87811` 已失败。通过 GitHub job `124810973050` 原始日志确认仍为旧的两平台评论来源完整提示断言，22 项中 20 通过/2 失败，同一个综合路径在 Swift 3782；`27a1a32` 已含该文案修正且正在运行。没有为同一根因再改产品或重派旧提交。

最终候选合成 Release `SourceUITests-1793532877000` 与真实匿名 Release `SourceUITests-1793533187681` 均为 1 通过/0 失败/0 跳过。前者 6PNG、后者 4PNG 全部通过 `verifyCaptureEvidence` 并逐图亲看；真实运行实际载入回复行及后续评论，未使用空容器代替。两次产品输入摘要均为 `0e29515af192e0b7fb60372250a13b27b6274387c4990f10e361ebf27ccafcd4`。之后只将被误列入输入的 `ios/._build` AppleDouble 元数据迁入忽略目录，并新增 `._*` Git 排除，产品代码不变；不把删除元数据后的全输入摘要冒充原截图摘要。

- `kugou-replies-race-review-20261101`：index SHA-256 `169aade57ad7dc9753400f8178516bbe152d85c4e3bed10fe282fefd84a2f497`；manifest SHA-256 `a9e964d14af6fc10a2c390fe399c905f2bc47439dcadfa07a3cdb89963199234`。
- `kugou-replies-race-live-20261101`：index SHA-256 `7c9e3f16f176279b221e728067fdb9e4bb88a9dba05088974025146e33495863`；manifest SHA-256 `a1843cca09d0dc9346dd69bdccc8ce9aded7d2637addc7858b7ca9972c4f9f4b`。

最终候选本地 unsigned IPA 已重新归档并独立检查：12,848,459 字节，SHA-256 `37dd354ac8f06f107bd988bfefc0e0a56d3f655af944c5fc134f7e6726ab8735`；arm64/iphoneos26.2、最低 iOS 15.1、iPhone+iPad，ZIP CRC 正常、无签名或 provisioning profile。生产 bundle 含回复读取实现，不含测试 adapter、夹具控制或合成回复文案。此为提交前 dirty 构建，不能写成 clean；前一 `90e771…ec99` 包已由归档脚本保存至内容哈希快照。

## clean 提交归档

功能提交 `e11530570674eb371661edbf116642af47be318c` 后在 clean 工作树重新归档：manifest `dirty:false`、空 `workingTreeChanges`；IPA 12,848,459 字节，SHA-256 `246f0c69ceb59720fbc991240f69965bfc0f1d0d79bf987f88e7624cecdf0c2a`，manifest SHA-256 `0a9a557a852f1c4e196513f837fc02d71bff530ddbed0db9062fa926523198e6`。独立检查确认 arm64/iphoneos26.2、iOS15.1、iPhone+iPad、unsigned、无描述文件，生产回复实现存在而合成夹具被排除。IPA、SHA 文件、manifest 与核验 JSON 已复制到 T7 `BuildArchive/2026-11-01-kugou-replies-clean-e115305/`，源/目标文件摘要一致。旧 dirty 包继续由内容哈希快照保留；clean IPA 不能替代 iOS27 云端、签名或实体机验收。
