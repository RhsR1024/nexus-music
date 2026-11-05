# 播放器自定义睡眠滚轮有效输入

播放器“开始定时”此前把自定义0小时0分钟直接传给原生睡眠服务，产生`configureSleep(0)`，结果清除已有活动计时或本曲后停绑定。完整设置页已有“至少1分钟”校验，两个入口行为因此不一致。本批在睡眠面板增加确定性校验：零值显示“请选择至少1分钟”，不调用睡眠服务；明确“取消睡眠定时”按钮与原生零秒取消语义保持不变。

`customSleepSeconds`集中校验0–24小时、0–59分钟整数且总量大于零，接受1分钟和24小时边界，拒绝负值、60分钟、小数、25小时和非有限值。滚轮作为正式可调控件暴露当前分钟/小时值；选择变化时滚到对应行，无惯性拖动与惯性结束都提交真实停靠行，避免视觉值改变但开始仍读取旧值。

## 正式验收

`testSleepCustomWheelsPreserveActiveTimer`从真实本地音频导入、播放器和“更多播放控制→睡眠定时器”进入，不注入定时状态。Release`build/SourceUITests-1793865127400.xcresult`为1通过/0失败/0跳过、121.710秒、exit0、`sourceUnchanged=true`。实际流程：

- 15分钟预设在原生计时启动后真实滚轮回到0/0，开始定时显示准确错误；剩余约14:40且继续递减，取消入口保留。
- 滚轮升到1小时并开始，原生倒计时落在约60分钟；回到0小时并升到1分钟，倒计时落在约60秒。
- 明确取消恢复“未开启”；开启本曲后停，再选0/0并开始，错误出现且仍显示“本曲播放结束后停止”。

四张1290×2796截图均通过`verifyCaptureEvidence`且已亲看，覆盖活动计时拒绝、小时启动、分钟启动和本曲绑定拒绝。

- source digest：`0fa7fe262519224a4f4813ea821fd40125a2ccd5f3c7a8add80bd9a4c09873e8`。
- 安装bundle digest：`d1e7849579787431a090f9f9658c81a3b48fe8890f38ef911f5af5bee32252d9`。
- result Info SHA-256：`77854b4571d341fc4c8f51dbea694501ca0f312237912a530942c982f9dbf09f`。
- run manifest SHA-256：`243806eb3fb1ebbc8351d76cbd199975716e7a6018e44ad0332e1cd4a20bbbd2`。
- 截图索引SHA-256：`981dddbe4a8754a9b79592bc5b7dee6ed0b0f495c423e02cc0af955d1a10540a`。
| 文件 | SHA-256 |
| --- | --- |
| `001-Sleep-zero-wheel-input-preserves-track-binding.png` | `f475780dcbbc23b32f20984f4f987084985bbcdbb415f9f2a043eca667bb3a60` |
| `002-Sleep-custom-minute-wheel-starts-native-deadline.png` | `1512313ef3c27674790d13cc1a65237ae54dd1bb5bfbd38f907c4961ccb3b981` |
| `003-Sleep-custom-hour-wheel-starts-native-deadline.png` | `a64eb0af0468c296007b0e640e720c6bd0afbd53630eb1cb4e5141343dfa0095` |
| `004-Sleep-zero-wheel-input-preserves-active-deadline.png` | `59e03f125af126e64667c85bdbf59552e062f217df23d0fa69a9e844c009954e` |

单元测试3/3先覆盖零值/无效行/有效边界；完整`npm run check`1035/1035通过（最终日志SHA-256`6e8700950adcacc79d0f23392c43d525dd79b6ed98fa7c5b40dcc86fdadc4a51`）。完整`npm run test:native`退出0，继续覆盖原生零值取消、替换、曲末绑定、一次触发和实音到点/切歌边界；既有Sendable警告保留，日志SHA-256`51bfcdb0fafaf187b1df72755f6af8b1f8c4ba434dc89b16c8b05945fd7c4e0d`。Swift解析、Node语法和diff检查通过。

正式重验：

```bash
source scripts/environment.sh
export NODE_OPTIONS= PYTHONPATH=
node --experimental-strip-types --test tests/sleep.test.ts
NEXUS_UI_RUN_DIR=build/sleep-wheel-independent node scripts/test-ui.mjs NexusMusicUITests/SourceSettingsTests/testSleepCustomWheelsPreserveActiveTimer
```

## 范围与后续

本批音枢原创输入修正与现有可调控件语义，不是Sollin私有服务探测或参考代码移植。reverse-skill R2/mobile-reverse路由及IPA/APK离线scope门禁通过，IPA严格review为58E/23WI/125 timeline/49F/49P、0错误/0警告；无新增样本分析或证据结论。

J29仍保留实际自然到期暂停、播放中手动切歌组合、长时后台、实体手势/VoiceOver/动态字号、真实私人服务、签名和iOS27终态。合成音频和模拟器不能替代这些验收，不能据此关闭J29或全项目。

## 清洁设备包与T7

产品提交`925befe641783bf4c052cc8c1f499bbc45cb3f3e`的clean unsigned archive通过，manifest与提交一致、`dirty=false`、`workingTreeChanges=[]`、arm64/iphoneos26.2/iOS15.1/[1,2]、`signed=false`。独立核验90个ZIP项CRC、63份载荷逐字节、生产`customSleepSeconds`标记、测试/私人标记排除和未签名状态，`ready=true`。历史distribution符号链接已恢复，6个顶层文件内容/字节/mtime未变。

- IPA：17,822,849字节，SHA-256`572dffa50f773141e52c9aafe5ecfb2ecbd93c610568e4f40f6046150d94cc39`。
- manifest：`44b9062528cca6ed88736506a03a0a1840a19414ccb1688ede2e6dccdbaaa5fb`。
- verification：`787cf3a6b515f1904e15ed18cb3a9bc9d088f5f8d1b6f2cd547c2f4983bd1942`。
- 源码tar：8,090,830字节，SHA-256`4a2a464c94eef1f098c80e4e76b19cee0d1bcbe8f22e7f61e307bbed2c94dfcb`；Git树1,099条目模式/blob一致。

T7阶段`/Volumes/T7 Touch/NexusMusic/BuildArchive/2026-11-05-sleep-wheel-925befe`保存clean分发/xcarchive、源码tar/提交补丁、精确Release/xcresult/四图/来源与运行清单、检查/原生/门禁日志、路由和报告快照。145份业务文件/107,099,756字节逐项SHA-256一致，0差异、源保留、零删除；清单`4f19e71179b8cafc362f3ccffc3b3a79adaf06d49e7ba057a363e64b9308ead7`，transfer receipt`afe913864054d3d288b558bcbfdb76246367c639a00ae85437e13e64f5df1efa`。依inventory相对路径恢复，源码可由tar/提交重建。正常push与新云端随后核验。
