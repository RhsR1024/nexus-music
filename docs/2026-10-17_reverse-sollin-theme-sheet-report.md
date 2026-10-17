# Sollin 主题弹层边界与音枢软件主题

2026-10-17，A03/A04/A06；mobile-reverse PRIMARY，docs-generator普通逆向报告flavor=null。

## 结论和范围

固定IPA的原始ARM64直接调用确认软件主题和主题编辑包装使用共用ModalBottomSheet；音枢本批把已有软件主题三态选择移为原生Sheet。主题数据、选择后立即持久化和关闭后保留分类是音枢自己的实现选择，不据静态调用推断参考保存/取消语义。

scope、WI-002、timeline与原始输出在本机忽略目录`work/sollin-ipa/`。本批不运行参考App/私有服务，不签名安装，不执行生成的注入脚本。固定样本/工具、独立FAT段校验和NO_CODE_ANALYSIS限制沿[设置对象报告](2026-10-17_reverse-sollin-settings-objects-report.md)。无新增工具安装或全局配置。

## Evidence → Finding → Path

| 节点 | 内容 | 限制 |
| --- | --- | --- |
| E-009 | `evidence/theme-sheet-evidence.json`，SHA256 `ce7e66f65f7ad870dda27b5607533702d88adbb19d7e09ddb8f93813abb0c7cd`；原始BL、对象归属和有界反汇编摘要 | 只读离线；没有完整动态树或参考运行 |
| F-008 | info/high/candidate，两个主题包装到共用弹层的关系 | 不采纳精确尺寸/默认值/关闭保存策略 |
| P-008 | 固定容器与对象→限定原始调用核查→音枢原创既有三态Sheet→独立验收 | 不宣称全局封面算法已恢复 |

采纳前严格review通过9E/8F/8P、7工作项、14时间线事件，零错误/警告。工具脚本完整输入/输出摘要在本机manifest，坐标为slice VA；该__TEXT的slice file offset=VA，IPA成员raw offset加0x4000。pp标签不视为文件offset。

| 直接调用 | 指令位置 | 目标 |
| --- | --- | --- |
| `_showThemeSettingsSheet`0x3a679c | 0x3a67f0 | `_showThemedModalBottomSheet`0x330370 |
| `_showAppThemeModeSheet`0x3a6858 | 0x3a68a4 | 同上 |
| 共用包装0x330370 | 0x3306e0 | Flutter `showModalBottomSheet`0x3306f8 |
| `_ThemedPageScaffoldState.build`0x52a2dc | 0x52a328 | `_effectiveAppTheme`0x3311ec |
| `_effectiveAppTheme`0x3311ec | 0x331280 | `AppThemeSettings.resolveFor`0x33129c |

另核查`AppThemeBackground.build`0x7a60e8调用baseUnderlayColor、gradientColors、effectiveGradientAngle、gradientBegin/End。resolveFor原始指令处理mode/backgroundKind及copyWith；这并未证明封面取色与全局主题相连。E-008的ArtworkSummary归属纠正继续有效，A04继续待查。

## 复现

先按[门禁](REVERSE_SKILL_WORKFLOW.md)读取PRIMARY、工具索引和现有scope。从项目根执行，使用索引Python3.12.14：

```sh
source scripts/environment.sh
node scripts/sollin-reverse-gate.mjs ipa
/Users/ningli/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 work/sollin-ipa/notes/theme-object-validation.py
/Users/ningli/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 work/sollin-ipa/notes/theme-sheet-evidence.py
node scripts/sollin-reverse-gate.mjs ipa --review
```

完整机器码仅留忽略目录，仓库只存必要脱敏结论。上游实验工具的骨架输出不称完整反编译；有界直接BL不覆盖虚调用和数据分支。

## 原创实施、参考和验收

五参考固定提交、许可和具体源码比较见[决策0038](decisions/0038-theme-mode-sheet.md)。无参考代码/资源/依赖移植。软件主题使用音枢现有pageSheet和PreferenceStore，底层分类隐藏AX/触摸，44点关闭、滚动内容和系统dismiss；保留唯一主题状态、队列与播放意图。Android复用设置契约，原生模态分别验收。

本批328项业务/类型通过；正式App1792242348845外观持久化71.145秒、分组导航95.341秒两项通过；1792242792269最大字号/下滑关闭/重新打开保持选择37.400秒通过，均零失败/跳过。已导出亲看常规及最大字号截图，三态/选中/关闭可达；首轮新增测试编译类型错误已修正且保留失败日志。最终文案收口后1792242979329同专项38.790秒再次通过并亲看截图，类型复验通过；清洁设备归档与本批云端结果见[BUILD_STATUS](BUILD_STATUS.md)，未出结果不提前记为通过。参考运行、iOS27、真实服务、签名及手机验收独立记录，全部F/J范围与先对齐后新增的顺序保留。
