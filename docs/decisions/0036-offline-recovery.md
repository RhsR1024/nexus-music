# 0036：离线任务启动与前台恢复

2026-10-17，范围 F22/M10。保留现有永久离线队列，补齐中断后自动恢复；平台后台会话另作实现。

## 证据与采纳

Sollin 固定 IPA 经 reverse-skill mobile-reverse PRIMARY、离线 scope、E-005→F-004→P-004 与严格 review，确认下载服务/元数据/歌词格式化/设置静态模块线索。raw file offset 不作为函数地址。尚未恢复其启动或后台状态机，因此本批不声称与 Sollin 行为等价。脱敏结论见[IPA分析](../SOLLIN_IPA_ANALYSIS.md)，完整五参考实现/维护/许可/Android 比较见[参考比较](../REFERENCE_COMPARISON.md)。

## 决定

`restore()` 将残留 downloading 记录变回 queued；`resumeQueued()` 按持久化顺序串行调用原有 `start()`，重复前台事件复用同一任务 Promise。只处理 queued，尊重用户暂停；失败任务等待用户重试，单项失败不阻断后续任务。下载重新解析 URL，不持久化签名链接或请求头。已保存的 partialBytes/validator 交给原传输适配器校验，临时文件或实体不一致安全全量重下；不承诺进程突然终止前最后一个未落库字节可续传。

源初始化维持异步；首屏与其他功能不等待全部 LX 初始化，只有恢复下载等待该 Promise 完成。AppState active 时再次调度；这不表示系统挂起后仍在持续下载，不自动重试 failed，不启用音频保活伪装下载。

## 验证

324 项业务与类型检查通过（`build/logs/check-offline-recovery-final.log`）：包含进程恢复、显式暂停/失败隔离、重复启动与前台事件不重复请求、顺序、单项失败不阻断、等待中暂停、恢复偏移和实体 validator。真实本地 HTTP/磁盘传输测试继续在现有套件运行，覆盖 Range、实体变更、短流与全量回退。

本批正式 App 源管理与 Navidrome/PCM/多皮肤/歌词/mini/重启回归2/2、零失败/跳过，完整 native 也已通过；证据见 BUILD_STATUS。本地清洁 IPA 和对应 iOS27 终态继续分别记录，未完成项不提前勾选。系统 URLSession 后台、OS 重启/强制结束策略、长期跨服务、私人服务、签名和真机仍待。无新依赖或参考代码复制，原生后台 Android 实现另行验收。
