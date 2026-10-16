# 0022：暂用漫途 App 图标

2026-10-16，F18/F25。用户明确授权暂用自有漫途音乐图标，并允许适配尺寸。

- 来源：本机 `ReferenceProject/Wayferar-Music`，固定提交 `8e47cdc701cdbb772577b2bf7abb699e285b0fa6`，`app/src/main/res/drawable-nodpi/ic_launcher.png`（512×512）。
- 保留黑底金色波形标志，使用 CoreGraphics 高质量插值适配到 1024×1024，四周增加约 5% 黑色留白；输出不含透明通道，不预绘制圆角，由 iOS 进行系统遮罩。
- `assets/app-icon.png` 为应用配置资产，原样同步到维护中的 iOS `AppIcon.appiconset`；无需 prebuild，不改原生工程管理方式。Android 若后续实施仍需单独适配 adaptive icon，不能把该 iOS 位图视作 Android 验收。
- 这是用户授权的临时资源复用；不将本仓库许可扩展到漫途恢复工程或其其他资产，也不据此宣称永久原创品牌图标已完成。没有引入其他项目代码或依赖。
- 验证：尺寸、无 alpha、配置与原生资产一致，以及 Release 资源编译/模拟器主屏幕；构建与归档实际结果见 BUILD_STATUS。
