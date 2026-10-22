# 2026-10-22 接续核查

本轮为只读证据核查与文档校正，没有新增页面验收或产品改动。接入远端 deda55a 的封面身份等待修正（fast-forward），保留既有 Player/PlaybackProgress 与 r17–r20 未提交实验。

## 进度

正式工程估算沿用 80.14/106.70=75.1%（71%–77%）代码、56.52/106.70=53.0%（49%–56%）完整交付。剩余代码单位26.56；平台登录/推荐/FM、UI逐态收敛、原生后台下载、同步与系统媒体构成主要依赖和复杂度，不能以功能数量或439项测试计算百分比。该口径仍含UI骨架记账，严格UI验收敏感性下界67%/47%不作为新的正式进度。

4855/4856 的96.00/97.50只是冻结量表的固定静态状态评分，正常入口和动效仍待验；Phase 0 2/5不能换算为全UI40%。4854 r20记录S=53.50、关键区色差失败，未计完成。未新增重采，以上为既有回执核查，不是本轮测试结果。

## 视觉亲看与可行性

亲看原图 IMG_4854.PNG 与 r20c 候选（路径见r20回执）：封面和文案不同，候选歌词两行而参考三行，背景更淡；上一首/下一首尖角及评论气泡方向/笔画仍有差别。局部中心接近不能抵消这些缺口。r20c归因修正指出实际是主题渐变，旧规格solid不成立；应先修正状态声明并同口径重算，再做产品颜色调整。

仅IPA静态逆向不足以证明90%以上：可以校验字形、常量、页面语义和状态分支，不能唯一确定封面输入、字体栅格、材质合成、手势轨迹与运行时机。截图+同态夹具+IPA证据可继续把可比较静态状态收敛至目标；连续动效须参考与候选录屏逐帧验证。不可把截图采样的四段渐变当成已恢复的封面算法，也不能由控制区过线宣称整页通过。当前未提交的皮肤渐变仍是实验，不作采纳结论。

## Skill实际验证

本会话技能目录已列出 reverse-skill-router、mobile-reverse、apk-reverse 与 sollin-apk-reverse，项目两入口可读，无需另装副本，未修改Codex配置。

- 通用入口 `/Users/ningli/WorkSpace/NexusMusic/.agents/skills/reverse-skill-router` → 相邻reverse-skill/skills，固定cab634bd。
- APK专项入口 `/Users/ningli/WorkSpace/NexusMusic/.agents/skills/sollin-apk-reverse` → work/installed-skills/sollin-apk-reverse，固定1b94651b。
- 本次原生master-route分别返回mobile-reverse、apk-reverse；路由留build/reverse-skill/routes/audit-20261022-{ipa,apk}。
- IPA/APK case-guard与strict review实跑PASS，分别50E/42F/42P及3E/2F/2P，均0错误/警告；没有重跑case-init，没有新增功能逆向证据。
- APK doctor默认python3触发sys.stdlib_module_names错误；用既有Python3.12.14复跑生成有效JSON，exit3/status blocked。报告build/apk-reverse-doctor-20261022-audit-py312.json：缺adb、Frida/Capstone模块、签名工具及RASC等。skill可调用不等于完整设备/动态工具链可用。

## 交付与下一批

磁盘检查可用约15GiB，build约22GB；未发现xcodebuild活动进程。本轮没有删除任何产物，须先按引用清单识别可轮换副本后再清理，不删除逆向case或当前有效证据。

下一批先统一4854背景状态声明、核对封面输入和背景机制，再处理同态歌词及图标，依规范新目录重采/visual-lab/正常导航；阶段出口五态、本地归档与实际iOS27运行独立验证。当前GitHub连接器返回空workflow_runs，不能据此报告最新CI成功或队列为空，需补取得实际运行状态。

parse-completion工作树当前仅四行声明，无调用接入/测试，保持未完成；按主规范经典态后与平台纵向批次穿插推进，不把该工作树存在记作解析能力完成。
