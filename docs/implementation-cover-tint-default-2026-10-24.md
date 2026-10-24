# 封面取色默认开启修复（2026-10-24）

## 背景

用户查看 r3 真实源播放截图（`build/live-source-playback-20261024-r3/screenshots/001`，Shape of You 青蓝封面）时指出：封面为蓝色时经典播放器背景仍是固定桃粉渐变，不符合「封面模糊取色」预期，与 Sollin「全屏播放器封面驱动背景」（功能清单 §5，E-230 系列）和 [PRODUCT_SCOPE](PRODUCT_SCOPE.md) F25「封面主体色/模糊驱动软件全局及适用播放页背景，切歌随封面变化」相悖。

## 根因

取色链路本身完整存在且可用：`CoverThemeStore`（`src/appearance/coverTheme.ts`）监听播放身份，经 `services.visualColors` 原生取色得到主体色；`appearancePalette`（`src/domain/appearance.ts:83`）在 `coverColor` 偏好开启且取色有效时以 `coverThemeGradient` 替换主题底色；经典播放器背景 `Player.tsx:199` 使用 `theme.palette.background[0]`，会自动跟随。问题仅在 `appearanceDefaults.coverColor` 历史默认为 `false`，r3 真实测试按默认偏好运行，因此背景恒为 blush 主题渐变。这是默认值缺陷，不是取色/渲染链路故障。

## 改动

- `src/domain/appearance.ts`：`appearanceDefaults.coverColor` `false→true`。新安装与未持久化偏好的运行直接获得封面驱动背景；取色失败或无封面时仍回退主题渐变（浅色 blush 底、语义文字对比度由既有测试保证）。
- `src/app/preferences.ts` `restore()`：旧记录一次性升级——无 `coverColorDefaultOn` 标记的历史记录（旧默认整对象持久化，均为显式 `coverColor:false`，无法与手动关闭区分）升级为 `true` 并写入标记；此后用户手动关闭跨重启保留。`globalBackgroundMotion` 的一次性派生仍先按原始记录计算，不受升级影响。
- `tests/coverTheme.test.ts`：「关闭取色时调色板不变」断言改为显式 `{...appearanceDefaults,coverColor:false,globalBackgroundMotion:false}` 钉住关闭态。
- `tests/visualAssets.test.ts`：新增迁移测试（旧记录升级一次、升级后手动关闭可持久、全新安装默认开启）。

## 验证

- `npm run check`：typecheck + 512/512 node 测试通过（含新增迁移用例）。
- UI 测试静态核查：Swift 用例均按当前值条件切换取色开关（`if value != "1" {tap()}`），不依赖默认值；`BackgroundPixels` 断言为自洽采样/色相存在性，无固定 blush 基线。
- 经典直达采集（`testVisualLabClassicDirect`，入口种子化 `appearanceDefaults`）：Release 1/0/0，`build/SourceUITests-1792853123798.xcresult`；截图 `build/ui-screenshots/001-Classic-direct-three-lines.png` 已亲看——红/绿/蓝三色带夹具封面下，页面背景由旧 blush 桃粉（约 #fbf4ef）变为取色混合的淡薰衣草（约 #E7DEEC），默认链路端到端生效。红/蓝封面产生可区分背景由 `tests/coverTheme.test.ts` 既有断言覆盖；三原色夹具的取色落点属夹具特性，不作为视觉质量评分。

## 未验证边界

- 未在真机/签名环境复验；仅本机模拟器 Release。
- 真实源 r3 场景的复采（r4）未执行：需 23 份真实源的模拟器应用状态，属后续批次验证。
- 全局壳层（发现/搜索等页）在播放中带封面时的实际观感未逐一截图复核；浅色混合比例（.12/.06/.09）偏浅，更贴近参考的深取色与动态呈现按 0079 作为持续收敛项，不建立像素分数。
- 旧记录升级把「从未手动设置」与「曾手动关闭」的历史记录一并升级为开启；如个别安装需关闭，可在 设置→外观→背景随封面变化 手动关闭并持久。

## 关联

[决策0079](decisions/0079-functional-spec-and-ui-quality.md)、[PRODUCT_SCOPE](PRODUCT_SCOPE.md) F25、[上一批实施回执](implementation-shared-song-actions-2026-10-24.md)、[UI质量回执](ui-spec/shared-actions-live-2026-10-24.md)。
