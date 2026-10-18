# 0062 经典播放器滚动视口安全区

日期：2026-10-18。A09已有UI缺陷修复，全部A/F/J及音枢特有能力保持。

正式App父层恢复截图 `build/presentation-barrier-passed/5F69874B-7E03-4565-B958-5FD0075B35C9.png` 中，歌词偏移文案与系统时间重叠。源码 `Player.tsx` 的ScrollView视口铺满Modal，只有可滚走的content paddingTop65，不能限制滚动后的绘制范围。此前背景恢复通过不等于该安全区已正确。

reverse-skill新路由master-route-20261018-142527命中R2/mobile-reverse；PRIMARY、当前索引、既有scope/case-guard与IPA采纳前strict review32E/31F/31P通过。沿E024仅保留呈现活动边界、E032仅保留配色结论。本批没有恢复新的Sollin安全区字段或运行行为；缺陷证据来自音枢实际App，不冒称Sollin算法或精确布局已还原。

## Evidence → Finding → Path

| 来源 | 发现 | 实施与验收路径 |
| --- | --- | --- |
| 音枢正式App1792303322232父层恢复PNG与Player源码 | content padding可滚走，视口未排除状态栏；截图真实重叠 | 使用既有safe-area-context在当前Modal内的原生SafeAreaProvider/SafeAreaView约束经典ScrollView视口；原生背景继续覆盖屏幕；检查实际scroll.frame及截图 |
| E024→F023→P023、E032→F031→P031 | 仅沿用已有呈现/配色职责，不提供安全区具体值 | 保留背景、播放和唯一队列，不改原生场景；完整背景/PCM/异步/主题回归继续 |

经典ScrollView由当前Modal内独立SafeAreaProvider和原生SafeAreaView约束四边，内容顶部保留12点间隔；背景仍可延伸至屏幕边缘。其他播放器布局与详情Sheet维持各自布局。这是既有依赖上的原创修复，没有复制参考源码、资源、依赖或原生补丁。系统insets来自当前Modal内新增的既有依赖SafeAreaProvider，原生SafeAreaView直接应用本窗口变化；实际旋转仍需App测试，不以代码形式推断通过。

## 五参考比较与采纳边界

固定HEAD已逐一实核。许可继续沿[参考比较](../REFERENCE_COMPARISON.md)，不为项目或全部参考资产统一宣告新许可。

| 参考 | 亲读实现 | 维护、平台与本批取舍 |
| --- | --- | --- |
| 悦音d6f1af7 | NowPlaying/index.tsx:122、632、959，header top及内容bottom使用insets | 根MIT及README原限制；iOS/RN职责可参考，但不复制其拖动阈值、页面结构或native补丁 |
| Q-1515 547ccfe | PageContent.tsx:18–20、51–74，iOS SafeAreaView包内容，背景独立 | 根Apache2/逐文件许可保留；旧RN SafeAreaView与Android分支不能整体搬入现工程，使用音枢已有safe-area-context |
| wtfdelphia6624ab5 | navigation/components/Toast.tsx:38–44，安全区包提示内容 | 只核此局部，不外推播放器已做相同约束；根Apache2/文件级许可保留，不复制导航层 |
| CyMusic bf0d469 | app/(modals)/[name].tsx:98–105，SafeAreaView包ScrollView且automatic inset | 根Apache2/RNTP另许可；与音枢视口职责相近，不复制router、RNTP、自动inset叠加或来源代码 |
| 自有Wayferar8e47cdc | SafePanelFrame.java:20–39，当前窗口/系统栏/cutout交集 | Android WindowInsets不可直接用于iOS；保留自有/反编译/第三方边界，只比较安全窗口职责 |

验收在既有正式背景专项增加视口几何断言：手机竖屏排除顶部系统栏和home indicator；滚动到完整队列并返回后仍保持；横屏排除左右cutout和底部，再转回竖屏。像素运动/PCM/迟到/失败/三色/主题/重启原断言全部保留。硬件cutout的最低20点、home indicator10点断言用于本项目指定手机模拟器，不宣称覆盖所有机型或iPad分屏；iPad/真实设备独立验收。

当前375业务/类型通过。正式App复测、截图、清洁归档、新云端iOS27及真实服务/签名/真机各自记录，不将此布局修复计作新增后端完成。

首轮1792305245125在269.965秒失败于testID的ScrollView类型查询，尚未到几何断言。实际保留层级确认标识在Other容器上，其frame为(0,59,430,839)，内层ScrollView同框，真实顶部59/底部34。改为跨类型匹配同一标识，不修改几何门槛或产品实现；完整复测继续。失败日志/counts/summary留ui-classic-viewport-query-failed-*，附件build/classic-viewport-query-failed。

第二轮1792305874293在303.498秒横屏几何断言失败，竖屏及滚动/队列返回检查已通过。失败附件的AX debug description仅Application根，无法据此认定safe-area未更新或读取可信视口；日志确认设备/界面方向已切换。保留ui-classic-viewport-landscape-failed-*与build/classic-viewport-landscape-failed。复测增加旋转后app.activate、明确window/viewport坐标诊断及先保存屏幕再断言；原几何门槛不变，完整背景/PCM/异步断言继续。

第三轮1792306634208在183.325秒设置页触达appearance-cover-color处提前失败，没有到新横屏断言。测试此前未固定起始方向；本轮补显式portrait和开头/结束恢复，重启当前手机模拟器以排除旧失败轮UI自动化状态，不清除App数据或缓存。日志/counts/summary与导出附件保留ui-classic-viewport-settings-failed-*及build/classic-viewport-settings-failed。不得将这次失败说成视口通过或确定的产品根因。

重启后1792307131284在300.962秒取得明确坐标：window(0,0,932,430)，viewport(0,59,932,337)。已确认根页面safe-area上下文在全屏Modal旋转时沿用竖屏边距，先前的左右margin方案并未修好横屏。现改经典滚动区域内独立SafeAreaProvider和原生SafeAreaView；背景作为全屏兄弟层保持。读取依赖自身SafeAreaView默认四边additive及Provider原生inset/frame变化处理，未修改依赖。原几何断言与旋转场景完整复测，失败及截图另存ui-classic-viewport-stale-insets-failed-*。

原生Modal安全区方案的1792307572879已通过竖屏/滚动/队列返回/横屏cutout/转回全部几何断言（横屏附件1BCA1E93、父层377C9B47已亲看），但整项在深色重启后三色检查失败，398秒附近，14个运行时采样为空。失败PNG0A8EA685实际1290×2796不透明；独立Pillow和原生像素工具重放均确认这张暂停画面本身没有绿色达标，不能仅归为采样问题。14点确切RGBA留本机诊断；本批不得计完整App通过或降低三色门槛。当前增加从屏幕不可变PNG解码UIImage再读CGImage，检验lazy wrapper尺寸/取图异常，完整复测继续；真实缺色仍须按实际终态处理，不能以采样修正掩盖。

PNG解码整项1792308299509仍在406.534秒深色重启采样返回14空数组，未解决；该尝试已撤回。两个短诊断的直接和等待回调内读取都有效（10.346/12.864秒），不能证明长流程捕获首因。短诊断源码留build/capture-diagnostic-swift.txt，不留作无断言的产品测试。实际失败PNG同时存在缺绿色，继续保留失败。

最终验证拆为独立testClassicPlayerWindowSafeArea和原完整背景用例，二者同批执行且均保留云端：前者验证实际播放、滚动、队列返回、横屏cutout和转回竖屏及清理；后者保留全部PCM、运动、三色、主题、异步和重启断言及竖屏视口。没有降低三色阈值或删除旋转要求，不根据拆分预判首因，终态分别记录。


## 最终本地复测

联合回归 `1792310358432` 中 `testClassicPlayerWindowSafeArea` 通过（98.693s）；实际播放、滚动到完整队列、队列返回、横屏左右 cutout、底部安全区及回到竖屏均通过，截图已导出到 `build/classic-separated-failed/` 的两张经典视口附件。同期完整背景用例保留所有断言，但在深色重启后三色采样首次失败，14 个临时捕获为空；失败 PNG 本身有效且缺少绿色，原始失败证据保留。随后仅对 UITest 截屏捕获增加最多五次重试，仍要求每个样本 RGBA8/alpha=255 且红绿蓝三种主色齐全；单独 `testGlobalCoverThemeChangesAcrossPages` `1792311318332` 通过（475.014s，1/0/0），过渡视频 60 帧、8 个中间色、蓝红切换 0.481667s。该修复只处理模拟器捕获时机，不改变产品渲染或验收阈值。

`npm run check` 375/375、`git diff --check` 通过；本批仍需同步任务矩阵、清洁归档、push 和新的 iOS27 运行。
