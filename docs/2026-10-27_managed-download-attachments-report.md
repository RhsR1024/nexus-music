# 2026-10-27 下载时托管附加文件

后续核验：40468166406已失败于下载暂停步骤；问题及最终本地恢复修正见[持续目录/下载恢复回执](2026-10-27_download-destination-report.md)。下方pending为该阶段当时状态，不代表当前终态。

交付：源码`35201749691597803cd742ef6fc88da1738fc1f9`正常push且远端SHA一致；[CI40468166406](https://github.com/RhsR1024/nexus-music/actions/runs/40468166406)pending，40458280308/3725f22仍运行，实际1运行/1等待。旧pending 40463828910由single队列自动替换为cancelled，不计通过；未取消运行中构建或重派旧版，云端终态继续独立核对。

批次6将已有三个附加选项用于后续下载：入队时固定歌词/封面/歌曲信息和平台封面上限，音频完成后独立准备托管文件。旧任务不自动追溯取回内容；原音频、播放器和权威队列仍由既有store负责。持续授权保存目录仍是下一项，不把应用内部托管目录当作用户选择目录。

## 依据与实现

复用已完成E-830→F-023→P-021、WI-003。原生master-route、PRIMARY与适用precedent/tool-index、APK gate及采纳前review已执行；`build/download-managed-20261027-{route,gate,review}.log`。固定包cab634bd855fc287f6e420c1f36fd1a6b9245960。外置T7真实挂载/可写后仅追加实施采纳记录，未新增Sollin采集、API分析或参考代码移植。功能case严格哈希review当前395 Evidence/101 Finding/99 Path/3 workitems/121 timeline、0错误/警告；安装case不代替该功能链，AppleDouble旁文件仅在内存过滤。

入队记录保存白名单`attachmentPolicy`，旧记录缺字段保留无附加行为。完成后独立单工任务具有等待/准备/完成/失败/取消状态，取消后立即重试用执行代次隔离旧回调，删除音频不复活附加文件；失败、超时、取消不把已完成音频改为失败。正式完成卡片显示状态和重试/取消入口；没有截图专用状态。

托管文件位于Documents/offline-attachments内稳定音频文件名所属目录，包含实际LRC/JPG/歌曲信息与manifest，绑定音频MD5、策略及每个附加文件长度/MD5。准备时使用受控Cache临时目录，全部内容通过后移动提交；移动后的目录不会被临时清理误删。重启认领完整提交、未完成准备可重建，缺失/损坏显示可重试；删除对应音频后仅清理所属组。启动仅清理带专用标记的旧准备目录，不清理正常系统导出。附加占用计入共享离线容量；容量检查与提交持有音频索引锁，网络请求不占有该锁。

同进程已验完整组复用校验结果，避免其他任务状态变化时反复全量hash全部封面；导出前仍做完整文件校验，检测缺失后将附加状态设失败。显式导出优先复用托管歌词和相同上限封面，所选尺寸仍取同一次导出策略快照；元数据继续由白名单生成。不将URL、headers、原始错误或凭据写入附加journal/公开meta，不改变在线/LX/私人客户端或播放匹配边界。

## 检查与真实资料

最终`npm run check`649/649、typecheck通过，`build/download-managed-20261027-check-r6.log`。包括空选择/旧任务兼容、独立入队快照、完成/删除/失败/重试、取消竞态、容量不足、丢失文件、提交后journal未完成的恢复、避免重复hash、导出前校验与优先复用。r1为Node strip-only参数属性语法不支持的失败，r2–r4为逐步补充用例过程；r5/r6均649通过，使用r6最终计数。

本批38个modules原生文件与上一封面尺寸阶段完全相同，未重跑或虚报完整native套件；前批原生测试记录留在封面尺寸回执。当前真实App运行实际调用原生下载及JPEG阶段、Expo文件提交/重启/系统分享，以文件结果验收。

R1 Release `SourceUITests-1793085106515.xcresult` 1/0/0、121.667秒。通过正式设置选三个附加项/网易256，正常删除此前受控Shape副本，通过真实播放器重新保存离线。真实V261020已启用来源返回的公开曲目MP3、207行定时LRC、256×256 JPG和269字节歌曲信息自动保存，重启后完成状态/托管文件保持，实际系统四文件保存通过。六张真实PNG逐张亲看和provenance ready；`build/download-managed-live-20261027-r1/screens/index.json`。其源码digest7c5b4bc15cdd49447b4d4478699e87f44e2c6838187825a64b1688d9fd7a6c7a为增加校验复用前的版本，不冒充最终源码。

R2同源码再次执行用于实际删除联动：1/0/0、112.901秒，原R1受控音频及其托管组均已删除，新音频文件名不同、附加组ready；其他文件保持。`build/download-managed-live-20261027-r2/deletion-replacement-receipt.json`记录实际相对名和校验。R3 `SourceUITests-1793085648653.xcresult`1/0/0、115.485秒，验证校验复用；R4 `SourceUITests-1793085896972.xcresult`1/0/0、118.375秒，验证移动提交后的标记清理修正。R4完整托管逻辑源码digest79d674232cb4bdb3d0eaf73ec595148ed21d53ccbb49c67aeafdfe37acb3a6f0。六张实际PNG逐张亲看/ready=true；当前仅两处UI文字更新，业务及原生文件均未变化，逐文件比较记录在R4 provenance-review。R5 `SourceUITests-1793086196536.xcresult`1/0/0、86.303秒，验证两处文案更新、正常设置/重启和实际四文件导出；digest9dbfd1fe95945c3b9802569e89069bc853a1b6a9aff3c86035a50e4d83cd97ed与当前源码一致，五张实际PNG逐张亲看/ready=true。R4→R5仅两个UI文件的文字修改，逐文件比较和人工diff已核对，托管逻辑/原生文件一致。R4/R5合计11张最终相关真实PNG；R1六张为过程记录，R2/R3不作静态UI亲看结论。R5没有重新下载音频，实际托管组和音频与R4一致；实际四文件另经harness归档校验。临时Files目录旧名称Nexus UITest Fixtures内只放原样真实MP3及OS实际输出，未用合成音频/图片作UI验收。

R4物理核验：旧R3受控音频和托管目录均不存在，新的单组ready、源音频MD5与manifest/三文件摘要一致；移动后的临时标记已删除。R1–R4实际OS导出音频均be80，JPG256²，导出LRC和meta与托管原文件完全一致；最终临时导出目录0。详见`build/download-managed-live-20261027-r4/physical-verification.json`。

实际音频SHA be80e8647e530f86a3ffe3e558772d1378596fb878a682071bb36369d5a63203，3740360字节；Perfect保留4215580字节、SHA086eb96aef026bf336cf5884037a17b28f519b453c19547f3b29093f32ddda39。R1真实托管LRC SHA b2d8e59e100b83d586e9112df49755273661d35a12eb23a88b7fc8cb771d319d、JPG eea92861245c96314a4094fac2e2517ea79406d36f2f83cc8c39139f467b2bd4、meta67eb1f874969ccf27d9420d632cebd4813f4dc2b104a43108828eebea04a65c2；manifest各MD5与实际文件/音频摘要匹配，队列仍一项。原样输出仅留忽略build目录，不提交音乐/歌词/图片。

## 未验证范围

本批为真实公开网易曲目，未测其他平台实际附加服务、真实断网导出、后台/被系统终止、真机签名与Android路径。失败/取消/配额/损坏/提交恢复的边界由业务测试证明，不声称制造了实际服务异常或杀进程试验；本批未重新PCM播放。UI是正常操作与静态质量检查，没有颜色/像素分数或动效一致性结论。用户持续授权目录、批次6其他余项及云端终态继续开放。设备复查仍tunnel unavailable/developerMode disabled/DDI false，未真机或签名验收。

最终case复核`build/download-managed-20261027-case-review-final.json`为121 timeline、0错误/警告；原始证据不变。

阶段磁盘约9.3GiB余量，R4/R5目录各11MiB、xcresult6.5/7.8MiB保留。R1–R3的12个OS导出文件已逐文件核验与R4/R5一致后清理，共11301798字节；原样四文件当前只保留R4/R5，旧receipt/构建/日志与已有截图保留，不能把已清理附件写成当前可取。回执`build/logs/download-managed-cleanup-20261027.json`；真实输入/原音频与reverse证据未动，未清运行中的构建缓存。
