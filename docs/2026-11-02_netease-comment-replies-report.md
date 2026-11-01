# 网易公开评论回复展开回执

2026-11-02。本批为 F31 增加网易云原曲公开评论的最小只读楼层增量：复用现有评论 Sheet，补齐已有根评论的回复读取、时间游标分页、失败保留与重试。完整 F31、QQ/酷我完整楼层、账号写操作、弱网矩阵、签名、实体机和连续动效仍未完成。

## 来源、证据与边界

固定 Q-music 参考 `5db858f32695d10c5e9ef0f7037d586aef6a8c4b` 的 `wy/comment.js` 已覆盖原曲评论、热门/最新和引用预览，没有完整楼层查询。补充的公开字段核对来源固定到 `neteasecloudmusicapienhanced/api-enhanced` 提交 `984cc021b8598cf94c22134f32a8426887fb2de7`。其 `comment_floor.js` SHA-256 为 `78593f31a824e7c0d65bcbbd29ac32be62303195792c2adc8ed9e20be697cc8a`，`comment_new.js` 为 `5434cdaf8854cd77d654fc54a3588752a1912a34922d3974fe40b73dbde82348`；该提交 MIT LICENSE 归属 Binaryify 2013–2022，文件 SHA-256 `e463bb821c363e6182f16ec1bf24405af3315b4adc72fc1402232fa98b9a0b12`。仅核对公开请求字段，没有复制其加密、账户、服务端、依赖或 UI 代码。

本批严格执行 `reverse-skill` 路由、PRIMARY `mobile-reverse`、既有离线 `work/sollin-ipa` scope/case-guard 与 IPA/APK gate。只复用 E-033→F-032→P-032 的现有 Sheet 结构证据，没有新增 Sollin 样本分析、采集或私人服务探测。实现使用官方匿名 HTTPS，把公开协议事实和 Sollin UI 事实分开记录。

## 实现

新增独立 `NeteasePublicComments`，继续使用原 `api/v1/resource/comments/R_SO_4_{song}` 原曲身份、热门/最新分区和20条服务页；不把 v2 评论列表替换进来，避免本批同时改变既有评论语义。根评论只在其确实从当前原曲响应加载后允许展开，缓存有界2048项。

楼层首屏使用 `time=-1`，后续只用上一成功页返回的 `time` 游标，20条上限；严格检查响应 code、`ownerComment` 根ID、每条 `parentCommentId`、根不能冒充回复、数组/计数/布尔/游标边界。失败不安装新游标，已有回复保留，重试请求同一游标。

v1 热门/最新通常不提供 `showFloorComment.replyCount`，而公开楼层实际存在。UI 因此显示“查看回复”，不伪造0或正数；只有平台明确给出数字时才显示“N条回复”。公开响应的后续楼层页可能在仍有回复时返回 `totalCount=0`，适配器保留首屏非零总数，不把它当成空页。页面实际返回少于声明总数时不补造缺失或已删除内容。

## 验证

`npm run check` 最终为 **948/948**；`node --check scripts/test-ui.mjs` 与 `git diff --check` 通过。新增契约覆盖未知/显式0计数、原曲/根绑定、首屏总数与后续0、页面结构、子回复归属、21条上限、空态、去重、时间游标重复、取消竞态、同游标重试及2048根缓存边界。

正式适配器直接通过有界公开 HTTPS 读取 Shape of You（`451703096`）的请求接收层：热门根 `281570024` 登记后，首屏实际返回20条回复、平台总数953、`hasMore=true`，20条均有公开头像描述；不据此宣称每张图片都可用。根评论、回复及时间游标保持有界十进制字符串/整数，不经过不安全浮点；任何缺字或缺失条目不补造。

| 阶段 | 结果 | 证明范围 |
| --- | --- | --- |
| 合成 Release | **3/0/0** | `SourceUITests-1793556791540.xcresult`；网易未知计数/引用/失败保留/相同`2000`游标重试/空态，咪咕和酷狗共享标签回归；151.552秒 |
| 真实 Release | **1/0/0** | `SourceUITests-1793557494234.xcresult`；正式 Shape of You 搜索→评论→热门根展开→真实回复及作者图片→收起→关闭不播放；38.961秒 |
| 真实失败 | 1 failure | `SourceUITests-1793557156046.xcresult`；错误搜索词实际返回另一《晴天》，绑定旧根导致未发起楼层请求；已改用生产搜索实测返回的 Shape of You 公共身份，不冒充产品缺陷 |

合成 manifest 的source digest为`e61236c9…`、安装bundle为`13c429ac…`、xcresult Info为`a34044a8…`；4PNG逐张 provenance ready并亲看联系表，服务器计数明确收到`-1,2000,2000,-1`、一次失败和一次空根。真实最终manifest `sourceUnchanged=true`、source `e897b291…`、bundle `3d855686…`、Info `bc2af8ac…`；2PNG逐张 provenance ready并亲看，真实热门回复和引用布局、作者图片、收起按钮及无播放状态可见。

场景和几何边界见[本批 UI 规格](ui-spec/netease-comment-replies-2026-11-02.md)。本批沿用 Sheet 的36pt/28pt头像、14pt嵌套线和至少44pt按钮，不做像素/动效完成声明。iOS 27、真实 iPhone、签名、弱网/限流、长楼层压力、QQ/酷我完整回复及账号写操作继续独立验收。
