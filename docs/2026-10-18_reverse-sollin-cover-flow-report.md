# Sollin 共享封面取色与全局背景活动边界

本批离线核验确认，全局 ArtworkFlowBackground 的场景创建调用了定义于 AM2 位图背景模块的共享取色 helper，再进入自身柔光和场景链。取色存在24×24缩图、逐四字节像素、RGB→HSV与24色相桶的静态路径；全局背景另有路由当前态、生命周期、活动实例和面积选择对计时器的约束。完整取色权重/回退、视觉场景和实际运行仍未恢复，不能宣称音枢现有单主体色算法等价。此次仅补证据，无产品采纳或新增服务。采用普通逆向模板，flavor=null。

## Scope 与工具

reverse-skill 固定提交和索引见[工作流](REVERSE_SKILL_WORKFLOW.md)。本批 `master-route.sh` 指定离线封面/全局背景边界，输出 R2/mobile-reverse 于 `build/reverse-skill/routes/ipa-cover-palette/route-scope.md`。现有 `work/sollin-ipa/scope.md` 为 auth=granted、offline-sample、ready=true；case-guard通过。只读固定本地 IPA，不运行目标、不签名安装、不请求私有服务。

IPA SHA256 `c2ee2deba236ef1b9e097e1d8cdc0b816137aa57cf85d4c8e2811dae9924bc07`，App成员 SHA256 `640c6112584c017b45141a038f7aa975224c8b540ef1aaec1f40939a6aa5c84d`。独立 cstool 原始指令核验采用 VA=slice、FAT raw+0x4000；NO_CODE_ANALYSIS骨架仅作方法归属。导入/依赖仍沿E001/E002及[IPA基础记录](SOLLIN_IPA_ANALYSIS.md)，不由Flutter依赖推断动态效果。

## Evidence → Finding → Path

| 记录 | 来源、复现与结论 |
| --- | --- |
| E-024 | `work/sollin-ipa/evidence/cover-flow-evidence.json`，SHA256 `ad4f825896dac561582cae5df34445e71c1bb28f6c9ab03cce80ea08b196922d`。索引Python执行 `notes/cover-flow-probe.py`、`notes/cover-flow-evidence.py`；独立 `build/verify-cover-flow-evidence.py`重放原字节及manifest，不覆盖既有Evidence。 |
| F-023 | info/design、candidate、confidence=high、evidence_ids=[E-024]；位置 createScene0x4b4744、palette0x4a8034、dependencies0x4b3fb4、shouldRun0x210114、selection0x210284。高置信度仅针对已核对的调用和操作，完整算法与动态效果未知。 |
| P-023 | callflow：E010全局flow分支 → createScene共享取色 → 独立柔光/场景 → dependencies/eligibility/selected-id → timer；再审查音枢原创生命周期，采纳前另做五参考比较与App验收。各步挂E024/F023。 |

13个范围共2358条原始指令、28条选定直接BL和9组池加载匹配固定成员；独立核验日志 `build/logs/reverse-cover-flow-independent-verify.log`。初次验证因手写总数误记2458而停止，按13范围合计改为2358后通过；不可变Evidence在修正后才创建，原始指令未改。timeline第44事件、WI002与field-journal已追加；严格review24E/23F/23P、8WI/44事件、零错误/警告，日志 `build/logs/reverse-cover-flow-evidence-review.log`。

## 已确认的边界

createScene在0x4b47a8直接调用extractPalette0x4a8034，后续分别调用softenColor0x4b6898、renderSoftLight0x4b5ab0、stableSeed0x4b5a10、AmbientScene.create0x4b527c和installScene0x4b4ec0。共享helper不意味着使用AM2同一painter。palette在0x4a81bc调用NativePicture.toImage0x4a9844，参数x2/x3均24；0x4a8458调用rgbToHsv，像素步长4、24桶和360池常量均可见。完整透明度处理、低饱和回退、排序、色数与全部参数尚未独立恢复。

didChangeAppLifecycleState存储枚举后调用eligibility。dependencies读取TickerMode.valuesOf、ModalRoute.of/isCurrent和MediaQuery字段，然后更新eligibility并解析封面；精确MediaQuery字段与生命周期枚举名称本批不命名。shouldRun检查场景/标志/生命周期及instanceId与activeInstance。选择器遍历mountedInstances，只比较eligible实例面积，面积大于或等于当前最大值时替换，因此同面积选择后遍历实例；这不证明真实遮挡几何。syncTimer/startTimer有shouldRun及已有timer守卫，停止分支取消timer。池Duration字段0x14438仅为静态值，不能当作实测帧率或功耗。

## 音枢后续审查

`src/ui/Materials.tsx`已有独立全局动效偏好和实际播放意图门控；`VisualBackground.tsx`用原生Animated、AppState与减少动态效果控制动画，封面身份/迟到隔离沿既有store。原生VisualAssets.palette采用32×32 RGB分桶主体色，属于原创简化算法，不是本批HSV算法。根层及经典播放器都可挂载AmbientBackground，原始路由/活动实例边界值得继续核验；尚未把代码共存推断为已发生重复渲染或功耗故障。

下一步先比较五参考的可见性和动画生命周期，再对音枢进行确定性遮挡/恢复与实际PCM回归；完整调色/场景恢复独立推进。此次不提高功能实现比例，不替代iOS27、真实封面/服务、签名、真机或功耗验收。ATT&CK/IOC不适用于本次功能边界审查。

## 2026-10-18 可见背景实施跟进

新路由仍为R2/mobile-reverse，既有scope/case-guard通过，未重新初始化案例。索引工具独立重放E024原字节/manifest通过，严格review24E/23F/23P、8WI/44事件零错误/警告后，按[0052](decisions/0052-background-visible-owner.md)亲读五参考并原创增加全屏播放页呈现状态。根页面不可见时移除其MotionImage，保留静态渐变；经典播放页自己的背景与现代布局的独立偏好保持，关闭/清空条目后恢复。复用E024→F023→P023已确认的可见活动职责，不扩大参考调色、场景或动态结论。

359项业务/类型通过；正式入口背景专项加入播放、实际PCM、回到前台、关闭与暂停断言，结果随后依BUILD_STATUS追加。首轮调用遗漏UITest目标前缀，以70退出且0测试执行，已保留日志并改用完整目标；不计作产品失败或测试通过。timeline第45事件记录本次实施。普通逆向flavor=null，未执行参考App/Hook/私有网络；本批不涉及加密/签名恢复，完整参考运行、功耗/帧率、真实服务/签名/手机仍待。

复现门禁与本地专项：

```bash
source scripts/environment.sh
python3 build/verify-cover-flow-evidence.py
node scripts/sollin-reverse-gate.mjs ipa --review
node scripts/test-ui.mjs NexusMusicUITests/SourceSettingsTests/testGlobalCoverThemeChangesAcrossPages
```

原字节、scope、timeline、工作项与现场日志留本机忽略目录；公开文档只保留脱敏结论及复现引用。

实施验收追加：正式入口SourceUITests-1792273286451的完整背景专项308.007秒、1通过/零失败/跳过，红蓝像素/跨页/独立偏好/重启、经典实际PCM、Home→激活、收起恢复/暂停和凭据清理通过。两张最终截图已亲看；20鉴权成功/0失败、8次本机合成stream，不计真实个人服务。359业务/类型通过；不将Animated门控标识当作隐藏层实测功耗、帧率或参考运行。清洁归档/对应云端另记。

## 2026-10-18 全屏层级实施与验证边界

新路由master-route-20261018-135148命中R2/mobile-reverse，既有scope/case-guard及采纳前严格review32E/31F/31P通过；E024的2358原始指令/28BL/9池加载再次独立重放。沿E024→F023→P023只采用当前呈现和活动实例的职责边界；没有把静态面积选择或计时器代码当作参考实际遮挡、帧率与功耗结果。E032配色算术的独立证据仍见[配色报告](2026-10-18_reverse-sollin-ambient-scene-report.md)。

[0060](decisions/0060-presentation-background-ownership.md)将音枢旧的Player单一回调扩展为应用实例内父子呈现注册表。全屏子层关闭后恢复父层，再关闭播放器恢复根层；page/form/透明Sheet保留父层背景。图片动效、黑胶及原生场景读取同一可见边界；播放控制器和队列仍独立。375业务/类型通过，含7项父子、同级、孤儿、迟到清理、通知、Sheet和循环拒绝覆盖。实际原生快速连续开关、隐藏层能耗和参考App运行仍待。

[0061](decisions/0061-background-pixel-sampling.md)另记录验证工具的两个已复现问题：旧AX图像裁剪得到透明零值，近中性点又误拒绝已含三种主色的截图。手机专项使用独立屏幕捕获和物理像素RGBA8读取，仍要求14处采样中红绿蓝全部齐全，缺色/透明不能通过。1792302794209的新请求诊断另确认上一轮恢复封面污染HTTP屏障，夹具按本轮标识隔离并清理已关闭响应；不修改产品缓存或播放行为，不把此结论推广到旧云端。失败证据均保留，完整最终App、本地归档和新iOS27终态分别追加于BUILD_STATUS，不以该报告宣称全部验收。

2026-10-18 最终背景回归：正式入口SourceUITests-1792303322232已exit0，466.067秒、1通过/0失败/0跳过。嵌套全屏队列及独立发现关闭后的实际背景运动恢复、PCM、前后台、暂停稳定、红蓝挂起/迟到/失败回退、两页三色和明暗重启检查全部通过；过渡视频59帧/10中间色，红切换0.505秒。16次本机合成鉴权/0失败，无新stream，复用临时音频缓存。counts明确保留旧恢复封面请求并正常响应，只有本轮red/blue/missing进入屏障，按序释放；没有删除产品缓存或放宽断言。catalog/counts/summary另存ui-presentation-barrier-passed-*，附件build/presentation-barrier-passed，深色及父层恢复截图已亲看。375业务/类型通过；完整native已exit0（native-presentation-resume-final.log）；iPad正式入口1792304057941两项通过/0失败/0跳过：AM2旋转135.232秒、窗口/导航/Modal旋转39.899秒，截图已亲看，catalog/counts/summary另存ui-presentation-ipad-passed-*。本批清洁归档、正常push与对应iOS27仍待，不代替真实服务/签名/手机。
