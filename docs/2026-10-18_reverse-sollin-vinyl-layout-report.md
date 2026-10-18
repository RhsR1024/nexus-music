# Sollin 黑胶父布局与坐标映射

2026-10-18，普通逆向，flavor=null。补齐底座/盘托/唱片/封面和独立唱针的有限父坐标；完整唱头路径、渐变、触摸、运行外观与精确屏幕旋转仍未证明。音枢采纳范围及原创设计见[0068](decisions/0068-vinyl-layered-geometry.md)。

## 来源与方法

按[项目工作流](REVERSE_SKILL_WORKFLOW.md)，新master-route-20261018-201242实际R2/mobile-reverse，亲读PRIMARY并使用固定工具索引；既有work/sollin-ipa的granted/local_mobile_package/offline scope与case-guard通过，未重建case。reverse-skill固定cab634bd855fc287f6e420c1f36fd1a6b9245960，IPA SHA256 `c2ee2deba236ef1b9e097e1d8cdc0b816137aa57cf85d4c8e2811dae9924bc07`，App成员SHA256 `640c6112584c017b45141a038f7aa975224c8b540ef1aaec1f40939a6aa5c84d`。与[E036报告](2026-10-18_reverse-sollin-vinyl-geometry-report.md)同样本，无新增容器/依赖判断；无目标运行或私有服务访问。

从成员slice+0x4000取原字节，用工具索引本机cstool及固定Blutter0039efb1/unboxed元数据定位边界。4函数1404原始指令/106 BL/88池引用逐条核验；独立verifier重新读取固定IPA、所有manifest/工具/元数据摘要、原字节、调用目标和池偏移，并直接解码FP指令寄存器/运算字段进行6组尺寸重放。骨架命名不当作反编译正文；最初probe只有三函数，补齐唱针builder后才冻结E037。

## Evidence → Finding → Path

| Evidence | Finding | Path |
| --- | --- | --- |
| E037：content0x59ac4c、Positioned.fromRect0x51cb9c、applyParentData0x85f354、tonearmBuilder0x59bc4c；immutable manifest SHA256 `cec7afff6aef2a01e2ab1c73b5c98c3da55ecbd74f9e0845dc02809262846f88` | F036，info/candidate/high：方形局部坐标、盘托/唱片共心与独立唱针画布 | P036/callflow：FromRect确定字段→原始FP确定比例/中心→结合独立E036支点并保留完整绘制未知 |

采纳前strict review：37E/36F/36P、12工作项/84事件，0错误/0警告。时间线、WI012和field-journal已更新；review验证结构和摘要，实际语义由主代理逐条检查。

## 有限结论

以父方形边长S为单位，content读取输入double槽0x10/0x20并取min，在非有限或非正时返回空分支；本批未独立恢复两个约束槽的字段名。末尾0x59ba18构造SizedBox，宽高均由同一个S装箱值写入；子节点为Stack。

| 图层 | 局部几何 | 关键证据 |
| --- | --- | --- |
| 底座 | 左/右.015S，上.055S，下.025S | 0x59ad4c/54/5c乘法，0x59adc8后Positioned槽写入 |
| 盘托 | 左.035S，上.135S，直径.8S | 0x59ad04/1c/24，0x59aea4后宽高同值 |
| 唱片 | 直径.8×.91S=.728S；左.071S，上.171S | 0x59af30–0x59af48计算盘托与唱片半差后加各偏移，0x59b784写入Positioned |
| 中心封面 | 直径.728×.46S=.33488S，圆裁切/居中结构 | 0x59ad14及后续SizedBox/ClipOval/Stack |
| 唱针 | Positioned四边均0，覆盖方形；内部builder返回CustomPaint | 0x59b93c/40/44/48写0；0x59bc4c builder至0x59bcf8 CustomPaint |

Positioned.fromRect将Rect.left、top、right-left、bottom-top分别装箱写入tagged +0x1f/+0x27/+0x3f/+0x47，避免只凭猜测命名槽。applyParentData再次校验同一组widget槽到parent data关系。外Stack的AlignmentDirectional(-1,-1)、StackFit.loose和Clip.none对象池值已记录，未据此声称像素完全等价。

盘托和唱片中心均(.435S,.535S)。结合独立E036的Size支点，可将唱针支点映射为(.835S,.175S)方形局部坐标。该父子树未插入额外旋转，但所有painter内部变换/唱头路径未恢复，因此E036内部方向仍不能自动当作RN View旋转。没有从绘制函数推断拖针/点击/寻址手势。

## 本机复现与交付边界

原始样本、字节/文本/JSON、脚本、工具与case仅留本机忽略目录；不提交AOT、图片或参考资源。E037不可覆盖，新增结论另建Evidence。

```bash
source scripts/environment.sh
node scripts/sollin-reverse-gate.mjs ipa
python3 work/sollin-ipa/notes/vinyl-layout-probe.py
python3 build/verify-vinyl-layout-evidence.py
node scripts/sollin-reverse-gate.mjs ipa --review
```

本次复核没有执行参考App、远程服务、签名或真机，也不适用ATT&CK。原生动画、唯一播放意图、PCM/EQ和音枢特有能力继续保留；音枢原创实现的业务/App/本地归档/云端iOS27需另记实际结果，不把此报告当作A09整体完成。
