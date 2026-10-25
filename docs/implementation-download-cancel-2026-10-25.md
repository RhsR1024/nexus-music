# 下载管理取消语义（批次6，2026-10-25）

本批按 [功能清单 §8 下载](SOLLIN_ANDROID_FEATURE_INVENTORY.md) 补齐取消语义：取消保留"下载已取消"记录供重试/移除，与移除记录、删除离线文件分离。功能口径沿[0079](decisions/0079-functional-spec-and-ui-quality.md)；按[0080](decisions/0080-sollin-capability-capture-scope.md)不追加采集。

## 来源与门禁

- 功能依据：E-1300–E-1303（单项/全部取消→"下载已取消"；移除记录不删完成音频；批量管理分离）、E-1261/E-1263（批量受理）、E-1294–E-1296（断网失败重试）。
- `master-route` 路由 APK（R1 apk-reverse）；本会话 `sollin-reverse-gate.mjs ipa`/`apk` 及 `--review` 均 PASS；未新增逆向证据。均为音枢既有存储/UI 的原创扩展。

## 实现

- `src/storage/offlineDownloads.ts`：状态新增 `cancelled`（入持久化校验）；`cancel(id)`——queued/downloading/paused 同步置取消意图并中止在途传输，运行中任务在 catch 中优先落入取消态；`cancelAll()` 仅结束 queued/downloading/paused（E-1302 未完成语义），失败记录保留原语义；`retry` 对取消记录重置为 queued（清 partialBytes）；`getStatistics().pending` 不含取消；remove/clearCompleted 同步清理取消意图。
- `src/ui/DownloadSettings.tsx`：行状态显示"下载已取消"（stop 图标）；queued/downloading/paused 行新增"取消下载"（保留记录）；cancelled 行显示"重试下载"+"移除记录"；非完成记录的移除确认文案改为"移除下载记录？…不影响已保存音频"；"全部取消"改调 `cancelAll` 并更新确认文案（标记取消、可重试或移除）。

## 验证

- `npm run check` 542/542（新增2项：单取消保留记录且不可解析、重试后完成；全部取消保留完成文件且 pending 归零）。
- 云端UI回归 `testDownloadSettingsAndOfflinePlayback`（CI 第三组）随 868585b 运行验证；本机未单独重跑该长用例。
- 并行会话说明：批次5A（本地索引批量动作）由另一会话并行实施（74ff975），本批未触碰 localAudio/LocalAudioLibrary，无文件冲突。

## 增量：任务多选批量管理（E-1300）

- `BatchSelectionBar` 扩展下载动作（暂停/继续/取消/重试/移除记录）与 `unit` 文案；DownloadSettings 任务区长按进入多选（复用 selection 域），批量操作逐个执行并汇总"已暂停 N / M 个任务"。
- 负证据：首版把整行包成 Pressable，`testDownloadSettingsAndOfflinePlayback` 在本机失败（暂停窗口错过，AX/时序变化）；改为仅内容区 Pressable 后该回归 `SourceUITests-1792906289395` 1/0/0，对照实验（stash 后同测通过）确认根因在行级 Pressable。

## 未验边界

- 取消在途下载的真实中断点（下载中取消→取消态）由单测的 abort 路径覆盖，未做真机/真网络验证。
- 多选管理已由`3df539f`增量实现；多任务勾选后的批量暂停/继续/取消等真实音源UI验收仍缺，不能把单项+全部回归当作批量界面已验。
- iOS 27 云端终态、真机/签名/后台下载未验。

## 2026-10-25 在途取消缺陷修正

原活动取消会立即丢失意图，abort后记录停downloading，原未开始取消测试未覆盖。现已修复并补写盘失败后的再次取消；561项检查与真实MP3 HTTP/磁盘集成通过，详见[回执](2026-10-25_download-active-cancel-report.md)。上述旧未验条目中的取消存储/传输路径得到Node环境验证，App/真实provider/真机及后台边界仍不扩大。
