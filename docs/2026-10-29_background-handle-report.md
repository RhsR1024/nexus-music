# 背景面板手势归属修正与真实素材回归

背景关闭拖拽现在只挂在实际手柄容器上，内容ScrollView不再经过关闭响应器。保留手柄点击/下拉、背景点击关闭及原布局；未改图片存储、音频、账号或授权范围。

## 失败证据与修正

[CI 40851551813](https://github.com/RhsR1024/nexus-music/actions/runs/40851551813)的f7d27c2首组21通过/1失败；checks成功不能代替iOS组成功。小日志artifact12894150247为555193B，SHA256 b1dd03734511241b67fea36385d9595a1f4fc3a76aafaa5d79e9ca4a148a3a6b，留本机忽略目录build/account-mvs-20261029/background-f7-logs.zip；失败文本及分析见build/background-handle-20261029/ci-analysis.json。仅读取文本/JSON，未查看合成截图，未下载542MB完整诊断包。

完整日志证明空槽图片选项被找到、两张图片导入后的名字断言已通过；101.39/106.23秒在内容区域x24、y362.3→654.7向下滚动后，面板消失，随后background-image查询失败。不能把这个缺元素错误写成存储写入失败；原reveal诊断中的element.identifier查询还会遮蔽先前的面板丢失提示。

旧PanResponder挂在整个Animated.View上，以y0与估计的屏幕区域判断能否关闭。现在通过局部Context把同一响应器交给AppearanceSheetHandle，实际手柄容器与内容滚动为兄弟节点，去掉全局坐标判断。纵向下拉阈值、位移/弹簧和关闭回调保持；横屏/宽屏原生Sheet继续自身行为。这个改动排除了内容参与自定义关闭响应器的路径；本机没有iOS27运行时，尚未证明云端原失败的底层原因或修复结果。

## 验证

849项类型/业务检查通过，日志build/background-handle-20261029/check-a.log。正式Release入口复用testLiveBackgroundPersistence，新增最后的实际手柄下拉关闭断言，原空槽禁用、两槽导入、三个参数实际变化、开关、重启恢复、分别移除和再次重启断言全部保留。

实际音频为V261020批准实源沿用的完整Shape of You，SHA256 be80e8647e530f86a3ffe3e558772d1378596fb878a682071bb36369d5a63203；真实公开封面Shape-cover.jpg，512×512，SHA256 08cebcf4451a338f6f062f4cb9594cb86f4605e8480cb42ec98e4fc489e0bd04。未提交音频、图片或私人会话。

独立iPhone15ProMax模拟器、430×932pt/@3x、iOS26.3.1，正式导航；先断言原生播放进度推进，再暂停进入设置。SourceUITests-1793286029330.xcresult：1通过/0失败/0跳过，417.843秒。导入、往返滚动选择、参数修改、重启恢复、独立移除和手柄下拉关闭均通过。未将新一轮本机通过冒充云端iOS27通过。

完整证据目录build/background-handle-live-20261029-a/：source digest 05df5b04361b058a25047808d78a020447b6113cf15ce2b17558d874dda5089f；manifest SHA256 b7fd69d33b2ea5dbdc702841eb2ade4ccb3c80cb5ff99d3c483bd3e8538c9aa5；开跑前[场景记录](ui-spec/background-handle-real-2026-10-29.md)原副本SHA256 1db99c0837533515b6f34b6e347e0f9a3a36ea08d2946d4bf7c8df3cb5eb86e6。源码前后/当前、candidate.patch及两个外部输入校验保持；screens-b/index.json SHA256 02e6b05c4fa2d86c0fb577479e56ae67575e08431655719207f03c23f3e87b49，两张PNG均ready且亲看。真实导入预览、独立空槽文案与正常滚动可达性可见；截图是滚动局部状态，不报整页像素或动效完成。

数据库19→19条，preferences.v1、queue.cursor.v1、library.v1、playbackStats.v1正常变化，其余15条摘要及两份原音频字节/SHA保持。源图前后不变，两个导入槽已通过真实移除UI清空；未把记录数量保持写成所有记录相同。

签名身份本轮实查仍0，实体机未安装/验收。无录屏，不报弹簧一致；原云端、实体机、签名及完整功能状态矩阵继续待验。本轮是音枢自身缺陷修正，不采纳新增Sollin结论、不新增采集或E/F/P，也不增加功能对齐完成量。未引用或移植新的参考代码。

阶段磁盘检查保留在用DerivedData、最新有效两阶段及未解决证据；只删除首次过滤不完整的重复导出759084B，先核对其PNG与最终screens-b摘要相同，回执build/background-handle-20261029/retention-final.json。原始reverse-skill材料未动。首个快照因自有模拟器尚未启动而停止，启动后再取快照并开跑，未覆盖测试产物。

下一按原0–8顺序复核依赖已满足的余项，优先检查批次2公开详情/来源覆盖；用户暂无专用非私人账号，授权目录状态继续待验，不反复索要账号，也不缩减原F/J目标。
