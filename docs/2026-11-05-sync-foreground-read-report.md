# 同步慢读取期间的前台刷新

`previewIfConfigured()`此前在任何busy状态直接返回false；已有读取尚未完成时返回前台，最新一次读取意图会丢失，用户仍可能看见进入后台前截取的本机版本。本批仅对`busy=preview`合并请求：多个前台事件共用一个待办Promise，当前读取结束后补读一次，返回补读结果。补读重新取得本机快照；不会PUT、改基线或自动确认冲突。

取消、连接替换/删除及重新配置会清空待办并将等待者返回false。旧请求的finally只有在仍持有当前request身份时才能启动待办，不能消费新请求的待办。没有新增事件时，网络失败只补读一次，不无限重试。配置保存/提交中的前台事件仍返回false，保留现有事务和完成反馈；本批不宣称已完成本机编辑自动调度、后台持续同步或全部F33。

只读独立复核确认“取消旧读→重配新目录→旧finally结束→新读/补读”隔离成立。API边界仍为：补读尚未启动时取消立即将等待者返回false；补读已启动时取消会阻止迟到结果，但该轮Promise等底层异步请求结束后才返回false。当前App前台调用使用void，不等待该返回值；未把它描述为完整的即时取消API。

## 验证

新增三项业务测试：慢读取期间多个前台事件合并，随后本机新歌单出现在补读结果且零PUT；取消/连接替换/删除丢弃待办和迟到结果；网络失败只进行一次已请求的补读。修复前两项失败，修复后同步19/19、完整类型与业务检查1033/1033通过。独立复核后另加“取消旧读→重配目录→旧成功/失败finally→新读/补读”的固定回归，修正该测试自身遗漏取消及可变计数造成的等待交错后，同步20/20、完整检查1034/1034通过；原诊断日志保留。Swift解析/Node语法/diff检查通过。

正式App候选通过合成WebDAV夹具暂停一次GET，正常Home/返回前台后释放；要求GET准确增加2、待释放计数归零、PUT不增加，再继续三方冲突、旧确认拒绝、重新确认、重启/删除传播与移除连接。首轮Release`SourceUITests-1793862602578.xcresult`在连接表单连续出现60秒动画空闲超时，主动终止本地xcodebuild，exit73、0/1/0“Testing was canceled”，不计通过；完整结果、失败附件与独立键盘诊断图保留。专用模拟器重启、保留数据后，第二轮`SourceUITests-1793863509895.xcresult`为1/0/0、247.756秒、exit0、`sourceUnchanged=true`，上述完整链路通过；未取消云端任务。原生传输代码未变，未重跑上一批已通过的完整native。

两张1290×2796正式附件来源ready并亲看：三方冲突内容保留、当前选择清空且确认禁用；旧确认拒绝提示准确。最终夹具累计11GET/3PUT、认证失败0，新增慢读阶段独立断言零新增PUT；累计3PUT来自原有明确确认流程，不能将整轮描述为零PUT。

- source digest：`fa7e1751261b3152a918dbcb5860e1d8a8acd1772a14c97cfc8e2997ac229450`。
- 安装bundle digest：`8128e57177e61aa0c204db3c3d7fd8b50bb29865a2a887cc36e5a87c3224eeac`。
- result Info SHA-256：`2e0e620628186d3a91978e009ea3198c1649efbb70bd55056ee726b83270fd6f`。
- run manifest SHA-256：`0d6f9dd8ec1261a02c4944ea8f8dcaaa9a3918a3b87de4fc1dbaf6ede9599eff`。
- 截图索引SHA-256：`a55861b955092213e58df7dcb3075746f2b2221705f577c2ef3ff166dbc43976`。
- 旧确认图：`6bbcd6982370f771cb95d1eebcae58a2766dae8991272ac61e64e176a087dede`；冲突图：`6a001f9dc293560e0477b1af77183d50e4f72f1e6e3b85fb7a98369f5a0aaab5`。

正式重验：

```bash
source scripts/environment.sh
export NODE_OPTIONS= PYTHONPATH=
node --experimental-strip-types --test tests/webdav-sync.test.ts
NEXUS_UI_RUN_DIR=build/sync-refresh-independent node scripts/test-ui.mjs NexusMusicUITests/SourceSettingsTests/testUCloudSyncPreviewConflictRestartAndDeletion
```

使用新输出目录，不覆盖本批结果。

## 清洁设备包与T7

产品提交`2bba88cd052e17637416dcec44bdc6a8013a7fca`的clean unsigned archive通过，manifest与提交一致、`dirty=false`、`workingTreeChanges=[]`、arm64/iphoneos26.2/iOS15.1/[1,2]、`signed=false`。独立核验90个ZIP项CRC、63份载荷逐字节、生产`foregroundRefresh`标记、测试/私人标记排除及未签名状态均通过。历史distribution符号链接已恢复，原6个顶层文件内容/字节/mtime未变。

- IPA：17,822,286字节，SHA-256`d6c739400518c398708df67c7f312f0bcd1c33624bb56fafc59e164858368095`。
- manifest：`ae71556b48e6a5c070ac74ea4d3c22bc708e48237efcb0eb842361b3ab599db3`。
- 独立verification：`fa49d871decea50500262ede12373a06c82e79e91ea03cbd6bfa4c37086d9d2d`，ready=true。
- 源码tar：8,083,846字节，SHA-256`4bc4780adcdb6aa3a1517a2552149ca4cc02f66369b9e5c618b2f217b88b7224`；与Git树1,097个条目的模式和blob内容全部一致。

T7阶段`/Volumes/T7 Touch/NexusMusic/BuildArchive/2026-11-05-sync-foreground-2bba88c`保存clean分发/xcarchive、源码tar与提交补丁、r1取消及r2成功原始结果/截图/诊断、全部检查与测试诊断日志、脚本和报告快照。202份业务文件/110,772,896字节逐文件源/目标SHA-256一致，0差异、源保留、零删除；清单`b292b43a74bc235c657d9a876f54d2120648fc3179bf48c92bdff3ee5214891c`，transfer receipt`f98fd1e2dd467d2ca3b48025dc848b99e18c09e4feacf318e10c17085f62ae59`。依inventory相对路径恢复证据，源码可从tar/提交重建。内盘约58GiB、T7约569GiB，未做清理或搬移个人文件。正常push与新云端队列随后核验。

## 正常push与云端

产品及交付文档已正常push，远端main实核`821d31978bcca827c7a9ba24d87e523c515eee06`。15:37（Asia/Shanghai）Actions网页为`41984886238/3af8cbd`正在运行、`41988497570/821d319`唯一pending，1运行/1排队，未手动取消/重派。

旧`41973467272/258cac7`已实际failure：checks与native成功，核心24/1/0，唯一失败仍是`testPlaylistSearchSortAndDuplicateRemoval`在photo皮肤直接查找“查看播放队列”。该运行不含`3af8cbd`的一行前置修正，不能算修正后的失败，也不能以本地通过改写其结果；当前运行已包含修正，终态仍待。在线、下载及设备归档步骤因核心失败跳过。compact artifact`13396826532`为593,462字节，SHA-256`0221b0300aa8a59cee436cd537b751739b7d12ecc5b6f8c939d0b7bcbd32c8b4`与GitHub摘要一致，ZIP CRC通过；705MB完整诊断包未下载。

上述compact、Actions网页和状态JSON另存T7本阶段`postpush-821d319/`，3份/980,298字节源/目标SHA一致、源保留/零删除，补充receipt`0afd14d5c54a2073cbac427348f43300a53f7899c21927f9643a07d655338ae2`；不覆盖原202份清单。新云端终态、实体双设备/私人服务、签名与全项目继续开放。下一修复J29播放器自定义0h0m误清活动计时。

## 前一批交付补记

歌单测试单行隔离提交`3af8cbd5003701bfe6ecea45712f4a396ea49eee`已正常push并实核远端。Actions网页为`41973467272/258cac7`继续运行、`41984886238/3af8cbd`唯一pending，旧`41983509535/69bfc2a`自动替换，未手动取消/重派。歌单T7阶段50份/5,767,480字节逐文件0差异，源保留且零删除；清单SHA-256`b78a5203844fa2b1a1505d6457a9d6313841b295775afa86ce1c202932d75782`。这些证据不改变旧云端失败或完整项目状态。
