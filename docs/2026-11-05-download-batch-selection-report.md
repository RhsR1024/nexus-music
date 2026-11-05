# iOS27 下载批量选择测试修正

本地 Release 全流程通过；旧云端失败保留，新 iOS27 终态仍待。本批只采纳已在工作区的测试候选，不修改产品下载、选择、持久化或播放逻辑。

## 原失败与候选

GitHub 官方 job `126503672062` 解码日志确认 `41800375748/f9121ca` 在 `testDownloadTaskBatchActions` 等待“已取消 2 / 2 个任务”失败，原位置 `SourceSettingsTests.swift:3712`。检查和其他测试组结果不得代替该下载组。

既有测试用第二行容器的相对坐标点击；候选改用已存在的真实无障碍按钮“选择下载任务：Synthetic tone 2”，取消前新增“已选 2 / 2 个任务”的严格屏障，重试也按同一稳定身份选择。原有两项在途、全选/清空、空选择禁用、暂停、取消、重试、完成文件排除选择、删除和恢复并发1/移除合成连接的断言全部保留。

这修正测试的目标与时序，不证明旧 iOS27 根因已在云端消失。没有新 Sollin 采集、逆向或功能规则采纳；沿用[选择边界回归](2026-11-02-selection-boundary-report.md)的正式业务机制，不扩大其真实服务/设备结论。该候选先与注音批次隔离，亲读后独立验证和提交。

## 本地证据

`build/SourceUITests-1793842666037.xcresult`，iPhone15ProMax / iOS26.3.1 模拟器、Release，`testDownloadTaskBatchActions` 为 1 通过 / 0 失败 / 0 跳过、251.875 秒、exit0、`sourceUnchanged=true`。运行清单为 `build/download-batch-selection-20261105-r1/run-manifest.json`。

source digest `f6644a532ecd66b566d63aa8cc6235390ea45b5eacb70575ea26cfcf01bd7cb1`，实际安装 bundle `66dadd136ea442e4b6bb1615550f61f127d829fd024c7867ebe22bad3d6ac6ac`。服务端 `authFailures=0`、`heldFull=2`、`fullFinished=2`、`full=4`、`resumed=0`；两项确有在途部分响应，取消后显式重试均完成。此场景没有验证 Range 恢复，不把 `resumed=0` 写为断点续传通过。

五张1290×2796截图均 provenance ready、failures 为空，已全部亲看：选择1/2、清空0/2与禁用五动作、暂停两项、取消两项且保留重试入口、两项保存完成。完成页第二张卡片超出当前视口，按正常滚动和原有逐项删除断言验收，不冒称全部控件同帧可见。

截图索引与逐图SHA-256位于 `build/download-batch-selection-20261105-r1/screenshots/index.json`，来源回执为同目录上级的 `capture-verification.json`。关键取消图 SHA-256 `22b1bb374bcfd6c29403fccc81e2cd9076c0adc0042fd07bf134ff230d0e364b`，重试完成图 `4715f2bafebc3ffda32fb7f6062e4c9bfa7ad26865832a7bdb8b0ac97efd2c24`。

同一产品源码已通过本轮1022业务检查与完整native；本批仅测试定位/屏障变化，实际Release编译与完整上述业务回归通过。测试夹具是隔离的合成120秒WAV与合成账号，不是平台真实音源、私人Navidrome或实体后台下载验收。

## 后续

先提交已验证测试候选并生成包含注音修复的清洁设备包，按真实挂载T7逐文件保存证据；再核对正常push后的1运行/最多1排队。云端iOS27、真实平台批量限流、实体后台、签名与完整F/J继续开放；下一独立产品缺口为J25跨主导航保留搜索类型、平台和草稿。
