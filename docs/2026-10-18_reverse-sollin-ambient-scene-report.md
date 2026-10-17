# Sollin 柔光贴图与四场背景的静态边界

全局背景在共享三色取样后软化颜色、生成144×144柔光图，再创建四个运动色场；底层渐变与色场具有分开的运动参数。音枢当前的三色渐变与封面平移尚不能代表这一合成场景。本批恢复有限数学和绘制边界，没有运行Sollin或新增产品实现；缺失的锚点纵坐标、部分颜色分量、精确随机序列和完整过渡策略仍保持未知。普通逆向报告，flavor=null。

## 范围、来源与复现

用户提供的离线IPA scope、固定skill提交/工具及禁止私有服务探测边界见[强制工作流](REVERSE_SKILL_WORKFLOW.md)。本批新路由为work/master-route-20261018-064925，实际PRIMARY为R2/mobile-reverse；保持既有work/sollin-ipa/scope.md，不重新初始化。样本SHA256为`c2ee2deba236ef1b9e097e1d8cdc0b816137aa57cf85d4c8e2811dae9924bc07`，App成员为`640c6112584c017b45141a038f7aa975224c8b540ef1aaec1f40939a6aa5c84d`。导入和依赖证据沿E001/E002，Dart3.12.2及NO_CODE_ANALYSIS工具限制见[IPA记录](SOLLIN_IPA_ANALYSIS.md)。原始字节、工具、索引与输出仅留忽略目录。

| 证据 | Finding → Path | 核验范围 |
| --- | --- | --- |
| E026，scene-color-evidence.json；SHA256 `a50461ab9407f2888a6117c6bbc36c4353c2153870b205dd817df8c8245be481` | F025 → P025 | 900原始ARM64指令、10选定BL、16池加载、3个原始getter；HSL软化、贴图和种子 |
| E027，scene-geometry-evidence.json；SHA256 `0510f691cd286e3b4c9832871832565c0a5986569ca71270555ec26e1dafb98a` | F026 → P026 | 1296原始指令、109BL、58池加载；四场构造、几何与绘制边界 |

E→F→P完整条目在本机case report/global-background.md，关联WI002及追加timeline，field-journal/scene-primitives-alias.md保留方法纠错。严格review为27E/26F/26P、8WI/54事件，零错误/警告；独立重放日志与不可变收据均保留。审查通过证明记录一致与哈希有效，数学结论仍由逐指令审阅负责。

在该固定本机案例下可重放以下命令；生成器只允许首次创建收据，不重复覆盖：

```bash
source scripts/environment.sh
python3 build/verify-scene-color-evidence.py
python3 build/verify-scene-geometry-evidence.py
node scripts/sollin-reverse-gate.mjs ipa --review
```

## 柔光、颜色与种子

HSL.fromColor及withSaturation/withLightness的原始字段支持饱和度与亮度身份。当s<0.06时，亮度改为Brightness枚举0的0.34，否则0.72；此处只记录枚举0，不声称实际恢复的用户主题。其他颜色的s′为`clamp(s×0.76,0.26,枚举0?0.6:0.48)`；L′为`clamp(L×0.12+(枚举0?0.32:0.62),枚举0?0.31:0.62,枚举0?0.41:0.74)`，最终经HSL.toColor返回。

贴图两轴循环均为144，中心/归一化半径72。令`r=sqrt(((x−72)/72)²+((y−72)/72)²)`，`u=1−clamp(r,0,1)`，alpha为`(u²×(3−2u))^1.15`。RGB写入round(channel×255×alpha)，alpha写入round(255×alpha)；为预乘RGBA。固定Dart SDK提交d684a576a6aa954ae107a03b2b4e1d61c3bebe93的ARM64 PRODUCT非压缩指针线程字段顺序独立支持LibcPow偏移0x738、LibcRound偏移0x768。它们是SDK交叉核验，未执行目标绘图或观察原始像素。

种子初始0x811c9dc5，对字符串的每个单字节或双字节code unit执行`((seed xor unit)×0x01000193)&0x7fffffff`。不能替换成UTF8字节或标准uint32 FNV输出并宣称等价；Dart Random精确输出仍未验。

## 四场与合成

构造循环固定4场，图片索引循环使用输入列表。每场有锚点、二维振幅、两个周期、相位、宽高因子及透明度。已核范围为：振幅x=0.15+0.1U、y=0.13+0.09U；周期x=9+7U、y=12+9U；相位2πU；宽因子0.9+0.22U、高0.62+0.18U、透明度0.62+0.1U。U代表有限随机抽样，未保证跨语言随机序列一致。全场旋转另有20+10U周期、2πU相位和±1方向，不能与单场周期混淆。

令a=2πt/x周期+相位，b=2πt/y周期+0.73×相位。横向运动为`sin(a)+0.38sin(1.65b+0.4相位)`，纵向为`cos(b)+0.34sin(1.35a−0.6相位)`；分别乘振幅、加锚点并按视图宽高缩放。令z=sin(0.82b+相位)，呼吸项q=1+0.12z，贴图矩形宽为maxDimension×宽因子×q×(1+0.08z)，高为maxDimension×高因子×q×(1−0.06z)。原始贴图实际输出及GPU插值尚未观测。

paintScene对透明度≤0.002返回；先绘制沿全场旋转方向、以中心±0.65×maxDimension为端点的双色渐变，再save→中心平移→旋转→1.12缩放→反向平移，按各场矩形绘制柔光图，透明度为场景权重×单场透明度，最终restore。上层paint以互补权重绘制旧/新场景，之后另绘主题相关的纵向覆盖渐变；运动关闭分支使用时间0和完整当前权重。仅绘制边界与有限数学已核，完整有效状态、过渡开始/结束及资源替换仍需关联生命周期证据。

## 工具与解释纠错

Color红色浮点getter分派索引2731的canonical名称是SystemTextScaler.textScaleFactor，但其两条原始指令仅返回字段0xf；结合Color接收对象与分派索引才支持r含义。绿色/蓝色索引2737/2725分别返回0x17/0x1f。去重函数名不能独自证明接收类型。

紧凑对象输出只给锚点横坐标0.12/0.88/0.32/0.82，未给完整纵坐标；部分Color分量也缺失，不能补成猜测值。E027不可变收据曾将标准Cubic控制点写为0.645/0/0.355/1；本次pool实际只打印0.645/0.355，因此其余两个控制量未被采纳为样本恢复结论。原收据保持不变，E027登记、Finding与timeline已明确这一限制。

## 原创实施的下一步

音枢应先记录五个固定参考的图层、资源、动画停止、Android及许可取舍，再设计有界原生柔光场景。可明确采用自己的锚点、随机与文字对比度策略，但必须与参考已核结构分开记录；不能把场景软化色直接替换现有语义文字背景。保留图片身份/迟到拒绝、缓存预算、全屏可见拥有者、暂停/缓冲、后台与减少动态效果门控，唯一队列和原生音频不变。新增实现需独立数学/原生与App像素、切歌、跨页、停止/恢复验收，之后分别做清洁归档和对应iOS27验证。

本批无产品改动，不增加A04完成度，不重复以打包代替播放验收。参考运行、完整视觉等价、能耗/帧率、真实服务、签名和真机均未验证。上一三色批次的本地验收及云端排队状态见[构建记录](BUILD_STATUS.md)，不由本报告扩展其结论。
