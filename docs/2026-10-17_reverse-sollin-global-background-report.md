# Sollin 全局背景静态关系与音枢独立动效报告

2026-10-17；普通移动逆向，flavor=null。对固定IPA做离线容器和限定ARM64指令核验，找到了默认页面容器到全局背景的设置链。本批可支持两个开关独立、流动优先的原创重实现；未恢复完整场景动画或参考运行结果。音枢保留主题图片、写真、播放页动效、语义文字和唯一播放器。

## 范围与来源

用户授权的本地离线样本，scope位于忽略目录`work/sollin-ipa/scope.md`，auth=granted/network=offline；无私有服务探测、注入或签名安装。技能固定cab634bd855fc287f6e420c1f36fd1a6b9245960；macOS路由`work/master-route-20261017-212939/route-scope.md`实际PRIMARY为mobile-reverse。项目预检及采纳前严格review通过。原始证据/截图/样本不提交。

IPA SHA256 `c2ee2deba236ef1b9e097e1d8cdc0b816137aa57cf85d4c8e2811dae9924bc07`；App.framework/App SHA256 `640c6112584c017b45141a038f7aa975224c8b540ef1aaec1f40939a6aa5c84d`。重新检查ZIP CRC、FAT arm64、Mach-O段边界。下列地址是slice VA，__TEXT内VA=file offset，原始FAT成员再加0x4000；不使用字符串地址作函数入口。

工具为索引Python3.12.14、Capstone/cstool5.0.3，以及Blutter实验iOS固定0039efb1/Dart3.12.2 d684a576a6aa954ae107a03b2b4e1d61c3bebe93。NO_CODE_ANALYSIS输出仅为对象/函数骨架；本次另外用原始字节解码BL与分配桩，不冒称完整反编译。基础依赖/snapshot锚点沿E-002/E-008，本批未引入新的外部依赖或原生调用。

## Evidence→Finding→Path

| 项目 | 可复核观察 | 边界 |
| --- | --- | --- |
| E-010 | `evidence/global-background-evidence.json`，SHA256 `45ca9351edec5afd7e2663c1dd3526e883bb4ece186b7d4ddfd0b56db54c58b1`；生成脚本`notes/global-background-evidence.py`，固定本机样本路径，仅离线重放 | 收据不可覆盖；重放使用新的输出收据。原始输出只留本机 |
| F-009 | info/design/candidate，high；同时引用E-009/E-010；ThemedPageScaffold.build0x52a2dc与AppThemeBackground.build0x7a60e8 | 静态结论，未提升为参考运行等价 |
| P-009 | callflow：全局容器watch设置→已核分配对象→独立流动/封面分支→音枢分别控制与验证 | 精确媒体字段、完整动态树/调度仍待 |

1. 容器在0x52a524读取封面provider静态槽0x2900，在0x52a56c读取有效流动槽0x2918，并分别watch；0x52a608调用0x3311b0，保存两个布尔值和一个封面参数。
2. 分配桩0x3311b0头为0x100241c；固定Dart raw_object.h使用8位起始的4位SizeTag和随后20位ClassId，因此头右移12对应4098，与AppThemeBackground骨架一致。共享分配0x9739e8在0x973a04实际写入x2为对象头，避免将任意常数当类ID。另两桩对应4539/ArtworkFlowBackground及4536/BlushingBeautyPlayerBackground。
3. AppThemeBackground先分别计算封面开启/非空参数条件，再独立检查有效流动和非空参数，0x7a696c进入流动对象；否则0x7a69bc进入封面回退。容器另有自定义背景分支，不将默认路径泛化为所有页面。
4. 有效流动0x335e20先读取raw flow槽0x2910，之后读取AuthState并调用0x1ce5d0/isActivated。这一商业激活依赖明确排除，不复制到音枢。songDynamicCover槽0x2908仍独立，不把本次流动当动态视频封面。

前批`resolveCoverTheme→loadResilient→apply`属于ArtworkSummaryState的纠正继续有效；本次全局链由新的原始指令支持，不能倒推此前未证明的算法。没有给容器0xdf/0x97/0x17等字段强行命名为已核验匹配媒体字段。

## 音枢采纳与验证

按[0039](decisions/0039-independent-global-background-motion.md)增加独立全局开关和向后兼容迁移，复用现有CoverThemeStore/权威媒体身份、原生Animated和有界语义配色；未采纳参考源码、场景shader、商业逻辑或品牌资产。五参考逐项比较见该决策及[参考比较](REFERENCE_COMPARISON.md)。

331项业务与类型检查通过。首轮新增检查发现流动单开时次要文字对比度不足，已修复语义色；图片拒绝时空快照规范化，迟到颜色不复活坏图。独立开关、旧偏好四组合/保存失败/显式false重启、调色失败与极端封面对比度均有覆盖。实际App、本机unsigned归档及云端分别更新[BUILD_STATUS](BUILD_STATUS.md)，未完成的检查不会当作通过。

## 时间线与未完成项

案例timeline新增21:33静态阶段，WI-002更新E-010；严格review为10E/9F/9P、7WI/15events，零错误/警告；案例field-journal记录分配头核验方法。全局算法精确参数、动态生命周期/场景行为、低电量/真机功耗、动态视频封面和其余A03/A06–A09继续取证验收；平台登录、真实推荐/FM/识曲、原生后台下载、完整迁移及签名/手机范围保持。

本批App回执：正式App1792244188543.xcresult两项通过、零失败/跳过：全局红蓝/跨页/独立开关/暂停重启189.767秒，Files图片导入/播放背景持久化112.398秒；亲看全局流动单开设置与发现页截图。测试证明颜色/优先级/保存行为，不冒称实际动画帧率或参考shader等价。清洁归档/push与云端继续依BUILD_STATUS更新。
