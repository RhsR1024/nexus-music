# 0060 全屏业务层的背景可见拥有关系

日期：2026-10-18，A04/A05已有UI与交互对齐继续，全部F/J范围保留。

新reverse-skill路由master-route-20261018-124839为R2/mobile-reverse，复用现有离线scope并通过case-guard。E024→F023→P023的2358原始指令/28BL/9池加载独立重放通过；采纳前strict review32E/31F/31P、10WI/68事件零错误/警告。E024只支持当前路由/生命周期/活动实例约束计时器，不证明参考完整导航栈或运行表现，见[静态报告](../2026-10-18_reverse-sollin-cover-flow-report.md)。

0052仅在Player向根层报告open时移除根动画。代码审查确认其他全屏Modal仍遮住根背景，且Player内部的全屏队列、评论或歌词选择不会停用父播放背景。此为可执行代码路径，尚未量测隐藏层CPU/FPS/能耗；不以AX隐藏当作原生显示链已经停止的证据。

采用应用实例内的呈现注册表和React Context：根背景、每层全屏Modal具有独立身份/父关系；按最新顶层分支递归选择可见叶层，只有该层可运行动画。子层先挂载、父层删除、旧清理迟到、同级层交错及重开后的前景顺序都有独立状态测试。身份不进入音乐库/备份，不修改权威队列或播放意图。默认fullScreen及非透明overFullScreen遮挡父层；透明层/pageSheet/formSheet保留父背景。iOS关闭时等待原生onDismiss释放，重开期间visible=true时忽略旧dismiss释放；卸载始终清理。

全局原生背景只在自己的层可见时挂载；图片动效和黑胶转盘也读取相同呈现边界，继续叠加原播放/后台/减少动态效果门控。无逐帧React数据，不引入全局单例、第二套导航或播放控制器。界面层显隐和原生onDismiss回调需用实际App回归，注册表测试不代替实际呈现或功耗。

已重新亲读五固定HEAD：悦音d6f1af7 MiniPlayer42–102的局部active清理；Q547ccfe/wtf6624ab5 ImageBackground52–104的图片/children分层；Cybf0d469 usePlayerBackground20–122的URI/active拒绝迟到与50LRU；自有Wayferar8e47cdc HomeCardTheme44–87的home图层/前景职责。它们没有本批层级注册表，音枢原创实现；不复制源码/依赖/资源/原生补丁。许可沿[参考比较](../REFERENCE_COMPARISON.md)：悦音MIT与README原约束、Q/wtf根Apache2/文件MetaMIT、Cy根Apache2/RNTP独立许可、Wayferar自有/反编译/第三方分别保留。TS状态契约可共享，Android原生Modal关闭时序和动画另验。

验证计划：先保留当前完整背景App基线，再执行层级/竞争/清理业务测试及App全屏队列打开/关闭、实际PCM与恢复后像素运动、原pageSheet和前后台流程。清洁本地IPA、对应云端iOS27、签名/真实服务/真机各自记录；未完成前不记为完整A04。

该批处理动画可见性，没有自动给所有业务弹层新增背景。完整发现等独立全屏页的背景样式仍需逐页对齐；快速关闭/重开/再关闭的原生连续回调和实际设备性能仍待独立验收，不以纯状态测试宣称全部原生时序等价或完整A04完成。

2026-10-18 最终背景回归：正式入口SourceUITests-1792303322232已exit0，466.067秒、1通过/0失败/0跳过。嵌套全屏队列及独立发现关闭后的实际背景运动恢复、PCM、前后台、暂停稳定、红蓝挂起/迟到/失败回退、两页三色和明暗重启检查全部通过；过渡视频59帧/10中间色，红切换0.505秒。16次本机合成鉴权/0失败，无新stream，复用临时音频缓存。counts明确保留旧恢复封面请求并正常响应，只有本轮red/blue/missing进入屏障，按序释放；没有删除产品缓存或放宽断言。catalog/counts/summary另存ui-presentation-barrier-passed-*，附件build/presentation-barrier-passed，深色及父层恢复截图已亲看。375业务/类型通过；完整native已exit0（native-presentation-resume-final.log）；iPad正式入口1792304057941两项通过/0失败/0跳过：AM2旋转135.232秒、窗口/导航/Modal旋转39.899秒，截图已亲看，catalog/counts/summary另存ui-presentation-ipad-passed-*。本批清洁归档、正常push与对应iOS27仍待，不代替真实服务/签名/手机。
