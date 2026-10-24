# 0081：AM 动态网格渐变背景（MeshGradient）落地方式

日期：2026-10-24。状态：用户明确采纳本文落地方式并授权开工实施；作为播放器背景视觉批次的实现规格。

## 决定

1. **分层结构**：底层保留现有封面高斯模糊（MotionImage）；上层在 iOS 18+ 使用 SwiftUI 公共 API `MeshGradient`（3×3 网格）呈现动态流体渐变。网格点颜色来自既有取色结果（`visualColors` 主体色 + `flowPalette` 三色），切歌随封面更新，复用 `CoverThemeStore` 的身份/迟到/失败守卫。
2. **确定性运动**：网格点位置使用种子化慢速漂移，复用原生 ambient 的确定性运动框架（含减少动态效果、后台/暂停、播放身份相位隔离的门控语义）；不为每帧向 React 传递状态。
3. **版本门控**：项目最低 iOS 15.1，`MeshGradient` 仅 iOS 18+ 可用，必须 `#available(iOS 18, *)` 门控；iOS 15–17 走现有渐变/柔光实现回退。不得只交付 18+ 分支而无回退。
4. **架构边界**：动画与渲染全部在原生层（NexusNative 内 SwiftUI 宿主视图），React 侧只传递调色板、模式、开关等离散属性；不违反「原生音频/背景不逐帧过 React state」约束。
5. **验收口径**：本能力按音枢原创视觉验收（用户指定的 Apple 公共 API 路线，决策0079：层级清楚、风格统一、无裁切遮挡、反馈明确）。如后续要宣称「与 Sollin AM 一致」，须先通过 reverse-skill 的 AM 证据门禁并以录屏逐帧复核，静态截图不能替代。
6. **回退与失败**：取色失败、无封面、偏好关闭（`coverColor`/`globalBackgroundMotion`）时回到主题渐变或纯模糊层，语义文字对比度不劣于现状；减少动态效果时网格静止或停用漂移。

## 关联

[决策0079](0079-functional-spec-and-ui-quality.md)、[PRODUCT_SCOPE](../PRODUCT_SCOPE.md) F25/F26、[封面取色默认开启修复](../implementation-cover-tint-default-2026-10-24.md)、[UI_ALIGNMENT_WORKFLOW](../UI_ALIGNMENT_WORKFLOW.md)。
