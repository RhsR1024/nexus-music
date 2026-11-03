# 注音基础范围换行保护回执

2026-11-03。本批修复音枢自身TextKit布局缺陷：大字号下基础组“到尾”被拆为两行，而`ed`仍位于第一行。只保护带注音的基础范围，未实现任意跨行注音重分配、竖排/右侧注音或完整TTML2。

## 实现与边界

`LyricRubyLayout.protect`在带注音范围内部的组合字素边界插入U+2060 WORD JOINER。`ProtectedText`将来源UTF-16范围映射到TextKit字符串，单词高亮和上下两侧注音使用同一映射；`withBase`宽度和Aurora可见字素计数忽略新插入的连接符。JS歌词、演唱文字、无障碍标签与时间不变，稀疏cue路径因无注音保持原样；没有第二播放器、第二时间线或逐帧React列表。

布局委托禁止断词的初始方案未能阻止CJK拆行，已移除。原错误截图`build/ui-evidence/ttml-ruby-align-20261103-xxxl-r3/A4ABA5D6-590A-4BD2-8F2C-FEBDF1418F60.png`的SHA-256为`f4e33424629df41a9914205235e1eacc7a000dda52d6616e354e1ba115256690`，保留且不记通过。超出可用行宽的长基础范围、任意换行重排、复杂真实歌词库与实体VoiceOver仍待验。

## 验证与来源

- `npm run check`997/997、0失败；完整native退出0；Release `ios:build`成功，diff检查通过。
- AppKit TextKit测试先证明普通“到尾”会被拆开，再证明保护后的同组在同一行；覆盖重叠/非法范围与字素计数。该单测不冒充UIKit或实体机结果。
- xxxl正式Release：`SourceUITests-1793689134708.xcresult`，1通过/0失败/0跳过，338.476秒，`sourceUnchanged=true`。截图`build/ui-evidence/ttml-ruby-wrap-20261103-xxxl-r1/001-AMLL,-double-sided-and-aligned-ruby-at-accessibility-XXXL.png`，1290×2796，SHA-256`e8b4e49443c00f80e02e11e1a5a2341cc3869792833fd9881dd2324694660592`。
- normal正式Release：`SourceUITests-1793689484355.xcresult`，1通过/0失败/0跳过，310.694秒，`sourceUnchanged=true`。截图`build/ui-evidence/ttml-ruby-wrap-20261103-normal-r1/001-AMLL,-rtc,-rbc,-double-sided-and-aligned-annotations-rendered-around-base-text.png`，1290×2796，SHA-256`9f63ae9f7df3478fa28a4fd796ec7f4ef36eeb0d0f4e8d72e32aa5cb1f9db8fe`。

两轮源码digest`8217f67261b742ada89cef3b2b1acb46f2fb6ca0b506d41b24d2fbd7861f140a`、安装bundle digest`8d344b7c8d0d2ddf9e97ace27a8aada8d3db41b0340f4ee0be6070d201dbaac0`相同，fixture SHA-256`564e821a7703ba8ea6a011ae6df6668c8df6a91b9d0ca0840f3ee215d812c709`。人工亲看XXXL的“到尾”同一行且`ed`在其上方，`st/md/ed`保持左右/中心对齐；正常字号`kanji/yin/duo/ji/shuang`及下侧`sou`完整。UI规格见[本批场景](ui-spec/ttml-ruby-wrap-2026-11-03.md)。

## 离线证据与隐私

既有离线`ipa --review`结果56 Evidence/21 WorkItems/121 timeline/47 Findings/47 Paths、0错误/0警告，日志`build/logs/ttml-ruby-wrap-ipa-review-20261103.log`，SHA-256`8e062af2215cb3c52f85431ba9c945659615d80c74fbd4c5c83e9f113c33023e`。本批为音枢自有缺陷修复，无新增Sollin采集、语义结论、私有探测、第三方代码或许可变化，不声明Sollin对齐或完整TTML2完成。

## 提交前归档

dirty manifest绑定`5d3beb480ed04c9611dc85da75b26f1b0efc5e4b`及四项预期源码/测试变化。unsigned IPA 17,845,010字节、SHA-256`f9e82c051859d2134c98ecb591088dbb4b281d7c1d5f4082b982d8b8c50943ec`；manifest SHA-256`01ab95e4e7551f9777df7f10b211dc4146f12fa4ba6a1a3c4865797a84a0178f`，archive日志`ebee75999f18e89ab6c81d944fc9bc3da35878e9921bde08ba4b7493dc39d1fe`。独立核验178项ZIP CRC、151项archive/IPA载荷逐字节、生产JS与原生标记、测试/私人/签名排除，arm64/iphoneos26.2/iOS15.1/[1,2]、未签名。

核验脚本最初把Swift符号放在JS检查，随后一次Python缩进错误；这两项是核验工具调用错误，已修正并实际通过。对应失败输出文件为0字节，不能称为完整诊断；事实在本报告记录，保留原文件。

T7预提交阶段`/Volumes/T7 Touch/NexusMusic/BuildArchive/2026-11-03-ttml-ruby-wrap-precommit-f9e82c051859`：281份映射文件/109,313,865字节，`ready=true`、0差异、源证据保留且零删除/零个人文件移动。来源补丁SHA-256`72f3326871fad7952ea18edb93be03c191aeeca3d82a2d65ff7518115cb0a32e`，provenance在`build/logs/ttml-ruby-wrap-provenance-20261103.json`。

clean提交归档、T7 clean阶段及push后实际队列在交付补记中记录。模拟器、unsigned包与静态检查不替代iOS27终态、真实歌词库、实体机、VoiceOver或签名安装。

## Clean delivery receipt

Product/test/initial-doc commit: `eaa891a9142992a6c8f8b985a5cb5497d27a21e7`. The clean archive manifest matches HEAD with `dirty=false` and `workingTreeChanges=[]`: arm64 / iphoneos26.2 / iOS15.1 / device families [1,2], unsigned. IPA: 17,845,009 bytes, SHA-256 `2729c56acbabd0afcef0c48184505f8112c59d5419703eb617c482aad889829f`. Manifest SHA-256: `e08e28dd55ff06c2d6f53a4804119be946aaa849c88c6f676e82959292701915`. Archive log SHA-256: `eecd34e5e15f8577673e1f559abe3d0689910e371b8d0bae8813d114cbba641b`. Independent receipt SHA-256: `06422f74e381257cb45160523b93ebdd73b26239eb76108f4a2865e358140f90`; `passed=true`, 178 ZIP entries/zero CRC errors, 151 archive-to-IPA file comparisons, JS/native production markers and test/private/signing exclusions passed.

T7 clean stage: `/Volumes/T7 Touch/NexusMusic/BuildArchive/2026-11-03-ttml-ruby-wrap-eaa891a`. 295 mapped files / 116,221,275 bytes, zero missing/mismatched files, SHA256SUMS recheck PASS. Inventory includes existing AppleDouble metadata; mapped count is not the application payload count. SHA256SUMS SHA-256: `d39949c8ead9a44cf8549e57f452ec7967550f29927ed43e729973842625d535`. Transfer receipt SHA-256: `4dbfcc95d677c6e2378fc9a34e8aa8cfcad2ba22fed87158b49968760aec8d6a`. Source evidence preserved; deleted=0 / movedUserFiles=0.

Prior run `41563617753` / `235d0d8`: compact artifact 528,511 bytes, SHA-256 `d2eb9fdf55575f069a4c91437f12b94e73c2683f6583a9aee3e7d47dc20b8afc`, CRC passed. Stored directly on T7 at `2026-11-03-ios27-41563617753-diagnostics`. Core job step was cancelled; later UI and IPA steps were skipped. Logs independently confirm two assertions: changed icon visibility and palette restoration. The UCloud section contains 100 animation-notification timeout messages and no final test result. Existing `e388e50` (OCR/batch input) and `d7bb46a` (applied palette observation) fixes are already included in current `41591188218` / `c178ea6`; cloud acceptance remains open. The 595,522,424-byte full diagnostics artifact was not downloaded or inspected.

Product commit `eaa891a` was normally pushed and remote main verified. Post-push queue and cleanup receipts follow separately. A documentation-generation attempt failed before changing any file because stdin was rejected as non-UTF-8; this did not affect source, archive, or the successful product push.

## Queue and storage closeout

Remote main was independently fetched and matched `ba27b5623bc13dec3279c8a359fc06378018a169`. Actions snapshot after push: `41591188218` / `c178ea6` remains running; `41602015021` / `eaa891a` is the only pending run. Actual queue: one running / one pending, without cancelling the running job or manually re-dispatching an old commit. Queue receipt SHA-256: `e894056cef4e1ac500749e814af036cf5e4f2dc11d446ab6aed2a0188c7729f7`. The docs-only follow-up did not create another run. Pending is not cloud acceptance.

No active xcodebuild at closeout. Internal free space 69,624,832,000 bytes; T7 free space 616,947,515,392 bytes. build: 9,846,600 KiB; work: 405,808 KiB. No cleanup or personal-file movement was necessary. Current incremental caches, latest two valid stages, unresolved evidence and all reverse-skill scope/Evidence/hash references retained. Cleanup receipt `build/logs/cleanup-2026-11-03-ttml-ruby-wrap.json`, SHA-256 `2bcba551340b9e701f82edac3b0f13fc92e5be762b464545f3004f156ccf75b2`. Final documentation, patch, queue/storage receipts are saved in a separately hashed supplement in the clean T7 stage, preserving its original inventory.
