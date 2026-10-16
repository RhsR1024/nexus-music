# 决策 0031：iPad 与横屏自适应布局

日期：2026-10-16

2026-10-16复核更正：主App的Debug/Release在`ios/app.xcodeproj/project.pbxproj`仍为`TARGETED_DEVICE_FAMILY = 1`；已构建App的UIDeviceFamily也只有1。app.json声明尚未落到维护中的原生工程，因此此前iPad窄窗口截图不能证明Stage Manager/分屏或原生平板布局。需要修正两个主App配置，再验证宽屏侧栏/旋转及分屏。此前构建成功保留为事实，平板验收和进度权重向下修正。

音枢继续使用同一套 React Native 页面和播放队列，根据可用窗口尺寸自适应，不为 iPad 建第二套业务导航或播放器。窄屏保留底部悬浮导航；宽度达到平板级别且可用高度足够时，使用安全区域内的侧栏导航、居中的内容列和隐藏底部导航，发现页按可用宽度自动计算 1–4 列卡片。

已实现：`app.json` 允许横屏并声明支持平板，iOS `Info.plist` 增加横屏方向；主壳使用 `useWindowDimensions` 和 `fontScale` 处理安全区域、侧栏、最大内容宽度和大字缩放；发现页卡片网格按宽度和字体比例自适应。该实现不改变播放器、队列、音频原生模块或数据模型。

本批本地 TypeScript、269 项业务测试、iOS26.2 Release 模拟器构建和 arm64 unsigned IPA 通过。尚未有 iPad 模拟器/真机旋转、大字、键盘、分屏和无障碍实机证据；因此 F35/J56 只记录为代码阶段部分完成，不能写成 iPad 验收完成。云端 iOS27 结果以本批提交对应运行的实际结果为准。
