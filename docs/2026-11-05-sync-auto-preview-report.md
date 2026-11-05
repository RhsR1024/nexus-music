# 本机编辑自动刷新合并预览

此前多设备同步只在启动、回到前台或用户手动点击时读取合并预览。用户在本机新增/修改收藏、歌单、音频匹配、歌词选择或目录收藏后，再次打开同步面板仍可能看到旧预览；若直接确认，只能在提交前因本机签名变化被拒绝，体验和状态提示都不完整。

本批让已配置同步的 `WebDAVSync` 订阅音乐库快照：只有 `syncRecords()` 覆盖的同步集合实际变化时才调度，设备本机历史、统计和播放队列写入不触发。连续本机编辑以 `1200ms` 防抖合并为一次自动 `preview()`；自动流程只执行 GET 读取并生成合并计划，不执行 PUT、不写基线、不自动确认冲突。后台期间不发起隐藏读取，回前台仍走既有 `previewIfConfigured()`，并覆盖期间累积的本机编辑。

预览进行中发生本机编辑时，当前结果可以被展示但不会被误认为最新；请求结束后补读一次，旧预览身份不能用于提交。提交完成后的 `library.restore()` 被抑制，避免把同一次提交的恢复误判为新的本机编辑而回环预览。配置保存仍保留“同步目录已保存，请读取合并预览”的既有手动流程；配置期间的本机库变化仍会纳入随后读取的本机快照。

## 验证

新增四项业务测试，`tests/webdav-sync.test.ts` 共 24 项：

- 多次收藏/歌单编辑只调度一次 750ms 测试计时器，完成后仅一次 GET、零 PUT，预览包含全部新记录。
- 本机播放历史写入不调度预览、不产生请求。
- 后台编辑不产生隐藏读取；回前台预览准确包含该编辑且零 PUT。
- 预览期间编辑只补读一次；旧预览不能提交，新预览包含编辑且零 PUT。

`npm run check` 为 1039/1039，0 failed/skipped/cancelled，日志 `build/logs/check-sync-auto-preview-20261105-r4.log`，SHA-256 `fc929f1c69791ca3cf6132ca0edd910e7d51559b1e4f03e25f9828453e127ba1`。`git diff --check`、`node --check scripts/test-ui.mjs` 与项目 Xcode 工具链的 Swift parse 通过。

## 正式 UI 回归

测试使用正式 App 与合成 WebDAV 夹具：先建立三方冲突，再在本机改名歌单，关闭面板期间等待自动 GET 并断言 PUT 不增加；重新打开面板确认冲突提示来自自动预览，截图后再走原有 Home 返回前台补读、旧确认拒绝、重选提交、重启与远端删除传播。删除本机远端歌单后再次等待自动 GET、零 PUT，再手动确认删除传播。最后显式等待 WebDAV 面板和管理入口后移除连接。

- r1：`build/sync-auto-preview-20261105-r1/`，主机锁屏导致每步约 60 秒动画空闲等待，主动终止本地 xcodebuild；不计通过或失败，结果与诊断保留。
- r2：`build/sync-auto-preview-20261105-r2/`，运行 4915.296 秒后失败；核心自动预览断言已通过，失败在末尾清理时未重新打开 WebDAV 管理入口，`移除WebDAV连接：Sync fixture` 不存在。失败原件保留，不计通过。
- r3：`build/SourceUITests-1793876399041.xcresult`，Release 1/0/0、191.455 秒、exit 0、`sourceUnchanged=true`，完整链路通过。输出目录 `build/sync-auto-preview-20261105-r3/`，日志 `build/logs/ui-sync-auto-preview-20261105-r3.log`。

测试侧增加仅在 `NEXUS_UI_DISABLE_ANIMATION_IDLE=1` 时生效的 `idleAnimationWaitEnabled=false` 开关，用于规避主机锁屏时 XCTest 每步等待动画空闲的诊断问题；它不跳过点击、输入、等待或产品断言，不是产品行为，也不改变正常测试路径。

证据哈希：

- source digest：`754fd317b8f239bdcfa141e438950ab67781baa94290e4420d5a004a25458491`。
- 安装 bundle digest：`13d9854dfaf89d255bb5ea6af44b2982795ad05d62d64c3f48ac2b7acef5d9a3`。
- result Info SHA-256：`282a25f240198b360b5e07b908b4a37eec48bfcda80f537f0c83acf21c5ac9b8`。
- run manifest SHA-256：`3aa0c357da066330d31a2edb099f46ec15f78adf222a8bf044e4af7439595d50`。
- ui-summary SHA-256：`1817c9d21dbeeb659824e72ee0a816ad1a14fbf43d466296a6fe311c26ec6ec6`。
- ui-server-counts SHA-256：`1aec2a1fa6ff8ee1c1f038a59b1c3eed464a30de5aa2749db3c1727c6482e1c9`。
- ui-catalog SHA-256：`d764926cf4d8065eb3c26cc0efaa308a1dc276856b96360153b0f24f9be4bffc`。
- tee 日志 SHA-256：`7751c38dfb1fb8dc3c312cd6dd67e782a6c374ffd813e0aea31f823bf81ec075`。

三张 1290×2796 截图已导出并亲看：

- `001-Stale-sync-confirmation-rejected-after-foreground-refresh.png`：旧确认经前台刷新后拒绝，确认按钮禁用且当前预览保留。SHA-256 `35d0c01700fdc17c0c0fed3365830a35b55f86114b374c69717e3fa0d08e1a8f`。
- `002-Three-way-conflict-preview.png`：三方冲突的本机/云端版本和逐项选择区域。SHA-256 `934db704080cb64ddd9c9708a68c3961bdcf19e81d70919433e98fadf0bde015`。
- `003-Automatic-local-edit-conflict-preview-without-PUT.png`：自动预览产生的同态冲突提示。内容与 002 相同，SHA-256 同为 `934db704080cb64ddd9c9708a68c3961bdcf19e81d70919433e98fadf0bde015`；它证明自动刷新后的界面状态，不单独证明网络边界，网络边界由计数断言覆盖。

截图索引 SHA-256 `33274fa1600ef0b4fab7f3da951ee67558c90bacb64ce3b1184a250ff62eb261`。

夹具整轮累计 `propfind 7 / mkcol 1 / PUT 3 / GET 12 / authFailures 0`。3 次 PUT 全部来自原有的用户明确确认提交；自动预览、前台补读和删除后的自动阶段均断言零新增 PUT。

复现入口（使用新输出目录，不覆盖本批结果）：

```bash
source scripts/environment.sh
export NODE_OPTIONS= PYTHONPATH=
node --experimental-strip-types --test tests/webdav-sync.test.ts
NEXUS_UI_RUN_DIR=build/sync-auto-preview-next \
  NEXUS_UI_DISABLE_ANIMATION_IDLE=1 \
  node scripts/test-ui.mjs NexusMusicUITests/SourceSettingsTests/testUCloudSyncPreviewConflictRestartAndDeletion
```

若主机未锁屏且不出现动画空闲等待，可省略 `NEXUS_UI_DISABLE_ANIMATION_IDLE=1`。

## 清洁设备包与T7

产品提交`1df0e7d4a1a37a97fc58eb8eb45afd475e8876ce`的 clean unsigned archive 通过，manifest 与提交一致、`dirty=false`、`workingTreeChanges=[]`、arm64/iphoneos26.2/iOS15.1/[1,2]、`signed=false`。`unzip -t` 对全部 178 个 ZIP 项 CRC 通过；其中 90 个有效项、63 个载荷文件、8 个隐私清单，88 个 `._*` 为 AppleDouble 元数据，不计入载荷。63 个载荷文件与 archive app 逐字节一致，0 缺失/差异；`_CodeSignature` 项为 0，`codesign` 明确为 `not signed at all`，`PrivacyInfo.xcprivacy` 通过 `plutil -lint`。生产 bundle 含 `pendingEditSignature`/`lastPreviewedSignature`/`flushEditPreview`/`editDelay` 标记，测试适配器、主题观测和夹具口令标记均不存在。

- IPA：17,864,903 字节，SHA-256 `6afdd9d3f8695781924ee6273481faaf7cf813c44e7487cd9ba581252d84488a`；同目录 `.sha256` 复核 OK。
- manifest：`build/distribution/build-manifest.json`。
- 独立 verification：`build/distribution/verification.json`，SHA-256 `c0dff4facd750d61d8720b4817dc9b7faf94887dbe37f5bfdff3c3b22e089bb1`，`ready=true`。
- 源码 tar：15,687,680 字节，SHA-256 `d6590a22df1da31e84488abb19c8ff2b39f2fe3f3af1b2e45dc25224b94118ed`；与 Git 树 1,103 个条目（1,101 文件 + 2 符号链接）逐一比对模式与 blob，0 差异/0 额外。
- 提交补丁：47,123 字节，SHA-256 `0124a7a066ce70d4b0064039c477e0bd298e326fd7db3a3ccac63d4603b95ac2`。
- 归档日志：`build/logs/archive-sync-auto-preview-20261105.log`，SHA-256 `813bdf0cf7ee8734bad6a06eaaaea48f555f17767897d54b565bf2ba311f1fd5`。

T7 阶段 `/Volumes/T7 Touch/NexusMusic/BuildArchive/2026-11-05-sync-auto-preview-1df0e7d` 保存 clean 分发、xcarchive、源码 tar/补丁、r1/r2/r3 原始结果/截图/诊断、check/archive/UI 日志、脚本与报告快照。323 份业务文件/533,599,597 字节逐文件源/目标 SHA-256 一致，0 差异、源保留、零删除；`inventory.json` SHA-256 `e63d2cf98be5fea962516218ab629a48577d56f1f2a752ad1ce43652d083e151`，`transfer-receipt.json` SHA-256 `0f67c2625279633f3e933df03a3d2c8159e7dab0100eceabf7f4a89bb85697d4`。r2 的 396MiB 长失败结果因保留原始证据一并归档；内盘约 58GiB、T7 约 568GiB，未做清理或搬移个人文件。

## 正常push与云端

产品与交付文档已正常push。2026-11-05 19:19（Asia/Shanghai）远端 main 实核 `10d542044819081e5b9b9d514b3892159337810f`；随后队列记录提交 `77c5bd0` 也已 push。工作流忽略 `docs/**` 与 `**/*.md`，因此 `77c5bd0` 不触发新运行。Actions 网页仍为 `42000006592/a55f90d` 运行（旧睡眠提交，不含本批同步代码）、`42017894763/10d5420` 唯一 pending（包含本批产品代码），1运行/1排队，未手动取消/重派。本记录不把旧运行当本批云端结果，云端终态仍待。

本次队列记录时远端 main 为 `c94c882694d642c4a7b9a850e54ac5495953dc48`。Actions 页面、修正后的本回执和 `HANDOFF.md` 另存 T7 `postpush-c94c882/`，4份/1,046,652字节逐文件源/目标SHA-256一致、源保留/零删除；该子目录 receipt SHA-256 `c55780f6f41d1eaeb00e2765bb9c0b715ff62c5523ed02eb8878d3c5e8652e22`，不覆盖主323份阶段清单。队列仍为上述1运行/1排队。

## 边界

本批不宣称完成 F33/J54：自动流程只刷新预览，不自动提交；保存/提交进行中的前台事件仍沿用既有返回，不做并行读取；真实双设备、私人 WebDAV、长时并发/后台持续同步、系统终止后的自动恢复、实体机/签名与 iOS27 云端终态继续开放。push 已完成，云端终态仍待。
