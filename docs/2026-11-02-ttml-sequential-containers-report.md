# 2026-11-02 TTML 顺序时间容器阶段回执

本批扩大原创有界歌词解析器的 TTML 子集。`timeContainer="seq"` 首个子项相对容器起点，后续子项以前项活动结束为同步基准，保留嵌套 `par`/`seq`、显式 begin/end/dur、父边界夹紧，以及 agent、背景声、翻译、罗马音。未指定容器仍为 par，纯文本匿名跨度在 seq 中为零时长；纯文本 p 的默认 par 匿名跨度维持父活动区间。根节点 `xml:space` 继续继承。未知容器、负时间、倒置区间、DTD/实体展开与原有深度/字数/文件预算仍拒绝。

依据是已核对的 W3C TTML2 12.2.4、12.4 和 SMIL 3.0 顺序容器规则，来源与支持边界见[决策0015](decisions/0015-ttml-native-lyrics.md)。没有新增第三方实现或依赖，没有新增 Sollin 采集或结论；本批不是 Sollin 证据采纳，不伪报新 strict review。唯一权威队列及播放意图保持。

## 验证与边界

- 最终 `npm run check` **973/973、0失败**，其中歌词专项17项；新增6个测试覆盖顺接、相对起止、嵌套、父边界、可选字段、根空白继承、纯文本段落和 normalizeLyrics 对有效seq TTML的优先采用。`git diff --check`通过。
- 接续前完整 `test:native` 与 `ios:build`已通过；接续复核后仅修歌词TS与测试，最终Release UI和clean device archive再次编译通过，没有变更原生实现。
- 初轮 `SourceUITests-1793588025944` 1/0/0。复核修正根空白继承与纯文本段落时长后，最终 `SourceUITests-1793588385895` **1/0/0、145.643秒**，`sourceUnchanged=true`，Release / iPhone15ProMax / iOS26.3.1 x86_64模拟器。
- 正常跨平台歌词UI验证原有坏TTML→LRC富歌词回退、舞台定时组、手动歌词选择、暂停音频不变、偏移/重置、完整歌词展开/收起与夹具清理。**该UI用例不提供seq TTML；seq精确时间及有效富字段优选由单元测试证明，不称其为seq端到端或真机验收。**
- 2PNG逐张provenance ready并亲看；源码digest `f02c75f004d3f6f9237cf7b8945c60d4c51f20ef4fdbc398d70144e04b6df9e6`，fixture `58b48953521ea0c7d6a2737de2b31d92342ec5115e39255c9bfe7dade577b07c`，安装bundle `f5b7f9421b48ea302b4099f2a3ba8060d8e303dfe2b0f58f961831bf10884d03`，xcresult Info `aa8061c91c70bd2497db957c32b288d1c79bfffa4f550843a0d19b0a6da241e6`。截图及全部来源位于 `build/ttml-seq-cross-platform-20261102-r2/`。
- 先前误将`--help`当测试目标的exit70原结果保留；本次截图导出曾输入不存在的结果路径，脚本拒绝且无导出，改用manifest中的精确结果后成功。这些均为命令用法问题，不是产品失败。

## 清洁IPA与空间维护

功能提交 `050979f50371446539d2782696b877fcd863d6e6` 的manifest为dirty=false、workingTreeChanges=[]、commit匹配。最终包 **12,889,116字节**，SHA-256 `240ea23a066808e6ee3d1b5d16e87826f5fc900164207a384b21af3a34264996`；arm64 / iphoneos26.2 / iOS15.1 / [1,2] / com.nexusmusic.app，未签名、无描述文件。164项ZIP CRC和138个archive/IPA文件逐项字节一致；新解析器生产标记存在，旧“seq暂不支持”标记不存在。

`fixture-secret`、`private.invalid`、`matching-audio`、测试adapter、私人备份/资源路径及私人token标记排除通过。既有绝对构建路径元数据保留在包内，不把此项写成全部路径均已剥离。机器回执 `build/logs/ttml-seq-archive-verification.json` 与验证脚本保留。

阶段完整副本 `/Volumes/T7 Touch/NexusMusic/BuildArchive/2026-11-02-ttml-seq-240ea23a/` 共 **57份/26,398,750字节**逐文件SHA-256一致，含IPA/manifest/验证、两轮UI日志/manifest、最终xcresult、截图及检查日志；本机原件保留。`copy-receipt.json`记录每个源/目标、字节、哈希与恢复方式。最新两个有效阶段为240ea23a、c3c49b95，旧成功内容快照未盲删。

收尾内盘可用约 **52.75GiB**、T7约 **606.57GiB**；本机CoreSimulator约33GiB为活动设备内容。无空间紧急状态，未新增删除/移动；清理决定与保护范围见`build/logs/cleanup-2026-11-02-ttml-seq.json`。此前5份闲置安装日志已完整迁移的22.70GiB维持原回执，不能重复计算为本次新释放。项目外用途不确定个人文件只迁移保留，不直接删除；当前构建/工具链和reverse证据不纳入缓存回收。

## 后续

push前远端main为0b733e2，最新iOS27运行41378728355/2abb0b6仍in_progress、无pending；checks/native已通过，App回归执行中。正常push及新队列核对在交付后补记，不取消运行中、不重派旧版本。

完整TTML2（外部资源/样式布局/时钟基准等）、真实TTML库矩阵、seq端到端显示、实体机/签名及云端iOS27终态仍待。S4/J35–42和全项目不据此完成。

## push与队列核对

`0b733e2..38af8c4`已普通快进push到`RhsR1024/nexus-music`，远端main实读为`38af8c4067fd3767e3ee66f96c59599de15463af`。同iOS27 workflow/main分支API实核：`41378728355`/`2abb0b6`继续in_progress，`41381592614`/`38af8c4`为唯一pending，**1运行/1排队**。没有取消运行中或手动重派；新运行包含本批代码，终态尚未通过。本段后续文档提交受Markdown路径忽略，不为追平文档SHA重派构建。机器快照保留在`build/logs/ttml-seq-ci-postpush.json`。
