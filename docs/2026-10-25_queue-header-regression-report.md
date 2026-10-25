# 队列序号旧断言修复与真实八记录回归

日期：2026-10-25。修改范围为XCUITest与文档，产品队列行为未改；不追加Sollin采集，不引入参考代码或依赖。

## 根因证据

5C云端40187742231/f3675d8的字体与Navidrome用例同报“The long-queue fixture must publish all eight rows”。字体用例内部调用Navidrome用例，因此两处失败共用同一断言。旧断言等待`· 8`，而QueuePanel在3df539f及当前实现中已按有当前项时显示`· 当前位置/总数`。

GitHub job121152125673日志及artifact12599475578证实，两个失败控件树都实际包含`· 1/8`，并非缺少八条记录。ZIP SHA256为`d100c5672f31b7e9635cc01a80083199e7b07709a7ed576939f4b2dc433a25b8`，与GitHub digest相同。本机忽略目录保留`build/ci-40187742231-failure.zip`及`build/ci-40187742231-queue-heading-receipt.json`，只读取文本控件树定位旧CI失败，不用其合成素材截图作音源或视觉验收。

## 修复与真实验证

旧断言改为精确等待`· 1/8`，继续要求第二行可操作；没有退化成任意含8的文案，也没有削减条数。扩展现有真实音频用例：两首V261020来源完整MP3经正式歌单选择器重复加入，2→4→8条记录；这是2首独立音频、8个独立条目，不宣称8首不同歌曲。播放歌单、暂停、切换AM、切换三种队列模式，再检查1/8及首两行可达；滚动第八条并播放，正常重开队列检查8/8与暂停，最后恢复经典皮肤。无直接注入队列、修改文件字节或伪造标签。

首轮`SourceUITests-1792932172726`在263.902秒失败：第八条已实际播放Perfect（控件树0:09/4:23），但AM随曲目变化回到封面，测试错误地继续在封面等待队列头。修正为按正常入口重开队列再检查；开场亦通过正常样式菜单归一经典皮肤，避免失败遗留AM影响重跑。

最终Release、SDK26.2、430×932pt/3x模拟器：`SourceUITests-1792932708760`为1通过/0失败/0跳过，234.956秒。9张实际内容附件的来源绑定全部ready；新增AM的1/8、8/8两张亲看，可读性与实际歌曲/当前位置一致。其余7个5D功能状态亦随本次实际操作回归；不新增像素或连续动效完成声明。未重跑无改动的559项业务单测，Swift编译与真实UI用例通过。

只读SQLite核对：本轮副本歌单8条、8个独立条目ID、2个音频ID；权威队列8条、当前位置8，持久化游标匹配。证据在本机`build/local-playlist-queue-eight-live-20261025-r2/storage-receipt.json`。音频SHA沿用[真实场景](ui-spec/local-playlist-batch-live-2026-10-25.md)，构建前后真实输入均未变化。

## 精确绑定

| 项 | SHA256或状态 |
|---|---|
| 候选基线 | `44e069590a82fb5c343318d79d0af0f7d5d299bf` + dirty工作树 |
| 已保存candidate.patch | `f301ec8880aedc3de9606cec0e58c545fef3be32792d960c6653aee9ef4f1a0f` |
| 源码集合 | `264d4318934076f0b82eed829b741ebb4519d80900d762aef45ff2885f284a40` |
| 安装包集合 | `1a8e9c3ae0afdab8a76640399a42dfc55797fd86d2a323771962fc782dd493b2` |
| run-manifest.json | `5703acf8402650fe25b6b5e0b3a01506ccaa8ae773e077bbb635c7aff121db37` |
| screenshots/index.json | `0ca770ba39154d6d9ed9dff8cfe579d3376c9c020a2810e49a07d7b4de38667c` |
| xcresult Info.plist | `f0261bf3413e9f9c540abbe087e588ec874a2d1bb69d97f887ea2c0b087c35fe` |

清单、独立截图哈希与provenance.json保存在上述r2本机目录，原始xcresult为`build/SourceUITests-1792932708760.xcresult`，未使用latest或跳过哈希。本轮源码文件集合构建前后及当前一致，候选补丁哈希也与原保存文件相符。

云端修复后的完整回归仍须等新提交实际运行；本地真实音频不冒充云端SDK27、真实Navidrome服务、真机/签名或后台验收。

## 后续批次复核

下载任务多选已经在3df539f实现，已更正旧“未实现”条目；不能重复开发已有界面，也不能把单项下载回归算作多任务批量验收。下一步按批次6核对真实音源批量操作与原生后台缺口。`OfflineDownloads.resumeQueued`明确只做启动/前台恢复，原生URLSession交接仍是独立边界；保留副本回收属于后续数据管理，不据此扩张Sollin采集。

## 提交与队列

修复提交`787a9574776368913d86464bb76034516e2068c0`已正常push到origin/main，远端完整SHA一致；新云端[40195921247](https://github.com/RhsR1024/nexus-music/actions/runs/40195921247)为pending，前有`40193664989/f55414c`运行，核对1运行/1排队。未取消运行、未重派旧版本；修复后的云端终态仍未验。
