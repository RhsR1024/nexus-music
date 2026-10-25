# 批次6增量：在途取消状态与重试修复

日期：2026-10-25。修复下载任务的活动取消与失败后重试，不把本批记为下载管理全部完成。

## 契约与门禁

沿用既有E-1301/E-1302→F-097→P-096：单项与全部取消应结束未完成任务，取消记录可重试，已完成文件独立保留。Q122 timeline已记录该组证据；既有3WI覆盖收尾，严格review395E/101F/99P/117事件、0错误0警告。包原生master-route命中apk-reverse，APK gate及`--review`通过；未新采Sollin，不把门禁或安装当成功能证据。

## 缺陷与改动

`cancel()`在设置`cancelRequested`后立即清掉了该标志；在途传输收到abort后，catch既看不到取消意图，也不会将已abort的请求按普通失败处理，于是记录停在downloading。原有取消测试只覆盖未开始的任务，旧cancelAll测试没有真正启动活动传输，漏掉此路径。

取消意图现在保留至该run消费/结算；无活动传输的未完成记录也能直接提交取消状态，从而在取消落盘失败、网络已停止时允许再次取消。替换无效的cancelAll测试，补实际abort结算、queued任务不发起I/O、恢复后不自动重启、显式重试及取消写盘失败后的再次取消。

修复前两项在途测试均失败（活动记录仍downloading）；第一次修复后的写盘失败重试测试也确认失败，再修复无活动传输的状态提交。最终`npm run check`561/561通过。没有改播放器、provider、LX或Navidrome边界。

## 真实音源传输验证

新增显式工具`scripts/verify-live-offline-cancel.mjs`，要求新输出目录、两份完整MP3及对应已知SHA256；只绑定127.0.0.1。在本机HTTP镜像中传输V261020已取得的原始公开音频，保持字节和标签不变。镜像在写出实际前缀后保持连接，以实际文件出现为触发条件取消；这用于确定在途阶段，不推断Sollin速度/缓冲规格。

复用生产`createStreamingDownload`与`OfflineDownloadStore`，文件适配为真实磁盘，任务日志实际原子写JSON。最终r3（v24.14.0）验证：

1. Shape在途取消：真实partial为65536字节、连接被中止、状态cancelled、pending=0、未发布最终文件且不可解析。
2. 从磁盘任务日志恢复并调用resumeQueued：取消态不重启；显式retry完成，输出SHA256等于原输入。
3. Perfect在途执行cancelAll：第二条取消，第一条完成音频保留，第二个连接被中止；再次显式重试，两条均完成，总字节7955940。
4. 取消后的retry均从完整实体开始，不拼接旧前缀；传输URL不进入任务日志，输入文件哈希前后不变。

| 实际输入 | 字节 | SHA256 |
|---|---:|---|
| Shape of You - Ed Sheeran.mp3 | 3740360 | `be80e8647e530f86a3ffe3e558772d1378596fb878a682071bb36369d5a63203` |
| Perfect - Ed Sheeran.mp3 | 4215580 | `086eb96aef026bf336cf5884037a17b28f519b453c19547f3b29093f32ddda39` |

来源见[真实排序回执](2026-10-25_implementation-local-sort-report.md)。本机证据：`build/download-active-cancel-live-20261025-r3/receipt.json`及两份实际下载文件；receipt SHA256为`0c32ed4a147d3a5fe74a78a4c5183dd49aad5ea821ab9720e77c4bee12e8a8ca`。前序r1/r2保留，最终采用r3。脚本、store、传输算法与track校验文件各自SHA256已写入receipt.sourceBefore/sourceAfter，前后完全相同。

## 验收边界与下一步

本轮证明Node环境下生产存储/流式传输算法的取消与持久化；镜像所用音频是真实原始MP3，但不把镜像当作原provider服务或App界面验收。没有新UI布局/入口变更，未用合成截图代替验证。真实provider的多任务批量App路径、Expo平台中断、iPhone/签名、原生后台URLSession与后台播放仍未验；本机当前0可用签名身份。已有前台恢复`resumeQueued`不等于原生后台。

继续按批次6推进真实音源批量UI及原生后台能力；保留副本回收属于后续数据管理。云端以新提交实际运行结果为准，不取消运行中构建、不重派旧版本。
