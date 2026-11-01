# 酷我公开评论回复协议核验回执

2026-11-02。本批按 `js-reverse` 路由核验酷我公开 Web/H5 评论是否存在可复现的完整回复协议。结论是：匿名根评论与单条回复预览可读，但当前证据不支持安全实现完整楼层分页；音枢继续保留现有预览，不向未验证 endpoint 发起请求。本批没有新增产品代码、UI 场景或真实播放操作。

## 范围与证据链

Case 为 `work/kuwo-comments-public-protocol-20261102`，只在本机忽略目录保存原始脚本、公开响应、浏览器观察与报告。scope 为 `own_system`、`authorized_target_only`，活动限定为只读官方公开 Web/JavaScript/HTTP 和匿名页面网络观察。

排除登录、Cookie、账号资料、私有元数据、评论写入、播放 URL、用户内容外传及任何私有 App 协议。仓库只记录公开字段名、状态、数量边界、来源哈希和脱敏结论。

项目 `reverse-skill` 路由、既有离线 Sollin case 和 `E-033 → F-032 → P-032` 保持独立。E-033 只证明共享评论 Sheet 的结构与交互骨架；本批酷我协议判断来自官方公开 bundle、匿名公开响应和运行时观察，不冒充新的 Sollin 功能证据。没有新增 Sollin 采集、样本修改或私有服务探测。

## 核验结论

酷我匿名公开根评论可以稳定读取：

- 移动网关 `https://ncomment.kuwo.cn/com.s` 使用 `get_comment` 与 `get_rec_comment`，按歌曲 `sid`、服务端 `start` 和 20 条 `count` 读取根列表；响应可带 `child_comments` 与 `child_comment_count`。
- 桌面网关 `https://comment.kuwo.cn/com.s` 使用 `page`、`rows=20`、`digest`、`sid` 与 `prod=newWeb` 读取根列表；根行可带单个 `reply` 对象。
- 九个官方移动公开 bundle 与当前桌面评论模块没有可复现的完整回复列表请求分支。移动 bridge 动作 `goto_client_comment`、`reply_comment` 是客户端内动作名，不是 HTTPS 回复列表接口。
- 匿名样本与桌面/移动官方页面运行观察没有提供根评论绑定参数、回复页码或游标、回复总数、`has_more`、回复行 schema 的统一契约。根列表的 `offset`/`page` 不能复用于回复，单条预览数量也不能代替完整线程总数。

因此产品动作固定为：保留 `KuwoPublicComments` 的根评论读取、热门/最新、服务端 offset 校验、总数、日期/点赞、长文本和首条回复预览；`CommentsModal` 的酷我分支不 dispatch 到未验证的完整回复请求。只有取得新的固定官方来源并同时证明请求方法、歌曲/根评论绑定、分页游标、总数、`has_more` 和行 schema 后，才重开实现。

## 已核验公开来源

| 对象 | 结果 | SHA-256 |
| --- | --- | --- |
| 桌面 pretty comment module | `get_rec_comment`、`get_comment`；`reply` 仅作单条预览 | `66c431d0f5381ff2f6c160f8a2d9a027bdfb0798a91c4b4b8fe16bc246ab0f14` |
| 移动匿名根列表样本 | HTTP 200；20 行；无完整回复游标/`has_more` | `dea396c6c16c86e72e9a2d6a0e53fd3e97778f122d90d4bbc49663661af42b57` |
| 桌面匿名根列表样本 | HTTP 200；20 行；仅单条 `reply` 预览 | `c26864719a7cca8bdb972d86b135c9bde4d3e8bf32e98143f63b627a8a37c55b` |
| 桌面运行时观察 | 42 个请求，0 个 comment/reply 请求 | `275396ec8f91cdd65652652cfeac89fa9c8f94050adade219b546c343b17c58e` |
| 移动运行时观察 | 31 个请求，0 个 comment/reply 请求 | `5b87a58777108142059508441f8701216ec03a0821185a6f0f7dab15ec203dca` |

公开响应中的真实评论正文、用户名、头像 URL、截图和浏览器配置只存在本机忽略目录，不进入 Git，也不在仓库文档展示。

## Evidence → Finding → Path

| 类型 | ID | 脱敏结论 |
| --- | --- | --- |
| Evidence | `E-K01` | 官方 bundle 只暴露根评论接口与单条回复预览；无完整楼层请求分支 |
| Evidence | `E-K02` | 匿名根评论响应缺少根绑定、回复分页、总数与 `has_more` 统一契约 |
| Evidence | `E-K03` | 官方桌面/移动页面运行未触发 comment/reply 请求 |
| Evidence | `E-K04` | 完整回复保持协议阻塞；现有单条预览仍是有效能力 |
| Finding | `F-K01` | 酷我公开 Web/H5 没有可验证的完整回复列表协议 |
| Path | `P-K01` | 页面只从根评论读取到单条预览，停止于缺少可验证回复契约处 |

严格 case review：`PASS`，`0 errors / 0 warnings`，4 Evidence、6 WorkItems、6 timeline events、1 Finding、1 Path。最终 `case-review.md` SHA-256 为 `d7e5fee315d20d233b3105d600cb4f43fb3c591e7082a3fb574881dd6e4370c6`，`case-review.json` SHA-256 为 `25ba544233437ce8196f7d12b03162fe6d3e0a10d21c4fdb1f14ed03a01067d7`。

## 安全与产品边界

- 所有公开请求 `credentials: omit`，不读取或迁移 Cookie、账号、私人元数据、评论正文到仓库。
- 不猜测 endpoint；不以 bridge 名称、单条预览、根列表游标或登录态可能存在的隐藏行为替代协议证据。
- 不实现无界加载；未来完整回复若重开，仍须同一根绑定、同游标重试、成功/失败保留、取消与迟到隔离、去重、明确上限和 500 条共享 UI 上限。
- 本批不新增点赞、发评、删除、举报、账号评论或平台写操作。
- 没有复制酷我 bundle 代码、图片、依赖或运行逻辑。既有酷我 provider 的 Q-music Android 固定来源与许可归属保持不变。

## 检查与复现

本批只修改文档与本地忽略证据，因此不重跑产品类型/UI/归档，不声称新增 IPA、iOS 27、实体机或播放验收。采纳结论前后执行：

```bash
source scripts/environment.sh
node scripts/sollin-reverse-gate.mjs ipa --review
node scripts/sollin-reverse-gate.mjs apk --review
git diff --check
```

最终 gate：IPA strict review `PASS`（52 Evidence/17 WorkItems/109 events/43 Findings/43 Paths，0 错误/0 警告）；APK strict review `PASS`（3 Evidence/2 WorkItems/3 events/2 Findings/2 Paths，0 错误/0 警告）。这些是离线协议/UI 证据前置门禁，不证明 IPA/APK 运行或本次酷我协议本身。

复现案例使用固定官方公开 bundle 与匿名根列表请求，并在官方公开播放页面观察网络；具体命令、scope 和原始证据只保存在本机忽略 case。任何未来重开都需要新的精确来源哈希，不复用本次不可证明的猜测。

## 未完成边界

本批只关闭“酷我公开完整回复协议是否已有足够证据”的调查问题，不关闭 F31。酷我完整回复仍为 `blocked_pending_verified_reply_protocol`；其他平台独立楼层、账号写操作、emoji 可视字形、弱网/限流、iOS 27、实体机、签名和连续动效继续按原计划验证。
