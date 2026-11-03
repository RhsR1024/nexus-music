# TTML 双侧注音增量回执

## 范围

本批继续补齐 W3C TTML2 `tts:ruby` 的无歧义子集：同一个基础文字现在可以分别携带 `before` 与 `after` 两个注音位置。AMLL 容器允许一个基础加一至两个文字容器；标准 `<ruby><rbc>…</rbc><rtc>…</rtc></ruby>` 允许一个基础轨道加一至两个文字轨道。只有两个位置明确且唯一为 `before`/`after` 时才同时接受，既有单一注音默认仍在基础文字上方。

本批只扩展当前歌词模型的第二个注音槽，不实现跨行分配、完整 TTML2 样式级联、行间/右侧排版或真实词库矩阵。`before` 对应既有上方注音，`after` 对应基础文字下方注音。

## 实现

`LyricWord` 新增可选 `rubyAfter`，既有 `ruby` 继续表示上方注音。解析器复用同一条歌词行和单词时间线，不新增第二歌词模型。位置属性只接受 `tts:rubyPosition="before"` 或 `"after"`。

AMLL 路径要求一个 `base` 与一至两个 `textContainer`，每个文字容器内恰有一个 `text`。两个文字容器的位置必须明确、唯一且互补；容器、文字节点和层级冲突会被拒绝。单注解且未声明位置时保持原有上方行为。

标准路径要求一个 `rbc` 加一至两个 `rtc`，基础与各轨注解数量相等并按序绑定。两个 `rtc` 必须分别声明唯一的 `before` 与 `after`。直接 `ruby/rb/rt` 路径也接受单个显式位置。数量不等、空容器、重复或缺失位置、未知位置、同层冲突、混用、额外轨道、非法子项和游离文字均安全拒绝，并沿用来源歌词回退。

无障碍文本按单词顺序合并 `ruby` 与 `rubyAfter` 并去重。非当前歌词行只要存在任一注音字段就继续停车逐字动画。React 为上下注音分别预留空间；Swift TextKit 将 `before` 画在基础文字上方，将 `after` 画在下方，颜色、字体和活动态继续复用原歌词行。

## 协议与边界

位置语义依据 W3C TTML2 的 [`tts:rubyPosition`](https://www.w3.org/TR/ttml2/#style-attribute-rubyPosition)，不是从 Sollin 私有行为推导。当前没有新增 Sollin 样本、目标运行、私有请求或凭据访问，也没有把包内模板扩展成服务探测或全局客户端配置。

## 验证

聚焦歌词契约测试 27/27 通过，覆盖 AMLL 双文字容器、标准双 `rtc`、直接相邻双 `ruby`、仅 `after`、时间回退，以及重复、缺失、未知、冲突和数量不匹配等拒绝矩阵。

- `npm run check`：995/995，0 失败、0 取消、0 跳过
- TypeScript 类型检查：通过
- 完整 `npm run test:native`：退出码 0
- `node --check scripts/test-ui.mjs`：通过
- Swift 语法检查、`git diff --check`：通过
- 已知 `NativePlaybackEngine` Sendable 与 `AmbientSceneTests` weak-variable 警告保持，不写成已修复

固定 provenance 的正式 Release 专项：

- xcresult：`build/SourceUITests-1793670038024.xcresult`
- 结果：1 passed / 0 failed / 0 skipped
- 摘要运行总时长：345.561 秒
- 设备：iPhone 15 Pro Max Simulator，iOS 26.3.1 / build `23D8133`，x86_64
- 基线提交：`1c36799b3b1836d29f49d61e0ec023b5fe125276`
- 运行前后源码一致：`sourceUnchanged=true`
- 源码 digest：`364503cdd2c42dbb7991e86a8ae010dea4b5fcd459a008791ccb44042b9b03e9`
- 工作区 diff SHA-256：`a7019db2e234599dc302e717733a2c4e128bb45acebcf5d26c9452bdb3866150`
- fixture：`tests/e2e/entry.tsx`，SHA-256 `e8c113302a2723081025d836a846e82bf097f139ac8b31c3d2e8ed8c913dbaec`
- 安装 bundle digest：`bb64941d3d536671b1ac5b8f8ddfa209054061c5dece03a1259427155591f318`
- xcresult Info SHA-256：`e4a6787825d2c55967ea9d8e249fa02a5e60bd1352628d2cb7373857e95b4a8e`

运行清单 SHA-256 为 `5ec34b9252bc04e5e98dd23cdc0135b4c7c6e9f625fba8b5ad7898452f410fb0`，UI 摘要为 `6cee23550c241e8d94adb8af208c70f9548b07d459a93cf8c9b0a84e866485a4`，服务计数为 `d34750733322cf67773dd8117c65ad86c4de913f9fb8bbca933a479923006591`，UI catalog 为 `1c76f1c28c99cd23c1acdf2d98b2b19bb92243a1c5624486f29f290a1571d4cd`。服务计数记录 `ttmlAmll=2`、`authFailures=0`。

4 张截图均来自同一 xcresult，位于 `build/ui-evidence/ttml-double-sided-20261103-r1/`，索引 SHA-256 `1cd7f0ff11384404e25409671f0ff6fef0380114b0b76eaa2a8b4f21b7d41255`。人工亲看的 1290×2796 截图为：

`build/ui-evidence/ttml-double-sided-20261103-r1/003-AMLL,-rtc,-rbc-and-double-sided-annotations-rendered-around-base-text.png`

SHA-256 `894a427f91bf92b241dda65f7b044347e5696f93b455283782c3038b33430e64`。截图确认 `kanji / yin / duo / ji / shuang` 分列位于 `漢字音多基双` 上方，`sou` 居中位于 `双` 下方，普通 `ruby tail` 保持原文字；XCTest 同时读到 `注音：kanji，yin，duo，ji，shuang，sou`。

`node scripts/sollin-reverse-gate.mjs ipa --review` 再次 PASS，复用固定离线证据，报告 56 Evidence / 21 WorkItems / 119 timeline / 47 Findings / 47 Paths、0 错误、0 警告；日志 SHA-256 `2cf912b6edd1d28e4c156dc611c0286aba00cad9dc958dce0256c13ba814d043`。

## 预提交归档

提交前 dirty unsigned archive 成功：

- IPA：17,837,222 字节，SHA-256 `2999cd1e4f604147de635bfda9eedbfc6ef2c65e6b3e80ed4da24415fde3f04e`
- manifest SHA-256：`2f26d38325c2e7a93d14769ed874b533d5e3fdb8e8b25658e72db08037166ef1`
- archive log SHA-256：`1ec4a8ebd6a040a646ddef5f2f0230ff73121b66be446b91c07ef5bb21a7ed44`
- native log SHA-256：`540e9cd7efd1fa0d31c9c2db9725f26d7b70325f1354c26cab4a3c0ad623623e`
- 独立 dirty 核验回执 SHA-256：`b54f4efa670bfb0e83a9bfb97f9ca842cf0cdba69942353a89acab6185e210ed`
- 178 项 ZIP CRC 全通过；151 项 archive/IPA 载荷逐字节一致；arm64、`iphoneos26.2`、最低 iOS 15.1、设备族 `[1,2]`
- 生产 `rubyAfter`、`rubyPosition`、`rubyAfterInset`、`rubyInset` 标记存在；私有夹具、UI 测试入口、源码映射、描述文件与签名材料排除

已复制至 T7：

`/Volumes/T7 Touch/NexusMusic/BuildArchive/2026-11-03-ttml-double-sided-precommit-2999cd1e`

136 份普通文件、100,950,204 字节，缺失/额外/差异均为 0。`SHA256SUMS` SHA-256 为 `ecc7da277355cd7eea69a3affffed2150a5b7d60a336296eff50a36c5c74c161`，`transfer-receipt.json` SHA-256 为 `1217ae7531221e6602d4d58f8c96788ff4ed851818194181ae53f597b8839ad9`；源证据保留，`deleted=0`、`movedUserFiles=0`、活动构建 0。

## 发布与归档

产品/测试/初始文档提交 `235d0d816198ead00567ea12b9af62d47d2b5198` 已正常 push，`git ls-remote` 实核远端 `main` 与本地 HEAD 一致。随后从 clean HEAD 重建 unsigned archive：

- manifest：commit 与 HEAD 一致、`dirty=false`、`workingTreeChanges=[]`
- IPA：17,837,222 字节、SHA-256 `c6a8def1a566eb5438f5b7665496a8575c9b2ad1ec25dafd606b011ba546eb6e`
- manifest SHA-256：`1be5a055d8879e28fa29580d4bf78c4aa29c1f110063924ec2d4ed7db17a209a`
- clean archive log SHA-256：`2b9d35ae23826d489adc0acc66826b9f92b9a410dfbbb6c7d489d26c50377a78`
- 独立 clean 核验回执 SHA-256：`19142a543f4f22af784092c172eb7bccb18177acb969106369958b78e33a946e`
- `passed=true`：178 项 ZIP CRC、151 项 archive/IPA 载荷逐字节一致
- arm64、`iphoneos26.2`、最低 iOS 15.1、设备族 `[1,2]`、`signed=false`
- 生产 `rubyAfter`、`rubyPosition`、`rubyAfterInset`、`rubyInset` 标记存在；没有描述文件、顶层签名、UI 测试入口、私人夹具或私人资源路径

push 后立即从 Actions 页面内嵌数据实核：

- `41553030339` / `295bf94`：正在运行
- `41563617753` / `235d0d8`：唯一 pending
- `41559631207` / `5a23db3`：由 `queue:single` 自动取消
- 当前为 1 运行 / 1 排队；没有手动取消、重派旧版本或 force push

最终版文档提交后建立 clean T7 阶段，保存精确 clean IPA、archive、xcresult、截图、日志、提交源码与文档，并生成逐文件 SHA-256、`SHA256SUMS` 与 transfer receipt。阶段创建不删除或搬移源证据。

模拟器截图、合成歌词和 unsigned archive 不替代实体 iPhone VoiceOver、真实歌词库、动态字号/小屏、签名/安装/续签或 iOS 27 Actions 终态验收。
