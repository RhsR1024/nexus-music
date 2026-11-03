# iOS 27 WebDAV 测试输入修正

最新云端 `41602015021/eaa891a` 核心组为23通过、2失败、0跳过；同步和备份都在地址断言处读到 `htp://`，未进入其业务验收。紧凑包571,855字节，SHA-256 `25d825b8ce68d6a55adebb9d278fe45c9172db93d30ff6def0dd5436da8e52da`，CRC全部通过。原件保留在T7 `NexusMusic/BuildArchive/2026-11-03-ios27-41602015021-diagnostics/`；604MB完整诊断尚未下载，不声明查看其附件。

## 依据、原因与修正

Evidence：两项原始失败都明确为输入地址缺少第二个`t`，而非同步合并、摘要或恢复业务失败。该运行的主屏图标启动26.585秒、备用图标切换/恢复136.819秒、跨页/重启配色622.364秒均通过。整个运行仍为failure，后续测试组未执行。

Finding：单次直接`typeText`也可能丢键；此前将逐字输入合并只能减少idle等待倍增，不能保证最终值。当前证据不足以确定iOS系统丢键的内部原因。

Path：仅将同步/备份的WebDAV地址输入改为既有`replaceText`辅助器。辅助器使用真实UIKit全选或键盘快捷键替换，核对实际值；不符时按有界Delete清空后重输，最终仍严格断言完整地址。产品代码、账号输入、网络连接、冲突/取消/重启/删除和备份恢复断言均保留，无新增Sollin观察或参考对齐结论。

## 本地复验

```bash
source scripts/environment.sh
NEXUS_UI_RUN_DIR=build/ios27-dav-input-20261103-r1 node scripts/test-ui.mjs NexusMusicUITests/SourceSettingsTests/testUCloudSyncPreviewConflictRestartAndDeletion NexusMusicUITests/SourceSettingsTests/testVCloudBackupUploadRestartPreviewRestore
```

Release `SourceUITests-1793716226294.xcresult`：2通过、0失败、0跳过，exit0，`sourceUnchanged=true`。同步241.759秒、备份200.666秒；本机模拟器为iOS26.3.1，不能替代iOS27。同步覆盖冲突预览、取消保留本地、采用云端、重启、删除及连接清理；备份覆盖上传/回读摘要、重启、恢复预览/取消/确认、坏备份拒绝及连接清理。

- source digest：`1e45f05ce7c1020034b9c2285e6b4ab316f7d88c915605c4220b5b3dc506dd01`
- installed bundle：`c1efc65076518e0540a072bfe6b874f37a1c5e62b227b63fc265ab5449c814ac`
- run manifest：`d893b5e4d2990426385f0d7ef1f4a0998311d256a1f1d0202b184ff2a2ffb6a1`
- UI summary：`af899b1cbab200c601c077c1ea38d28fd969325e8624ce9decb49b00d395caeb`
- 两张截图索引：`e08ee244e195a1135034419b39d35b239405e1588f2d1a7d510ab79e424277e3`

从精确xcresult导出并亲看冲突与备份预览截图：本地/云端版本清晰、未选择时确认禁用；备份摘要/数量和恢复按钮可见。997项业务/类型检查全通过；测试目标已由真实Release构建编译。本批仅改UI测试，无产品载荷变化，不重复生成相同unsigned IPA；原`eaa891a`清洁交付继续保留。新提交的iOS27完整回归仍待，不把本机通过当成云端故障关闭。实体机、签名、真实私人服务及完整F/J目标继续开放。

## 后续交付补记

最初复用旧IPA的决定已由后续实际归档取代：`49111c5` clean HEAD重新生成unsigned IPA，manifest clean，ZIP/逐文件/隐私排除及T7核验通过。精确哈希、3张完整截图索引与存储/远程交付以[最终回执](2026-11-03-ios27-dav-address-input-report.md)为准，保留上文初始记录，不将本地通过写为iOS27通过。
