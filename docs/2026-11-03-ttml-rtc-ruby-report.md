# TTML 标准 `rtc` 单注解注音

## 范围

本批把标准 TTML2 中无歧义的 `rtc` 分组子集接入现有 `LyricWord.ruby` 与原生上方注音绘制。实现依据 W3C TTML2 的 [10.2.35 `tts:ruby`](https://www.w3.org/TR/ttml2/#style-attribute-ruby) 内容模型：`ruby` 可以由一个基础文本单元与一个 `rtc` 注音容器组成，`rtc` 包含一个或多个 `rt`，并可用 `rp` 作为阅读回退分隔符。

当前歌词模型每个基础单元只有一个注音槽，因此只接受：

- 一个连续基础，来源为 `ruby` 下的直接文字或唯一一个 `rb`/基础子元素。
- 一个 `rtc`，其中恰有一个 `rt`；`rp` 可出现在分组内外并被忽略。
- 时间可来自 `ruby`、`rtc` 或 `rt`，继续沿用标准 TTML 的嵌套相对时间。

以下歧义或超出现有模型的结构安全拒绝并沿用歌词来源回退：缺少基础、空分组、多个 `rtc`、`rtc` 内多个 `rt`、直接 `rt` 与 `rtc` 混用、`rtc` 前有多个基础元素、分组之后还有歌词文字，以及 `rtc` 内出现非 `rt`/`rp` 子元素。没有根据注释数量猜测对齐关系。

本批继续限制在基础文字上方的单行注音。未实现双侧注音、`rbc` 多基础映射、多个注音内容、跨行/wrapping ruby、行间/右侧位置、完整 TTML2 样式级联或真实字体排版。

## 实现

`src/lyrics/ttml.ts` 扩展标准 `<ruby>` 分支：直接 `rt` 路径保持不变；遇到 `rtc` 时先校验单一基础载体，再解析容器时间、唯一 `rt` 与可选 `rp`，最后复用既有 `addText(..., ruby)`，因此可见演唱文字、无障碍标签、逐字时间和原生 TextKit 绘制没有新增分叉。

`tests/lyrics.test.ts` 新增两组形态：`rb` 加带外/内 `rp` 的 `rtc`，以及直接文字加 `rtc`；三层时间分别落在 `ruby`、`rtc` 与 `rt` 上，验证标准相对时间逐级累积。基础仅含空白时拒绝；注解沿用叶子节点的 `space` 保留语义。畸形矩阵覆盖空分组、顺序颠倒、多注解、分组后游离文字、直接/分组混用和纯空白基础。

正式 App fixture 在同一 AMLL 歌词行保留原 `kanji` 注音，并新增标准 `<rb>音</rb><rtc><rt>yin</rt></rtc>`。这使一次纵向用例同时经过 AMLL 容器、标准 `rtc`、同一可访问标签和同一原生绘制路径。

## 验证

`npm run check` 为 992/992，0 失败、0 取消、0 跳过。完整 `npm run test:native` 退出码 0，覆盖原生播放、缓存、系统媒体、WebDAV、脚本运行时、视觉资产、动态背景与音频导出；日志仍包含既有 `NativePlaybackEngine` Sendable 捕获和 `AmbientSceneTests` weak-variable 警告，本批没有新增失败，也没有把这些历史警告写成已修复。

正式 Release `SourceSettingsTests/testAMLLProfileLyrics()`：

- xcresult：`build/SourceUITests-1793664862752.xcresult`
- 结果：1 passed / 0 failed / 0 skipped；`resultInfoSha256=3eb51c0c59294d2a6746e39ddcfc32dd7a311951903120948097edc1caec3d4f`
- 专项时长：172.649 秒
- 环境：iPhone 15 Pro Max Simulator，iOS 26.3.1 / build `23D8133`
- 提交：`b9ddc87a9fcb58df8b817ab3711dcbc44427b0b8`
- 工作区 diff SHA-256：`3c3658f9648153c354db2148c4ed18425fde8c956ec3d1960134502894b82018`
- `sourceUnchanged=true`
- 安装 bundle digest：`1f8776bf82fb84d60567c1fe9b1f75c8f9f29c1299fa26b278f51f0dce7e13ee`
- fixture 计数：`wy=2`、`tx=4`、`ttmlAmll=2`

首次调用退出 70 且 0/0，完整日志确认测试脚本把 `-only-testing:` 前缀重复添加，xcodebuild 因目标名不成立而没有执行任何用例。该失败原件 `build/SourceUITests-1793663944474.xcresult` 保留；用脚本要求的裸 target 参数重跑的上述结果才计入通过。

截图 `build/ttml-rtc-final-1793664862/001-AMLL-and-standard-rtc-annotations-rendered-above-base-text.png` 为 1290×2796，SHA-256 `d922389546610523a2bc82275fa1e1716b23522cc495e2731276c221860a028d`。人工亲看确认 `kanji` 位于“漢字”上方、`yin` 位于“音”上方，“ruby tail”保持普通文字；XCTest 同时读到 `注音：kanji，yin` 的既有行级可访问标签。

固定运行证据在 `build/ttml-rtc-evidence-1793664862/`：`ui-catalog.log` SHA-256 `f54976c53932fad40e96c81cc055098aab8fe4aab69358075b877f99d687c8bf`、`run-manifest.json` `08e7eeb401aa6e69afc1ef951ea879b6d927bdd6029474a4607ab813eb01078f`、`ui-summary.json` `fe5436ff6f4f7f76f53a9857248b6f803dc9de07185282d1430164ec5a31a68d`、`ui-server-counts.json` `d34750733322cf67773dd8117c65ad86c4de913f9fb8bbca933a479923006591`；完整 native 日志 SHA-256 `540e9cd7efd1fa0d31c9c2db9725f26d7b70325f1354c26cab4a3c0ad623623e`。

## 发布与归档

产品/测试/初始文档提交为 `295bf94e50a8583d463d15b70a3610dbddd4610e`，已正常 push 并实核 `origin/main` 一致。提交前 dirty IPA 为 17,832,598 字节、SHA-256 `0e0707de79796b05007eb0ff5d68a771d7a654d599f17d4cf1af4d6f03d3bcb4`，manifest SHA-256 `1399d03090f9e8d27e2107c56b7acb363bd4ab2dc19e95a04a1c5886e24f12b6`；IPA/archive/manifest 及诊断已复制至 T7 `2026-11-03-ttml-rtc-precommit-b9ddc87`，67个文件逐项校验通过。dirty 独立验证回执 `ready=true`，SHA-256 `0e34c845cbbd87c636cbacc4a6eced16563452a46ae888e8e54020dfd0b68213`。

提交后从 clean 工作区重新生成 archive。`build-manifest.json` 与 HEAD 一致、`dirty=false`、`workingTreeChanges=[]`，SHA-256 `636c4502ddbe59848858f368b89b85732b14de2fcf25b3b675194adbeb3da68a`；arm64、`iphoneos26.2`、最低 iOS 15.1、设备族 `[1,2]`，`signed=false` 且无描述文件或顶层签名。clean IPA 为 17,832,598 字节、SHA-256 `f9ab39c6ee03f3b5920ad9f6b4143dab7a95fc08d062190bef990eee621139de`；archive log SHA-256 `c7b76f141c7e5fb90d663111d127c57dec1c719a38c0c38a6da4bdfaf00a3d31`。

独立验证回执 `build/logs/ttml-rtc-clean-archive-verification-295bf94.json` 为 `ready=true`，SHA-256 `912379f4a05bb0c1da57242a125717028791c012ab278d21be4c9f7eee2f4932`。其中178项 ZIP 全部通过 CRC；151项 archive/IPA payload、39,522,298字节逐项一致；生产 `rubyInset` 标记存在；测试标记/测试路径、私人材料、描述文件和签名材料的禁止项均为空。`node scripts/sollin-reverse-gate.mjs ipa --review` 为 PASS，56 Evidence / 21 WorkItems / 119 timeline / 47 Findings / 47 Paths、0错误/0警告，日志 SHA-256 `eb3299bd08ec8dbbe3796a5723a9e9314e83c4e0f9efad77db9b90af46e80faa`。

push 后初始实核为：`41521043387`/`9fb541a` 继续运行，`41553030339`/`295bf94` 为唯一 pending；旧 pending `41548304374`/`2310103` 由 `queue:single` 自动取消。队列为1运行/1排队，未手动取消或重派。最终 clean 阶段目录将在 Actions 快照和文档提交后于 T7 固化。

## 边界

该结果是 iOS 26.3.1 模拟器上的合成歌词验证。实体 iPhone、实际 VoiceOver 发音、动态字号/小屏、真实歌词库、复杂字体、连续动效、签名/安装/续签及 iOS 27 Actions 终态继续开放。本批没有新增 Sollin 样本、目标运行时观察、私有请求或参考视觉语义，不提高完整 TTML2、S4/J35–42、F/J 或项目总完成度。
