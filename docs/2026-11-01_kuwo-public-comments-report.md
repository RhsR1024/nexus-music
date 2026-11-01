# 酷我公开评论：HTTPS 与独立热门读取

2026-11-01。本批为 F31 的酷我匿名只读切片，复用正式评论 Sheet。代码、四平台合成回归和真实酷我 UI 已验证，不计 F31 或项目整体完成。

## 协议与边界

参考 Q-music Android 固定 `5db858f32695d10c5e9ef0f7037d586aef6a8c4b` 的 `kw/comment.js`，逐字节匹配 Git 对象；沿既有 Apache-2.0、Nshpiter/LX/lyswhut 归属，不复制 Android 依赖、全局取消句柄或商业逻辑。参考旧 HTTP 地址经匿名实测确认 HTTPS 可用，未修改 ATS。

`KuwoPublicComments` 只读取酷我原曲数值 ID，固定 HTTPS、`credentials: omit`、匿名 `uid=0`。首屏分别读取最新与热门，两个总数独立，显示最新评论总数；后续页只读取最新。采用并严格校验响应 `offset`，不把实际返回条数强当服务端偏移。评论 ID 保留长整数字符串，日期由 Unix 秒转换，文本/计数/数组有界；子评论仅显示首条可展示回复预览。

两首屏读取任一失败均保留错误语义，不悄悄当空热门。分页及刷新失败保留已显示内容，重试原 start；取消和切歌迟到结果由既有会话隔离。所有请求不读取账号/私有 metadata，播放换源不影响评论原曲身份。点赞数只读，不包含点赞/发评写入或完整回复分页。

## 已验证

- `npm run check`：类型检查及 906 项测试通过，0 失败/跳过。新增 6 项覆盖匿名请求、独立总数、长 ID、日期/回复、服务端偏移、错误/重试/取消及非法身份拒绝。
- 生产适配器匿名样本：首屏最新 20、热门 20，最新评论总数 23674；第二页最新 20，offset 从 20 到 40，合计 40 条无重复，热门首屏含回复预览。仅数量/字段摘要保存在 `build/kuwo-comments-protocol-20261101/summary.json`，未保存昵称与正文。
- 功能场景先登记于 [验收规格](ui-spec/kuwo-comments-2026-11-01.md)，四平台合成回归 `SourceUITests-1793514523786` 为 4 通过、0 失败/跳过：网易 39.383 秒、酷我 37.692 秒、咪咕 37.450 秒、QQ 40.905 秒。酷我 3 张截图已亲看，长文本/回复、重试追加及空态无可见遮挡，全部来源校验 ready；最终真实服务 UI `SourceUITests-1793514870319` 为 1 通过、0 失败/跳过，87.994 秒。正常中文搜索进入酷我原曲菜单，热门/实际可见最新分区、第二页追加和关闭无播放副作用通过。A/B 共 6PNG 亲看且全部来源 ready，源码前后摘要均一致。环境为 Release、iPhone15ProMax 模拟器 iOS26.3.1/23D8133。

## Sollin 证据和待验项

评论 Sheet 复用 E-033 → F-032 → P-032 的固定头部、分区与刷新语义；本轮路由 mobile-reverse，既有 IPA scope/case-guard/严格哈希 review 通过，无新增 Sollin 采集或接口推断。case 工作项/时间线已更新，严格 review 为 52E/17WI/105事件/43F/43P，0 错误/警告；原始证据保持。

真实画面正文与回复可读；部分标准表情字形仍显示缺字，未替换用户原文或称全字符展示通过。仍需独立验证完整回复、真实弱网/限流、全部歌曲/导入身份矩阵、标准表情字形、实体机/签名/动效与云端终态。酷狗直连域名证书不匹配仍保留，但已有官方 HTTPS 网关的匿名公开路由初步可用，尚未接入，不据样本响应记完成。原 F/J 总范围保持。

## 复现

```bash
source scripts/environment.sh
npm run check
node scripts/sollin-reverse-gate.mjs ipa --review
node scripts/test-ui.mjs NexusMusicUITests/SourceSettingsTests/testPublicKuwoComments
node scripts/test-ui.mjs NexusMusicUITests/SourceSettingsTests/testLiveKuwoPublicComments
```

每轮以新目录和精确 xcresult 绑定源码/原生/JS 包，导出截图后校验并亲看。真实评论内容只留本机忽略目录，不提交仓库。

## 交付回执

功能提交 `d1a70cbff6ffd343f898689196611b6c1bbd81c7` 已正常 push 到 `RhsR1024/nexus-music` main，远端 SHA 一致。CI `41281715592` pending，QQ `41278846667` 仍运行，实核 1运行/1排队；旧咪咕 `41280665387` 由 single 策略自动取消，不计云端成功。未取消运行中任务或重派旧版。下一继续酷狗官方网关适配；其匿名两页最新实际 18/20、合计38个不同 ID，热门20，只是本机协议预检，不当产品接入证明。项目总目标保持 active。
