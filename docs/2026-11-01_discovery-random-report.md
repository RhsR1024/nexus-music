# 发现详情随机播放独立验收

补齐[相似页控制批次](2026-11-01_similar-controls-report.md)已修改但未单独重跑的Discovery随机入口。生产行为沿既有修正：同一次偏好保存写入repeat=off、shuffle=true，再交给唯一playTracks/队列和原生曲终；本批新增正式Release测试，并把Discovery共用按钮从实际41pt补至至少44pt、垂直居中文字；不另建播放器或修改曲终算法。

场景见[预登记](ui-spec/discovery-random-real-2026-11-01.md)。真实网易云官方欧美热歌榜从正式搜索进入Discovery，按已加载歌曲筛选，再验证播放全部→单曲→随机→近曲尾继续→自然切歌和原曲/模式恢复。真实批准源与完整公开音频只在忽略目录服务原字节，不注入SQLite，不生成音频或合成页面。

## 前置检查

- main基于811129f，开工无工作树改动、无活动Xcode进程。
- 931项业务/类型检查通过，0失败/0跳过。
- 原生master-route PRIMARY为apk-reverse；APK prerequisite/--review与外置功能case严格哈希review通过：395E/3WI/124事件/101F/99P，0错误/0警告。复用E-262→F-003→P-001等既有统一播放意图证据，无新增Sollin采集或内部机制结论。
- 专用A8347A1F模拟器，启动前只读基线19条持久记录、6份已有音频；repeat=off/shuffle=false。原始私人源/应用记录不提交。
- 公开歌单预检为100/200首，不宣称完整曲库。网易专辑详情本次不可读，一次TLS连接重置后公开歌单读取成功；均未用模拟数据替代。
- A调用缺少批准源的显式SHA，在App测试前被驱动拒绝；B补齐固定SHA并使用新目录、精确结果SourceUITests-1793537264205。实际App终态另记。

## 范围

本次验证限定网易公开歌单、已加载筛选与Discovery已有随机入口。全部平台/全歌单/完整读取、弱网/限流、耳听、实体机/签名/后台和连续动效仍独立待验。五平台公开评论的聚合索引J11已按各自真实回执更新，不将网易一次成功冒充全部平台；固定参考没有完整回复入口的平台继续保留协议缺口，不猜造接口。完整F/J目标继续。

## 首次App失败与定位

B在99.348秒失败：已真实筛出6首，但测试尝试从discovery-track-0容器查询子Button。原始失败AX树表明播放按钮及discovery-more-0为同级节点，首曲One Of The Girls实际可见；没有证据将其归为歌单读取、解析或播放器故障。改用已有discovery-more-0稳定ID的真实label取得同一曲名，提前补截图，播放/PCM/曲终/恢复断言保留；B结果与6份原始文本证据保留，后续C新目录复验。


C在92.575秒失败（`SourceUITests-1793537654584`）：公开歌单与6首筛选已成功，点击播放全部后测试直接查找“打开播放页”。原始AX树只含Discovery全屏Modal及“返回搜索结果”，底层播放器入口不可见；这是测试导航遗漏，不能据此归为音频失败。D改为正式返回搜索结果后再开播放器，返回详情重新读取/筛选并核对6首；所有PCM、进度、单曲→随机、自然曲终和重启恢复断言保留。B/C原始失败包及附件未覆盖。

B/C的真实共用按钮高度为41pt，生产修正使用既有`controls.hit`作`minHeight`及居中，播放回调不变；D新增播放全部/随机实际frame.height≥44断言并采新图。D精确结果`SourceUITests-1793538008347`，终态待，不预记验收通过。


## 最终本地验收

D正式Release专项`SourceUITests-1793538008347.xcresult`为1通过/0失败/0跳过，276.608秒。真实公开歌单100/200首，筛选6首；播放全部建立1/6队列，切单曲后返回同一详情点随机，真实首曲One Of The Girls的PCM与4秒进度通过，随机选中且单曲未选。正式进度条定位至4:00/4:04后继续，自然结束切Popular，下一曲PCM及4秒进度通过，队列5/6且随机保持。正式恢复顺序与原Shape，重启后暂停/顺序/1首队列保持。两个播放按钮的实际frame.height≥44断言通过。

10PNG全部经`verifyCaptureEvidence`来源ready，完整输入/源码/安装bundle/xcresult摘要保存在`build/discovery-random-live-20261101-d/`；亲看10图联系表及随机入口原尺寸图，内容、布局、换行、按钮、队列选择与实际反馈相符。没有新增逐像素/动效一致结论。失败后Xcode辅助诊断仍有simctl路径告警，最终XCTest零失败且驱动退出0，未将告警当业务失败。

B/C/D累计只读状态对比19→19记录：变化仅library.v1、playbackStats.v1、queue.v1、queue.cursor.v1、search.history.v1，分别对应明确的播放/队列/搜索操作。全部偏好、下载、托管附加文件、源记录及其余记录哈希保持；6份已有音频路径/字节/SHA全部保持。最终repeat=off/shuffle=false。安装后模拟器应用容器UUID发生变化，快照脚本先由simctl取得实际路径再读取；未修改SQLite恢复状态。

931业务/类型检查、脚本语法及diff空白检查通过。该结果仅为本机SDK26.2/iOS26.3.1模拟器与本次真实公开源，不替代iOS27云端、签名、实体机、耳听、全平台/弱网与连续动效。清洁IPA/提交/远端队列在阶段收尾补记。

采纳后功能case严格哈希review为395E/3WI/125事件/101F/99P，0错误/0警告；只追加本项目消费记录，原始Evidence未变。六份闲置安装包完整迁至T7、保留原路径与恢复清单，归档1,617,545,915字节；详见[T7回执](2026-11-01_t7-build-archive-receipt.md)。


## 阶段归档

功能提交为`802e7ba9a6167e94d9476f53053ebab70628b867`。干净unsigned IPA为12,849,880字节，SHA-256`b9a04724bab61ffc1c3695b0ab69de00c2f1f4b5b814e7d78464a6c90abbfbcf`，manifest SHA-256`08dd35950341824959b917690e93d3752bf118990b38baa1dd70d4fd780b5870`；CRC、arm64/iphoneos26.2/iOS15.1/设备族[1,2]、无签名/无描述文件、生产随机文案存在及测试夹具排除通过。内容哈希快照保存在`build/distribution-history/b9a04724…/`，T7独立副本为`/Volumes/T7 Touch/NexusMusic/BuildArchive/2026-11-01-discovery-random-clean-802e7ba/`，IPA SHA一致。本机路径与T7副本均保留，未清理当前阶段证据。
