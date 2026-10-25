# 批次6增量：原生后台 URLSession 下载底座

iOS 侧新增原生后台下载会话与 JS 观察适配器：下载任务交给 `URLSessionConfiguration.background`，JS 挂起或进程重启后由系统继续、下次启动认领；前台流式路径保留为非 iOS 平台回退。本批是[在途取消修复](2026-10-25_download-active-cancel-report.md)声明的"原生后台URLSession仍缺"的落地，不含真实后台续跑验收。

## 实现与数据边界

- 原生日志（Application Support/offline-transfers/journal.json）只记任务身份与状态：文件名、generation（UUID，拒绝陈旧delegate回调）、请求指纹、状态与字节进度；URL 和请求头只存在于 URLSession，不落盘。日志受文件保护并排除系统备份；损坏日志隔离保留（journal-invalid-*.json），存储失败阻断新任务但不破坏既有记录。
- 暂停写入不透明 resume 数据（≤5MiB，指纹一致才复用），取消即丢弃；配额由原生强制（已有payload+在途接收 vs 配置上限，单文件2GiB），完成文件做 200/206、Content-Length/Content-Range 与 identity 编码校验后才落位 offline-audio。完成 payload 的归属仍在前端文件存储与其在播检查；`acknowledge` 只清日志不动文件。
- JS 侧 `createBackgroundDownload` 只观察原生日志：abort('pause')/abort('cancel') 映射为原生停止方向，中断携带已收字节；`recoverState`/`recoverDownload` 在解析URL前先认领原生任务；`stopDownload` 等待日志离开活动态；`remove` 先丢日志再删文件。`OfflineDownloadStore` 在原生可用时按任务独立并发（不再串行 tail），`restore()` 从日志恢复 paused/cancelled 并对完成文件 acknowledge；队列引用、失败保留与在播保护语义不变。
- 模块经 expo-module.config.json 注册（modules + appDelegateSubscribers），AppDelegate 已是 ExpoAppDelegate，`handleEventsForBackgroundURLSession` 由订阅者转发。

## 验证

- `npm run check` 570/570（新增9项适配器测试：完成字节与acknowledge、暂停/取消两个方向的abort与已收字节保留、预中止不启动、容量/网络失败文案、日志缺失即报错、recoverState映射、recoverDownload认领与已结算忽略、stopDownload等待结算、remove顺序与partialSize合并）。
- 原生真实音频契约：`scripts/verify-live-native-offline.mjs` 以两份已授权 V261020 原始MP3（SHA256 `be80e864…`、`086eb96a…`）驱动本机 URLSession：262144字节处暂停→按Range续传→完成字节精确（3,740,360 / 4,215,580），取消→显式重试字节精确，journal 重启恢复、acknowledge保留payload、容量上限拒绝且无残留文件，journal 文本不含任何传输URL。回执 `build/native-offline-real-20261025-r1/receipt.json`（源码/输入SHA绑定，r1即最终）。
- Release App 构建包含新模块注册：Release 冒烟UI `SourceUITests-1792937561109` 1/0/0，证明 `NexusDownloadsModule` 与 AppDelegate 订阅者编译进正式App并实际运行。

## 边界

本机探针使用 macOS ephemeral 会话，**不等同 iOS 后台会话验收**：App 挂起/锁屏后的系统级续跑、真实provider多任务、断点跨进程认领的真机行为、iPhone/签名（本机0可用签名身份）与后台播放仍待。本批无UI布局变更，未使用合成截图。
