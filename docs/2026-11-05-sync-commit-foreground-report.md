# 提交期间前台刷新与后台排队边界

已配置同步在提交（PUT→回读校验→本机事务）期间收到前台事件时，旧实现直接返回 `false`，事件被丢弃；预览期间排队的前台补读在应用转后台后仍可能于请求结束的 `finally` 中发起一次隐藏 GET。本批关闭这两个边界，不改变自动预览不提交、冲突必须人工确认的产品语义。

## 实现

- `previewIfConfigured()` 只在前台、已配置且连接仍存在时工作；`preview` 或 `commit` 忙碌时把前台刷新合并为一个排队请求，不再并发读取。
- `commit` 完成后由 `finally` 调用 `flushForegroundRefresh()`：重新检查忙碌、前台、目录与连接身份后才启动一次补读；任何一项失效都向等待者返回 `false`，不消费新请求。
- `setForeground(false)` 除清除本机编辑防抖外，还立即以 `false` 结束并清空排队刷新；预览结束、提交结束都不会在后台补读。回前台后仍由既有 `previewIfConfigured()` 显式预览覆盖本机编辑。
- 提交期间连接被替换或删除时，先结束排队等待者再中止请求，避免提交迟到结果或新连接请求被旧 `finally` 消费。
- 目录保存（`configure`）期间仍不自动排队：现有界面明确提示“同步目录已保存，请读取合并预览”，保留用户点击 `读取合并预览` 的显式流程。
- 不自动 PUT、不写基线、不自动确认冲突；已在前台启动的显式提交/预览不被转后台强行中断。

## 单元验证

`tests/webdav-sync.test.ts` 新增 4 项，共 28 项：

- 提交回读挂起时前台刷新只排队，提交期间 GET 数不增加；恢复后只补读一次，零额外 PUT。
- 提交在后台完成时，排队者返回 `false`，仅保留提交自身的回读 GET；回前台显式预览才再次读取。
- 预览挂起时排队刷新，转后台后排队者为 `false`，请求结束不产生第二次隐藏读取；回前台显式预览包含后台编辑。
- 提交中替换/删除连接时排队者立即为 `false`，提交被中止且没有补读 GET。

`npm run check` 为 1043/1043，0 failed/skipped/cancelled。`git diff --check`、`node --check scripts/test-ui.mjs` 与 Swift parse 通过。

## 正式 UI 回归

新增 `testUCloudSyncCommitForegroundRefresh`，使用正式 Release App 与合成 WebDAV 夹具：保存目录→读取预览→明确确认提交；夹具挂起提交回读 GET 后按 Home 再激活，面板保持打开，15 秒内 `gets` 不增加、`held` 仍为 1；释放后仅一次补读，整段相对提交前为 `PUT +1 / GET +2`，界面回到“合并预览已就绪”。

- 结果：`build/SourceUITests-1793878235033.xcresult`，Release 1 passed / 0 failed / 0 skipped，246.342 秒，`sourceUnchanged=true`。
- 输出目录：`build/sync-commit-refresh-20261105-r1/`；日志：`build/logs/ui-sync-commit-refresh-20261105-r1.log`。
- source digest：`197dfc00aac6dfeec544ab20c522d550eebc18e99e77aaf94149e92f3245f043`。
- 安装 bundle digest：`d2ff1262b6a4d9289b38b73bbff66bb96ffaba3b5e91fbac1f4bab48095ac19c`。
- 夹具 SHA-256：`3709a73d019298ac856dd74e8fbf26af3b38ceca4d03424c28fbecccdbb6f6b6`。
- result Info SHA-256：`5924efbcd00784ed1553b3245579ddf13fde90c865e9fa0840533922a5d63a22`。
- run manifest SHA-256：`27b35f0009ab77fea830a4a1336c8c809ffc56e6122ff89b99bf973a537eb65b`。
- ui-summary SHA-256：`a3f39aa83b2e3e2db0e36d43be532b42bf84d22afa2ef548312458cb8cc6a3b3`。
- ui-server-counts SHA-256：`db1b53aad2f0cf18439d40ed4a0d9015a8aed4171bccd149f5d1694980d5fc01`。
- ui-catalog 日志 SHA-256：`0134fb8c102198998e9762c81d9b704991bf5517219799577f63df4f8c1cf5e0`。
- tee 日志 SHA-256：`2765049e27f5a6c34c9ee68b0f0d91becb78b49f39b38a102b81cb9c22c9038a`。

整轮夹具 `propfind 5 / mkcol 1 / PUT 1 / GET 4 / authFailures 0`。唯一的 PUT 来自用户明确确认的提交；提交前初始化/显式预览与提交回读、提交后补读分别计入 GET。截图 `001-Commit-foreground-refresh-preview.png`（1290×2796，SHA-256 `79f142f88b6a741d3e4368f59f5f75f24be7d61b1acb747d9f857b8d09d1e5b9`）已导出并亲看，显示补读后的无冲突预览与“合并预览已就绪”。截图索引 SHA-256 `9ce4c18756131c2416e7a3c31a628903da2377c15ffa8e63516bdcbe47a80242`。

夹具的 `/sync-fixture/release-reads` 现同时清除 `hold-next-read` 标志，避免前一轮残留影响下一次正式回归；不改变已挂起请求的释放行为。

## 清洁设备包与T7

产品提交`97f452e52d23a7656a203e7b9bc26f6d6f6a3707`的 clean unsigned archive 通过，manifest 与提交一致、`dirty=false`、`workingTreeChanges=[]`、arm64/iphoneos26.2/iOS15.1/[1,2]、`signed=false`。

- IPA：17,865,361 字节，SHA-256 `63978bd56365a19a434895a6f664725bb5616fac2e47e4a83e5b98eb57e41841`。
- 178 个 ZIP 项 CRC 通过；63 个载荷文件与 archive app 逐字节一致，0 缺失/差异；88 个 `._*` 为 AppleDouble 元数据；8 个隐私清单；`_CodeSignature` 项为 0，`codesign` 为 `not signed at all`。
- 生产 bundle 含 `failForegroundRefresh`/`flushForegroundRefresh`/`queueForegroundRefresh` 标记；测试适配器、主题观测和夹具口令标记均不存在。
- manifest：`build/distribution/build-manifest.json`，SHA-256 `2eff34dbd6456113295b7ed834cf003f9f6e8bf938d2ca7e0cad271e735dc128`。
- 独立 verification：`build/distribution/verification.json`，SHA-256 `d0b063130a1169b69ede3369ff6c6387798145ea542f914e83c5cbf9b3e1501d`，`ready=true`。
- 源码 tar：15,708,160 字节，SHA-256 `55188f7e8f344dff0d34ecb4b5829b83dd80491ea5e17e4622a6eac47390e64d`；与 Git 树 1,104 个条目（1,102 文件 + 2 符号链接）逐一比对模式与 blob，0 差异/缺失/额外。
- 提交补丁：34,745 字节，SHA-256 `8c37bc81820c75954251dec8c1aeef89cea4c51f3b3afc9486c535122c7eae23`。
- 归档日志：`build/logs/archive-sync-commit-foreground-20261105.log`，SHA-256 `8d2d7b6c7d6edb0d3a5eb6b24767bffb8780bf21b54fb6474b6c9f8f41162e11`；检查日志 SHA-256 `9a1e45cc87707154174c1d5c9a3ce3f4ffd13fa54cfbdb390cb99088f5a73797`。

T7 阶段 `/Volumes/T7 Touch/NexusMusic/BuildArchive/2026-11-05-sync-commit-97f452e` 保存 clean 分发、xcarchive、源码 tar/补丁、xcresult、运行清单、截图索引、check/archive/UI 日志、源码/文档快照与报告。1,114 份业务文件/119,152,758 字节逐文件源/目标 SHA-256 一致，0 差异、源保留、零删除；`inventory.json` SHA-256 `bcd7818dd6c131d33934afbe791a589bcf3f6d573970994247a55278414d0dee`，`SHA256SUMS` SHA-256 `f8ce6264143798277b3ba8b63269165d33f641ed63b952d59f9df452afd428b4`，`transfer-receipt.json` SHA-256 `b92b69b91cf40127c5b13571281540dfa7ca1d934a23551781ab2f8cbd1ff47b`。内盘约 58GiB、T7 约 568GiB，未做清理或搬移个人文件。

## 边界

本批不宣称完成 F33/J54：真实双设备/私人 WebDAV、长时并发与后台持续同步、进程终止后的自动恢复、实体机/签名与 iOS27 云端终态仍开放。自动流程仍只刷新预览，配置保存仍要求用户显式读取预览，提交仍必须由用户确认。
