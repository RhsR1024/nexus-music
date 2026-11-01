# 咪咕公开评论接线与会话游标隔离

2026-11-01。F31 新增咪咕匿名只读适配：热门、最新、总数、日期、点赞计数、长文本及首条可展示回复复用正式评论 Sheet。本批代码、三平台合成回归与咪咕真实公开服务 UI 已验证，不计 F31 或项目整体完成。

## 来源与实现边界

协议参考 Q-music Android 固定提交 `5db858f32695d10c5e9ef0f7037d586aef6a8c4b` 的 `mg/comment.js`、`mg/songId.js`；文件与 LICENSE/NOTICE 已逐字节匹配 Git 对象，保留现有 Apache-2.0、Nshpiter/LX/lyswhut 归属。没有复制模块级取消句柄、全局页码游标、依赖、资产或 Android 原生实现。

`MiguPublicComments` 仅接受原曲为咪咕且具有数值歌曲资源 ID 的在线 Track。请求固定 HTTPS、`credentials: omit`、不读取账号、播放 URL 或私有 metadata。首屏由 `queryType=1` 同时取得热门/最新；下一页使用上一页末原始评论 ID，按原始返回行数推进偏移，展示层按评论 ID 去重。热门仅在首屏展示。

`CommentSession` 为每个 UI 会话创建独立读取器，同曲并行会话不互相覆盖游标。刷新成功后替换本曲游标，失败保留旧列表与游标，取消后迟到响应不写缓存。请求、评论数组、文本及内存缓存均有界；错误与明确零条分开处理。咪咕返回无时区的日期按中国标准时间转换，非法日期不显示。

回复为根评论下首条可展示的回复预览，不声称完整回复展开或回复分页。仅有版权 ID、缺少可验证歌曲资源 ID 的旧导入项尚未接资源解析，不用媒体解析请求替代身份核验。点赞数只读，不包含点赞/发评写操作。

## 验证事实

- `npm run check`：类型检查通过，900 项通过，0 失败/跳过；日志 `build/migu-comments-check-final-20261101.log`。
- 新增 6 项协议测试，包括匿名请求、热门/最新、回复/日期、按歌曲及按会话隔离游标、畸形/空态/取消。既有评论会话测试保持。
- 生产适配器匿名读取公开歌曲：首屏热门 5、最新 20、总数 311，第二页最新 20、热门 0，合计 40 条 ID 无重复。摘要 `build/migu-comments-protocol-20261101/summary.json` 仅保存数量/字段统计，不保存昵称或正文。
- 初步合成 UI 专项 `SourceUITests-1793513185492`：1 通过、0 失败/跳过；用例 42.54 秒。因运行中追加会话隔离修正，此轮只作诊断，不作最终源码来源证明。最终合并回归与真实服务结果见下。
- 固定源码合成合并回归 `SourceUITests-1793513436485`：网易 42.150 秒、咪咕 39.350 秒、QQ 41.786 秒，3 通过、0 失败/跳过。运行前后源码摘要相同；咪咕 3 张导出图已亲看，长文本/回复、分页追加与空态可读，固定头部及操作无可见遮挡。
- 来源工具复核发现既有 `verifyCaptureEvidence` 将 `-skip-testing:.../testVisualLabClassicReferenceDirect` 误当参考采集，从而错误要求外部素材。新增用例在旧实现失败，修正为仅识别 `-only-testing:` 后 7 项来源工具测试通过。所有原始 manifest、截图和结果包保持；修正工具重验 B/C 共 6 张截图均 ready，无哈希绕过。
- 首次真实服务 UI `SourceUITests-1793513630761` 为 1 通过、0 失败/跳过，58.790 秒；真实热门/回复/总数 311 及第二页追加已见。但名为 latest 的截图仍停热门区，原断言只检查标题存在于无障碍树，不作为分区可见证明。D 要求标题实际可见后重新采样，C 保留为诊断。

- 最终真实服务 UI `SourceUITests-1793513877211`：1 通过、0 失败/跳过，57.904 秒。正常搜索 → 咪咕 → 歌曲菜单 → 评论；热门、总数 311、实际滚动可见的最新分区与第二页追加通过，关闭未触发播放。D 三图已亲看且全部来源校验 ready。
- 环境为 iPhone 15 Pro Max 模拟器、iOS 26.3.1 / 23D8133、Release；B/D 各自源码前后摘要一致。D 在 B 后仅修改真实专项的可见性断言与来源工具/测试，生产 `src/` 未改变；无需用旧截图冒充新产品代码。
- 真实画面部分标准 Unicode 表情显示缺字方框，返回值为常规 Unicode 码点，未擅自替换原文。表情字形/字体兼容性保留待验，不声称全字符展示通过。真实昵称与正文截图只在本机忽略目录。

## Sollin 证据与未验项

评论 Sheet 复用 E-033 → F-032 → P-032（`show0x3302ec`、`build0x458b04` 的固定头部/分区列表与刷新语义）。本轮原生路由为 mobile-reverse；既有 `work/sollin-ipa` scope/case-guard 与严格哈希审核通过：52 Evidence、17 工作项、104 事件、43 Findings、43 Paths，0 错误/警告。未重新 case-init，未新增 Sollin 采集或推断其咪咕接口。

酷我 HTTPS 评论样本返回明确零条，仍未接入；酷狗参考评论域名 TLS 主机名校验失败，保留未接入，不关闭证书校验或扩大全局 ATS。真实弱网/限流、版权 ID 解析、完整回复、其他来源、Android/实体机/签名/动效及云端终态继续独立验收。

## 复现

```bash
source scripts/environment.sh
npm run check
node scripts/sollin-reverse-gate.mjs ipa --review
node scripts/test-ui.mjs NexusMusicUITests/SourceSettingsTests/testPublicMiguComments
node scripts/test-ui.mjs NexusMusicUITests/SourceSettingsTests/testLiveMiguPublicComments
```

合成协议场景与真实服务场景分别运行，使用新输出目录及精确 xcresult 绑定源码。真实评论内容只留本机忽略目录，不提交仓库。

## 交付回执

功能提交 `f980513cbb65aa215e89ac5c5f2a592256920113` 已正常 push 至 `RhsR1024/nexus-music` 的 main，远端完整 SHA 一致。CI `41280665387` 排队，前一 QQ 评论 `41278846667` 运行中；实际 1 运行/1 排队，未取消或重派。上一歌曲分享 `41265859952` 已 success，不作为本提交云端通过证据。项目总目标仍 active，后续继续 F31 可用平台与原 F/J 依赖满足项。
