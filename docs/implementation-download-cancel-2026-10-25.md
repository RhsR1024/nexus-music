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

## 未验边界

- 取消在途下载的真实中断点（下载中取消→取消态）由单测的 abort 路径覆盖，未做真机/真网络验证。
- 批量多选管理界面（多任务勾选批量暂停/继续/取消）未实现——Sollin E-1300 的批量模式为后续增量；本批交付单项+全部两级。
- iOS 27 云端终态、真机/签名/后台下载未验。
