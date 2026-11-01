# 酷狗公开评论：匿名官方 HTTPS 网关

2026-11-01。F31 新增酷狗匿名只读 adapter，原曲 hash、热门/最新、总数、日期/点赞计数和引用根评论复用正式 Sheet。合成与真实匿名 UI 已验证，不计 F31 或项目整体完成。

## 来源与请求边界

Q-music Android 固定 `5db858f32695d10c5e9ef0f7037d586aef6a8c4b` 的 `kg/comment.js`、`kg/util.js`、LICENSE/NOTICE 已逐字节匹配。采用公开请求参数/签名语义，沿既有 Apache-2.0、Nshpiter/LX/lyswhut 归属；不复制其静态设备标识、全局取消句柄、运行时、依赖或第三方链接中的代码。现有酷狗 API MIT 归属不被扩张成覆盖所有参考文件的许可声明。

参考直连评论域名 TLS 主机名校验失败；实测相同公开路由可经已有官方 `https://gateway.kugou.com` 与固定 `x-router: m.comment.service.kugou.com` 读取。保留标准证书校验和 ATS。`KugouPublicComments` 每请求生成临时随机 mid，使用现有 Expo Crypto MD5 签名；`kugouid=0`、`uuid=0`、空 token、`credentials: omit`，不读取账号/Cookie/播放 URL 或私人 metadata。

hash 从原曲 origin 的合法 hash/数值ID_hash 提取；metadata.hash 若存在须一致，不采用换源录音 hash。数值歌曲身份可绑定时严格核对回传 childrenid，并校验 current_page。服务会过滤部分行，所以 offset 按每页20推进而非显示条数。首屏并行热门/最新，任一错误保留错误语义；后续只读最新。新接口通过可选密码学依赖进入 PublicComments，正式 Services 注入现有 Crypto，独立评论会话保留同一依赖。

评论长 ID 不经不安全数值转换；日期读实测 Unix 秒字段 addtimestamp。正文、实体文字及有界 atlist 规范化为纯文本；pcontent/puser 作为所引用根评论展示，当前回复的正文、作者、时间和点赞保持归属。缺失根正文时不伪造引用；完整回复分页/写操作未实现。

## 已验证

- 类型检查与全量 912 项测试通过，0失败/跳过。新增6项覆盖签名/临时标识、原曲及回传身份、短页推进、长ID/日期/引用归属、错误/空态、取消、错误重试及非法来源拒绝。
- 生产 adapter 匿名读取：热门20、最新18，总数433734；第二页20，nextOffset20→40，合计38个不同ID。仅数量/字段统计留 `build/kugou-comments-protocol-20261101/adapter-summary.json`；没有提交昵称、正文或账号材料。
- 预先登记 [功能验收场景](ui-spec/kugou-comments-2026-11-01.md)；五平台合成 `SourceUITests-1793515510913` 为 5通过/0失败/0跳过：网易40.610秒、酷狗38.029秒、酷我37.772秒、咪咕37.651秒、QQ41.538秒。酷狗3张截图亲看且全部来源ready，长文本/根评论引用、重试追加与空态可读。
- 真实匿名入口 `SourceUITests-1793515901320` 为 1通过/0失败/0跳过、71.516秒；生产搜索与酷狗网关实际返回正总数、首屏热门、滚动后的最新分区及第二页追加。3张截图的来源/摘要 ready 并亲看，截图含真实公开昵称/正文且只留本机忽略目录。
- 清洁本地未签名 archive 成功，manifest 绑定基提交 `3a99b8f0ee38170f266496ddbcb80488934cb67e` 与本批 dirty KuGou 源码树，确认 `arm64`、`iphoneos26.2`、最低 iOS15.1、设备族 iPhone/iPad、生产 bundle 且不含 UI 测试 adapter。IPA 12,842,708 bytes，SHA-256 `c834c86106221dc90b42c4528b10e50e1f03a772d8ec846e5b6ba93a990eca4b`；实际 `codesign` 为 not signed，无 provisioning profile。
- 最新两组 xcresult、旧模拟器 DerivedData 与构建证据经逐文件 SHA-256/来源核验后迁至 T7，原路径保留 symlink；当前设备 DerivedData 留本机。清单与空间结果见[T7 回执](2026-11-01_t7-build-archive-receipt.md)。

## 证据与剩余范围

复用 E-033→F-032→P-032 评论 Sheet 固定头部、列表分区和刷新证据；mobile-reverse 原生路由、既有 IPA scope/case-guard/严格 review 通过，不重新 case-init，无新 Sollin 采集/运行或酷狗后端推断。原始证据保持，case 工作项/时间线随本批更新后再次审核。

五平台读取接线不等于 F31 整体关闭。全歌曲/导入身份矩阵、完整回复、真实弱网/限流、表情字形、账号评论/写操作、Android/实体机/签名/动效和云端终态分别待验，原 F/J 总范围保持。

## 复现

```bash
source scripts/environment.sh
npm run check
node scripts/sollin-reverse-gate.mjs ipa --review
node scripts/test-ui.mjs NexusMusicUITests/SourceSettingsTests/testPublicKugouComments
node scripts/test-ui.mjs NexusMusicUITests/SourceSettingsTests/testLiveKugouPublicComments
```

正常导航的合成与真实服务场景分开，每轮新目录、精确 xcresult、源码/原生/JS 摘要绑定；截图导出后逐张校验并亲看。真实用户内容只留本机忽略目录。
