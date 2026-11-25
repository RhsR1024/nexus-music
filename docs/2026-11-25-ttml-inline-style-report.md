# TTML 内联与引用样式纵向验收（J37/F27）

2026-11-25 复核并收口 2026-11-18 遗留未提交的 TTML 内联样式候选（产品提交 `bf0606f`）。

## 实现边界

- 新增 `src/lyrics/style.ts` 与 `modules/nexus-native/ios/LyricInlineStyle.swift`，在既有有界 TTML 解析器和 TextKit 原生绘制管线内支持 `<head><styling><style xml:id=...>` 引用链、继承与内联优先级，涵盖 `tts:fontStyle`（`normal`/`italic`/`oblique`）、`tts:fontWeight`（`normal`/`bold`）、`tts:textDecoration`（`underline`/`lineThrough`/`overline` 及 `no*`/`none` 重置）、`tts:color`（命名色/`#rrggbb`/`#rrggbbaa`/`rgb()`/`rgba()`）和行内 `tts:backgroundColor`（仅作用于行内 span，不作为块级继承状态）。
- 非法颜色、冲突装饰、缺失或循环样式引用及重复 `xml:id` 全部 fail-closed 拒绝；原生解码器对异常值 fail-closed，与既有 WORD JOINER / Ruby 保护区间映射保持一致，不引入 React 逐帧重绘或第二时间线。
- 同步修复直接 `<ruby><rb begin end>` 的显式基础时间区间计算。

## 验证

- `npm run check`：1161/1161，0 failed/skipped/cancelled；`typecheck` 通过。
- `npm run test:native`：退出 0，含新增 `tests/native/LyricInlineStyleTests.swift`（解码、颜色边界、装饰位集合与 fail-closed 输入）。
- `swiftc -parse -swift-version 5 ios/NexusMusicUITests/SourceSettingsTests.swift`、`node --check scripts/test-ui.mjs`、`git diff --check` 通过。
- 离线逆向门禁：刷新本机 `tool-index` 后，`node scripts/sollin-reverse-gate.mjs ipa --review` 通过（61E/26WI/131 timeline/52F/52P，0 错误/0 警告）；无新增 Sollin 采集。
- 正式 Release `build/SourceUITests-1794989536225.xcresult`（常规字号，`build/ui-ttml-inline-style-20261118-r4`）：
  - `testAMLLProfileLyrics()`：1 passed / 0 failed / 0 skipped，`sourceUnchanged=true`，源码 digest `9425dd9b…118e`，安装 bundle `fa99fdf5…45c6`，`resultInfoSha256` `11a7d27f…2e06`。
  - 截图 `001-Active-TTML-bold,-italic,-color,-decoration-and-inline-background.png`（SHA-256 `132b9c40…0881`），`verifyCaptureEvidence` 为 `ready:true`；人工亲看确认“粗体”“斜体”“下划”“底色”均正确渲染。
- 正式 Release `build/SourceUITests-1794989904242.xcresult`（XXXL 辅助字号，`build/ui-ttml-inline-style-20261118-r5-xxxl`）：
  - `testAMLLProfileLyricsAtAccessibilityXXXL()`：1 passed / 0 failed / 0 skipped，`sourceUnchanged=true`，同源码 digest 与安装 bundle，`resultInfoSha256` `8fac6ae3…45fe`。
  - 截图 `001-Active-TTML-inherited-inline-style-at-accessibility-XXXL.png`（SHA-256 `b9371ab3…5eaa`），`verifyCaptureEvidence` 为 `ready:true`；人工亲看确认大字号下引用继承样式与行内底色完整可见且未裁切。
- 前序失败原件（r1–r3）保留于 `build/ui-ttml-inline-style-20261118-r1..r3`。

## 边界

本批只覆盖上述有界 TTML 内联与引用样式子集；竖排、任意比例跨行注音、完整 TTML2 区域/动画样式级联、真实歌词库、实体机 VoiceOver、签名安装和 iOS27 云端终态仍开放，不增加 Sollin 页面像素或动效完成量。
