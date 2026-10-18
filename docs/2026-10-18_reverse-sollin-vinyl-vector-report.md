# Sollin 唱臂方向、端点与局部变换报告

2026-10-18，普通逆向，flavor=null。补齐主唱臂从内部绘制角度到屏幕方向的证据，以及独立后部配重的局部坐标。完整唱头路径/渐变、精确缓动、触摸与目标运行仍未证明；音枢采纳与实际验收见[0069](decisions/0069-vinyl-primary-axis.md)。

## 授权、来源与方法

新master-route-20261018-203610实际R2/mobile-reverse，亲读PRIMARY/precedent并核本机tool-index；沿固定reverse-skill cab634bd855fc287f6e420c1f36fd1a6b9245960及work/sollin-ipa原granted/local_mobile_package/offline scope、case-guard，未重新case-init。IPA SHA256 `c2ee2deba236ef1b9e097e1d8cdc0b816137aa57cf85d4c8e2811dae9924bc07`，App成员SHA256 `640c6112584c017b45141a038f7aa975224c8b540ef1aaec1f40939a6aa5c84d`。容器与依赖身份沿既有E001，不执行参考App、不访问私有服务、不签名或注入。

使用索引本机隔离cstool、固定Blutter0039efb1/unboxed元数据，从成员slice+0x4000逐条对照原字节、函数边界、BL与池偏移。骨架名称不等于反编译正文。用固定匹配Dart3.12.2源码的PRODUCT/ARM64提取偏移与LEAF_RUNTIME_ENTRY_LIST交叉核对原生数学调用；源码摘要进入不可变manifest。独立verifier重新读取固定IPA、元数据、工具与SDK，不以probe文本作为字节真值。

## Evidence → Finding → Path

| Evidence | Finding | Path |
| --- | --- | --- |
| E038：8函数1886原始指令、258BL、108池引用；manifest SHA256 `8d13f1f38900248b9dcfc3b711f06bc190eefdf77395bca6adb030c1b3350bdf` | F037，info/candidate/high：主轴方向、保留端点与独立后部/唱头坐标系 | P037/callflow：SDK原生数学身份→Offset计算及栈槽保存→平衡画布变换→结合E036/E037推导有限屏幕方向 |

采纳前strict review：38E/37F/37P、12工作项/86timeline事件，0错误/0警告。WI012、field-journal与timeline已追加。独立verifier通过全部1886原始指令/258调用/108池引用、原生数学槽、端点保存、平衡save/restore及20组有限方向向量。

## 有限语义

| 位置 | 已核内容 | 边界 |
| --- | --- | --- |
| 0x253500/0x253540原生叶表 | Thread+0x770=LibcCos、+0x778=LibcSin；二者输入为先前保存的θ | 由匹配固定SDK静态身份交叉证明，不是参考App运行采样 |
| 0x253568–0x25359c | 构造u=(cos θ,sin θ)，v=(-sin θ,cos θ) | v为垂直方向，用于有限高光偏移，不据此恢复所有画法 |
| 0x2535a8–0x253600与Offset helpers | p0=pivot+.035Su，p1=pivot+.395Su | 主轴可见中心线长度.36S；S是shortestSide，父画布映射沿E037 |
| 0x253ff4/0x2540b8 | p0/p1保存于栈-0x20/-0x30，期间无重写；drawLine直接读取两个Offset的XY | 排除误用局部配重坐标或把装饰线当作主轴 |
| 0x253818→0x253c48 | 后部结构在save→translate(pivot)→rotate(θ)→restore内绘制；主轴两次drawLine位于restore之后、下一save之前 | 局部变换不泄漏到主轴；不等于完整栅格、阴影/渐变等价 |
| 后部局部坐标 | 线从(-.145S,0)到(.026S,0)，配重中心(-.095S,0)、宽.112S/高.078S | Rect.fromCenter原字节确认d1为宽、d0为高，排除宽高猜测 |
| 0x2542d0后唱头坐标 | 新save，translate(p1)、rotate(θ)，另有嵌套save/restore | 本批不采纳完整五点路径/渐变或触摸逻辑 |

E036已核θ从π/2到.62π，E037已核方形父画布与支点。现在有直接u向量和画布作用域证据，才可推导：RN默认向下的View旋转φ=θ−π/2，即0°到21.6°；不能追溯声称此前0066/0068的4°/24°已经精确对齐。20向量跨4尺寸、5插值点独立验证方向/正交/线长与坐标范围。精确动画曲线、运行中参数恢复及完整唱头和渐变仍未知。

## 复现与交付

原始样本、完整字节/JSON、脚本、SDK和case只留本机忽略目录；仓库仅保留脱敏结论，不复制AOT或图形资产。E038不可覆盖；新增结论另建Evidence。

```bash
source scripts/environment.sh
node scripts/sollin-reverse-gate.mjs ipa
python3 work/sollin-ipa/notes/vinyl-vector-probe.py
python3 build/verify-vinyl-vector-evidence.py
node scripts/sollin-reverse-gate.mjs ipa --review
```

时间线：20:36新路由/门禁；核SDK数学槽、Offset和主轴端点；补Rect.fromCenter并核宽高后冻结E038；20:43独立重放与strict review通过。ATT&CK不适用。音枢原创实现须另验实际App像素/布局/音频、清洁归档与云端iOS27；真实服务/签名/真机不能由本静态报告证明。
