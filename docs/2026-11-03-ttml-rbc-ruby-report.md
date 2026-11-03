# TTML `rbc` 多基础注音映射

## 范围

本批继续补齐 W3C TTML2 `tts:ruby` 的无歧义子集：标准 `<ruby><rbc>...</rbc><rtc>...</rtc></ruby>` 现在支持一个或多个 `<rb>` 与同数量 `<rt>` 按顺序一一配对。依据 W3C TTML2 的 [Ruby 内容模型](https://www.w3.org/TR/ttml2/#style-attribute-ruby)，基础容器只接受 `<rb>`，文字容器只接受 `<rt>` 与作为非权威回退的 `<rp>`；两个容器的有效项目数量必须相同。TTML2 对数量不一致时没有规定映射，本实现继续安全拒绝，不根据字符数、读音数量或版面位置猜测。

当前歌词模型每个 `LyricWord` 只有一个 `ruby` 槽，因此本批只增加“多组一基础一注解”的容器映射。双侧/并行多注音、第二个 `<rtc>`、跨行分配、行间或右侧位置、完整 TTML2 样式级联与复杂字体排版仍开放。

## 实现

`src/lyrics/ttml.ts` 在标准 `<ruby>` 分支持久化 `LyricWord.ruby`，没有新增第二歌词模型或渲染路径：

- 顶层 `<rbc>` 与 `<rtc>` 必须按该顺序各出现一次，容器之间只允许空白。
- `<rbc>` 必须包含非空 `<rb>` 序列；`<rtc>` 必须包含同数量 `<rt>`，并可含 `<rp>`。
- 每对基础与注解按顺序绑定；基础元素自带时间时优先使用，否则使用对应注解时间，再退回文字容器或 `<ruby>` 的上下文时间。
- 数量不等、空容器、顺序颠倒、容器外游离文字、额外 `<rtc>`、基础容器非 `<rb>` 项或注解容器非 `<rt>/<rp>` 项均拒绝并沿用歌曲来源回退。

正式 App fixture 在同一行同时保留 AMLL `kanji`、单注解 `rtc` `yin`，并新增 `<rbc><rb>多</rb><rb>基</rb></rbc><rtc><rt>duo</rt><rt>ji</rt></rtc>`。该场景一次经过 React 解析、`lyricSpokenText()`、`NativeLyricLine` inset 和 TextKit 手动上方绘制，没有测试专用渲染器。

## 验证

`npm run check` 为 993/993，0 失败、0 取消、0 跳过。新增契约测试覆盖两组基础/注解、基础时间优先、注解时间回退、`rp`、显式基础容器时间，以及数量不等、空基础、容器外文字、顺序颠倒、重复文字容器等拒绝矩阵。

完整 `npm run test:native` 退出码 0。日志 SHA-256 为 `540e9cd7efd1fa0d31c9c2db9725f26d7b70325f1354c26cab4a3c0ad623623e`；既有 `NativePlaybackEngine` Sendable 捕获与 `AmbientSceneTests` weak-variable 警告保持，不把警告写成已修复。

固定 provenance 的正式 Release 专项：

- xcresult：`build/SourceUITests-1793668070121.xcresult`
- 结果：1 passed / 0 failed / 0 skipped；`testAMLLProfileLyrics` 用时 171.097 秒
- 设备：iPhone 15 Pro Max Simulator，iOS 26.3.1 / build `23D8133`，x86_64
- 基线提交：`89acfcf5617c39fd11b678b39e65501e42eb1f2d`
- 运行前后源码一致：`sourceUnchanged=true`
- 源码 digest：`a6ff72393eb3059b3d74e4f9a052a7a61233d10f3104523aeca057d5a2ccac59`
- 工作区 diff SHA-256：`16345fb2613b65766303b0c57eb939f16c7edfb75d187e9cd41f8df5d9d5f1cb`
- fixture：`tests/e2e/entry.tsx`，SHA-256 `e8c113302a2723081025d836a846e82bf097f139ac8b31c3d2e8ed8c913dbaec`
- 安装 bundle digest：`9140b4882412f3969d260de5952a0109c29333b2647a06ac659c00a291c79262`
- `main.jsbundle`：`dfa9fe94737cd14f2823e89b704cbd59a8a685dddaa9cf54330f383a31a25d3b`
- xcresult Info SHA-256：`b06025a5710ce4c47cd522378dffdc68e102622c6c58407012c6d36ef8aeaf50`

证据目录为 `build/logs/ttml-rbc-20261103-r1/`：运行清单 SHA-256 `093ce324d7e13a1fd928e5c54be17b97872c26401d73a04059561bcaae3085fa`，UI 日志 `2eb5fcc4b3a741c8f24eef60c6b1b1f373304abd8de631cbd3590d2553b5d969`，摘要 `dca60df7c580cf1a96ff4f7c7d90b2310a6059557abb6a53fe2bfd7f0ce3914f`，服务计数 `d34750733322cf67773dd8117c65ad86c4de913f9fb8bbca933a479923006591`。4 张截图均来自同一 xcresult，索引 SHA-256 `0a9293e63a00e6b7fcb11d68bfc2940bfb97463d5a8daea69b91215c4cba03fc`；逐图 provenance 回执 `ready=true`，SHA-256 `ab527e2a9d59daa6523fae1cda540ff58f3c37235149f1df2cd1a07f955260f2`。

人工亲看的注音截图为 1290×2796：

`build/logs/ttml-rbc-20261103-r1/screenshots/003-AMLL,-rtc-and-rbc-annotations-rendered-above-base-text.png`

SHA-256 `704ad0be65ef53466e70ef560791cf486ad5ae52a80cf9a95909296ce91c5a7e`。截图确认 `kanji / yin / duo / ji` 分别位于 `漢字音多基` 对应基础上方，普通 `ruby tail` 保持非注音；XCTest 同时读到 `注音：kanji，yin，duo，ji`。

首次未指定固定运行目录的 Release 专项也通过，但因无法生成可核验的运行前后 provenance manifest，只保留为补充结果，不用于正式验收。正式结论来自上述全新固定目录重跑。

`node scripts/sollin-reverse-gate.mjs ipa --review` 通过既有固定离线证据，报告 56 Evidence / 21 WorkItems / 119 timeline / 47 Findings / 47 Paths、0 错误、0 警告；日志 SHA-256 `d3b0f34d3c1d9456e3cde9ae8efc2cf836fa772cfb1021929a5215deb586cd4b`。本批没有新增 Sollin 样本、目标运行、私有请求或反向结论，标准语义来自 W3C。

## 发布与归档

提交前 dirty IPA 为 17,833,688 字节、SHA-256 `dd757f9603f1934ca4055ae31c3e0160db5d4cbb94862a182300020626e219c9`。固定 UI 结果、archive、manifest、4PNG、日志、补丁和文档先复制至 T7 `2026-11-03-ttml-rbc-precommit-dd757f96`：139 份映射文件/99,665,574 字节逐项 SHA-256 一致，`transfer-receipt.json` SHA-256 `d688f14d573885a0bcba49253645e10db8568f1257731603bf8c9d240d1c36bf`，源证据保留且 `deleted=0/movedUserFiles=0`。

产品/测试/初始文档提交 `5a23db3dccffd0d4e0e7c932c477e2c1cb7d109a` 已正常 push 并实核远端 `main`。clean manifest 与 HEAD 一致、`dirty=false`/`workingTreeChanges=[]`、arm64/iphoneos26.2/iOS15.1/[1,2]、`signed=false`，SHA-256 `1d7e470fb3a7c6d63e4884d7e786198f1ca00e80c3feffef3fa64749751548f1`；clean IPA 为 17,833,688 字节、SHA-256 `fc3f204e4841338152ed854e00935e1be840b780d71e596d3b9f0756b8f55acb`。

独立核验回执 `build/logs/ttml-rbc-clean-5a23db3/archive-verification-clean.json` 为 `passed=true`、SHA-256 `0be610654ae1fc5941f85e49c9c5495fa3820940699984e860a556692c6186e8`：178 项 ZIP CRC、151 项 archive/IPA 载荷逐字节一致；生产 `rubyInset` 与本批 `rbc` 拒绝标记存在；UI 测试入口、私人夹具、描述文件与签名材料均排除。archive 日志 SHA-256 为 `820e57578d84e18840aa9e0b202722a9fa6c25d607d4db31616fdcac706966b7`。

clean T7 阶段 `2026-11-03-ttml-rbc-5a23db3` 保存精确 IPA、archive、xcresult、截图、日志、提交补丁和提交源码；141 份映射文件/104,372,180 字节逐项 SHA-256 一致，`SHA256SUMS` SHA-256 `f043ca003d81b7cf85faac511f848a068360cce2894ee43b5ac0f666ecfe6612`、复核 0 失败，`transfer-receipt.json` SHA-256 `bbfd27e9fc3ec2ada6149b3246d8a3dd6e061164f180b3ac3f1b63592c21d35c`。源证据保留且 `deleted=0/movedUserFiles=0`。

push 后 `41553030339`/`295bf94` 继续运行，`41559631207`/`5a23db3` 为唯一 pending；旧 pending 由 `queue:single` 自动取消，实核 1 运行/1 排队且未手动取消或重派。任何 iOS 26.3.1 模拟器、合成歌词或 unsigned IPA 结果都不替代实体 iPhone VoiceOver、真实歌词库、动态字号/小屏、签名/安装或 iOS 27 Actions 终态验收。
