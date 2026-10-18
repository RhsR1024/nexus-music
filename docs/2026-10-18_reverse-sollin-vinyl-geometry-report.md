# Sollin 黑胶绘制支点与有限几何报告

2026-10-18，普通逆向，flavor=null。固定IPA中唱针、唱盘、底座和盘托的原始指令已独立核验。唱针支点及内部角度插值可确认，但完整父布局映射、唱头路径、渐变视觉和手势尚未恢复。本批只形成后续原创对齐依据，没有改动产品几何或宣称完整复刻。

## 来源、授权与方法

按[强制工作流](REVERSE_SKILL_WORKFLOW.md)，新路由master-route-20261018-200307实际命中R2/mobile-reverse。既有本机work/sollin-ipa/scope.md保持auth=granted、local_mobile_package、offline、ready=true，未重新case-init；timeline/workitems/field-journal已追加。不执行参考App，不探测私有服务、不注入或签名安装。

reverse-skill固定cab634bd855fc287f6e420c1f36fd1a6b9245960；IPA SHA256 `c2ee2deba236ef1b9e097e1d8cdc0b816137aa57cf85d4c8e2811dae9924bc07`，App成员SHA256 `640c6112584c017b45141a038f7aa975224c8b540ef1aaec1f40939a6aa5c84d`。基础Mach-O/导入依赖身份沿既有E001容器与[IPA分析](SOLLIN_IPA_ANALYSIS.md)，本批没有换样本或新增依赖结论。

使用本机工具索引的隔离cstool、固定Blutter0039efb1/unboxed元数据。逐条从成员slice+0x4000取字节，校验函数边界、BL目标与对象池偏移；骨架名称不当作反编译正文。独立verifier重新读取IPA、受控元数据和immutable manifest，不复用probe结果作为字节真值。

## Evidence → Finding → Path

| Evidence | Finding | Path |
| --- | --- | --- |
| E036：7函数3117原始指令、361BL、221池引用；manifest SHA256 `92f8214a5bfc18f5811a6b318e25c1594e259c7ea113657930660e2eaa497e0f` | F035，info/candidate/high：有限支点、内部方向及独立绘制结构 | P035/callflow：核输入与Offset写入→核插值参数和绘制调用→保留父布局/手势/运行未知，后续独立设计与验收 |

严格review：36E/35F/35P、12工作项/83timeline事件，0错误/0警告。该review证明案例结构与摘要前提；下述有限语义由主代理逐条核对，不代表产品或目标运行验收。

## 有限结论与边界

| 位置 | 已核内容 | 不能由此推出 |
| --- | --- | --- |
| Tonearm.paint 0x25341c，支点段0x253458–0x253498 | 读取Size宽/高，分别乘0.835/0.175，写入Offset两个double槽 | 父画布在屏幕上的最终大小、偏移和完整触摸区域 |
| 角度段0x25349c–0x2534e0，辅助lerpDouble 0x189c40 | painter槽0x10成为t；参数为π/2与1.9477874452256718，即90°至111.6°的内部方向；独立15个有限数值向量通过 | 不能直接替换RN View的旋转角度；尚未恢复所有绘制变换/父布局或精确缓动 |
| VinylDisc.paint 0x252b3c | 首次drawCircle 0x252c28半径来自shortestSide/2；helper0x23d31c读取两个边长绝对值并取min | 最终外径、纹路数、所有高光/阴影和封面缩放比例 |
| Deck.build 0x79c024 / Platter.build 0x79c428 | 底座为带圆角装饰的CustomPaint，盘托是独立圆形装饰及RepaintBoundary | 渐变与阴影在iOS上的精确栅格/视觉等价 |
| Tonearm其余调用 | 可见drawLine、drawCircle、drawRRect、Path以及translate/rotate/save/restore的有限直接边 | 绘制方法不证明手势回调、拖动定位或唱针可点击 |

没有将全部221个对象池常数逐一赋予业务含义。唱头路径、完整渐变/混色、父布局约束/圆盘中心、命中测试、连续手势及参考动态仍待；E034/E035的双控制器/相位证据继续有效，不能由本批追溯扩大原证据范围。

## 复现与后续

仅在具备固定样本、隔离工具和本机忽略输出时执行；这些文件不提交或随产品分发。E036生成后不可原地更新manifest，补充结论使用新Evidence。

```bash
source scripts/environment.sh
node scripts/sollin-reverse-gate.mjs ipa
python3 work/sollin-ipa/notes/vinyl-geometry-probe.py
python3 build/verify-vinyl-geometry-evidence.py
node scripts/sollin-reverse-gate.mjs ipa --review
```

时间线：20:03新路由及scope门禁；随后逐条原始字节/池引用分析；独立3117条原始指令与支点寄存器流、角度端点/15向量重放；20:09严格review通过。原始指令、JSON、脚本、case报告和field-journal仅留本机work/sollin-ipa；仓库保留本脱敏报告。ATT&CK不适用，本批为离线UI绘制分析。

后续先补父布局/画布与原始坐标映射，再核对五固定参考并设计音枢原创结构；保留现有单一队列/播放意图、原生动效/PCM/EQ和前后台/减少动态效果。任何产品采纳仍需App实际像素/操作、本地归档、新云端iOS27与独立手机/签名/真实服务验收，不用静态报告勾完A09。
