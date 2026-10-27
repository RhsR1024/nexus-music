# 用户持续保存目录：采集前场景

复用已有E-830→F-023→P-021保存位置能力，iPhone用系统选择目录和设备内书签；与扫描授权分开，不复刻Android路径。选择/更换对后续新任务生效；旧任务通过明确另存动作使用当前目录，已写用户副本不随移除授权/删除音频而删除。

正式下载设置→系统目录选择/取消→选择本次测试拥有目录→重启显示名称→公开V261020来源曲目正常重新下载→托管附加完成→自动音频/LRC/JPG/meta保存→重名组同后缀/重试幂等→停止授权。检查原MP3及各文件摘要、扫描授权未改、原权威队列保持；只看实际公开媒体界面，不使用合成截图。过期权限、部分失败/恢复及用户修改保护由原生/业务契约补验，不能冒称真机或实际云盘验证。

430×932pt/1290×2796px（3x），无掩码，按钮最小44pt，目录名称/忙碌/失败可访问，正常导航和虚拟任务列表；绑定精确源码/构建/输入/截图及实际文件hash。无录屏不报动效一致；真机/文件提供器差异独立验收。

## R6阶段实际采集绑定

R6 `SourceUITests-1793103121140.xcresult` / Release / 1/0/0 / 170.331秒；实际V261020来源公开曲目，430×932pt=1290×2796px，无掩码。`build/download-destination-live-20261027-r6/`内manifest、candidate.patch、screens/index、provenance-verification、physical-verification与八个真实用户副本分别留存；十一张PNG亲看，全部provenance ready，当时源码digest一致（后续以R7为准）。

源码digest：`8f2e5eb04c08b5d754fc7e15927586d51b3de9afad17659a871ce0a8b2e6faa2`。

| 索引 | SHA256 |
| --- | --- |
| run-manifest.json | `17e864f1227b184764bf7bc4d726bb44e5ccbf132fae89c1ba221fd75ddc8f2e` |
| screens/index.json | `8bbf1eee3320ad615947f1872cd52c7f9c63abb2852f52dc63b10beb9c302c54` |
| physical-verification.json | `cdbb74407978a59fa6723df607ce0f52d01a236e4abfea9ce116b00ffa7d1be4` |
| provenance-verification.json | `70a65e9f37cdd01b8cbdb2cf368a84286ffc9a30cd383076e5924743fd538430` |

原图按3x检查目录摘要、选择/更换/停止按钮、正常列表完成/另存状态、长文件名与统一后缀；App按钮沿用44pt最小目标与主题令牌，文字无遮挡且正常滚动可达。系统目录选择器按系统材质/控件验操作，不将其36pt工具栏当作音枢自绘按钮。已执行下拉关闭及正常重新打开，但无录屏，不报转场一致。默认blush/rose随真实封面取色，不作不同内容的像素/颜色评分。R1/R3/R4/R5失败及R2较早通过均保留，R6仅作为当时目录源码验收，最新源码以R7为准。

## R7最终源码绑定

最终Release `SourceUITests-1793106626782.xcresult` / 1/0/0 / 207.198秒；十一张真实媒体PNG全部亲看、provenance ready，八个实际副本与两份原始音频摘要、扫描授权/权威队列保持。源码digest `9c28a70070fe58da62de428fd63b8a2280a62b79dcb790f8c4effc95d9351803` 与离线恢复专项最终R5完全一致；后者只作功能回归，未查看夹具PNG。R7沿用上方3x/无掩码与正常导航验收范围，不新增像素/动效完成量。

| 最终索引 | SHA256 |
| --- | --- |
| run-manifest.json | `802f3c5b23d161cb33931428563eb3fdd840d81bd52b58831e2a32bfc55660ca` |
| screens-final/index.json | `1f00a5f1399352e85d1c3acff7cc108b0410eb9c5aef28072e3e98344e346a67` |
| physical-verification.json | `10253beda95a1e09a5cb4609a0bcf87bbb5094e69498beec42a9bf20d1b5cda4` |
| provenance-verification.json | `e9ef5c5b55d0d46d26575f738f5adc3b7dec615dfff5e3c19c3ac8c6e2e90169` |

文件均在`build/download-destination-live-20261027-r7/`，使用精确结果包与新输出`screens-final/`，未使用latest或覆盖旧基线。
