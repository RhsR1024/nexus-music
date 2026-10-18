# 0061 背景像素回归的捕获与三色判断

日期：2026-10-18。属于A10验证修正，0060的产品可见性、场景数学和播放逻辑不变，全部A/F/J范围保持。

最终回归 `SourceUITests-1792300131198` 在“深色重启后暂停”断言失败，392.492秒、0通过/1失败。已保留完整本机日志、summary/counts及附件于build/presentation-final-failed。此前嵌套队列、独立发现关闭恢复、实际运动/暂停、PCM和切歌异步流程已执行；不能把这些分项写成最终整项通过。

失败日志的14组采样全为透明零，而失败附件 `F1E182C5-27A7-4822-83F2-E392A9E9EF10.png` 实际为1290×2796的深色发现页，有红绿蓝背景。截图已亲看；独立Pillow与CoreGraphics读取相同14个物理位置，alpha全部255，三种主色均存在。同期AX诊断只剩Application根节点；这与采样零同时出现，但不足以证明所有旧云端失败均由AX或采样导致。旧557999a云端完整诊断仍未取得，不改写其结果。

另一个错误已可独立复现：旧代码将未满足色差门槛的过渡点记为−1，再要求`Set(hues)==[0,1,2]`。失败PNG包含真实绿(44,58,49)、蓝(31,19,67)、红(60,23,42)及近中性(47,36,46)，因此即使三色都存在，也会被额外的−1拒绝。要求应为三种有效主色全部出现，而不是要求每个采样点都能分类。

手机背景专项改用`XCUIScreen.main.screenshot`，使像素来源独立于App的AX裁剪范围；按实际CGImage/UIImage尺寸换算位置，裁出一个物理像素，在明确sRGB/RGBA8缓冲中读取，不再平移整幅UIImage到1点UIKit渲染器。附件也使用同一屏幕捕获来源。三色仍使用原14个位置、2/6通道色差门槛与20秒预算；每种颜色都必须有alpha255的实际像素，缺任意一种仍失败，透明或未分类点不能补齐颜色。中性过渡点不再使已观察到的三色无效。

`BackgroundPixels.swift`仅属于UITest目标，不进入生产App；维护原生工程的显式文件引用，没有运行prebuild或添加依赖。新增原生测试覆盖6个独立确切RGBA像素、上下界/非有限坐标、真实失败PNG的颜色向量、分别缺红/绿/蓝、透明拒绝和中性过渡。独立读取实际失败PNG通过；新完整App仍需实际重跑，不以像素工具单测替代UI验收。完整诊断与所有原播放/异步/暂停/重启断言保持。

可在本机失败附件仍存在时重放：

```bash
source scripts/environment.sh
xcrun swiftc -swift-version 5 ios/NexusMusicUITests/BackgroundPixels.swift tests/native/BackgroundPixelTests.swift -framework CoreGraphics -framework ImageIO -o build/tests/native-background-pixels
build/tests/native-background-pixels build/presentation-final-failed/F1E182C5-27A7-4822-83F2-E392A9E9EF10.png
node scripts/test-ui.mjs NexusMusicUITests/SourceSettingsTests/testGlobalCoverThemeChangesAcrossPages
```

该修正不增加功能进度，不证明参考运行、实际GPU逐帧等价、真实服务、签名、真机或iOS27通过；原逆向采纳仍沿E024/E032及reverse-skill门禁。

复测1792301048820在heldRed等待处366.600秒失败，尚未到三色断言，不能算像素修正完整通过。录屏333/336秒确认实际切歌，catalog/counts/summary与导出附件另存。本轮为合成控制接口补充no-store与请求标识/轮询计数，继续定位，不把缓存或原生队列猜测写成已证实根因。

诊断复测1792302794209在360.017秒失败，lastHeldRed=2。新计数确认8次封面请求中含上一中断轮的transition-blue/red-1792302119479以及本轮transition-red-1792302794192；31次控制轮询、20次合成鉴权/0失败。这证明本轮红请求实际已到达，旧轮恢复请求污染了全局挂起数；不是“红请求未发出”。失败截图和层级、完整catalog/counts/summary保留于build/presentation-request-failed及ui-presentation-request-failed-*。

夹具仅挂起本轮transitionVersion的封面标识，并在HTTP响应close时删除该请求，避免旧恢复状态及已断开的响应占用屏障。旧标识仍走正常封面响应，没有清空产品缓存、修改播放逻辑、改期望数或放宽异步/三色/像素断言。最终正式入口复测继续，以其实际终态验收；此原因只针对已取证的本轮失败，不追认旧云端首因。

2026-10-18 最终背景回归：正式入口SourceUITests-1792303322232已exit0，466.067秒、1通过/0失败/0跳过。嵌套全屏队列及独立发现关闭后的实际背景运动恢复、PCM、前后台、暂停稳定、红蓝挂起/迟到/失败回退、两页三色和明暗重启检查全部通过；过渡视频59帧/10中间色，红切换0.505秒。16次本机合成鉴权/0失败，无新stream，复用临时音频缓存。counts明确保留旧恢复封面请求并正常响应，只有本轮red/blue/missing进入屏障，按序释放；没有删除产品缓存或放宽断言。catalog/counts/summary另存ui-presentation-barrier-passed-*，附件build/presentation-barrier-passed，深色及父层恢复截图已亲看。375业务/类型通过；完整native已exit0（native-presentation-resume-final.log）；iPad正式入口1792304057941两项通过/0失败/0跳过：AM2旋转135.232秒、窗口/导航/Modal旋转39.899秒，截图已亲看，catalog/counts/summary另存ui-presentation-ipad-passed-*。本批清洁归档、正常push与对应iOS27仍待，不代替真实服务/签名/手机。
