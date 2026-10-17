# Sollin EQ 页面边界与音枢预设卡片

2026-10-17，A07 / J31–34。按 `docs-generator` 普通逆向模板（flavor=null）记录；本批只对齐已有功能的界面，不宣称完整逆向或运行等价。

## 结论与范围

固定 IPA 的静态模块、预设仓储与曲线几何词汇支持继续研究独立 EQ 页面；用户补充截图02/07支持双列预设卡片、小曲线、勾选状态和自定义空态。没有恢复对象引用、调用图、预设真实参数或运行默认值。音枢继续使用自己的七组预设、十频段 ±12dB、前级、24个命名预设仓储和同一原生 DSP。商业预设配额、参考代码及图片不采纳。

授权 scope、工作项和时间线保存在本机忽略目录 `work/sollin-ipa/{scope.md,workitems.md,timeline.md}`：仅用户提供离线样本，网络服务、凭据与真机运行不在本批分析范围内。包固定提交与工具路径见 [REVERSE_SKILL_WORKFLOW](REVERSE_SKILL_WORKFLOW.md)；PRIMARY 为 mobile-reverse。

## 可复现证据链

样本为 Sollin iOS 2.0.0 build60，SHA256 `c2ee2deba236ef1b9e097e1d8cdc0b816137aa57cf85d4c8e2811dae9924bc07`。基础 Mach-O/snapshot/依赖检查沿 [IPA专项](SOLLIN_IPA_ANALYSIS.md)，本批未新增导入函数或依赖结论。Dart AOT 数据中的 UTF8 标记仅以原始文件偏移记录，不能当作方法入口。

| 节点 | 来源与结论 | 限制 |
| --- | --- | --- |
| E-007 | 本机 `evidence/equalizer-ui.json`，固定 IPA App.framework/App 的 panel/settings/preset/curve/storage词汇和截图02/07摘要 | 只读提取，不推断共存字符串之间的调用关系 |
| F-006 | info / medium / candidate；来源E-007；位置为JSON中的raw offsets和截图摘要 | 确认模块词汇和视觉目标；真实增益、默认值、存储算法未证实 |
| P-006 | callflow类别的采纳路径：校验E-007→按F-006限制采纳视觉→独立验证音枢交互 | 是实施证据路径，不是恢复出的参考运行调用图 |

本机复现：

```sh
source scripts/environment.sh
node scripts/sollin-reverse-gate.mjs ipa
python3 work/sollin-ipa/notes/equalizer-ui-evidence.py
node scripts/sollin-reverse-gate.mjs ipa --review
```

E-007 source content_hash为 `f96bd77d0735fef71862ae9195c396ed8dda9ff09f5866eed0a08da44c80cc88`，对应 `work/sollin-ipa/evidence/E-007.md`，原始样本、JSON和截图不提交。采纳前严格review为7E/6F/6P、7工作项、9时间线事件，零错误/警告。时间线追加了静态提取、亲看截图和严格review后的独立实现；实现验收另记，不回写成参考运行事实。

## 固定参考比较与实现选择

五个本机参考HEAD均与 [REFERENCE_COMPARISON](REFERENCE_COMPARISON.md) 固定表一致。复核Q-1515 `src/components/player/SoundEffectControl.tsx:38` 的增益/上限以及声明式预设职责；其 ±15dB、31个预设和原生音效adapter不迁入。悦音、wtf、Cy当前 `src` 和Wayferar当前 `docs` 的 EQ/preamp限定检索没有匹配，沿 [0014](decisions/0014-graphical-eq.md) 保留已有行为参考；不据此断言完整仓库无该能力。

原创 `EQPresetCard` 绘制当前预设的十个控制值；连接线是设置示意，非测得滤波响应。选择依据实际十频段和前级完全相同，修改任一值即重新计算，避免保存过期的“选中名称”。预设卡片为一个可访问按钮，装饰图不进AX树；至少54点高。容器窄于300点或字体缩放超过1.4时单列，文本自然换行。自定义预设同样展示曲线、实际计数和可达删除按钮。

没有新增依赖、参考源码/资源或第二播放器。TS界面与设置模型可用于未来Android，当前iOS模块注册、音效、系统音频和真机验收边界不变。

## 验收与未解决项

类型与328项业务测试通过，最终配色改动后类型再次通过。正式入口App `1792237003989.xcresult` 单项92.800秒通过，覆盖双列/选中切换、只改前级后的取消选中、真实曲线拖动、自定义保存/重启/应用/删除和睡眠定时；`1792237149089.xcresult` 最大辅助字号单列专项30.615秒通过。两次均零失败/跳过，亲看最终浅色面板/卡片、自定义和大字截图；已修正旧EQ深色固定面板在浅色主题中的对比度问题。大字专项加入云端原回归组。清洁本地设备归档、对应云端iOS27结果写入 [BUILD_STATUS](BUILD_STATUS.md)。本批无DSP修改，既有真实RMS/旁路测试不替代本批UI检查；参考运行、真实设备音效和签名不因本批成功提高完成度。

后续继续恢复设置/背景对象关系并收敛A06–A09；平台登录/推荐/FM和其他F/J任务保持原范围与顺序。
