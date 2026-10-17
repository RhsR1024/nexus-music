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
