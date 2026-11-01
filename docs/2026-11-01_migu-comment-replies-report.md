# 咪咕公开评论回复展开

2026-11-01，F31 只读增量。在已有咪咕热门/最新评论、原曲会话游标和共享回复线程上补齐根评论计数与回复读取。完整 F31、账号写操作、其他平台完整回复、emoji 可视字形、弱网/实体机/签名/动效及云端终态仍独立验收。

## 依据与真实协议

按固定 Q-music Android 提交 `5db858f32695d10c5e9ef0f7037d586aef6a8c4b` 核对 `src/utils/musicSdk/mg/comment.js` 的 `getReplyComment`，连同 LICENSE、NOTICE、MODIFICATIONS.md 共4文件逐字节匹配 Git 对象。沿用 Apache-2.0、Nshpiter/LX/lyswhut 归属，不复制 Android 模块、依赖、全局取消句柄或数据存储。QQ 固定参考模块没有完整回复读取入口，未凭普通评论参数猜造协议；后续按依赖满足顺序推进。

匿名官方 HTTPS 回复路径为 `/MIGUM3.0/user/comment/stack/<root>/v1.0`，固定 `queryType=2`、`resourceType=2`、20条服务页及 `start`。`credentials: omit`，不取账号 Cookie、播放 URL 或私人 metadata。只接受已由同一原曲评论页产生的根评论；缓存有界，根ID需通过白名单，不能拼任意路径。

真实预检发现参考 `filterComment` 的普通评论字段不能直接用于回复：服务实际返回 `replyId/replyInfo/replyTime`，以及 `targetComment/targetUser`。音枢独立解析作者、正文、秒/分钟日期、点赞和明确目标文本；不把回复误归根作者。回包核对根ID、目标歌曲、类型、双处总数与数组边界，错误不作为空成功。首次匿名原曲预检正回复数8、实际8行、8个时间及8个目标引用，分页偏移20正确返回空列表；这里只证明该公开样本，不泛化到全部歌曲或弱网矩阵。

## 实现与检查

`MiguPublicComments` 新增原曲/根评论绑定和独立回复读取；`PublicComments` 按原曲平台分流。共享 `CommentSession` 沿用每根评论的展开、错误、同游标重试、取消/迟到隔离、去重、500条上限；新增500条停止及关闭取消回归。回复区新增明确目标引用的展示，继续使用正式 Sheet、主题和44pt操作区域，不改变播放、权威队列和主评论分页。

当前 `npm run check` 为931/931，0失败/0跳过；新增覆盖匿名参数、真实字段与引用、原曲绑定、非法游标/路径/私人来源、错根/错歌/总数不一致、畸形数组、空态、文本/日期边界及取消。首次测试对同步拒绝误用 `assert.rejects`，已改为匹配现有接口契约的 `assert.throws`，没有修改产品去放宽私人来源。

长列表审计复现了咪咕/酷狗根评论缓存1000条的不足：1000条最新与热门并存时，仍显示的热门或首条最新评论会被淘汰，回复请求被本地拒绝。两平台有界缓存提升至2048条，新增各50页×20条、同时验证原热门与首条最新仍可请求回复的回归；没有放宽原曲身份校验。

UI/归档及最终提交结果将在实际完成后追加；当前不能仅以代码与单元检查声明 App/云端通过。场景见[规格](ui-spec/comments-migu-replies-2026-11-01.md)。真实评论正文、昵称、截图只留本机忽略目录，仓库只留脱敏数量/哈希/结果。

## 最终合成 Release UI

`SourceUITests-1793535614005` 咪咕/酷狗联合专项为2通过、0失败、0跳过，包含回复展开、目标引用、分页失败保留、同游标重试追加、明确回复空态，以及原主列表刷新/分页/空态和无意外播放断言。12PNG全部通过 `verifyCaptureEvidence`，已亲看：固定标题、分区、回复缩进/引用卡片、错误与空态均可见；模拟器 emoji 缺字仍单独待验。

源码输入摘要 `ddb6d59d9eb8a05b262c8ae0a189eb26fccc70e0d8cfbe3ed862e6b82ac10ae2`，运行前后未变化；manifest SHA-256 `ff25310f3c125b97fd8859b8ae817e378483e5fe92ee415b21891a95e8c08b3a`，截图index SHA-256 `b07443fd818c4e99dc1d4952bd3f3213cc120805d277199a4ce8bdd04399cb77`。此前两轮2/0/0只作中间证据，缓存修复后的本轮为最终合成候选。

## 回归补充

合成咪咕回复端点 start 序列为 `[0,20,20,0]`，仅 offset20 首次失败，重试保持20；最后0对应刷新后明确空态。两平台根缓存各2048条，覆盖1000条可见最新评论、热门及最后一页过滤余量；仍为每个 UI 会话独立 reader。合成测试本体酷狗50.317秒、咪咕49.788秒。

## 真实匿名 Release UI

`SourceUITests-1793535813780` 为1通过、0失败、0跳过。正式搜索→歌曲菜单→评论Sheet，实际读到正总数、热门/最新、可见正回复计数并展开真实 `comment-reply-` 行，后续评论第二页追加且关闭后未开始播放。4PNG来源ready并亲看，回复含明确目标文本；仅说明该公开原曲的本次结果。两轮产品输入摘要相同，真实内容与截图只留本机忽略目录。

真实manifest SHA-256 `5193488f2010fb64303a9d09a59b5e8011238dac7a3d56f511e39cfc747a84d5`，截图index SHA-256 `2af6cadd744925e4ed5aefb069a34cdf5f3d69985303454dc4406da1d3723c3d`。

## reverse-skill 采纳复审

原生路由 `work/master-route-20261101-195920/route-scope.md` PRIMARY为mobile-reverse；既有离线case-guard及固定skill/工具/样本摘要门禁通过，未重初始化case。复用E-033→F-032→P-032，只采用既有Sheet/固定标题/分区/重试边界；后端及本批交互为独立实现与实测，不外推Sollin运行时。更新WI-011、timeline及本机journal后，`ipa --review`为52E/17WI/107事件/43F/43P、0错误/0警告。

## 提交前本地 IPA

unsigned IPA归档成功：12,850,360字节，SHA-256 `ea41e9c659c6a2a8b3a3b33b7bed8bba73cd8b51b239b6a47452a5817d25357e`；独立ZIP CRC、包内/归档二进制摘要、arm64/iphoneos26.2/iOS15.1/iPhone+iPad、无签名/描述文件及生产bundle/合成夹具排除核对通过。这是提交前dirty构建，不能标clean。独立检查初始按UTF-8查找中文提示未命中，确认Hermes使用UTF-16LE后按真实编码核验通过，产品未修改。

## 清洁提交归档

功能提交 `f738d8ee92632116c522d971372d5ead4a72781a` 后clean archive成功，manifest `dirty:false`、工作树变更为空；IPA 12,850,360字节，SHA-256 `dce1218cd3fc65f5df022d9ead3b8458020b41cb9ca6166567f861c7b64c38e3`，manifest SHA-256 `07f77f452660d5b38d1115e16b201705585b64e73005ea7d4ccbebac76dc1904`。独立CRC/arm64/iphoneos26.2/iOS15.1/[1,2]/unsigned/无描述文件/生产实现及夹具排除检查全部通过。Hermes中文提示按UTF-16LE验证。四份交付文件复制至T7 `BuildArchive/2026-11-01-migu-replies-clean-f738d8e/` 后逐文件SHA一致，旧dirty包由内容哈希快照保留。

阶段空间检查：T7真实USB外置挂载、exFAT及写入回读通过；内盘约35.0GiB、T7约697.1GiB可用。本轮无额外删除/迁移，保留当前缓存、最新两阶段与未解决证据；本机小型回执 `build/logs/cleanup-20261101-migu-replies.json`，副本随T7归档。清洁包不代替iOS27、签名或实体机。
