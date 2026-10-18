# Sollin 截图归档与播放器构图对齐报告

2026-10-18，普通逆向补充报告，flavor=null。31张用户截图原字节归档，沉浸/声波核封面裁切和黑胶主体尺寸进入原创修正。IPA的独立renderer与有限黑胶几何仍是主要证据，截图仅补构图观察。本批不恢复完整Sollin绘制或动态运行，不宣称AM/写真/舞台/设置已对齐。下一按逐图矩阵先处理AM完整封面和正文切换，再写真、舞台和选项。

## 范围与来源

沿本机`work/sollin-ipa/scope.md`的granted/local_mobile_package/offline授权，追加用户指定截图目录，未重新初始化case。固定reverse-skill cab634bd855fc287f6e420c1f36fd1a6b9245960，新平台原生master-route-20261018-215123，PRIMARY mobile-reverse，实际检查本机tool-index。只读本地样本与用户图，未访问私人服务、凭据或执行参考App。

固定IPA SHA256 `c2ee2deba236ef1b9e097e1d8cdc0b816137aa57cf85d4c8e2811dae9924bc07`，App成员SHA256 `640c6112584c017b45141a038f7aa975224c8b540ef1aaec1f40939a6aa5c84d`。容器/依赖身份沿E001；本批无新导入表/二进制函数恢复，E013/E037/E038是已独立核验的沿用结果，不是新反编译或动态证据。

31张原图IMG_4851.PNG至IMG_4881.PNG，132,113,191字节，归档在本机忽略目录`resource/reference-ui/sollin-2026-10-18/`，原件保留。manifest逐图记录SHA/尺寸/字节，INDEX和三张contact sheet供本机查看。manifest SHA256 `5022641f56567a7ddb02636d19c4f2b0c35261126f9b4d682a05c27ec6195829`。截图和私人曲目信息不提交或打包；4881的Android路径不作iOS目录扫描授权。

## Evidence → Finding → Path

| Evidence/source_ref | hash与复现 | Finding | Path |
| --- | --- | --- | --- |
| E039 `work/sollin-ipa/evidence/player-screenshot-evidence.json` | SHA256 `a86380f86c8b011a653f91e12346688ecb32883f49087d39675769e60a358a88`；核对31原件/归档摘要、冻结基线及下列脚本 | F038，info/candidate/high，位置ModernPlayer：宽决定的方形子图被屏高27%父框裁切；黑胶被通用歌词块挤小 | P038/solve：离线scope→IPA结构→截图观察/原实现对照→原创构图→实际App测量 |
| E013，沉浸闭包0x67b918；E037/E038有限黑胶父坐标/唱臂 | 沿既有不可变case；E0371404原始指令/106BL/88池引用/6向量与E0381886/258/108/20向量独立重放通过 | F038结构边界成立；精确父布局、完整材质/手势、目标运行未知 | P038只采纳已证实边界，不把截图推测补成二进制事实 |

采纳前严格review为39E/38F/38P、13工作项/87timeline事件、零错误/警告。WI013、timeline与field-journal已追加；21:51路由，21:59冻结E039并review，22:01把非执行基线由.tsx改名.tsx.txt以免被TypeScript扫描。内容不变，历史路径保留在不可变JSON，迁移回执`notes/player-baseline-relocation.json`记录当前路径和SHA256 `307561f59a66df3b301f76a610886769f5f4c997cdc6b239842c3da2262daa4b`，E039指向回执。

## 原创实施与验证边界

见[0070决策](decisions/0070-player-square-composition.md)和[31图矩阵](SOLLIN_SCREENSHOT_REVIEW_2026-10-18.md)。父子同尺寸方形封面消除结构裁切，黑胶单独预算主体；所用屏幕比例属于音枢适配策略，不宣称Sollin精确尺寸。原有歌词入口、PCM、权威队列和唯一播放意图保留；五固定参考比较/维护/Android/许可见0070，无代码资产移植。

`npm run check`最终类型和387项业务测试通过。首次失败由证据快照.tsx被默认TS扫描导致，改非执行后缀后通过，未修改tsconfig。首轮App `SourceUITests-1792332018048.xcresult`于15.735秒在settings-viewport-home失败，未触及播放器；层级仍发现页，尚无足够证据归因为产品导航损坏，未改产品导航/延长超时或弱化断言。完整日志、summary、counts以`ui-player-composition-first-*`保留，受控复跑另记结果。

本地工具链为Xcode26.3/SDK26.2、iOS26.3.1模拟器；云端iOS27、真实服务、签名、真机分别记录，不混作本地构图验收。

## 复现

在已有授权本地case和工具环境执行，不重新case-init：

```bash
source scripts/environment.sh
node scripts/sollin-reverse-gate.mjs ipa
python3 build/verify-vinyl-layout-evidence.py
python3 build/verify-vinyl-vector-evidence.py
node scripts/sollin-reverse-gate.mjs ipa --review
npm run check
node scripts/test-ui.mjs NexusMusicUITests/SourceSettingsTests/testZNavidromePlaybackAndCredentials
```

31图和基线摘要复核使用E039 JSON的files/path字段，基线旧路径通过relocation_ref解析当前文件，逐一重新计算SHA256；不覆盖已冻结证据。原始样本、工具、导出和完整结果留本机忽略目录，仓库仅记录脱敏结论。ATT&CK/IOC不适用于本构图分析。

受控复跑1792332625440于136.904秒在“Lyric selection must fit in vinyl”失败；此前完整封面/黑胶尺寸/唱臂/像素已执行通过，但整轮不计成功。移除正文Lyrics造成选择入口消失，修为底部“歌词与来源”工具→原生SheetModal→原Lyrics（完整歌词/偏移/原选择弹层），不增加第二歌词时钟或公开搜索授权。测试保留来源入口可触达断言，新增Sheet实际歌词内容及关闭后暂停意图，重新完整回归。原日志/summary/counts留ui-player-composition-lyrics-failed-*，原xcresult保留。

1792333076753完整回归304.377秒1/0/0通过，9合成鉴权/0失败，无新stream/coverArt（复用缓存），非真实服务；三张命名PNG及原日志/摘要已保存。亲看截图发现声波核实际歌词被84点容器裁切，虽然旧AX可触达断言通过；不据此宣布视觉验收完成。进一步将声波封面预算降为屏高30%，声波/沉浸歌词150点、显示当前一句（其余歌词长按展开仍保留），新增实际歌词frame包含断言，完整回归另记。参考4867的三行/居中标题和次工具仍待下一构图批次，本次不冒充全等。

最终1792333778177完整295.404秒1/0/0通过，387业务/类型通过；新增实际歌词frame包含，原PCM/八布局/动效/定位/统计/重启/清理保持。9合成鉴权/0失败、无新stream/coverArt。最终声波当前歌词/完整封面与黑胶暂停PNG已亲看；build/player-composition-visible-passed留必要三张PNG、manifest/verification，ui-player-composition-visible-passed-*留日志/summary/counts，临时完整导出自动删除。完整三行/居中标题/声波底部工具与其余页面仍待，不宣称整体视觉等价。
