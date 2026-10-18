# 0059 Swift 配色测试类型推断收敛

日期：2026-10-18。属于 A10 云端失败修复，保留 A04 及全部 F/J 计划。

`ce192a4` 的 iOS27 运行 [39094486501](https://github.com/RhsR1024/nexus-music/actions/runs/39094486501) 在原生测试编译阶段失败。官方 job117587142705 日志明确定位 `tests/native/AmbientSceneTests.swift:106:7`：Swift 无法在合理时间内完成组合表达式的类型推断。该运行没有进入 App 测试或 IPA 归档，不能作为背景产品行为失败或成功的证据。

首轮dfd304b仅按行号误定位，拆分了中心RGBA像素表达式；该变化保留原字节断言但没有修到首因。后续39098201855官方job117588982532明确打印原始主题覆盖层表达式：`zip(overlay.map(\.alpha), dark ? ... : ...).allSatisfy(...)`，仍在Swift类型推断阶段失败。现在将预期alpha和颜色分量显式声明为`CGFloat`，逐项验证两个实际覆盖层，仍保留原四个alpha值、明暗分量与1e-12阈值，并增加数量相等检查。原中心RGBA拆分只保留为可读性变化，不称云端首因修复。没有改变原生场景、颜色数学、测试向量或运行预算，没有新依赖或参考代码移植。Xcode26.3 的本地结果和 Xcode27 的后续结果分别记录，不能由前者推断后者已修复。

较早的 [39086161205](https://github.com/RhsR1024/nexus-music/actions/runs/39086161205) 仍在旧统计基线断言失败。包含统计修正的 `557999a` / [39091013423](https://github.com/RhsR1024/nexus-music/actions/runs/39091013423) 核心组为22通过/1失败，统计专项264.919秒通过，唯一失败为三色背景实际边缘像素断言。不能将统计成功扩展为该运行整体成功，也不据此认定三色失败根因；其诊断 artifact12125242479 尚未下载/核验，原始 API 摘要和官方日志摘录保留本机忽略目录。

本批继续复核 E032 不可变字节/数学收据及 reverse-skill 严格 review；这只保持既有配色采纳依据，不新增参考运行或三色失败结论。真实服务、签名、真机、完整 A04 与剩余 UI/功能仍待。

本地 `check-ambient-swift-inference.log` 为368/368，`native-ambient-swift-inference.log` 完整套件exit0，包含原32向量/贴图/合成断言；现有Swift Sendable警告保留。E032字节与20独立向量复核、32E/31F/31P严格review零错误/警告通过。清洁归档及新云端终态继续记录。

修正定位后的本地 `native-ambient-inference-corrected.log` 原生场景专项通过；Xcode27仍需新提交实际验证。39098201855没有进入App/归档，不能改写为通过。

云端分项回执：b6f66a2/39104211437的官方jobs API确认checks、Apple Silicon/iOS27工具链和完整Native contracts and audio processing步骤均success（本机build/ci-presentation-jobs.json）。这才是实际overlay表达式修正后的新云端编译/原生测试证据；不把原dfd304b失败改写为通过，App、iPad与归档仍按整次终态分别记录。
