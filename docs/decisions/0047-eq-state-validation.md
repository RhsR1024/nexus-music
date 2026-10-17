# 0047 EQ 权威状态与启用校验

2026-10-18。依据[控制器专项报告](../2026-10-18_reverse-sollin-eq-controller-report.md) E021/F020/P020，采纳前strict review21E/20F/20P、7WI/34事件、零错误/警告；另进程重放4433原始指令/18条BL及全部manifest哈希通过。仅采纳控件汇入权威状态、按实际前级/频段选中及前级独立归零；不复制参考0.06容差、曲线、商业配额或后端。

## 五参考比较

本批逐一核对固定HEAD，来源/许可见[参考比较](../REFERENCE_COMPARISON.md)；限定检索结果不是全仓能力缺失证明。

| 参考与固定提交 | 实现审查与取舍 | 维护、Android和许可 |
| --- | --- | --- |
| 悦音d6f1af7 | src内equalizer/preamp零匹配；不引入新音频栈 | Expo54近基线；根MIT/资源各自边界，Android音效另验 |
| Q547ccfe | SoundEffectControl.tsx:35–44有界增益/31预设与布局；nativeEqualizerAdapter.ts:4–22声明能力并await原生apply；SoundEffectPresetSaveModal.tsx:86等待保存 | 保留音枢±12dB/24预设、原子偏好和单DSP；RN0.73/fork维护成本，Apache2与第三方独立；能力声明不证明Android路径 |
| wtf6624ab5 | src内equalizer/preamp零匹配；无采用旧播放栈的理由 | 旧RN与原生模块分别维护，Apache2/第三方独立；Android原生DSP另实现 |
| Cybf0d469 | src内equalizer/preamp零匹配；沿既有令牌/单一播放意图 | 不引入Expo57/RNTP5；Apache2及原生许可独立；TS共享不等于双端音效 |
| 自有Wayferar8e47cdc | docs内equalizer/preamp零匹配，沿自有行为边界 | Android/smali权威与反编译Java区分，不复制车机后端，第三方独立 |

## 原创改动与验收

PreferenceStore.validate遗漏eqEnabled类型校验，字符串“false”等坏值可越过TS静态类型并进入持久化/订阅链。独立失败基线两项确认缺口，新增布尔校验；非法更新在写入及订阅通知前拒绝，坏持久化记录走既有restoreRecord原始隔离。缺失的旧字段沿默认false，合法true/false可恢复，关闭保留曲线/前级，写入失败保持旧快照。

现有UI已通过同一PreferenceStore、序列写入后通知唯一native.configureEQ；卡片按全部实际值精确选择、前级归零独立、重置全部曲线和前级，保持行为。App专项补启用/关闭重启、前级归零保留频段、自定义重应用和重置选中平直；不声称开关UI证明实际声音，既有C++真实RMS/逐样本旁路另运行。

两项独立失败基线确认后，350业务/类型检查通过；正式App1792266325928的EQ184.998秒通过、零失败/跳过，亲看平直曲线与选中截图。完整native-eq-state.log exit0（既有Swift Sendable警告），C++实际RMS/逐样本旁路及真实合成解码等通过。临时基线TS文件导致的一次typecheck导入失败已保留，改留.txt后完整检查通过。无新原生后端/依赖，清洁归档/push/对应云端待。真实服务/签名/真机及参考完整后端/运行等价继续。
