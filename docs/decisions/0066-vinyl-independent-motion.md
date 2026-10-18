# 0066 黑胶相位与独立唱针动效

2026-10-18，已有A09 UI/交互继续；完整构图、手势与逐页验收仍待，不增加完整交付比例。

## 证据与采纳边界

reverse-skill新路由master-route-20261018-191117为R2/mobile-reverse，既有离线scope/case-guard及IPA固定摘要通过。E035→F034→P034独立核验827原始指令/68BL/41池引用、SDK round与DartModulo叶表；采纳前35E/34F/34P严格review零错误/警告。与E034一起支持两个独立控制器、loading/buffering旋转门控、暂停相位累积和歌曲key变化归零。具体见[静态报告](../2026-10-18_reverse-sollin-vinyl-motion-report.md)。

原始对象/命名参数描述符/调用栈对应唱针正向620000、反向480000的Duration；转盘Duration构造前round(13513513.513513515)=13513514。按Dart标准微秒单位，本批名义采用每圈13513.514ms、唱针620/480ms；不是目标运行或实际帧时序量测。动画开关完整来源、ThreePointCubic坐标、精确角度/几何和触摸行为未恢复。音枢保留原创4°/24°角度，使用自身三次缓动，不将其写成参考精确曲线或完整机械仿真。

## 原创实现

转盘之前默认缓动且每圈22秒，曲目变化不会重置相位。现以歌曲来源身份创建独立Animated.Value、线性原生驱动，暂停保留真实native phase，恢复从该相位继续；每圈折回同一等效相位，避免长时间无限累加。效果清理使旧stop/start回调失效，旧歌曲的动画不能重启新值。

唱针使用另一个原生驱动值；播放/暂停只改变其目标，快速往返先停止原动画，从实际当前位置转向新目标。减少动态效果、后台、被全屏遮挡时立即就位且不运行动画；它们继续约束转盘。ModernPlayer黑胶仅在phase=ready、intent=playing、非buffering时传入playing，解析阶段保持停止。没有逐帧React更新、PCM传递、新依赖或第二套播放意图；队列、缓存和音频后端不变。

## 五固定参考比较

已实核五HEAD，并亲读下表核心代码；仅采用职责对照，无源码/资源/依赖/原生补丁复制。

| 参考 | 相关实现与取舍 | 维护、Android、许可 |
| --- | --- | --- |
| 悦音d6f1af7 | NowPlaying/index.tsx290–314：20秒线性native loop，仅按isPlaying开关；不提供完整前后台/减少动态效果/曲目重置，793–805圆封面无唱针 | 不搬缺失门控；RN原生动画可共享而生命周期另验；根MIT及README学习/非商业限制并存，保留冲突边界 |
| Q547ccfe | PlayDetail/Vertical/Pic.tsx15–44：animated只代表首次导航，静态方封面；ControlBtn38–47使用统一togglePlay；Vertical/index46–68只管理常亮 | 不导入RN0.73/全局事件/导航依赖；Android常亮与音频另适配；根Apache2，所读TSX无独立头，依赖另许可 |
| wtf6624ab5 | 同路径Pic15–44与Vertical/index46–68为静态封面/常亮；ControlBtn35–41统一播放意图 | 不搬旧RN/独立iOS模块；Android导航/生命周期另验；根Apache2，依赖和原生模块各自许可 |
| Cybf0d469 | player.tsx145–174/497–515为URI封面/横向切图；PlayerControls30–45区分实际播放与待播放意图；usePlayerBackground75–120按URI拒绝迟到 | 不将意图当作旋转条件，不引入Expo57/RN0.86/RNTP5及补丁；URI契约可共享Android，后端另验；根Apache2/RNTP另许可 |
| 自有Wayferar8e47cdc | QueueIndicator.java16–44查询动画缩放、仅PLAYING动画并按附着/可见继续刷新；Smali69/396/402为权威对应；检出docs/Java/Smali未见黑胶/唱针 | Java为反编译参考，构造时一次查询不等于动态订阅；Android Canvas不能直接移植iOS；无根LICENSE，自有/反编译/第三方分别归属 |

## 验证

387业务/类型通过。实际App在既有Navidrome/PCM/八布局回归内增加黑胶专项：去标识非对称三色封面、暂停81点RGBA非空稳定、播放像素变化、唱针实际frame宽度变化及返回、Home→激活恢复。新coverArt身份避开旧1px夹具缓存；合成fixture不代表真实服务器。本地App正在串行执行，未提前计通过；结果、清洁归档、对应云端iOS27、签名及真机分别记录。

系统减少动态效果实时切换、完整曲目切换/缓冲时序与长时间相位精度尚待实际设备/专项验证；原生驱动源码检查不能替代这些验收。

2026-10-18 本地终态：SourceUITests-1792322360079完整八布局/PCM/歌词/统计/重启/凭据清理及新增黑胶专项282.844秒通过，1通过/0失败/0跳过。暂停81点/324字节非空像素稳定、播放实际像素变化、真实唱针frame变化/返回、Home→激活继续转动通过。两张黑胶画面已亲看，独立Pillow中心150×150区域有超过1000个像素差异（不是全画面动态背景差异）；图片/摘要/收据留build/vinyl-motion-passed，日志/catalog/summary/counts另存ui-vinyl-motion-*。10合成鉴权成功/0失败，1coverArt、无新stream请求、复用缓存；不计真实服务或本次冷下载。完整临时附件导出在finally删除，原xcresult与两张必要PNG保留。387业务/类型通过；清洁归档/提交push/对应iOS27仍待。精确缓动时序、运行中减少动态效果/曲目切换/缓冲专项及真机验收未由本次测试证明。
